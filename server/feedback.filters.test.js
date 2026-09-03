import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createDb } from "./lib/db.js";
import { FILTER_CATEGORIES, filterFeedback, parseFeedbackFilters } from "./lib/feedback.js";
import { createOpenAiClient } from "./lib/openai.js";

const ADMIN = { "x-user-role": "admin" };

async function seededApp() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-filters-"));
  const db = await createDb(path.join(directory, "db.json"));
  const openai = createOpenAiClient({ apiKey: "", fetch: () => { throw new Error("unexpected fetch"); } });
  const app = await createApp({ db, openai });
  // The seed already holds one legacy "General" / "New" item. Add explicit categories so
  // no request goes through auto-categorisation.
  const items = [
    { name: "Aisha Rahman", nric: "S0000001A", category: "Estate", message: "Lift at block 12 is stuck." },
    { name: "Ben Ong", nric: "S1111111C", category: "Transport", message: "Bus 12 is always late." },
    { name: "Chloe Lim", nric: "S2222222D", category: "Estate", message: "Corridor lights flicker." },
  ];
  const created = [];
  for (const item of items) {
    const response = await request(app).post("/api/feedback").send(item);
    expect(response.status).toBe(201);
    created.push(response.body.feedback);
  }
  // Move the Transport item and one Estate item out of "New".
  await request(app).patch(`/api/feedback/${created[1].id}/status`).set(ADMIN).send({ status: "In review" });
  await request(app).patch(`/api/feedback/${created[2].id}/status`).set(ADMIN).send({ status: "Closed" });
  return { app, created };
}

describe("parseFeedbackFilters", () => {
  it("treats missing or empty parameters as no filter", () => {
    expect(parseFeedbackFilters({})).toEqual({ filters: { category: null, status: null } });
    expect(parseFeedbackFilters({ category: "", status: "" })).toEqual({ filters: { category: null, status: null } });
  });

  it("accepts every current category plus the legacy General value", () => {
    for (const category of FILTER_CATEGORIES) {
      expect(parseFeedbackFilters({ category })).toEqual({ filters: { category, status: null } });
    }
    expect(FILTER_CATEGORIES).toContain("General");
  });

  it("rejects unknown values and repeated parameters", () => {
    expect(parseFeedbackFilters({ category: "Roads" }).error).toMatch(/Category must be one of/);
    expect(parseFeedbackFilters({ status: "Done" }).error).toMatch(/Status must be one of/);
    expect(parseFeedbackFilters({ status: "new" }).error).toMatch(/Status must be one of/);
    expect(parseFeedbackFilters({ category: ["Estate", "Transport"] }).error).toMatch(/Category must be one of/);
  });
});

describe("filterFeedback", () => {
  const items = [
    { id: 1, category: "Estate", status: "New" },
    { id: 2, category: "Estate", status: "Closed" },
    { id: 3, category: "General", status: "New" },
  ];
  it("filters by either field or both", () => {
    expect(filterFeedback(items, { category: "Estate" }).map((i) => i.id)).toEqual([1, 2]);
    expect(filterFeedback(items, { status: "New" }).map((i) => i.id)).toEqual([1, 3]);
    expect(filterFeedback(items, { category: "Estate", status: "New" }).map((i) => i.id)).toEqual([1]);
    expect(filterFeedback(items, {})).toHaveLength(3);
  });
});

describe("GET /api/feedback filters", () => {
  it("returns everything when no filter is given", async () => {
    const { app } = await seededApp();
    const response = await request(app).get("/api/feedback").set(ADMIN);
    expect(response.status).toBe(200);
    expect(response.body.feedback).toHaveLength(4);
  });

  it("filters by category", async () => {
    const { app } = await seededApp();
    const response = await request(app).get("/api/feedback").query({ category: "Estate" }).set(ADMIN);
    expect(response.status).toBe(200);
    expect(response.body.feedback.map((item) => item.category)).toEqual(["Estate", "Estate"]);
  });

  it("filters by the legacy General category", async () => {
    const { app } = await seededApp();
    const response = await request(app).get("/api/feedback").query({ category: "General" }).set(ADMIN);
    expect(response.status).toBe(200);
    expect(response.body.feedback).toHaveLength(1);
    expect(response.body.feedback[0].id).toBe("fb-seed-1");
  });

  it("filters by status", async () => {
    const { app } = await seededApp();
    const response = await request(app).get("/api/feedback").query({ status: "In review" }).set(ADMIN);
    expect(response.status).toBe(200);
    expect(response.body.feedback).toHaveLength(1);
    expect(response.body.feedback[0].category).toBe("Transport");
  });

  it("combines category and status", async () => {
    const { app, created } = await seededApp();
    const response = await request(app).get("/api/feedback").query({ category: "Estate", status: "New" }).set(ADMIN);
    expect(response.status).toBe(200);
    expect(response.body.feedback.map((item) => item.id)).toEqual([created[0].id]);

    const none = await request(app).get("/api/feedback").query({ category: "Transport", status: "Closed" }).set(ADMIN);
    expect(none.status).toBe(200);
    expect(none.body.feedback).toEqual([]);
  });

  it("keeps newest-first ordering inside a filtered result", async () => {
    const { app } = await seededApp();
    const response = await request(app).get("/api/feedback").query({ status: "New" }).set(ADMIN);
    const times = response.body.feedback.map((item) => Date.parse(item.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("rejects invalid values with 400", async () => {
    const { app } = await seededApp();
    const category = await request(app).get("/api/feedback").query({ category: "Roads" }).set(ADMIN);
    expect(category.status).toBe(400);
    expect(category.body.error.code).toBe("VALIDATION_ERROR");
    expect(category.body.error.message).toMatch(/Category must be one of: Estate, Transport, Environment, Other, General\./);
    const status = await request(app).get("/api/feedback").query({ status: "Done" }).set(ADMIN);
    expect(status.status).toBe(400);
    expect(status.body.error.code).toBe("VALIDATION_ERROR");
    expect(status.body.error.message).toMatch(/Status must be one of: New, In review, Closed\./);
    const both = await request(app).get("/api/feedback").query({ category: "Estate", status: "Done" }).set(ADMIN);
    expect(both.status).toBe(400);
  });

  it("still requires the admin role even with filters", async () => {
    const { app } = await seededApp();
    const response = await request(app).get("/api/feedback").query({ category: "Estate" });
    expect(response.status).toBe(403);
  });
});
