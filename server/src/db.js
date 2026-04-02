import pg from 'pg';
import config from './config.js';

const { Pool } = pg;
const RUNTIME_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS request_idempotency (
  scope text NOT NULL,
  client_request_id text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, client_request_id)
)
`;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl
    ? { rejectUnauthorized: config.databaseSslRejectUnauthorized }
    : undefined
});

export const query = (text, params) => pool.query(text, params);

let runtimeSchemaPromise = null;

export function ensureRuntimeSchema() {
  if (!runtimeSchemaPromise) {
    runtimeSchemaPromise = pool.query(RUNTIME_SCHEMA_SQL);
  }
  return runtimeSchemaPromise;
}

export async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failures and surface the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}
