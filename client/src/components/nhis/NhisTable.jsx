import React from 'react';
import { buildNhisDisplayName } from '../../utils/people.js';

function formatCurrency(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatReadableDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function hasTextValue(value) {
  return String(value || '').trim().length > 0;
}

export default function NhisTable({
  records,
  onView,
  canDelete = false,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll
}) {
  if (!records.length) {
    return <div className="empty">No NHIS registrations found.</div>;
  }

  const selectedSet = new Set(selectedIds);
  const allSelected = canDelete && records.every((record) => selectedSet.has(record.id));

  return (
    <div className="table">
      <div className="table-row header nhis-row">
        <span className="row-select-cell">
          {canDelete && (
            <input
              type="checkbox"
              aria-label="Select all NHIS records"
              checked={allSelected}
              onChange={onToggleSelectAll}
            />
          )}
        </span>
        <span>Name</span>
        <span>Situation/Case</span>
        <span>Amount (GHS)</span>
        <span>Date</span>
        <span>Actions</span>
      </div>
      {records.map((record) => {
        const hasSituationCase = hasTextValue(record.situation_case);
        const hasAmount = Number.isFinite(Number(record.amount));
        const showNameOnly = !hasSituationCase && !hasAmount;

        return (
          <div key={record.id} className="table-row nhis-row">
            <span className="row-select-cell">
              {canDelete && (
              <input
                type="checkbox"
                aria-label={`Select ${buildNhisDisplayName(record) || 'record'}`}
                checked={selectedSet.has(record.id)}
                onChange={() => onToggleSelect?.(record.id)}
              />
            )}
          </span>
            <span>{buildNhisDisplayName(record) || '--'}</span>
            <span>{showNameOnly ? '' : (record.situation_case || '')}</span>
            <span>{showNameOnly ? '' : formatCurrency(record.amount)}</span>
            <span>{showNameOnly ? '' : formatReadableDate(record.registration_date)}</span>
            <span>
              <button className="ghost table-action" onClick={() => onView(record.id)}>
                View
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
