import { verifyAccessToken } from '../utils/tokens.js';
import { query } from '../db.js';
import { hasPermission, normalizePermissions } from '../utils/permissions.js';
import { DEFAULT_ROLE, normalizeRoleValue } from '../utils/roles.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Missing access token' });
  }

  try {
    const payload = verifyAccessToken(token);

    const userResult = await query(
      'SELECT id, role, email, is_active, permissions FROM users WHERE id = $1',
      [payload.sub]
    );

    if (!userResult.rows.length) {
      return res.status(401).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ message: 'Account disabled' });
    }
    const safeRole = normalizeRoleValue(user.role) || DEFAULT_ROLE;

    req.user = {
      id: user.id,
      role: safeRole,
      email: user.email,
      permissions: normalizePermissions(user.permissions, safeRole)
    };

    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }
}

export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    return next();
  };
}

export function requirePermission(moduleKey, action = 'view') {
  return (req, res, next) => {
    if (!hasPermission(req.user, moduleKey, action)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    return next();
  };
}
