import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DeletedAfterUpdateError, NotFoundError } from "liwi-store";
import type {
  AbstractConnection,
  SubscribableStore,
  UpsertResult,
} from "liwi-store";
import type { Actions } from "./SubscribeStore.ts";
import SubscribeStore from "./SubscribeStore.ts";

interface TestModel {
  _id: string;
  created: Date;
  updated: Date;
  label: string;
}

type TestStore = SubscribableStore<
  "_id",
  string,
  TestModel,
  TestModel,
  AbstractConnection
>;

type TestSubscribeStore = SubscribeStore<
  "_id",
  string,
  TestModel,
  TestModel,
  AbstractConnection,
  TestStore
>;

const created = new Date("2020-01-01");
const updated = new Date("2021-01-01");

const createSubscribeStore = (
  store: Partial<TestStore>,
): {
  subscribeStore: TestSubscribeStore;
  actions: Actions<TestModel>[];
} => {
  const subscribeStore: TestSubscribeStore = new SubscribeStore({
    keyPath: "_id",
    ...store,
  } as TestStore);
  const actions: Actions<TestModel>[] = [];
  subscribeStore.subscribe((action) => actions.push(action));
  return { subscribeStore, actions };
};

describe("SubscribeStore upsertOneWithInfo", () => {
  it("emits inserted when the upsert resolved as inserted", async () => {
    const object: TestModel = { _id: "1", label: "a", created, updated };
    const upsertResult: UpsertResult<TestModel> = {
      resolvedAs: "inserted",
      inserted: true,
      object,
    };
    const { subscribeStore, actions } = createSubscribeStore({
      upsertOneWithInfo: () => Promise.resolve(upsertResult),
    });

    const result = await subscribeStore.upsertOneWithInfo(object);

    assert.equal(result, upsertResult);
    assert.deepEqual(actions, [{ type: "inserted", next: [object] }]);
  });

  it("emits updated with prev and next when the upsert resolved as updated", async () => {
    const prev: TestModel = {
      _id: "1",
      label: "old",
      created,
      updated: created,
    };
    const object: TestModel = { _id: "1", label: "a", created, updated };
    const upsertResult: UpsertResult<TestModel> = {
      resolvedAs: "updated",
      inserted: false,
      object,
      prev,
    };
    const { subscribeStore, actions } = createSubscribeStore({
      upsertOneWithInfo: () => Promise.resolve(upsertResult),
    });

    const result = await subscribeStore.upsertOneWithInfo({
      _id: "1",
      label: "a",
      updated,
    });

    assert.equal(result, upsertResult);
    assert.deepEqual(actions, [{ type: "updated", changes: [[prev, object]] }]);
  });
});

const stored: TestModel = { _id: "1", label: "stored", created, updated };
const staleCopy: TestModel = { _id: "1", label: "stale", created, updated };
const next: TestModel = { _id: "1", label: "next", created, updated };

const createCursorStore = (models: TestModel[]): Pick<TestStore, "cursor"> => ({
  cursor: (() =>
    Promise.resolve({
      forEach: async (callback: (model: TestModel) => Promise<void>) => {
        for (const model of models) await callback(model);
      },
    })) as unknown as TestStore["cursor"],
});

describe("SubscribeStore over a store with …WithInfo methods", () => {
  it("emits the stored prev, not the caller's copy, on partialUpdateOne", async () => {
    const calls: unknown[][] = [];
    const { subscribeStore, actions } = createSubscribeStore({
      partialUpdateByKeyWithInfo: (...args) => {
        calls.push(args);
        return Promise.resolve({ prev: stored, next });
      },
    });

    const result = await subscribeStore.partialUpdateOne(staleCopy, {
      $set: { label: "next" },
    });

    assert.equal(result, next);
    assert.deepEqual(calls, [["1", { $set: { label: "next" } }, undefined]]);
    assert.deepEqual(actions, [{ type: "updated", changes: [[stored, next]] }]);
  });

  it("throws NotFoundError and emits nothing on partialUpdateByKey of a missing key", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      partialUpdateByKeyWithInfo: () => Promise.resolve(undefined),
    });

    await assert.rejects(
      subscribeStore.partialUpdateByKey("1", { $set: { label: "next" } }),
      NotFoundError,
    );
    assert.deepEqual(actions, []);
  });

  it("throws DeletedAfterUpdateError and emits nothing when the document was deleted after the update", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      partialUpdateByKeyWithInfo: () =>
        Promise.resolve({ prev: stored, next: undefined }),
    });

    const error: unknown = await subscribeStore
      .partialUpdateByKey("1", { $set: { label: "next" } })
      .catch((error_: unknown) => error_);

    assert.ok(error instanceof DeletedAfterUpdateError);
    assert.ok(error instanceof NotFoundError);
    assert.deepEqual(actions, []);
  });

  it("skips in partialUpdateMany a document deleted after its update", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      ...createCursorStore([staleCopy, { ...staleCopy, _id: "2" }]),
      partialUpdateByKeyWithInfo: (key) =>
        Promise.resolve(
          key === "1"
            ? { prev: stored, next }
            : { prev: { ...stored, _id: "2" }, next: undefined },
        ),
    });

    await subscribeStore.partialUpdateMany(
      { label: "stale" },
      { $set: { label: "next" } },
    );

    assert.deepEqual(actions, [{ type: "updated", changes: [[stored, next]] }]);
  });

  it("emits the stored prev on replaceOne", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      replaceOneWithInfo: () => Promise.resolve({ prev: stored, next }),
    });

    const result = await subscribeStore.replaceOne(staleCopy);

    assert.equal(result, next);
    assert.deepEqual(actions, [{ type: "updated", changes: [[stored, next]] }]);
  });

  it("throws NotFoundError and emits nothing on replaceOne of a missing key", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      replaceOneWithInfo: () => Promise.resolve(undefined),
    });

    await assert.rejects(subscribeStore.replaceOne(staleCopy), NotFoundError);
    assert.deepEqual(actions, []);
  });

  it("emits one change per object on replaceSeveral", async () => {
    const stored2: TestModel = { ...stored, _id: "2" };
    const next2: TestModel = { ...next, _id: "2" };
    const { subscribeStore, actions } = createSubscribeStore({
      replaceOneWithInfo: (object) =>
        Promise.resolve(
          object._id === "1"
            ? { prev: stored, next }
            : { prev: stored2, next: next2 },
        ),
    });

    const result = await subscribeStore.replaceSeveral([
      staleCopy,
      { ...staleCopy, _id: "2" },
    ]);

    assert.deepEqual(result, [next, next2]);
    assert.deepEqual(actions, [
      {
        type: "updated",
        changes: [
          [stored, next],
          [stored2, next2],
        ],
      },
    ]);
  });

  it("emits the replaces that succeeded before rethrowing on replaceSeveral", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      replaceOneWithInfo: (object) =>
        Promise.resolve(
          object._id === "1" ? { prev: stored, next } : undefined,
        ),
    });

    await assert.rejects(
      subscribeStore.replaceSeveral([staleCopy, { ...staleCopy, _id: "2" }]),
      NotFoundError,
    );
    assert.deepEqual(actions, [{ type: "updated", changes: [[stored, next]] }]);
  });

  it("emits the updates done before a failure on partialUpdateMany", async () => {
    const failure = new Error("write failed");
    const { subscribeStore, actions } = createSubscribeStore({
      ...createCursorStore([staleCopy, { ...staleCopy, _id: "2" }]),
      partialUpdateByKeyWithInfo: (key) =>
        key === "1"
          ? Promise.resolve({ prev: stored, next })
          : Promise.reject(failure),
    });

    await assert.rejects(
      subscribeStore.partialUpdateMany(
        { label: "stale" },
        { $set: { label: "next" } },
      ),
      failure,
    );
    assert.deepEqual(actions, [{ type: "updated", changes: [[stored, next]] }]);
  });

  it("emits the stored prev on deleteOne", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      deleteByKeyWithInfo: () => Promise.resolve({ prev: stored }),
    });

    await subscribeStore.deleteOne(staleCopy);

    assert.deepEqual(actions, [{ type: "deleted", prev: [stored] }]);
  });

  it("resolves and emits nothing on deleteByKey of a missing key", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      deleteByKeyWithInfo: () => Promise.resolve(undefined),
    });

    await subscribeStore.deleteByKey("1");

    assert.deepEqual(actions, []);
  });

  it("emits only the documents partialUpdateMany actually modified", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      ...createCursorStore([staleCopy, { ...staleCopy, _id: "2" }]),
      partialUpdateByKeyWithInfo: (key) =>
        Promise.resolve(key === "1" ? { prev: stored, next } : undefined),
    });

    await subscribeStore.partialUpdateMany(
      { label: "stale" },
      { $set: { label: "next" } },
    );

    assert.deepEqual(actions, [{ type: "updated", changes: [[stored, next]] }]);
  });

  it("emits nothing when partialUpdateMany modifies no document", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      ...createCursorStore([staleCopy]),
      partialUpdateByKeyWithInfo: () => Promise.resolve(undefined),
    });

    await subscribeStore.partialUpdateMany(
      { label: "stale" },
      { $set: { label: "next" } },
    );

    assert.deepEqual(actions, []);
  });

  it("emits nothing when every replace of replaceSeveral fails", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      replaceOneWithInfo: () => Promise.resolve(undefined),
    });

    await assert.rejects(
      subscribeStore.replaceSeveral([staleCopy]),
      NotFoundError,
    );
    assert.deepEqual(actions, []);
  });
});

describe("SubscribeStore over a store without …WithInfo methods", () => {
  it("reads prev before a partial update", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      findOne: () => Promise.resolve(stored),
      partialUpdateByKey: () => Promise.resolve(next),
    });

    const result = await subscribeStore.partialUpdateOne(staleCopy, {
      $set: { label: "next" },
    });

    assert.equal(result, next);
    assert.deepEqual(actions, [{ type: "updated", changes: [[stored, next]] }]);
  });

  it("reads prev before a replace, and throws NotFoundError on a missing key", async () => {
    const replaced: TestModel[] = [];
    const { subscribeStore, actions } = createSubscribeStore({
      findByKey: (key) => Promise.resolve(key === "1" ? stored : undefined),
      replaceOne: (object) => {
        replaced.push(object);
        return Promise.resolve(object);
      },
    });

    const result = await subscribeStore.replaceOne(staleCopy);
    await assert.rejects(
      subscribeStore.replaceOne({ ...staleCopy, _id: "2" }),
      NotFoundError,
    );

    assert.equal(result, staleCopy);
    assert.deepEqual(replaced, [staleCopy]);
    assert.deepEqual(actions, [
      { type: "updated", changes: [[stored, staleCopy]] },
    ]);
  });

  it("throws NotFoundError on a partial update of a missing key", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      findOne: () => Promise.resolve(undefined),
    });

    await assert.rejects(
      subscribeStore.partialUpdateByKey("1", { $set: { label: "next" } }),
      NotFoundError,
    );
    assert.deepEqual(actions, []);
  });

  it("reads prev before a delete, and skips a missing key", async () => {
    const deletedKeys: string[] = [];
    const { subscribeStore, actions } = createSubscribeStore({
      findByKey: (key) => Promise.resolve(key === "1" ? stored : undefined),
      deleteByKey: (key) => {
        deletedKeys.push(key);
        return Promise.resolve();
      },
    });

    await subscribeStore.deleteOne(staleCopy);
    await subscribeStore.deleteByKey("2");

    assert.deepEqual(deletedKeys, ["1"]);
    assert.deepEqual(actions, [{ type: "deleted", prev: [stored] }]);
  });
});
