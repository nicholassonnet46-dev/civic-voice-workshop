export const FEEDBACK_MAX_LENGTH = 500;

export function countCharacters(message) {
  return Array.from(message ?? "").length;
}

export function isOverLimit(message, limit = FEEDBACK_MAX_LENGTH) {
  return countCharacters(message) > limit;
}

export function formatCharacterCount(message, limit = FEEDBACK_MAX_LENGTH) {
  return `${countCharacters(message)} / ${limit} characters`;
}
