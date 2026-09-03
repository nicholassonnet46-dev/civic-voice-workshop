import { useState } from "react";
import { acceptTriage, dismissTriage, requestSummary, suggestTriage } from "../api";
import { canSummarize } from "../summarize";
import { formatTriage, hasSuggestion, hasTriage } from "../triage";

// Small, self-contained block of AI-assisted admin actions for one feedback
// record. It only ever calls the server; the OpenAI key never reaches the browser.
export function AiActions({ user, item, onChange }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run(action, task) {
    setBusy(action);
    setError("");
    try {
      const response = await task();
      onChange?.(response.feedback);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy("");
    }
  }

  const suggestion = item.suggestion;

  return (
    <div className="ai-actions">
      {hasTriage(item) && (
        <div className="triage-line">
          <span className="triage-label">Triage</span> {formatTriage(item)}
        </div>
      )}
      {hasSuggestion(item) ? (
        <div className="ai-suggestion" role="group" aria-label="Suggested triage">
          <div className="ai-suggestion-head">
            <span className="triage-label">Suggested</span> {suggestion.urgency} urgency · {suggestion.team}
          </div>
          {suggestion.rationale && <p className="ai-suggestion-rationale">{suggestion.rationale}</p>}
          <div className="ai-buttons">
            <button
              type="button"
              className="small-button"
              disabled={Boolean(busy)}
              onClick={() => run("accept", () => acceptTriage(user, item.id, { urgency: suggestion.urgency, team: suggestion.team }))}
            >
              {busy === "accept" ? "Saving..." : "Accept"}
            </button>
            <button
              type="button"
              className="small-button secondary"
              disabled={Boolean(busy)}
              onClick={() => run("dismiss", () => dismissTriage(user, item.id))}
            >
              {busy === "dismiss" ? "Clearing..." : "Dismiss"}
            </button>
          </div>
        </div>
      ) : (
        <div className="ai-buttons">
          <button
            type="button"
            className="small-button secondary"
            disabled={Boolean(busy)}
            onClick={() => run("suggest", () => suggestTriage(user, item.id))}
          >
            {busy === "suggest" ? "Thinking..." : "Suggest triage"}
          </button>
          {canSummarize(item) && (
            <button
              type="button"
              className="small-button secondary"
              disabled={Boolean(busy)}
              onClick={() => run("summarize", () => requestSummary(user, item.id))}
            >
              {busy === "summarize" ? "Summarizing..." : "Summarize"}
            </button>
          )}
        </div>
      )}
      {error && <p className="error-message ai-error">{error}</p>}
    </div>
  );
}
