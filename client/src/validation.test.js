import { describe, expect, it } from "vitest";
import {
  NRIC_EMPTY_MESSAGE,
  NRIC_FORMAT_MESSAGE,
  isValidNric,
  normalizeNric,
  validateNric,
} from "./validation.js";

describe("NRIC-like validation", () => {
  it("accepts the seeded workshop IDs", () => {
    expect(validateNric("S0000001A")).toBe("");
    expect(validateNric("S0000002B")).toBe("");
    expect(isValidNric("S0000001A")).toBe(true);
  });

  it("accepts every allowed prefix letter", () => {
    for (const prefix of ["S", "T", "F", "G", "M"]) {
      expect(isValidNric(`${prefix}1234567Z`), prefix).toBe(true);
    }
  });

  it("is case-insensitive and ignores surrounding whitespace", () => {
    expect(validateNric("s0000001a")).toBe("");
    expect(validateNric("  S0000001A  ")).toBe("");
    expect(normalizeNric(" s0000001a ")).toBe("S0000001A");
  });

  it("rejects empty or missing input with an empty-field message", () => {
    expect(validateNric("")).toBe(NRIC_EMPTY_MESSAGE);
    expect(validateNric("   ")).toBe(NRIC_EMPTY_MESSAGE);
    expect(validateNric(undefined)).toBe(NRIC_EMPTY_MESSAGE);
    expect(validateNric(null)).toBe(NRIC_EMPTY_MESSAGE);
    expect(isValidNric("")).toBe(false);
  });

  it("rejects malformed input with a format message", () => {
    const malformed = [
      "S000001A",      // six digits
      "S00000001A",    // eight digits
      "S0000001",      // missing suffix letter
      "0000001A",      // missing prefix letter
      "A0000001A",     // prefix not in S/T/F/G/M
      "S000000AA",     // letter where a digit belongs
      "S0000001AB",    // extra suffix
      "S0000001-",     // symbol suffix
      "S 0000001A",    // inner whitespace
      "citizen123",    // a password, not an ID
    ];
    for (const value of malformed) {
      expect(validateNric(value), value).toBe(NRIC_FORMAT_MESSAGE);
      expect(isValidNric(value), value).toBe(false);
    }
  });

  it("treats non-string values as invalid", () => {
    expect(isValidNric(1234567)).toBe(false);
    expect(isValidNric({})).toBe(false);
    expect(normalizeNric(42)).toBe("");
  });
});
