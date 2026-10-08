import http from 'http';
import { execSync } from 'child_process';
import app from './app';
import pool from './config/database';

const PORT = parseInt(process.env.PORT || '5000', 10);

/**
 * Automatically terminates any stale or orphaned process occupying the target port.
 */
function freePort(port: number): void {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const lines = output.trim().split('\n');
      const currentPid = process.pid;

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        // Only target LISTENING sockets on port
        const localAddr = parts[1] || '';
        const state = parts[3] || '';
        if (localAddr.endsWith(`:${port}`) && (state === 'LISTENING' || parts.includes('LISTENING'))) {
          const pid = parseInt(parts[parts.length - 1], 10);
          if (pid && pid !== currentPid && !isNaN(pid)) {
            try {
              execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
              console.log(`🧹 Auto-cleared stale process on port ${port} (PID: ${pid})`);
            } catch {
              // Process already closed
            }
          }
        }
      }
    } else {
      execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
    }
  } catch {
    // Port was already free or command had no matches
  }
}

const startServer = async () => {
  try {
    // Free stale process before listening
    freePort(PORT);

    // Test database connection
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected successfully');
    await client.query(`
      ALTER TABLE vehicles 
        ADD COLUMN IF NOT EXISTS rc_reg_date DATE,
        ADD COLUMN IF NOT EXISTS rc_expiry_date DATE,
        ADD COLUMN IF NOT EXISTS rc_photo_back_url TEXT,
        ADD COLUMN IF NOT EXISTS tds_number VARCHAR(50),
        ADD COLUMN IF NOT EXISTS tds_expiry_date DATE,
        ADD COLUMN IF NOT EXISTS tds_certificate_url TEXT,
        ADD COLUMN IF NOT EXISTS tds_certificate_url_2 TEXT;
      UPDATE vehicles SET tds_number = dts_number WHERE tds_number IS NULL AND dts_number IS NOT NULL;
      UPDATE vehicles SET tds_expiry_date = dts_expiry_date WHERE tds_expiry_date IS NULL AND dts_expiry_date IS NOT NULL;
      UPDATE vehicles SET tds_certificate_url = dts_certificate_url WHERE tds_certificate_url IS NULL AND dts_certificate_url IS NOT NULL;
      UPDATE vehicles SET rc_reg_date = rc_expiry_date WHERE rc_reg_date IS NULL AND rc_expiry_date IS NOT NULL;
    `);
    client.release();

    const server = http.createServer(app);

    server.on('error', (err: any) => {
      console.error('❌ Server error:', err);
    });

    server.listen(PORT, () => {
      console.log(`🚀 KSP Transport API running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
    });

    // Graceful shutdown handling for nodemon and terminal stops
    const shutdown = (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Closing server gracefully...`);
      server.close(() => {
        pool.end(() => {
          console.log('📦 Database pool closed. Bye!');
          process.exit(0);
        });
      });
    };

    process.once('SIGUSR2', () => {
      server.close(() => {
        process.kill(process.pid, 'SIGUSR2');
      });
    });

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
