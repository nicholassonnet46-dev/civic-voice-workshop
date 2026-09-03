import { describe, expect, it } from "vitest";
import { maskIdentifier } from "./mask.js";

describe("maskIdentifier", () => {
  it("keeps the first character and the last two characters", () => {
    expect(maskIdentifier("S0000001A")).toBe("S••••••1A");
    expect(maskIdentifier("T1234567Z")).toBe("T••••••7Z");
  });

  it("never reveals a value that is too short to mask meaningfully", () => {
    expect(maskIdentifier("S1A")).toBe("•••");
    expect(maskIdentifier("AB")).toBe("••");
    expect(maskIdentifier("A")).toBe("•");
  });

  it("handles empty and missing values", () => {
    expect(maskIdentifier("")).toBe("");
    expect(maskIdentifier("   ")).toBe("");
    expect(maskIdentifier(null)).toBe("");
    expect(maskIdentifier(undefined)).toBe("");
  });

  it("masks longer identifiers without leaking the middle", () => {
    expect(maskIdentifier("ABCDEFGHIJ")).toBe("A•••••••IJ");
    expect(maskIdentifier(" S0000001A ")).toBe("S••••••1A");
  });
});
