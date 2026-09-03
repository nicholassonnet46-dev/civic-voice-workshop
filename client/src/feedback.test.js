import { describe, expect, it } from "vitest";
import { FEEDBACK_MAX_LENGTH, countCharacters, formatCharacterCount, isOverLimit } from "./feedback.js";

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
