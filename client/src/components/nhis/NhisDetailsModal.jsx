import React from 'react';
import { NHIS_SITUATION_CASE_OPTIONS } from '../../constants/options.js';
import { buildNhisDisplayName } from '../../utils/people.js';
import CustomDropdown from '../common/CustomDropdown.jsx';

function formatCurrency(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '--';
  return new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatReadableDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export default function NhisDetailsModal({
  record,
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
  const situationCaseOptions = form?.situationCase && !NHIS_SITUATION_CASE_OPTIONS.includes(form.situationCase)
    ? [form.situationCase, ...NHIS_SITUATION_CASE_OPTIONS]
    : NHIS_SITUATION_CASE_OPTIONS;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal details-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>NHIS Record Details</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>

        {loading && <div className="empty">Loading details...</div>}
        {!loading && error && <div className="error">{error}</div>}

        {!loading && !error && record && !editing && (
          <>
            <div className="details-grid">
              <div className="detail-item"><span>Name</span><strong>{buildNhisDisplayName(record) || '--'}</strong></div>
              <div className="detail-item"><span>Situation/Case</span><strong>{record.situation_case || '--'}</strong></div>
              <div className="detail-item"><span>Amount (GHS)</span><strong>{formatCurrency(record.amount)}</strong></div>
              <div className="detail-item"><span>Program Year</span><strong>{record.program_year || '--'}</strong></div>
              <div className="detail-item"><span>Registered On</span><strong>{formatReadableDate(record.registration_date)}</strong></div>
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

        {!loading && !error && record && editing && canEdit && (
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
                Situation/Case
                <CustomDropdown
                  options={[{ label: 'Select situation/case', value: '' }, ...situationCaseOptions]}
                  value={form.situationCase}
                  onChange={(nextValue) => onFormChange('situationCase', nextValue)}
                  searchable
                  panelMinWidth={420}
                />
              </label>
              <label>
                Amount (GHS)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(event) => onFormChange('amount', event.target.value)}
                />
              </label>
              <label>
                Program Year
                <CustomDropdown
                  options={yearOptions.map((year) => ({ label: String(year), value: year }))}
                  value={form.programYear}
                  onChange={(nextValue) => onFormChange('programYear', Number(nextValue))}
                  searchable
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
