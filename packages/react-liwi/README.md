<h1 align="center">
  react-liwi
</h1>

<p align="center">
  react with liwi
</p>

<p align="center">
  <a href="https://npmjs.org/package/react-liwi"><img src="https://img.shields.io/npm/v/react-liwi.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/react-liwi"><img src="https://img.shields.io/npm/dw/react-liwi.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/react-liwi"><img src="https://img.shields.io/node/v/react-liwi.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/react-liwi"><img src="https://img.shields.io/npm/types/react-liwi.svg?style=flat-square" alt="types"></a>
</p>

## About

React bindings for liwi resources: a provider owning the transport client, and hooks to read queries (optionally live) and call operations.

## Install

```bash
npm install --save react-liwi
```

## Usage

Wrap the app with the provider, giving it a transport factory:

```tsx
import { createWebsocketTransportClient } from "liwi-resources-websocket-client";
import type { WebsocketTransportClientOptions } from "liwi-resources-websocket-client";
import { createVoidTransportClient } from "liwi-resources-void-client";
import { TransportClientProvider } from "react-liwi";

export function App() {
  return (
    <TransportClientProvider<WebsocketTransportClientOptions>
      url="ws://localhost:4005/ws"
      createFn={
        globalThis.window === undefined
          ? createVoidTransportClient
          : createWebsocketTransportClient
      }
      onError={console.error}
    >
      <Home />
    </TransportClientProvider>
  );
}
```

Build the resource client service from the transport in context, and share it through your own context:

```tsx
import { createResourceClientService } from "liwi-resources-client";
import { TransportClientContext } from "react-liwi";

const createTasksServiceClient = createResourceClientService<TasksService>(
  "tasks",
  {
    queries: { queryAll: null },
    operations: { create: null, patch: null, clearCompleted: null },
  },
);

export function TodoServicesProvider({ children }: { children: ReactNode }) {
  const transportClient = useContext(TransportClientContext);
  const [todoServices] = useState(() => ({
    tasksService: createTasksServiceClient(transportClient),
  }));

  return (
    <TodoServicesContext.Provider value={todoServices}>
      {children}
    </TodoServicesContext.Provider>
  );
}
```

Read and mutate:

```tsx
function Main() {
  const { tasksService } = useContext(TodoServicesContext);

  const tasks = useResource(
    tasksService.queries.queryAll,
    { params: { limit: 200, page: 1 }, subscribe: true },
    [],
  );

  const [patchTask] = useOperation(tasksService.operations.patch);

  if (tasks.initialLoading) return null;
  if (tasks.initialError) return <p>Error</p>;

  return (
    <ul>
      {tasks.data.map((task) => (
        <li key={task._id}>{task.label}</li>
      ))}
    </ul>
  );
}
```

A complete app lives in [`@todo-example/vite`](../../@todo-example/vite).

## API

### `TransportClientProvider`

```tsx
<TransportClientProvider createFn={createTransportClient} {...transportOptions}>
```

Creates the client once with `createFn(transportOptions)` (every prop other than `createFn` and `children` is forwarded), connects it on mount, and closes it on unmount. It provides:

- `TransportClientContext` — the `TransportClient`.
- `TransportClientStateContext` / `useTransportClientState()` — the raw `ConnectionStates`.
- `TransportClientReadyContext` / `useTransportClientIsReady()` — `true` when connected.

`transportClientStateToSimplifiedState(state)` reduces the six connection states to `"connected" | "connecting" | "disconnected"`, for status badges.

### `useResource(createQuery, options, deps)`

`createQuery` is a query from the client service (`service.queries.queryAll`). Options:

| Option             | Description                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `params`           | Query params (optional only when the query takes none)                                      |
| `skip`             | Skip fetching entirely                                                                      |
| `subscribe`        | Keep the result live instead of fetching once                                               |
| `subscribeOptions` | `{ visibleTimeout }` — how long a hidden tab keeps its subscription open, default 2 minutes |

`deps` re-creates the query when they change (same contract as `useEffect` deps) — include everything used to build `params`.

Returns a discriminated `ResourceResult`:

```ts
{ initialLoading: true,  initialError: false, fetched: false, fetching: true,  data: undefined, meta: undefined, queryInfo: undefined, error: undefined, query }
{ initialLoading: false, initialError: true,  fetched: false, fetching: false, data: undefined, ..., error: Error }
{ initialLoading: false, initialError: false, fetched: true,  fetching: boolean, data: Data, meta: { total }, queryInfo, error: Error | undefined, query }
```

Narrow on `initialLoading` / `initialError` first; in the loaded state `data` is defined, `fetching` marks a refetch in flight and `error` a failure after a successful load.

`subscribe` is ignored during SSR (`window === undefined`): the hook falls back to a plain fetch, which the [void client](../liwi-resources-void-client) does not perform. Render the loading state on the server.

While subscribed, the hook releases the subscription when the tab has been hidden for `visibleTimeout` and re-fetches when it becomes visible again.

### `usePaginatedResource(createQuery, options, deps)`

Same as `useResource` for queries whose params include `page`, plus a `pagination` field:

```tsx
const tasks = usePaginatedResource(
  tasksService.queries.queryAll,
  { params: { completed, limit: 3, page }, subscribe },
  [completed, page],
);

tasks.meta.total; // total items, ignoring limit/skip
tasks.pagination.totalPages; // ceil(total / limit)
```

`pagination` is `undefined` until the first result arrives.

### `useOperation(operation)`

```tsx
const [patchTask, { loading, error }] = useOperation(
  tasksService.operations.patch,
);

const [error, task] = await patchTask({ id, patch: { completed: true } });
```

The wrapper never rejects: it resolves `[error, undefined]` or `[undefined, result]`, and tracks `{ loading, error }` for rendering.

### Errors

`ResourcesServerError` is re-exported, so error codes raised by the server can be matched in components.
