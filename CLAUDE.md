# CLAUDE.md

## What this is

`liwi` is a database abstraction layer, published as a pnpm monorepo of related npm packages (`packages/*`). It provides a common store interface over concrete DB implementations, real-time query subscriptions, and a client/server transport layer so a browser client can query and subscribe to server-side resources (over WebSocket, direct call, or void/no-op), with React bindings.

## Package map

Core:

- `liwi-store` — abstract `Store` / `SubscribableStore` interfaces, `Query`, cursors, connection. The contract every DB implementation satisfies.
- `liwi-subscribe-store` — proxy that adds subscription support on top of a store.
- `liwi-mongo` — MongoDB implementation of the store (uses `mingo` for in-memory query matching to drive subscriptions), plus declarative index management: stores declare `indexes`, `MongoRegistry` syncs them explicitly. Its `liwi-mongo/memory` entry is an in-process fake of the `mongodb` driver surface `MongoStore` uses (mingo-based), plugged via `new MongoConnection({ client })`, for fast tests and e2e servers; `src/memory/contract.test.ts` runs the same scenarios against it and a real mongod (`LIWI_MONGO_INTEGRATION=1`): add a scenario there for any behaviour it must match.
- `extended-json` — JSON with `Date` support via reviver; the wire format across the transport.
- `liwi` — umbrella package.

Resources (client/server RPC + subscriptions over the store):

- `liwi-resources` — shared types: `ServiceInterface`, query/operation payloads, wire messages.
- `liwi-resources-server` — `ResourcesServerService`, message handler that exposes resources to clients.
- `liwi-resources-client` — base `TransportClient`, `ClientQuery`, `createResourceClientService`.
- `liwi-resources-direct-client` — in-process transport (no network).
- `liwi-resources-websocket-client` / `liwi-resources-websocket-server` — WebSocket transport. The client is host-agnostic: the `WebSocket` implementation and the page-visibility capability are injectable.
- `liwi-resources-websocket-client-node` — the WebSocket client wired for node: connects through `ws` (so handshake auth headers are possible) and disables visibility awareness.
- `liwi-resources-http-client` / `liwi-resources-http-server` — stateless HTTP transport for `fetch` and `do` only (no subscriptions): one `POST` per call, auth evaluated per request.
- `liwi-resources-void-client` — no-op transport (SSR / tests).

React:

- `react-liwi` — hooks (`useResource`, `useRetrieveResourceAndSubscribe`, `usePaginatedResource`, `useOperation`) and provider for consuming resources with live updates.

Examples: `@todo-example/*` (workspace), plus `packages/liwi-mongo-example`.

## Conventions

- ESM only, TypeScript.
- Package entry points are `src/index.ts`; each package re-exports its public surface there.
- Files ending in `.ts.txt` are intentionally disabled/legacy source, not compiled.
- Tests are colocated next to the source they cover.
