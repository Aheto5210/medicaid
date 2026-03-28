import React from 'react';

export default function Topbar({
  title,
  search,
  onSearch,
  showSearch = true,
  showMenuToggle = false,
  onMenuToggle
}) {
  return (
    <div className="topbar">
      <div className="topbar-title">
        {showMenuToggle && (
          <button
            className="ghost icon-button menu-toggle"
            type="button"
            aria-label="Open menu"
            onClick={onMenuToggle}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </button>
        )}
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
