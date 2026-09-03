import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { createDb } from "./lib/db.js";
import { createOpenAiClient } from "./lib/openai.js";

const MP3_BYTES = Uint8Array.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0xff, 0xfb]);

function audioResponse(bytes = MP3_BYTES, { ok = true, status = 200 } = {}) {
  return { ok, status, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}

async function testApp({ fetch: fetchMock = vi.fn(), apiKey = "test-key" } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-audio-"));
  const db = await createDb(path.join(directory, "db.json"));
  const openai = createOpenAiClient({ fetch: fetchMock, apiKey });
  const app = await createApp({ db, openai });
  return { app, db, fetchMock };
}

async function submit(app, message = "The lift at block 12 has been broken for a week.") {
  const response = await request(app).post("/api/feedback").send({
    nric: "S0000001A", name: "Aisha Rahman", category: "Estate", message,
  });
  expect(response.status).toBe(201);
  return response.body.feedback;
}

describe("POST /api/feedback/:id/audio", () => {
  it("returns mp3 audio for saved feedback using the OpenAI speech API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(audioResponse());
    const { app } = await testApp({ fetch: fetchMock });
    const feedback = await submit(app);

    const response = await request(app).post(`/api/feedback/${feedback.id}/audio`).buffer().parse((res, done) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => done(null, Buffer.concat(chunks)));
    });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^audio\/mpeg/);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect([...response.body]).toEqual([...MP3_BYTES]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body)).toEqual({
      model: "gpt-4o-mini-tts", voice: "alloy", response_format: "mp3", input: feedback.message,
    });
  });

  it("returns 503 with a clear error when no API key is configured and does not call OpenAI", async () => {
    const { app, fetchMock } = await testApp({ apiKey: "" });
    const feedback = await submit(app);

    const response = await request(app).post(`/api/feedback/${feedback.id}/audio`);

    expect(response.status).toBe(503);
    expect(response.headers["content-type"]).toMatch(/json/);
    expect(response.body.error).toMatch(/no OpenAI API key/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 with a JSON error when the upstream call fails", async () => {
    const { app } = await testApp({ fetch: vi.fn().mockResolvedValue(audioResponse(MP3_BYTES, { ok: false, status: 500 })) });
    const feedback = await submit(app);
    const upstream = await request(app).post(`/api/feedback/${feedback.id}/audio`);
    expect(upstream.status).toBe(503);
    expect(upstream.body.error).toMatch(/unavailable/i);

    const { app: networkApp } = await testApp({ fetch: vi.fn().mockRejectedValue(new Error("socket hang up")) });
    const other = await submit(networkApp);
    const network = await request(networkApp).post(`/api/feedback/${other.id}/audio`);
    expect(network.status).toBe(503);
    expect(network.body.error).toMatch(/unavailable/i);
  });

  it("returns 400 and never synthesizes blank feedback", async () => {
    const { app, db, fetchMock } = await testApp();
    // Blank text cannot be submitted through the API, so plant a record directly.
    db.data.feedback.unshift({
      id: "blank-record", reference: "CV-000000", nric: "S0000001A", name: "Aisha Rahman",
      message: "   \n\t ", category: "Other", status: "New", createdAt: new Date().toISOString(),
    });
    await db.write();

    const response = await request(app).post("/api/feedback/blank-record/audio");

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/no feedback text/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown feedback id", async () => {
    const { app, fetchMock } = await testApp();
    const response = await request(app).post("/api/feedback/does-not-exist/audio");
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Feedback not found.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
