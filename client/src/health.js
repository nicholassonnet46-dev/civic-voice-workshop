// Pure helpers for the login-screen API health indicator.
// The component owns timers and rendering; everything here is testable in node.

export const HEALTH_POLL_INTERVAL_MS = 5000;
export const HEALTH_TIMEOUT_MS = 2500;

export const HEALTH_STATUS = Object.freeze({
  CHECKING: "checking",
  ONLINE: "online",
  OFFLINE: "offline",
});

export function initialHealthState() {
  return { status: HEALTH_STATUS.CHECKING, failures: 0, lastCheckedAt: null, lastOnlineAt: null };
}

export function isHealthyBody(body) {
  return Boolean(body) && typeof body === "object" && body.ok === true;
}

// State transitions: any success is online; any failure is offline.
// "checking" only exists before the first result so the UI does not flash red on load.
export function reduceHealth(state, event) {
  const at = event.at ?? Date.now();
  if (event.type === "success") {
    return { status: HEALTH_STATUS.ONLINE, failures: 0, lastCheckedAt: at, lastOnlineAt: at };
  }
  if (event.type === "failure") {
    return { ...state, status: HEALTH_STATUS.OFFLINE, failures: state.failures + 1, lastCheckedAt: at };
  }
  return state;
}

export function describeHealth(state) {
  switch (state.status) {
    case HEALTH_STATUS.ONLINE:
      return "Local API reachable";
    case HEALTH_STATUS.OFFLINE:
      return "Local API unreachable. Retrying automatically…";
    default:
      return "Checking local API…";
  }
}

// Performs one health probe with a hard timeout and never throws: it resolves to an event
// that reduceHealth understands, so the caller can stay a tiny setInterval loop.
export async function checkHealth({ url, fetchImpl = globalThis.fetch, timeoutMs = HEALTH_TIMEOUT_MS, now = Date.now } = {}) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(url, { signal: controller?.signal, cache: "no-store" });
    if (!response.ok) return { type: "failure", at: now(), reason: `HTTP ${response.status}` };
    const body = await response.json();
    if (!isHealthyBody(body)) return { type: "failure", at: now(), reason: "unexpected body" };
    return { type: "success", at: now() };
  } catch (error) {
    const reason = error?.name === "AbortError" ? "timeout" : (error?.message ?? "network error");
    return { type: "failure", at: now(), reason };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
