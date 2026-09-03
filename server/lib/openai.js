// Minimal OpenAI helper for the workshop server (Chat Completions and
// text-to-speech).
//
// - The API key is read from process.env.OPENAI_API_KEY on the server only.
//   It must never be sent to the browser.
// - Uses the built-in fetch; no SDK dependency.
// - Every caller must degrade gracefully when isConfigured() is false or
//   when chatJson() throws, so the app keeps working without a key.

export const OPENAI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_MODEL = "gpt-4o-mini";
export const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
export const DEFAULT_TTS_VOICE = "alloy";
export const DEFAULT_TTS_FORMAT = "mp3";
const AUDIO_CONTENT_TYPES = { mp3: "audio/mpeg", wav: "audio/wav", aac: "audio/aac", flac: "audio/flac", opus: "audio/ogg" };
const DEFAULT_TIMEOUT_MS = 15_000;

export class OpenAiError extends Error {
  constructor(message, { kind, status } = {}) {
    super(message);
    this.name = "OpenAiError";
    // "not_configured" | "upstream" | "malformed" | "empty_input"
    this.kind = kind ?? "upstream";
    this.status = status;
  }
}

function parseJsonContent(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new OpenAiError("The model returned no content.", { kind: "malformed" });
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new OpenAiError("The model returned invalid JSON.", { kind: "malformed" });
  }
}

export function createOpenAiClient({
  fetch: fetchImpl, apiKey, model = DEFAULT_MODEL, ttsModel = DEFAULT_TTS_MODEL, ttsVoice = DEFAULT_TTS_VOICE,
  baseUrl = OPENAI_BASE_URL, timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  // Both the key and fetch are resolved lazily so tests can stub
  // globalThis.fetch / process.env after the client has been created.
  const resolveKey = () => apiKey ?? process.env.OPENAI_API_KEY;
  const resolveFetch = () => fetchImpl ?? globalThis.fetch;

  function isConfigured() {
    const key = resolveKey();
    return typeof key === "string" && key.trim().length > 0;
  }

  // Ask the model for a JSON object that matches `schema` (JSON Schema) and
  // return the parsed object. Throws OpenAiError on any failure.
  async function chatJson({ system, user, schema, name = "response", temperature = 0 }) {
    if (!isConfigured()) {
      throw new OpenAiError("OPENAI_API_KEY is not configured.", { kind: "not_configured" });
    }
    const doFetch = resolveFetch();
    if (typeof doFetch !== "function") {
      throw new OpenAiError("fetch is not available.", { kind: "upstream" });
    }

    let response;
    try {
      response = await doFetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resolveKey()}` },
        signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined,
        body: JSON.stringify({
          model,
          temperature,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name, strict: true, schema },
          },
        }),
      });
    } catch (error) {
      throw new OpenAiError(`OpenAI request failed: ${error?.message ?? error}`, { kind: "upstream" });
    }

    if (!response?.ok) {
      throw new OpenAiError(`OpenAI responded with status ${response?.status}.`, { kind: "upstream", status: response?.status });
    }

    let body;
    try {
      body = await response.json();
    } catch {
      throw new OpenAiError("OpenAI returned a non-JSON body.", { kind: "malformed" });
    }
    return parseJsonContent(body);
  }

  // Turn `input` into spoken audio and return { audio: Buffer, contentType }.
  // Blank input is refused before any network call so nothing is synthesized
  // (or billed) for empty text. Throws OpenAiError on any failure.
  async function speech({ input, voice = ttsVoice, format = DEFAULT_TTS_FORMAT } = {}) {
    const text = typeof input === "string" ? input.trim() : "";
    if (!text) {
      throw new OpenAiError("There is no text to read aloud.", { kind: "empty_input" });
    }
    if (!isConfigured()) {
      throw new OpenAiError("OPENAI_API_KEY is not configured.", { kind: "not_configured" });
    }
    const doFetch = resolveFetch();
    if (typeof doFetch !== "function") {
      throw new OpenAiError("fetch is not available.", { kind: "upstream" });
    }

    let response;
    try {
      response = await doFetch(`${baseUrl}/audio/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resolveKey()}` },
        signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined,
        body: JSON.stringify({ model: ttsModel, voice, input: text, response_format: format }),
      });
    } catch (error) {
      throw new OpenAiError(`OpenAI request failed: ${error?.message ?? error}`, { kind: "upstream" });
    }

    if (!response?.ok) {
      throw new OpenAiError(`OpenAI responded with status ${response?.status}.`, { kind: "upstream", status: response?.status });
    }

    let audio;
    try {
      audio = Buffer.from(await response.arrayBuffer());
    } catch {
      throw new OpenAiError("OpenAI returned unreadable audio.", { kind: "malformed" });
    }
    if (audio.length === 0) {
      throw new OpenAiError("OpenAI returned empty audio.", { kind: "malformed" });
    }
    return { audio, contentType: AUDIO_CONTENT_TYPES[format] ?? `audio/${format}` };
  }

  return { isConfigured, chatJson, speech, model, ttsModel };
}

const defaultClient = createOpenAiClient();

export function isConfigured() {
  return defaultClient.isConfigured();
}

export function chatJson(args) {
  return defaultClient.chatJson(args);
}

export function speech(args) {
  return defaultClient.speech(args);
}
