import React from 'react';

export default function PeopleTable({
  people,
  onView,
  canDelete = false,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll
}) {
  if (!people.length) {
    return <div className="empty">No registrations found.</div>;
  }

  const selectedSet = new Set(selectedIds);
  const allSelected = canDelete && people.every((person) => selectedSet.has(person.id));

  return (
    <div className="table">
      <div className="table-row header">
        <span className="row-select-cell">
          {canDelete && (
            <input
              type="checkbox"
              aria-label="Select all records"
              checked={allSelected}
              onChange={onToggleSelectAll}
            />
          )}
        </span>
        <span>Name</span>
        <span>Sex</span>
        <span>Location</span>
        <span>Main Reason</span>
        <span>Actions</span>
      </div>
      {people.map((person) => (
        <div key={person.id} className="table-row">
          <span className="row-select-cell">
            {canDelete && (
              <input
                type="checkbox"
                aria-label={`Select ${person.first_name} ${person.last_name}`}
                checked={selectedSet.has(person.id)}
                onChange={() => onToggleSelect?.(person.id)}
              />
            )}
          </span>
          <span>{person.first_name} {person.last_name}</span>
          <span>{person.gender || '--'}</span>
          <span>{person.address_line1 || [person.city, person.region].filter(Boolean).join(', ') || '--'}</span>
          <span>{person.reason_for_coming || '--'}</span>
          <span>
            <button className="ghost table-action" onClick={() => onView(person.id)}>
              View
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
