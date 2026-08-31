import { query } from './src/config/database';

const parties = [
  'KRISHI NUTRITION COMPANY',
  'KUPPANNA POULTRY FARM',
  'SWAMI FEEDS',
  'VENKATESHWARA HATCHERIES',
  'SENTHIL ANDAVAR FEEDS'
];

async function seedParties() {
  console.log('Inserting party names...');
  for (const name of parties) {
    const formattedName = name.trim().toUpperCase();
    const check = await query(
      `SELECT id, name FROM parties WHERE UPPER(name) = $1`,
      [formattedName]
    );

    if (check.rows.length === 0) {
      const res = await query(
        `INSERT INTO parties (name, status) VALUES ($1, 'ACTIVE') RETURNING id, name, status`,
        [name]
      );
      console.log(`Inserted: ${res.rows[0].id} - ${res.rows[0].name}`);
    } else {
      console.log(`Already exists: ${check.rows[0].id} - ${check.rows[0].name}`);
    }
  }

  const all = await query('SELECT id, name, status FROM parties ORDER BY id ASC');
  console.log('\n--- ALL PARTIES IN DATABASE ---');
  console.table(all.rows);
  process.exit(0);
}

seedParties().catch(err => {
  console.error('Error inserting parties:', err);
  process.exit(1);
});
