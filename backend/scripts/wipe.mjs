import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase')
    ? { rejectUnauthorized: false }
    : undefined,
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const del = await client.query('DELETE FROM transactions');
    await client.query('UPDATE envelopes SET balance = 0');
    await client.query('COMMIT');
    console.log(`Wiped ${del.rowCount} transactions; all envelope balances set to 0`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Wipe failed:', err.message);
  process.exit(1);
});
