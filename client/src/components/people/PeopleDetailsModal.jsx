import React from 'react';
import { GENDER_OPTIONS, HEARD_ABOUT_OPTIONS, MAIN_REASON_OPTIONS } from '../../constants/options.js';

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
              <div className="detail-item"><span>Name</span><strong>{person.first_name} {person.last_name}</strong></div>
              <div className="detail-item"><span>Age</span><strong>{person.age || '--'}</strong></div>
              <div className="detail-item"><span>Sex</span><strong>{person.gender || '--'}</strong></div>
              <div className="detail-item"><span>Phone No.</span><strong>{person.phone || '--'}</strong></div>
              <div className="detail-item"><span>Occupation</span><strong>{person.occupation || '--'}</strong></div>
              <div className="detail-item"><span>How did you hear?</span><strong>{person.registration_source || '--'}</strong></div>
              <div className="detail-item"><span>Main Reason</span><strong>{person.reason_for_coming || '--'}</strong></div>
              <div className="detail-item"><span>House No./Address</span><strong>{person.address_line1 || '--'}</strong></div>
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
                Name
                <input
                  required
                  value={form.fullName}
                  onChange={(event) => onFormChange('fullName', event.target.value)}
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
                <select
                  value={form.gender}
                  onChange={(event) => onFormChange('gender', event.target.value)}
                >
                  <option value="">--</option>
                  {GENDER_OPTIONS.map((gender) => (
                    <option key={gender} value={gender}>{gender}</option>
                  ))}
                </select>
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
                <input
                  value={form.occupation}
                  onChange={(event) => onFormChange('occupation', event.target.value)}
                />
              </label>
              <label className="full-span">
                How did you hear about MEDICAID?
                <select
                  value={form.registrationSource}
                  onChange={(event) => onFormChange('registrationSource', event.target.value)}
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
                  onChange={(event) => onFormChange('reasonForComing', event.target.value)}
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
                  onChange={(event) => onFormChange('addressLine1', event.target.value)}
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
                <select
                  value={form.programYear}
                  onChange={(event) => onFormChange('programYear', Number(event.target.value))}
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
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
