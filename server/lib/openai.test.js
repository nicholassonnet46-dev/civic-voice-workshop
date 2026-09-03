import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiError, chatJson, createOpenAiClient, isConfigured } from "./openai.js";

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
