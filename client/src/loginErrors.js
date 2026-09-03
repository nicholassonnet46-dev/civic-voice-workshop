// Turns a failed login request into the message shown under the sign-in form.
// A 429 gets a specific, actionable message with the wait time; anything else keeps the API text.

export const RATE_LIMIT_STATUS = 429;

export function formatRetryWait(retryAfterSeconds) {
  const seconds = Number(retryAfterSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return "a few minutes";
  if (seconds < 60) return `${Math.ceil(seconds)} second${Math.ceil(seconds) === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function describeLoginError(error) {
  if (error?.status === RATE_LIMIT_STATUS) {
    return `Too many failed sign-in attempts. Please wait ${formatRetryWait(error.retryAfterSeconds)} before trying again.`;
  }
  return error?.message || "Something went wrong.";
}
