import { OpenAiError } from "./openai.js";

// Only long feedback gets a summary; shorter messages are readable as-is.
export const SUMMARY_MIN_LENGTH = 200;
const SUMMARY_MAX_LENGTH = 300;

export const SUMMARY_SCHEMA = {
  type: "object",
  properties: { summary: { type: "string", description: "One plain-English sentence." } },
  required: ["summary"],
  additionalProperties: false,
};

const SYSTEM_PROMPT =
  "You summarise public feedback for a Singapore town council admin. " +
  "Reply with exactly one plain-English sentence that captures the main issue or request. " +
  "Do not add advice, opinions, or details that are not in the feedback.";

export function needsSummary(message) {
  return typeof message === "string" && Array.from(message.trim()).length > SUMMARY_MIN_LENGTH;
}

export function validateSummary(output) {
  const summary = typeof output?.summary === "string" ? output.summary.replace(/\s+/g, " ").trim() : "";
  if (!summary) return { ok: false, error: "Summary must be a non-empty sentence." };
  return { ok: true, value: summary.slice(0, SUMMARY_MAX_LENGTH) };
}

// Returns a validated one-sentence summary string or throws an OpenAiError.
export async function summarizeFeedback(feedback, client) {
  if (!client?.isConfigured?.()) {
    throw new OpenAiError("OPENAI_API_KEY is not configured.", { kind: "not_configured" });
  }
  const output = await client.chatJson({
    system: SYSTEM_PROMPT,
    user: feedback.message,
    schema: SUMMARY_SCHEMA,
    name: "feedback_summary",
  });
  const result = validateSummary(output);
  if (!result.ok) throw new OpenAiError(result.error, { kind: "malformed" });
  return result.value;
}
