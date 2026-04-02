import React, { useMemo, useState } from 'react';
import {
  GENDER_OPTIONS,
  HEARD_ABOUT_OPTIONS,
  LOCATION_SUGGESTIONS,
  MAIN_REASON_OPTIONS,
  OCCUPATION_SUGGESTIONS
} from '../../constants/options.js';
import { createPersonMutation } from '../../utils/offlineData.js';
import usePersistedDraft from '../../hooks/usePersistedDraft.js';
import CustomDropdown from '../common/CustomDropdown.jsx';

const PEOPLE_DRAFT_KEY = 'draft:general-registration:create';

function buildInitialForm(programYear) {
  return {
    surname: '',
    otherNames: '',
    age: '',
    gender: '',
    phone: '',
    occupation: '',
    registrationSource: '',
    reasonForComing: '',
    addressLine1: '',
    email: '',
    programYear,
    onboardingStatus: 'registered'
  };
}

export default function RegisterModal({ programYear, onClose, onSaved }) {
  const initialForm = useMemo(() => buildInitialForm(programYear), [programYear]);
  const {
    value: form,
    setValue: setForm,
    clearDraft
  } = usePersistedDraft({
    cacheKey: PEOPLE_DRAFT_KEY,
    initialValue: initialForm,
    restoreValue: (cachedValue, fallbackValue) => ({
      ...fallbackValue,
      ...cachedValue,
      programYear: fallbackValue.programYear,
      onboardingStatus: fallbackValue.onboardingStatus
    })
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
              Age
              <input
                type="number"
                min="0"
                value={form.age}
                onChange={(event) => setForm((prev) => ({ ...prev, age: event.target.value }))}
              />
            </label>
            <label>
              Sex
              <CustomDropdown
                options={GENDER_OPTIONS}
                value={form.gender}
                onChange={(nextValue) => setForm((prev) => ({ ...prev, gender: nextValue }))}
              />
            </label>
            <label>
              Phone No.
              <input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </label>
            <label>
              Occupation
              <CustomDropdown
                options={OCCUPATION_SUGGESTIONS}
                value={form.occupation}
                onChange={(nextValue) => setForm((prev) => ({ ...prev, occupation: nextValue }))}
                placeholder="Type or choose occupation"
                allowCustom
              />
            </label>
            <label className="full-span">
              How did you hear about MEDICAID?
              <CustomDropdown
                options={HEARD_ABOUT_OPTIONS}
                value={form.registrationSource}
                onChange={(nextValue) => setForm((prev) => ({ ...prev, registrationSource: nextValue }))}
                placeholder="Select option"
              />
            </label>
            <label className="full-span">
              Main Reason for Coming
              <CustomDropdown
                options={MAIN_REASON_OPTIONS}
                value={form.reasonForComing}
                onChange={(nextValue) => setForm((prev) => ({ ...prev, reasonForComing: nextValue }))}
                placeholder="Select option"
              />
            </label>
            <label>
              Location
              <CustomDropdown
                options={LOCATION_SUGGESTIONS}
                value={form.addressLine1}
                onChange={(nextValue) => setForm((prev) => ({ ...prev, addressLine1: nextValue }))}
                placeholder="Type or choose town / community"
                allowCustom
              />
            </label>
            <label>
              E-mail Address (if available)
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
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
