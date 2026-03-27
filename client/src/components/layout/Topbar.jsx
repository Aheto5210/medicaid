import React from 'react';

function ThemeIcon({ theme = 'light' }) {
  if (theme === 'dark') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.8 3.3a8.7 8.7 0 1 0 5.9 14.9 8.8 8.8 0 0 1-5.9-14.9Z" />
    </svg>
  );
}

export default function Topbar({
  title,
  search,
  onSearch,
  programYear,
  yearOptions,
  onYearChange,
  showSearch = true,
  showYear = true,
  showNew = true,
  onNew,
  onLogout,
  resolvedTheme = 'light',
  onThemeToggle
}) {
  const nextThemeLabel = resolvedTheme === 'dark' ? 'light' : 'dark';

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

        {showYear && (
          <div className="year-select">
            <select
              value={programYear}
              onChange={(event) => onYearChange(Number(event.target.value))}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        )}

        <button
          className="ghost icon-button theme-toggle"
          type="button"
          onClick={onThemeToggle}
          aria-label={`Switch to ${nextThemeLabel} mode`}
          title={`Switch to ${nextThemeLabel} mode`}
        >
          <ThemeIcon theme={resolvedTheme} />
        </button>

        <button className="ghost" onClick={onLogout}>Log out</button>
        {showNew && <button className="primary" onClick={onNew}>+ New</button>}
      </div>
    </div>
  );
}
