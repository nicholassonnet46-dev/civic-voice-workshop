import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS, FILTER_CATEGORIES, FILTER_STATUSES,
  buildFilterQuery, describeFilters, hasActiveFilters, normalizeFilters,
} from "./filters.js";

describe("inbox filters", () => {
  it("offers every category plus the legacy General value, and the three statuses", () => {
    expect(FILTER_CATEGORIES).toEqual(["Estate", "Transport", "Environment", "Other", "General"]);
    expect(FILTER_STATUSES).toEqual(["New", "In review", "Closed"]);
  });

  it("normalizes unknown or missing values to empty strings", () => {
    expect(normalizeFilters(undefined)).toEqual(EMPTY_FILTERS);
    expect(normalizeFilters({ category: "Roads", status: "Done" })).toEqual(EMPTY_FILTERS);
    expect(normalizeFilters({ category: "Estate", status: "In review" })).toEqual({ category: "Estate", status: "In review" });
  });

  it("reports whether any filter is active", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ category: "Estate", status: "" })).toBe(true);
    expect(hasActiveFilters({ category: "", status: "Closed" })).toBe(true);
    expect(hasActiveFilters({ category: "bogus", status: "" })).toBe(false);
  });

  it("builds the query string, omitting unset filters and encoding spaces", () => {
    expect(buildFilterQuery(EMPTY_FILTERS)).toBe("");
    expect(buildFilterQuery({ category: "Estate", status: "" })).toBe("?category=Estate");
    expect(buildFilterQuery({ category: "", status: "In review" })).toBe("?status=In+review");
    expect(buildFilterQuery({ category: "General", status: "Closed" })).toBe("?category=General&status=Closed");
  });

  it("describes the active filters for empty states", () => {
    expect(describeFilters(EMPTY_FILTERS)).toBe("");
    expect(describeFilters({ category: "Estate", status: "" })).toBe("Estate");
    expect(describeFilters({ category: "Estate", status: "Closed" })).toBe("Estate · Closed");
  });
});
