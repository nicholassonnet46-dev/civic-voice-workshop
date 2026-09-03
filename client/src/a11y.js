import { CATEGORY_REQUIRED_MESSAGE } from "./categories";

// Stable element ids used to wire labels, hints, and live regions together
// on the citizen feedback form.
export const FIELD_IDS = Object.freeze({
  category: "feedback-category",
  message: "feedback-message",
  hint: "feedback-hint",
  count: "feedback-count",
  error: "feedback-error",
  success: "feedback-success",
  successBanner: "feedback-success-banner",
});

// Joins the ids that should appear in an aria-describedby attribute, dropping
// blanks and falsy entries. Returns undefined when nothing is left so React
// omits the attribute entirely.
export function describedBy(ids) {
  const list = (ids ?? []).filter((id) => typeof id === "string" && id.trim().length > 0);
  return list.length ? list.join(" ") : undefined;
}

// Works out which field an error message belongs to so the right control can
// be marked aria-invalid and point at the error text.
export function errorField(error) {
  if (typeof error !== "string" || error.trim().length === 0) return null;
  if (error === CATEGORY_REQUIRED_MESSAGE || /categor/i.test(error)) return "category";
  return "message";
}
