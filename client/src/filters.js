// Pure helpers for the admin inbox category/status filters. The filters are
// applied server-side (GET /api/feedback?category=&status=) and combine with
// the client-side keyword search in search.js. Kept free of React so it can be
// unit-tested in the node environment.
import { FEEDBACK_CATEGORIES } from "./categories";

// Mirrors server/lib/feedback.js: current categories plus the legacy "General"
// value still present on older records.
export const FILTER_CATEGORIES = [...FEEDBACK_CATEGORIES, "General"];
export const FILTER_STATUSES = ["New", "In review", "Closed"];
export const EMPTY_FILTERS = Object.freeze({ category: "", status: "" });

export function normalizeFilters(filters) {
  const category = FILTER_CATEGORIES.includes(filters?.category) ? filters.category : "";
  const status = FILTER_STATUSES.includes(filters?.status) ? filters.status : "";
  return { category, status };
}

export function hasActiveFilters(filters) {
  const normalized = normalizeFilters(filters);
  return Boolean(normalized.category || normalized.status);
}

// Builds the query string for GET /api/feedback, omitting unset filters.
export function buildFilterQuery(filters) {
  const params = new URLSearchParams();
  const normalized = normalizeFilters(filters);
  if (normalized.category) params.set("category", normalized.category);
  if (normalized.status) params.set("status", normalized.status);
  const query = params.toString();
  return query ? `?${query}` : "";
}

// Short human summary used by empty states, e.g. "Estate · Closed".
export function describeFilters(filters) {
  const normalized = normalizeFilters(filters);
  return [normalized.category, normalized.status].filter(Boolean).join(" · ");
}
