const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanupTestData() {
  const client = await pool.connect();
  try {
    console.log('--- BEFORE CLEANUP ---');
    const tables = [
      'driver_settlement_payments',
      'settlements',
      'driver_expenses',
      'truck_advances',
      'driver_advances',
      'owner_advances',
      'trip_payments',
      'trips'
    ];

    for (const t of tables) {
      try {
        const res = await client.query(`SELECT count(*) FROM "${t}"`);
        console.log(`Table ${t}: ${res.rows[0].count} rows`);
      } catch (e) {
        console.log(`Table ${t} does not exist or error: ${e.message}`);
      }
    }

    await client.query('BEGIN');

    // Delete in reverse order of foreign key dependency
    console.log('\nDeleting transactional test data...');
    await client.query('DELETE FROM driver_settlement_payments');
    await client.query('DELETE FROM settlements');
    await client.query('DELETE FROM driver_expenses');
    await client.query('DELETE FROM truck_advances');
    await client.query('DELETE FROM driver_advances');
    await client.query('DELETE FROM owner_advances');
    await client.query('DELETE FROM trip_payments');
    await client.query('DELETE FROM trips');

    // Reset sequences
    console.log('Resetting sequence counters to 1...');
    const seqs = [
      'trips_id_seq',
      'settlements_id_seq',
      'truck_advances_id_seq',
      'driver_advances_id_seq',
      'owner_advances_id_seq',
      'driver_expenses_id_seq',
      'driver_settlement_payments_id_seq'
    ];

    for (const seq of seqs) {
      try {
        await client.query(`ALTER SEQUENCE IF EXISTS "${seq}" RESTART WITH 1`);
        console.log(`  Reset ${seq} -> 1`);
      } catch (err) {
        console.log(`  Sequence ${seq} skipped: ${err.message}`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Transaction committed successfully!');

    console.log('\n--- AFTER CLEANUP ---');
    for (const t of tables) {
      try {
        const res = await client.query(`SELECT count(*) FROM "${t}"`);
        console.log(`Table ${t}: ${res.rows[0].count} rows`);
      } catch (e) {}
    }

    // Verify master tables remain intact
    console.log('\n--- MASTER TABLES INTEGRITY CHECK ---');
    const masters = ['drivers', 'vehicles', 'owners', 'parties', 'users'];
    for (const m of masters) {
      const res = await client.query(`SELECT count(*) FROM "${m}"`);
      console.log(`Master ${m}: ${res.rows[0].count} rows (intact)`);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during cleanup, transaction rolled back:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupTestData();
