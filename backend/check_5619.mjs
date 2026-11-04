import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query("SELECT id, lorry_number, owner_id FROM vehicles WHERE lorry_number ILIKE '%5619%'");
console.log('Matches for 5619:', r.rows);

const all = await pool.query("SELECT id, lorry_number, owner_id FROM vehicles ORDER BY lorry_number");
console.log('All vehicles count:', all.rows.length);
all.rows.forEach(v => {
  if (v.lorry_number.includes('5619') || v.lorry_number.includes('U') || v.lorry_number.includes('u')) {
    console.log(`  ${v.id}: ${v.lorry_number} (owner: ${v.owner_id})`);
  }
});
await pool.end();
