import React from 'react';
import { getRoleLabel } from '../../utils/roles.js';
import BrandLogo from '../common/BrandLogo.jsx';

export default function Sidebar({ user, items, active, onChange, theme = 'light', showLogo = true }) {
  return (
    <aside className="sidebar">
      {showLogo && (
        <div className="brand">
          <BrandLogo theme={theme} className="brand-logo sidebar-logo" />
        </div>
      )}

      <nav className="nav">
        {items.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${active === item.key ? 'active' : ''}`}
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="avatar">{user.full_name?.[0] || 'U'}</div>
          <div>
            <div className="user-name">{user.full_name}</div>
            <div className="user-role">{getRoleLabel(user.role)}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
