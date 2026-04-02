import React from 'react';
import { buildPersonDisplayName } from '../../utils/people.js';

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
          <span className="person-name">{buildPersonDisplayName(person) || '--'}</span>
          <span>{person.phone || '--'}</span>
          <span>{person.address_line1 || '--'}</span>
        </div>
      ))}
    </div>
  );
}
