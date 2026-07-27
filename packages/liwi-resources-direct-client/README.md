<h1 align="center">
  liwi-resources-direct-client
</h1>

<p align="center">
  direct client implementation for liwi
</p>

<p align="center">
  <a href="https://npmjs.org/package/liwi-resources-direct-client"><img src="https://img.shields.io/npm/v/liwi-resources-direct-client.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/liwi-resources-direct-client"><img src="https://img.shields.io/npm/dw/liwi-resources-direct-client.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/liwi-resources-direct-client"><img src="https://img.shields.io/node/v/liwi-resources-direct-client.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/liwi-resources-direct-client"><img src="https://img.shields.io/npm/types/liwi-resources-direct-client.svg?style=flat-square" alt="types"></a>
</p>

## About

In-process [`TransportClient`](../liwi-resources-client#transportclient): calls the resources server directly, with no network, encoding or serialization. Use it when client code runs in the same process as the server — server-side rendering, scripts, tests.

## Install

```bash
npm install --save liwi-resources-direct-client
```

## Usage

```ts
import { createDirectTransportClient } from "liwi-resources-direct-client";
import { resourcesServerService } from "./resources/index.ts";

const transportClient = createDirectTransportClient({
  resourcesServerService,
  authenticatedUser: user ?? null,
});

const tasksService = createTasksServiceClient(transportClient);
const { result } = await tasksService.queries
  .queryAll({ limit: 20, page: 1 })
  .fetch((queryResult) => queryResult);
```

## API

### `createDirectTransportClient({ resourcesServerService, authenticatedUser })`

Returns a `TransportClient` wired to `createMessageHandler(resourcesServerService, authenticatedUser, false)`.

- `resourcesServerService` — the [`ResourcesServerService`](../liwi-resources-server#resourcesserverservice) holding the resources.
- `authenticatedUser` — passed to every query and operation as `loggedInUser`; use `null` when anonymous.

`connect()` is a no-op, `listenStateChange()` never fires (the connection is always usable), and `close()` releases the handler.

## Limitations

Subscriptions are disabled: the message handler is created with `allowSubscriptions: false`, so `subscribe` / `fetchAndSubscribe` fail with `Subscriptions not allowed` (the error is passed to the subscription callback), and `stop()` / `cancel()` are no-ops. Fetch queries and operations only. For live updates use the [websocket client](../liwi-resources-websocket-client).
