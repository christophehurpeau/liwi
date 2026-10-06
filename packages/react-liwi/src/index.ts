import type { ConnectionStates } from "liwi-resources-client";

export { useResource } from "./useResource.ts";
export type {
  PaginatedQueryRequiredParams,
  Pagination,
} from "./usePaginatedResource";
export { usePaginatedResource } from "./usePaginatedResource.ts";
export { useOperation } from "./useOperation.ts";
export type { OperationCallWrapper } from "./useOperation";
export type { ResourceResult } from "./createResourceResultFromState";
export {
  TransportClientProvider,
  TransportClientContext,
  TransportClientStateContext,
  TransportClientReadyContext,
  useTransportClientState,
  useTransportClientIsReady,
} from "./TransportClientProvider.tsx";
export { ResourcesServerError } from "liwi-resources-client";

export type SimplifiedConnectionState =
  | "connected"
  | "connecting"
  | "disconnected";

export const transportClientStateToSimplifiedState = (
  state: ConnectionStates,
): SimplifiedConnectionState => {
  switch (state) {
    case "opening":
    case "connecting":
    case "reconnect-scheduled":
    case "wait-for-visibility":
      return "connecting";

    case "connected":
      return "connected";

    case "closed":
      return "disconnected";

    default:
      throw new Error("Invalid state");
  }
};
