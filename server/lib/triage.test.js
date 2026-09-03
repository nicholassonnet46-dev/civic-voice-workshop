import { describe, expect, it, vi } from "vitest";
import { createOpenAiClient } from "./openai.js";
import { suggestTriage, validateTriageSuggestion } from "./triage.js";

function completion(content) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
}

describe("validateTriageSuggestion", () => {
  it("accepts a well-formed suggestion and trims the rationale", () => {
    const result = validateTriageSuggestion({ urgency: "High", team: "Land Transport", rationale: "  Bus lane blocked.  " });
    expect(result).toEqual({ ok: true, value: { urgency: "High", team: "Land Transport", rationale: "Bus lane blocked." } });
  });

  it("rejects values outside the enums, missing fields, and non-objects", () => {
    const bad = [
      null, "High", [], {},
      { urgency: "Critical", team: "Land Transport", rationale: "x" },
      { urgency: "high", team: "Land Transport", rationale: "x" },
      { urgency: "High", team: "Police", rationale: "x" },
      { urgency: "High", team: "Land Transport" },
      { urgency: "High", team: "Land Transport", rationale: "   " },
      { urgency: "High", team: "Land Transport", rationale: 42 },
    ];
    for (const output of bad) {
      expect(validateTriageSuggestion(output).ok, JSON.stringify(output)).toBe(false);
    }
  });
});

describe("suggestTriage", () => {
  const feedback = { message: "A tree fell across the road outside block 12.", category: "Transport" };

  it("returns the validated suggestion on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion('{"urgency":"High","team":"Land Transport","rationale":"Road blocked."}'));
    const client = createOpenAiClient({ fetch: fetchMock, apiKey: "k" });
    await expect(suggestTriage(feedback, client)).resolves.toEqual({ urgency: "High", team: "Land Transport", rationale: "Road blocked." });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format.json_schema.schema.properties.urgency.enum).toEqual(["Low", "Medium", "High"]);
  });

  it("throws not_configured without a key and does not call fetch", async () => {
    const fetchMock = vi.fn();
    await expect(suggestTriage(feedback, createOpenAiClient({ fetch: fetchMock, apiKey: "" }))).rejects.toMatchObject({ kind: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws upstream on API failure", async () => {
    const client = createOpenAiClient({ fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }), apiKey: "k" });
    await expect(suggestTriage(feedback, client)).rejects.toMatchObject({ kind: "upstream" });
  });

  it("throws malformed on invalid JSON or out-of-enum values", async () => {
    for (const content of ["not json", '{"urgency":"Critical","team":"Land Transport","rationale":"x"}', '{"urgency":"High"}']) {
      const client = createOpenAiClient({ fetch: async () => completion(content), apiKey: "k" });
      await expect(suggestTriage(feedback, client), content).rejects.toMatchObject({ kind: "malformed" });
    }
  });
});
