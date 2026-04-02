import { cleanedText } from './text.js';

export function normalizeClientRequestId(value) {
  return cleanedText(value);
}

export function normalizeExpectedUpdatedAt(value) {
  const raw = cleanedText(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function buildStaleRecordMessage(label = 'record') {
  return `This ${label} was updated by someone else. Refresh and review the latest information before saving again.`;
}

export async function acquireTransactionLock(client, key) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [String(key)]);
}

export async function getIdempotentResponse(client, scope, clientRequestId) {
  if (!clientRequestId) return null;

  const result = await client.query(
    `SELECT response_status, response_body
     FROM request_idempotency
     WHERE scope = $1 AND client_request_id = $2
     LIMIT 1`,
    [scope, clientRequestId]
  );

  if (!result.rows.length) {
    return null;
  }

  return {
    status: Number(result.rows[0].response_status),
    body: result.rows[0].response_body
  };
}

export async function storeIdempotentResponse(client, scope, clientRequestId, status, body) {
  if (!clientRequestId) return;

  await client.query(
    `INSERT INTO request_idempotency (
      scope, client_request_id, response_status, response_body
    )
    VALUES ($1, $2, $3, $4::jsonb)
    ON CONFLICT (scope, client_request_id) DO NOTHING`,
    [scope, clientRequestId, Number(status), JSON.stringify(body ?? {})]
  );
}
