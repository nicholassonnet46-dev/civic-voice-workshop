import { describe, expect, it, vi } from "vitest";
import { createOpenAiClient } from "./openai.js";
import { needsSummary, summarizeFeedback, validateSummary } from "./summarize.js";

function completion(content) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
}

const longMessage = "The lift in block 12 has been breaking down almost every evening for the past three weeks. ".repeat(3);

describe("needsSummary", () => {
  it("is true only for feedback longer than 200 characters", () => {
    expect(needsSummary("a".repeat(200))).toBe(false);
    expect(needsSummary("a".repeat(201))).toBe(true);
    expect(needsSummary(`  ${"a".repeat(200)}  `)).toBe(false);
    expect(needsSummary("")).toBe(false);
    expect(needsSummary(undefined)).toBe(false);
    expect(needsSummary(longMessage)).toBe(true);
  });
});

describe("validateSummary", () => {
  it("normalises whitespace and rejects empty output", () => {
    expect(validateSummary({ summary: "  The lift  keeps\nfailing. " })).toEqual({ ok: true, value: "The lift keeps failing." });
    for (const output of [{ summary: "   " }, { summary: 12 }, {}, null, "text"]) {
      expect(validateSummary(output).ok, JSON.stringify(output)).toBe(false);
    }
  });
});

describe("summarizeFeedback", () => {
  const feedback = { message: longMessage };

  it("returns the summary on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion('{"summary":"The block 12 lift keeps breaking down in the evenings."}'));
    const client = createOpenAiClient({ fetch: fetchMock, apiKey: "k" });
    await expect(summarizeFeedback(feedback, client)).resolves.toBe("The block 12 lift keeps breaking down in the evenings.");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[1].content).toBe(longMessage);
  });

  it("throws not_configured without a key and does not call fetch", async () => {
    const fetchMock = vi.fn();
    await expect(summarizeFeedback(feedback, createOpenAiClient({ fetch: fetchMock, apiKey: "" }))).rejects.toMatchObject({ kind: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws upstream on API failure", async () => {
    const client = createOpenAiClient({ fetch: async () => ({ ok: false, status: 502, json: async () => ({}) }), apiKey: "k" });
    await expect(summarizeFeedback(feedback, client)).rejects.toMatchObject({ kind: "upstream" });
  });

  it("throws malformed on invalid JSON or an empty summary", async () => {
    for (const content of ["nope", '{"summary":""}', '{"other":"x"}']) {
      const client = createOpenAiClient({ fetch: async () => completion(content), apiKey: "k" });
      await expect(summarizeFeedback(feedback, client), content).rejects.toMatchObject({ kind: "malformed" });
    }
  });
});
