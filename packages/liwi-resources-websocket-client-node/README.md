<h1 align="center">
  liwi-resources-websocket-client-node
</h1>

<p align="center">
  node websocket client implementation for liwi
</p>

<p align="center">
  <a href="https://npmjs.org/package/liwi-resources-websocket-client-node"><img src="https://img.shields.io/npm/v/liwi-resources-websocket-client-node.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/liwi-resources-websocket-client-node"><img src="https://img.shields.io/npm/dw/liwi-resources-websocket-client-node.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/liwi-resources-websocket-client-node"><img src="https://img.shields.io/node/v/liwi-resources-websocket-client-node.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/liwi-resources-websocket-client-node"><img src="https://img.shields.io/npm/types/liwi-resources-websocket-client-node.svg?style=flat-square" alt="types"></a>
</p>

## About

Node [`TransportClient`](../liwi-resources-client#transportclient), to be used against [`liwi-resources-websocket-server`](../liwi-resources-websocket-server). It is [`liwi-resources-websocket-client`](../liwi-resources-websocket-client) wired for a node host:

- connects through [`ws`](https://github.com/websockets/ws) rather than node's global `WebSocket`, which cannot set handshake headers,
- so **authentication headers** can be sent on the upgrade request,
- and page-visibility awareness is disabled, so reconnection never waits for a `visibilitychange` that will not come.

## Install

```bash
npm install --save liwi-resources-websocket-client-node
```

## Usage

```ts
import { createNodeWebsocketTransportClient } from "liwi-resources-websocket-client-node";

const transportClient = createNodeWebsocketTransportClient({
  url: "ws://localhost:4005/ws",
  headers: () => ({ authorization: `Bearer ${getToken()}` }),
  onConnectionFailure: (failure) => {
    if (failure.type === "handshake" && failure.status === 401) promptSignIn();
  },
});
transportClient.connect();

const tasksService = createTasksServiceClient(transportClient);
```

## Options

Everything [`WebsocketTransportClientOptions`](../liwi-resources-websocket-client#options) accepts, except `thirdWebsocketArgument`, `getThirdWebsocketArgument` and `visibilitySource`, which this package sets itself. Plus:

| Option                    | Default      | Description                                                                         |
| ------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| `url`                     | — (required) | Websocket endpoint. There is no `location` to derive it from                        |
| `headers`                 | —            | Handshake headers, or a function returning them                                     |
| `webSocketOptions`        | —            | Extra [`ws` client options](https://github.com/websockets/ws/blob/master/doc/ws.md) |
| `webSocketImplementation` | `ws`         | `WebSocket` constructor to use                                                      |

Pass `headers` as a **function** when the token can expire: it is evaluated on every connection attempt, so reconnections carry a refreshed token rather than the one captured at creation.

`webSocketOptions.headers` are merged underneath `headers`, so `headers` wins on a key collision.

## Expired tokens

A rejected upgrade is surfaced through `onConnectionFailure` with the HTTP status, and a 4xx stops the reconnection loop instead of retrying forever. See [connection failures](../liwi-resources-websocket-client#connection-failures).
