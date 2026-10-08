const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateVehicles() {
  try {
    await pool.query(`
      ALTER TABLE vehicles
        ADD COLUMN IF NOT EXISTS goodshed_loading_expense DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS rc_number VARCHAR(50),
        ADD COLUMN IF NOT EXISTS rc_photo_url TEXT,
        ADD COLUMN IF NOT EXISTS account_number VARCHAR(50),
        ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(30),
        ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS account_photo_url TEXT,
        ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20),
        ADD COLUMN IF NOT EXISTS pan_card_url TEXT,
        ADD COLUMN IF NOT EXISTS dts_number VARCHAR(50),
        ADD COLUMN IF NOT EXISTS dts_expiry_date DATE,
        ADD COLUMN IF NOT EXISTS dts_certificate_url TEXT,
        ADD COLUMN IF NOT EXISTS insurance_policy_number VARCHAR(100),
        ADD COLUMN IF NOT EXISTS insurance_expiry_date DATE,
        ADD COLUMN IF NOT EXISTS insurance_photo_url TEXT,
        ADD COLUMN IF NOT EXISTS permit_number VARCHAR(100),
        ADD COLUMN IF NOT EXISTS permit_expiry_date DATE,
        ADD COLUMN IF NOT EXISTS permit_photo_url TEXT,
        ADD COLUMN IF NOT EXISTS fc_number VARCHAR(100),
        ADD COLUMN IF NOT EXISTS fc_expiry_date DATE,
        ADD COLUMN IF NOT EXISTS fc_photo_url TEXT,
        ADD COLUMN IF NOT EXISTS tax_expiry_date DATE,
        ADD COLUMN IF NOT EXISTS tax_photo_url TEXT,
        ADD COLUMN IF NOT EXISTS rc_expiry_date DATE,
        ADD COLUMN IF NOT EXISTS rc_reg_date DATE,
        ADD COLUMN IF NOT EXISTS rc_photo_back_url TEXT,
        ADD COLUMN IF NOT EXISTS tds_number VARCHAR(50),
        ADD COLUMN IF NOT EXISTS tds_expiry_date DATE,
        ADD COLUMN IF NOT EXISTS tds_certificate_url TEXT;

      UPDATE vehicles SET tds_number = dts_number WHERE tds_number IS NULL AND dts_number IS NOT NULL;
      UPDATE vehicles SET tds_expiry_date = dts_expiry_date WHERE tds_expiry_date IS NULL AND dts_expiry_date IS NOT NULL;
      UPDATE vehicles SET tds_certificate_url = dts_certificate_url WHERE tds_certificate_url IS NULL AND dts_certificate_url IS NOT NULL;
      UPDATE vehicles SET rc_reg_date = rc_expiry_date WHERE rc_reg_date IS NULL AND rc_expiry_date IS NOT NULL;
    `);
    console.log('Migration successful: All vehicle document, banking, and compliance columns added.');

    // Check table columns
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vehicles'
      ORDER BY ordinal_position;
    `);
    console.log('Current vehicles columns:');
    res.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrateVehicles();
