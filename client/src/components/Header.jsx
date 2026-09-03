import { useEffect, useState } from "react";
import { resolveTheme, toggleTheme } from "../theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(DARK_QUERY).matches
    : false;
}

function storage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function Header({ user, onLogout }) {
  const [theme, setTheme] = useState(() => resolveTheme({ storage: storage(), prefersDark: systemPrefersDark() }));

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (event) => setTheme(resolveTheme({ storage: storage(), prefersDark: event.matches }));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const isDark = theme === "dark";
  const handleToggle = () => setTheme(toggleTheme({ storage: storage(), prefersDark: systemPrefersDark() }));

  return (
    <header className="site-header">
      <a className="brand" href="/">
        <span className="brand-mark">C</span>
        <span>CivicVoice</span>
      </a>
      <div className="header-actions">
        {user && <span className="signed-in">Signed in as {user.name}</span>}
        {user && <button className="text-button" onClick={onLogout}>Sign out</button>}
        <button
          className="theme-toggle"
          type="button"
          onClick={handleToggle}
          aria-pressed={isDark}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          title={isDark ? "Switch to light theme" : "Switch to dark theme"}
        >
          <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
          <span className="theme-toggle-label">{isDark ? "Light" : "Dark"}</span>
        </button>
      </div>
    </header>
  );
}
