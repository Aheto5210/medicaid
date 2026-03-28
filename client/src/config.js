const LOCAL_API_URL = 'http://localhost:4000';
const LOCAL_API_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isLocalApiUrl(value) {
  if (!value) return false;

  try {
    const { hostname } = new URL(value);
    return LOCAL_API_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

function resolveApiUrl() {
  const configuredUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL);
  const allowLocalApi = String(import.meta.env.VITE_ALLOW_LOCAL_API || '').toLowerCase() === 'true';

  if (import.meta.env.PROD && !configuredUrl) {
    throw new Error('Missing VITE_API_URL for a production client build.');
  }

  if (import.meta.env.PROD && !allowLocalApi && isLocalApiUrl(configuredUrl)) {
    throw new Error('VITE_API_URL must point to the hosted API for production and desktop builds.');
  }

  return configuredUrl || LOCAL_API_URL;
}

export const API_URL = resolveApiUrl();

export function buildApiUrl(path = '') {
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${API_URL}${normalizedPath}`;
}
