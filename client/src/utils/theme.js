export const THEME_MODE = Object.freeze({
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
});

export const THEME_STORAGE_KEY = 'medicaid-theme-mode';

const VALID_THEME_MODES = new Set(Object.values(THEME_MODE));

function resolveSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return THEME_MODE.LIGHT;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME_MODE.DARK : THEME_MODE.LIGHT;
}

export function getStoredThemeMode() {
  if (typeof window === 'undefined') return THEME_MODE.SYSTEM;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return VALID_THEME_MODES.has(stored) ? stored : THEME_MODE.SYSTEM;
}

export function resolveTheme(mode) {
  if (mode === THEME_MODE.DARK) return THEME_MODE.DARK;
  if (mode === THEME_MODE.LIGHT) return THEME_MODE.LIGHT;
  return resolveSystemTheme();
}

export function applyTheme(mode) {
  if (typeof document === 'undefined') return THEME_MODE.LIGHT;
  const resolved = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.setAttribute('data-theme-mode', mode);
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function persistThemeMode(mode) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_STORAGE_KEY, mode);
}

export function subscribeToSystemThemeChange(onChange) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (event) => onChange(event.matches ? THEME_MODE.DARK : THEME_MODE.LIGHT);

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }

  mediaQuery.addListener(handler);
  return () => mediaQuery.removeListener(handler);
}

