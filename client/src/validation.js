// Workshop-only NRIC-like shape: one prefix letter, seven digits, one suffix letter.
// This checks the shape only; it does not compute a real NRIC checksum.
export const NRIC_PATTERN = /^[STFGM]\d{7}[A-Z]$/;

export const NRIC_EMPTY_MESSAGE = "Please enter your NRIC.";
export const NRIC_FORMAT_MESSAGE = "Enter a workshop ID like S0000001A: a letter, seven digits, and a letter.";

export function normalizeNric(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function isValidNric(value) {
  return NRIC_PATTERN.test(normalizeNric(value));
}

// Returns an inline error message, or an empty string when the value is acceptable.
export function validateNric(value) {
  const nric = normalizeNric(value);
  if (!nric) return NRIC_EMPTY_MESSAGE;
  if (!NRIC_PATTERN.test(nric)) return NRIC_FORMAT_MESSAGE;
  return "";
}
