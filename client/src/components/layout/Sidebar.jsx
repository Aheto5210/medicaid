import React, { useEffect } from 'react';
import { getRoleLabel } from '../../utils/roles.js';
import BrandLogo from '../common/BrandLogo.jsx';

export default function Sidebar({
  user,
  items,
  active,
  onChange,
  onLogout,
  theme = 'light',
  showLogo = true,
  isOpen = false,
  onClose
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  function handleItemSelect(nextView) {
    onChange(nextView);
    onClose?.();
  }

  function handleLogoutClick() {
    onClose?.();
    onLogout?.();
  }

  return (
    <>
      <button
        className={`sidebar-backdrop ${isOpen ? 'visible' : ''}`}
        type="button"
        aria-label="Close menu"
        onClick={() => onClose?.()}
      />

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
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
            onClick={() => handleItemSelect(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-card-header">
            <div className="avatar">{user.full_name?.[0] || 'U'}</div>
            <div className="user-meta">
              <div className="user-name">{user.full_name}</div>
              <div className="user-role">{getRoleLabel(user.role)}</div>
            </div>
          </div>
          <button className="ghost user-logout-button" type="button" onClick={handleLogoutClick}>
            Log out
          </button>
        </div>
      </div>
      </aside>
    </>
  );
}
