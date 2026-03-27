import React, { useState } from 'react';
import BrandLogo from '../components/common/BrandLogo.jsx';
import { apiFetch } from '../api.js';

export default function AuthPage({
  onSuccess,
  theme = 'light'
}) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = '/api/auth/login';
    const payload = { email: form.email, password: form.password };

    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'Authentication failed');
        return;
      }

      const data = await res.json();
      onSuccess(data);
    } catch (err) {
      setError('Network error. Check that the backend is running and VITE_API_URL is correct.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand centered">
          <BrandLogo theme={theme} className="brand-logo auth-logo" />
        </div>

        <form onSubmit={handleSubmit} className="form">
          <label>
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
