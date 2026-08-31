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
        const localAddr = parts[1] || '';
        if (localAddr.endsWith(`:${port}`)) {
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
    // Test database connection
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected successfully');
    client.release();

    const server = http.createServer(app);
    let isListening = false;

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${PORT} is busy. Automatically clearing stale process and retrying...`);
        freePort(PORT);
        setTimeout(() => {
          if (!isListening) {
            server.listen(PORT, () => {
              isListening = true;
              console.log(`🚀 KSP Transport API running on port ${PORT}`);
              console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
              console.log(`   Health: http://localhost:${PORT}/health`);
            });
          }
        }, 600);
      } else {
        console.error('❌ Server error:', err);
      }
    });

    server.listen(PORT, () => {
      isListening = true;
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
