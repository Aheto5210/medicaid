import React, { useMemo, useState } from 'react';
import { NHIS_SITUATION_CASE_OPTIONS } from '../../constants/options.js';
import { createNhisMutation } from '../../utils/offlineData.js';
import { buildFullName } from '../../utils/people.js';
import usePersistedDraft from '../../hooks/usePersistedDraft.js';
import CustomDropdown from '../common/CustomDropdown.jsx';

const NHIS_DRAFT_KEY = 'draft:nhis-registration:create';

function buildInitialForm(programYear) {
  return {
    surname: '',
    otherNames: '',
    situationCase: '',
    amount: '',
    programYear
  };
}

export default function NhisRegisterModal({ programYear, onClose, onSaved }) {
  const initialForm = useMemo(() => buildInitialForm(programYear), [programYear]);
  const {
    value: form,
    setValue: setForm,
    restored: draftRestored,
    clearDraft
  } = usePersistedDraft({
    cacheKey: NHIS_DRAFT_KEY,
    initialValue: initialForm,
    restoreValue: (cachedValue, fallbackValue) => ({
      ...fallbackValue,
      ...cachedValue,
      programYear: fallbackValue.programYear
    })
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
      await clearDraft();
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
          {draftRestored && (
            <div className="notice">
              Draft restored. Unsaved entries on this device will keep auto-saving until you submit.
            </div>
          )}

          <div className="field-grid">
            <label>
              Surname
              <input
                required
                value={form.surname}
                onChange={(event) => setForm((prev) => ({ ...prev, surname: event.target.value }))}
                placeholder="Surname"
              />
            </label>
            <label>
              Other names
              <input
                required
                value={form.otherNames}
                onChange={(event) => setForm((prev) => ({ ...prev, otherNames: event.target.value }))}
                placeholder="Other names"
              />
            </label>
            <label>
              Situation/Case
              <CustomDropdown
                options={NHIS_SITUATION_CASE_OPTIONS}
                value={form.situationCase}
                onChange={(nextValue) => setForm((prev) => ({ ...prev, situationCase: nextValue }))}
                placeholder="Select situation/case"
              />
            </label>
            <label>
              Amount (GHS)
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
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
