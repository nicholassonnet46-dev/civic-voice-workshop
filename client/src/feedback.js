export const FEEDBACK_MAX_LENGTH = 500;
export const BLANK_FEEDBACK_MESSAGE = "Please enter some feedback before submitting.";

export function countCharacters(message) {
  return Array.from(message ?? "").length;
}

export function isOverLimit(message, limit = FEEDBACK_MAX_LENGTH) {
  return countCharacters(message) > limit;
}

export function formatCharacterCount(message, limit = FEEDBACK_MAX_LENGTH) {
  return `${countCharacters(message)} / ${limit} characters`;
}

export function normalizeFeedback(message) {
  return typeof message === "string" ? message.trim() : "";
}

export function isBlankFeedback(message) {
  return normalizeFeedback(message).length === 0;
}
