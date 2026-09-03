import { useEffect, useState } from "react";
import { API_URL } from "../api";
import { HEALTH_POLL_INTERVAL_MS, checkHealth, describeHealth, initialHealthState, reduceHealth } from "../health";

export function HealthIndicator({ intervalMs = HEALTH_POLL_INTERVAL_MS }) {
  const [state, setState] = useState(initialHealthState);

  useEffect(() => {
    let active = true;
    async function probe() {
      const event = await checkHealth({ url: `${API_URL}/api/health` });
      if (active) setState((current) => reduceHealth(current, event));
    }
    probe();
    const timer = setInterval(probe, intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return (
    <p className={`health-indicator health-${state.status}`} role="status" aria-live="polite" data-status={state.status}>
      <span className="health-dot" aria-hidden="true" />
      {describeHealth(state)}
    </p>
  );
}
