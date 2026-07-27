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

| Method                                                                       | Description                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `createQuerySingleItem(options)`                                             | Builds a `Query<Result, Params>` resolving one item                       |
| `createQueryCollection(options)`                                             | Builds a `Query<Item[], Params>`                                          |
| `findAll(criteria?, sort?)`                                                  | All matching models                                                       |
| `findByKey(key, criteria?)`                                                  | One model by key, or `undefined`                                          |
| `findOne(criteria, sort?)`                                                   | First matching model, or `undefined`                                      |
| `count(criteria?)`                                                           | Number of matching models                                                 |
| `cursor(criteria?, sort?)`                                                   | An `AbstractStoreCursor`                                                  |
| `insertOne(object)`                                                          | Inserts, returns the model with `created` / `updated` set                 |
| `replaceOne(object)` / `replaceSeveral(objects)`                             | Full replace                                                              |
| `upsertOne(object, setOnInsert?)`                                            | Insert or update; `upsertOneWithInfo` also returns `{ object, inserted }` |
| `partialUpdateByKey(key, update, criteria?)`                                 | Partial update by key, returns the updated model                          |
| `partialUpdateOne(object, update)`                                           | Partial update of an already-loaded model                                 |
| `partialUpdateMany(criteria, update)`                                        | Bulk partial update                                                       |
| `deleteByKey(key, criteria?)` / `deleteOne(object)` / `deleteMany(criteria)` | Deletions                                                                 |

`criteria`, `sort` and `update` (`$set`, `$push`, `$setOnInsert`, …) follow the mongo query/update shape, typed against the model.

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
import { AbstractConnection, AbstractStoreCursor } from "liwi-store";
import type { Store, SubscribableStore } from "liwi-store";
```

See [`liwi-mongo`](../liwi-mongo) for a complete implementation.
