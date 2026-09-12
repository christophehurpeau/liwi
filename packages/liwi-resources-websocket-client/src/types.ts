export interface WebSocketCloseEvent {
  code?: number;
  reason?: string;
  wasClean?: boolean;
}

export interface WebSocketMessageEvent {
  data: unknown;
}

export interface WebSocketLike {
  send: (data: string) => void;
  close: () => void;
  addEventListener: (type: string, listener: (event: unknown) => void) => void;
}

export type WebSocketConstructorLike = new (
  url: string,
  protocols?: string[] | string,
  thirdArgument?: unknown,
) => WebSocketLike;

export interface VisibilitySource {
  isHidden: () => boolean;
  listen: (listener: () => void) => () => void;
}

export interface HandshakeStatus {
  status: number;
  statusText: string | undefined;
}

export interface HandshakeFailureCause extends HandshakeStatus {
  type: "handshake";
}

export interface CloseFailureCause {
  type: "close";
  code: number;
  reason: string;
  wasClean: boolean;
}

export type ConnectionFailureCause = CloseFailureCause | HandshakeFailureCause;

export type ConnectionFailure = ConnectionFailureCause & {
  willReconnect: boolean;
};
