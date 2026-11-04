import { query } from './src/config/database';

const owners = [
  'K.S. PALANISAMY',
  'P. SELVI',
  'K.P. DEEPA',
  'P. LINGAMOORTHY',
  'A. CHANDRASEKAR',
  'C. THILAGAVATHY',
  'K.L. BHARATHI'
];

const vehicleOwnerMap: { lorry: string; ownerName: string }[] = [
  // C. THILAGAVATHY
  { lorry: 'TN 52 5034', ownerName: 'C. THILAGAVATHY' },
  { lorry: 'TN 33 AL 5959', ownerName: 'C. THILAGAVATHY' },
  { lorry: 'TN 33 AK 9988', ownerName: 'C. THILAGAVATHY' },

  // A. CHANDRASEKAR
  { lorry: 'TN 28 AA 5569', ownerName: 'A. CHANDRASEKAR' },
  { lorry: 'TN 52 A 1846', ownerName: 'A. CHANDRASEKAR' },

  // K.L. BHARATHI
  { lorry: 'TN 52 D 3441', ownerName: 'K.L. BHARATHI' },

  // K.S. PALANISAMY
  { lorry: 'TN 33 AE 8004', ownerName: 'K.S. PALANISAMY' },
  { lorry: 'TN 33 BK 0342', ownerName: 'K.S. PALANISAMY' },
  { lorry: 'TN 33 BM 0919', ownerName: 'K.S. PALANISAMY' },
  { lorry: 'TN 33 AL 4720', ownerName: 'K.S. PALANISAMY' },

  // P. SELVI
  { lorry: 'TN 33 AE 1357', ownerName: 'P. SELVI' },
  { lorry: 'TN 34 K 8775', ownerName: 'P. SELVI' },
  { lorry: 'TN 33 AL 9595', ownerName: 'P. SELVI' },
  { lorry: 'TN 33 U 5619', ownerName: 'P. SELVI' },

  // K.P. DEEPA
  { lorry: 'TN 33 AM 6996', ownerName: 'K.P. DEEPA' },
  { lorry: 'TN 33 AD 9425', ownerName: 'K.P. DEEPA' },

  // P. LINGAMOORTHY
  { lorry: 'TN 33 AW 7171', ownerName: 'P. LINGAMOORTHY' },
  { lorry: 'TN 33 AQ 8851', ownerName: 'P. LINGAMOORTHY' },
  { lorry: 'TN 33 AF 7778', ownerName: 'P. LINGAMOORTHY' },
  { lorry: 'TN 33 AJ 5841', ownerName: 'P. LINGAMOORTHY' },
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

  console.log('Mapping vehicles to owners...');
  for (const item of vehicleOwnerMap) {
    await query(`
      UPDATE vehicles v
      SET owner_id = o.id
      FROM owners o
      WHERE v.lorry_number = $1 AND UPPER(o.name) = UPPER($2)
    `, [item.lorry, item.ownerName]);
  }

  const all = await query(`
    SELECT o.name as owner_name, v.lorry_number
    FROM vehicles v
    JOIN owners o ON v.owner_id = o.id
    ORDER BY o.name, v.lorry_number
  `);
  console.log('\n--- ALL VEHICLE OWNER ASSIGNMENTS ---');
  console.table(all.rows);
  process.exit(0);
}

setupOwners().catch(err => {
  console.error('Error creating owners table:', err);
  process.exit(1);
});
