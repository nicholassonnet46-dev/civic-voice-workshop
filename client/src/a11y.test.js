import { describe, expect, it } from "vitest";
import { FIELD_IDS, describedBy, errorField } from "./a11y.js";
import { CATEGORY_REQUIRED_MESSAGE } from "./categories.js";
import { BLANK_FEEDBACK_MESSAGE } from "./feedback.js";

describe("form accessibility ids", () => {
  it("uses unique, non-empty ids for every wired element", () => {
    const values = Object.values(FIELD_IDS);
    expect(values.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("describedBy", () => {
  it("joins ids with spaces and drops blanks and falsy entries", () => {
    expect(describedBy([FIELD_IDS.hint, FIELD_IDS.count])).toBe("feedback-hint feedback-count");
    expect(describedBy([FIELD_IDS.hint, false, "", null, undefined, FIELD_IDS.error])).toBe("feedback-hint feedback-error");
  });

  it("returns undefined when there is nothing to describe", () => {
    expect(describedBy([])).toBeUndefined();
    expect(describedBy([false, ""])).toBeUndefined();
    expect(describedBy(undefined)).toBeUndefined();
  });
});

describe("errorField", () => {
  it("returns null when there is no error", () => {
    expect(errorField("")).toBeNull();
    expect(errorField("   ")).toBeNull();
    expect(errorField(undefined)).toBeNull();
    expect(errorField(null)).toBeNull();
  });

  it("points category errors at the category select", () => {
    expect(errorField(CATEGORY_REQUIRED_MESSAGE)).toBe("category");
    expect(errorField("Please choose a valid category.")).toBe("category");
  });

  it("points every other error at the feedback textarea", () => {
    expect(errorField(BLANK_FEEDBACK_MESSAGE)).toBe("message");
    expect(errorField("Feedback must be 500 characters or fewer.")).toBe("message");
    expect(errorField("Something went wrong.")).toBe("message");
  });
});
