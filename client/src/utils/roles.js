export const DEFAULT_ROLE = 'staff';

export const ROLE_OPTIONS = Object.freeze([
  { value: 'admin', label: 'admin' },
  { value: 'staff', label: 'church worker' },
  { value: 'volunteer', label: 'volunteer' },
  { value: 'viewer', label: 'Pastor' }
]);

const ROLE_LABELS = Object.freeze(
  ROLE_OPTIONS.reduce((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {})
);

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

export function getRoleLabel(rawRole) {
  const role = normalizeRoleValue(rawRole) || DEFAULT_ROLE;
  return ROLE_LABELS[role] || role;
}
