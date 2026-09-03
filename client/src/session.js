export const SESSION_KEY = "civicvoice.session";

const ROLES = new Set(["citizen", "admin"]);

export function isValidSession(value) {
  if (!value || typeof value !== "object") return false;
  if (typeof value.token !== "string" || !value.token) return false;
  const user = value.user;
  if (!user || typeof user !== "object") return false;
  return (
    typeof user.nric === "string" && user.nric.length > 0 &&
    typeof user.name === "string" &&
    ROLES.has(user.role)
  );
}

export function loadSession(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidSession(parsed)) {
      storage.removeItem(SESSION_KEY);
      return null;
    }
    return { token: parsed.token, user: { nric: parsed.user.nric, name: parsed.user.name, role: parsed.user.role } };
  } catch {
    return null;
  }
}

export function saveSession(storage, session) {
  if (!storage || !isValidSession(session)) return false;
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function clearSession(storage) {
  if (!storage) return;
  try {
    storage.removeItem(SESSION_KEY);
  } catch {
    // Storage may be unavailable (private mode, disabled); nothing to clear.
  }
}
