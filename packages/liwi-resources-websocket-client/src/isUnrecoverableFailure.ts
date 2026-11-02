import type { ConnectionFailureCause } from "./types.ts";

export const isUnrecoverableFailure = (
  cause: ConnectionFailureCause,
): boolean =>
  cause.type === "handshake" && cause.status >= 400 && cause.status < 500;
