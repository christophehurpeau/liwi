# @todo-example/modules

Types shared by [`@todo-example/server`](../server) and [`@todo-example/vite`](../vite) in the TodoMVC example for [liwi](https://github.com/christophehurpeau/liwi).

This is the piece that makes the resources layer type-safe end to end: the service interface is declared once here, then implemented by the server as a `ServiceResource` and turned into a client by `createResourceClientService`. Both sides fail to compile when they drift apart.

- `src/tasks/Task.ts` — `DraftTask` and `Task` (`DraftTask & MongoBaseModel`, so `_id` / `created` / `updated`).
- `src/tasks/TasksService.ts` — `TaskSummary` (the projection returned by the list query) and the `TasksService` interface:
  - queries: `queryAll({ completed?, limit, page })`, `queryWithoutParams()`
  - operations: `create({ task })`, `patch({ id, patch })`, `clearCompleted()`

Query keys must start with `query` — the resources server rejects any other key on a query message.
