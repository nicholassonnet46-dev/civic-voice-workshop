import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiError, chatJson, createOpenAiClient, isConfigured, speech } from "./openai.js";

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => payload };
}

function completion(content) {
  return { choices: [{ message: { role: "assistant", content } }] };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("createOpenAiClient", () => {
  it("is not configured without a key", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(createOpenAiClient().isConfigured()).toBe(false);
    expect(createOpenAiClient({ apiKey: "   " }).isConfigured()).toBe(false);
    expect(isConfigured()).toBe(false);
  });

  it("throws a not_configured error instead of calling fetch without a key", async () => {
    const fetchMock = vi.fn();
    const client = createOpenAiClient({ fetch: fetchMock, apiKey: "" });
    await expect(client.chatJson({ system: "s", user: "u", schema: {} })).rejects.toMatchObject({ kind: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a json_schema request to the chat completions endpoint and parses the content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(completion('{"category":"Transport"}')));
    const client = createOpenAiClient({ fetch: fetchMock, apiKey: "test-key" });
    const schema = { type: "object", properties: { category: { type: "string" } } };

    const result = await client.chatJson({ system: "classify", user: "The bus is late.", schema, name: "cat" });

    expect(result).toEqual({ category: "Transport" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body.messages).toEqual([
      { role: "system", content: "classify" },
      { role: "user", content: "The bus is late." },
    ]);
    expect(body.response_format).toEqual({ type: "json_schema", json_schema: { name: "cat", strict: true, schema } });
  });

  it("reads the key from process.env and fetch from globalThis lazily", async () => {
    vi.stubEnv("OPENAI_API_KEY", "env-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(completion('{"ok":true}'))));
    expect(isConfigured()).toBe(true);
    await expect(chatJson({ system: "s", user: "u", schema: {} })).resolves.toEqual({ ok: true });
    expect(globalThis.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer env-key");
  });

  it("wraps non-2xx responses as upstream errors", async () => {
    const client = createOpenAiClient({ fetch: async () => jsonResponse({ error: "nope" }, { ok: false, status: 429 }), apiKey: "k" });
    const error = await client.chatJson({ system: "s", user: "u", schema: {} }).catch((e) => e);
    expect(error).toBeInstanceOf(OpenAiError);
    expect(error.kind).toBe("upstream");
    expect(error.status).toBe(429);
  });

  it("wraps network failures as upstream errors", async () => {
    const client = createOpenAiClient({ fetch: async () => { throw new Error("socket hang up"); }, apiKey: "k" });
    await expect(client.chatJson({ system: "s", user: "u", schema: {} })).rejects.toMatchObject({ kind: "upstream" });
  });

  it("rejects malformed model output", async () => {
    for (const payload of [completion("not json"), completion(""), { choices: [] }, {}]) {
      const client = createOpenAiClient({ fetch: async () => jsonResponse(payload), apiKey: "k" });
      await expect(client.chatJson({ system: "s", user: "u", schema: {} })).rejects.toMatchObject({ kind: "malformed" });
    }
  });
});

describe("speech", () => {
  const audioBytes = Uint8Array.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
  function audioResponse(bytes = audioBytes, { ok = true, status = 200 } = {}) {
    return { ok, status, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  }

  it("posts to the audio speech endpoint with the tts model, voice, and mp3 format", async () => {
    const fetchMock = vi.fn().mockResolvedValue(audioResponse());
    const client = createOpenAiClient({ fetch: fetchMock, apiKey: "test-key" });

    const result = await client.speech({ input: "  Please add more benches.  " });

    expect(Buffer.isBuffer(result.audio)).toBe(true);
    expect([...result.audio]).toEqual([...audioBytes]);
    expect(result.contentType).toBe("audio/mpeg");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body)).toEqual({
      model: "gpt-4o-mini-tts", voice: "alloy", input: "Please add more benches.", response_format: "mp3",
    });
  });

  it("refuses blank input before calling fetch or checking the key", async () => {
    const fetchMock = vi.fn();
    const client = createOpenAiClient({ fetch: fetchMock, apiKey: "test-key" });
    for (const input of ["", "   \n\t", undefined, null, 42]) {
      await expect(client.speech({ input })).rejects.toMatchObject({ kind: "empty_input" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws not_configured without a key and never calls fetch", async () => {
    const fetchMock = vi.fn();
    const client = createOpenAiClient({ fetch: fetchMock, apiKey: "" });
    await expect(client.speech({ input: "Hello" })).rejects.toMatchObject({ kind: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("wraps upstream failures and empty audio", async () => {
    const rejected = createOpenAiClient({ fetch: async () => audioResponse(audioBytes, { ok: false, status: 500 }), apiKey: "k" });
    await expect(rejected.speech({ input: "Hello" })).rejects.toMatchObject({ kind: "upstream", status: 500 });

    const network = createOpenAiClient({ fetch: async () => { throw new Error("socket hang up"); }, apiKey: "k" });
    await expect(network.speech({ input: "Hello" })).rejects.toMatchObject({ kind: "upstream" });

    const empty = createOpenAiClient({ fetch: async () => audioResponse(new Uint8Array(0)), apiKey: "k" });
    await expect(empty.speech({ input: "Hello" })).rejects.toMatchObject({ kind: "malformed" });
  });

  it("uses the default client with the env key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "env-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(audioResponse()));
    const result = await speech({ input: "Hello" });
    expect(result.contentType).toBe("audio/mpeg");
    expect(globalThis.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer env-key");
  });
});
