import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { ConnectionStates } from "liwi-resources-client";
import createSimpleWebsocketClient from "./createSimpleWebsocketClient.ts";
import { createFakeWebSocket } from "./test-utils/createFakeWebSocket.ts";
import type {
  ConnectionFailure,
  VisibilitySource,
  WebSocketMessageEvent,
} from "./types";

const noop = (): void => {};

/** the client backs off from `reconnectionDelayMin`, so a short real wait is enough */
const waitForReconnect = (): Promise<void> => delay(20);

const immediateReconnectionOptions = {
  reconnectionDelayMin: 1,
  reconnectionDelayMax: 1,
};

interface ControlledVisibilitySource {
  visibilitySource: VisibilitySource;
  setHidden: (hidden: boolean) => void;
  unlistenCallCount: () => number;
}

const createControlledVisibilitySource = (
  initiallyHidden: boolean,
): ControlledVisibilitySource => {
  let hidden = initiallyHidden;
  let unlistenCalls = 0;
  const listeners = new Set<() => void>();

  return {
    visibilitySource: {
      isHidden: () => hidden,
      listen: (listener) => {
        listeners.add(listener);
        return (): void => {
          unlistenCalls++;
          listeners.delete(listener);
        };
      },
    },
    setHidden: (newHidden) => {
      hidden = newHidden;
      listeners.forEach((listener) => {
        listener();
      });
    },
    unlistenCallCount: () => unlistenCalls,
  };
};

describe("createSimpleWebsocketClient", () => {
  describe("websocket implementation injection", () => {
    test("constructs through the injected implementation", () => {
      const { WebSocketImplementation, instances, lastInstance } =
        createFakeWebSocket();

      const client = createSimpleWebsocketClient({
        url: "ws://localhost:3000/ws",
        protocols: ["liwi"],
        webSocketImplementation: WebSocketImplementation,
        onMessage: noop,
      });
      client.connect();

      assert.equal(instances.length, 1);
      assert.equal(lastInstance().url, "ws://localhost:3000/ws");
      assert.deepEqual(lastInstance().protocols, ["liwi"]);
    });

    test("forwards thirdWebsocketArgument as the third constructor argument", () => {
      const { WebSocketImplementation, lastInstance } = createFakeWebSocket();
      const thirdWebsocketArgument = { headers: { authorization: "Bearer a" } };

      const client = createSimpleWebsocketClient({
        url: "ws://localhost:3000/ws",
        webSocketImplementation: WebSocketImplementation,
        thirdWebsocketArgument,
        onMessage: noop,
      });
      client.connect();

      assert.deepEqual(lastInstance().thirdArgument, thirdWebsocketArgument);
    });

    test("getThirdWebsocketArgument wins and is re-invoked on each reconnect", async () => {
      const { WebSocketImplementation, instances, lastInstance } =
        createFakeWebSocket();

      let token = "token-1";
      const client = createSimpleWebsocketClient({
        url: "ws://localhost:3000/ws",
        webSocketImplementation: WebSocketImplementation,
        thirdWebsocketArgument: { headers: { authorization: "static" } },
        getThirdWebsocketArgument: () => ({
          headers: { authorization: token },
        }),
        visibilitySource: false,
        ...immediateReconnectionOptions,
        onMessage: noop,
      });
      client.connect();

      assert.deepEqual(lastInstance().thirdArgument, {
        headers: { authorization: "token-1" },
      });

      token = "token-2";
      lastInstance().emitClose({ code: 1006 });
      await waitForReconnect();

      assert.equal(instances.length, 2);
      assert.deepEqual(lastInstance().thirdArgument, {
        headers: { authorization: "token-2" },
      });
      client.close();
    });

    test("falls back to globalThis.WebSocket", () => {
      const { WebSocketImplementation, instances } = createFakeWebSocket();
      const globalWithWebSocket = globalThis as { WebSocket?: unknown };
      const previousWebSocket = globalWithWebSocket.WebSocket;
      globalWithWebSocket.WebSocket = WebSocketImplementation;

      try {
        const client = createSimpleWebsocketClient({
          url: "ws://localhost:3000/ws",
          onMessage: noop,
        });
        client.connect();
        assert.equal(instances.length, 1);
      } finally {
        globalWithWebSocket.WebSocket = previousWebSocket;
      }
    });

    test("throws a descriptive error when no implementation is available", () => {
      const globalWithWebSocket = globalThis as { WebSocket?: unknown };
      const previousWebSocket = globalWithWebSocket.WebSocket;
      delete globalWithWebSocket.WebSocket;

      try {
        const client = createSimpleWebsocketClient({
          url: "ws://localhost:3000/ws",
          onMessage: noop,
        });
        assert.throws(() => {
          client.connect();
        }, /No WebSocket implementation found/);
      } finally {
        globalWithWebSocket.WebSocket = previousWebSocket;
      }
    });
  });

  describe("visibility awareness", () => {
    test("creation does not throw without any visibility capability", () => {
      const { WebSocketImplementation } = createFakeWebSocket();

      assert.doesNotThrow(() => {
        createSimpleWebsocketClient({
          url: "ws://localhost:3000/ws",
          webSocketImplementation: WebSocketImplementation,
          onMessage: noop,
        });
      });
    });

    test("reconnects immediately instead of parking when no source is detected", async () => {
      const { WebSocketImplementation, instances, lastInstance } =
        createFakeWebSocket();
      const states: ConnectionStates[] = [];

      const client = createSimpleWebsocketClient({
        url: "ws://localhost:3000/ws",
        webSocketImplementation: WebSocketImplementation,
        ...immediateReconnectionOptions,
        onMessage: noop,
      });
      client.listenStateChange((state) => states.push(state));
      client.connect();
      lastInstance().emitClose({ code: 1006 });

      assert.ok(states.includes("reconnect-scheduled"));
      assert.ok(!states.includes("wait-for-visibility"));

      await waitForReconnect();
      assert.equal(instances.length, 2);
      client.close();
    });

    test("parks in wait-for-visibility while hidden, reconnects once visible", async () => {
      const { WebSocketImplementation, instances, lastInstance } =
        createFakeWebSocket();
      const { visibilitySource, setHidden } =
        createControlledVisibilitySource(true);
      const states: ConnectionStates[] = [];

      const client = createSimpleWebsocketClient({
        url: "ws://localhost:3000/ws",
        webSocketImplementation: WebSocketImplementation,
        visibilitySource,
        ...immediateReconnectionOptions,
        onMessage: noop,
      });
      client.listenStateChange((state) => states.push(state));
      client.connect();
      lastInstance().emitClose({ code: 1006 });

      assert.ok(states.includes("wait-for-visibility"));
      await waitForReconnect();
      assert.equal(instances.length, 1);

      setHidden(false);
      await waitForReconnect();
      assert.equal(instances.length, 2);
      client.close();
    });

    test("visibilitySource: false never parks", async () => {
      const { WebSocketImplementation, instances, lastInstance } =
        createFakeWebSocket();
      const states: ConnectionStates[] = [];

      const client = createSimpleWebsocketClient({
        url: "ws://localhost:3000/ws",
        webSocketImplementation: WebSocketImplementation,
        visibilitySource: false,
        ...immediateReconnectionOptions,
        onMessage: noop,
      });
      client.listenStateChange((state) => states.push(state));
      client.connect();
      lastInstance().emitClose({ code: 1006 });

      assert.ok(!states.includes("wait-for-visibility"));
      await waitForReconnect();
      assert.equal(instances.length, 2);
      client.close();
    });

    test("close() unsubscribes from the visibility source", () => {
      const { WebSocketImplementation } = createFakeWebSocket();
      const { visibilitySource, unlistenCallCount } =
        createControlledVisibilitySource(false);

      const client = createSimpleWebsocketClient({
        url: "ws://localhost:3000/ws",
        webSocketImplementation: WebSocketImplementation,
        visibilitySource,
        onMessage: noop,
      });
      client.connect();
      client.close();

      assert.equal(unlistenCallCount(), 1);
    });
  });

  describe("connection failures", () => {
    test("surfaces the close code and keeps reconnecting", () => {
      const { WebSocketImplementation, lastInstance } = createFakeWebSocket();
      const failures: ConnectionFailure[] = [];

      const client = createSimpleWebsocketClient({
        url: "ws://localhost:3000/ws",
        webSocketImplementation: WebSocketImplementation,
        visibilitySource: false,
        onConnectionFailure: (failure) => failures.push(failure),
        onMessage: noop,
      });
      client.connect();
      lastInstance().emitClose({ code: 1006, reason: "", wasClean: false });

      assert.deepEqual(failures, [
        {
          type: "close",
          code: 1006,
          reason: "",
          wasClean: false,
          willReconnect: true,
        },
      ]);
      client.close();
    });

    test("a 401 handshake stops reconnecting and closes", async () => {
      const { WebSocketImplementation, instances, lastInstance } =
        createFakeWebSocket({ withEmitter: true });
      const failures: ConnectionFailure[] = [];
      const states: ConnectionStates[] = [];

      const client = createSimpleWebsocketClient({
        url: "ws://localhost:3000/ws",
        webSocketImplementation: WebSocketImplementation,
        visibilitySource: false,
        ...immediateReconnectionOptions,
        onConnectionFailure: (failure) => failures.push(failure),
        onMessage: noop,
      });
      client.listenStateChange((state) => states.push(state));
      client.connect();

      const socket = lastInstance();
      socket.emitUnexpectedResponse({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
      socket.emitClose({ code: 1006 });

      assert.deepEqual(failures, [
        {
          type: "handshake",
          status: 401,
          statusText: "Unauthorized",
          willReconnect: false,
        },
      ]);
      assert.equal(states.at(-1), "closed");
      assert.ok(socket.closeCallCount >= 1);

      await waitForReconnect();
      assert.equal(instances.length, 1);
    });

    test("a 500 handshake still reconnects", async () => {
      const { WebSocketImplementation, instances, lastInstance } =
        createFakeWebSocket({ withEmitter: true });
      const failures: ConnectionFailure[] = [];

      const client = createSimpleWebsocketClient({
        url: "ws://localhost:3000/ws",
        webSocketImplementation: WebSocketImplementation,
        visibilitySource: false,
        ...immediateReconnectionOptions,
        onConnectionFailure: (failure) => failures.push(failure),
        onMessage: noop,
      });
      client.connect();

      const socket = lastInstance();
      socket.emitUnexpectedResponse({
        statusCode: 500,
        statusMessage: "Internal Server Error",
      });
      socket.emitClose({ code: 1006 });

      assert.equal(failures.length, 1);
      assert.equal(failures[0]?.willReconnect, true);
      await waitForReconnect();
      assert.equal(instances.length, 2);
      client.close();
    });

    test("fires once when both error and close happen", () => {
      const { WebSocketImplementation, lastInstance } = createFakeWebSocket();
      const failures: ConnectionFailure[] = [];
      const errors: unknown[] = [];

      const client = createSimpleWebsocketClient({
        url: "ws://localhost:3000/ws",
        webSocketImplementation: WebSocketImplementation,
        visibilitySource: false,
        onConnectionFailure: (failure) => failures.push(failure),
        onError: (event) => errors.push(event),
        onMessage: noop,
      });
      client.connect();

      const socket = lastInstance();
      socket.emitError({ type: "error", message: "boom" });
      socket.emitClose({ code: 1006 });

      assert.equal(failures.length, 1);
      assert.deepEqual(errors, [{ type: "error", message: "boom" }]);
      client.close();
    });
  });

  describe("messages and state", () => {
    test("connection-ack marks the client connected, other frames reach onMessage", () => {
      const { WebSocketImplementation, lastInstance } = createFakeWebSocket();
      const messages: WebSocketMessageEvent[] = [];

      const client = createSimpleWebsocketClient({
        url: "ws://localhost:3000/ws",
        webSocketImplementation: WebSocketImplementation,
        visibilitySource: false,
        onMessage: (message) => messages.push(message),
      });
      client.connect();

      const socket = lastInstance();
      socket.emitOpen();
      socket.emitMessage("connection-ack");
      assert.equal(client.isConnected(), true);
      assert.deepEqual(messages, []);

      socket.emitMessage("payload");
      assert.deepEqual(messages, [{ data: "payload" }]);
      client.close();
    });

    test("stops after reconnectionAttempts", async () => {
      const { WebSocketImplementation, instances, lastInstance } =
        createFakeWebSocket();

      const client = createSimpleWebsocketClient({
        url: "ws://localhost:3000/ws",
        webSocketImplementation: WebSocketImplementation,
        visibilitySource: false,
        reconnectionAttempts: 1,
        ...immediateReconnectionOptions,
        onMessage: noop,
      });
      client.connect();

      lastInstance().emitClose({ code: 1006 });
      await waitForReconnect();
      assert.equal(instances.length, 2);

      lastInstance().emitClose({ code: 1006 });
      await waitForReconnect();
      assert.equal(instances.length, 2);
      client.close();
    });

    test("close() closes the underlying socket", () => {
      const { WebSocketImplementation, lastInstance } = createFakeWebSocket();

      const client = createSimpleWebsocketClient({
        url: "ws://localhost:3000/ws",
        webSocketImplementation: WebSocketImplementation,
        visibilitySource: false,
        onMessage: noop,
      });
      client.connect();
      const socket = lastInstance();
      socket.emitMessage("connection-ack");
      client.close();

      assert.deepEqual(socket.sentMessages, ["close"]);
      assert.equal(socket.closeCallCount, 1);
    });
  });
});
