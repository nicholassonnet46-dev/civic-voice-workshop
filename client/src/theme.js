// Pure theme logic: no DOM access, so it can be unit-tested in the node environment.
// The effective theme is the stored user choice when present, otherwise the OS preference.

export const STORAGE_KEY = "civicvoice.theme";
export const THEMES = ["light", "dark"];

export function readStoredTheme(storage) {
  try {
    const value = storage?.getItem(STORAGE_KEY);
    return THEMES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

export function resolveTheme({ storage, prefersDark }) {
  return readStoredTheme(storage) ?? (prefersDark ? "dark" : "light");
}

export function nextTheme(theme) {
  return theme === "dark" ? "light" : "dark";
}

export function persistTheme(storage, theme) {
  if (!THEMES.includes(theme)) throw new Error(`Unknown theme: ${theme}`);
  try {
    storage?.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage may be unavailable (private mode, quota); the choice still applies for this page view.
  }
  return theme;
}

export function toggleTheme({ storage, prefersDark }) {
  return persistTheme(storage, nextTheme(resolveTheme({ storage, prefersDark })));
}

export function themeAttributes(theme) {
  return { "data-theme": theme };
}
