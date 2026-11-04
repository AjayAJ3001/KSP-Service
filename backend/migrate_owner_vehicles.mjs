import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Step 1: Add owner_id column to vehicles
await pool.query(`
  ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES owners(id) ON DELETE SET NULL
`);
console.log('Added owner_id column to vehicles');

await pool.query(`CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_id)`);
console.log('Created index on vehicles.owner_id');

// Step 2: Seed owners (upsert by name)
const owners = [
  { name: 'C. THILAGANATHY', mobile: null },
  { name: 'A. CHANDRASEKAR', mobile: null },
  { name: 'K.L. BHARATHI', mobile: null },
  { name: 'K.S. PALANISAMY', mobile: null },
  { name: 'P. SELVI', mobile: null },
  { name: 'K.P. DEEPA', mobile: null },
  { name: 'P. LINGAMOORTHY', mobile: null },
];

const ownerMap = {};
for (const o of owners) {
  const existing = await pool.query("SELECT id FROM owners WHERE UPPER(name) = UPPER($1)", [o.name]);
  let id;
  if (existing.rows.length > 0) {
    id = existing.rows[0].id;
    console.log(`Owner exists: ${o.name} => id ${id}`);
  } else {
    const r = await pool.query("INSERT INTO owners (name, mobile_number, status) VALUES ($1, $2, 'ACTIVE') RETURNING id", [o.name, o.mobile]);
    id = r.rows[0].id;
    console.log(`Owner created: ${o.name} => id ${id}`);
  }
  ownerMap[o.name] = id;
}

// Step 3: Map lorry numbers to owners
const lorryToOwner = [
  // C. THILAGANATHY
  { lorry: 'TN 52 5034', owner: 'C. THILAGANATHY' },
  { lorry: 'TN 33 AL 5959', owner: 'C. THILAGANATHY' },
  { lorry: 'TN 33 AK 9988', owner: 'C. THILAGANATHY' },
  // A. CHANDRASEKAR
  { lorry: 'TN 28 AA 5569', owner: 'A. CHANDRASEKAR' },
  { lorry: 'TN 52 A 1846', owner: 'A. CHANDRASEKAR' },
  // K.L. BHARATHI
  { lorry: 'TN 52 D 3441', owner: 'K.L. BHARATHI' },
  // K.S. PALANISAMY
  { lorry: 'TN 33 AE 8004', owner: 'K.S. PALANISAMY' },
  { lorry: 'TN 33 BK 0342', owner: 'K.S. PALANISAMY' },
  { lorry: 'TN 33 BM 0919', owner: 'K.S. PALANISAMY' },
  { lorry: 'TN 33 AL 4720', owner: 'K.S. PALANISAMY' },
  // P. SELVI
  { lorry: 'TN 33 AE 1357', owner: 'P. SELVI' },
  { lorry: 'TN 34 K 8775', owner: 'P. SELVI' },
  { lorry: 'TN 33 AL 9595', owner: 'P. SELVI' },
  { lorry: 'TN 33 U 5619', owner: 'P. SELVI' },
  // K.P. DEEPA
  { lorry: 'TN 33 AM 6996', owner: 'K.P. DEEPA' },
  { lorry: 'TN 33 AD 9425', owner: 'K.P. DEEPA' },
  // P. LINGAMOORTHY
  { lorry: 'TN 33 AW 7171', owner: 'P. LINGAMOORTHY' },
  { lorry: 'TN 33 AQ 8851', owner: 'P. LINGAMOORTHY' },
  { lorry: 'TN 33 AF 7778', owner: 'P. LINGAMOORTHY' },
  { lorry: 'TN 33 AJ 5841', owner: 'P. LINGAMOORTHY' },
];

for (const item of lorryToOwner) {
  const ownerId = ownerMap[item.owner];
  // Try to match lorry number (normalize spaces)
  const norm = item.lorry.replace(/\s+/g, ' ').trim().toUpperCase();
  const r = await pool.query(
    "UPDATE vehicles SET owner_id = $1 WHERE UPPER(REPLACE(lorry_number, ' ', ' ')) = $2 RETURNING id, lorry_number",
    [ownerId, norm]
  );
  if (r.rows.length > 0) {
    console.log(`Linked: ${item.lorry} => ${item.owner} (vehicle id ${r.rows[0].id})`);
  } else {
    // Try without spaces
    const normNoSpace = item.lorry.replace(/\s+/g, '').toUpperCase();
    const r2 = await pool.query(
      "UPDATE vehicles SET owner_id = $1 WHERE UPPER(REPLACE(REPLACE(lorry_number,' ',''),'-','')) = $2 RETURNING id, lorry_number",
      [ownerId, normNoSpace]
    );
    if (r2.rows.length > 0) {
      console.log(`Linked (no-space): ${item.lorry} => ${item.owner} (vehicle id ${r2.rows[0].id})`);
    } else {
      console.warn(`NOT FOUND in DB: ${item.lorry}`);
    }
  }
}

// Show final result
const final = await pool.query("SELECT v.lorry_number, o.name as owner_name FROM vehicles v LEFT JOIN owners o ON v.owner_id = o.id WHERE v.owner_id IS NOT NULL ORDER BY o.name, v.lorry_number");
console.log('\nLinked vehicles:');
final.rows.forEach(r => console.log(`  ${r.lorry_number} => ${r.owner_name}`));

await pool.end();
console.log('\nDone!');
