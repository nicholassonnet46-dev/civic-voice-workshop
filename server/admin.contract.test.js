import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createDb, dbPath } from "./lib/db.js";

const ADMIN = { nric: "S0000002B", password: "admin123", role: "admin" };
const CITIZEN = { nric: "S0000001A", password: "citizen123", role: "citizen" };

async function isolatedApp() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-contract-"));
  const db = await createDb(path.join(directory, "db.json"));
  return { app: await createApp({ db }) };
}

async function snapshotSharedDb() {
  try {
    const [content, info] = await Promise.all([readFile(dbPath, "utf8"), stat(dbPath)]);
    return { content, mtimeMs: info.mtimeMs };
  } catch {
    return null;
  }
}

describe("Admin API contract", () => {
  let before;
  beforeAll(async () => {
    before = await snapshotSharedDb();
  });
  afterAll(async () => {
    expect(await snapshotSharedDb()).toEqual(before);
  });

  describe("POST /api/login", () => {
    it("returns a token and a public user shape for the admin", async () => {
      const { app } = await isolatedApp();
      const response = await request(app).post("/api/login").send(ADMIN);
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(response.body).toEqual({
        token: expect.any(String),
        user: { nric: ADMIN.nric, name: "Daniel Tan", role: "admin" },
      });
      expect(response.body.user).not.toHaveProperty("password");
    });

    it("rejects the admin account when signing in as a citizen", async () => {
      const { app } = await isolatedApp();
      const response = await request(app).post("/api/login").send({ ...ADMIN, role: "citizen" });
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: { code: "INVALID_CREDENTIALS", message: expect.any(String) } });
    });

    it("rejects a wrong password", async () => {
      const { app } = await isolatedApp();
      const response = await request(app).post("/api/login").send({ ...ADMIN, password: "nope" });
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: { code: "INVALID_CREDENTIALS", message: expect.any(String) } });
    });
  });

  describe("GET /api/feedback", () => {
    it("returns the inbox for the admin role header", async () => {
      const { app } = await isolatedApp();
      const response = await request(app).get("/api/feedback").set("x-user-role", "admin");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ feedback: expect.any(Array) });
      expect(response.body.feedback[0]).toEqual({
        id: expect.any(String),
        nric: expect.any(String),
        name: expect.any(String),
        message: expect.any(String),
        category: expect.any(String),
        status: expect.any(String),
        createdAt: expect.any(String),
      });
    });

    it("forbids a citizen role header", async () => {
      const { app } = await isolatedApp();
      const response = await request(app).get("/api/feedback").set("x-user-role", "citizen");
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: { code: "FORBIDDEN", message: "Admin access required." } });
    });

    it("forbids a missing role header", async () => {
      const { app } = await isolatedApp();
      const response = await request(app).get("/api/feedback");
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: { code: "FORBIDDEN", message: "Admin access required." } });
    });
  });

  describe("PATCH /api/feedback/:id/status", () => {
    it("forbids a citizen from changing status and leaves the record untouched", async () => {
      const { app } = await isolatedApp();
      const response = await request(app).patch("/api/feedback/fb-seed-1/status")
        .set("x-user-role", "citizen").send({ status: "Closed" });
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: { code: "FORBIDDEN", message: "Admin access required." } });
      const inbox = await request(app).get("/api/feedback").set("x-user-role", "admin");
      expect(inbox.body.feedback.find((item) => item.id === "fb-seed-1").status).toBe("New");
    });
  });
});
