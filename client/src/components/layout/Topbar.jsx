import React from 'react';

export default function Topbar({
  title,
  search,
  onSearch,
  showSearch = true
}) {
  return (
    <div className="topbar">
      <div className="topbar-title">
        <h1>{title}</h1>
      </div>

      <div className="topbar-actions">
        {showSearch && (
          <div className="search">
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search registrations..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
