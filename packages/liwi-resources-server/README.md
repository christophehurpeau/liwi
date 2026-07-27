<h1 align="center">
  liwi-resources-server
</h1>

<p align="center">
  resources server for liwi
</p>

<p align="center">
  <a href="https://npmjs.org/package/liwi-resources-server"><img src="https://img.shields.io/npm/v/liwi-resources-server.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/liwi-resources-server"><img src="https://img.shields.io/npm/dw/liwi-resources-server.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/liwi-resources-server"><img src="https://img.shields.io/node/v/liwi-resources-server.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/liwi-resources-server"><img src="https://img.shields.io/npm/types/liwi-resources-server.svg?style=flat-square" alt="types"></a>
</p>

## About

Server side of the liwi resources layer: you register resources (queries and operations backed by a store) and it produces the message handler a transport feeds client messages into.

Transports on top of it: [`liwi-resources-websocket-server`](../liwi-resources-websocket-server) (network) and [`liwi-resources-direct-client`](../liwi-resources-direct-client) (in-process).

## Install

```bash
npm install --save liwi-resources-server
```

## Usage

Implement the service interface shared with the client, backed by a store:

```ts
import type { ServiceResource } from "liwi-resources-server";
import type { TasksService } from "@todo-example/modules";
import { tasksStore } from "../stores/tasksStores.ts";

export const tasksService: ServiceResource<TasksService> = {
  queries: {
    queryAll: ({ completed, limit, page }) => {
      const securedLimit = Math.min(200, limit);
      return tasksStore.createQueryCollection({
        criteria: completed == null ? {} : { completed },
        sort: { created: 1 },
        limit: securedLimit,
        skip: (page - 1) * securedLimit,
      });
    },
  },
  operations: {
    create: ({ task }) => tasksStore.insertOne(task),
    clearCompleted: () => tasksStore.deleteMany({ completed: true }),
  },
};
```

Register it:

```ts
import { ResourcesServerService } from "liwi-resources-server";
import type { ServiceResource } from "liwi-resources-server";

export const resourcesServerService = new ResourcesServerService({
  serviceResources: new Map<string, ServiceResource<any, any>>([
    ["tasks", tasksService],
  ]),
});
```

Then hand it to a transport — with websockets:

```ts
import { createWsServer } from "liwi-resources-websocket-server";

createWsServer(httpServer, "/ws", resourcesServerService, getAuthenticatedUser);
```

## API

### `ServiceResource<ClientService, LoggedInUser>`

Server-side counterpart of the client `ServiceInterface`. Each query and operation receives the client params plus the authenticated user:

```ts
queries: { [key]: (params, loggedInUser) => Query | Promise<Query> }
operations: { [key]: (params, loggedInUser) => Promise<Result> }
subscribeHooks?: { [queryKey]: { subscribed(user, params), unsubscribed(user, params) } }
```

Query implementations may be async, and return a query built by the store (`createQueryCollection` / `createQuerySingleItem`). Query keys must start with `query`; other keys are rejected.

`subscribeHooks` are called when a client opens and closes a subscription for that query — useful for presence, metrics, or waking external sources. `unsubscribed` also runs when the connection closes.

Params come from the client: validate and clamp them here (the example above caps `limit`).

### `ResourcesServerService`

```ts
new ResourcesServerService({ serviceResources: Map<string, ServiceResource> });
service.addResource(key, resource);
service.getServiceResource(key); // throws on unknown key
```

### `createMessageHandler(resourcesServerService, authenticatedUser, allowSubscriptions)`

Returns `{ messageHandler, close }` for one client connection.

- `messageHandler(message, subscriptionCallback)` handles a `ToServerMessage` and resolves the value to ack. `subscriptionCallback(subscriptionId, error, result)` is called for every subscription push.
- `allowSubscriptions: false` rejects `subscribe` / `fetchAndSubscribe` (used by the direct client).
- `close()` stops every subscription opened by that connection and runs the matching `unsubscribed` hooks. Always call it when the connection ends.

Transports own encoding, ids and auth; this handler is transport-agnostic.

### Errors

```ts
import { ResourcesServerError } from "liwi-resources-server";

throw new ResourcesServerError("TASK_NOT_FOUND", "Invalid task");
```

`ResourcesServerError` reaches the client with its `code` and `message`. Any other error is logged (`nightingale-logger`) and returned as `INTERNAL_SERVER_ERROR`; payloads are redacted from logs when `NODE_ENV=production`.
