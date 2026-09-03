import { toApiError } from "./apiError.js";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    // Errors carry `.code` (e.g. FORBIDDEN), `.status`, and a human-readable `.message`.
    const error = toApiError(body, response.status);
    const retryAfterHeader = Number(response.headers.get("Retry-After"));
    error.retryAfterSeconds ??= retryAfterHeader > 0 ? retryAfterHeader : null;
    throw error;
  }
  return body;
}

export function login(credentials) {
  return api("/api/login", { method: "POST", body: JSON.stringify(credentials) });
}
export function submitFeedback(feedback) {
  return api("/api/feedback", { method: "POST", body: JSON.stringify(feedback) });
}
export function getFeedback(user) {
  return api("/api/feedback", { headers: { "x-user-role": user.role } });
}
export function updateStatus(user, id, status) {
  return api(`/api/feedback/${encodeURIComponent(id)}/status`, {
    method: "PATCH", headers: { "x-user-role": user.role }, body: JSON.stringify({ status }),
  });
}
export function suggestTriage(user, id) {
  return api(`/api/feedback/${encodeURIComponent(id)}/triage`, { method: "POST", headers: { "x-user-role": user.role } });
}
export function acceptTriage(user, id, { urgency, team }) {
  return api(`/api/feedback/${encodeURIComponent(id)}/triage`, {
    method: "PATCH", headers: { "x-user-role": user.role }, body: JSON.stringify({ urgency, team }),
  });
}
export function dismissTriage(user, id) {
  return api(`/api/feedback/${encodeURIComponent(id)}/triage`, { method: "DELETE", headers: { "x-user-role": user.role } });
}
export function requestSummary(user, id) {
  return api(`/api/feedback/${encodeURIComponent(id)}/summary`, { method: "POST", headers: { "x-user-role": user.role } });
}
