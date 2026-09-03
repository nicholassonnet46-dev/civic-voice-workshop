import { describe, expect, it } from "vitest";
import { sortNewestFirst } from "./sortFeedback.js";

describe("sortNewestFirst", () => {
  it("orders mixed input newest first without mutating the source", () => {
    const input = [
      { id: "old", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "newest", createdAt: "2026-03-01T00:00:00.000Z" },
      { id: "middle", createdAt: "2026-02-01T00:00:00.000Z" },
    ];
    expect(sortNewestFirst(input).map((item) => item.id)).toEqual(["newest", "middle", "old"]);
    expect(input.map((item) => item.id)).toEqual(["old", "newest", "middle"]);
  });
});
