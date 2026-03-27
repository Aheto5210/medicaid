import { DEFAULT_ROLE, normalizeRoleValue } from './roles.js';

const ROLE_PERMISSION_PRESETS = Object.freeze({
  admin: Object.freeze({
    overview: Object.freeze({ view: true }),
    generalRegistration: Object.freeze({
      view: true,
      create: true,
      edit: true,
      delete: true,
      import: true,
      export: true
    }),
    nhisRegistration: Object.freeze({
      view: true,
      create: true,
      edit: true,
      delete: true,
      import: true,
      export: true
    }),
    userManagement: Object.freeze({ view: true }),
    settings: Object.freeze({ view: true })
  }),
  staff: Object.freeze({
    overview: Object.freeze({ view: true }),
    generalRegistration: Object.freeze({
      view: true,
      create: true,
      edit: true,
      delete: false,
      import: true,
      export: true
    }),
    nhisRegistration: Object.freeze({
      view: true,
      create: true,
      edit: true,
      delete: false,
      import: true,
      export: true
    }),
    userManagement: Object.freeze({ view: false }),
    settings: Object.freeze({ view: true })
  }),
  volunteer: Object.freeze({
    overview: Object.freeze({ view: true }),
    generalRegistration: Object.freeze({
      view: true,
      create: true,
      edit: false,
      delete: false,
      import: false,
      export: false
    }),
    nhisRegistration: Object.freeze({
      view: true,
      create: true,
      edit: false,
      delete: false,
      import: false,
      export: false
    }),
    userManagement: Object.freeze({ view: false }),
    settings: Object.freeze({ view: true })
  }),
  viewer: Object.freeze({
    overview: Object.freeze({ view: true }),
    generalRegistration: Object.freeze({
      view: true,
      create: false,
      edit: false,
      delete: false,
      import: false,
      export: true
    }),
    nhisRegistration: Object.freeze({
      view: true,
      create: false,
      edit: false,
      delete: false,
      import: false,
      export: true
    }),
    userManagement: Object.freeze({ view: false }),
    settings: Object.freeze({ view: true })
  })
});

function clonePreset(preset) {
  return {
    overview: { ...preset.overview },
    generalRegistration: { ...preset.generalRegistration },
    nhisRegistration: { ...preset.nhisRegistration },
    userManagement: { ...preset.userManagement },
    settings: { ...preset.settings }
  };
}

export function clonePermissionsForRole(role = DEFAULT_ROLE) {
  const safeRole = normalizeRoleValue(role) || DEFAULT_ROLE;
  const preset = ROLE_PERMISSION_PRESETS[safeRole] || ROLE_PERMISSION_PRESETS[DEFAULT_ROLE];
  return clonePreset(preset);
}

export const DEFAULT_PERMISSIONS = Object.freeze(clonePermissionsForRole(DEFAULT_ROLE));
export const ADMIN_DEFAULT_PERMISSIONS = Object.freeze(clonePermissionsForRole('admin'));

export function normalizePermissions(rawPermissions = {}, role = DEFAULT_ROLE) {
  const source = rawPermissions && typeof rawPermissions === 'object' ? rawPermissions : {};
  const normalized = clonePermissionsForRole(role);

  normalized.overview.view = Boolean(source?.overview?.view ?? normalized.overview.view);
  normalized.generalRegistration.view = Boolean(source?.generalRegistration?.view ?? normalized.generalRegistration.view);
  normalized.generalRegistration.create = Boolean(
    source?.generalRegistration?.create ?? normalized.generalRegistration.create
  );
  normalized.generalRegistration.edit = Boolean(
    source?.generalRegistration?.edit ?? normalized.generalRegistration.edit
  );
  normalized.generalRegistration.delete = Boolean(
    source?.generalRegistration?.delete ?? normalized.generalRegistration.delete
  );
  normalized.generalRegistration.import = Boolean(
    source?.generalRegistration?.import ?? normalized.generalRegistration.import
  );
  normalized.generalRegistration.export = Boolean(
    source?.generalRegistration?.export ?? normalized.generalRegistration.export
  );
  normalized.nhisRegistration.view = Boolean(
    source?.nhisRegistration?.view ?? normalized.nhisRegistration.view
  );
  normalized.nhisRegistration.create = Boolean(
    source?.nhisRegistration?.create ?? normalized.nhisRegistration.create
  );
  normalized.nhisRegistration.edit = Boolean(
    source?.nhisRegistration?.edit ?? normalized.nhisRegistration.edit
  );
  normalized.nhisRegistration.delete = Boolean(
    source?.nhisRegistration?.delete ?? normalized.nhisRegistration.delete
  );
  normalized.nhisRegistration.import = Boolean(
    source?.nhisRegistration?.import ?? normalized.nhisRegistration.import
  );
  normalized.nhisRegistration.export = Boolean(
    source?.nhisRegistration?.export ?? normalized.nhisRegistration.export
  );
  normalized.userManagement.view = Boolean(source?.userManagement?.view ?? normalized.userManagement.view);
  normalized.settings.view = true;

  return normalized;
}

export function hasPermission(user, moduleKey, action = 'view') {
  if (!user) return false;
  const permissions = normalizePermissions(user.permissions, user.role);
  return Boolean(permissions?.[moduleKey]?.[action]);
}
