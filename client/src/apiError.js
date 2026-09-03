// Turns an API error response into an Error the pages can show.
// The server contract is `{ error: { code, message } }`; older or non-JSON
// responses are tolerated so the UI never shows "undefined".

export const FALLBACK_MESSAGE = "Something went wrong.";

export class ApiRequestError extends Error {
  constructor(message, { code = "UNKNOWN_ERROR", status } = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
  }
}

function retryDetails(source) {
  const seconds = Number(source?.retryAfterSeconds);
  return Number.isFinite(seconds) && seconds > 0 ? { retryAfterSeconds: seconds } : {};
}

export function toApiError(body, status) {
  const error = body?.error;
  if (error && typeof error === "object") {
    const message = typeof error.message === "string" && error.message.trim() ? error.message : FALLBACK_MESSAGE;
    const code = typeof error.code === "string" && error.code ? error.code : "UNKNOWN_ERROR";
    return Object.assign(new ApiRequestError(message, { code, status }), retryDetails(error));
  }
  if (typeof error === "string" && error.trim()) {
    return Object.assign(new ApiRequestError(error, { status }), retryDetails(body));
  }
  return new ApiRequestError(FALLBACK_MESSAGE, { status });
}
