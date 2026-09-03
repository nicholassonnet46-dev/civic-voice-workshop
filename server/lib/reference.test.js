import { describe, expect, it } from "vitest";
import { REFERENCE_PATTERN, generateReference } from "./reference.js";

describe("submission reference numbers", () => {
  it("looks like CV- followed by six digits", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateReference()).toMatch(REFERENCE_PATTERN);
    }
  });

  it("pads short random values to six digits", () => {
    expect(generateReference([], () => "000042")).toBe("CV-000042");
  });

  it("is unique across many generated records", () => {
    const seen = new Set();
    const feedback = [];
    for (let i = 0; i < 2000; i += 1) {
      const reference = generateReference(feedback);
      expect(seen.has(reference)).toBe(false);
      seen.add(reference);
      feedback.push({ reference });
    }
    expect(seen.size).toBe(2000);
  });

  it("retries when the random value collides with an existing reference", () => {
    const values = ["111111", "111111", "222222"];
    const reference = generateReference([{ reference: "CV-111111" }, { id: "fb-seed-1" }], () => values.shift());
    expect(reference).toBe("CV-222222");
  });
});
