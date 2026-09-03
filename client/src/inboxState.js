// Pure fetch-state reducer for the admin inbox. Kept free of React so it can be
// unit-tested in the node environment.
export const initialInboxState = { status: "idle", feedback: [], error: "" };

export function inboxReducer(state, action) {
  switch (action.type) {
    case "load":
      return { ...state, status: "loading", error: "" };
    case "loaded":
      return { status: "ready", feedback: Array.isArray(action.feedback) ? action.feedback : [], error: "" };
    case "replace":
      return {
        ...state,
        feedback: state.feedback.map((item) => (item.id === action.feedback?.id ? action.feedback : item)),
      };
    case "failed":
      return { ...state, status: "error", error: action.error || "Something went wrong." };
    default:
      return state;
  }
}

// Which panel the inbox should show for a given state.
export function inboxView(state) {
  if (state.status === "loading" || state.status === "idle") return "loading";
  if (state.status === "error") return "error";
  if (state.feedback.length === 0) return "empty";
  return "list";
}
