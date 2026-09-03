import { useState } from "react";
import { submitFeedback } from "../api";
import { CATEGORY_REQUIRED_MESSAGE, FEEDBACK_CATEGORIES, isValidCategory } from "../categories";
import {
  BLANK_FEEDBACK_MESSAGE,
  FEEDBACK_MAX_LENGTH,
  formatCharacterCount,
  isBlankFeedback,
  isOverLimit,
  normalizeFeedback,
} from "../feedback";

export function CitizenPage({ user }) {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const overLimit = isOverLimit(message);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!isValidCategory(category)) {
      setError(CATEGORY_REQUIRED_MESSAGE);
      return;
    }
    if (isBlankFeedback(message)) {
      setError(BLANK_FEEDBACK_MESSAGE);
      return;
    }
    if (overLimit) {
      setError(`Feedback must be ${FEEDBACK_MAX_LENGTH} characters or fewer.`);
      return;
    }
    try {
      await submitFeedback({ nric: user.nric, name: user.name, category, message: normalizeFeedback(message) });
      setSubmitted(true);
      setMessage("");
      setCategory("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function handleSubmitAnother() {
    setSubmitted(false);
    setMessage("");
    setCategory("");
    setError("");
  }

  return (
    <main className="page-shell">
      <div className="page-heading">
        <div className="eyebrow">Public feedback</div>
        <h1>What would you like us to know?</h1>
        <p>Tell us about an issue, an idea, or a positive experience in your community.</p>
      </div>
      <section className="form-card">
        {submitted ? (
          <div className="success-panel">
            <div className="success-banner">Thank you. Your feedback has been received.</div>
            <p className="muted">We will review your feedback and act on it where we can.</p>
            <button type="button" className="primary-button" onClick={handleSubmitAnother}>Submit another</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>Category
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">Select a category</option>
                {FEEDBACK_CATEGORIES.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>Your feedback
              <textarea
                rows="7"
                value={message}
                maxLength={FEEDBACK_MAX_LENGTH}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Share your feedback here..."
              />
            </label>
            <div className={overLimit ? "character-count over-limit" : "character-count"}>{formatCharacterCount(message)}</div>
            <div className="form-footer">
              <span className="muted">Please do not include sensitive personal information.</span>
              <button className="primary-button" disabled={overLimit}>Submit feedback</button>
            </div>
            {error && <p className="error-message">{error}</p>}
          </form>
        )}
      </section>
    </main>
  );
}
