<h1 align="center">
  liwi-resources-websocket-server
</h1>

<p align="center">
  liwi resources server implementation for websocket
</p>

<p align="center">
  <a href="https://npmjs.org/package/liwi-resources-websocket-server"><img src="https://img.shields.io/npm/v/liwi-resources-websocket-server.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/liwi-resources-websocket-server"><img src="https://img.shields.io/npm/dw/liwi-resources-websocket-server.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/liwi-resources-websocket-server"><img src="https://img.shields.io/node/v/liwi-resources-websocket-server.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/liwi-resources-websocket-server"><img src="https://img.shields.io/npm/types/liwi-resources-websocket-server.svg?style=flat-square" alt="types"></a>
</p>

## About

Exposes a [`ResourcesServerService`](../liwi-resources-server) over websockets ([ws](https://github.com/websockets/ws)), for [`liwi-resources-websocket-client`](../liwi-resources-websocket-client). Each connection gets its own message handler, authenticated user and set of subscriptions.

## Install

```bash
npm install --save liwi-resources-websocket-server
```

## Usage

```ts
import http from "node:http";
import { createWsServer } from "liwi-resources-websocket-server";
import { resourcesServerService } from "./resources/index.ts";

const server = http.createServer(app);

const wss = createWsServer(
  server,
  "/ws",
  resourcesServerService,
  (request) => getUserFromCookies(request), // sync, async, or null
);

const cleanup = (): void => {
  server.close();
  wss.close();
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
```

## API

### `createWsServer(server, path, resourcesServerService, getAuthenticatedUser)`

- `server` — the `http.Server` to attach to; upgrades on other paths are ignored, so it coexists with other websocket servers.
- `path` — exact request path handled (e.g. `/ws`).
- `resourcesServerService` — the registered resources.
- `getAuthenticatedUser(request)` — returns the user (or a promise, or `null`) for the upgrade request; it is passed to every query and operation as `loggedInUser`. If it throws, the connection proceeds with `null`.

Returns `{ wss, close }`. `close()` shuts the server down, terminates open clients, removes the `upgrade` listener and clears the ping interval.

## Behaviour

- On connection, the server sends `connection-ack`; that is what flips the client to the `connected` state.
- Messages are `extended-json`-encoded tuples `[type, id, payload]`; responses are `[type, id, error, result]` with `type` `"ack"` or `"subscription"`. Binary frames are ignored.
- Every message with an id is acked, with either the result or an error.
- `ResourcesServerError` is forwarded with its `code` and `message`. Any other error is logged and sent as `{ code: "INTERNAL_SERVER_ERROR", message: "Internal Server Error" }`, so internals never leak to clients.
- Subscriptions are allowed on this transport. Closing the socket stops every subscription it opened and runs the matching `unsubscribed` hooks.
- Dead connections are detected with a ping every 60s; clients that miss a pong are terminated (and, if they support it, reconnect).
- Logging goes through `nightingale-logger` under `liwi:resources-websocket-server`.
