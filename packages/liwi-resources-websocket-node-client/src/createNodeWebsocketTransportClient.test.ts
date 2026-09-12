import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type {
  WebSocketConstructorLike,
  WebSocketLike,
} from "liwi-resources-websocket-client";
import { createNodeWebsocketTransportClient } from "./createNodeWebsocketTransportClient.ts";

interface FakeSocket extends WebSocketLike {
  thirdArgument: unknown;
  emit: (type: string, event: unknown) => void;
}

interface FakeWebSocketFactory {
  WebSocketImplementation: WebSocketConstructorLike;
  instances: FakeSocket[];
}

const createFakeWebSocket = (): FakeWebSocketFactory => {
  const instances: FakeSocket[] = [];

  const WebSocketImplementation = function FakeWebSocket(
    url: string,
    protocols?: string[] | string,
    thirdArgument?: unknown,
  ): FakeSocket {
    const listeners = new Map<string, ((event: unknown) => void)[]>();
    const instance: FakeSocket = {
      thirdArgument,
      send: () => {},
      close: () => {},
      addEventListener: (type, listener) => {
        const typeListeners = listeners.get(type);
        if (typeListeners) typeListeners.push(listener);
        else listeners.set(type, [listener]);
      },
      emit: (type, event) => {
        listeners.get(type)?.forEach((listener) => {
          listener(event);
        });
      },
    };
    instances.push(instance);
    return instance;
  } as unknown as WebSocketConstructorLike;

  return { WebSocketImplementation, instances };
};

describe("createNodeWebsocketTransportClient", () => {
  test("passes headers as the third constructor argument", () => {
    const { WebSocketImplementation, instances } = createFakeWebSocket();

    const client = createNodeWebsocketTransportClient({
      url: "ws://localhost:4005/ws",
      webSocketImplementation: WebSocketImplementation,
      headers: { authorization: "Bearer token" },
    });
    client.connect();

    assert.deepEqual(instances[0]?.thirdArgument, {
      headers: { authorization: "Bearer token" },
    });
    client.close();
  });

  test("re-evaluates a headers function on every connection attempt", async () => {
    const { WebSocketImplementation, instances } = createFakeWebSocket();

    let token = "token-1";
    const client = createNodeWebsocketTransportClient({
      url: "ws://localhost:4005/ws",
      webSocketImplementation: WebSocketImplementation,
      reconnectionDelayMin: 1,
      reconnectionDelayMax: 1,
      headers: () => ({ authorization: token }),
    });
    client.connect();

    assert.deepEqual(instances[0]?.thirdArgument, {
      headers: { authorization: "token-1" },
    });

    token = "token-2";
    instances[0].emit("close", { code: 1006, reason: "", wasClean: false });
    await delay(20);

    assert.equal(instances.length, 2);
    assert.deepEqual(instances[1]?.thirdArgument, {
      headers: { authorization: "token-2" },
    });
    client.close();
  });

  test("merges webSocketOptions under the headers", () => {
    const { WebSocketImplementation, instances } = createFakeWebSocket();

    const client = createNodeWebsocketTransportClient({
      url: "ws://localhost:4005/ws",
      webSocketImplementation: WebSocketImplementation,
      webSocketOptions: {
        handshakeTimeout: 5000,
        headers: { "user-agent": "liwi", authorization: "overridden" },
      },
      headers: { authorization: "Bearer token" },
    });
    client.connect();

    assert.deepEqual(instances[0]?.thirdArgument, {
      handshakeTimeout: 5000,
      headers: {
        "user-agent": "liwi",
        authorization: "Bearer token",
      },
    });
    client.close();
  });

  test("never waits for visibility, even with a document present", async () => {
    const { WebSocketImplementation, instances } = createFakeWebSocket();
    const globalWithDocument = globalThis as { document?: unknown };
    const previousDocument = globalWithDocument.document;
    globalWithDocument.document = {
      visibilityState: "hidden",
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    try {
      const states: string[] = [];
      const client = createNodeWebsocketTransportClient({
        url: "ws://localhost:4005/ws",
        webSocketImplementation: WebSocketImplementation,
        reconnectionDelayMin: 1,
        reconnectionDelayMax: 1,
      });
      client.listenStateChange((state) => states.push(state));
      client.connect();
      instances[0]?.emit("close", { code: 1006, reason: "", wasClean: false });
      await delay(20);

      assert.ok(!states.includes("wait-for-visibility"));
      assert.equal(instances.length, 2);
      client.close();
    } finally {
      if (previousDocument === undefined) delete globalWithDocument.document;
      else globalWithDocument.document = previousDocument;
    }
  });
});
