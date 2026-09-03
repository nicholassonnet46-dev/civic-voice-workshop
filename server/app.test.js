import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { createDb } from "./lib/db.js";
import { createOpenAiClient } from "./lib/openai.js";

// Tests never spend OpenAI credits: fetch is stubbed and the key defaults to "".
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function completion(content) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
}

async function testApp(options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-"));
  const db = await createDb(path.join(directory, "db.json"));
  const openai = options.openai ?? createOpenAiClient({ apiKey: "", fetch: () => { throw new Error("unexpected fetch"); } });
  return createApp({ db, openai });
}

describe("CivicVoice baseline API", () => {
  it("creates a missing datastore directory on first use", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-"));
    const db = await createDb(path.join(directory, "missing", "data", "db.json"));
    expect(db.data.users).toHaveLength(2);
  });

  it("logs in the seeded citizen", async () => {
    const app = await testApp();
    const response = await request(app).post("/api/login").send({
      nric: "S0000001A", password: "citizen123", role: "citizen",
    });
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe("citizen");
  });

  it("accepts feedback", async () => {
    const app = await testApp();
    const response = await request(app).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "Please add more benches.",
    });
    expect(response.status).toBe(201);
    expect(response.body.feedback.message).toBe("Please add more benches.");
  });

  it("rejects whitespace-only feedback that bypasses the browser", async () => {
    const app = await testApp();
    const response = await request(app).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "   \n\t ",
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Please enter feedback.");
  });

  it("rejects missing and non-string feedback", async () => {
    const app = await testApp();
    const missing = await request(app).post("/api/feedback").send({ nric: "S0000001A", name: "Aisha Rahman" });
    expect(missing.status).toBe(400);
    const numeric = await request(app).post("/api/feedback").send({ nric: "S0000001A", name: "Aisha Rahman", message: 123 });
    expect(numeric.status).toBe(400);
  });

  it("trims useful feedback surrounded by whitespace and stores it", async () => {
    const app = await testApp();
    const response = await request(app).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "  \n Please fix the lights. \n ",
    });
    expect(response.status).toBe(201);
    expect(response.body.feedback.message).toBe("Please fix the lights.");
  });

  it("stores the chosen category and returns it in the admin inbox", async () => {
    const app = await testApp();
    const created = await request(app).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "The bus stop needs a shelter.", category: "Transport",
    });
    expect(created.status).toBe(201);
    expect(created.body.feedback.category).toBe("Transport");

    const inbox = await request(app).get("/api/feedback").set("x-user-role", "admin");
    expect(inbox.status).toBe(200);
    const stored = inbox.body.feedback.find((item) => item.id === created.body.feedback.id);
    expect(stored.category).toBe("Transport");
    const seeded = inbox.body.feedback.find((item) => item.id === "fb-seed-1");
    expect(seeded.category).toBe("General");
  });

  it("rejects an unknown category", async () => {
    const app = await testApp();
    for (const category of ["Housing", "estate", "", 42, null]) {
      const response = await request(app).post("/api/feedback").send({
        nric: "S0000001A", name: "Aisha Rahman", message: "Useful text.", category,
      });
      expect(response.status, `category ${JSON.stringify(category)}`).toBe(400);
      expect(response.body.error).toBe("Please choose a valid category.");
    }
  });

  it("defaults to Other when no category is sent", async () => {
    const app = await testApp();
    const response = await request(app).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "No category given.",
    });
    expect(response.status).toBe(201);
    expect(response.body.feedback.category).toBe("Other");
  });

  it("returns a short human-readable reference that is stored on the record", async () => {
    const app = await testApp();
    const response = await request(app).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "Please add more bins.", category: "Environment",
    });
    expect(response.status).toBe(201);
    const { reference, id } = response.body.feedback;
    expect(reference).toMatch(/^CV-\d{6}$/);
    expect(reference).not.toBe(id);
    expect(reference.length).toBeLessThan(id.length);

    const inbox = await request(app).get("/api/feedback").set("x-user-role", "admin");
    expect(inbox.body.feedback.find((item) => item.id === id).reference).toBe(reference);
  });

  it("gives each submission a different reference", async () => {
    const app = await testApp();
    const references = new Set();
    for (let i = 0; i < 10; i += 1) {
      const response = await request(app).post("/api/feedback").send({
        nric: "S0000001A", name: "Aisha Rahman", message: `Submission ${i}`, category: "Other",
      });
      references.add(response.body.feedback.reference);
    }
    expect(references.size).toBe(10);
  });

  it("returns feedback newest first regardless of stored order", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-"));
    const db = await createDb(path.join(directory, "db.json"));
    db.data.feedback = [
      { id: "older", message: "older", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "newest", message: "newest", createdAt: "2026-03-01T00:00:00.000Z" },
      { id: "middle", message: "middle", createdAt: "2026-02-01T00:00:00.000Z" },
    ];
    await db.write();
    const app = await createApp({ db });
    const response = await request(app).get("/api/feedback").set("x-user-role", "admin");
    expect(response.status).toBe(200);
    expect(response.body.feedback.map((item) => item.id)).toEqual(["newest", "middle", "older"]);
  });

  it("lets an admin update feedback status and persists it", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-"));
    const file = path.join(directory, "db.json");
    const app = await createApp({ db: await createDb(file) });
    const response = await request(app).patch("/api/feedback/fb-seed-1/status")
      .set("x-user-role", "admin").send({ status: "In review" });
    expect(response.status).toBe(200);
    expect(response.body.feedback.status).toBe("In review");
    const persisted = JSON.parse(await readFile(file, "utf8"));
    expect(persisted.feedback.find((item) => item.id === "fb-seed-1").status).toBe("In review");
  });

  it("rejects an invalid status", async () => {
    const app = await testApp();
    const response = await request(app).patch("/api/feedback/fb-seed-1/status")
      .set("x-user-role", "admin").send({ status: "Done" });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/New, In review, Closed/);
  });

  it("forbids status updates without the admin role", async () => {
    const app = await testApp();
    const response = await request(app).patch("/api/feedback/fb-seed-1/status")
      .set("x-user-role", "citizen").send({ status: "Closed" });
    expect(response.status).toBe(403);
  });

  it("returns 404 when updating an unknown feedback id", async () => {
    const app = await testApp();
    const response = await request(app).patch("/api/feedback/nope/status")
      .set("x-user-role", "admin").send({ status: "Closed" });
    expect(response.status).toBe(404);
  });

  it("stores malicious-looking feedback as plain text with only normalization applied", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-"));
    const file = path.join(directory, "db.json");
    const app = await createApp({ db: await createDb(file) });
    const payload = "<img src=x onerror=alert(1)>\u0000  <b>bold</b>";
    const response = await request(app).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: payload,
    });
    expect(response.status).toBe(201);
    expect(response.body.feedback.message).toBe("<img src=x onerror=alert(1)> <b>bold</b>");
    const persisted = JSON.parse(await readFile(file, "utf8"));
    expect(persisted.feedback[0].message).toBe("<img src=x onerror=alert(1)> <b>bold</b>");
    expect(persisted.feedback[0].message).not.toContain("&lt;");
  });

  it("rejects feedback that is empty after normalization", async () => {
    const app = await testApp();
    const response = await request(app).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "  \u0000\u200B \n ",
    });
    expect(response.status).toBe(400);
  });

  it("blocks the feedback list without the admin role header", async () => {
    const app = await testApp();
    const response = await request(app).get("/api/feedback");
    expect(response.status).toBe(403);
  });
});

describe("CV-029 auto-categorize feedback", () => {
  it("keeps a specific citizen category and marks the source as citizen", async () => {
    const fetchMock = vi.fn();
    const app = await testApp({ openai: createOpenAiClient({ apiKey: "test-key", fetch: fetchMock }) });
    const response = await request(app).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "The lift is broken again.", category: "Transport",
    });
    expect(response.status).toBe(201);
    expect(response.body.feedback.category).toBe("Transport");
    expect(response.body.feedback.categorySource).toBe("citizen");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks the model when the citizen leaves the category as Other and stores the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion('{"category":"Estate"}'));
    const app = await testApp({ openai: createOpenAiClient({ apiKey: "test-key", fetch: fetchMock }) });
    const created = await request(app).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "Something is wrong on level 7 of my building.", category: "Other",
    });
    expect(created.status).toBe(201);
    expect(created.body.feedback.category).toBe("Estate");
    expect(created.body.feedback.categorySource).toBe("ai");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).response_format.type).toBe("json_schema");

    const inbox = await request(app).get("/api/feedback").set("x-user-role", "admin");
    const stored = inbox.body.feedback.find((item) => item.id === created.body.feedback.id);
    expect(stored.category).toBe("Estate");
    expect(stored.categorySource).toBe("ai");
  });

  it("uses the model when the category is omitted, via the stubbed global fetch and env key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "env-test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion('{"category":"Environment"}')));
    const app = await testApp({ openai: createOpenAiClient() });
    const response = await request(app).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "It has been unpleasant near my home lately.",
    });
    expect(response.status).toBe(201);
    expect(response.body.feedback.category).toBe("Environment");
    expect(response.body.feedback.categorySource).toBe("ai");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to the keyword rule when no key is configured", async () => {
    const app = await testApp();
    const response = await request(app).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "Bus 12 skips my stop every morning.", category: "Other",
    });
    expect(response.status).toBe(201);
    expect(response.body.feedback.category).toBe("Transport");
    expect(response.body.feedback.categorySource).toBe("fallback");
  });

  it("falls back when the upstream call fails or returns something outside the allowed list", async () => {
    const failing = await testApp({ openai: createOpenAiClient({ apiKey: "k", fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }) }) });
    const failed = await request(failing).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "Mosquitoes breeding in the blocked drain.", category: "Other",
    });
    expect(failed.status).toBe(201);
    expect(failed.body.feedback).toMatchObject({ category: "Environment", categorySource: "fallback" });

    const malformed = await testApp({ openai: createOpenAiClient({ apiKey: "k", fetch: async () => completion('{"category":"Housing"}') }) });
    const rejected = await request(malformed).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "The lift smells.", category: "Other",
    });
    expect(rejected.status).toBe(201);
    expect(rejected.body.feedback).toMatchObject({ category: "Estate", categorySource: "fallback" });
  });

  it("never returns the API key to the browser", async () => {
    vi.stubEnv("OPENAI_API_KEY", "super-secret-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion('{"category":"Other"}')));
    const app = await testApp({ openai: createOpenAiClient() });
    const created = await request(app).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "General thanks.", category: "Other",
    });
    const inbox = await request(app).get("/api/feedback").set("x-user-role", "admin");
    expect(JSON.stringify(created.body)).not.toContain("super-secret-key");
    expect(JSON.stringify(inbox.body)).not.toContain("super-secret-key");
  });
});
