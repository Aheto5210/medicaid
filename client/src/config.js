const LOCAL_API_URL = 'http://localhost:4000';

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function resolveApiUrl() {
  const configuredUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL);
  if (import.meta.env.PROD && !configuredUrl) {
    throw new Error('Missing VITE_API_URL for a production client build.');
  }
  return configuredUrl || LOCAL_API_URL;
}

export const API_URL = resolveApiUrl();

export function buildApiUrl(path = '') {
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${API_URL}${normalizedPath}`;
}
