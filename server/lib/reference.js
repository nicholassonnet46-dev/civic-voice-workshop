import crypto from "node:crypto";

export const REFERENCE_PATTERN = /^CV-\d{6}$/;

function randomSixDigits() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

// Produces a short, human-readable reference such as CV-123456 that is not
// already used by any of the existing feedback records.
export function generateReference(existingFeedback = [], random = randomSixDigits) {
  const taken = new Set(existingFeedback.map((item) => item?.reference).filter(Boolean));
  let candidate = `CV-${random()}`;
  while (taken.has(candidate)) candidate = `CV-${random()}`;
  return candidate;
}
