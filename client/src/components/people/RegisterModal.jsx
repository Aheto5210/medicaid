import React, { useState } from 'react';
import { GENDER_OPTIONS, HEARD_ABOUT_OPTIONS, MAIN_REASON_OPTIONS, OCCUPATION_SUGGESTIONS } from '../../constants/options.js';
import { createPersonMutation } from '../../utils/offlineData.js';

export default function RegisterModal({ programYear, onClose, onSaved }) {
  const [form, setForm] = useState({
    surname: '',
    otherNames: '',
    age: '',
    gender: 'Female',
    phone: '',
    occupation: '',
    registrationSource: '',
    reasonForComing: '',
    addressLine1: '',
    email: '',
    programYear,
    onboardingStatus: 'registered'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      firstName: form.otherNames,
      lastName: form.surname,
      otherNames: form.otherNames,
      age: form.age ? Number(form.age) : null,
      gender: form.gender,
      phone: form.phone,
      email: form.email,
      occupation: form.occupation,
      registrationSource: form.registrationSource,
      reasonForComing: form.reasonForComing,
      addressLine1: form.addressLine1,
      programYear: form.programYear,
      onboardingStatus: form.onboardingStatus
    };

    const result = await createPersonMutation(payload);

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
          <h2>Register New Person</h2>
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
              Age
              <input
                type="number"
                min="0"
                value={form.age}
                onChange={(event) => setForm({ ...form, age: event.target.value })}
              />
            </label>
            <label>
              Sex
              <select
                value={form.gender}
                onChange={(event) => setForm({ ...form, gender: event.target.value })}
              >
                {GENDER_OPTIONS.map((gender) => (
                  <option key={gender} value={gender}>{gender}</option>
                ))}
              </select>
            </label>
            <label>
              Phone No.
              <input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </label>
            <label>
              Occupation
              <input
                list="occupation-suggestions"
                value={form.occupation}
                onChange={(event) => setForm({ ...form, occupation: event.target.value })}
                placeholder="Type or choose occupation"
              />
              <datalist id="occupation-suggestions">
                {OCCUPATION_SUGGESTIONS.map((occupation) => (
                  <option key={occupation} value={occupation} />
                ))}
              </datalist>
            </label>
            <label className="full-span">
              How did you hear about MEDICAID?
              <select
                value={form.registrationSource}
                onChange={(event) => setForm({ ...form, registrationSource: event.target.value })}
              >
                <option value="">Select option</option>
                {HEARD_ABOUT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="full-span">
              Main Reason for Coming
              <select
                value={form.reasonForComing}
                onChange={(event) => setForm({ ...form, reasonForComing: event.target.value })}
              >
                <option value="">Select option</option>
                {MAIN_REASON_OPTIONS.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </label>
            <label>
              House No./Address
              <input
                value={form.addressLine1}
                onChange={(event) => setForm({ ...form, addressLine1: event.target.value })}
              />
            </label>
            <label>
              E-mail Address (if available)
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
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
