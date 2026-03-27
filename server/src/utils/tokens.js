import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    config.jwtAccessSecret,
    { expiresIn: config.accessTokenExpiresIn }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id },
    config.jwtRefreshSecret,
    { expiresIn: config.refreshTokenExpiresIn }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtAccessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwtRefreshSecret);
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
