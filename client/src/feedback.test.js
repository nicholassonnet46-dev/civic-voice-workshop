import { describe, expect, it } from "vitest";
import {
  BLANK_FEEDBACK_MESSAGE,
  FEEDBACK_MAX_LENGTH,
  countCharacters,
  formatCharacterCount,
  isBlankFeedback,
  isOverLimit,
  normalizeFeedback,
} from "./feedback.js";

describe("feedback character limit helpers", () => {
  it("uses a 500-character maximum", () => {
    expect(FEEDBACK_MAX_LENGTH).toBe(500);
  });

  it("counts characters, treating empty or missing text as zero", () => {
    expect(countCharacters("")).toBe(0);
    expect(countCharacters(undefined)).toBe(0);
    expect(countCharacters("Please add more benches.")).toBe(24);
  });

  it("flags text that exceeds the limit but not text at the limit", () => {
    expect(isOverLimit("a".repeat(500))).toBe(false);
    expect(isOverLimit("a".repeat(501))).toBe(true);
    expect(isOverLimit("abc", 2)).toBe(true);
  });

  it("formats the live counter text", () => {
    expect(formatCharacterCount("")).toBe("0 / 500 characters");
    expect(formatCharacterCount("hello")).toBe("5 / 500 characters");
  });
});

describe("blank feedback helpers", () => {
  it("treats empty, whitespace-only, and non-string values as blank", () => {
    expect(isBlankFeedback("")).toBe(true);
    expect(isBlankFeedback("   ")).toBe(true);
    expect(isBlankFeedback("\n\n\t  \r\n")).toBe(true);
    expect(isBlankFeedback(undefined)).toBe(true);
    expect(isBlankFeedback(null)).toBe(true);
  });

  it("accepts useful text, even when padded with whitespace", () => {
    expect(isBlankFeedback("Please add more benches.")).toBe(false);
    expect(isBlankFeedback("  \n Fix the lights \n ")).toBe(false);
  });

  it("normalizes feedback by trimming surrounding whitespace", () => {
    expect(normalizeFeedback("  \n Fix the lights \n ")).toBe("Fix the lights");
    expect(normalizeFeedback(42)).toBe("");
  });

  it("has a friendly blank-feedback message", () => {
    expect(BLANK_FEEDBACK_MESSAGE).toMatch(/enter some feedback/i);
  });
});
