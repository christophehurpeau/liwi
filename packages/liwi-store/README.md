<h1 align="center">
  liwi-store
</h1>

<p align="center">
  abstract store used by liwi implementations
</p>

<p align="center">
  <a href="https://npmjs.org/package/liwi-store"><img src="https://img.shields.io/npm/v/liwi-store.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/liwi-store"><img src="https://img.shields.io/npm/dw/liwi-store.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/liwi-store"><img src="https://img.shields.io/node/v/liwi-store.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/liwi-store"><img src="https://img.shields.io/npm/types/liwi-store.svg?style=flat-square" alt="types"></a>
</p>

## About

The contract every liwi database implementation satisfies: the `Store` interface, the `Query` interface, cursors and connections. It carries almost no runtime code — depend on it to _implement_ a store (see [`liwi-mongo`](../liwi-mongo)) or to type code that must stay agnostic of the underlying database.

## Install

```bash
npm install --save liwi-store
```

## Models

Every model extends `BaseModel` and has a key path (`_id` in mongo):

```ts
interface BaseModel {
  created: Date;
  updated: Date;
}
```

`InsertType<Model, KeyPath>` makes the key, `created` and `updated` optional — that is what `insertOne` accepts.

## `Store`

`Store<KeyPath, KeyValue, Model, ModelInsertType, Connection>` exposes:

| Method                                                                       | Description                                                                                   |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `createQuerySingleItem(options)`                                             | Builds a `Query<Result, Params>` resolving one item                                           |
| `createQueryCollection(options)`                                             | Builds a `Query<Item[], Params>`                                                              |
| `findAll(criteria?, sort?)`                                                  | All matching models                                                                           |
| `findByKey(key, criteria?)`                                                  | One model by key, or `undefined`                                                              |
| `findOne(criteria, sort?)`                                                   | First matching model, or `undefined`                                                          |
| `count(criteria?)`                                                           | Number of matching models                                                                     |
| `cursor(criteria?, sort?)`                                                   | An `AbstractStoreCursor`                                                                      |
| `insertOne(object)`                                                          | Inserts, returns the model with `created` / `updated` set                                     |
| `replaceOne(object, options?)` / `replaceSeveral(objects)`                   | Full replace; throws [`NotFoundError`](#errors) when a key does not exist                     |
| `upsertOne(object, setOnInsert?)`                                            | Inserts or updates; `upsertOneWithInfo` returns an `UpsertResult` (below)                     |
| `partialUpdateByKey(key, update, criteria?, options?)`                       | Partial update by key, returns the updated model; throws `NotFoundError` when nothing matches |
| `partialUpdateOne(object, update, options?)`                                 | Partial update of an already-loaded model, by its key; throws `NotFoundError` when it is gone |
| `partialUpdateMany(criteria, update, options?)`                              | Bulk partial update                                                                           |
| `deleteByKey(key, criteria?)` / `deleteOne(object)` / `deleteMany(criteria)` | Deletions; deleting a missing key is a no-op                                                  |

`criteria`, `sort` and `update` (`$set`, `$push`, `$setOnInsert`, …) follow the mongo query/update shape, typed against the model.

### `created` and `updated`

`updated` means "last written". Every write sets it to the write time, read from the app clock (`new Date()` in the process doing the write):

| Write                           | `updated`                                                         | `created`                                         |
| ------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| `insertOne`                     | set unless the object has one                                     | set unless the object has one                     |
| `upsertOne(WithInfo)`           | set unless the object has one                                     | set on insert only                                |
| `replaceOne` / `replaceSeveral` | always set                                                        | the stored value is kept, the object's is ignored |
| `partialUpdate*`                | set, unless the update sets it or `touchUpdated: false` is passed | can not be updated                                |

A partial update may set `updated` itself with `$set`, `$currentDate` or `$max`. Any other operator on `updated`, and any operator on `created`, throws [`ProtectedFieldUpdateError`](#errors) before anything is written.

For an upsert, `updated` from the object wins: do not spread a loaded document into an upsert, or its stale `updated` is kept.

Two processes stamp from their own clocks, so `updated` may be a few milliseconds off between them, and two writes in the same millisecond get the same value. It is fit for retention rules, not for ordering concurrent events.

```ts
interface PartialUpdateOptions {
  // false: leave `updated` as stored, for backfills, migrations and technical
  // flags that must not count as a change. Defaults to true. Costs nothing.
  touchUpdated?: boolean;
  // see "Missing documents" below
  allowNotFound?: boolean;
}
```

`partialUpdateMany` and `partialUpdateByKeyWithInfo` take `TouchUpdatedOptions` (`touchUpdated` only).

### Missing documents

`replaceOne`, `partialUpdateByKey` and `partialUpdateOne` throw [`NotFoundError`](#errors) when no stored document matches. Pass `allowNotFound: true` to resolve `undefined` instead; the return type then becomes `Model | undefined`:

```ts
const task = await tasks.partialUpdateByKey(
  id,
  { $set: { done: true } },
  undefined,
  { allowNotFound: true },
); // Task | undefined

const replaced = await tasks.replaceOne(task, { allowNotFound: true }); // Task | undefined
```

The type follows the option: `Model` when it is absent or `false`, `Model | undefined` when it is `true` or a `boolean`. It also covers [`DeletedAfterUpdateError`](#errors): `undefined` then means the update was applied but the document is gone. `replaceSeveral` has no such option.

`UpsertResult` tells how the upsert resolved. `prev` is the document as it was before the update, read atomically with the write. `inserted` is a shorthand for `resolvedAs === "inserted"`.

```ts
type UpsertResult<Model> =
  | { resolvedAs: "inserted"; inserted: true; object: Model }
  | { resolvedAs: "updated"; inserted: false; object: Model; prev: Model };
```

### Writes with info

Three optional methods return the stored document the write applied to, so that callers (and [`liwi-subscribe-store`](../liwi-subscribe-store)) do not have to trust an object loaded earlier:

| Method                                               | Resolves                                  |
| ---------------------------------------------------- | ----------------------------------------- |
| `partialUpdateByKeyWithInfo(key, update, criteria?)` | `PartialUpdateResult<Model> \| undefined` |
| `replaceOneWithInfo(object)`                         | `WriteResult<Model> \| undefined`         |
| `deleteByKeyWithInfo(key, criteria?)`                | `DeleteResult<Model> \| undefined`        |

```ts
interface WriteResult<Model> {
  prev: Model; // the stored document the write applied to
  next: Model; // the stored document after the write
}

interface PartialUpdateResult<Model> {
  prev: Model;
  // undefined when a concurrent write deleted the document before it could
  // be read back: the update was still applied
  next: Model | undefined;
}

interface DeleteResult<Model> {
  prev: Model; // the stored document as it was deleted
}
```

`undefined` means no stored document matched the key (and criteria): nothing was written. These methods never throw `NotFoundError`.

An implementation must read `prev` atomically with the write (in mongo, `findOneAnd*` with `returnDocument: "before"`). They are optional so that existing implementations keep compiling; the subscribe store falls back to reading `prev` before the write when they are missing, which is not atomic.

### Errors

They are exported as classes, so they can be checked with `instanceof`.

- **`ProtectedFieldUpdateError`**: a partial update touched `created`, or touched `updated` with an operator other than `$set`, `$currentDate` or `$max` (see [`created` and `updated`](#created-and-updated)); an upsert passed `updated` in `setOnInsert`. Thrown before anything is written.

- **`NotFoundError`**: the document targeted by the write does not exist, or no longer matches `criteria`. Thrown by `replaceOne`, `replaceSeveral`, `partialUpdateByKey` and `partialUpdateOne`, unless [`allowNotFound`](#missing-documents) is passed. Deletions do not throw it. It states that the document is gone.
- **`DeletedAfterUpdateError`** extends `NotFoundError`: the partial update **was applied**, then a concurrent write deleted the document before it could be read back. The document is gone either way, so it is a `NotFoundError`; check for the subclass only when you need to know whether the update happened. Thrown by the subscribe store's `partialUpdateByKey` / `partialUpdateOne`.

## Queries

`createQuerySingleItem` / `createQueryCollection` take `CreateQueryOptions`:

```ts
interface QueryOptions<Model> {
  criteria?: Criteria<Model>;
  sort?: Sort<Model>;
  fields?: Fields<Model>;
  limit?: number;
  skip?: number;
}
// plus an optional `transformer: (model) => Transformed`,
// required when `fields` is given so the projected result stays typed
```

A `Query` is lazy and re-runnable:

```ts
interface Query<Result, Params, KeyValue> {
  changeParams: (params: Params) => void;
  changePartialParams: (params: Partial<Params>) => void;
  fetch: <T>(onFulfilled: (result: QueryResult<Result>) => T) => Promise<T>;
  fetchAndSubscribe: (
    callback: SubscribeCallback<KeyValue, Result>,
  ) => QuerySubscription;
  subscribe: (
    callback: SubscribeCallback<KeyValue, Result>,
  ) => QuerySubscription;
}
```

`fetch` resolves `{ result, info, meta }`, where `meta.total` is the unpaginated count and `info` carries `limit` / `sort` / `keyPath`.

Subscribe callbacks receive `Changes`, an array of:

```ts
type Change<KeyValue, Result> =
  | {
      type: "initial";
      initial: Result;
      meta: QueryMeta;
      queryInfo: QueryInfo<any>;
    }
  | { type: "inserted"; result: Result }
  | { type: "updated"; result: Result }
  | { type: "deleted"; keys: KeyValue[] };
```

`fetchAndSubscribe` emits the `initial` change first, then updates. A `QuerySubscription` is a thenable — resolved once the initial fetch completed — with `stop()` and `cancel()`.

Plain stores only implement `fetch`; subscriptions require a store wrapped by [`liwi-subscribe-store`](../liwi-subscribe-store), which produces `SubscribableStoreQuery` instances.

## Implementing a store

Implement `Store` and extend the provided abstract classes:

- `AbstractConnection` — connection lifecycle.
- `AbstractCursor` — `next`, `nextResult`, `forEach`, `toArray`.
- `AbstractStoreCursor` — cursor bound to a store and its key path.

```ts
import {
  AbstractConnection,
  AbstractStoreCursor,
  NotFoundError,
} from "liwi-store";
import type { Store, SubscribableStore } from "liwi-store";
```

Implement the [`…WithInfo` methods](#writes-with-info) when the database can return the previous document atomically: subscribers then get a true `prev`.

See [`liwi-mongo`](../liwi-mongo) for a complete implementation.
