import React from 'react';
import {
  GENDER_OPTIONS,
  HEARD_ABOUT_OPTIONS,
  LOCATION_SUGGESTIONS,
  MAIN_REASON_OPTIONS,
  OCCUPATION_SUGGESTIONS
} from '../../constants/options.js';
import { buildPersonDisplayName } from '../../utils/people.js';
import CustomDropdown from '../common/CustomDropdown.jsx';

export default function PeopleDetailsModal({
  person,
  loading,
  error,
  editing,
  form,
  yearOptions,
  onFormChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onClose,
  saving,
  deleting,
  canEdit = true,
  canDelete = true
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal details-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Person Details</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>

        {loading && <div className="empty">Loading details...</div>}
        {!loading && error && <div className="error">{error}</div>}

        {!loading && !error && person && !editing && (
          <>
            <div className="details-grid">
              <div className="detail-item"><span>Name</span><strong>{buildPersonDisplayName(person) || '--'}</strong></div>
              <div className="detail-item"><span>Age</span><strong>{person.age || '--'}</strong></div>
              <div className="detail-item"><span>Sex</span><strong>{person.gender || '--'}</strong></div>
              <div className="detail-item"><span>Phone No.</span><strong>{person.phone || '--'}</strong></div>
              <div className="detail-item"><span>Occupation</span><strong>{person.occupation || '--'}</strong></div>
              <div className="detail-item"><span>How did you hear?</span><strong>{person.registration_source || '--'}</strong></div>
              <div className="detail-item"><span>Main Reason</span><strong>{person.reason_for_coming || '--'}</strong></div>
              <div className="detail-item"><span>Location</span><strong>{person.address_line1 || '--'}</strong></div>
              <div className="detail-item"><span>E-mail</span><strong>{person.email || '--'}</strong></div>
              <div className="detail-item"><span>Program Year</span><strong>{person.program_year || '--'}</strong></div>
              <div className="detail-item"><span>Registered On</span><strong>{person.registration_date || '--'}</strong></div>
            </div>
            <div className="modal-actions">
              {canDelete && (
                <button className="danger" onClick={onDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
              {canEdit && <button className="primary" onClick={onStartEdit}>Edit</button>}
            </div>
          </>
        )}

        {!loading && !error && person && editing && canEdit && (
          <form onSubmit={onSave} className="form">
            <div className="field-grid">
              <label>
                Surname
                <input
                  required
                  value={form.surname}
                  onChange={(event) => onFormChange('surname', event.target.value)}
                />
              </label>
              <label>
                Other names
                <input
                  required
                  value={form.otherNames}
                  onChange={(event) => onFormChange('otherNames', event.target.value)}
                />
              </label>
              <label>
                Age
                <input
                  type="number"
                  min="0"
                  value={form.age}
                  onChange={(event) => onFormChange('age', event.target.value)}
                />
              </label>
              <label>
                Sex
                <CustomDropdown
                  options={[{ label: '--', value: '' }, ...GENDER_OPTIONS]}
                  value={form.gender}
                  onChange={(nextValue) => onFormChange('gender', nextValue)}
                />
              </label>
              <label>
                Phone No.
                <input
                  value={form.phone}
                  onChange={(event) => onFormChange('phone', event.target.value)}
                />
              </label>
              <label>
                Occupation
                <CustomDropdown
                  options={OCCUPATION_SUGGESTIONS}
                  value={form.occupation}
                  onChange={(nextValue) => onFormChange('occupation', nextValue)}
                  placeholder="Type or choose occupation"
                  allowCustom
                />
              </label>
              <label className="full-span">
                How did you hear about MEDICAID?
                <CustomDropdown
                  options={HEARD_ABOUT_OPTIONS}
                  value={form.registrationSource}
                  onChange={(nextValue) => onFormChange('registrationSource', nextValue)}
                  placeholder="Select option"
                />
              </label>
              <label className="full-span">
                Main Reason for Coming
                <CustomDropdown
                  options={MAIN_REASON_OPTIONS}
                  value={form.reasonForComing}
                  onChange={(nextValue) => onFormChange('reasonForComing', nextValue)}
                  placeholder="Select option"
                />
              </label>
              <label>
                Location
                <CustomDropdown
                  options={LOCATION_SUGGESTIONS}
                  value={form.addressLine1}
                  onChange={(nextValue) => onFormChange('addressLine1', nextValue)}
                  placeholder="Type or choose town / community"
                  allowCustom
                />
              </label>
              <label>
                E-mail Address (if available)
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => onFormChange('email', event.target.value)}
                />
              </label>
              <label>
                Program Year
                <CustomDropdown
                  options={yearOptions.map((year) => ({ label: String(year), value: year }))}
                  value={form.programYear}
                  onChange={(nextValue) => onFormChange('programYear', Number(nextValue))}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost" type="button" onClick={onCancelEdit}>Cancel</button>
              <button className="primary" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
