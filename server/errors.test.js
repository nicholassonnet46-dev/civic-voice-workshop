import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { createDb } from "./lib/db.js";
import { ApiError, ERROR_CODES, createErrorHandler, errorPayload } from "./lib/errors.js";

async function testApp(options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-errors-"));
  const db = await createDb(path.join(directory, "db.json"));
  return { app: await createApp({ db, logError: () => {}, ...options }), db };
}

const CONTRACT = { error: { code: expect.any(String), message: expect.any(String) } };

describe("structured API errors", () => {
  it("returns INVALID_CREDENTIALS for a failed login", async () => {
    const { app } = await testApp();
    const response = await request(app).post("/api/login").send({ nric: "S0000001A", password: "wrong", role: "citizen" });
    expect(response.status).toBe(401);
    expect(response.body).toEqual(CONTRACT);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns VALIDATION_ERROR for bad feedback input", async () => {
    const { app } = await testApp();
    const blank = await request(app).post("/api/feedback").send({ nric: "S0000001A", name: "Aisha Rahman", message: " " });
    expect(blank.status).toBe(400);
    expect(blank.body).toEqual({ error: { code: "VALIDATION_ERROR", message: "Please enter feedback." } });
    const status = await request(app).patch("/api/feedback/fb-seed-1/status").set("x-user-role", "admin").send({ status: "Nope" });
    expect(status.status).toBe(400);
    expect(status.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns VALIDATION_ERROR for a malformed JSON body", async () => {
    const { app } = await testApp();
    const response = await request(app).post("/api/login").set("Content-Type", "application/json").send("{not json");
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: "VALIDATION_ERROR", message: "Request body must be valid JSON." } });
  });

  it("returns FORBIDDEN for admin routes without the admin role", async () => {
    const { app } = await testApp();
    const inbox = await request(app).get("/api/feedback").set("x-user-role", "citizen");
    expect(inbox.status).toBe(403);
    expect(inbox.body).toEqual({ error: { code: "FORBIDDEN", message: "Admin access required." } });
    const patch = await request(app).patch("/api/feedback/fb-seed-1/status").send({ status: "Closed" });
    expect(patch.status).toBe(403);
    expect(patch.body.error.code).toBe("FORBIDDEN");
  });

  it("returns NOT_FOUND for unknown records and unknown routes", async () => {
    const { app } = await testApp();
    const record = await request(app).patch("/api/feedback/missing/status").set("x-user-role", "admin").send({ status: "Closed" });
    expect(record.status).toBe(404);
    expect(record.body).toEqual({ error: { code: "NOT_FOUND", message: "Feedback not found." } });

    for (const [method, route] of [["get", "/api/nope"], ["post", "/api/feedback/extra"], ["get", "/"]]) {
      const response = await request(app)[method](route);
      expect(response.status, `${method} ${route}`).toBe(404);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(response.body).toEqual(CONTRACT);
      expect(response.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns RATE_LIMITED with retryAfterSeconds inside the error object", async () => {
    const { app } = await testApp();
    const wrong = { nric: "S0000001A", password: "wrong", role: "citizen" };
    let response;
    for (let attempt = 0; attempt < 5; attempt += 1) response = await request(app).post("/api/login").send(wrong);
    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toMatch(/^\d+$/);
    expect(response.body).toEqual({ error: { code: "RATE_LIMITED", message: expect.any(String), retryAfterSeconds: expect.any(Number) } });
  });

  it("returns INTERNAL_ERROR without leaking details when a route throws", async () => {
    const { app, db } = await testApp({ logError: vi.fn() });
    db.write = async () => { throw new Error("disk on fire: /secret/path"); };
    const response = await request(app).post("/api/feedback").send({ nric: "S0000001A", name: "Aisha Rahman", message: "Bins please.", category: "Environment" });
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
    expect(JSON.stringify(response.body)).not.toContain("secret");
  });

  it("logs unexpected errors but not expected ones", async () => {
    const logError = vi.fn();
    const { app, db } = await testApp({ logError });
    await request(app).get("/api/feedback");
    expect(logError).not.toHaveBeenCalled();
    db.write = async () => { throw new Error("boom"); };
    await request(app).post("/api/feedback").send({ nric: "S0000001A", name: "Aisha Rahman", message: "Bins please.", category: "Environment" });
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("maps every known code to its default status and UPSTREAM/RATE_LIMITED codes exist", () => {
    expect(new ApiError(ERROR_CODES.RATE_LIMITED, "Slow down.").status).toBe(429);
    expect(new ApiError(ERROR_CODES.UPSTREAM_UNAVAILABLE, "Down.").status).toBe(503);
    expect(new ApiError(ERROR_CODES.FORBIDDEN, "No.", 418).status).toBe(418);
    expect(new ApiError(ERROR_CODES.FORBIDDEN, "No.", { status: 418, hint: "h" }).details).toEqual({ hint: "h" });
    expect(errorPayload("X", "y")).toEqual({ error: { code: "X", message: "y" } });
    expect(errorPayload("X", "y", { retryAfterSeconds: 5 })).toEqual({ error: { code: "X", message: "y", retryAfterSeconds: 5 } });

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    createErrorHandler({ log: () => {} })(Object.assign(new Error("model down"), { name: "OpenAiError" }), {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0].error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});
