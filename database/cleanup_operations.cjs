const path = require('path');
const { Pool } = require(path.join(__dirname, '..', 'backend', 'node_modules', 'pg'));

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'ksp_transport',
  user: 'postgres',
  password: 'qwerty'
});

async function cleanupOperations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Clearing operations tables and resetting sequences...');
    await client.query(`
      TRUNCATE TABLE 
        driver_settlement_payments,
        driver_expenses,
        settlements,
        trip_payments,
        truck_advances,
        driver_advances,
        owner_advances,
        trips
      RESTART IDENTITY CASCADE;
    `);

    console.log('Cleaning up operations-related audit logs...');
    const auditRes = await client.query(`
      DELETE FROM audit_logs 
      WHERE module IN ('TRIPS', 'PAYMENTS', 'SETTLEMENTS', 'TRUCK_ADVANCES', 'DRIVER_ADVANCES', 'OWNER_ADVANCES');
    `);
    console.log(`Deleted ${auditRes.rowCount} operational audit logs.`);

    await client.query('COMMIT');
    console.log('Operations data successfully cleaned up and sequences restarted to 1!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Cleanup failed, rolled back:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupOperations().catch(console.error);
