import React, { useState } from 'react';
import { apiFetch } from '../../api.js';
import { NHIS_SITUATION_CASE_OPTIONS } from '../../constants/options.js';

export default function NhisRegisterModal({ programYear, onClose, onSaved }) {
  const [form, setForm] = useState({
    fullName: '',
    situationCase: '',
    amount: '',
    programYear
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      fullName: form.fullName.trim(),
      situationCase: form.situationCase.trim() || null,
      amount: form.amount,
      programYear: form.programYear
    };

    const res = await apiFetch('/api/nhis', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      await onSaved();
      return;
    }

    const data = await res.json().catch(() => ({}));
    setError(data.message || 'Failed to save');
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>New NHIS Registration</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <div className="field-grid">
            <label>
              Name
              <input
                required
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                placeholder="Full name"
              />
            </label>
            <label>
              Situation/Case
              <select
                value={form.situationCase}
                onChange={(event) => setForm({ ...form, situationCase: event.target.value })}
              >
                <option value="">Select situation/case</option>
                {NHIS_SITUATION_CASE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              Amount (GHS)
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
            </label>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="modal-actions">
            <button className="ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
