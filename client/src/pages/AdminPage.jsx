import { useCallback, useEffect, useReducer, useState } from "react";
import { getFeedback, updateStatus } from "../api";
import { inboxReducer, inboxView, initialInboxState } from "../inboxState";
import { maskIdentifier } from "../mask";
import { normalizeQuery, searchFeedback } from "../search";
import { sortNewestFirst } from "../sortFeedback";
import { summarizeFeedback, summaryCards } from "../summary";

const STATUSES = ["New", "In review", "Closed"];

export function AdminPage({ user }) {
  const [state, dispatch] = useReducer(inboxReducer, initialInboxState);
  const [query, setQuery] = useState("");
  const { feedback, error } = state;
  const view = inboxView(state);
  const [actionError, setActionError] = useState("");
  const visible = searchFeedback(feedback, query);
  const searching = normalizeQuery(query).length > 0;
  const cards = summaryCards(summarizeFeedback(feedback));

  const load = useCallback(() => {
    let cancelled = false;
    dispatch({ type: "load" });
    getFeedback(user)
      .then((response) => { if (!cancelled) dispatch({ type: "loaded", feedback: sortNewestFirst(response.feedback) }); })
      .catch((requestError) => { if (!cancelled) dispatch({ type: "failed", error: requestError.message }); });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => load(), [load]);

  async function handleStatusChange(id, status) {
    setActionError("");
    try {
      const response = await updateStatus(user, id, status);
      dispatch({ type: "replace", feedback: response.feedback });
    } catch (requestError) {
      setActionError(requestError.message);
    }
  }

  return (
    <main className="page-shell admin-shell">
      <div className="page-heading">
        <div className="eyebrow">Admin workspace</div>
        <h1>Feedback inbox</h1>
        <p>A simple view of feedback received from members of the public.</p>
      </div>
      {actionError && <p className="error-message">{actionError}</p>}
      {view === "list" && (
        <section className="summary-cards" aria-label="Inbox summary">
          {cards.map((card) => (
            <div className={`summary-card summary-${card.key}`} key={card.key}>
              <span className="summary-label">{card.label}</span>
              <strong className="summary-value">{card.value}</strong>
            </div>
          ))}
        </section>
      )}
      <section className="feedback-list" aria-busy={view === "loading"}>
        <div className="list-header">
          <strong>Latest feedback</strong>
          <span>
            {view === "list" ? (searching ? `${visible.length} of ${feedback.length} items` : `${feedback.length} items`) : view === "loading" ? "Loading…" : ""}
          </span>
        </div>
        {view === "list" && (
          <div className="inbox-controls">
            <label className="search-field">
              <span className="visually-hidden">Search feedback</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search messages or names…"
                aria-label="Search feedback by message or citizen name"
              />
            </label>
            {searching && <button type="button" className="text-button" onClick={() => setQuery("")}>Clear</button>}
          </div>
        )}
        {view === "loading" && (
          <div className="inbox-state inbox-loading" role="status">
            <span className="spinner" aria-hidden="true" />
            <p>Loading feedback…</p>
          </div>
        )}
        {view === "error" && (
          <div className="inbox-state inbox-error" role="alert">
            <strong>Couldn’t load the inbox</strong>
            <p className="error-message">{error}</p>
            <button type="button" className="primary-button" onClick={load}>Retry</button>
          </div>
        )}
        {view === "empty" && (
          <div className="inbox-state inbox-empty">
            <strong>No feedback yet</strong>
            <p>New submissions from members of the public will appear here.</p>
          </div>
        )}
        {view === "list" && searching && visible.length === 0 && (
          <div className="inbox-state inbox-empty" role="status">
            <strong>No feedback matches “{query.trim()}”</strong>
            <p>Try a different keyword, or clear the search to see all {feedback.length} items.</p>
          </div>
        )}
        {view === "list" && visible.map((item) => (
          <article className="feedback-row" key={item.id}>
            <div>
              <div className="feedback-meta">
                {item.name}
                {item.nric && <> · <span className="masked-id" title="Identifier masked">{maskIdentifier(item.nric)}</span></>}
                {" · "}{item.category}
                {" · "}{new Date(item.createdAt).toLocaleDateString()}
              </div>
              {/* Feedback is rendered as text only. Never use dangerouslySetInnerHTML here. */}
              <p className="feedback-message">{item.message}</p>
            </div>
            <select
              className="status-select"
              aria-label={`Status for feedback from ${item.name}`}
              value={item.status}
              onChange={(event) => handleStatusChange(item.id, event.target.value)}
            >
              {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </article>
        ))}
      </section>
    </main>
  );
}
