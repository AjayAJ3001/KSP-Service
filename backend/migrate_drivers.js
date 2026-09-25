const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE drivers
        ADD COLUMN IF NOT EXISTS photo_url TEXT,
        ADD COLUMN IF NOT EXISTS license_photo_url TEXT,
        ADD COLUMN IF NOT EXISTS license_expiry_date DATE,
        ADD COLUMN IF NOT EXISTS license_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS id_proof_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS id_proof_url TEXT;
    `);
    console.log('Migration done: added photo_url, license_photo_url, license_expiry_date, license_type, id_proof_type, id_proof_url to drivers table');
  } catch (e) {
    console.error('Migration error:', e.message);
  } finally {
    await pool.end();
  }
}

migrate();
