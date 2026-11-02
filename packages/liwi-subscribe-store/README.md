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

Only writes made **through this proxy, in this process** are observed. Changes written directly to the database (mongo shell, migrations) are not detected; another process writing through its own subscribe store can [relay them](#writes-from-another-process).

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
- `subscribeChangedKeys(callback): () => void` — the keys of every document written through this store (not those notified with `notifyChanged`, so two relays cannot loop), for relaying them to another process (see [Writes from another process](#writes-from-another-process)). Like any listener, it makes writes read their `prev`.
- `notifyChanged(keys): Promise<void>` — documents were written outside this store: re-reads them in one query and emits `changed`. Reads nothing when nobody listens. Its `next` only tells subscriptions whether they are concerned: each concerned one re-reads the documents in its own order.
- `resync(): void` — emits `resync`: every open query subscription refetches and sends its whole result again as `initial`.
- `callSubscribed(action): void` — dispatch an action to listeners manually.

### `Actions<Model>`

```ts
type Actions<Model> =
  | { type: "inserted"; next: Model[] }
  | { type: "updated"; changes: [Model, Model][] } // [previous, next]
  | { type: "deleted"; prev: Model[] }
  | { type: "changed"; keys: AllowedKeyValue[]; next: Model[] } // a key missing from next was deleted
  | { type: "resync" };
```

`changed` and `resync` come from `notifyChanged` and `resync`; a listener with an exhaustive `switch` must handle them.

`prev` is always the **stored** document, never the object passed by the caller: queries decide whether a document entered or left their result by testing `prev` and `next` against their criteria, so a stale copy would leave rows in lists they no longer belong to.

| Write                                     | Where `prev` comes from                                                                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `partialUpdateByKey` / `partialUpdateOne` | `partialUpdateByKeyWithInfo` of the wrapped store (atomic with the write), else `findOne` just before the write                                                                    |
| `replaceOne` / `replaceSeveral`           | `replaceOneWithInfo` (atomic), else `findByKey` just before the write                                                                                                              |
| `deleteByKey` / `deleteOne`               | `deleteByKeyWithInfo` (atomic), else `findByKey` just before the write                                                                                                             |
| `upsertOne` / `upsertOneWithInfo`         | `upsertOneWithInfo` of the wrapped store                                                                                                                                           |
| `partialUpdateMany`                       | the matching keys are read first, then each document is updated as by `partialUpdateByKey`, re-checking `criteria`                                                                 |
| `deleteMany`                              | the matching keys are read first, then each document is deleted with `deleteByKeyWithInfo`, re-checking `criteria`; without it, a cursor read before one `deleteMany` (not atomic) |

See [Writes with info](../liwi-store#writes-with-info) for the `…WithInfo` contract.

For `partialUpdateMany` and `deleteMany`, the emitted documents are exactly the ones written: a document that stopped matching `criteria` after the keys were read is left alone and not emitted, and a document inserted after the keys were read is not written. This costs one round trip per document instead of a single command.

### Without listeners

When nothing is subscribed (no `subscribe` listener and no open query subscription), nobody needs `prev`, so writes go straight to the wrapped store: `partialUpdateMany` and `deleteMany` are a single command again, and `partialUpdateByKey`, `replaceOne` and `deleteByKey` use the plain methods (one round trip for a partial update by key instead of two). Behaviour is otherwise the same, including `NotFoundError` on a missing key.

### Missing keys and failures

- A write on a key that does not exist emits nothing. `partialUpdateByKey`, `partialUpdateOne`, `replaceOne` and `replaceSeveral` throw [`NotFoundError`](../liwi-store#errors), or resolve `undefined` with [`allowNotFound`](../liwi-store#missing-documents); `deleteByKey` and `deleteOne` resolve.
- When a concurrent delete lands between a partial update and its read-back, the update was applied but there is no `next`: nothing is emitted (the delete emits its own `deleted` action) and `partialUpdateByKey` / `partialUpdateOne` throw `DeletedAfterUpdateError`, a subclass of `NotFoundError` (or resolve `undefined` with `allowNotFound`). `partialUpdateMany` skips that document.
- `replaceSeveral`, `partialUpdateMany` and `deleteMany` emit the writes that succeeded before rethrowing the first failure, so listeners stay in sync with what was written.

### `updated`

Stamping `updated` and rejecting protected field updates is done by the wrapped store (see [`created` and `updated`](../liwi-store#created-and-updated)); partial update `options` such as `touchUpdated` are passed through. Because `partialUpdateMany` writes document by document here, each document gets its own write time, where a plain `MongoStore` gives the whole command one.

### Writes from another process

Listeners only see writes going through this proxy, in this process. When another process writes the same collection, relay its keys: that process exposes `subscribeChangedKeys` with `createStoreRelayResource` ([`liwi-resources-server`](../liwi-resources-server#store-relay)), this one feeds them to `notifyChanged` and `resync` with `connectStoreRelay` ([`liwi-resources-client`](../liwi-resources-client#store-relay)).

Only keys travel. `notifyChanged` reads the documents once to find the concerned query subscriptions (holding one of the keys, or matching one of the documents); each of them re-reads those documents in its own action order and compares them with what its client holds. So a notification repeated, late, or crossing a local write or a refetch leaves the client equal to a fresh fetch, at the cost of one read per concerned subscription.

### `AbstractSubscribableStoreQuery`

Base class for store implementations providing subscribable queries. It holds the subscribe store (`setSubscribeStore` / `getSubscribeStore`) and implements `fetchAndSubscribe` / `subscribe` on top of an abstract `_subscribe`; implementations turn store actions into query `Changes` by testing each affected model against the query criteria. `liwi-mongo` does this in memory with [mingo](https://github.com/kofrasa/mingo).

Queries built this way are fixed: `changeParams` / `changePartialParams` throw — create a new query instead.
