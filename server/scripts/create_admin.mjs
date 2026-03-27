import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString });

const email = 'admin@gmail.com';
const password = 'admin';
const fullName = 'Admin User';

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
