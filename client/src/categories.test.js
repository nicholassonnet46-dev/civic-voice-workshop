import { describe, expect, it } from "vitest";
import { FEEDBACK_CATEGORIES as SERVER_CATEGORIES } from "../../server/lib/categories.js";
import { FEEDBACK_CATEGORIES, isValidCategory } from "./categories.js";

describe("feedback categories", () => {
  it("offers the four workshop categories", () => {
    expect(FEEDBACK_CATEGORIES).toEqual(["Estate", "Transport", "Environment", "Other"]);
  });

  it("stays in sync with the server list", () => {
    expect(FEEDBACK_CATEGORIES).toEqual(SERVER_CATEGORIES);
  });

  it("validates a chosen category", () => {
    expect(isValidCategory("Estate")).toBe(true);
    expect(isValidCategory("Other")).toBe(true);
    expect(isValidCategory("")).toBe(false);
    expect(isValidCategory("General")).toBe(false);
    expect(isValidCategory("estate")).toBe(false);
    expect(isValidCategory(undefined)).toBe(false);
  });
});
