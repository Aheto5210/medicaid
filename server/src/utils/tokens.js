import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const accessSecret = process.env.JWT_ACCESS_SECRET || 'dev_access_secret';
const refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret';
const accessExpiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const refreshExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    accessSecret,
    { expiresIn: accessExpiresIn }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id },
    refreshSecret,
    { expiresIn: refreshExpiresIn }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, accessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, refreshSecret);
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
