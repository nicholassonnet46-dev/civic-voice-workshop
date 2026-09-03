// In-memory limiter for failed sign-ins, keyed per workshop ID.
// Injectable clock and explicit reset() keep tests isolated; createApp accepts an instance
// through options.loginLimiter so each test can own its own limiter.

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export function limiterKey(nric) {
  return typeof nric === "string" && nric.trim() ? nric.trim().toUpperCase() : "unknown";
}

export function createLoginLimiter({ maxFailures = LOGIN_MAX_FAILURES, windowMs = LOGIN_WINDOW_MS, now = Date.now } = {}) {
  const entries = new Map();

  function entryFor(key) {
    const entry = entries.get(key);
    if (!entry) return null;
    const current = now();
    if (entry.blockedUntil && entry.blockedUntil <= current) {
      entries.delete(key);
      return null;
    }
    if (!entry.blockedUntil && current - entry.firstFailureAt >= windowMs) {
      entries.delete(key);
      return null;
    }
    return entry;
  }

  return {
    maxFailures,
    windowMs,
    // { allowed: true } or { allowed: false, retryAfterSeconds }
    check(nric) {
      const entry = entryFor(limiterKey(nric));
      if (!entry?.blockedUntil) return { allowed: true, failures: entry?.failures ?? 0 };
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.blockedUntil - now()) / 1000));
      return { allowed: false, failures: entry.failures, retryAfterSeconds };
    },
    recordFailure(nric) {
      const key = limiterKey(nric);
      const current = now();
      const entry = entryFor(key) ?? { failures: 0, firstFailureAt: current, blockedUntil: null };
      entry.failures += 1;
      if (entry.failures >= maxFailures) entry.blockedUntil = current + windowMs;
      entries.set(key, entry);
      return this.check(nric);
    },
    recordSuccess(nric) {
      entries.delete(limiterKey(nric));
    },
    reset() {
      entries.clear();
    },
    size() {
      return entries.size;
    },
  };
}
