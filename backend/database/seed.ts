import bcrypt from 'bcryptjs';
import pool from '../src/config/database';

async function seed() {
  try {
    console.log('Seeding admin user...');
    const hash = await bcrypt.hash('Admin@123', 12);
    await pool.query(
      `INSERT INTO users (username, name, password_hash, email, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (username) 
       DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE'`,
      ['admin', 'KSP Admin', hash, 'admin@ksp.com', 'ADMIN', 'ACTIVE']
    );
    console.log('✅ Admin user created/updated successfully (admin / Admin@123)');

    // Also create a sample Transport User for mobile app testing
    const userHash = await bcrypt.hash('User@123', 12);
    await pool.query(
      `INSERT INTO users (username, name, password_hash, email, mobile_number, role, driver_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (username)
       DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE'`,
      ['driver1', 'Rajan Driver User', userHash, 'rajan@ksp.com', '9876543210', 'TRANSPORT_USER', 1, 'ACTIVE']
    );
    console.log('✅ Transport user created/updated (driver1 / User@123)');

    await pool.end();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
