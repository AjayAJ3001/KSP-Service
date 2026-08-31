import { query } from './src/config/database';

const vehicles = [
  { lorry_number: 'TN 33 U 5619', expense: 500 },
  { lorry_number: 'TN 28 AA 5569', expense: 500 },
  { lorry_number: 'TN 33 AE 8004', expense: 1000 },
  { lorry_number: 'TN 33 AE 1357', expense: 1000 },
  { lorry_number: 'TN 34 K 8775', expense: 1000 },
  { lorry_number: 'TN 52 5034', expense: 1000 },
  { lorry_number: 'TN 33 AL 9595', expense: 1000 },
  { lorry_number: 'TN 33 AL 5959', expense: 1000 },
  { lorry_number: 'TN 33 AQ 8851', expense: 1000 },
  { lorry_number: 'TN 33 AD 9425', expense: 1000 },
  { lorry_number: 'TN 52 A 1846', expense: 1000 },
  { lorry_number: 'TN 33 AM 6996', expense: 1000 },
  { lorry_number: 'TN 33 AF 7778', expense: 1000 },
  { lorry_number: 'TN 33 AJ 5841', expense: 1000 },
  { lorry_number: 'TN 33 AL 4720', expense: 1000 },
  { lorry_number: 'TN 33 AK 9988', expense: 1000 },
  { lorry_number: 'TN 33 BK 0342', expense: 1280 },
  { lorry_number: 'TN 33 BM 0919', expense: 1280 },
  { lorry_number: 'TN 33 AW 7171', expense: 1280 },
  { lorry_number: 'TN 52 D 3441', expense: 1280 },
];

async function seedVehicles() {
  console.log('Ensuring column exists in vehicles table...');
  await query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS goodshed_loading_expense NUMERIC(10, 2) DEFAULT 0;`);

  console.log('Inserting / Updating vehicles and loading expenses...');
  for (const v of vehicles) {
    const formattedLorry = v.lorry_number.toUpperCase().trim();
    // Normalize spaces in lookup
    const check = await query(
      `SELECT id, lorry_number FROM vehicles WHERE REPLACE(UPPER(lorry_number), ' ', '') = REPLACE($1, ' ', '')`,
      [formattedLorry]
    );

    if (check.rows.length === 0) {
      const res = await query(
        `INSERT INTO vehicles (lorry_number, goodshed_loading_expense, status) VALUES ($1, $2, 'ACTIVE') RETURNING id, lorry_number, goodshed_loading_expense`,
        [formattedLorry, v.expense]
      );
      console.log(`Inserted: ${res.rows[0].id} - ${res.rows[0].lorry_number} (Loading Exp: ₹${res.rows[0].goodshed_loading_expense})`);
    } else {
      const existingId = check.rows[0].id;
      const res = await query(
        `UPDATE vehicles SET lorry_number = $1, goodshed_loading_expense = $2, status = 'ACTIVE', updated_at = NOW() WHERE id = $3 RETURNING id, lorry_number, goodshed_loading_expense`,
        [formattedLorry, v.expense, existingId]
      );
      console.log(`Updated: ${res.rows[0].id} - ${res.rows[0].lorry_number} (Loading Exp: ₹${res.rows[0].goodshed_loading_expense})`);
    }
  }

  const all = await query('SELECT id, lorry_number, goodshed_loading_expense, status FROM vehicles ORDER BY id ASC');
  console.log('\n--- ALL VEHICLES IN DATABASE ---');
  console.table(all.rows);
  process.exit(0);
}

seedVehicles().catch((err) => {
  console.error('Error seeding vehicles:', err);
  process.exit(1);
});
