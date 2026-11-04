import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function clearTestData() {
  console.log('🔄 Clearing operational test data...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Truncate all operational transaction tables and restart auto-increment IDs from 1
    await client.query(`
      TRUNCATE TABLE 
        driver_settlement_payments,
        trip_payments,
        driver_expenses,
        settlements,
        truck_advances,
        driver_advances,
        owner_advances,
        trips
      RESTART IDENTITY CASCADE;
    `);

    await client.query('COMMIT');
    console.log('✅ Successfully cleared test data and reset primary key IDs to 1.\n');

    // Verify row counts of cleared tables
    console.log('--- CLEARED TABLES STATUS ---');
    const clearedTables = [
      'trips',
      'truck_advances',
      'driver_advances',
      'owner_advances',
      'driver_expenses',
      'settlements',
      'trip_payments',
      'driver_settlement_payments'
    ];
    for (const tbl of clearedTables) {
      const res = await client.query(`SELECT count(*) FROM "${tbl}"`);
      console.log(`- ${tbl}: ${res.rows[0].count} rows`);
    }

    // Verify preserved master data & users
    console.log('\n--- PRESERVED MASTER & USER DATA ---');
    const preservedTables = [
      'users',
      'vehicles',
      'drivers',
      'owners',
      'parties',
      'routes',
      'units',
      'freight_rates'
    ];
    for (const tbl of preservedTables) {
      const res = await client.query(`SELECT count(*) FROM "${tbl}"`);
      console.log(`- ${tbl}: ${res.rows[0].count} rows`);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error clearing test data:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

clearTestData();
