# CLAUDE.md

## What this is

`liwi` is a database abstraction layer, published as a pnpm monorepo of related npm packages (`packages/*`). It provides a common store interface over concrete DB implementations, real-time query subscriptions, and a client/server transport layer so a browser client can query and subscribe to server-side resources (over WebSocket, direct call, or void/no-op), with React bindings.

## Package map

Core:

- `liwi-store` — abstract `Store` / `SubscribableStore` interfaces, `Query`, cursors, connection. The contract every DB implementation satisfies.
- `liwi-subscribe-store` — proxy that adds subscription support on top of a store.
- `liwi-mongo` — MongoDB implementation of the store (uses `mingo` for in-memory query matching to drive subscriptions), plus declarative index management: stores declare `indexes`, `MongoRegistry` syncs them explicitly.
- `extended-json` — JSON with `Date` support via reviver; the wire format across the transport.
- `liwi` — umbrella package.

Resources (client/server RPC + subscriptions over the store):

- `liwi-resources` — shared types: `ServiceInterface`, query/operation payloads, wire messages.
- `liwi-resources-server` — `ResourcesServerService`, message handler that exposes resources to clients.
- `liwi-resources-client` — base `TransportClient`, `ClientQuery`, `createResourceClientService`.
- `liwi-resources-direct-client` — in-process transport (no network).
- `liwi-resources-websocket-client` / `liwi-resources-websocket-server` — WebSocket transport.
- `liwi-resources-void-client` — no-op transport (SSR / tests).

React:

- `react-liwi` — hooks (`useResource`, `useRetrieveResourceAndSubscribe`, `usePaginatedResource`, `useOperation`) and provider for consuming resources with live updates.

Examples: `@todo-example/*` (workspace), plus `packages/liwi-mongo-example`.

## Conventions

- ESM only (`"type": "module"`), TypeScript, Node >= 22.14, pnpm >= 11.
- Package entry points are `src/index.ts`; each package re-exports its public surface there.
- Files ending in `.ts.txt` are intentionally disabled/legacy source, not compiled.
- Built with rollup (`@pob/rollup-esbuild`) + `tsc -b` for declarations; repo scaffolding is `@pob/root`.

## Commands

- Build: `pnpm run build` (rollup + `build:definitions`)
- Typecheck: `pnpm run tsc`
- Test: `pnpm test` (Node built-in test runner, `TZ=UTC`, matches `**/*.test.ts`)
- Lint: `pnpm run lint` (oxfmt format + eslint)
- Format check: `pnpm run format:check`

Tests are colocated as `src/**/*.test.ts` and run directly via `node --test` (no separate transpile step).
