import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

const sql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE people ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE people ADD COLUMN IF NOT EXISTS occupation text;
ALTER TABLE people ADD COLUMN IF NOT EXISTS reason_for_coming text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS nhis_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  situation_case text,
  amount numeric(12,2),
  program_year integer NOT NULL DEFAULT (EXTRACT(YEAR FROM current_date))::int,
  registration_date date NOT NULL DEFAULT current_date,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nhis_program_year_date ON nhis_registrations (program_year, registration_date);
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_nhis_registrations_updated_at ON nhis_registrations;
CREATE TRIGGER trg_nhis_registrations_updated_at
BEFORE UPDATE ON nhis_registrations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
`;

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is missing. Set it in server/.env.');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(sql);
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
