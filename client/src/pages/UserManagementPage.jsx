import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';
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

export default function UserManagementPage({ user }) {
  const isAdmin = user?.role === 'admin';

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingError, setLoadingError] = useState(null);
  const [message, setMessage] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);

  const [createForm, setCreateForm] = useState(buildDefaultUserForm());
  const [editForm, setEditForm] = useState(buildDefaultUserForm());

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
  }, [isAdmin]);

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

    setEditingUserId(null);
    setMessage({ type: 'success', text: 'User updated successfully.' });
    await loadUsers();
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
                    <div className="user-row-head">
                      <div>
                        <strong>{userItem.full_name}</strong>
                        <div className="label">{userItem.email}</div>
                      </div>
                      <div className="user-row-meta">
                        <span className="badge">{getRoleLabel(userItem.role)}</span>
                        <span className={`badge ${userItem.is_active ? '' : 'inactive-badge'}`}>
                          {userItem.is_active ? 'Active' : 'Disabled'}
                        </span>
                        {editingUserId !== userItem.id && (
                          <button className="ghost" onClick={() => startEdit(userItem)}>Edit Access</button>
                        )}
                      </div>
                    </div>

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
    </section>
  );
}
