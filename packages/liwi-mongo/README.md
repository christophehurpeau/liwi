<h1 align="center">
  liwi-mongo
</h1>

<p align="center">
  mongo implementation for liwi
</p>

<p align="center">
  <a href="https://npmjs.org/package/liwi-mongo"><img src="https://img.shields.io/npm/v/liwi-mongo.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/liwi-mongo"><img src="https://img.shields.io/npm/dw/liwi-mongo.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/liwi-mongo"><img src="https://img.shields.io/node/v/liwi-mongo.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/liwi-mongo"><img src="https://img.shields.io/npm/types/liwi-mongo.svg?style=flat-square" alt="types"></a>
</p>

## About

MongoDB implementation of the [`liwi-store`](../liwi-store) contract, plus live queries when wrapped in a subscribe store.

## Install

```bash
npm install --save liwi-mongo
```

## Usage

```ts
import { MongoConnection, MongoStore } from "liwi-mongo";
import type { MongoBaseModel, MongoInsertType } from "liwi-mongo";

interface User extends MongoBaseModel {
  firstname: string;
  lastname: string;
  groups: string[];
}

const connection = new MongoConnection({ database: "liwi-mongo-example" });
const users = new MongoStore<User>(connection, "users");

const user: MongoInsertType<User> = {
  firstname: "John",
  lastname: "Doe",
  groups: [],
};
const insertedUser = await users.insertOne(user); // created / updated are set

await users.partialUpdateMany(
  { firstname: "John" },
  { $set: { firstname: "Johnny" }, $push: { groups: "Music" } },
);

const found = await users.findByKey(insertedUser._id);

await connection.close();
```

A runnable version of this lives in [`liwi-mongo-example`](../liwi-mongo-example).

## Models

```ts
interface MongoBaseModel<KeyValue extends AllowedKeyValue = string> {
  _id: KeyValue;
  created: Date;
  updated: Date;
}
```

The key path is always `_id`. `MongoInsertType<Model>` makes `_id`, `created` and `updated` optional; the store fills `created` / `updated` on insert and `updated` on every update. `insertOne` mutates and returns the object you passed.

## `MongoConnection`

```ts
new MongoConnection({ host, port, database, user, password });
```

`host` defaults to `localhost` and `port` to `27017`; `database` is required. Connecting starts immediately in the constructor and is awaited lazily by store operations, so no explicit `connect()` call is needed. Credentials are redacted from logs. Call `connection.close()` on shutdown.

## `MongoStore`

```ts
const store = new MongoStore<Model>(connection, "collectionName");
```

Implements the whole [`Store`](../liwi-store#store) interface (`findAll`, `findByKey`, `findOne`, `count`, `cursor`, `insertOne`, `replaceOne`, `replaceSeveral`, `upsertOne`, `upsertOneWithInfo`, `partialUpdateByKey`, `partialUpdateOne`, `partialUpdateMany`, `deleteByKey`, `deleteOne`, `deleteMany`), with criteria, sorts and updates typed against the model. `Update<Model>` is re-exported for typing `$set` / `$push` payloads:

```ts
import type { Update } from "liwi-mongo";

const set: Update<Task>["$set"] = { completed: true };
```

The store also exposes the underlying driver handles when you need them: `store.collection` resolves the `mongodb` collection.

## Queries and subscriptions

```ts
import { createMongoSubscribeStore } from "liwi-mongo";

export const tasksStore = createMongoSubscribeStore<Task>(
  new MongoStore<Task>(connection, "tasks"),
);

const query = tasksStore.createQueryCollection({
  criteria: { completed: false },
  sort: { created: 1 },
  fields: { completed: 1, created: 1, label: 1 },
  transformer: ({ _id, completed, created, label }) => ({
    _id,
    completed,
    created,
    label,
  }),
  limit: 20,
  skip: 0,
});

const { result, meta } = await query.fetch((queryResult) => queryResult);
// meta.total is the count ignoring limit/skip

const subscription = query.fetchAndSubscribe((error, changes) => {
  // "initial", then "inserted" / "updated" / "deleted"
});
subscription.stop();
```

`createQuerySingleItem` behaves the same but resolves a single item.

Subscriptions are driven in-process: writes going through the subscribe store are matched against the query criteria with [mingo](https://github.com/kofrasa/mingo).

Caveats:

- Writes performed outside this process (other services, mongo shell, migrations) are not detected.
- `$text` criteria cannot be matched in memory: such queries fetch correctly but never emit updates.
- Queries returned by the subscribe store are fixed — `changeParams` throws; build a new query when parameters change.
