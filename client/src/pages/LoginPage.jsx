import { useState } from "react";
import { login } from "../api";
import { normalizeNric, validateNric } from "../validation";

export function LoginPage({ onLogin }) {
  const [role, setRole] = useState("citizen");
  const [nric, setNric] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [nricError, setNricError] = useState("");
  const [busy, setBusy] = useState(false);

  function handleNricChange(event) {
    setNric(event.target.value);
    if (nricError) setNricError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const validationMessage = validateNric(nric);
    if (validationMessage) {
      setNricError(validationMessage);
      return;
    }
    setNricError("");
    setBusy(true);
    try {
      const session = await login({ nric: normalizeNric(nric), password, role });
      onLogin(session);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="split-layout">
      <section className="intro-panel">
        <div className="eyebrow">A simple way to be heard</div>
        <h1>Help improve<br />our neighbourhood.</h1>
        <p>Share what is working, what needs attention, and what would make your community better.</p>
        <div className="quote-card">
          <span className="quote-mark">“</span>
          Every useful change starts with someone taking a minute to speak up.
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="eyebrow">Secure sign in</div>
          <h2>Welcome to CivicVoice</h2>
          <p className="muted">Use your NRIC and password to continue.</p>
          <div className="role-switch" role="tablist" aria-label="Sign-in mode">
            <button className={role === "citizen" ? "active" : ""} onClick={() => setRole("citizen")} type="button">Public</button>
            <button className={role === "admin" ? "active" : ""} onClick={() => setRole("admin")} type="button">Admin</button>
          </div>
          <form onSubmit={handleSubmit}>
            <label>NRIC
              <input
                value={nric}
                onChange={handleNricChange}
                placeholder="e.g. S0000001A"
                aria-invalid={nricError ? "true" : undefined}
                aria-describedby={nricError ? "nric-error" : undefined}
              />
              {nricError && <span id="nric-error" className="field-error">{nricError}</span>}
            </label>
            <label>Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
            </label>
            {error && <p className="error-message">{error}</p>}
            <button className="primary-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
          <details className="demo-help">
            <summary>Workshop demo accounts</summary>
            <p>Public: S0000001A / citizen123</p>
            <p>Admin: S0000002B / admin123</p>
          </details>
        </div>
      </section>
    </main>
  );
}
