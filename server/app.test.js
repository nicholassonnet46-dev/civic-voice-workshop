import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createDb } from "./lib/db.js";

async function testApp() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-"));
  const db = await createDb(path.join(directory, "db.json"));
  return createApp({ db });
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

  it("never stores demo passwords in plain text", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-"));
    const file = path.join(directory, "db.json");
    const db = await createDb(file);
    const raw = await readFile(file, "utf8");
    expect(raw).not.toContain("citizen123");
    expect(raw).not.toContain("admin123");
    for (const user of JSON.parse(raw).users) {
      expect(user).not.toHaveProperty("password");
      expect(user.passwordHash).toMatch(/^[0-9a-f]{128}$/);
      expect(user.passwordSalt).toMatch(/^[0-9a-f]{32}$/);
    }
    const [citizen, admin] = db.data.users;
    expect(citizen.passwordSalt).not.toBe(admin.passwordSalt);

    const app = await createApp({ db });
    const login = await request(app).post("/api/login").send({ nric: "S0000002B", password: "admin123", role: "admin" });
    expect(login.status).toBe(200);
    expect(login.body.user).toEqual({ nric: "S0000002B", name: "Daniel Tan", role: "admin" });
    const wrong = await request(app).post("/api/login").send({ nric: "S0000002B", password: "admin124", role: "admin" });
    expect(wrong.status).toBe(401);
  });

  it("migrates an existing db.json that still holds plain-text passwords", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-"));
    const file = path.join(directory, "db.json");
    await writeFile(file, JSON.stringify({
      users: [
        { nric: "S0000001A", password: "citizen123", name: "Aisha Rahman", role: "citizen" },
        { nric: "S0000002B", password: "admin123", name: "Daniel Tan", role: "admin" },
      ],
      feedback: [],
    }));
    const db = await createDb(file);
    const raw = await readFile(file, "utf8");
    expect(raw).not.toContain("citizen123");
    expect(JSON.parse(raw).users.every((user) => !("password" in user) && user.passwordHash)).toBe(true);

    const app = await createApp({ db });
    const response = await request(app).post("/api/login").send({ nric: "S0000001A", password: "citizen123", role: "citizen" });
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
