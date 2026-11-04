import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const owners = await pool.query('SELECT id, name, mobile_number FROM owners ORDER BY name');
const vehicles = await pool.query(
  `SELECT v.id, v.lorry_number, v.owner_id, o.name as owner_name
   FROM vehicles v LEFT JOIN owners o ON o.id = v.owner_id
   ORDER BY o.name NULLS LAST, v.lorry_number`
);
const users = await pool.query('SELECT id, username, name, role FROM users ORDER BY id');
const cons = await pool.query(
  `SELECT conname, pg_get_constraintdef(oid) AS def
   FROM pg_constraint WHERE conrelid = 'users'::regclass AND contype = 'c'`
);
console.log('CONSTRAINTS', cons.rows);
console.log('OWNERS', owners.rows);
console.log('VEHICLES', vehicles.rows);
console.log('USERS', users.rows);
await pool.end();
