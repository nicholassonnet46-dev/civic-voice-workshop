// Client-side keyword search over already-loaded feedback. Matches the citizen
// name and the message text, case-insensitively, with no server round trip.
export function normalizeQuery(query) {
  return String(query ?? "").trim().toLowerCase();
}

export function matchesFeedback(item, query) {
  const needle = normalizeQuery(query);
  if (!needle) return true;
  const haystack = [item?.name, item?.message].map((value) => String(value ?? "").toLowerCase());
  return haystack.some((text) => text.includes(needle));
}

export function searchFeedback(items, query) {
  const list = Array.isArray(items) ? items : [];
  const needle = normalizeQuery(query);
  if (!needle) return list;
  return list.filter((item) => matchesFeedback(item, needle));
}
