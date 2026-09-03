// Pure state machine for the "Read aloud" button so the flow can be tested
// without a browser. The component owns the Audio element; this owns the
// states and the labels.

export const READ_ALOUD_STATES = Object.freeze(["idle", "loading", "playing", "paused", "error"]);
export const INITIAL_READ_ALOUD_STATE = "idle";

const TRANSITIONS = {
  idle: { request: "loading", play: "playing" },
  loading: { ready: "playing", fail: "error" },
  playing: { pause: "paused", ended: "idle", fail: "error" },
  paused: { play: "playing", ended: "idle", fail: "error" },
  error: { request: "loading" },
};

// Returns the next state for an event, or the same state when the event does
// not apply. "reset" always returns to idle.
export function nextReadAloudState(state, event) {
  if (event === "reset") return INITIAL_READ_ALOUD_STATE;
  const current = READ_ALOUD_STATES.includes(state) ? state : INITIAL_READ_ALOUD_STATE;
  return TRANSITIONS[current][event] ?? current;
}

export function readAloudLabel(state) {
  switch (state) {
    case "loading": return "Preparing audio…";
    case "playing": return "Pause";
    case "paused": return "Play";
    case "error": return "Try again";
    default: return "Read aloud";
  }
}

// Only offer the action when there is real text to read; blank feedback is
// never sent for synthesis.
export function shouldOfferReadAloud(feedback) {
  return Boolean(feedback?.id) && typeof feedback.message === "string" && feedback.message.trim().length > 0;
}
