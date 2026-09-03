import { describe, expect, it } from "vitest";
import { ApiRequestError, FALLBACK_MESSAGE, toApiError } from "./apiError.js";

describe("toApiError", () => {
  it("exposes the structured code and message", () => {
    const error = toApiError({ error: { code: "FORBIDDEN", message: "Admin access required." } }, 403);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.message).toBe("Admin access required.");
    expect(error.code).toBe("FORBIDDEN");
    expect(error.status).toBe(403);
  });

  it("carries retryAfterSeconds for RATE_LIMITED errors", () => {
    const error = toApiError({ error: { code: "RATE_LIMITED", message: "Slow down.", retryAfterSeconds: 900 } }, 429);
    expect(error.retryAfterSeconds).toBe(900);
    expect(error.status).toBe(429);
    expect(toApiError({ error: "Old.", retryAfterSeconds: 30 }, 429).retryAfterSeconds).toBe(30);
    expect(toApiError({ error: { code: "FORBIDDEN", message: "No." } }, 403)).not.toHaveProperty("retryAfterSeconds");
  });

  it("tolerates the legacy string shape and empty bodies", () => {
    expect(toApiError({ error: "Old style." }, 400).message).toBe("Old style.");
    expect(toApiError({ error: "Old style." }, 400).code).toBe("UNKNOWN_ERROR");
    expect(toApiError(null, 502).message).toBe(FALLBACK_MESSAGE);
    expect(toApiError({ error: { code: "X" } }, 500).message).toBe(FALLBACK_MESSAGE);
    expect(toApiError({ error: { message: "No code." } }, 500).code).toBe("UNKNOWN_ERROR");
  });
});
