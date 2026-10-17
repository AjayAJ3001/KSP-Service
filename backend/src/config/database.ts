import { Pool, types } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Ensure PostgreSQL DATE (OID 1082) returns as exact 'YYYY-MM-DD' string without timezone shifts
types.setTypeParser(1082, (val: string) => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log('executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
  }
  return res;
};

export const getClient = () => pool.connect();

export default pool;
