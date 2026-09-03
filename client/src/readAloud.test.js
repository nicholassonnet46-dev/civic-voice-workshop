import { describe, expect, it } from "vitest";
import {
  INITIAL_READ_ALOUD_STATE,
  READ_ALOUD_STATES,
  nextReadAloudState,
  readAloudLabel,
  shouldOfferReadAloud,
} from "./readAloud.js";

describe("read aloud state machine", () => {
  it("starts idle and moves through request, ready, pause, play, and ended", () => {
    let state = INITIAL_READ_ALOUD_STATE;
    expect(state).toBe("idle");
    state = nextReadAloudState(state, "request");
    expect(state).toBe("loading");
    state = nextReadAloudState(state, "ready");
    expect(state).toBe("playing");
    state = nextReadAloudState(state, "pause");
    expect(state).toBe("paused");
    state = nextReadAloudState(state, "play");
    expect(state).toBe("playing");
    state = nextReadAloudState(state, "ended");
    expect(state).toBe("idle");
  });

  it("replays cached audio straight from idle", () => {
    expect(nextReadAloudState("idle", "play")).toBe("playing");
  });

  it("moves to error on failure and back to loading on retry", () => {
    expect(nextReadAloudState("loading", "fail")).toBe("error");
    expect(nextReadAloudState("playing", "fail")).toBe("error");
    expect(nextReadAloudState("error", "request")).toBe("loading");
  });

  it("ignores events that do not apply and always honours reset", () => {
    expect(nextReadAloudState("idle", "pause")).toBe("idle");
    expect(nextReadAloudState("loading", "request")).toBe("loading");
    expect(nextReadAloudState("paused", "ready")).toBe("paused");
    for (const state of READ_ALOUD_STATES) expect(nextReadAloudState(state, "reset")).toBe("idle");
    expect(nextReadAloudState("bogus", "request")).toBe("loading");
  });

  it("labels every state for the button", () => {
    expect(readAloudLabel("idle")).toBe("Read aloud");
    expect(readAloudLabel("loading")).toMatch(/preparing/i);
    expect(readAloudLabel("playing")).toBe("Pause");
    expect(readAloudLabel("paused")).toBe("Play");
    expect(readAloudLabel("error")).toMatch(/try again/i);
  });
});

describe("shouldOfferReadAloud", () => {
  it("offers the action only for saved feedback with real text", () => {
    expect(shouldOfferReadAloud({ id: "abc", message: "Please add more benches." })).toBe(true);
    expect(shouldOfferReadAloud({ id: "abc", message: "   \n" })).toBe(false);
    expect(shouldOfferReadAloud({ id: "abc", message: "" })).toBe(false);
    expect(shouldOfferReadAloud({ id: "abc" })).toBe(false);
    expect(shouldOfferReadAloud({ message: "No id yet." })).toBe(false);
    expect(shouldOfferReadAloud(null)).toBe(false);
  });
});
