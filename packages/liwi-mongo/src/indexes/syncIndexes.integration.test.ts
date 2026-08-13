import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { IndexDescriptionInfo } from "mongodb";
import type { MongoMemoryServer } from "mongodb-memory-server-core";
import type { MongoBaseModel } from "../MongoBaseModel.ts";
import MongoConnection from "../MongoConnection.ts";
import MongoStore from "../MongoStore.ts";
import { isMongoIndexPlanEmpty } from "./diffIndexes.ts";
import { formatIndexPlan } from "./formatIndexPlan.ts";
import type { MongoIndex } from "./types.ts";

interface Task extends MongoBaseModel {
  completed: boolean;
  label: string;
  status: string;
  tenant: string;
  sessionEnd: Date;
  metadata: Record<string, unknown>;
}

const declaredIndexes: MongoIndex<Task>[] = [
  { key: { completed: 1, created: 1 } },
  { key: { label: "text" } },
  { key: { status: 1 }, collation: { locale: "en" } },
  { key: { sessionEnd: 1 }, expireAfterSeconds: 3600 },
  { key: { tenant: 1 }, partialFilterExpression: { completed: true } },
  { key: { "metadata.$**": 1 } },
  { key: { created: -1 }, name: "created_desc", sparse: true },
];

const declaredIndexNames = [
  "completed_1_created_1",
  "created_desc",
  "label_text",
  "metadata.$**_1",
  "sessionEnd_1",
  "status_1",
  "tenant_1",
];

describe(
  "syncIndexes (integration)",
  {
    skip: !process.env.LIWI_MONGO_INTEGRATION && "set LIWI_MONGO_INTEGRATION=1",
    timeout: 120_000,
  },
  () => {
    let mongod: MongoMemoryServer;
    let connection: MongoConnection;

    before(async () => {
      const { MongoMemoryServer: MemoryServer } =
        await import("mongodb-memory-server-core");
      mongod = await MemoryServer.create();
      connection = new MongoConnection({
        host: "127.0.0.1",
        port: mongod.instanceInfo!.port,
        database: "liwi-mongo-indexes-test",
      });
      await connection.getConnection();
    });

    after(async () => {
      await connection.close();
      await mongod.stop();
    });

    const createStore = (indexes: MongoIndex<Task>[]): MongoStore<Task> =>
      new MongoStore<Task>(connection, "tasks", { indexes });

    const listIndexes = async (
      store: MongoStore<Task>,
    ): Promise<IndexDescriptionInfo[]> => {
      const collection = await store.collection;
      return collection.listIndexes().toArray();
    };

    const listIndexNames = async (
      store: MongoStore<Task>,
    ): Promise<string[]> => {
      const indexes = await listIndexes(store);
      return indexes
        .map(({ name }) => name)
        .filter((name) => name !== undefined)
        .toSorted();
    };

    it("creates every declared index with the name mongo derives", async () => {
      const store = createStore(declaredIndexes);

      const result = await store.syncIndexes();

      assert.deepEqual(result.created.toSorted(), declaredIndexNames);
      assert.deepEqual(await listIndexNames(store), [
        "_id_",
        ...declaredIndexNames,
      ]);
    });

    it("plans nothing on a second run, for every index type", async () => {
      const store = createStore(declaredIndexes);

      const plan = await store.planIndexes();

      assert.equal(
        isMongoIndexPlanEmpty(plan),
        true,
        `expected an empty plan, got:\n${formatIndexPlan(plan)}`,
      );
      assert.deepEqual(plan.unchanged.toSorted(), declaredIndexNames);
    });

    it("applies a ttl change in place with collMod", async () => {
      const store = createStore(
        declaredIndexes.map((index) =>
          index.expireAfterSeconds
            ? { ...index, expireAfterSeconds: 60 }
            : index,
        ),
      );

      const result = await store.syncIndexes();

      assert.deepEqual(result.modified, ["sessionEnd_1"]);
      assert.deepEqual(result.created, []);
      assert.deepEqual(result.dropped, []);

      const indexes = await listIndexes(store);
      assert.equal(
        indexes.find(({ name }) => name === "sessionEnd_1")?.expireAfterSeconds,
        60,
      );
    });

    it("recreates an index whose key changed", async () => {
      const store = createStore([
        ...declaredIndexes.filter(({ name }) => name !== "created_desc"),
        { key: { created: 1 }, name: "created_desc", sparse: true },
      ]);

      const result = await store.syncIndexes();

      assert.deepEqual(result.created, ["created_desc"]);
      assert.deepEqual(result.dropped, ["created_desc"]);

      const indexes = await listIndexes(store);
      assert.deepEqual(
        indexes.find(({ name }) => name === "created_desc")?.key,
        { created: 1 },
      );
    });

    it("drops undeclared indexes and keeps _id_", async () => {
      const store = createStore([{ key: { completed: 1, created: 1 } }]);

      const result = await store.syncIndexes();

      assert.equal(result.dropped.includes("_id_"), false);
      assert.deepEqual(
        result.dropped.toSorted(),
        declaredIndexNames.filter((name) => name !== "completed_1_created_1"),
      );
      assert.deepEqual(await listIndexNames(store), [
        "_id_",
        "completed_1_created_1",
      ]);
    });

    it("keeps undeclared indexes when dropping is off", async () => {
      const store = createStore([]);

      const plan = await store.planIndexes({ dropUndeclaredIndexes: false });
      await store.syncIndexes({ dropUndeclaredIndexes: false });

      assert.deepEqual(plan.undeclaredKept, ["completed_1_created_1"]);
      assert.deepEqual(await listIndexNames(store), [
        "_id_",
        "completed_1_created_1",
      ]);
    });
  },
);
