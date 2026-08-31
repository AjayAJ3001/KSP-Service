import { query } from './src/config/database';

const owners = [
  'K.S. PALANISAMY',
  'P. SELVI',
  'K.P. DEEPA',
  'P. LINGAMOORTHY',
  'A. CHANDRASEKARAN',
  'C. THILAGAVATHY',
  'K.L. BHARATHI'
];

async function setupOwners() {
  console.log('Creating owners table if not exists...');
  await query(`
    CREATE TABLE IF NOT EXISTS owners (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      mobile_number VARCHAR(50),
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log('Inserting owners...');
  for (const name of owners) {
    const formattedName = name.trim();
    const check = await query('SELECT id, name FROM owners WHERE UPPER(name) = $1', [formattedName.toUpperCase()]);
    if (check.rows.length === 0) {
      const res = await query(
        `INSERT INTO owners (name, status) VALUES ($1, 'ACTIVE') RETURNING id, name`,
        [formattedName]
      );
      console.log(`Inserted Owner: #${res.rows[0].id} - ${res.rows[0].name}`);
    } else {
      console.log(`Already exists: #${check.rows[0].id} - ${check.rows[0].name}`);
    }
  }

  const all = await query('SELECT id, name, status, created_at FROM owners ORDER BY id ASC');
  console.log('\n--- ALL OWNERS IN DATABASE ---');
  console.table(all.rows);
  process.exit(0);
}

setupOwners().catch(err => {
  console.error('Error creating owners table:', err);
  process.exit(1);
});
