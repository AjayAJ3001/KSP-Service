import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const DEFAULT_PASSWORD = 'Owner@123';

const ACCOUNTS = [
  {
    username: 'chandrasekar',
    name: 'A. Chandrasekar / C. Thilagavathy',
    ownerNames: ['A. CHANDRASEKAR', 'C. THILAGAVATHY'],
  },
  {
    username: 'deepa',
    name: 'K.P. Deepa',
    ownerNames: ['K.P. DEEPA'],
  },
  {
    username: 'bharathi',
    name: 'K.L. Bharathi',
    ownerNames: ['K.L. BHARATHI'],
  },
  {
    username: 'palanisamy',
    name: 'K.S. Palanisamy / Lingamoorthy / Selvi',
    ownerNames: ['K.S. PALANISAMY', 'P. LINGAMOORTHY', 'P. SELVI'],
  },
];

async function main() {
  const sqlPath = path.join(__dirname, '..', 'database', 'owner_user_access.sql');
  const ddl = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(ddl);

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const owners = await pool.query('SELECT id, name FROM owners');
  const byName = new Map(owners.rows.map((o) => [String(o.name).trim().toUpperCase(), o.id]));

  for (const acc of ACCOUNTS) {
    const ownerIds = acc.ownerNames.map((n) => {
      const id = byName.get(n.toUpperCase());
      if (!id) throw new Error(`Owner not found: ${n}`);
      return id;
    });

    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [acc.username]);
    let userId;
    if (existing.rows.length) {
      userId = existing.rows[0].id;
      await pool.query(
        `UPDATE users SET name = $1, role = 'OWNER', status = 'ACTIVE', password_hash = $2, updated_at = NOW()
         WHERE id = $3`,
        [acc.name, hash, userId]
      );
    } else {
      const ins = await pool.query(
        `INSERT INTO users (username, name, password_hash, role, status)
         VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')
         RETURNING id`,
        [acc.username, acc.name, hash]
      );
      userId = ins.rows[0].id;
    }

    await pool.query('DELETE FROM user_owners WHERE user_id = $1', [userId]);
    for (const oid of ownerIds) {
      await pool.query(
        'INSERT INTO user_owners (user_id, owner_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, oid]
      );
    }

    const trucks = await pool.query(
      `SELECT lorry_number FROM vehicles WHERE owner_id = ANY($1::int[]) ORDER BY lorry_number`,
      [ownerIds]
    );
    console.log(
      `${acc.username} -> owners ${ownerIds.join(',')} trucks: ${trucks.rows.map((t) => t.lorry_number).join(', ')}`
    );
  }

  console.log(`Password for all owner logins: ${DEFAULT_PASSWORD}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
