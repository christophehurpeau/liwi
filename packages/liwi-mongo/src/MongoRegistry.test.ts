import assert from "node:assert/strict";
import { describe, it } from "node:test";
import MongoRegistry from "./MongoRegistry.ts";
import type { MongoRegistryStore } from "./MongoRegistryStore.ts";
import type {
  MongoIndexPlan,
  MongoIndexSyncResult,
  SyncIndexesOptions,
} from "./indexes/types.ts";

const createPlan = (collectionName: string): MongoIndexPlan => ({
  collectionName,
  toCreate: [],
  toRecreate: [],
  toCollMod: [],
  toDrop: [],
  unchanged: [],
  undeclaredKept: [],
});

interface FakeStore extends MongoRegistryStore {
  receivedOptions: SyncIndexesOptions[];
}

interface CreateFakeStoreParams {
  collectionName: string;
  calls: string[];
  failWith?: Error;
}

const createFakeStore = ({
  collectionName,
  calls,
  failWith,
}: CreateFakeStoreParams): FakeStore => {
  const receivedOptions: SyncIndexesOptions[] = [];

  return {
    collectionName,
    receivedOptions,
    planIndexes: (options = {}) => {
      receivedOptions.push(options);
      calls.push(`plan:${collectionName}`);
      return Promise.resolve(createPlan(collectionName));
    },
    syncIndexes: (options = {}) => {
      receivedOptions.push(options);
      calls.push(`sync:${collectionName}`);
      if (failWith) return Promise.reject(failWith);
      return Promise.resolve<MongoIndexSyncResult>({
        collectionName,
        plan: createPlan(collectionName),
        dryRun: false,
        created: [],
        dropped: [],
        modified: [],
      });
    },
  };
};

describe("MongoRegistry", () => {
  it("visits stores sequentially, sorted by collection name", async () => {
    const calls: string[] = [];
    const registry = new MongoRegistry([
      createFakeStore({ collectionName: "users", calls }),
      createFakeStore({ collectionName: "tasks", calls }),
    ]);

    await registry.syncIndexes();

    assert.deepEqual(calls, ["sync:tasks", "sync:users"]);
  });

  it("defaults dropUndeclaredIndexes to true", async () => {
    const store = createFakeStore({ collectionName: "tasks", calls: [] });
    await new MongoRegistry([store]).syncIndexes();

    assert.deepEqual(store.receivedOptions, [{ dropUndeclaredIndexes: true }]);
  });

  it("lets the registry option turn dropping off", async () => {
    const store = createFakeStore({ collectionName: "tasks", calls: [] });
    await new MongoRegistry([store], {
      dropUndeclaredIndexes: false,
    }).syncIndexes();

    assert.deepEqual(store.receivedOptions, [{ dropUndeclaredIndexes: false }]);
  });

  it("lets a per call option win over the registry option", async () => {
    const store = createFakeStore({ collectionName: "tasks", calls: [] });
    await new MongoRegistry([store], {
      dropUndeclaredIndexes: false,
    }).planIndexes({
      dropUndeclaredIndexes: true,
      dryRun: true,
    });

    assert.deepEqual(store.receivedOptions, [
      { dropUndeclaredIndexes: true, dryRun: true },
    ]);
  });

  it("runs every store even when one fails, then throws an AggregateError", async () => {
    const calls: string[] = [];
    const registry = new MongoRegistry([
      createFakeStore({
        collectionName: "tasks",
        calls,
        failWith: new Error("boom"),
      }),
      createFakeStore({ collectionName: "users", calls }),
    ]);

    await assert.rejects(
      () => registry.syncIndexes(),
      (error: unknown) =>
        error instanceof AggregateError && error.errors.length === 1,
    );
    assert.deepEqual(calls, ["sync:tasks", "sync:users"]);
  });

  it("adds, finds and removes stores", () => {
    const tasks = createFakeStore({ collectionName: "tasks", calls: [] });
    const registry = new MongoRegistry();

    registry.add(tasks);
    assert.equal(registry.getStore("tasks"), tasks);
    assert.equal(registry.stores.length, 1);

    registry.remove(tasks);
    assert.equal(registry.getStore("tasks"), undefined);
    assert.equal(registry.stores.length, 0);
  });
});
