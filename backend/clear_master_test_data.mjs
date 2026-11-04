import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function clearMasterTestData() {
  console.log('🔄 Starting test data cleanup in Masters and Operations...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Truncate all operational transaction tables and restart auto-increment IDs to 1
    console.log('Clearing operational tables (advances, trips, settlements, expenses, payments)...');
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

    // 2. Clear operational audit logs & audit logs related to test users
    console.log('Cleaning operational audit logs and test user audit logs...');
    const auditRes = await client.query(`
      DELETE FROM audit_logs 
      WHERE module IN ('TRIPS', 'PAYMENTS', 'SETTLEMENTS', 'TRUCK_ADVANCES', 'DRIVER_ADVANCES', 'OWNER_ADVANCES', 'EXPENSES')
         OR user_id IN (SELECT id FROM users WHERE username IN ('driver1', 'user'));
    `);
    console.log(`Deleted ${auditRes.rowCount} audit logs.`);

    // 3. Remove test users ('driver1', 'user')
    console.log('Removing test user accounts (driver1, user)...');
    const userRes = await client.query(`
      DELETE FROM users 
      WHERE username IN ('driver1', 'user');
    `);
    console.log(`Deleted ${userRes.rowCount} test users.`);

    // 4. Remove test drivers ('Ajay', 'Rajan Kumar', 'Suresh Babu')
    console.log('Removing test drivers (Rajan Kumar, Suresh Babu, Ajay)...');
    const driverRes = await client.query(`
      DELETE FROM drivers 
      WHERE id IN (1, 2, 20) OR name IN ('Rajan Kumar', 'Suresh Babu', 'Ajay');
    `);
    console.log(`Deleted ${driverRes.rowCount} test drivers.`);

    await client.query('COMMIT');
    console.log('✅ Cleanup successfully committed!\n');

    // 5. Verification
    console.log('=== CLEARED OPERATIONAL & ADVANCE TABLES ===');
    const operationalTables = [
      'trips',
      'truck_advances',
      'driver_advances',
      'owner_advances',
      'driver_expenses',
      'settlements',
      'trip_payments',
      'driver_settlement_payments'
    ];
    for (const t of operationalTables) {
      const res = await client.query(`SELECT count(*) FROM "${t}"`);
      console.log(`  - ${t}: ${res.rows[0].count} rows`);
    }

    console.log('\n=== MASTER DATA STATUS ===');
    const masterTables = [
      'users',
      'drivers',
      'owners',
      'vehicles',
      'parties',
      'units',
      'routes',
      'freight_rates',
      'cleaning_expense_rates',
      'unloading_rates',
      'driver_bata_rates',
      'other_expense_limits'
    ];
    for (const t of masterTables) {
      const res = await client.query(`SELECT count(*) FROM "${t}"`);
      console.log(`  - ${t}: ${res.rows[0].count} rows`);
    }

    console.log('\n=== REMAINING USERS ===');
    const usersRes = await client.query('SELECT id, username, name, role, status FROM users ORDER BY id');
    console.table(usersRes.rows);

    console.log('\n=== REMAINING DRIVERS (Count: ' + (await client.query('SELECT count(*) FROM drivers')).rows[0].count + ') ===');
    const driversRes = await client.query('SELECT id, name, mobile_number, license_number FROM drivers ORDER BY id');
    console.table(driversRes.rows);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during cleanup, rolled back:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

clearMasterTestData().catch(console.error);
