export function sortNewestFirst(feedback) {
  return [...feedback].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
