import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { decode, encode } from "extended-json";
import createWebsocketTransportClient from "./createWebsocketTransportClient.ts";
import { createFakeWebSocket } from "./test-utils/createFakeWebSocket.ts";

const fetchPayload = {
  resourceName: "todos",
  key: "todos",
  params: undefined,
};

const withLocation = (
  location: { host: string; protocol: string } | undefined,
  run: () => void,
): void => {
  const globalWithLocation = globalThis as { location?: unknown };
  const previousLocation = globalWithLocation.location;
  if (location) globalWithLocation.location = location;
  else delete globalWithLocation.location;

  try {
    run();
  } finally {
    if (previousLocation === undefined) delete globalWithLocation.location;
    else globalWithLocation.location = previousLocation;
  }
};

describe("createWebsocketTransportClient", () => {
  test("returns a working client on a node host", async () => {
    assert.equal(
      (globalThis as { window?: unknown }).window,
      undefined,
      "this test asserts the absence of the removed SSR stub, it needs a node host",
    );

    const { WebSocketImplementation, instances, lastInstance } =
      createFakeWebSocket();

    const client = createWebsocketTransportClient({
      url: "ws://localhost:3000/ws",
      webSocketImplementation: WebSocketImplementation,
      visibilitySource: false,
    });

    client.connect();
    assert.equal(instances.length, 1);

    const socket = lastInstance();
    socket.emitOpen();
    socket.emitMessage("connection-ack");

    const sendPromise = client.send("fetch", fetchPayload);
    const sentMessage = socket.sentMessages.at(-1);
    assert.ok(sentMessage);
    const [type, id] = decode<[string, number, unknown]>(sentMessage);
    assert.equal(type, "fetch");

    socket.emitMessage(encode(["ack", id, null, [{ _id: "1" }]]));
    assert.deepEqual(await sendPromise, [{ _id: "1" }]);

    client.close();
  });

  test("throws when url is omitted and there is no location", () => {
    const { WebSocketImplementation } = createFakeWebSocket();

    withLocation(undefined, () => {
      assert.throws(
        () =>
          createWebsocketTransportClient({
            webSocketImplementation: WebSocketImplementation,
            visibilitySource: false,
          }),
        /`url` is required when globalThis.location is undefined/,
      );
    });
  });

  test("derives a secure url from location", () => {
    const { WebSocketImplementation, lastInstance } = createFakeWebSocket();

    withLocation({ protocol: "https:", host: "x.example" }, () => {
      const client = createWebsocketTransportClient({
        webSocketImplementation: WebSocketImplementation,
        visibilitySource: false,
      });
      client.connect();
      assert.equal(lastInstance().url, "wss://x.example/ws");
      client.close();
    });
  });

  test("derives an insecure url from a plain http location", () => {
    const { WebSocketImplementation, lastInstance } = createFakeWebSocket();

    withLocation({ protocol: "http:", host: "localhost:3000" }, () => {
      const client = createWebsocketTransportClient({
        webSocketImplementation: WebSocketImplementation,
        visibilitySource: false,
      });
      client.connect();
      assert.equal(lastInstance().url, "ws://localhost:3000/ws");
      client.close();
    });
  });

  test("an unrecoverable handshake failure rejects pending work", async () => {
    const { WebSocketImplementation, lastInstance } = createFakeWebSocket({
      withEmitter: true,
    });
    const failures: unknown[] = [];

    const client = createWebsocketTransportClient({
      url: "ws://localhost:3000/ws",
      webSocketImplementation: WebSocketImplementation,
      visibilitySource: false,
      onConnectionFailure: (failure) => failures.push(failure),
    });

    client.connect();
    const socket = lastInstance();
    socket.emitOpen();
    socket.emitMessage("connection-ack");

    const sendPromise = client.send("fetch", fetchPayload);
    const subscribePromise = client.subscribe(
      "fetchAndSubscribe",
      { resourceName: "todos", key: "todos", params: undefined },
      () => {},
    );

    socket.emitUnexpectedResponse({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
    socket.emitClose({ code: 1006 });

    await assert.rejects(sendPromise, /connection state is now/);
    await assert.rejects(
      Promise.resolve(subscribePromise),
      /Subscription closed/,
    );
    assert.deepEqual(failures, [
      {
        type: "handshake",
        status: 401,
        statusText: "Unauthorized",
        willReconnect: false,
      },
    ]);
  });
});
