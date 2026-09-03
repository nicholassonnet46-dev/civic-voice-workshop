import { describe, expect, it } from "vitest";
import { inboxReducer, inboxView, initialInboxState } from "./inboxState.js";

const items = [{ id: "1", name: "Aisha Rahman", message: "Hello", status: "New" }];

describe("inboxReducer", () => {
  it("moves to loading and clears any previous error", () => {
    const errored = { status: "error", feedback: [], error: "Boom" };
    expect(inboxReducer(errored, { type: "load" })).toEqual({ status: "loading", feedback: [], error: "" });
  });

  it("stores the feedback when loaded", () => {
    expect(inboxReducer(initialInboxState, { type: "loaded", feedback: items })).toEqual({ status: "ready", feedback: items, error: "" });
  });

  it("guards against a missing feedback array", () => {
    expect(inboxReducer(initialInboxState, { type: "loaded" }).feedback).toEqual([]);
  });

  it("records the error message on failure and keeps previously loaded items", () => {
    const ready = inboxReducer(initialInboxState, { type: "loaded", feedback: items });
    const failed = inboxReducer(ready, { type: "failed", error: "Admin access required." });
    expect(failed).toEqual({ status: "error", feedback: items, error: "Admin access required." });
  });

  it("falls back to a generic error message", () => {
    expect(inboxReducer(initialInboxState, { type: "failed" }).error).toBe("Something went wrong.");
  });

  it("replaces a single item in place and keeps the ready status", () => {
    const ready = inboxReducer(initialInboxState, { type: "loaded", feedback: items });
    const updated = inboxReducer(ready, { type: "replace", feedback: { ...items[0], status: "Closed" } });
    expect(updated.status).toBe("ready");
    expect(updated.feedback).toEqual([{ ...items[0], status: "Closed" }]);
    expect(inboxReducer(ready, { type: "replace", feedback: { id: "missing" } }).feedback).toEqual(items);
  });

  it("ignores unknown actions", () => {
    expect(inboxReducer(initialInboxState, { type: "nope" })).toBe(initialInboxState);
  });

  it("supports a retry cycle: error -> loading -> ready", () => {
    let state = inboxReducer(initialInboxState, { type: "load" });
    state = inboxReducer(state, { type: "failed", error: "Network down" });
    state = inboxReducer(state, { type: "load" });
    expect(state.status).toBe("loading");
    expect(state.error).toBe("");
    state = inboxReducer(state, { type: "loaded", feedback: items });
    expect(state.status).toBe("ready");
  });
});

describe("inboxView", () => {
  it("shows loading for idle and loading states", () => {
    expect(inboxView(initialInboxState)).toBe("loading");
    expect(inboxView({ ...initialInboxState, status: "loading" })).toBe("loading");
  });

  it("shows error, empty, and list states distinctly", () => {
    expect(inboxView({ status: "error", feedback: [], error: "x" })).toBe("error");
    expect(inboxView({ status: "ready", feedback: [], error: "" })).toBe("empty");
    expect(inboxView({ status: "ready", feedback: items, error: "" })).toBe("list");
  });
});
