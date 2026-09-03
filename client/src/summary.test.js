import { describe, expect, it } from "vitest";
import { summarizeFeedback, summaryCards } from "./summary.js";

describe("summarizeFeedback", () => {
  it("counts total, new, in-review, and closed items", () => {
    const items = [
      { status: "New" }, { status: "New" }, { status: "In review" }, { status: "Closed" }, { status: "Closed" }, { status: "Closed" },
    ];
    expect(summarizeFeedback(items)).toEqual({ total: 6, new: 2, inReview: 1, closed: 3 });
  });

  it("returns zeros for an empty inbox", () => {
    expect(summarizeFeedback([])).toEqual({ total: 0, new: 0, inReview: 0, closed: 0 });
    expect(summarizeFeedback(undefined)).toEqual({ total: 0, new: 0, inReview: 0, closed: 0 });
  });

  it("treats status labels case-insensitively and ignores unknown statuses in the buckets", () => {
    const items = [{ status: "new" }, { status: "IN REVIEW" }, { status: "closed " }, { status: "Archived" }, {}];
    expect(summarizeFeedback(items)).toEqual({ total: 5, new: 1, inReview: 1, closed: 1 });
  });
});

describe("summaryCards", () => {
  it("produces the four cards in display order", () => {
    const cards = summaryCards({ total: 4, new: 2, inReview: 1, closed: 1 });
    expect(cards.map((card) => card.label)).toEqual(["Total", "New", "In review", "Closed"]);
    expect(cards.map((card) => card.value)).toEqual([4, 2, 1, 1]);
  });
});
