import { FEEDBACK_CATEGORIES, isValidCategory } from "./categories.js";

// Deterministic keyword fallback used when no OpenAI key is configured or the
// model call fails. Order matters for ties: earlier categories win.
const KEYWORDS = {
  Estate: [
    "lift", "elevator", "void deck", "corridor", "block", "hdb", "flat", "estate", "playground",
    "staircase", "stairs", "chute", "ceiling", "leak", "carpark", "car park", "letterbox", "fence",
    "railing", "walkway", "lamp", "light", "lighting", "bench", "pavilion",
  ],
  Transport: [
    "bus", "mrt", "train", "lrt", "traffic", "road", "parking", "taxi", "cycling", "bicycle", "bike",
    "crossing", "pedestrian", "junction", "car", "vehicle", "commute", "station", "shuttle", "speed",
  ],
  Environment: [
    "tree", "trees", "litter", "rubbish", "trash", "garbage", "noise", "noisy", "mosquito", "dengue",
    "flood", "flooding", "drain", "smell", "smoke", "haze", "park", "bin", "bins", "recycling", "grass",
    "pollution", "waste", "pest", "rat", "pigeon", "dust",
  ],
};

function countMatches(text, words) {
  return words.reduce((count, word) => {
    const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return pattern.test(text) ? count + 1 : count;
  }, 0);
}

export function categorizeByKeywords(message) {
  const text = typeof message === "string" ? message.toLowerCase() : "";
  let best = { category: "Other", score: 0 };
  for (const category of FEEDBACK_CATEGORIES) {
    if (!KEYWORDS[category]) continue;
    const score = countMatches(text, KEYWORDS[category]);
    if (score > best.score) best = { category, score };
  }
  return best.category;
}

const CATEGORY_SCHEMA = {
  type: "object",
  properties: { category: { type: "string", enum: FEEDBACK_CATEGORIES } },
  required: ["category"],
  additionalProperties: false,
};

const SYSTEM_PROMPT =
  "You classify short pieces of public feedback sent to a Singapore town council. " +
  `Choose exactly one category from: ${FEEDBACK_CATEGORIES.join(", ")}. ` +
  "Estate covers housing blocks, lifts, corridors, void decks and estate facilities. " +
  "Transport covers buses, trains, roads, traffic, parking and cycling. " +
  "Environment covers cleanliness, litter, pests, noise, trees, drains and pollution. " +
  "Use Other only when none of the above fit.";

// Returns { category, categorySource } where categorySource is "ai" when the
// model picked it, or "fallback" when the deterministic keyword rule did.
export async function categorizeFeedback(message, client) {
  if (client?.isConfigured?.()) {
    try {
      const result = await client.chatJson({
        system: SYSTEM_PROMPT,
        user: message,
        schema: CATEGORY_SCHEMA,
        name: "feedback_category",
      });
      if (isValidCategory(result?.category)) {
        return { category: result.category, categorySource: "ai" };
      }
    } catch {
      // fall through to the deterministic rule
    }
  }
  return { category: categorizeByKeywords(message), categorySource: "fallback" };
}
