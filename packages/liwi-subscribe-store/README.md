<h1 align="center">
  liwi-subscribe-store
</h1>

<p align="center">
  subscribe store proxy
</p>

<p align="center">
  <a href="https://npmjs.org/package/liwi-subscribe-store"><img src="https://img.shields.io/npm/v/liwi-subscribe-store.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/liwi-subscribe-store"><img src="https://img.shields.io/npm/dw/liwi-subscribe-store.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/liwi-subscribe-store"><img src="https://img.shields.io/node/v/liwi-subscribe-store.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/liwi-subscribe-store"><img src="https://img.shields.io/npm/types/liwi-subscribe-store.svg?style=flat-square" alt="types"></a>
</p>

## About

A proxy around a [`liwi-store`](../liwi-store) `Store` that adds live query subscriptions. It implements the full `Store` interface, so it is a drop-in replacement: every write goes through to the wrapped store and then notifies listeners, which is how open queries learn about inserts, updates and deletes.

Only writes made **through this proxy, in this process** are observed. Changes written directly to the database (another process, mongo shell, migrations) are not detected.

## Install

```bash
npm install --save liwi-subscribe-store
```

## Usage

```ts
import { SubscribeStore } from "liwi-subscribe-store";

const store = new SubscribeStore(mongoStore);
```

With mongo, prefer the helper which builds the same thing with the types already applied:

```ts
import { createMongoSubscribeStore } from "liwi-mongo";

export const tasksStore = createMongoSubscribeStore<Task>(
  createMongoStore("tasks"),
);
```

Queries created from it support `subscribe` / `fetchAndSubscribe`:

```ts
const query = tasksStore.createQueryCollection({
  criteria: { completed: false },
  sort: { created: 1 },
  limit: 100,
});

const subscription = query.fetchAndSubscribe((error, changes) => {
  if (error) throw error;
  for (const change of changes) {
    // change.type: "initial" | "inserted" | "updated" | "deleted"
  }
});

// later
subscription.stop();
```

## API

### `new SubscribeStore(store)`

Wraps a `SubscribableStore`. Beyond the `Store` interface it adds:

- `subscribe(listener): () => void` — listen to every write going through the proxy; returns an unsubscribe function.
- `callSubscribed(action): void` — dispatch an action to listeners manually (used by the store implementation, e.g. after an out-of-band write you want queries to see).

### `Actions<Model>`

```ts
type Actions<Model> =
  | { type: "inserted"; next: Model[] }
  | { type: "updated"; changes: [Model, Model][] } // [previous, next]
  | { type: "deleted"; prev: Model[] };
```

### `AbstractSubscribableStoreQuery`

Base class for store implementations providing subscribable queries. It holds the subscribe store (`setSubscribeStore` / `getSubscribeStore`) and implements `fetchAndSubscribe` / `subscribe` on top of an abstract `_subscribe`; implementations turn store actions into query `Changes` by testing each affected model against the query criteria. `liwi-mongo` does this in memory with [mingo](https://github.com/kofrasa/mingo).

Queries built this way are fixed: `changeParams` / `changePartialParams` throw — create a new query instead.
