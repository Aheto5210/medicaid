import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api.js';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import { downloadFile } from '../utils/downloads.js';
import {
  clonePermissionsForRole,
  normalizePermissions
} from '../utils/permissions.js';
import {
  DEFAULT_ROLE,
  ROLE_OPTIONS,
  getRoleLabel,
  normalizeRoleValue
} from '../utils/roles.js';

function buildDefaultUserForm(role = DEFAULT_ROLE) {
  const safeRole = normalizeRoleValue(role) || DEFAULT_ROLE;
  return {
    fullName: '',
    email: '',
    password: '',
    role: safeRole,
    isActive: true,
    permissions: clonePermissionsForRole(safeRole)
  };
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

function formatDate(value) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return dateFormatter.format(parsed);
}

function hasUserRecords(userItem) {
  return Number(userItem?.general_registration_count) > 0 || Number(userItem?.nhis_registration_count) > 0;
}

function MenuDotsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="1.75" fill="currentColor" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
      <circle cx="12" cy="19" r="1.75" fill="currentColor" />
    </svg>
  );
}

function StatCard({ label, value, muted }) {
  return (
    <div className={`user-summary-card ${muted ? 'muted-stat' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RecordsSection({ title, count, emptyMessage, children }) {
  return (
    <section className="user-records-section">
      <div className="user-records-section-head">
        <h4>{title}</h4>
        <span className="badge">{count}</span>
      </div>
      {count ? <div className="user-records-list">{children}</div> : <div className="empty">{emptyMessage}</div>}
    </section>
  );
}

function UserRecordCard({ title, meta = [], aside, accent = 'general' }) {
  return (
    <article className={`user-record-card ${accent}`}>
      <div className="user-record-card-top">
        <strong>{title}</strong>
        {aside ? <span className="badge">{aside}</span> : null}
      </div>
      <div className="user-record-card-meta">
        {meta.filter(Boolean).map((item, index) => (
          <span key={`${item}-${index}`}>{item}</span>
        ))}
      </div>
    </article>
  );
}

function PermissionsEditor({ value, onChange }) {
  return (
    <div className="permissions-matrix">
      <div className="permission-module">
        <div className="permission-module-info">
          <h4>Overview</h4>
          <p>Dashboard visibility</p>
        </div>
        <div className="permission-actions">
          <label className="checkbox-row compact">
            <input
              type="checkbox"
              checked={value.overview.view}
              onChange={(event) => onChange('overview', 'view', event.target.checked)}
            />
            <span>View</span>
          </label>
        </div>
      </div>

      <div className="permission-module">
        <div className="permission-module-info">
          <h4>General Registration</h4>
          <p>Module + action access</p>
        </div>
        <div className="permission-actions action-grid">
          <label className="checkbox-row compact">
            <input
              type="checkbox"
              checked={value.generalRegistration.view}
              onChange={(event) => onChange('generalRegistration', 'view', event.target.checked)}
            />
            <span>View</span>
          </label>
          <label className="checkbox-row compact">
            <input
              type="checkbox"
              checked={value.generalRegistration.create}
              onChange={(event) => onChange('generalRegistration', 'create', event.target.checked)}
            />
            <span>Create</span>
          </label>
          <label className="checkbox-row compact">
            <input
              type="checkbox"
              checked={value.generalRegistration.edit}
              onChange={(event) => onChange('generalRegistration', 'edit', event.target.checked)}
            />
            <span>Edit</span>
          </label>
          <label className="checkbox-row compact">
            <input
              type="checkbox"
              checked={value.generalRegistration.delete}
              onChange={(event) => onChange('generalRegistration', 'delete', event.target.checked)}
            />
            <span>Delete</span>
          </label>
          <label className="checkbox-row compact">
            <input
              type="checkbox"
              checked={value.generalRegistration.import}
              onChange={(event) => onChange('generalRegistration', 'import', event.target.checked)}
            />
            <span>Import</span>
          </label>
          <label className="checkbox-row compact">
            <input
              type="checkbox"
              checked={value.generalRegistration.export}
              onChange={(event) => onChange('generalRegistration', 'export', event.target.checked)}
            />
            <span>Export</span>
          </label>
        </div>
      </div>

      <div className="permission-module">
        <div className="permission-module-info">
          <h4>NHIS Registration</h4>
          <p>Module + action access</p>
        </div>
        <div className="permission-actions action-grid">
          <label className="checkbox-row compact">
            <input
              type="checkbox"
              checked={value.nhisRegistration.view}
              onChange={(event) => onChange('nhisRegistration', 'view', event.target.checked)}
            />
            <span>View</span>
          </label>
          <label className="checkbox-row compact">
            <input
              type="checkbox"
              checked={value.nhisRegistration.create}
              onChange={(event) => onChange('nhisRegistration', 'create', event.target.checked)}
            />
            <span>Create</span>
          </label>
          <label className="checkbox-row compact">
            <input
              type="checkbox"
              checked={value.nhisRegistration.edit}
              onChange={(event) => onChange('nhisRegistration', 'edit', event.target.checked)}
            />
            <span>Edit</span>
          </label>
          <label className="checkbox-row compact">
            <input
              type="checkbox"
              checked={value.nhisRegistration.delete}
              onChange={(event) => onChange('nhisRegistration', 'delete', event.target.checked)}
            />
            <span>Delete</span>
          </label>
          <label className="checkbox-row compact">
            <input
              type="checkbox"
              checked={value.nhisRegistration.import}
              onChange={(event) => onChange('nhisRegistration', 'import', event.target.checked)}
            />
            <span>Import</span>
          </label>
          <label className="checkbox-row compact">
            <input
              type="checkbox"
              checked={value.nhisRegistration.export}
              onChange={(event) => onChange('nhisRegistration', 'export', event.target.checked)}
            />
            <span>Export</span>
          </label>
        </div>
      </div>

      <div className="permission-module">
        <div className="permission-module-info">
          <h4>User Management</h4>
          <p>Admin-only section</p>
        </div>
        <div className="permission-actions">
          <label className="checkbox-row compact">
            <input
              type="checkbox"
              checked={value.userManagement.view}
              onChange={(event) => onChange('userManagement', 'view', event.target.checked)}
            />
            <span>Access</span>
          </label>
        </div>
      </div>
    </div>
  );
}

export default function UserManagementPage({ user, onCurrentUserUpdated }) {
  const isAdmin = user?.role === 'admin';

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingError, setLoadingError] = useState(null);
  const [message, setMessage] = useState(null);
  const [activeMenuUserId, setActiveMenuUserId] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [recordsViewerUserId, setRecordsViewerUserId] = useState(null);
  const [recordsByUserId, setRecordsByUserId] = useState({});
  const [loadingRecordsUserId, setLoadingRecordsUserId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [exportingUserId, setExportingUserId] = useState(null);

  const [createForm, setCreateForm] = useState(buildDefaultUserForm());
  const [editForm, setEditForm] = useState(buildDefaultUserForm());

  const summary = useMemo(() => {
    const activeUsers = users.filter((userItem) => userItem.is_active).length;
    const generalRecords = users.reduce(
      (sum, userItem) => sum + (Number(userItem.general_registration_count) || 0),
      0
    );
    const nhisRecords = users.reduce(
      (sum, userItem) => sum + (Number(userItem.nhis_registration_count) || 0),
      0
    );

    return {
      totalUsers: users.length,
      activeUsers,
      generalRecords,
      nhisRecords
    };
  }, [users]);

  const activeRecords = recordsViewerUserId ? recordsByUserId[recordsViewerUserId] : null;
  const recordsViewerUser = recordsViewerUserId
    ? users.find((userItem) => userItem.id === recordsViewerUserId) || null
    : null;

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
  }, [isAdmin]);

  useEffect(() => {
    if (!activeMenuUserId) return undefined;

    function handlePointerDown(event) {
      if (event.target.closest('.user-menu-shell')) return;
      setActiveMenuUserId(null);
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setActiveMenuUserId(null);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuUserId]);

  async function loadUsers() {
    setLoadingUsers(true);
    setLoadingError(null);

    const res = await apiFetch('/api/users');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLoadingError(data.message || 'Failed to load users.');
      setLoadingUsers(false);
      return;
    }

    const data = await res.json();
    setUsers(data);
    setLoadingUsers(false);
  }

  async function loadUserRecords(userId) {
    if (recordsByUserId[userId]) {
      return recordsByUserId[userId];
    }

    setLoadingRecordsUserId(userId);

    const res = await apiFetch(`/api/users/${userId}/records`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLoadingRecordsUserId(null);
      setMessage({ type: 'error', text: data.message || 'Failed to load user records.' });
      return null;
    }

    const data = await res.json();
    setRecordsByUserId((prev) => ({
      ...prev,
      [userId]: data
    }));
    setLoadingRecordsUserId(null);
    return data;
  }

  function setCreatePermission(moduleKey, action, value) {
    setCreateForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleKey]: {
          ...prev.permissions[moduleKey],
          [action]: value
        }
      }
    }));
  }

  function setEditPermission(moduleKey, action, value) {
    setEditForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleKey]: {
          ...prev.permissions[moduleKey],
          [action]: value
        }
      }
    }));
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    setMessage(null);

    const res = await apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(createForm)
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: 'error', text: data.message || 'Failed to create user.' });
      return;
    }

    setCreateForm(buildDefaultUserForm());

    setMessage({ type: 'success', text: 'User created successfully.' });
    await loadUsers();
  }

  function startEdit(userItem) {
    const role = normalizeRoleValue(userItem.role) || DEFAULT_ROLE;

    setActiveMenuUserId(null);
    setEditingUserId(userItem.id);
    setMessage(null);
    setEditForm({
      fullName: userItem.full_name || '',
      email: userItem.email || '',
      password: '',
      role,
      isActive: Boolean(userItem.is_active),
      permissions: normalizePermissions(userItem.permissions, role)
    });
  }

  async function handleUpdateUser(event) {
    event.preventDefault();
    if (!editingUserId) return;

    setMessage(null);

    const payload = {
      fullName: editForm.fullName,
      email: editForm.email,
      role: editForm.role,
      isActive: editForm.isActive,
      permissions: editForm.permissions,
      password: editForm.password || undefined
    };

    const res = await apiFetch(`/api/users/${editingUserId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: 'error', text: data.message || 'Failed to update user.' });
      return;
    }

    const updatedCurrentUser = editingUserId === user?.id;
    setEditingUserId(null);
    await loadUsers();

    if (updatedCurrentUser) {
      await onCurrentUserUpdated?.();
    }

    setMessage({ type: 'success', text: 'User updated successfully.' });
  }

  async function openUserRecords(userItem) {
    setActiveMenuUserId(null);
    setRecordsViewerUserId(userItem.id);
    await loadUserRecords(userItem.id);
  }

  async function confirmDeleteUser() {
    if (!deleteTarget) return;

    setDeletingUserId(deleteTarget.id);
    setMessage(null);

    const res = await apiFetch(`/api/users/${deleteTarget.id}`, {
      method: 'DELETE'
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setDeletingUserId(null);
      setDeleteTarget(null);
      setMessage({ type: 'error', text: data.message || 'Failed to delete user.' });
      return;
    }

    if (editingUserId === deleteTarget.id) {
      setEditingUserId(null);
    }

    setDeletingUserId(null);
    setDeleteTarget(null);
    await loadUsers();
    setMessage({ type: 'success', text: data.message || 'User deleted successfully.' });
  }

  async function handleExportUserRecords(userItem) {
    setExportingUserId(userItem.id);
    setActiveMenuUserId(null);
    setMessage(null);

    try {
      const result = await downloadFile(`/api/users/${userItem.id}/export`, `${userItem.full_name}-records.xlsx`);

      if (!result.cancelled) {
        setMessage({ type: 'success', text: 'User records export downloaded.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to export user records.' });
    } finally {
      setExportingUserId(null);
    }
  }

  return (
    <section className="page">
      {message && <div className={message.type === 'error' ? 'error' : 'notice'}>{message.text}</div>}

      {!isAdmin && (
        <div className="panel">
          <div className="empty">Only admins can manage users.</div>
        </div>
      )}

      {isAdmin && (
        <>
          <div className="panel">
            <div className="panel-header">
              <h2>User Overview</h2>
              <span className="badge">Admin tools</span>
            </div>
            <div className="user-summary-grid">
              <StatCard label="Total Users" value={summary.totalUsers} />
              <StatCard label="Active Users" value={summary.activeUsers} />
              <StatCard label="General Records" value={summary.generalRecords} />
              <StatCard label="NHIS Records" value={summary.nhisRecords} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Create User</h2>
              <span className="badge">Admin</span>
            </div>

            <form className="form" onSubmit={handleCreateUser}>
              <div className="user-form-layout">
                <div className="form-section">
                  <h3>User Details</h3>
                  <div className="field-grid">
                    <label>
                      Full Name
                      <input
                        required
                        value={createForm.fullName}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, fullName: event.target.value }))}
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        required
                        value={createForm.email}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={createForm.password}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                      />
                    </label>
                    <label>
                      Role
                      <select
                        value={createForm.role}
                        onChange={(event) => {
                          const role = normalizeRoleValue(event.target.value) || DEFAULT_ROLE;
                          setCreateForm((prev) => ({
                            ...prev,
                            role,
                            permissions: clonePermissionsForRole(role)
                          }));
                        }}
                      >
                        {ROLE_OPTIONS.map((roleOption) => (
                          <option key={roleOption.value} value={roleOption.value}>{roleOption.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="checkbox-row inline-checkbox">
                      <input
                        type="checkbox"
                        checked={createForm.isActive}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                      />
                      <span>Active account</span>
                    </label>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Access Control</h3>
                  <p className="permissions-note">Choose modules and actions this user can access.</p>
                  <PermissionsEditor value={createForm.permissions} onChange={setCreatePermission} />
                </div>
              </div>

              <div className="modal-actions">
                <button className="primary" type="submit">Create User</button>
              </div>
            </form>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Manage Users</h2>
              <span className="badge">{users.length} users</span>
            </div>

            {loadingUsers && <div className="empty">Loading users...</div>}
            {!loadingUsers && loadingError && <div className="error">{loadingError}</div>}

            {!loadingUsers && !loadingError && (
              <div className="users-list">
                {users.map((userItem) => (
                  <div key={userItem.id} className="user-row">
                    <div className="user-row-head compact-user-row">
                      <div className="user-row-primary">
                        <strong>{userItem.full_name}</strong>
                        <div className="label">{userItem.email}</div>
                      </div>
                      <div className="user-row-tail">
                        <span className="badge">{getRoleLabel(userItem.role)}</span>
                        <span className={`badge ${userItem.is_active ? '' : 'inactive-badge'}`}>
                          {userItem.is_active ? 'Active' : 'Disabled'}
                        </span>
                        <div className="user-menu-shell">
                          <button
                            className="ghost icon-button user-menu-trigger"
                            type="button"
                            aria-label={`Open actions for ${userItem.full_name}`}
                            aria-expanded={activeMenuUserId === userItem.id}
                            onClick={() => setActiveMenuUserId((prev) => (prev === userItem.id ? null : userItem.id))}
                          >
                            <MenuDotsIcon />
                          </button>

                          {activeMenuUserId === userItem.id && (
                            <div className="user-action-menu">
                              <button className="user-action-menu-item" type="button" onClick={() => startEdit(userItem)}>
                                Edit Access
                              </button>
                              <button
                                className="user-action-menu-item"
                                type="button"
                                disabled={!hasUserRecords(userItem)}
                                onClick={() => openUserRecords(userItem)}
                              >
                                View Records
                              </button>
                              <button
                                className="user-action-menu-item"
                                type="button"
                                disabled={!hasUserRecords(userItem) || exportingUserId === userItem.id}
                              onClick={() => handleExportUserRecords(userItem)}
                            >
                              {exportingUserId === userItem.id ? 'Exporting...' : 'Export Records'}
                            </button>
                              <button
                                className="user-action-menu-item user-action-menu-item-danger"
                                type="button"
                                disabled={!userItem.can_delete || deletingUserId === userItem.id}
                                title={userItem.delete_restriction_reason || 'Delete this account'}
                                onClick={() => {
                                  setActiveMenuUserId(null);
                                  setDeleteTarget(userItem);
                                }}
                              >
                                {deletingUserId === userItem.id ? 'Deleting...' : 'Delete User'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {(Number(userItem.general_registration_count) > 0 || Number(userItem.nhis_registration_count) > 0) && (
                      <div className="user-row-badges">
                        {Number(userItem.general_registration_count) > 0 && (
                          <span className="badge subtle-badge">General {userItem.general_registration_count}</span>
                        )}
                        {Number(userItem.nhis_registration_count) > 0 && (
                          <span className="badge subtle-badge">NHIS {userItem.nhis_registration_count}</span>
                        )}
                      </div>
                    )}

                    {editingUserId === userItem.id && (
                      <form className="form" onSubmit={handleUpdateUser}>
                        <div className="user-form-layout">
                          <div className="form-section">
                            <h3>User Details</h3>
                            <div className="field-grid">
                              <label>
                                Full Name
                                <input
                                  required
                                  value={editForm.fullName}
                                  onChange={(event) => setEditForm((prev) => ({ ...prev, fullName: event.target.value }))}
                                />
                              </label>
                              <label>
                                Email
                                <input
                                  type="email"
                                  required
                                  value={editForm.email}
                                  onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                                />
                              </label>
                              <label>
                                New Password (optional)
                                <input
                                  type="password"
                                  minLength={6}
                                  value={editForm.password}
                                  onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
                                />
                              </label>
                              <label>
                                Role
                                <select
                                  value={editForm.role}
                                  onChange={(event) => {
                                    const role = normalizeRoleValue(event.target.value) || DEFAULT_ROLE;
                                    setEditForm((prev) => ({
                                      ...prev,
                                      role,
                                      permissions: clonePermissionsForRole(role)
                                    }));
                                  }}
                                >
                                  {ROLE_OPTIONS.map((roleOption) => (
                                    <option key={roleOption.value} value={roleOption.value}>{roleOption.label}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="checkbox-row inline-checkbox">
                                <input
                                  type="checkbox"
                                  checked={editForm.isActive}
                                  onChange={(event) => setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                                />
                                <span>Active account</span>
                              </label>
                            </div>
                          </div>

                          <div className="form-section">
                            <h3>Access Control</h3>
                            <p className="permissions-note">Update module visibility and allowed actions.</p>
                            <PermissionsEditor value={editForm.permissions} onChange={setEditPermission} />
                          </div>
                        </div>

                        <div className="modal-actions">
                          <button className="ghost" type="button" onClick={() => setEditingUserId(null)}>Cancel</button>
                          <button className="primary" type="submit">Save Changes</button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}

                {!users.length && <div className="empty">No users yet.</div>}
              </div>
            )}
          </div>
        </>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete User"
          message={`Delete ${deleteTarget.full_name}'s account? This only works when the account has no saved records tied to it.`}
          confirmLabel="Delete User"
          danger
          busy={deletingUserId === deleteTarget.id}
          onCancel={() => {
            if (deletingUserId === deleteTarget.id) return;
            setDeleteTarget(null);
          }}
          onConfirm={confirmDeleteUser}
        />
      )}

      {recordsViewerUserId && (
        <div className="modal-backdrop" onClick={() => setRecordsViewerUserId(null)}>
          <div className="modal details-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{recordsViewerUser?.full_name || 'User Records'}</h2>
                <p className="permissions-note">{recordsViewerUser?.email || ''}</p>
              </div>
              <button className="ghost" type="button" onClick={() => setRecordsViewerUserId(null)}>
                Close
              </button>
            </div>

            {loadingRecordsUserId === recordsViewerUserId && <div className="empty">Loading records...</div>}

            {loadingRecordsUserId !== recordsViewerUserId && activeRecords && (
              <div className="user-records-grid">
                <RecordsSection
                  title="General Registration"
                  count={activeRecords.summary?.general_registration_count || 0}
                  emptyMessage="No General Registration records saved by this user yet."
                >
                  {activeRecords.general_registrations.map((record) => (
                    <UserRecordCard
                      key={record.id}
                      title={record.full_name}
                      accent="general"
                      aside={record.program_year ? `Year ${record.program_year}` : null}
                      meta={[
                        formatDate(record.registration_date),
                        record.gender || 'Gender not set',
                        record.location || 'Location not set',
                        record.reason_for_coming || 'Reason not set'
                      ]}
                    />
                  ))}
                </RecordsSection>

                <RecordsSection
                  title="NHIS Registration"
                  count={activeRecords.summary?.nhis_registration_count || 0}
                  emptyMessage="No NHIS registrations saved by this user yet."
                >
                  {activeRecords.nhis_registrations.map((record) => (
                    <UserRecordCard
                      key={record.id}
                      title={record.full_name}
                      accent="nhis"
                      aside={record.program_year ? `Year ${record.program_year}` : null}
                      meta={[
                        formatDate(record.registration_date),
                        record.situation_case || 'Situation not set'
                      ]}
                    />
                  ))}
                </RecordsSection>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
