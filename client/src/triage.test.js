import { describe, expect, it } from "vitest";
import { formatTriage, hasSuggestion, hasTriage } from "./triage.js";

describe("triage helpers", () => {
  it("detects a usable suggestion", () => {
    expect(hasSuggestion({ suggestion: { urgency: "High", team: "Land Transport", rationale: "x" } })).toBe(true);
    expect(hasSuggestion({ suggestion: null })).toBe(false);
    expect(hasSuggestion({ suggestion: { urgency: "High" } })).toBe(false);
    expect(hasSuggestion({})).toBe(false);
    expect(hasSuggestion(undefined)).toBe(false);
  });

  it("formats accepted triage and stays empty otherwise", () => {
    expect(hasTriage({ urgency: "Low", team: "Town Council" })).toBe(true);
    expect(formatTriage({ urgency: "Low", team: "Town Council" })).toBe("Low · Town Council");
    expect(formatTriage({ urgency: "Medium" })).toBe("Medium");
    expect(formatTriage({})).toBe("");
    expect(formatTriage(undefined)).toBe("");
  });
});
