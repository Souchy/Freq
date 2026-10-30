export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'freq.theme';

export function getTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.dispatchEvent(new CustomEvent('theme:change', { detail: theme }));
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable; the theme just won't persist.
  }
}
