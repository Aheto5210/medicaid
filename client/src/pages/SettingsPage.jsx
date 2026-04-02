import React from 'react';
import { getRoleLabel } from '../utils/roles.js';

export default function SettingsPage({
  user,
  resolvedTheme = 'light'
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
            <div className="label">Theme</div>
            <div className="value">System Default</div>
            <div className="label theme-note">
              Follows device theme automatically. Active: {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
