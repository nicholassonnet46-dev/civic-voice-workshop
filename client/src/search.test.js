import { describe, expect, it } from "vitest";
import { matchesFeedback, normalizeQuery, searchFeedback } from "./search.js";

const items = [
  { id: "1", name: "Aisha Rahman", message: "The bus stop near Bedok is flooded again.", status: "New" },
  { id: "2", name: "Wei Ming", message: "Great job on the new park!", status: "Closed" },
  { id: "3", name: "Priya", message: "Streetlight outage on Jalan Besar", status: "In review" },
];

describe("normalizeQuery", () => {
  it("trims and lowercases", () => {
    expect(normalizeQuery("  BeDoK ")).toBe("bedok");
    expect(normalizeQuery(null)).toBe("");
    expect(normalizeQuery(undefined)).toBe("");
  });
});

describe("searchFeedback", () => {
  it("returns everything when the query is empty or whitespace", () => {
    expect(searchFeedback(items, "")).toBe(items);
    expect(searchFeedback(items, "   ")).toBe(items);
    expect(searchFeedback(items, undefined)).toBe(items);
  });

  it("matches message text case-insensitively", () => {
    expect(searchFeedback(items, "BEDOK").map((i) => i.id)).toEqual(["1"]);
    expect(searchFeedback(items, "park").map((i) => i.id)).toEqual(["2"]);
  });

  it("matches citizen names case-insensitively", () => {
    expect(searchFeedback(items, "priya").map((i) => i.id)).toEqual(["3"]);
    expect(searchFeedback(items, "wei MING").map((i) => i.id)).toEqual(["2"]);
  });

  it("matches across both fields", () => {
    expect(searchFeedback(items, "a").map((i) => i.id)).toEqual(["1", "2", "3"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchFeedback(items, "zebra")).toEqual([]);
  });

  it("tolerates missing fields and non-array input", () => {
    expect(searchFeedback([{ id: "x" }], "anything")).toEqual([]);
    expect(searchFeedback(null, "x")).toEqual([]);
    expect(matchesFeedback({ message: null, name: undefined }, "")).toBe(true);
  });
});
