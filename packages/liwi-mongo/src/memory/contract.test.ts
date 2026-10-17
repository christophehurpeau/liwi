import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type { Changes } from "liwi-store";
import { NotFoundError } from "liwi-store";
import type { Collection, Document } from "mongodb";
import mongodb from "mongodb";
import type { MongoBaseModel } from "../MongoBaseModel.ts";
import MongoConnection from "../MongoConnection.ts";
import MongoRegistry from "../MongoRegistry.ts";
import MongoStore from "../MongoStore.ts";
import createMongoSubscribeStore from "../createMongoSubscribeStore.ts";
import { isMongoIndexPlanEmpty } from "../indexes/diffIndexes.ts";
import type { MongoIndex } from "../indexes/types.ts";
import { createMemoryMongoClient } from "./createMemoryMongoClient.ts";

/*
 * The same scenarios against the memory client and a real mongod: the memory
 * client is only as good as this suite says it matches mongod.
 */

interface Task extends MongoBaseModel {
  label: string;
  done: boolean;
  email?: string | null;
  tenant?: string;
  tags?: string[];
  note?: string | null;
  count?: number;
  items?: { key: number; value: number }[];
  dueAt?: Date;
}

interface Backend {
  name: string;
  skip: string | false;
  connect: () => Promise<{
    connection: MongoConnection;
    stop: () => Promise<void>;
  }>;
}

const backends: Backend[] = [
  {
    name: "memory",
    skip: false,
    connect: () => {
      const connection = new MongoConnection({
        client: createMemoryMongoClient().client,
      });
      return Promise.resolve({ connection, stop: () => connection.close() });
    },
  },
  {
    name: "mongod",
    skip: !process.env.LIWI_MONGO_INTEGRATION && "set LIWI_MONGO_INTEGRATION=1",
    connect: async () => {
      const { MongoMemoryServer } = await import("mongodb-memory-server-core");
      const mongod = await MongoMemoryServer.create();
      const connection = new MongoConnection({
        host: "127.0.0.1",
        port: mongod.instanceInfo!.port,
        database: "liwi-mongo-memory-contract",
      });
      await connection.getConnection();
      return {
        connection,
        stop: async () => {
          await connection.close();
          await mongod.stop();
        },
      };
    },
  },
];

const getDuplicateKeyError = async (
  write: Promise<unknown>,
): Promise<mongodb.MongoServerError> => {
  const error = await write.then(
    () => assert.fail("expected a duplicate key error"),
    (writeError: unknown) => writeError,
  );
  assert.ok(error instanceof mongodb.MongoServerError);
  assert.equal(error.code, 11_000);
  return error;
};

const getServerErrorCode = async (
  operation: Promise<unknown>,
): Promise<unknown> => {
  const error = await operation.then(
    () => assert.fail("expected a server error"),
    (operationError: unknown) => operationError,
  );
  assert.ok(error instanceof mongodb.MongoServerError, String(error));
  return error.code;
};

for (const backend of backends) {
  describe(
    `liwi-mongo contract (${backend.name})`,
    { skip: backend.skip, timeout: 120_000 },
    () => {
      let connection: MongoConnection;
      let stop: () => Promise<void>;
      let collectionIndex = 0;

      before(async () => {
        ({ connection, stop } = await backend.connect());
      });

      after(async () => {
        await stop();
      });

      const createStore = (
        indexes: MongoIndex<Task>[] = [],
      ): MongoStore<Task> => {
        collectionIndex += 1;
        return new MongoStore<Task>(connection, `tasks${collectionIndex}`, {
          indexes,
        });
      };

      const getCollection = (store: MongoStore<Task>): Promise<Collection> =>
        store.collection as unknown as Promise<Collection>;

      const syncIndexes = async (store: MongoStore<Task>): Promise<void> => {
        await new MongoRegistry([store]).syncIndexes();
      };

      describe("reads and writes", () => {
        let store: MongoStore<Task>;

        beforeEach(() => {
          store = createStore();
        });

        it("stores undefined as null and reads back a copy", async () => {
          const inserted = await store.insertOne({
            label: "a",
            done: false,
            note: undefined,
          });

          const found = await store.findByKey(inserted._id);
          assert.deepEqual(found, { ...inserted, note: null });

          found.label = "mutated";
          assert.equal((await store.findByKey(inserted._id))!.label, "a");
        });

        it("rejects a second document with the same _id", async () => {
          await store.insertOne({ _id: "1", label: "a", done: false });

          const error = await getDuplicateKeyError(
            store.insertOne({ _id: "1", label: "b", done: false }),
          );
          assert.deepEqual(error.keyValue, { _id: "1" });
        });

        it("finds with criteria, sort, skip, limit and fields", async () => {
          await store.insertOne({ _id: "1", label: "c", done: true, count: 3 });
          await store.insertOne({
            _id: "2",
            label: "a",
            done: false,
            count: 1,
          });
          await store.insertOne({ _id: "3", label: "b", done: true, count: 2 });
          await store.insertOne({ _id: "4", label: "d", done: true });

          const done = await store.findAll({ done: true }, { label: -1 });
          assert.deepEqual(
            done.map(({ _id }) => _id),
            ["4", "1", "3"],
          );
          assert.equal(await store.count({ count: { $gte: 2 } }), 2);
          assert.equal(
            (await store.findOne({ done: true }, { count: 1 }))!._id,
            "4",
          );

          const cursor = await store.cursor({}, { _id: 1 }, { label: 1 });
          cursor.advance(1);
          await cursor.limit(2);
          assert.deepEqual(await cursor.toArray(), [
            { _id: "2", label: "a" },
            { _id: "3", label: "b" },
          ]);
        });

        it("sorts values of different types in BSON order", async () => {
          const collection = await getCollection(store);
          const documents: Document[] = [
            { _id: "string", value: "b" },
            { _id: "number", value: 3 },
            { _id: "missing" },
            { _id: "null", value: null },
            { _id: "date", value: new Date(0) },
            { _id: "boolean", value: true },
            { _id: "array", value: [5, 0] },
          ];
          await collection.insertMany(documents);

          const sorted = await collection
            .find({})
            .sort({ value: 1, _id: 1 })
            .toArray();
          assert.deepEqual(
            sorted.map(({ _id }) => _id),
            ["missing", "null", "array", "number", "string", "boolean", "date"],
          );
        });

        it("matches arrays, null, regexps and dates like mongod", async () => {
          await store.insertOne({
            _id: "1",
            label: "Alpha",
            done: false,
            tags: ["x", "y"],
            dueAt: new Date("2026-01-01"),
          });
          await store.insertOne({ _id: "2", label: "beta", done: false });

          const ids = async (criteria: Document): Promise<string[]> => {
            const found = await store.findAll(criteria, { _id: 1 });
            return found.map(({ _id }) => _id);
          };

          assert.deepEqual(await ids({ tags: "y" }), ["1"]);
          assert.deepEqual(await ids({ tags: null }), ["2"]);
          assert.deepEqual(await ids({ label: /^al/i }), ["1"]);
          assert.deepEqual(
            await ids({ dueAt: { $lt: new Date("2026-06-01") } }),
            ["1"],
          );
          assert.deepEqual(await ids({ tags: { $exists: false } }), ["2"]);
          assert.deepEqual(await ids({ $or: [{ _id: "2" }, { tags: "x" }] }), [
            "1",
            "2",
          ]);
        });

        it("applies update operators and refreshes updated", async () => {
          const inserted = await store.insertOne({
            _id: "1",
            label: "a",
            done: false,
            tags: ["x"],
            note: "n",
            items: [
              { key: 1, value: 0 },
              { key: 2, value: 0 },
            ],
          });

          const next = await store.partialUpdateByKey("1", {
            $set: { label: "b" },
            $inc: { count: 2 },
            $push: { tags: "y" },
            $unset: { note: true },
          });
          assert.equal(next.label, "b");
          assert.equal(next.count, 2);
          assert.deepEqual(next.tags, ["x", "y"]);
          assert.equal("note" in next, false);
          assert.ok(next.updated.getTime() >= inserted.updated.getTime());
          assert.deepEqual(next.created, inserted.created);

          const collection = await getCollection(store);
          await collection.updateOne({ _id: "1", "items.key": 2 } as Document, {
            $set: { "items.$.value": 5 },
          });
          await collection.updateOne(
            { _id: "1" } as Document,
            { $inc: { "items.$[item].value": 1 } },
            { arrayFilters: [{ "item.key": 1 }] },
          );
          assert.deepEqual((await store.findByKey("1"))!.items, [
            { key: 1, value: 1 },
            { key: 2, value: 5 },
          ]);
        });

        it("rejects conflicting update paths and _id changes", async () => {
          await store.insertOne({ _id: "1", label: "a", done: false });
          const collection = await getCollection(store);

          assert.equal(
            await getServerErrorCode(
              collection.updateOne({ _id: "1" } as Document, {
                $set: { label: "b" },
                $unset: { label: true },
              }),
            ),
            40,
          );
          assert.equal(
            await getServerErrorCode(
              collection.updateOne({ _id: "1" } as Document, {
                $set: { _id: "2" },
              }),
            ),
            66,
          );
        });

        it("throws NotFoundError when updating or replacing a missing key", async () => {
          await assert.rejects(
            store.partialUpdateByKey("missing", { $set: { label: "x" } }),
            NotFoundError,
          );
          await assert.rejects(
            store.replaceOne({
              _id: "missing",
              label: "x",
              done: false,
              created: new Date(),
              updated: new Date(),
            }),
            NotFoundError,
          );
        });

        it("replaces keeping created and $-prefixed strings as data", async () => {
          const inserted = await store.insertOne({
            _id: "1",
            label: "a",
            done: false,
            note: "n",
          });

          const replaced = await store.replaceOne({
            ...inserted,
            label: "$label",
            note: undefined,
            created: new Date("2000-01-01"),
          });

          assert.equal(replaced.label, "$label");
          assert.deepEqual(replaced.created, inserted.created);
          assert.deepEqual(await store.findByKey("1"), replaced);
          assert.equal(replaced.note, null);
        });

        it("upserts with $setOnInsert only on insert", async () => {
          const inserted = await store.upsertOneWithInfo(
            { _id: "1", label: "a", done: false },
            { count: 1 },
          );
          assert.equal(inserted.resolvedAs, "inserted");

          const updated = await store.upsertOneWithInfo(
            { _id: "1", label: "b", done: true },
            { count: 2 },
          );
          assert.equal(updated.resolvedAs, "updated");
          assert.deepEqual(await store.findByKey("1"), {
            ...updated.object,
            count: 1,
          });
          assert.equal(updated.object.label, "b");
        });

        it("upserts from the equality fields of the filter", async () => {
          const collection = await getCollection(store);

          const result = await collection.updateOne(
            { tenant: "t", "nested.key": "k", count: { $gt: 1 } },
            { $set: { label: "a" }, $setOnInsert: { done: false } },
            { upsert: true },
          );

          assert.equal(result.upsertedCount, 1);
          assert.ok(result.upsertedId instanceof mongodb.ObjectId);
          const { _id, ...stored } = (await collection.findOne({
            _id: result.upsertedId,
          }))!;
          assert.deepEqual(stored, {
            tenant: "t",
            nested: { key: "k" },
            label: "a",
            done: false,
          });
        });

        it("deletes by key, by criteria and many", async () => {
          await store.insertOne({ _id: "1", label: "a", done: false });
          await store.insertOne({ _id: "2", label: "b", done: true });
          await store.insertOne({ _id: "3", label: "c", done: true });

          await store.deleteByKey("1", { done: true });
          assert.equal(await store.count(), 3);
          await store.deleteByKey("1");
          await store.deleteMany({ done: true });
          assert.equal(await store.count(), 0);
        });

        it("aggregates, with $lookup on another collection", async () => {
          const tenants = createStore();
          await tenants.insertOne({ _id: "t", label: "Tenant", done: false });
          await store.insertOne({
            _id: "1",
            label: "a",
            done: false,
            tenant: "t",
          });
          await store.insertOne({
            _id: "2",
            label: "b",
            done: true,
            tenant: "t",
          });

          const collection = await getCollection(store);
          const result = await collection
            .aggregate([
              { $group: { _id: "$tenant", count: { $sum: 1 } } },
              {
                $lookup: {
                  from: tenants.collectionName,
                  localField: "_id",
                  foreignField: "_id",
                  as: "tenant",
                },
              },
              { $project: { count: 1, label: { $first: "$tenant.label" } } },
            ])
            .toArray();

          assert.deepEqual(result, [{ _id: "t", count: 2, label: "Tenant" }]);
        });

        it("returns the document before or after, sorted and projected, from findOneAndUpdate and findOneAndDelete", async () => {
          const collection = await getCollection(store);
          const documents: Document[] = [
            { _id: "1", label: "a", count: 2 },
            { _id: "2", label: "b", count: 1 },
          ];
          await collection.insertMany(documents);

          const before = await collection.findOneAndUpdate(
            {},
            { $inc: { count: 10 } },
            { sort: { count: 1 }, projection: { count: 1 } },
          );
          const after = await collection.findOneAndUpdate(
            { _id: "1" } as Document,
            { $inc: { count: 1 } },
            { returnDocument: "after" },
          );
          const missing = await collection.findOneAndUpdate(
            { _id: "3" } as Document,
            { $set: { label: "c" } },
          );
          const upserted = await collection.findOneAndUpdate(
            { _id: "3" } as Document,
            { $set: { label: "c" } },
            { upsert: true, returnDocument: "after" },
          );
          const deleted = await collection.findOneAndDelete(
            {},
            { sort: { _id: -1 } },
          );

          assert.deepEqual(before, { _id: "2", count: 1 });
          assert.deepEqual(after, { _id: "1", label: "a", count: 3 });
          assert.equal(missing, null);
          assert.deepEqual(upserted, { _id: "3", label: "c" });
          assert.deepEqual(deleted, { _id: "3", label: "c" });
          const counts = await collection.find({}).sort({ _id: 1 }).toArray();
          assert.deepEqual(
            counts.map(({ count }) => count as unknown),
            [3, 11],
          );
        });

        it("applies array and number update operators", async () => {
          interface Scored {
            _id: string;
            tags: string[];
            scores: number[];
            factor: number;
            low: number;
            high: number;
            old?: string;
            renamed?: string;
          }
          const collection = (await getCollection(
            store,
          )) as unknown as Collection<Scored>;
          await collection.insertOne({
            _id: "1",
            tags: ["a", "b", "c"],
            scores: [1, 5, 9],
            factor: 4,
            low: 5,
            high: 5,
            old: "x",
          });

          await collection.updateOne(
            { _id: "1" },
            {
              $addToSet: { tags: { $each: ["a", "d"] } },
              $pull: { scores: { $gte: 5 } },
              $mul: { factor: 2 },
              $min: { low: 3 },
              $max: { high: 3 },
              $rename: { old: "renamed" },
            },
          );
          await collection.updateOne(
            { _id: "1" },
            {
              $pop: { tags: -1 },
              $push: { scores: { $each: [7, 0, 4], $sort: 1, $slice: 3 } },
            },
          );

          assert.deepEqual(await collection.findOne({ _id: "1" }), {
            _id: "1",
            tags: ["b", "c", "d"],
            scores: [0, 1, 4],
            factor: 8,
            low: 3,
            high: 5,
            renamed: "x",
          });
        });

        it("updates every matching document with partialUpdateMany", async () => {
          const old = new Date("2020-01-01");
          await store.insertOne({
            _id: "1",
            label: "a",
            done: true,
            updated: old,
          });
          await store.insertOne({
            _id: "2",
            label: "b",
            done: true,
            updated: old,
          });
          await store.insertOne({
            _id: "3",
            label: "c",
            done: false,
            updated: old,
          });

          await store.partialUpdateMany({ done: true }, { $inc: { count: 1 } });

          const documents = await store.findAll({}, { _id: 1 });
          assert.deepEqual(
            documents.map(({ count }) => count),
            [1, 1, undefined],
          );
          assert.deepEqual(
            documents.map(({ updated }) => updated.getTime() > old.getTime()),
            [true, true, false],
          );
        });

        it("matches and stores ObjectId and Date values", async () => {
          const collection = await getCollection(store);
          const owner = new mongodb.ObjectId();
          const other = new mongodb.ObjectId();
          const at = new Date("2026-01-01");
          const documents: Document[] = [
            { _id: "1", ownerId: owner, at },
            { _id: "2", ownerId: other, at: new Date("2026-02-01") },
          ];
          await collection.insertMany(documents);

          const findIds = async (filter: Document): Promise<unknown[]> => {
            const found = await collection
              .find(filter)
              .sort({ _id: 1 })
              .toArray();
            return found.map(({ _id }) => _id as unknown);
          };

          assert.deepEqual(
            await findIds({
              ownerId: new mongodb.ObjectId(owner.toHexString()),
            }),
            ["1"],
          );
          assert.deepEqual(await findIds({ ownerId: { $in: [other] } }), ["2"]);
          assert.deepEqual(await findIds({ at: new Date(at) }), ["1"]);
          assert.deepEqual(await findIds({ at: { $gt: at } }), ["2"]);
          const stored = await collection.findOne({ _id: "1" } as Document);
          assert.ok(stored?.ownerId instanceof mongodb.ObjectId);
          assert.ok(stored.at instanceof Date);
        });

        it("reads cursors one by one, with skip and limit counts", async () => {
          const collection = await getCollection(store);
          const documents: Document[] = [
            { _id: "1" },
            { _id: "2" },
            { _id: "3" },
          ];
          await collection.insertMany(documents);

          const cursor = collection.find({}).sort({ _id: -1 });
          const first = await cursor.next();
          const rest: unknown[] = [];
          for await (const document of cursor) rest.push(document._id);

          assert.equal(first?._id, "3");
          assert.deepEqual(rest, ["2", "1"]);
          assert.equal(await collection.countDocuments({}, { skip: 1 }), 2);
          assert.equal(await collection.countDocuments({}, { limit: 1 }), 1);
        });
      });

      describe("indexes", () => {
        it("syncs every declared index once: a second plan is empty", async () => {
          const store = createStore([
            { key: { done: 1, created: 1 } },
            { key: { label: "text" } },
            { key: { tenant: 1 }, collation: { locale: "en" } },
            { key: { dueAt: 1 }, expireAfterSeconds: 3600 },
            { key: { email: 1 }, partialFilterExpression: { done: true } },
            { key: { "items.$**": 1 } },
            { key: { created: -1 }, name: "created_desc", sparse: true },
            { key: { count: 1 }, unique: true, sparse: true },
          ]);

          await syncIndexes(store);

          assert.ok(isMongoIndexPlanEmpty(await store.planIndexes()));
        });

        it("plans every index for a collection that does not exist yet", async () => {
          const store = createStore([{ key: { label: 1 } }]);

          const plan = await store.planIndexes();

          assert.deepEqual(
            plan.toCreate.map(({ name }) => name),
            ["label_1"],
          );
        });

        it("modifies hidden and drops undeclared indexes", async () => {
          const store = createStore([
            { key: { label: 1 } },
            { key: { done: 1 } },
          ]);
          await syncIndexes(store);

          const changed = new MongoStore<Task>(
            connection,
            store.collectionName,
            {
              indexes: [{ key: { label: 1 }, hidden: true }],
            },
          );
          const [result] = await new MongoRegistry([changed]).syncIndexes();

          assert.deepEqual(result!.modified, ["label_1"]);
          assert.deepEqual(result!.dropped, ["done_1"]);
          assert.ok(isMongoIndexPlanEmpty(await changed.planIndexes()));
        });

        it("answers mongod's error codes for a missing index or collection", async () => {
          const store = createStore();
          const collection = await getCollection(store);

          assert.equal(
            await getServerErrorCode(collection.listIndexes().toArray()),
            26,
          );
          await store.insertOne({ _id: "1", label: "a", done: false });
          assert.equal(
            await getServerErrorCode(collection.dropIndex("missing_1")),
            27,
          );
          await collection.createIndex({ label: 1 });
          assert.equal(
            await getServerErrorCode(
              collection.createIndex({ label: 1 }, { name: "other" }),
            ),
            85,
          );
          assert.equal(
            await getServerErrorCode(
              collection.createIndex(
                { label: 1 },
                { name: "label_1", unique: true },
              ),
            ),
            86,
          );
        });

        describe("unique", () => {
          it("rejects a duplicate of a single and a compound key", async () => {
            const store = createStore([
              { key: { email: 1 }, unique: true },
              { key: { tenant: 1, label: 1 }, unique: true },
            ]);
            await syncIndexes(store);
            await store.insertOne({
              label: "a",
              done: false,
              email: "a@x",
              tenant: "t",
            });

            const error = await getDuplicateKeyError(
              store.insertOne({ label: "b", done: false, email: "a@x" }),
            );
            assert.deepEqual(error.keyPattern, { email: 1 });
            assert.deepEqual(error.keyValue, { email: "a@x" });

            await store.insertOne({
              label: "a",
              done: false,
              email: "b@x",
              tenant: "u",
            });
            const compoundError = await getDuplicateKeyError(
              store.insertOne({
                label: "a",
                done: false,
                email: "c@x",
                tenant: "t",
              }),
            );
            assert.deepEqual(compoundError.keyValue, {
              tenant: "t",
              label: "a",
            });
          });

          it("treats missing as null unless sparse", async () => {
            const store = createStore([
              { key: { email: 1 }, unique: true },
              { key: { tenant: 1 }, unique: true, sparse: true },
            ]);
            await syncIndexes(store);
            await store.insertOne({ label: "a", done: false });
            await store.insertOne({ label: "b", done: false, email: "b@x" });

            await getDuplicateKeyError(
              store.insertOne({ label: "c", done: false, email: null }),
            );
          });

          it("only constrains documents matching partialFilterExpression", async () => {
            const store = createStore([
              {
                key: { email: 1 },
                unique: true,
                partialFilterExpression: { done: true },
              },
            ]);
            await syncIndexes(store);
            await store.insertOne({ label: "a", done: false, email: "a@x" });
            await store.insertOne({ label: "b", done: false, email: "a@x" });
            await store.insertOne({ label: "c", done: true, email: "a@x" });

            await getDuplicateKeyError(
              store.insertOne({ label: "d", done: true, email: "a@x" }),
            );
          });

          it("indexes each item of an array", async () => {
            const store = createStore([{ key: { tags: 1 }, unique: true }]);
            await syncIndexes(store);
            await store.insertOne({
              label: "a",
              done: false,
              tags: ["x", "x", "y"],
            });

            await getDuplicateKeyError(
              store.insertOne({ label: "b", done: false, tags: ["z", "y"] }),
            );
          });

          it("compares with the index collation", async () => {
            const store = createStore([
              {
                key: { email: 1 },
                unique: true,
                collation: { locale: "en", strength: 2 },
              },
            ]);
            await syncIndexes(store);
            await store.insertOne({ label: "a", done: false, email: "A@x" });

            await getDuplicateKeyError(
              store.insertOne({ label: "b", done: false, email: "a@X" }),
            );
          });

          it("checks updates, upserts and replaces, and frees the key of a deleted document", async () => {
            const store = createStore([{ key: { email: 1 }, unique: true }]);
            await syncIndexes(store);
            const first = await store.insertOne({
              _id: "1",
              label: "a",
              done: false,
              email: "a@x",
            });
            await store.insertOne({
              _id: "2",
              label: "b",
              done: false,
              email: "b@x",
            });

            await getDuplicateKeyError(
              store.partialUpdateByKey("2", { $set: { email: "a@x" } }),
            );
            await getDuplicateKeyError(
              store.upsertOne({
                _id: "3",
                label: "c",
                done: false,
                email: "a@x",
              }),
            );
            await getDuplicateKeyError(
              store.replaceOne({ ...first, _id: "2" }),
            );
            assert.equal((await store.findByKey("2"))!.email, "b@x");

            await store.partialUpdateByKey("1", { $set: { email: "c@x" } });
            await store.partialUpdateByKey("2", { $set: { email: "a@x" } });
            await store.deleteByKey("2");
            await store.insertOne({
              _id: "4",
              label: "d",
              done: false,
              email: "a@x",
            });
          });

          it("constrains dotted paths and ObjectId / Date values", async () => {
            const collection = await getCollection(createStore());
            await collection.createIndex(
              { "profile.email": 1 },
              { unique: true },
            );
            await collection.createIndex(
              { ownerId: 1, at: 1 },
              { unique: true },
            );
            const owner = new mongodb.ObjectId();
            const at = new Date("2026-01-01");
            await collection.insertOne({
              _id: "1",
              profile: { email: "a@x" },
              ownerId: owner,
              at,
            } as Document);
            await collection.insertOne({
              _id: "2",
              profile: { email: "b@x" },
              ownerId: owner,
              at: new Date("2026-01-02"),
            } as Document);

            await getDuplicateKeyError(
              collection.insertOne({
                _id: "3",
                profile: { email: "a@x" },
              } as Document),
            );
            await getDuplicateKeyError(
              collection.insertOne({
                _id: "4",
                profile: { email: "d@x" },
                ownerId: new mongodb.ObjectId(owner.toHexString()),
                at: new Date(at),
              } as Document),
            );
          });

          it("refuses to create a unique index over duplicates", async () => {
            const store = createStore();
            await store.insertOne({ label: "a", done: false, email: "a@x" });
            await store.insertOne({ label: "b", done: false, email: "a@x" });

            const unique = new MongoStore<Task>(
              connection,
              store.collectionName,
              {
                indexes: [{ key: { email: 1 }, unique: true }],
              },
            );
            await assert.rejects(unique.syncIndexes());
            const uniqueCollection = await getCollection(unique);
            const indexes = await uniqueCollection.listIndexes().toArray();
            assert.deepEqual(
              indexes.map(({ name }) => name),
              ["_id_"],
            );
          });
        });
      });

      describe("subscriptions", () => {
        it("emits the changes of a single item query", async () => {
          const store = createStore();
          const subscribeStore = createMongoSubscribeStore(store);
          await subscribeStore.insertOne({ _id: "1", label: "a", done: false });
          const query = subscribeStore.createQuerySingleItem<Task, never>({
            criteria: { _id: "1" },
          });
          const labels: (string | null | undefined)[] = [];
          const subscription = query.fetchAndSubscribe((error, changes) => {
            if (error) throw error;
            changes.forEach((change) => {
              if (change.type === "initial") labels.push(change.initial?.label);
              if (change.type === "updated") labels.push(change.result?.label);
            });
          });
          await subscription;

          await subscribeStore.partialUpdateByKey("1", {
            $set: { label: "b" },
          });
          subscription.stop();

          assert.deepEqual(labels, ["a", "b"]);
        });

        it("emits the changes of a query collection", async () => {
          const store = createStore();
          const subscribeStore = createMongoSubscribeStore(store);
          await subscribeStore.insertOne({ _id: "1", label: "a", done: true });
          const query = subscribeStore.createQueryCollection<Task, never>({
            criteria: { done: true },
            sort: { _id: 1 },
          });
          const received: Changes<string, Task[]>[] = [];
          const subscription = query.fetchAndSubscribe((error, changes) => {
            if (error) throw error;
            received.push(changes);
          });
          await subscription;

          await subscribeStore.insertOne({ _id: "2", label: "b", done: true });
          await subscribeStore.partialUpdateByKey("1", {
            $set: { done: false },
          });
          await subscribeStore.deleteByKey("2");
          subscription.stop();

          assert.deepEqual(
            received.map((changes) => changes.map(({ type }) => type)),
            [["initial"], ["inserted"], ["deleted"], ["deleted"]],
          );
        });
      });
    },
  );
}
