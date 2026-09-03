export const FEEDBACK_CATEGORIES = ["Estate", "Transport", "Environment", "Other"];

export function isValidCategory(category) {
  return typeof category === "string" && FEEDBACK_CATEGORIES.includes(category);
}
