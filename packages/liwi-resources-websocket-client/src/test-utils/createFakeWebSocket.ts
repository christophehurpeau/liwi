import type { WebSocketConstructorLike, WebSocketLike } from "../types";

export interface FakeWebSocketInstance extends WebSocketLike {
  url: string;
  protocols: string[] | string | undefined;
  thirdArgument: unknown;
  sentMessages: string[];
  closeCallCount: number;
  emitOpen: () => void;
  emitMessage: (data: unknown) => void;
  emitClose: (event?: {
    code?: number;
    reason?: string;
    wasClean?: boolean;
  }) => void;
  emitError: (event?: unknown) => void;
  emitUnexpectedResponse: (response: {
    statusCode?: number;
    statusMessage?: string;
  }) => void;
}

export interface FakeWebSocketFactory {
  WebSocketImplementation: WebSocketConstructorLike;
  instances: FakeWebSocketInstance[];
  lastInstance: () => FakeWebSocketInstance;
}

export interface CreateFakeWebSocketOptions {
  /** impersonates the node emitter api of the `ws` package */
  withEmitter?: boolean;
}

export const createFakeWebSocket = ({
  withEmitter = false,
}: CreateFakeWebSocketOptions = {}): FakeWebSocketFactory => {
  const instances: FakeWebSocketInstance[] = [];

  const WebSocketImplementation = function FakeWebSocket(
    url: string,
    protocols?: string[] | string,
    thirdArgument?: unknown,
  ): FakeWebSocketInstance {
    const listeners = new Map<string, ((event: unknown) => void)[]>();
    const emitterListeners = new Map<
      string,
      ((...args: unknown[]) => void)[]
    >();

    const emit = (type: string, event: unknown): void => {
      listeners.get(type)?.forEach((listener) => {
        listener(event);
      });
    };

    const instance: FakeWebSocketInstance = {
      url,
      protocols,
      thirdArgument,
      sentMessages: [],
      closeCallCount: 0,

      send(data) {
        instance.sentMessages.push(data);
      },
      close() {
        instance.closeCallCount++;
      },
      addEventListener(type, listener) {
        const typeListeners = listeners.get(type);
        if (typeListeners) typeListeners.push(listener);
        else listeners.set(type, [listener]);
      },

      emitOpen: () => {
        emit("open", {});
      },
      emitMessage: (data) => {
        emit("message", { data });
      },
      emitClose: (event = {}) => {
        emit("close", {
          code: event.code ?? 1006,
          reason: event.reason ?? "",
          wasClean: event.wasClean ?? false,
        });
      },
      emitError: (event = { type: "error" }) => {
        emit("error", event);
      },
      emitUnexpectedResponse: (response) => {
        emitterListeners
          .get("unexpected-response")
          ?.forEach((listener) => listener({}, response));
      },
    };

    if (withEmitter) {
      Object.assign(instance, {
        on(eventName: string, listener: (...args: unknown[]) => void): void {
          const eventListeners = emitterListeners.get(eventName);
          if (eventListeners) eventListeners.push(listener);
          else emitterListeners.set(eventName, [listener]);
        },
      });
    }

    instances.push(instance);
    return instance;
  } as unknown as WebSocketConstructorLike;

  return {
    WebSocketImplementation,
    instances,
    lastInstance: () => {
      const instance = instances.at(-1);
      if (!instance) throw new Error("no websocket was constructed");
      return instance;
    },
  };
};
