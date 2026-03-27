import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const databaseSsl = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.DATABASE_SSL || '').trim().toLowerCase()
);
const databaseSslRejectUnauthorized = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || '').trim().toLowerCase()
);

if (!connectionString) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: databaseSsl ? { rejectUnauthorized: databaseSslRejectUnauthorized } : undefined
});

const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
const email = process.env.ADMIN_EMAIL || 'admin@gmail.com';
const password = process.env.ADMIN_PASSWORD || (nodeEnv === 'production' ? '' : 'admin');
const fullName = process.env.ADMIN_FULL_NAME || 'Admin User';

if (!password) {
  console.error('Missing ADMIN_PASSWORD');
  process.exit(1);
}

async function run() {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    console.log('Admin already exists:', email);
    await pool.end();
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
    [fullName, email, hash, 'admin']
  );
  console.log('Admin created:', email);
  await pool.end();
}

run().catch(async (err) => {
  console.error('Failed to create admin:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
