<h1 align="center">
  liwi-resources-client
</h1>

<p align="center">
  resources client for liwi
</p>

<p align="center">
  <a href="https://npmjs.org/package/liwi-resources-client"><img src="https://img.shields.io/npm/v/liwi-resources-client.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/liwi-resources-client"><img src="https://img.shields.io/npm/dw/liwi-resources-client.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/liwi-resources-client"><img src="https://img.shields.io/node/v/liwi-resources-client.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/liwi-resources-client"><img src="https://img.shields.io/npm/types/liwi-resources-client.svg?style=flat-square" alt="types"></a>
</p>

## About

Client side of the liwi resources layer. From a service interface it builds a typed client whose queries and operations are sent over a transport, so calling code looks the same whether the server is across a websocket or in the same process.

It defines the `TransportClient` interface but ships no transport — pick one:

- [`liwi-resources-websocket-client`](../liwi-resources-websocket-client) — browser to server over websocket.
- [`liwi-resources-direct-client`](../liwi-resources-direct-client) — in-process, no network.
- [`liwi-resources-void-client`](../liwi-resources-void-client) — no-op, for SSR and tests.

## Install

```bash
npm install --save liwi-resources-client
```

## Usage

Declare the client factory once per resource, listing the keys of the shared service interface (values are `null`; only the keys matter):

```ts
import { createResourceClientService } from "liwi-resources-client";
import type { TasksService } from "@todo-example/modules";

const createTasksServiceClient = createResourceClientService<TasksService>(
  "tasks",
  {
    queries: { queryAll: null, queryWithoutParams: null },
    operations: { create: null, patch: null, clearCompleted: null },
  },
);
```

Bind it to a transport client to get the typed service:

```ts
const tasksService = createTasksServiceClient(transportClient);

// operations: a plain promise
const task = await tasksService.operations.create({
  task: { label: "buy milk", completed: false },
});

// queries: fetch once
const query = tasksService.queries.queryAll({ limit: 20, page: 1 });
const { result, meta } = await query.fetch((queryResult) => queryResult);

// queries: fetch and stay up to date
const subscription = query.fetchAndSubscribe((error, changes) => {
  for (const change of changes) {
    // "initial" | "inserted" | "updated" | "deleted"
  }
});
subscription.stop();
```

In React, use [`react-liwi`](../react-liwi) instead of driving queries by hand.

## API

### `createResourceClientService<Service>(resourceName, { queries, operations })`

Returns `(transportClient) => Service`. Query methods build a `ClientQuery`; operation methods send a `do` message and resolve the server result.

### `ClientQuery`

Implements the [`Query`](../liwi-store#queries) interface over the transport:

- `fetch(onFulfilled)` — resolves `{ result, info, meta }`.
- `fetchAndSubscribe(callback)` / `subscribe(callback)` — return a `QuerySubscription` (thenable, with `stop()` and `cancel()`).
- `changeParams(params)` / `changePartialParams(params)` — update params for the _next_ call; existing subscriptions keep their params.

Query keys must start with `query` (server-side requirement).

### `TransportClient`

Implement this to add a transport:

```ts
interface TransportClient {
  connect: () => void;
  close: () => void;
  listenStateChange: (
    listener: (state: ConnectionStates) => void,
  ) => () => void;
  send: (type, message) => Promise<Result>;
  subscribe: (type, message, callback) => TransportClientSubscribeResult;
}
```

`ConnectionStates` is `"opening" | "connecting" | "connected" | "reconnect-scheduled" | "wait-for-visibility" | "closed"`.

### Errors

Server errors thrown as `ResourcesServerError` are rebuilt client-side with their `code` and `message`; anything else arrives as `INTERNAL_SERVER_ERROR`.

```ts
import { ResourcesServerError } from "liwi-resources-client";

try {
  await tasksService.operations.patch({ id, patch });
} catch (error) {
  if (
    error instanceof ResourcesServerError &&
    error.code === "TASK_NOT_FOUND"
  ) {
    // ...
  }
}
```
