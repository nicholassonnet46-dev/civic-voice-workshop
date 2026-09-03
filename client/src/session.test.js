import { describe, expect, it } from "vitest";
import { SESSION_KEY, clearSession, isValidSession, loadSession, saveSession } from "./session.js";

function memoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    store,
  };
}

const session = { token: "abc", user: { nric: "S0000001A", name: "Aisha Rahman", role: "citizen" } };

describe("session storage", () => {
  it("round-trips a valid session", () => {
    const storage = memoryStorage();
    expect(saveSession(storage, session)).toBe(true);
    expect(loadSession(storage)).toEqual(session);
  });

  it("clears the session", () => {
    const storage = memoryStorage();
    saveSession(storage, session);
    clearSession(storage);
    expect(storage.getItem(SESSION_KEY)).toBeNull();
    expect(loadSession(storage)).toBeNull();
  });

  it("returns null when nothing is stored", () => {
    expect(loadSession(memoryStorage())).toBeNull();
    expect(loadSession(null)).toBeNull();
    expect(loadSession(undefined)).toBeNull();
  });

  it("rejects malformed JSON and removes nothing harmful", () => {
    const storage = memoryStorage({ [SESSION_KEY]: "{not json" });
    expect(loadSession(storage)).toBeNull();
  });

  it("rejects and removes stored values with the wrong shape", () => {
    const bad = [
      "null",
      '"string"',
      JSON.stringify({ token: "x" }),
      JSON.stringify({ user: session.user }),
      JSON.stringify({ token: "", user: session.user }),
      JSON.stringify({ token: "x", user: { nric: "S0000001A", name: "A", role: "root" } }),
      JSON.stringify({ token: "x", user: { nric: "", name: "A", role: "citizen" } }),
      JSON.stringify({ token: "x", user: { nric: "S1", name: 5, role: "citizen" } }),
    ];
    for (const value of bad) {
      const storage = memoryStorage({ [SESSION_KEY]: value });
      expect(loadSession(storage), value).toBeNull();
      expect(storage.getItem(SESSION_KEY), value).toBeNull();
    }
  });

  it("only keeps the known user fields when loading", () => {
    const storage = memoryStorage({
      [SESSION_KEY]: JSON.stringify({ token: "t", user: { ...session.user, password: "leak" }, extra: 1 }),
    });
    expect(loadSession(storage)).toEqual({ token: "t", user: session.user });
  });

  it("refuses to save invalid sessions", () => {
    const storage = memoryStorage();
    expect(saveSession(storage, null)).toBe(false);
    expect(saveSession(storage, { token: "t" })).toBe(false);
    expect(saveSession(null, session)).toBe(false);
    expect(storage.getItem(SESSION_KEY)).toBeNull();
  });

  it("swallows storage errors", () => {
    const throwing = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(loadSession(throwing)).toBeNull();
    expect(saveSession(throwing, session)).toBe(false);
    expect(() => clearSession(throwing)).not.toThrow();
  });

  it("validates session shape directly", () => {
    expect(isValidSession(session)).toBe(true);
    expect(isValidSession({ ...session, user: { ...session.user, role: "admin" } })).toBe(true);
    expect(isValidSession({})).toBe(false);
  });
});
