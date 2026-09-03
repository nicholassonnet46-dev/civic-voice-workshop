import { mkdtemp } from "node:fs/promises";
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

  it("blocks the feedback list without the admin role header", async () => {
    const app = await testApp();
    const response = await request(app).get("/api/feedback");
    expect(response.status).toBe(403);
  });
});
