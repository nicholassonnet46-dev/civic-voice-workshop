import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import { isValidCategory } from "./lib/categories.js";
import { categorizeFeedback } from "./lib/categorize.js";
import { createDb } from "./lib/db.js";
import { createOpenAiClient } from "./lib/openai.js";
import { createLoginLimiter } from "./lib/rateLimit.js";
import { generateReference } from "./lib/reference.js";
import { FEEDBACK_STATUSES, sortNewestFirst } from "./lib/feedback.js";
import { normalizeFeedbackText } from "./lib/sanitize.js";
import { verifyPassword } from "./lib/passwords.js";
import { isValidTeam, isValidUrgency, suggestTriage, TEAMS, URGENCY_LEVELS } from "./lib/triage.js";

export async function createApp(options = {}) {
  const db = options.db ?? (await createDb());
  // Server-side only: the OpenAI key comes from process.env and never reaches the browser.
  const openai = options.openai ?? createOpenAiClient();
  // Injectable so tests own an isolated limiter; the default is per-process, in memory.
  const loginLimiter = options.loginLimiter ?? createLoginLimiter();
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "civic-voice-api" });
  });

  function tooManyAttempts(res, retryAfterSeconds) {
    res.set("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      error: `Too many failed sign-in attempts. Try again in ${retryAfterSeconds} seconds.`,
      retryAfterSeconds,
    });
  }

  app.post("/api/login", (req, res) => {
    const { nric, password, role } = req.body ?? {};
    const limit = loginLimiter.check(nric);
    if (!limit.allowed) return tooManyAttempts(res, limit.retryAfterSeconds);

    const candidate = db.data.users.find((entry) => entry.nric === nric && entry.role === role);
    const user = candidate && verifyPassword(password, candidate) ? candidate : null;
    if (!user) {
      const after = loginLimiter.recordFailure(nric);
      if (!after.allowed) return tooManyAttempts(res, after.retryAfterSeconds);
      return res.status(401).json({ error: "Invalid NRIC, password, or sign-in mode." });
    }
    loginLimiter.recordSuccess(nric);

    // Workshop baseline only: this is deliberately not a production session.
    const token = Buffer.from(`${user.nric}:${user.role}`).toString("base64");
    return res.json({ token, user: { nric: user.nric, name: user.name, role: user.role } });
  });

  app.get("/api/feedback", (req, res) => {
    if (req.header("x-user-role") !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    return res.json({ feedback: sortNewestFirst(db.data.feedback) });
  });

  app.post("/api/feedback", async (req, res) => {
    const { nric, name } = req.body ?? {};
    const message = normalizeFeedbackText(req.body?.message);
    if (!message) return res.status(400).json({ error: "Please enter feedback." });
    const requested = req.body?.category === undefined ? "Other" : req.body.category;
    if (!isValidCategory(requested)) {
      return res.status(400).json({ error: "Please choose a valid category." });
    }
    // A specific citizen choice is kept. "Other" (or no choice) is auto-categorized:
    // by the model when a key is configured, otherwise by a deterministic keyword rule.
    const { category, categorySource } = requested === "Other"
      ? await categorizeFeedback(message, openai)
      : { category: requested, categorySource: "citizen" };
    const feedback = {
      id: crypto.randomUUID(), reference: generateReference(db.data.feedback),
      nric, name, message, category, categorySource, status: "New",
      createdAt: new Date().toISOString(),
    };
    db.data.feedback.unshift(feedback);
    await db.write();
    return res.status(201).json({ feedback });
  });

  app.patch("/api/feedback/:id/status", async (req, res) => {
    if (req.header("x-user-role") !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    const { status } = req.body ?? {};
    if (!FEEDBACK_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${FEEDBACK_STATUSES.join(", ")}.` });
    }
    const feedback = db.data.feedback.find((item) => item.id === req.params.id);
    if (!feedback) return res.status(404).json({ error: "Feedback not found." });
    feedback.status = status;
    await db.write();
    return res.json({ feedback });
  });

  // CV-033: AI-suggested urgency and routing. Suggestions are stored separately
  // from the record's own fields and never change `status`.
  app.post("/api/feedback/:id/triage", async (req, res) => {
    if (req.header("x-user-role") !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    const feedback = db.data.feedback.find((item) => item.id === req.params.id);
    if (!feedback) return res.status(404).json({ error: "Feedback not found." });
    let suggestion;
    try {
      suggestion = await suggestTriage(feedback, openai);
    } catch (error) {
      if (error?.kind === "not_configured") {
        return res.status(503).json({ error: "AI triage is not configured on this server." });
      }
      if (error?.kind === "malformed") {
        return res.status(502).json({ error: "The triage suggestion could not be understood. Please try again." });
      }
      return res.status(502).json({ error: "The triage service is unavailable. Please try again later." });
    }
    feedback.suggestion = { ...suggestion, createdAt: new Date().toISOString() };
    await db.write();
    return res.json({ feedback });
  });

  app.patch("/api/feedback/:id/triage", async (req, res) => {
    if (req.header("x-user-role") !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    const { urgency, team } = req.body ?? {};
    if (!isValidUrgency(urgency)) {
      return res.status(400).json({ error: `Urgency must be one of: ${URGENCY_LEVELS.join(", ")}.` });
    }
    if (!isValidTeam(team)) {
      return res.status(400).json({ error: `Team must be one of: ${TEAMS.join(", ")}.` });
    }
    const feedback = db.data.feedback.find((item) => item.id === req.params.id);
    if (!feedback) return res.status(404).json({ error: "Feedback not found." });
    feedback.urgency = urgency;
    feedback.team = team;
    feedback.triagedAt = new Date().toISOString();
    delete feedback.suggestion;
    await db.write();
    return res.json({ feedback });
  });

  app.delete("/api/feedback/:id/triage", async (req, res) => {
    if (req.header("x-user-role") !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    const feedback = db.data.feedback.find((item) => item.id === req.params.id);
    if (!feedback) return res.status(404).json({ error: "Feedback not found." });
    delete feedback.suggestion;
    await db.write();
    return res.json({ feedback });
  });

  return app;
}
