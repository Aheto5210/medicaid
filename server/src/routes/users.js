import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAuth, requirePermission, requireRole } from '../middleware/auth.js';
import { normalizePermissions } from '../utils/permissions.js';
import { DEFAULT_ROLE, normalizeRoleValue } from '../utils/roles.js';

const router = express.Router();

function mapUser(row) {
  const safeRole = normalizeRoleValue(row.role) || DEFAULT_ROLE;
  return {
    ...row,
    role: safeRole,
    permissions: normalizePermissions(row.permissions, safeRole)
  };
}

router.use(requireAuth);
router.use(requirePermission('userManagement', 'view'));
router.use(requireRole(['admin']));

router.get('/', async (req, res) => {
  const result = await query(
    `SELECT id, full_name, email, role, is_active, created_at, last_login_at, permissions
     FROM users
     ORDER BY created_at DESC`
  );

  return res.json(result.rows.map(mapUser));
});

router.post('/', async (req, res) => {
  const payload = req.body || {};
  const fullName = String(payload.fullName || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const parsedRole = payload.role === undefined ? null : normalizeRoleValue(payload.role);
  const role = parsedRole || DEFAULT_ROLE;

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: 'fullName, email, and password are required.' });
  }

  if (payload.role !== undefined && !parsedRole) {
    return res.status(400).json({ message: 'Invalid role provided.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    return res.status(409).json({ message: 'Email already in use.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const permissions = normalizePermissions(payload.permissions, role);
  const isActive = payload.isActive === undefined ? true : Boolean(payload.isActive);

  const insert = await query(
    `INSERT INTO users (full_name, email, password_hash, role, is_active, permissions)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, full_name, email, role, is_active, created_at, last_login_at, permissions`,
    [fullName, email, passwordHash, role, isActive, JSON.stringify(permissions)]
  );

  return res.status(201).json(mapUser(insert.rows[0]));
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};

  const existingResult = await query(
    'SELECT id, role, permissions FROM users WHERE id = $1',
    [id]
  );

  if (!existingResult.rows.length) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const existing = existingResult.rows[0];
  const existingRole = normalizeRoleValue(existing.role) || DEFAULT_ROLE;
  const requestedRole = payload.role !== undefined ? normalizeRoleValue(payload.role) : null;
  const nextRole = payload.role !== undefined ? requestedRole : existingRole;

  if (id === req.user.id && payload.isActive === false) {
    return res.status(400).json({ message: 'You cannot disable your own account.' });
  }

  if (payload.role !== undefined && !requestedRole) {
    return res.status(400).json({ message: 'Invalid role provided.' });
  }

  if (id === req.user.id && payload.role !== undefined && nextRole !== 'admin') {
    return res.status(400).json({ message: 'You cannot remove your own admin role.' });
  }

  if (id === req.user.id && payload.permissions?.userManagement?.view === false) {
    return res.status(400).json({ message: 'You cannot remove your own User Management access.' });
  }

  const updates = [];
  const values = [];

  if (payload.fullName !== undefined) {
    const fullName = String(payload.fullName || '').trim();
    if (!fullName) {
      return res.status(400).json({ message: 'fullName cannot be empty.' });
    }
    values.push(fullName);
    updates.push(`full_name = $${values.length}`);
  }

  if (payload.email !== undefined) {
    const email = String(payload.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: 'email cannot be empty.' });
    }

    const emailInUse = await query(
      'SELECT id FROM users WHERE email = $1 AND id <> $2',
      [email, id]
    );
    if (emailInUse.rows.length) {
      return res.status(409).json({ message: 'Email already in use.' });
    }

    values.push(email);
    updates.push(`email = $${values.length}`);
  }

  if (payload.role !== undefined) {
    values.push(nextRole);
    updates.push(`role = $${values.length}`);
  }

  if (payload.isActive !== undefined) {
    values.push(Boolean(payload.isActive));
    updates.push(`is_active = $${values.length}`);
  }

  if (payload.password !== undefined) {
    const password = String(payload.password || '');
    if (password && password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      values.push(passwordHash);
      updates.push(`password_hash = $${values.length}`);
    }
  }

  if (payload.permissions !== undefined || payload.role !== undefined) {
    const sourcePermissions = payload.permissions !== undefined
      ? payload.permissions
      : existing.permissions;
    const permissions = normalizePermissions(sourcePermissions, nextRole);
    values.push(JSON.stringify(permissions));
    updates.push(`permissions = $${values.length}::jsonb`);
  }

  if (!updates.length) {
    return res.status(400).json({ message: 'No valid fields provided for update.' });
  }

  values.push(id);
  const result = await query(
    `UPDATE users
     SET ${updates.join(', ')}
     WHERE id = $${values.length}
     RETURNING id, full_name, email, role, is_active, created_at, last_login_at, permissions`,
    values
  );

  return res.json(mapUser(result.rows[0]));
});

export default router;
