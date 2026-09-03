// Mirrors server/lib/categories.js. Keep both lists in sync.
export const FEEDBACK_CATEGORIES = ["Estate", "Transport", "Environment", "Other"];
export const CATEGORY_REQUIRED_MESSAGE = "Please choose a category.";

export function isValidCategory(category) {
  return typeof category === "string" && FEEDBACK_CATEGORIES.includes(category);
}
