// Mirrors server/lib/summarize.js. Keep the threshold in sync.
export const SUMMARY_MIN_LENGTH = 200;

export function isLongFeedback(message) {
  return typeof message === "string" && Array.from(message.trim()).length > SUMMARY_MIN_LENGTH;
}

export function hasSummary(item) {
  return typeof item?.summary === "string" && item.summary.trim().length > 0;
}

// The "Summarize" action is only offered for long messages without a cached summary.
export function canSummarize(item) {
  return isLongFeedback(item?.message) && !hasSummary(item);
}
