import { OpenAiError } from "./openai.js";

export const URGENCY_LEVELS = ["Low", "Medium", "High"];
export const TEAMS = ["Town Council", "Land Transport", "National Environment", "General Enquiries"];
const RATIONALE_MAX_LENGTH = 300;

export const TRIAGE_SCHEMA = {
  type: "object",
  properties: {
    urgency: { type: "string", enum: URGENCY_LEVELS },
    team: { type: "string", enum: TEAMS },
    rationale: { type: "string", description: "One short sentence explaining the choice." },
  },
  required: ["urgency", "team", "rationale"],
  additionalProperties: false,
};

const SYSTEM_PROMPT =
  "You help a Singapore town council triage public feedback. " +
  `Suggest an urgency (${URGENCY_LEVELS.join(", ")}) and the responsible team (${TEAMS.join(", ")}). ` +
  "High is for safety hazards or issues affecting many residents right now; Medium for problems that " +
  "need attention within days; Low for suggestions, praise or minor matters. " +
  "Town Council handles estate and housing block matters, Land Transport handles roads, buses and trains, " +
  "National Environment handles cleanliness, pests, noise and pollution, General Enquiries handles everything else. " +
  "Give a one-sentence rationale.";

export function isValidUrgency(value) {
  return typeof value === "string" && URGENCY_LEVELS.includes(value);
}

export function isValidTeam(value) {
  return typeof value === "string" && TEAMS.includes(value);
}

// Strict validation of the model output. Anything outside the enums, any
// missing field, or a blank rationale is rejected so it can never be stored.
export function validateTriageSuggestion(output) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return { ok: false, error: "Suggestion must be an object." };
  }
  if (!isValidUrgency(output.urgency)) {
    return { ok: false, error: `Urgency must be one of: ${URGENCY_LEVELS.join(", ")}.` };
  }
  if (!isValidTeam(output.team)) {
    return { ok: false, error: `Team must be one of: ${TEAMS.join(", ")}.` };
  }
  const rationale = typeof output.rationale === "string" ? output.rationale.trim() : "";
  if (!rationale) return { ok: false, error: "Rationale must be a non-empty sentence." };
  return {
    ok: true,
    value: { urgency: output.urgency, team: output.team, rationale: rationale.slice(0, RATIONALE_MAX_LENGTH) },
  };
}

// Returns a validated { urgency, team, rationale } or throws an OpenAiError.
export async function suggestTriage(feedback, client) {
  if (!client?.isConfigured?.()) {
    throw new OpenAiError("OPENAI_API_KEY is not configured.", { kind: "not_configured" });
  }
  const output = await client.chatJson({
    system: SYSTEM_PROMPT,
    user: `Category: ${feedback.category ?? "Unknown"}\nFeedback: ${feedback.message}`,
    schema: TRIAGE_SCHEMA,
    name: "feedback_triage",
  });
  const result = validateTriageSuggestion(output);
  if (!result.ok) throw new OpenAiError(result.error, { kind: "malformed" });
  return result.value;
}
