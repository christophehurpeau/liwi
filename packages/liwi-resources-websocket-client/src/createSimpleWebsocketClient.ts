import Backoff from "backo2";
import type { ConnectionStates } from "liwi-resources-client";
import { detectVisibilitySource } from "./detectVisibilitySource.ts";
import { isUnrecoverableFailure } from "./isUnrecoverableFailure.ts";
import { listenHandshakeStatus } from "./listenHandshakeStatus.ts";
import type {
  ConnectionFailure,
  ConnectionFailureCause,
  HandshakeStatus,
  VisibilitySource,
  WebSocketCloseEvent,
  WebSocketConstructorLike,
  WebSocketLike,
  WebSocketMessageEvent,
} from "./types";

export type StateChangeListener = (newState: ConnectionStates) => void;

export type StateChangeListenerCreator = (
  listener: StateChangeListener,
) => () => void;

export interface SimpleWebsocketClientOptions {
  url: string;
  protocols?: string[] | string;
  timeout?: number;
  reconnection?: boolean;
  reconnectionDelayMin?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
  inactivityTimeout?: number;
  webSocketImplementation?: WebSocketConstructorLike;
  thirdWebsocketArgument?: unknown;
  getThirdWebsocketArgument?: () => unknown;
  visibilitySource?: VisibilitySource | false;
  onMessage: (message: WebSocketMessageEvent) => void;
  onError?: (event: unknown) => void;
  onConnectionFailure?: (failure: ConnectionFailure) => void;
}

export interface WebsocketTransport {
  connect: () => void;
  close: () => void;
  isConnected: () => boolean;
  sendMessage: (message: string) => void;
  listenStateChange: StateChangeListenerCreator;
}

type Timeouts = "inactivity" | "maxConnect" | "tryReconnect";

const ABNORMAL_CLOSURE_CODE = 1006;

const resolveWebSocketImplementation = (
  webSocketImplementation: WebSocketConstructorLike | undefined,
): WebSocketConstructorLike => {
  if (webSocketImplementation) return webSocketImplementation;

  const { WebSocket: globalWebSocket } = globalThis as {
    WebSocket?: WebSocketConstructorLike;
  };
  if (!globalWebSocket) {
    throw new Error(
      "No WebSocket implementation found, pass `webSocketImplementation`",
    );
  }
  return globalWebSocket;
};

export default function createSimpleWebsocketClient({
  url,
  protocols,
  reconnection = true,
  reconnectionDelayMin = 1000,
  reconnectionDelayMax = 30 * 1000,
  reconnectionAttempts = Infinity,
  webSocketImplementation,
  thirdWebsocketArgument,
  getThirdWebsocketArgument,
  visibilitySource,
  onMessage,
  onError,
  onConnectionFailure,
}: SimpleWebsocketClientOptions): WebsocketTransport {
  let ws: WebSocketLike | null = null;
  let currentState: ConnectionStates = "closed";
  let isConnected = false;
  const stateChangeListeners = new Set<StateChangeListener>();

  const visibility =
    visibilitySource === false
      ? undefined
      : (visibilitySource ?? detectVisibilitySource());

  const backoff = new Backoff({
    min: reconnectionDelayMin,
    max: reconnectionDelayMax,
    factor: 1.2,
  });

  const timeouts: Record<Timeouts, ReturnType<typeof setTimeout> | null> = {
    maxConnect: null,
    tryReconnect: null,
    inactivity: null,
  };

  const setCurrentState = (newState: ConnectionStates): void => {
    if (currentState === newState) return;
    currentState = newState;
    isConnected = currentState === "connected";
    stateChangeListeners.forEach((listener) => {
      listener(newState);
    });
  };

  const clearInternalTimeout = (timeoutKey: Timeouts): void => {
    const timeout = timeouts[timeoutKey];
    if (timeout) {
      clearTimeout(timeout);
      timeouts[timeoutKey] = null;
    }
  };

  const closeWebsocket = (): void => {
    clearInternalTimeout("inactivity");
    if (ws) {
      clearInternalTimeout("maxConnect");
      clearInternalTimeout("tryReconnect");
      const closingWebsocket = ws;
      ws = null;
      setCurrentState("closed");
      closingWebsocket.close();
    }
  };

  let tryReconnect: (() => void) | undefined;

  const connect = (): void => {
    const WebSocketImplementation = resolveWebSocketImplementation(
      webSocketImplementation,
    );
    const thirdArgument = getThirdWebsocketArgument
      ? getThirdWebsocketArgument()
      : thirdWebsocketArgument;
    const webSocket: WebSocketLike = thirdArgument
      ? new WebSocketImplementation(url, protocols, thirdArgument)
      : new WebSocketImplementation(url, protocols);
    ws = webSocket;
    clearInternalTimeout("maxConnect");
    setCurrentState("connecting");

    let handshakeStatus: HandshakeStatus | undefined;
    let failureHandled = false;

    listenHandshakeStatus(webSocket, (receivedHandshakeStatus) => {
      handshakeStatus = receivedHandshakeStatus;
    });

    const buildFailureCause = (
      closeEvent: WebSocketCloseEvent | undefined,
    ): ConnectionFailureCause => {
      if (handshakeStatus) return { type: "handshake", ...handshakeStatus };
      return {
        type: "close",
        code: closeEvent?.code ?? ABNORMAL_CLOSURE_CODE,
        reason: closeEvent?.reason ?? "",
        wasClean: closeEvent?.wasClean ?? false,
      };
    };

    const handleConnectionFailure = (
      closeEvent: WebSocketCloseEvent | undefined,
    ): void => {
      if (failureHandled) return;
      failureHandled = true;
      if (currentState === "closed") return;

      const reconnectAfterFailure = tryReconnect;
      const cause = buildFailureCause(closeEvent);
      const willReconnect =
        reconnectAfterFailure !== undefined && !isUnrecoverableFailure(cause);

      if (onConnectionFailure) {
        onConnectionFailure({ ...cause, willReconnect });
      }

      if (!willReconnect) {
        closeWebsocket();
      } else if (visibility?.isHidden()) {
        setCurrentState("wait-for-visibility");
      } else {
        reconnectAfterFailure();
      }
    };

    webSocket.addEventListener("open", (): void => {
      backoff.reset();
      clearInternalTimeout("maxConnect");
    });

    webSocket.addEventListener("close", (event): void => {
      handleConnectionFailure(event as WebSocketCloseEvent);
    });

    webSocket.addEventListener("message", (event): void => {
      const message = event as WebSocketMessageEvent;
      if (message.data === "connection-ack") {
        setCurrentState("connected");
      } else {
        onMessage(message);
      }
    });

    webSocket.addEventListener("error", (event): void => {
      if (onError) {
        onError(event);
      } else {
        console.error("ws error", event);
      }
      handleConnectionFailure(undefined);
    });
  };

  if (reconnection) {
    tryReconnect = () => {
      if (backoff.attempts >= reconnectionAttempts) {
        return;
      }

      if (currentState === "reconnect-scheduled") {
        return;
      }

      setCurrentState("reconnect-scheduled");
      clearInternalTimeout("tryReconnect");
      const delay = backoff.duration();
      timeouts.tryReconnect = setTimeout(() => {
        connect();
      }, delay);
    };
  }

  const visibilityChangeHandler: (() => void) | undefined =
    !tryReconnect || !visibility
      ? undefined
      : () => {
          if (visibility.isHidden()) {
            if (currentState === "reconnect-scheduled") {
              setCurrentState("wait-for-visibility");
              clearInternalTimeout("tryReconnect");
            }
            return;
          }
          if (currentState !== "wait-for-visibility") return;

          if (tryReconnect) {
            backoff.reset();
            tryReconnect();
          }
        };

  const unlistenVisibilityChange =
    visibility && visibilityChangeHandler
      ? visibility.listen(visibilityChangeHandler)
      : undefined;

  const wsTransport: WebsocketTransport = {
    connect,

    close() {
      if (ws) {
        if (currentState === "connected") {
          ws.send("close");
        }
        closeWebsocket();
      }
      if (unlistenVisibilityChange) {
        unlistenVisibilityChange();
      }
    },

    isConnected() {
      return isConnected;
    },

    sendMessage(message): void {
      if (!ws) throw new Error("Cannot send message");
      ws.send(message);
    },

    listenStateChange: (listener) => {
      stateChangeListeners.add(listener);
      return (): void => {
        stateChangeListeners.delete(listener);
      };
    },
  };

  return wsTransport;
}
