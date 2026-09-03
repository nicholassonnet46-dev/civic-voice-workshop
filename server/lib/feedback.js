import { FEEDBACK_CATEGORIES } from "./categories.js";

export const FEEDBACK_STATUSES = ["New", "In review", "Closed"];

// Older records (and the seed) carry the legacy "General" category, which
// citizens can no longer choose but admins still need to filter on.
export const LEGACY_CATEGORIES = ["General"];
export const FILTER_CATEGORIES = [...FEEDBACK_CATEGORIES, ...LEGACY_CATEGORIES];

export function sortNewestFirst(feedback) {
  return [...feedback].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function readFilter(value, allowed, label) {
  // A missing or empty parameter means "no filter"; anything else must match exactly.
  if (value === undefined || value === "") return { value: null };
  if (typeof value !== "string" || !allowed.includes(value)) {
    return { error: `${label} must be one of: ${allowed.join(", ")}.` };
  }
  return { value };
}

// Parses ?category= and ?status= from a query object. Returns either
// { filters } with null for unset filters, or { error } for a 400 response.
export function parseFeedbackFilters(query = {}) {
  const category = readFilter(query.category, FILTER_CATEGORIES, "Category");
  if (category.error) return { error: category.error };
  const status = readFilter(query.status, FEEDBACK_STATUSES, "Status");
  if (status.error) return { error: status.error };
  return { filters: { category: category.value, status: status.value } };
}

export function filterFeedback(feedback, filters = {}) {
  const { category = null, status = null } = filters;
  return feedback.filter((item) =>
    (category === null || item.category === category) && (status === null || item.status === status));
}
