import type { HandshakeStatus, WebSocketLike } from "./types";

interface UnexpectedResponse {
  statusCode?: number;
  statusMessage?: string;
}

interface WebSocketEmitterLike {
  on: (
    eventName: "unexpected-response",
    listener: (request: unknown, response: UnexpectedResponse) => void,
  ) => void;
}

const asEmitter = (
  webSocket: WebSocketLike,
): WebSocketEmitterLike | undefined => {
  const emitter = webSocket as Partial<WebSocketEmitterLike>;
  return typeof emitter.on === "function"
    ? (emitter as WebSocketEmitterLike)
    : undefined;
};

/**
 * The HTTP status of a rejected upgrade is only reachable through the node
 * emitter api of the `ws` package. Registering a listener also opts out of its
 * own abort, so the handshake has to be aborted here: closing while CONNECTING
 * makes `ws` emit `error` then `close`, which drives the usual failure path.
 */
export const listenHandshakeStatus = (
  webSocket: WebSocketLike,
  onHandshakeStatus: (handshakeStatus: HandshakeStatus) => void,
): void => {
  const emitter = asEmitter(webSocket);
  if (!emitter) return;

  emitter.on("unexpected-response", (request, response) => {
    onHandshakeStatus({
      status: response.statusCode ?? 0,
      statusText: response.statusMessage,
    });
    webSocket.close();
  });
};
