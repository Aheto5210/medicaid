import React from 'react';

export default function RecentList({ items }) {
  if (!items.length) {
    return <div className="empty">No registrations yet.</div>;
  }

  return (
    <div className="recent-list">
      <div className="recent-row header">
        <span>Full name</span>
        <span>Phone</span>
        <span>House/Address</span>
      </div>
      {items.map((person) => (
        <div key={person.id} className="recent-row">
          <span className="person-name">{person.first_name} {person.last_name}</span>
          <span>{person.phone || '--'}</span>
          <span>{person.address_line1 || '--'}</span>
        </div>
      ))}
    </div>
  );
}
