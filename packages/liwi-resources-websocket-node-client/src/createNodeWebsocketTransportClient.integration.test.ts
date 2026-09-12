import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { ConnectionFailure } from "liwi-resources-websocket-client";
import { WebSocketServer } from "ws";
import { createNodeWebsocketTransportClient } from "./createNodeWebsocketTransportClient.ts";

const expectedAuthorization = "Bearer valid-token";

describe("createNodeWebsocketTransportClient (integration)", () => {
  const httpServer = createServer();
  const webSocketServer = new WebSocketServer({ noServer: true });
  let url: string;

  webSocketServer.on("connection", (socket) => {
    socket.send("connection-ack");
  });

  httpServer.on("upgrade", (request, socket, head) => {
    if (request.headers.authorization !== expectedAuthorization) {
      socket.end("HTTP/1.1 401 Unauthorized\r\n\r\n");
      return;
    }
    webSocketServer.handleUpgrade(request, socket, head, (socket_) => {
      webSocketServer.emit("connection", socket_, request);
    });
  });

  before(async () => {
    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", resolve);
    });
    const { port } = httpServer.address() as AddressInfo;
    url = `ws://127.0.0.1:${port}/ws`;
  });

  after(async () => {
    webSocketServer.close();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  test("a rejected token surfaces the 401 and stops reconnecting", async () => {
    const failures: ConnectionFailure[] = [];
    const states: string[] = [];

    const client = createNodeWebsocketTransportClient({
      url,
      reconnectionDelayMin: 10,
      reconnectionDelayMax: 10,
      headers: { authorization: "Bearer expired-token" },
      onError: () => {},
      onConnectionFailure: (failure) => failures.push(failure),
    });
    client.listenStateChange((state) => states.push(state));
    client.connect();

    await delay(300);

    assert.deepEqual(failures, [
      {
        type: "handshake",
        status: 401,
        statusText: "Unauthorized",
        willReconnect: false,
      },
    ]);
    assert.equal(states.at(-1), "closed");

    client.close();
  });

  test("a valid token reaches connected, proving headers travel", async () => {
    const states: string[] = [];

    const client = createNodeWebsocketTransportClient({
      url,
      headers: () => ({ authorization: expectedAuthorization }),
      onError: () => {},
    });
    client.listenStateChange((state) => states.push(state));
    client.connect();

    await delay(300);

    assert.ok(
      states.includes("connected"),
      `expected to reach connected, got ${states.join(", ")}`,
    );

    client.close();
  });
});
