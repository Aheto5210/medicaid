import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken
} from '../utils/tokens.js';
import { requireAuth } from '../middleware/auth.js';
import { normalizePermissions } from '../utils/permissions.js';
import { DEFAULT_ROLE, normalizeRoleValue } from '../utils/roles.js';

const router = express.Router();

function durationToInterval(duration) {
  const match = /^([0-9]+)([smhd])$/.exec(duration || '30d');
  if (!match) return '30 days';
  const value = Number(match[1]);
  const unit = match[2];
  const map = { s: 'seconds', m: 'minutes', h: 'hours', d: 'days' };
  return `${value} ${map[unit] || 'days'}`;
}

async function issueTokens(user, meta = {}) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const refreshInterval = durationToInterval(process.env.REFRESH_TOKEN_EXPIRES_IN || '30d');

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_ip, user_agent)
     VALUES ($1, $2, now() + ($3::interval), $4, $5)`
    ,
    [
      user.id,
      hashToken(refreshToken),
      refreshInterval,
      meta.ip || null,
      meta.userAgent || null
    ]
  );

  return { accessToken, refreshToken };
}

router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body || {};

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'fullName, email, and password are required' });
    }

    const countResult = await query('SELECT COUNT(*)::int AS count FROM users');
    const isFirstUser = countResult.rows[0].count === 0;

    if (!isFirstUser) {
      return res.status(403).json({ message: 'Public signup disabled' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const initialRole = 'admin';

    const insert = await query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role, permissions, created_at`,
      [fullName, email.toLowerCase(), passwordHash, initialRole]
    );

    const user = insert.rows[0];
    const safeRole = normalizeRoleValue(user.role) || DEFAULT_ROLE;
    const tokens = await issueTokens(user, {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.status(201).json({
      user: {
        ...user,
        role: safeRole,
        permissions: normalizePermissions(user.permissions, safeRole)
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (err) {
    return res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const result = await query(
      'SELECT id, full_name, email, role, permissions, password_hash, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!result.rows.length) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const safeRole = normalizeRoleValue(user.role) || DEFAULT_ROLE;
    if (!user.is_active) {
      return res.status(403).json({ message: 'Account disabled' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

    const tokens = await issueTokens(user, {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.json({
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: safeRole,
        permissions: normalizePermissions(user.permissions, safeRole)
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (err) {
    return res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ message: 'refreshToken is required' });
    }

    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const tokenResult = await query(
      `SELECT id FROM refresh_tokens
       WHERE user_id = $1 AND token_hash = $2
         AND revoked_at IS NULL AND expires_at > now()`
      ,
      [payload.sub, tokenHash]
    );

    if (!tokenResult.rows.length) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const userResult = await query(
      'SELECT id, full_name, email, role, is_active FROM users WHERE id = $1',
      [payload.sub]
    );

    if (!userResult.rows.length || !userResult.rows[0].is_active) {
      return res.status(401).json({ message: 'User not found' });
    }

    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [tokenResult.rows[0].id]);

    const user = userResult.rows[0];
    const tokens = await issueTokens(user, {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (err) {
    return res.status(401).json({ message: 'Refresh failed' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ message: 'refreshToken is required' });
    }

    const tokenHash = hashToken(refreshToken);
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [tokenHash]);
    return res.json({ message: 'Logged out' });
  } catch (err) {
    return res.status(500).json({ message: 'Logout failed' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const result = await query(
    'SELECT id, full_name, email, role, permissions, last_login_at FROM users WHERE id = $1',
    [req.user.id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ message: 'User not found' });
  }

  const safeRole = normalizeRoleValue(result.rows[0].role) || DEFAULT_ROLE;

  return res.json({
    ...result.rows[0],
    role: safeRole,
    permissions: normalizePermissions(result.rows[0].permissions, safeRole)
  });
});

export default router;
