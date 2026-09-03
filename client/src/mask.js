// Masks an identifier such as an NRIC so it can be shown outside the login form
// without exposing the full value. Keeps the first character and the last two,
// replacing everything in between with bullets: "S0000001A" -> "S••••••1A".
export function maskIdentifier(value) {
  const id = String(value ?? "").trim();
  if (!id) return "";
  if (id.length <= 3) return "•".repeat(id.length);
  return `${id[0]}${"•".repeat(id.length - 3)}${id.slice(-2)}`;
}
