import React from 'react';
import { getRoleLabel } from '../utils/roles.js';
import { THEME_MODE } from '../utils/theme.js';

export default function SettingsPage({
  user,
  resolvedTheme = 'light',
  themeMode = THEME_MODE.SYSTEM
}) {
  const themeModeLabel = themeMode === THEME_MODE.SYSTEM
    ? 'System Default'
    : themeMode === THEME_MODE.DARK
      ? 'Manual Dark'
      : 'Manual Light';

  return (
    <section className="page">
      <div className="panel">
        <div className="panel-header">
          <h2>Settings</h2>
          <span className="badge">Account</span>
        </div>

        <div className="settings-grid">
          <div>
            <div className="label">Signed in as</div>
            <div className="value">{user.full_name} ({user.email})</div>
          </div>
          <div>
            <div className="label">Role</div>
            <div className="value">{getRoleLabel(user.role)}</div>
          </div>
          <div>
            <div className="label">Program</div>
            <div className="value">MEDICAID</div>
          </div>
          <div>
            <div className="label">Theme</div>
            <div className="value">{themeModeLabel}</div>
            <div className="label theme-note">
              {themeMode === THEME_MODE.SYSTEM ? 'Follows device theme automatically.' : 'Changed from Overview theme icon.'} Active: {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
