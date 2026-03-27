import React from 'react';
import { getRoleLabel } from '../utils/roles.js';

export default function SettingsPage({
  user,
  themeMode = 'system',
  resolvedTheme = 'light',
  onThemeModeChange
}) {
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
            <label className="theme-control">
              Theme
              <select
                value={themeMode}
                onChange={(event) => onThemeModeChange?.(event.target.value)}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System Default</option>
              </select>
            </label>
            <div className="label theme-note">Active Theme: {resolvedTheme === 'dark' ? 'Dark' : 'Light'}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
