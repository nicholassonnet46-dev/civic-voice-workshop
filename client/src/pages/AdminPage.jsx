import { useEffect, useState } from "react";
import { getFeedback, updateStatus } from "../api";
import { maskIdentifier } from "../mask";
import { sortNewestFirst } from "../sortFeedback";

const STATUSES = ["New", "In review", "Closed"];

export function AdminPage({ user }) {
  const [feedback, setFeedback] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getFeedback(user).then((response) => setFeedback(sortNewestFirst(response.feedback))).catch((requestError) => setError(requestError.message));
  }, [user]);

  async function handleStatusChange(id, status) {
    setError("");
    try {
      const response = await updateStatus(user, id, status);
      setFeedback((current) => current.map((item) => (item.id === id ? response.feedback : item)));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <main className="page-shell admin-shell">
      <div className="page-heading">
        <div className="eyebrow">Admin workspace</div>
        <h1>Feedback inbox</h1>
        <p>A simple view of feedback received from members of the public.</p>
      </div>
      {error && <p className="error-message">{error}</p>}
      <section className="feedback-list">
        <div className="list-header"><strong>Latest feedback</strong><span>{feedback.length} items</span></div>
        {feedback.map((item) => (
          <article className="feedback-row" key={item.id}>
            <div>
              <div className="feedback-meta">
                {item.name}
                {item.nric && <> · <span className="masked-id" title="Identifier masked">{maskIdentifier(item.nric)}</span></>}
                {" · "}{item.category}
                {" · "}{new Date(item.createdAt).toLocaleDateString()}
              </div>
              <p>{item.message}</p>
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
