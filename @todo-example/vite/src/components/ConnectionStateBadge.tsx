import type { ReactNode } from "react";
import { transportClientStateToSimplifiedState } from "react-liwi";
import "./ConnectionStateBadge.css";

interface ConnectionStateBadgeProps {
  transportClientState: Parameters<
    typeof transportClientStateToSimplifiedState
  >[0];
}

export function ConnectionStateBadge({
  transportClientState,
}: ConnectionStateBadgeProps): ReactNode {
  const state = transportClientStateToSimplifiedState(transportClientState);
  return (
    <div
      role="status"
      className={`connection-state connection-state-${state}`}
      aria-live="polite"
    >
      <span className="connection-state-label">{state}</span>
    </div>
  );
}
