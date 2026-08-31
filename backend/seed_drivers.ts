import { query } from './src/config/database';

const drivers = [
  'VENKATACHALAM',
  'SELVAM',
  'SIVAKUMAR',
  'SURESH',
  'SATHISH',
  'SASIKUMAR',
  'KAVIN',
  'PERIYASAMY',
  'SANTHOSH',
  'MUNUSAMY',
  'SENTHIL',
  'DURAI',
  'SASI',
  'SARVANAN',
  'SAKTHIVEL',
  'KESAVAN'
];

async function seedDrivers() {
  console.log('Inserting drivers...');
  for (const name of drivers) {
    const check = await query('SELECT id, name FROM drivers WHERE UPPER(name) = $1', [name.toUpperCase()]);
    if (check.rows.length === 0) {
      const res = await query(
        `INSERT INTO drivers (name, status) VALUES ($1, 'ACTIVE') RETURNING id, name`,
        [name]
      );
      console.log(`Inserted: ${res.rows[0].id} - ${res.rows[0].name}`);
    } else {
      console.log(`Already exists: ${check.rows[0].id} - ${check.rows[0].name}`);
    }
  }

  const allDrivers = await query('SELECT id, name, status FROM drivers ORDER BY name ASC');
  console.log('\n--- ALL CURRENT DRIVERS IN DATABASE ---');
  console.table(allDrivers.rows);
  process.exit(0);
}

seedDrivers().catch(err => {
  console.error('Error inserting drivers:', err);
  process.exit(1);
});
