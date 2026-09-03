import { describe, expect, it } from "vitest";
import { canSummarize, hasSummary, isLongFeedback } from "./summarize.js";

const long = "x".repeat(201);

describe("summarize helpers", () => {
  it("only treats messages over 200 characters as long", () => {
    expect(isLongFeedback("x".repeat(200))).toBe(false);
    expect(isLongFeedback(long)).toBe(true);
    expect(isLongFeedback("")).toBe(false);
    expect(isLongFeedback(undefined)).toBe(false);
  });

  it("offers Summarize only for long messages without a summary", () => {
    expect(canSummarize({ message: long })).toBe(true);
    expect(canSummarize({ message: long, summary: "Done." })).toBe(false);
    expect(canSummarize({ message: "short" })).toBe(false);
    expect(canSummarize(undefined)).toBe(false);
  });

  it("detects a cached summary", () => {
    expect(hasSummary({ summary: "One sentence." })).toBe(true);
    expect(hasSummary({ summary: "  " })).toBe(false);
    expect(hasSummary({})).toBe(false);
  });
});
