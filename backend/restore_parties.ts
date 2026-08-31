import { query } from './src/config/database';

async function restoreParties() {
  const partiesToRestore = [
    { id: 1, name: 'ABC Trading Co', contact_person: 'John Doe', mobile_number: '9876500001' },
    { id: 2, name: 'XYZ Industries', contact_person: 'Jane Smith', mobile_number: '9876500002' }
  ];

  for (const p of partiesToRestore) {
    const existing = await query('SELECT id FROM parties WHERE id = $1', [p.id]);
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO parties (id, name, contact_person, mobile_number, status) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
        [p.id, p.name, p.contact_person, p.mobile_number]
      );
      console.log(`Restored: #${p.id} - ${p.name}`);
    } else {
      await query(
        `UPDATE parties SET name = $2, contact_person = $3, mobile_number = $4, status = 'ACTIVE' WHERE id = $1`,
        [p.id, p.name, p.contact_person, p.mobile_number]
      );
      console.log(`Updated: #${p.id} - ${p.name}`);
    }
  }

  // Adjust sequence
  await query(`SELECT setval('parties_id_seq', (SELECT MAX(id) FROM parties));`);

  const all = await query('SELECT id, name, contact_person, mobile_number, status FROM parties ORDER BY id ASC');
  console.log('\n--- ALL CURRENT PARTIES IN DATABASE ---');
  console.table(all.rows);
  process.exit(0);
}

restoreParties().catch(err => {
  console.error('Error restoring parties:', err);
  process.exit(1);
});
