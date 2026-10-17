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

The key path is always `_id`. `MongoInsertType<Model>` makes `_id`, `created` and `updated` optional. Every write sets `updated` to the write time from the app clock, and an update or a replace never changes `created`: see [`created` and `updated`](../liwi-store#created-and-updated) for the rule of each method. `insertOne` and `upsertOne` mutate and return the object you passed; `replaceOne` leaves it untouched and returns the stored document.

Requires MongoDB ≥ 4.2: replaces are update pipelines.

## `MongoConnection`

```ts
new MongoConnection({ host, port, database, user, password });
```

`host` defaults to `localhost` and `port` to `27017`; `database` is required. Connecting starts immediately in the constructor and is awaited lazily by store operations, so no explicit `connect()` call is needed. Credentials are redacted from logs. Call `connection.close()` on shutdown.

```ts
new MongoConnection({ client });
```

Uses a `MongoClient` you created yourself, connected or connecting: a connection string or client options `MongoConfig` does not cover, or the [in-memory client](#in-memory). `close()` closes it.

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

### Writes and their cost

The plain methods do one round trip and do not read the previous document:

| Method               | Driver call                                                           | Missing key            |
| -------------------- | --------------------------------------------------------------------- | ---------------------- |
| `partialUpdateByKey` | `findOneAndUpdate` with `returnDocument: "after"`                     | throws `NotFoundError` |
| `partialUpdateMany`  | one `updateMany`; every document gets the same `updated`              | —                      |
| `replaceOne`         | `findOneAndUpdate` with a replace pipeline, `returnDocument: "after"` | throws `NotFoundError` |
| `deleteByKey`        | `deleteOne`                                                           | no-op                  |

The replace pipeline is `$replaceWith` of the object (wrapped in `$literal`, so string values starting with `$` stay data) merged with the stored `created`. A plain `replaceOne` command could not keep `created`.

The [`…WithInfo` variants](../liwi-store#writes-with-info) also return the previous document, read atomically with the write. The subscribe store uses them:

| Method                       | Driver calls                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `partialUpdateByKeyWithInfo` | `findOneAndUpdate` with `returnDocument: "before"`, then `findOne` for `next`                                           |
| `replaceOneWithInfo`         | the replace pipeline with `returnDocument: "before"`; `next` is the replacement with the stored `created`, no read back |
| `deleteByKeyWithInfo`        | `findOneAndDelete`                                                                                                      |

Mongo cannot return both the before and after documents of one update, so `partialUpdateByKeyWithInfo` reads `next` back. That read may already include a later concurrent write (which emits its own change), and it finds nothing if a concurrent delete landed first: `next` is then `undefined` although the update was applied.

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

`createQuerySingleItem` behaves the same but resolves a single item. Without `sort`, its criteria must match at most one document: when one update moves several matching documents, the subscription reports the error `should not match more than 1, use sort if you can have multiple match` through its callback. With `sort`, it refetches on every relevant update.

Subscriptions are driven in-process: writes going through the subscribe store are matched against the query criteria with [mingo](https://github.com/kofrasa/mingo).

Caveats:

- Writes performed outside this process (other services, mongo shell, migrations) are not detected.
- `$text` criteria cannot be matched in memory: such queries fetch correctly but never emit updates.
- Queries returned by the subscribe store are fixed — `changeParams` throws; build a new query when parameters change.

## Testing

Two ways to give tests a database, both behind the same `MongoConnection`, so the stores and the app code under test do not change.

### A real mongod

The behaviour is mongod's by definition. Start one per test run with [`mongodb-memory-server`](https://github.com/typegoose/mongodb-memory-server) (it downloads a mongod binary once, then starts in about a second) or point at a mongod you already run:

```ts
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { MongoConnection, MongoRegistry } from "liwi-mongo";

const mongod = await MongoMemoryServer.create();
const connection = new MongoConnection({
  host: "127.0.0.1",
  port: mongod.instanceInfo!.port,
  database: "app-test",
});
const stores = createStores(connection); // your app's MongoStore instances
await new MongoRegistry(stores).syncIndexes();

// between tests
await Promise.all(stores.map((store) => store.deleteMany({})));

// teardown
await connection.close();
await mongod.stop();
```

Nothing in liwi is needed for this. Every write is a round trip to another process, which is what makes a large e2e suite slow.

### In memory

`liwi-mongo/memory` is a mongo client that keeps the data in the test process: no binary, no port, no round trip. `MongoStore`, its queries, subscriptions and `MongoRegistry.syncIndexes` run unchanged on top of it; queries, sorts, projections, update operators and pipelines are evaluated by [mingo](https://github.com/kofrasa/mingo).

```ts
import { MongoConnection, MongoRegistry } from "liwi-mongo";
import { createMemoryMongoClient } from "liwi-mongo/memory";

const memory = createMemoryMongoClient();
const connection = new MongoConnection({ client: memory.client });
const stores = createStores(connection);
await new MongoRegistry(stores).syncIndexes();

// between tests: empties every collection, indexes stay
memory.clear();
```

An e2e server can switch on an environment variable, and import the entry only in that mode:

```ts
const connection = process.env.E2E_MEMORY_DATABASE
  ? new MongoConnection({
      client: (await import("liwi-mongo/memory")).createMemoryMongoClient()
        .client,
    })
  : new MongoConnection(config.mongo);
```

Sync the indexes as production does: the memory client only enforces the unique indexes it was asked to create.

`createMemoryMongoClient({ database })` — `database` (default `liwi-memory`) is the one `client.db()` returns. Every client has its own data.

#### Behaviour

Documents are written and read back the way the driver serializes them: `undefined` becomes `null`, functions are dropped, a `Buffer` becomes a `Binary`, a class instance or a `Map` becomes a plain document. Every read returns a copy. A missing `_id` is generated as an `ObjectId`, set on the object passed in, as the driver does.

Indexes are listed as mongod lists them, so a second `syncIndexes` plans nothing. Unique indexes are enforced, with `sparse`, `partialFilterExpression`, compound and array (multikey) keys, and a case-insensitive `collation` (strength 1 or 2). A violation throws a `MongoServerError` with code `11000`, `keyPattern` and `keyValue`.

Errors carry mongod's codes where code reads them: `26` (missing collection on `listIndexes` / `dropIndex`), `27` (missing index), `40` (conflicting update paths), `66` (`_id` change), `85` / `86` (index conflicts), `11000` (duplicate key).

Implemented driver methods:

- client: `db`, `connect`, `close`, `on`
- db: `collection`, `command` (`ping`, `collMod` of an index), `dropDatabase`
- collection: `insertOne`, `insertMany`, `findOne`, `find` (`sort`, `project`, `skip`, `limit`), `countDocuments`, `estimatedDocumentCount`, `aggregate` (with `$lookup` on other collections of the database), `updateOne`, `updateMany`, `findOneAndUpdate` (`upsert`, `arrayFilters`, `sort`, `returnDocument`, `projection`), `deleteOne`, `deleteMany`, `findOneAndDelete`, `createIndex`, `createIndexes`, `listIndexes`, `indexes`, `dropIndex`, `drop`

Reading any other method throws `liwi-mongo/memory: collection(<name>).<method> is not supported` rather than `undefined is not a function`.

#### What differs from mongod

- `$text` queries and `$meta` sorts throw; text indexes are created and listed, not searched.
- TTL indexes (`expireAfterSeconds`) never expire documents.
- No transactions, sessions, change streams (`watch`) or `bulkWrite`. Options such as `session`, `writeConcern` or `collation` on a query are ignored.
- Writes are never concurrent: each operation runs to completion before the next one starts. Code relying on mongod interleaving two writes is not exercised.
- `insertMany` stops at the first error and throws it as is, not as a `MongoBulkWriteError`.
- `$out` and `$merge` stages do not write.
- `$currentDate` reads this process clock.
- Data is lost when the process exits, and invisible to any other process: an e2e test that reads the database directly must do so through the server.

#### Contract suite

[`src/memory/contract.test.ts`](src/memory/contract.test.ts) runs the same scenarios against the memory client and against a real mongod started with `mongodb-memory-server`. The mongod run is opt-in:

```bash
pnpm --filter liwi-mongo run test:integration
```

A behaviour difference found in an app belongs there first, as a scenario that passes on mongod and fails in memory.

### Choosing

|                  | Real mongod                                   | In memory                              |
| ---------------- | --------------------------------------------- | -------------------------------------- |
| Fidelity         | exact                                         | the [contract suite](#contract-suite)  |
| Setup            | binary download (cache it in CI), a free port | none                                   |
| Speed            | a round trip per operation                    | a function call                        |
| Data shared with | any process connecting to it                  | the process that created it            |
| Not covered      |                                               | [see above](#what-differs-from-mongod) |
