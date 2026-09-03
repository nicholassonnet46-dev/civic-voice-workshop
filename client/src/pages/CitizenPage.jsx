import { useEffect, useRef, useState } from "react";
import { FIELD_IDS, describedBy, errorField } from "../a11y";
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
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState("");
  // Bumped on every failed submit so focus returns to the error even when the
  // same message is shown twice in a row.
  const [errorVersion, setErrorVersion] = useState(0);
  const textareaRef = useRef(null);
  const errorRef = useRef(null);
  const successRef = useRef(null);
  const overLimit = isOverLimit(message);
  const invalidField = errorField(error);

  // Focus the feedback box on first load and again after "Submit another";
  // move focus to the success panel once feedback has been received.
  useEffect(() => {
    if (submitted) successRef.current?.focus();
    else textareaRef.current?.focus();
  }, [submitted]);

  // Move focus to the error so keyboard and screen-reader users find it.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error, errorVersion]);

  function showError(text) {
    setError(text);
    setErrorVersion((version) => version + 1);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!isValidCategory(category)) {
      showError(CATEGORY_REQUIRED_MESSAGE);
      return;
    }
    if (isBlankFeedback(message)) {
      showError(BLANK_FEEDBACK_MESSAGE);
      return;
    }
    if (overLimit) {
      showError(`Feedback must be ${FEEDBACK_MAX_LENGTH} characters or fewer.`);
      return;
    }
    try {
      const response = await submitFeedback({ nric: user.nric, name: user.name, category, message: normalizeFeedback(message) });
      setSubmitted(response.feedback);
      setMessage("");
      setCategory("");
    } catch (requestError) {
      showError(requestError.message);
    }
  }

  function handleSubmitAnother() {
    setSubmitted(null);
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
          <div
            className="success-panel"
            id={FIELD_IDS.success}
            role="status"
            aria-live="polite"
            aria-labelledby={FIELD_IDS.successBanner}
            tabIndex={-1}
            ref={successRef}
          >
            <div className="success-banner" id={FIELD_IDS.successBanner}>
              Thank you. Your feedback has been received.
              {submitted.reference && (
                <> Your reference number is <strong className="reference-number">{submitted.reference}</strong>.</>
              )}
            </div>
            <p className="muted">Keep the reference number if you want to ask about this feedback later. We will review it and act on it where we can.</p>
            <button type="button" className="primary-button" onClick={handleSubmitAnother}>Submit another</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate aria-describedby={FIELD_IDS.hint}>
            <label htmlFor={FIELD_IDS.category}>Category</label>
            <select
              id={FIELD_IDS.category}
              name="category"
              value={category}
              aria-required="true"
              aria-invalid={invalidField === "category" || undefined}
              aria-describedby={describedBy([invalidField === "category" && FIELD_IDS.error])}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">Select a category</option>
              {FEEDBACK_CATEGORIES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <label htmlFor={FIELD_IDS.message}>Your feedback</label>
            <textarea
              id={FIELD_IDS.message}
              name="message"
              ref={textareaRef}
              rows="7"
              value={message}
              maxLength={FEEDBACK_MAX_LENGTH}
              aria-required="true"
              aria-invalid={invalidField === "message" || undefined}
              aria-describedby={describedBy([FIELD_IDS.hint, FIELD_IDS.count, invalidField === "message" && FIELD_IDS.error])}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Share your feedback here..."
            />
            <div id={FIELD_IDS.count} className={overLimit ? "character-count over-limit" : "character-count"}>
              {formatCharacterCount(message)}
            </div>
            <div className="form-footer">
              <span id={FIELD_IDS.hint} className="muted">Please do not include sensitive personal information.</span>
              <button type="submit" className="primary-button" disabled={overLimit}>Submit feedback</button>
            </div>
            <div id={FIELD_IDS.error} className="form-alert" role="alert" aria-live="assertive" tabIndex={-1} ref={errorRef}>
              {error && <p className="error-message">{error}</p>}
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
