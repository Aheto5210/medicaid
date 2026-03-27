import { buildApiUrl } from './config.js';

function getStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function getStoredTokens() {
  const storage = getStorage();
  return {
    accessToken: storage?.getItem('accessToken') || null,
    refreshToken: storage?.getItem('refreshToken') || null
  };
}

export function setTokens(accessToken, refreshToken) {
  const storage = getStorage();
  if (!storage) return;
  if (accessToken) storage.setItem('accessToken', accessToken);
  if (refreshToken) storage.setItem('refreshToken', refreshToken);
}

export function clearTokens() {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem('accessToken');
  storage.removeItem('refreshToken');
}

function buildHeaders(options = {}, accessToken) {
  const headers = { ...(options.headers || {}) };
  const hasFormDataBody = options.body instanceof FormData;
  const hasContentType = Object.keys(headers).some(
    (key) => key.toLowerCase() === 'content-type'
  );

  if (!hasFormDataBody && options.body !== undefined && !hasContentType) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function tryRefresh() {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) return null;

  const res = await fetch(buildApiUrl('/api/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  if (!res.ok) return null;
  const data = await res.json();
  setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

export async function apiFetch(path, options = {}) {
  const { accessToken } = getStoredTokens();
  const headers = buildHeaders(options, accessToken);

  const res = await fetch(buildApiUrl(path), {
    ...options,
    headers
  });

  if (res.status !== 401) return res;

  const newAccessToken = await tryRefresh();
  if (!newAccessToken) return res;

  const retryHeaders = {
    ...buildHeaders(options, newAccessToken),
    Authorization: `Bearer ${newAccessToken}`
  };

  return fetch(buildApiUrl(path), {
    ...options,
    headers: retryHeaders
  });
}

export function apiUpload(path, formData, options = {}) {
  return apiFetch(path, {
    ...options,
    method: options.method || 'POST',
    body: formData
  });
}
