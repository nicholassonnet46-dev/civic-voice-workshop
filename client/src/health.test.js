import { describe, expect, it } from "vitest";
import {
  HEALTH_STATUS,
  HEALTH_TIMEOUT_MS,
  checkHealth,
  describeHealth,
  initialHealthState,
  isHealthyBody,
  reduceHealth,
} from "./health.js";

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe("health state transitions", () => {
  it("starts in the checking state", () => {
    expect(initialHealthState().status).toBe(HEALTH_STATUS.CHECKING);
    expect(describeHealth(initialHealthState())).toMatch(/checking/i);
  });

  it("goes online on success and offline on failure", () => {
    const online = reduceHealth(initialHealthState(), { type: "success", at: 10 });
    expect(online.status).toBe(HEALTH_STATUS.ONLINE);
    expect(online.lastOnlineAt).toBe(10);
    expect(describeHealth(online)).toMatch(/reachable/i);

    const offline = reduceHealth(online, { type: "failure", at: 20 });
    expect(offline.status).toBe(HEALTH_STATUS.OFFLINE);
    expect(offline.failures).toBe(1);
    expect(offline.lastCheckedAt).toBe(20);
    expect(offline.lastOnlineAt).toBe(10);
    expect(describeHealth(offline)).toMatch(/unreachable/i);
  });

  it("recovers to online after repeated failures and resets the failure count", () => {
    let state = initialHealthState();
    state = reduceHealth(state, { type: "failure", at: 1 });
    state = reduceHealth(state, { type: "failure", at: 2 });
    expect(state.failures).toBe(2);
    state = reduceHealth(state, { type: "success", at: 3 });
    expect(state.status).toBe(HEALTH_STATUS.ONLINE);
    expect(state.failures).toBe(0);
  });

  it("ignores unknown events", () => {
    const state = initialHealthState();
    expect(reduceHealth(state, { type: "noise" })).toBe(state);
  });

  it("only treats { ok: true } bodies as healthy", () => {
    expect(isHealthyBody({ ok: true, service: "civic-voice-api" })).toBe(true);
    expect(isHealthyBody({ ok: false })).toBe(false);
    expect(isHealthyBody(null)).toBe(false);
    expect(isHealthyBody("ok")).toBe(false);
  });
});

describe("checkHealth probe", () => {
  it("reports success for a healthy response", async () => {
    const calls = [];
    const fetchImpl = async (url, options) => { calls.push({ url, options }); return jsonResponse({ ok: true }); };
    const event = await checkHealth({ url: "http://api.test/api/health", fetchImpl, now: () => 42 });
    expect(event).toEqual({ type: "success", at: 42 });
    expect(calls[0].url).toBe("http://api.test/api/health");
    expect(calls[0].options.signal).toBeDefined();
  });

  it("reports failure for a non-2xx response", async () => {
    const event = await checkHealth({ url: "x", fetchImpl: async () => jsonResponse({ ok: true }, 503), now: () => 1 });
    expect(event).toEqual({ type: "failure", at: 1, reason: "HTTP 503" });
  });

  it("reports failure for an unhealthy body", async () => {
    const event = await checkHealth({ url: "x", fetchImpl: async () => jsonResponse({ ok: false }), now: () => 1 });
    expect(event.type).toBe("failure");
    expect(event.reason).toBe("unexpected body");
  });

  it("reports failure instead of throwing on network errors", async () => {
    const fetchImpl = async () => { throw new TypeError("Failed to fetch"); };
    const event = await checkHealth({ url: "x", fetchImpl, now: () => 1 });
    expect(event).toEqual({ type: "failure", at: 1, reason: "Failed to fetch" });
  });

  it("aborts a hanging request after the timeout", async () => {
    const fetchImpl = (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    const started = Date.now();
    const event = await checkHealth({ url: "x", fetchImpl, timeoutMs: 20, now: () => 7 });
    expect(event).toEqual({ type: "failure", at: 7, reason: "timeout" });
    expect(Date.now() - started).toBeLessThan(HEALTH_TIMEOUT_MS);
  });
});
