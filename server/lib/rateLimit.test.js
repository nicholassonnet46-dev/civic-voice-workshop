import { describe, expect, it } from "vitest";
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS, createLoginLimiter, limiterKey } from "./rateLimit.js";

function clock(start = 1_000_000) {
  let current = start;
  return { now: () => current, advance: (ms) => { current += ms; } };
}

describe("login limiter", () => {
  it("defaults to five failures in a fifteen minute window", () => {
    expect(LOGIN_MAX_FAILURES).toBe(5);
    expect(LOGIN_WINDOW_MS).toBe(15 * 60 * 1000);
  });

  it("allows attempts until the failure limit, then blocks with a retry-after", () => {
    const { now } = clock();
    const limiter = createLoginLimiter({ maxFailures: 3, windowMs: 60_000, now });
    expect(limiter.check("S0000001A").allowed).toBe(true);
    limiter.recordFailure("S0000001A");
    limiter.recordFailure("S0000001A");
    expect(limiter.check("S0000001A")).toEqual({ allowed: true, failures: 2 });
    const blocked = limiter.recordFailure("S0000001A");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("unblocks once the window passes", () => {
    const time = clock();
    const limiter = createLoginLimiter({ maxFailures: 2, windowMs: 10_000, now: time.now });
    limiter.recordFailure("S0000001A");
    limiter.recordFailure("S0000001A");
    expect(limiter.check("S0000001A").allowed).toBe(false);
    time.advance(4_000);
    expect(limiter.check("S0000001A").retryAfterSeconds).toBe(6);
    time.advance(6_000);
    expect(limiter.check("S0000001A")).toEqual({ allowed: true, failures: 0 });
  });

  it("forgets old failures that never reached the limit", () => {
    const time = clock();
    const limiter = createLoginLimiter({ maxFailures: 3, windowMs: 10_000, now: time.now });
    limiter.recordFailure("S0000001A");
    limiter.recordFailure("S0000001A");
    time.advance(10_000);
    expect(limiter.check("S0000001A").failures).toBe(0);
    expect(limiter.recordFailure("S0000001A").allowed).toBe(true);
  });

  it("clears the counter on success", () => {
    const limiter = createLoginLimiter({ maxFailures: 3, windowMs: 60_000, now: clock().now });
    limiter.recordFailure("S0000001A");
    limiter.recordFailure("S0000001A");
    limiter.recordSuccess("S0000001A");
    expect(limiter.check("S0000001A").failures).toBe(0);
    expect(limiter.size()).toBe(0);
  });

  it("keys per workshop ID, case-insensitively, and groups missing IDs", () => {
    expect(limiterKey(" s0000001a ")).toBe("S0000001A");
    expect(limiterKey("")).toBe("unknown");
    expect(limiterKey(undefined)).toBe("unknown");
    expect(limiterKey(42)).toBe("unknown");
    const limiter = createLoginLimiter({ maxFailures: 2, windowMs: 60_000, now: clock().now });
    limiter.recordFailure("S0000001A");
    limiter.recordFailure("s0000001a");
    expect(limiter.check("S0000001A").allowed).toBe(false);
    expect(limiter.check("S0000002B").allowed).toBe(true);
  });

  it("reset() clears everything", () => {
    const limiter = createLoginLimiter({ maxFailures: 1, windowMs: 60_000, now: clock().now });
    limiter.recordFailure("S0000001A");
    expect(limiter.check("S0000001A").allowed).toBe(false);
    limiter.reset();
    expect(limiter.check("S0000001A").allowed).toBe(true);
  });
});
