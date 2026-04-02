import React, { useState } from 'react';
import { NHIS_SITUATION_CASE_OPTIONS } from '../../constants/options.js';
import { createNhisMutation } from '../../utils/offlineData.js';
import { buildFullName } from '../../utils/people.js';

export default function NhisRegisterModal({ programYear, onClose, onSaved }) {
  const [form, setForm] = useState({
    surname: '',
    otherNames: '',
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
      fullName: buildFullName(form.otherNames, form.surname),
      situationCase: form.situationCase.trim() || null,
      amount: form.amount,
      programYear: form.programYear
    };

    const result = await createNhisMutation(payload);

    if (result.ok) {
      await onSaved();
      return;
    }

    const data = await result.response?.json().catch(() => ({}));
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
              Surname
              <input
                required
                value={form.surname}
                onChange={(event) => setForm({ ...form, surname: event.target.value })}
                placeholder="Surname"
              />
            </label>
            <label>
              Other names
              <input
                required
                value={form.otherNames}
                onChange={(event) => setForm({ ...form, otherNames: event.target.value })}
                placeholder="Other names"
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
