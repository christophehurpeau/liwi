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

## Connection, store, registry

Three objects, deliberately not one:

- **`MongoConnection`** — one per database. Owns the `MongoClient` and its lifecycle; every store shares it and none of them opens its own. Your app closes it, nothing else does.
- **`MongoStore`** — one per collection. Carries the model type (criteria, sorts and updates are checked against it), the reads and writes, and the [index declaration](#indexes). Bound to a connection at construction.
- **`MongoRegistry`** — one per app. A list of stores and nothing more: no connection, no data access. It exists so the index step can visit every collection from one place.

Consequences worth knowing:

- The registry belongs next to the connection, not inside the module of any one store. Both are app-wide; a store module is not.
- Registering a store changes nothing about queries. An unregistered store works exactly the same — it just never gets its indexes synced.
- `runIndexesCli` takes the connection separately from the registry because the registry has no handle on it, and something has to close it for the process to exit.

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
const store = new MongoStore<Model>(connection, "collectionName", {
  indexes: [{ key: { completed: 1, created: 1 } }],
});
```

The third argument is optional and currently only carries the [index declaration](#indexes).

Implements the whole [`Store`](../liwi-store#store) interface (`findAll`, `findByKey`, `findOne`, `count`, `cursor`, `insertOne`, `replaceOne`, `replaceSeveral`, `upsertOne`, `upsertOneWithInfo`, `partialUpdateByKey`, `partialUpdateOne`, `partialUpdateMany`, `deleteByKey`, `deleteOne`, `deleteMany`), with criteria, sorts and updates typed against the model. `Update<Model>` is re-exported for typing `$set` / `$push` payloads:

```ts
import type { Update } from "liwi-mongo";

const set: Update<Task>["$set"] = { completed: true };
```

The store also exposes the underlying driver handles when you need them: `store.collection` resolves the `mongodb` collection.

## Indexes

Indexes are declared on the store and applied by an explicit sync step. The declaration is validated eagerly in the constructor (empty key, a name resolving to `_id_`, duplicate names, more than one text index).

```ts
import { MongoRegistry, MongoStore } from "liwi-mongo";

const tasksStore = new MongoStore<Task>(connection, "tasks", {
  indexes: [
    { key: { completed: 1, created: 1 } },
    { key: { label: "text" } },
    { key: { sessionEnd: 1 }, expireAfterSeconds: 3600 },
    { key: { tenant: 1 }, partialFilterExpression: { completed: true } },
  ],
});

export const mongoRegistry = new MongoRegistry([tasksStore, usersStore]);
```

`key` is typed against the model's dotted paths, so a typo is a compile error rather than an unused index. Index names follow mongo's own algorithm (`completed_1_created_1`, `label_text`) unless `name` is given.

### Syncing

Nothing runs implicitly. Call the sync from a deploy or migration step, never on every boot and never in a request path — `createIndexes` does not return until the build finishes.

```ts
await mongoRegistry.syncIndexes();
```

Stores are visited sequentially, sorted by collection name. A failing collection does not stop the others; the failures surface together as an `AggregateError`.

Sync converges the collection on the declaration:

- missing index: created (all creates for a collection go in one batched `createIndexes`);
- changed key or an option that cannot be changed in place: dropped, then recreated;
- changed `expireAfterSeconds` (when the index is already TTL) or `hidden`: applied in place with `collMod`;
- present but not declared: dropped — see below.

Drops run before creates, so a rename (same key, new name) needs no special handling and frees a slot against the 64-index cap.

### The declared list is the whole truth

Any index that is not declared is dropped, `_id_` excepted. Turn it off on the registry, or per call:

```ts
new MongoRegistry(stores, { dropUndeclaredIndexes: false });
await mongoRegistry.syncIndexes({ dropUndeclaredIndexes: false });
```

Resolution order is per-call option, then registry option, then `true`.

### Dry run and CI check

```ts
import { formatIndexPlans, isMongoIndexPlanEmpty } from "liwi-mongo";

const plans = await mongoRegistry.planIndexes();
console.log(formatIndexPlans(plans));
if (!plans.every(isMongoIndexPlanEmpty)) process.exit(1);
```

`planIndexes` only reads. `syncIndexes({ dryRun: true })` returns the same plan wrapped in a `MongoIndexSyncResult` and mutates nothing.

### `runIndexesCli`

That script is the same in every app, so it ships here. Point an entry at your registry:

```ts
// scripts/syncIndexes.ts
import { runIndexesCli } from "liwi-mongo";
import { mongoConnection, mongoRegistry } from "../src/stores/index.ts";

process.exitCode = await runIndexesCli({
  registry: mongoRegistry,
  connection: mongoConnection,
});
```

```
node scripts/syncIndexes.ts                      # plan, prints and changes nothing
node scripts/syncIndexes.ts plan --check         # exit 1 when the plan is not empty
node scripts/syncIndexes.ts sync [--dry-run]     # apply
node scripts/syncIndexes.ts sync --keep-undeclared
```

Exit codes: `0` done, `1` drift under `--check`, `2` unknown command. `connection` is optional and only closed so the process can exit; `argv` defaults to `process.argv.slice(2)`, and `log` / `logError` default to `console`. Only stores that have been registered are visited, so the entry must import the module graph that creates them.

```
tasks
  + create    completed_1_created_1  {"completed":1,"created":1}
  ~ recreate  label_text             key: {"title":"text"} -> {"label":"text"}
  ! modify    sessions_ttl           expireAfterSeconds: 3600 -> 60
  - drop      legacy_status_1
  = 2 unchanged
users
  = 3 unchanged, nothing to do
```

### Supported options

`name`, `unique`, `sparse`, `hidden`, `expireAfterSeconds`, `partialFilterExpression`, `collation`, `weights`, `default_language`, `language_override`, `wildcardProjection`.

Deliberately excluded: `background` (a no-op since 4.2), `v` / `textIndexVersion` / `2dsphereIndexVersion` (server-managed — comparing them would cause endless recreates), `storageEngine`, `commitQuorum`, legacy 2d `bits` / `min` / `max` / `bucketSize`, and `prepareUnique`. Use `store.collection` directly for those.

Comparison ignores server-added fields, compares only the collation keys you declared (the server echoes a fully expanded collation), and is insensitive to key order inside `partialFilterExpression` / `wildcardProjection`.

### Caveats

- **Run it from one place.** Two processes syncing at once can drop what the other just created. `IndexNotFound` on drop is swallowed and a conflicting create is retried once, but this is not a substitute for a single migration step.
- **Recreate leaves a window.** A rebuilt index is absent while it builds, so a hot query can fall back to a collection scan. For large collections, create under a new name, deploy the declaration, then let a later sync drop the old one.
- **Adding `unique: true` is a drop and recreate**, and fails outright if duplicates exist.
- **Atlas.** Atlas Search indexes are not returned by `listIndexes` and are safe, but indexes created by Performance Advisor or another service _will_ be dropped. Use `dropUndeclaredIndexes: false` where that matters.
- **A store that is never registered is never synced.** That is the price of explicit registration; declare and register in the same place.
- Two stores on the same collection with different declarations will fight; `MongoRegistry.add` warns on a duplicate collection name.
- `Object.entries` hoists integer-like keys, so a model field literally named `"0"` would silently reorder a compound key.

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
