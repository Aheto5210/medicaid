import dotenv from 'dotenv';

dotenv.config();

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;

  return defaultValue;
}

function parseNumber(value, defaultValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getRequiredEnv(name, fallback = null) {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
const isProduction = nodeEnv === 'production';

const config = {
  nodeEnv,
  isProduction,
  port: parseNumber(process.env.PORT, 4000),
  trustProxy: parseBoolean(process.env.TRUST_PROXY, isProduction) ? 1 : false,
  databaseUrl: getRequiredEnv('DATABASE_URL'),
  databaseSsl: parseBoolean(process.env.DATABASE_SSL, isProduction),
  databaseSslRejectUnauthorized: parseBoolean(
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
    false
  ),
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  jwtAccessSecret: getRequiredEnv(
    'JWT_ACCESS_SECRET',
    isProduction ? null : 'dev_access_secret'
  ),
  jwtRefreshSecret: getRequiredEnv(
    'JWT_REFRESH_SECRET',
    isProduction ? null : 'dev_refresh_secret'
  ),
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN?.trim() || '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN?.trim() || '30d'
};

if (config.port < 1 || config.port > 65535) {
  throw new Error(`Invalid PORT value: ${config.port}`);
}

if (config.isProduction && config.corsOrigins.length === 0) {
  throw new Error('CORS_ORIGIN must be set in production.');
}

export default config;
