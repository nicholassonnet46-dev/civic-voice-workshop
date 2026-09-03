// Mirrors server/lib/triage.js. Keep both lists in sync.
export const URGENCY_LEVELS = ["Low", "Medium", "High"];
export const TEAMS = ["Town Council", "Land Transport", "National Environment", "General Enquiries"];

export function hasSuggestion(item) {
  return Boolean(item?.suggestion && item.suggestion.urgency && item.suggestion.team);
}

export function hasTriage(item) {
  return Boolean(item?.urgency || item?.team);
}

// "High · Land Transport" for a triaged record, "" otherwise.
export function formatTriage(item) {
  if (!hasTriage(item)) return "";
  return [item.urgency, item.team].filter(Boolean).join(" · ");
}
