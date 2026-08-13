<h1 align="center">
  db abstraction
</h1>

<h3>📦 Packages</h3>

This repository is a monorepo using workspaces.

| Package                                                                     | Version                                                                                                                                                                | Description                                        |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [extended-json](packages/extended-json)                                     | <a href="https://npmjs.org/package/extended-json"><img src="https://img.shields.io/npm/v/extended-json.svg?style=flat-square"></a>                                     | extended json with date using reviver              |
| [liwi](packages/liwi)                                                       | <a href="https://npmjs.org/package/liwi"><img src="https://img.shields.io/npm/v/liwi.svg?style=flat-square"></a>                                                       | db abstraction (deprecated umbrella)               |
| [liwi-mongo](packages/liwi-mongo)                                           | <a href="https://npmjs.org/package/liwi-mongo"><img src="https://img.shields.io/npm/v/liwi-mongo.svg?style=flat-square"></a>                                           | mongo implementation for liwi                      |
| [liwi-resources](packages/liwi-resources)                                   | <a href="https://npmjs.org/package/liwi-resources"><img src="https://img.shields.io/npm/v/liwi-resources.svg?style=flat-square"></a>                                   | resources for liwi                                 |
| [liwi-resources-client](packages/liwi-resources-client)                     | <a href="https://npmjs.org/package/liwi-resources-client"><img src="https://img.shields.io/npm/v/liwi-resources-client.svg?style=flat-square"></a>                     | resources client for liwi                          |
| [liwi-resources-direct-client](packages/liwi-resources-direct-client)       | <a href="https://npmjs.org/package/liwi-resources-direct-client"><img src="https://img.shields.io/npm/v/liwi-resources-direct-client.svg?style=flat-square"></a>       | direct client implementation for liwi              |
| [liwi-resources-server](packages/liwi-resources-server)                     | <a href="https://npmjs.org/package/liwi-resources-server"><img src="https://img.shields.io/npm/v/liwi-resources-server.svg?style=flat-square"></a>                     | resources server for liwi                          |
| [liwi-resources-void-client](packages/liwi-resources-void-client)           | <a href="https://npmjs.org/package/liwi-resources-void-client"><img src="https://img.shields.io/npm/v/liwi-resources-void-client.svg?style=flat-square"></a>           | void client implementation for liwi                |
| [liwi-resources-websocket-client](packages/liwi-resources-websocket-client) | <a href="https://npmjs.org/package/liwi-resources-websocket-client"><img src="https://img.shields.io/npm/v/liwi-resources-websocket-client.svg?style=flat-square"></a> | websocket client implementation for liwi           |
| [liwi-resources-websocket-server](packages/liwi-resources-websocket-server) | <a href="https://npmjs.org/package/liwi-resources-websocket-server"><img src="https://img.shields.io/npm/v/liwi-resources-websocket-server.svg?style=flat-square"></a> | liwi resources server implementation for websocket |
| [liwi-store](packages/liwi-store)                                           | <a href="https://npmjs.org/package/liwi-store"><img src="https://img.shields.io/npm/v/liwi-store.svg?style=flat-square"></a>                                           | abstract store used by liwi implementations        |
| [liwi-subscribe-store](packages/liwi-subscribe-store)                       | <a href="https://npmjs.org/package/liwi-subscribe-store"><img src="https://img.shields.io/npm/v/liwi-subscribe-store.svg?style=flat-square"></a>                       | subscribe store proxy                              |
| [react-liwi](packages/react-liwi)                                           | <a href="https://npmjs.org/package/react-liwi"><img src="https://img.shields.io/npm/v/react-liwi.svg?style=flat-square"></a>                                           | react with liwi                                    |
| [@todo-example/modules](@todo-example/modules)                              |                                                                                                                                                                        | shared types of the todo example                   |
| [@todo-example/server](@todo-example/server)                                |                                                                                                                                                                        | websocket backend of the todo example              |
| [@todo-example/vite](@todo-example/vite)                                    |                                                                                                                                                                        | SSR React frontend of the todo example             |

## Architecture

`liwi` is a database abstraction layer: a common store interface over concrete databases, real-time query subscriptions on top of it, and a client/server transport so a browser can query and subscribe to server-side resources — with React bindings.

```
                server                                        client
  ┌───────────────────────────────────┐          ┌───────────────────────────────┐
  │ MongoStore            (liwi-mongo)│          │ react hooks       (react-liwi) │
  │   ↓ wrapped by                    │          │   ↓                            │
  │ SubscribeStore                    │          │ resource client service        │
  │            (liwi-subscribe-store) │          │        (liwi-resources-client) │
  │   ↓ queries + operations          │          │   ↓                            │
  │ ServiceResource                   │  ← ws →  │ TransportClient                │
  │        (liwi-resources-server)    │          │   websocket / direct / void    │
  └───────────────────────────────────┘          └───────────────────────────────┘
```

- **Store** — [`liwi-store`](packages/liwi-store) defines the contract (`Store`, `Query`, cursors); [`liwi-mongo`](packages/liwi-mongo) implements it for MongoDB.
- **Subscriptions** — [`liwi-subscribe-store`](packages/liwi-subscribe-store) wraps a store so queries can emit changes as writes happen in-process.
- **Resources** — a resource is a named set of queries (fetchable and subscribable) and operations (mutations), declared once as a TypeScript interface in [`liwi-resources`](packages/liwi-resources), implemented on the server ([`liwi-resources-server`](packages/liwi-resources-server)) and generated on the client ([`liwi-resources-client`](packages/liwi-resources-client)).
- **Transports** — [websocket](packages/liwi-resources-websocket-client) for browsers, [direct](packages/liwi-resources-direct-client) for in-process calls, [void](packages/liwi-resources-void-client) for SSR. Payloads are encoded with [`extended-json`](packages/extended-json) so `Date` values survive.
- **React** — [`react-liwi`](packages/react-liwi) provides the transport, `useResource` / `usePaginatedResource` / `useOperation`.
- **Indexes** — declared on the mongo store next to the queries that need them, collected in a `MongoRegistry`, applied by an explicit step. See [indexes](packages/liwi-mongo#indexes).

## Install

Install the packages you need — there is no single entry point:

```sh
npm install --save liwi-mongo liwi-resources-server liwi-resources-websocket-server
npm install --save liwi-resources-client liwi-resources-websocket-client react-liwi
```

## Usage

Shared between client and server — the service interface:

```ts
import type { ServiceQuery } from "liwi-resources";

export interface TasksService {
  queries: {
    queryAll: ServiceQuery<Task[], { limit: number; page: number }>;
  };
  operations: {
    create: (params: { task: DraftTask }) => Promise<Task>;
  };
}
```

Server — implement it over a store and expose it:

```ts
import {
  MongoConnection,
  MongoStore,
  createMongoSubscribeStore,
} from "liwi-mongo";
import { ResourcesServerService } from "liwi-resources-server";
import { createWsServer } from "liwi-resources-websocket-server";

const connection = new MongoConnection({ database: "todo" });
const tasksStore = createMongoSubscribeStore<Task>(
  new MongoStore<Task>(connection, "tasks"),
);

const tasksService: ServiceResource<TasksService> = {
  queries: {
    queryAll: ({ limit, page }) =>
      tasksStore.createQueryCollection({
        sort: { created: 1 },
        limit: Math.min(200, limit),
        skip: (page - 1) * limit,
      }),
  },
  operations: {
    create: ({ task }) => tasksStore.insertOne(task),
  },
};

const resourcesServerService = new ResourcesServerService({
  serviceResources: new Map([["tasks", tasksService]]),
});

createWsServer(httpServer, "/ws", resourcesServerService, () => null);
```

Indexes — declare them on the store, register the store, apply from a deploy or migration step:

```ts
import { MongoRegistry, runIndexesCli } from "liwi-mongo";

const tasksStore = new MongoStore<Task>(connection, "tasks", {
  indexes: [{ key: { completed: 1, created: 1 } }],
});

export const mongoRegistry = new MongoRegistry([tasksStore]);
```

One connection per database, one store per collection, one registry per app: the connection owns the client, the store owns the model and its index declaration, the registry is the list the index step walks — see [connection, store, registry](packages/liwi-mongo#connection-store-registry). So the registry is built next to the connection, not inside the module of one store, and a store that is never registered is never synced.

`runIndexesCli` is the whole entry point — the connection is passed separately because the registry has no handle on it:

```ts
process.exitCode = await runIndexesCli({ registry: mongoRegistry, connection });
```

```sh
node scripts/syncIndexes.ts                 # plan, changes nothing
node scripts/syncIndexes.ts plan --check    # exit 1 when the plan is not empty
node scripts/syncIndexes.ts sync            # apply
```

Client — build the typed service and read it from React:

```tsx
const createTasksServiceClient = createResourceClientService<TasksService>(
  "tasks",
  { queries: { queryAll: null }, operations: { create: null } },
);

const tasksService = createTasksServiceClient(transportClient);

const tasks = useResource(
  tasksService.queries.queryAll,
  { params: { limit: 20, page: 1 }, subscribe: true },
  [],
);
```

Full applications: [`@todo-example`](@todo-example) (websocket server + SSR React frontend) and [`liwi-mongo-example`](packages/liwi-mongo-example) (store only).

## Development

ESM only, TypeScript, Node >= 22.14, pnpm >= 11.

```sh
pnpm install
pnpm run build      # rollup + type definitions
pnpm run tsc        # typecheck
pnpm test           # node --test, TZ=UTC
pnpm run lint       # oxfmt + eslint
```

[npm-image]: https://img.shields.io/npm/v/liwi.svg?style=flat-square
[npm-url]: https://npmjs.org/package/liwi
[coverage-image]: https://img.shields.io/codecov/c/github/christophehurpeau/liwi/main.svg?style=flat-square
[coverage-url]: https://codecov.io/gh/christophehurpeau/liwi
