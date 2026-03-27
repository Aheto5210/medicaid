const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function getStoredTokens() {
  return {
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken')
  };
}

export function setTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}

export function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

async function tryRefresh() {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/api/auth/refresh`, {
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
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (res.status !== 401) return res;

  const newAccessToken = await tryRefresh();
  if (!newAccessToken) return res;

  const retryHeaders = {
    ...headers,
    Authorization: `Bearer ${newAccessToken}`
  };

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: retryHeaders
  });
}
