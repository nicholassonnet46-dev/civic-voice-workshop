export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error ?? "Something went wrong.");
    error.status = response.status;
    const retryAfterHeader = Number(response.headers.get("Retry-After"));
    error.retryAfterSeconds = body.retryAfterSeconds ?? (retryAfterHeader > 0 ? retryAfterHeader : null);
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
// Asks the server to read a feedback record aloud. Resolves with an audio Blob;
// rejects with the server's JSON error message when audio is unavailable.
export async function fetchFeedbackAudio(id) {
  const response = await fetch(`${API_URL}/api/feedback/${encodeURIComponent(id)}/audio`, { method: "POST" });
  if (!response.ok) {
    let message = "Read aloud is unavailable right now.";
    try {
      message = (await response.json()).error ?? message;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  return response.blob();
}
