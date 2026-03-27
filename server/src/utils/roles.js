export const DEFAULT_ROLE = 'staff';

export const ROLE_VALUES = Object.freeze(['admin', 'staff', 'volunteer', 'viewer']);

const ROLE_ALIASES = Object.freeze({
  admin: 'admin',
  staff: 'staff',
  'church worker': 'staff',
  church_worker: 'staff',
  churchworker: 'staff',
  volunteer: 'volunteer',
  viewer: 'viewer',
  pastor: 'viewer'
});

export function normalizeRoleValue(rawRole) {
  const key = String(rawRole || '').trim().toLowerCase();
  if (!key) return null;
  return ROLE_ALIASES[key] || null;
}
