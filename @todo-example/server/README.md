# @todo-example/server

Websocket backend of the TodoMVC example for [liwi](https://github.com/christophehurpeau/liwi). It shows the full server side of the resources layer: a mongo store wrapped for subscriptions, a resource implementing the shared `TasksService` interface, and a websocket server exposing it.

The frontend is [`@todo-example/vite`](../vite); the shared types live in [`@todo-example/modules`](../modules).

## Layout

- `src/stores/createMongoStore.ts` — `MongoConnection` from the app config (`db.mongodb`, `MONGO_PORT` overrides the port), the `mongoRegistry`, and a `createMongoStore` helper that registers every store it creates.
- `src/stores/tasksStores.ts` — `tasksStore`, a `MongoStore<Task>` wrapped with `createMongoSubscribeStore` so queries emit live changes.
- `src/stores/index.ts` — the barrel every store module goes through, so importing it populates the registry.
- `scripts/syncIndexes.ts` — `runIndexesCli` over that registry, outside `src` since it is not part of the served app.
- `src/resources/tasksService.ts` — the `ServiceResource<TasksService>`: `queryAll` (criteria, sort, projection + transformer, limit clamped to 200, skip for pagination), `queryWithoutParams`, and the `create` / `patch` / `clearCompleted` operations.
- `src/resources/index.ts` — the `ResourcesServerService`, registering the resource under the name `tasks`.
- `src/index.ts` — [alp](https://github.com/christophehurpeau/alp) app, `createWsServer(server, "/ws", resourcesServerService, () => undefined)` (no authentication in this example), and SIGINT/SIGTERM cleanup.

## Getting started

Needs a MongoDB reachable with the settings in `src/config/common.yml` (database `todo-example` on `localhost:27017`, HTTP port `4005`).

```bash
pnpm --filter @todo-example/server run build
node @todo-example/server/build/index-node.mjs
```

`pnpm --filter @todo-example/server run start` rebuilds on change. The websocket endpoint is `ws://localhost:4005/ws` by default — the value `@todo-example/vite` expects.

## Indexes

```bash
cd @todo-example/server
pnpm run indexes:plan    # prints the plan, changes nothing
pnpm run indexes:sync    # applies it
```

Both run `src/syncIndexes.ts` directly (node strips the types). The cwd must be this package: [alp](https://github.com/christophehurpeau/alp) resolves its config from `./build/config`, so the app has to have been built once.
