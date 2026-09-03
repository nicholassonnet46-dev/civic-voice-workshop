// Structured API errors. Every non-2xx response from the API carries
// `{ error: { code, message } }` so clients can branch on `code` and show
// `message` to people. Routes throw (or `next()`) an ApiError; the handlers
// below turn anything else into INTERNAL_ERROR without leaking internals.

export const ERROR_CODES = Object.freeze({
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});

const DEFAULT_STATUS = {
  INVALID_CREDENTIALS: 401,
  VALIDATION_ERROR: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

// `details` are extra machine-readable fields merged into the error object
// (for example `retryAfterSeconds` on RATE_LIMITED). A number is accepted as
// a status override for convenience.
export class ApiError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    const { status, ...rest } = typeof details === "number" ? { status: details } : details;
    this.status = status ?? DEFAULT_STATUS[code] ?? 500;
    this.details = rest;
  }
}

export function errorPayload(code, message, details = {}) {
  return { error: { code, message, ...details } };
}

// Wraps an async route so a rejected promise reaches the error middleware
// (Express 4 does not do this on its own).
export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function notFoundHandler(req, _res, next) {
  next(new ApiError(ERROR_CODES.NOT_FOUND, `No route for ${req.method} ${req.path}.`));
}

// Maps any thrown value to the structured payload. `log` is injectable so
// tests stay quiet; unexpected errors are logged, expected ones are not.
export function createErrorHandler({ log = console.error } = {}) {
  // eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature.
  return function errorHandler(error, _req, res, _next) {
    if (error instanceof ApiError) {
      return res.status(error.status).json(errorPayload(error.code, error.message, error.details));
    }
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json(errorPayload(ERROR_CODES.VALIDATION_ERROR, "Request body must be valid JSON."));
    }
    if (error?.type === "entity.too.large") {
      return res.status(413).json(errorPayload(ERROR_CODES.VALIDATION_ERROR, "Request body is too large."));
    }
    if (error?.name === "OpenAiError") {
      return res.status(503).json(errorPayload(ERROR_CODES.UPSTREAM_UNAVAILABLE, "An upstream service is unavailable. Please try again."));
    }
    log(error);
    return res.status(500).json(errorPayload(ERROR_CODES.INTERNAL_ERROR, "Something went wrong. Please try again."));
  };
}
