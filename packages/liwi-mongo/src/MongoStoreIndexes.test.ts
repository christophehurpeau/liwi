import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import type { IndexDescription, IndexDescriptionInfo } from "mongodb";
import type { MongoBaseModel } from "./MongoBaseModel.ts";
import type { MongoStoreOptions } from "./MongoStore.ts";

interface TestModel extends MongoBaseModel {
  completed: boolean;
  label: string;
  status: string;
}

const idIndex: IndexDescriptionInfo = { v: 2, key: { _id: 1 }, name: "_id_" };

let calls: string[];
let existingIndexes: IndexDescriptionInfo[];
let createIndexesImplementation: (
  descriptions: IndexDescription[],
) => Promise<unknown>;

const collection = {
  find: () => ({ toArray: () => Promise.resolve([]) }),
  countDocuments: () => Promise.resolve(0),
  listIndexes: () => ({
    toArray: () => {
      calls.push("listIndexes");
      return Promise.resolve(existingIndexes);
    },
  }),
  createIndexes: (descriptions: IndexDescription[]) => {
    calls.push(
      `createIndexes:${descriptions.map(({ name }) => name).join(",")}`,
    );
    return createIndexesImplementation(descriptions);
  },
  dropIndex: (name: string) => {
    calls.push(`dropIndex:${name}`);
    return Promise.resolve({});
  },
};

const db = {
  collection: () => collection,
  command: (command: Record<string, unknown>) => {
    calls.push(`command:${JSON.stringify(command)}`);
    return Promise.resolve({});
  },
};

// eslint-disable-next-line n/no-unsupported-features/node-builtins
mock.module("mongodb", {
  // @ts-expect-error: not yet typed
  exports: {
    default: {
      MongoClient: {
        connect: () =>
          Promise.resolve({
            on: () => undefined,
            db: () => db,
          }),
      },
      ObjectId: class {
        toString(): string {
          return "generated-id";
        }
      },
    },
  },
});

const { default: MongoConnection } = await import("./MongoConnection.ts");
const { default: MongoStore } = await import("./MongoStore.ts");
const { default: MongoRegistry } = await import("./MongoRegistry.ts");

const createStore = (
  options?: MongoStoreOptions<TestModel>,
): InstanceType<typeof MongoStore<TestModel>> =>
  new MongoStore<TestModel>(
    new MongoConnection({ database: "test" }),
    "tasks",
    options,
  );

describe("MongoStore indexes", () => {
  beforeEach(() => {
    calls = [];
    existingIndexes = [idIndex];
    createIndexesImplementation = () => Promise.resolve(["ok"]);
  });

  it("validates declared indexes in the constructor", () => {
    assert.throws(
      () =>
        createStore({
          indexes: [{ key: { label: 1 } }, { key: { label: 1 } }],
        }),
      /Duplicate index name/,
    );
  });

  it("plans without mutating anything", async () => {
    const store = createStore({ indexes: [{ key: { completed: 1 } }] });

    const plan = await store.planIndexes();

    assert.deepEqual(calls, ["listIndexes"]);
    assert.deepEqual(
      plan.toCreate.map(({ name }) => name),
      ["completed_1"],
    );
  });

  it("drops, then collMods, then creates", async () => {
    existingIndexes = [
      idIndex,
      { v: 2, key: { status: 1 }, name: "legacy_status_1" },
      { v: 2, key: { label: 1 }, name: "label_1", expireAfterSeconds: 3600 },
    ];

    const store = createStore({
      indexes: [
        { key: { completed: 1 } },
        { key: { label: 1 }, expireAfterSeconds: 60 },
      ],
    });

    await store.syncIndexes();

    assert.deepEqual(calls, [
      "listIndexes",
      "dropIndex:legacy_status_1",
      'command:{"collMod":"tasks","index":{"name":"label_1","expireAfterSeconds":60}}',
      "createIndexes:completed_1",
    ]);
  });

  it("never drops the _id index", async () => {
    existingIndexes = [idIndex];
    await createStore({ indexes: [] }).syncIndexes();

    assert.equal(
      calls.some((call) => call.startsWith("dropIndex")),
      false,
    );
  });

  it("mutates nothing on a dry run but still returns the plan", async () => {
    existingIndexes = [
      idIndex,
      { v: 2, key: { status: 1 }, name: "legacy_status_1" },
    ];

    const result = await createStore({
      indexes: [{ key: { completed: 1 } }],
    }).syncIndexes({ dryRun: true });

    assert.deepEqual(calls, ["listIndexes"]);
    assert.equal(result.dryRun, true);
    assert.deepEqual(
      result.plan.toDrop.map(({ name }) => name),
      ["legacy_status_1"],
    );
    assert.deepEqual(result.created, []);
  });

  it("keeps undeclared indexes when dropUndeclaredIndexes is false", async () => {
    existingIndexes = [
      idIndex,
      { v: 2, key: { status: 1 }, name: "legacy_status_1" },
    ];

    await createStore({ indexes: [] }).syncIndexes({
      dropUndeclaredIndexes: false,
    });

    assert.deepEqual(calls, ["listIndexes"]);
  });

  it("ignores an index already dropped by another process", async () => {
    existingIndexes = [
      idIndex,
      { v: 2, key: { status: 1 }, name: "legacy_status_1" },
    ];
    const dropIndex = mock.method(collection, "dropIndex", () =>
      Promise.reject(Object.assign(new Error("not found"), { code: 27 })),
    );

    const result = await createStore({ indexes: [] }).syncIndexes();

    assert.equal(dropIndex.mock.callCount(), 1);
    assert.deepEqual(result.dropped, []);
    dropIndex.mock.restore();
  });

  it("recovers once from a conflicting index spec", async () => {
    existingIndexes = [idIndex];
    let createAttempts = 0;
    createIndexesImplementation = () => {
      createAttempts += 1;
      if (createAttempts <= 2) {
        existingIndexes = [
          idIndex,
          { v: 2, key: { completed: -1 }, name: "completed_1" },
        ];
        return Promise.reject(
          Object.assign(new Error("conflict"), { code: 85 }),
        );
      }
      return Promise.resolve(["ok"]);
    };

    const result = await createStore({
      indexes: [{ key: { completed: 1 } }],
    }).syncIndexes();

    assert.equal(createAttempts, 3);
    assert.deepEqual(calls.slice(1), [
      "createIndexes:completed_1",
      "createIndexes:completed_1",
      "listIndexes",
      "dropIndex:completed_1",
      "createIndexes:completed_1",
    ]);
    assert.deepEqual(result.created, ["completed_1"]);
  });
});

describe("MongoRegistry with mongo stores", () => {
  beforeEach(() => {
    calls = [];
    existingIndexes = [idIndex];
    createIndexesImplementation = () => Promise.resolve(["ok"]);
  });

  it("syncs every registered store", async () => {
    const connection = new MongoConnection({ database: "test" });
    const registry = new MongoRegistry([
      new MongoStore<TestModel>(connection, "users", {
        indexes: [{ key: { label: 1 } }],
      }),
      new MongoStore<TestModel>(connection, "tasks", {
        indexes: [{ key: { completed: 1 } }],
      }),
    ]);

    const results = await registry.syncIndexes();

    assert.deepEqual(
      results.map(({ collectionName }) => collectionName),
      ["tasks", "users"],
    );
    assert.deepEqual(calls, [
      "listIndexes",
      "createIndexes:completed_1",
      "listIndexes",
      "createIndexes:label_1",
    ]);
  });
});
