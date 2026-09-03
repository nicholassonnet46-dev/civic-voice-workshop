import { describe, expect, it, vi } from "vitest";
import { categorizeByKeywords, categorizeFeedback } from "./categorize.js";
import { createOpenAiClient } from "./openai.js";

function completion(content) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
}

describe("categorizeByKeywords", () => {
  it("maps obvious keywords to categories", () => {
    expect(categorizeByKeywords("The lift at my block keeps breaking down.")).toBe("Estate");
    expect(categorizeByKeywords("Bus 74 is always late and the MRT is crowded.")).toBe("Transport");
    expect(categorizeByKeywords("There is a lot of litter and mosquitoes near the drain.")).toBe("Environment");
  });

  it("falls back to Other when nothing matches", () => {
    expect(categorizeByKeywords("Thank you for the great service.")).toBe("Other");
    expect(categorizeByKeywords("")).toBe("Other");
    expect(categorizeByKeywords(undefined)).toBe("Other");
  });

  it("is deterministic", () => {
    const text = "Noise from the road works at night.";
    expect(categorizeByKeywords(text)).toBe(categorizeByKeywords(text));
  });
});

describe("categorizeFeedback", () => {
  it("uses the model when a key is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion('{"category":"Environment"}'));
    const client = createOpenAiClient({ fetch: fetchMock, apiKey: "k" });
    const result = await categorizeFeedback("Something the keywords would not catch.", client);
    expect(result).toEqual({ category: "Environment", categorySource: "ai" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the keyword fallback without a key and never calls fetch", async () => {
    const fetchMock = vi.fn();
    const client = createOpenAiClient({ fetch: fetchMock, apiKey: "" });
    const result = await categorizeFeedback("The lift is broken.", client);
    expect(result).toEqual({ category: "Estate", categorySource: "fallback" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back when the upstream call fails", async () => {
    const client = createOpenAiClient({ fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }), apiKey: "k" });
    const result = await categorizeFeedback("Bus 12 never arrives on time.", client);
    expect(result).toEqual({ category: "Transport", categorySource: "fallback" });
  });

  it("falls back when the model output is malformed or outside the allowed list", async () => {
    const malformed = createOpenAiClient({ fetch: async () => completion("garbage"), apiKey: "k" });
    expect(await categorizeFeedback("Litter everywhere.", malformed)).toEqual({ category: "Environment", categorySource: "fallback" });

    const outsideEnum = createOpenAiClient({ fetch: async () => completion('{"category":"Housing"}'), apiKey: "k" });
    expect(await categorizeFeedback("Litter everywhere.", outsideEnum)).toEqual({ category: "Environment", categorySource: "fallback" });
  });
});
