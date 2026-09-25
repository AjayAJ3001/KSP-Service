const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query(`
      UPDATE drivers 
      SET license_expiry_date = '2026-10-15'
      WHERE id = 1
      RETURNING id, name, mobile_number, license_expiry_date, status;
    `);
    console.log('Driver 1 updated:', res.rows[0]);

    // Check expiring query
    const expiring = await pool.query(`
      SELECT id, name, mobile_number, license_expiry_date,
        (license_expiry_date - CURRENT_DATE) as days_remaining
      FROM drivers
      WHERE status = 'ACTIVE'
        AND license_expiry_date IS NOT NULL
        AND license_expiry_date <= CURRENT_DATE + INTERVAL '45 days';
    `);
    console.log('Expiring drivers (within 45 days):', expiring.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
