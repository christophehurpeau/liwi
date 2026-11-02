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
    assert.deepEqual(calls, [
      ["1", { $set: { label: "next" } }, undefined, undefined],
    ]);
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

  it("resolves undefined and emits nothing with allowNotFound, whether the key is missing or deleted after the update", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      partialUpdateByKeyWithInfo: (key) =>
        Promise.resolve(
          key === "1" ? undefined : { prev: stored, next: undefined },
        ),
    });

    const options = { allowNotFound: true };
    assert.equal(
      await subscribeStore.partialUpdateByKey(
        "1",
        { $set: { label: "next" } },
        undefined,
        options,
      ),
      undefined,
    );
    assert.equal(
      await subscribeStore.partialUpdateByKey(
        "2",
        { $set: { label: "next" } },
        undefined,
        options,
      ),
      undefined,
    );
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

  it("resolves undefined and emits nothing on replaceOne of a missing key with allowNotFound", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      replaceOneWithInfo: () => Promise.resolve(undefined),
    });

    assert.equal(
      await subscribeStore.replaceOne(staleCopy, { allowNotFound: true }),
      undefined,
    );
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

  it("passes the partial update options to every document of partialUpdateMany", async () => {
    const options: unknown[] = [];
    const { subscribeStore } = createSubscribeStore({
      ...createCursorStore([staleCopy, { ...staleCopy, _id: "2" }]),
      partialUpdateByKeyWithInfo: (key, update, criteria, option) => {
        options.push(option);
        return Promise.resolve({ prev: stored, next });
      },
    });

    await subscribeStore.partialUpdateMany(
      { label: "stale" },
      { $set: { label: "next" } },
      { touchUpdated: false },
    );

    assert.deepEqual(options, [
      { touchUpdated: false },
      { touchUpdated: false },
    ]);
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
      partialUpdateByKey: (() =>
        Promise.resolve(next)) as TestStore["partialUpdateByKey"],
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
      replaceOne: ((object: TestModel) => {
        replaced.push(object);
        return Promise.resolve(object);
      }) as TestStore["replaceOne"],
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
    assert.equal(
      await subscribeStore.partialUpdateOne(
        staleCopy,
        { $set: { label: "next" } },
        { allowNotFound: true },
      ),
      undefined,
    );
    assert.deepEqual(actions, []);
  });

  it("resolves undefined on a replace of a key deleted after prev was read, with allowNotFound", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      findByKey: () => Promise.resolve(stored),
      replaceOne: (() =>
        Promise.resolve(undefined)) as unknown as TestStore["replaceOne"],
    });

    await assert.rejects(subscribeStore.replaceOne(staleCopy), NotFoundError);
    assert.equal(
      await subscribeStore.replaceOne(staleCopy, { allowNotFound: true }),
      undefined,
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

  it("reads all documents then deletes once on deleteMany", async () => {
    const deletedCriteria: unknown[] = [];
    const { subscribeStore, actions } = createSubscribeStore({
      cursor: (() =>
        Promise.resolve({
          toArray: () => Promise.resolve([stored]),
        })) as unknown as TestStore["cursor"],
      deleteMany: (criteria) => {
        deletedCriteria.push(criteria);
        return Promise.resolve();
      },
    });

    await subscribeStore.deleteMany({ label: "stored" });

    assert.deepEqual(deletedCriteria, [{ label: "stored" }]);
    assert.deepEqual(actions, [{ type: "deleted", prev: [stored] }]);
  });
});

describe("SubscribeStore deleteMany over a store with deleteByKeyWithInfo", () => {
  it("emits exactly the documents deleted, re-checking the criteria", async () => {
    const calls: unknown[][] = [];
    const { subscribeStore, actions } = createSubscribeStore({
      ...createCursorStore([staleCopy, { ...staleCopy, _id: "2" }]),
      deleteByKeyWithInfo: (...args) => {
        calls.push(args);
        return Promise.resolve(args[0] === "1" ? { prev: stored } : undefined);
      },
    });

    await subscribeStore.deleteMany({ label: "stale" });

    assert.deepEqual(calls, [
      ["1", { label: "stale" }],
      ["2", { label: "stale" }],
    ]);
    assert.deepEqual(actions, [{ type: "deleted", prev: [stored] }]);
  });

  it("emits the deletes done before a failure", async () => {
    const failure = new Error("delete failed");
    const { subscribeStore, actions } = createSubscribeStore({
      ...createCursorStore([staleCopy, { ...staleCopy, _id: "2" }]),
      deleteByKeyWithInfo: (key) =>
        key === "1"
          ? Promise.resolve({ prev: stored })
          : Promise.reject(failure),
    });

    await assert.rejects(
      subscribeStore.deleteMany({ label: "stale" }),
      failure,
    );
    assert.deepEqual(actions, [{ type: "deleted", prev: [stored] }]);
  });

  it("emits nothing when no document is deleted", async () => {
    const { subscribeStore, actions } = createSubscribeStore({
      ...createCursorStore([staleCopy]),
      deleteByKeyWithInfo: () => Promise.resolve(undefined),
    });

    await subscribeStore.deleteMany({ label: "stale" });

    assert.deepEqual(actions, []);
  });
});

describe("SubscribeStore bulk writes with listeners", () => {
  it("reads every key before the first write of partialUpdateMany", async () => {
    const events: string[] = [];
    const { subscribeStore } = createSubscribeStore({
      cursor: (() =>
        Promise.resolve({
          forEach: async (
            callback: (model: TestModel) => Promise<void> | void,
          ) => {
            for (const _id of ["1", "2"]) {
              events.push(`read ${_id}`);
              await callback({ ...staleCopy, _id });
            }
          },
        })) as unknown as TestStore["cursor"],
      partialUpdateByKeyWithInfo: (key) => {
        events.push(`write ${key}`);
        return Promise.resolve({ prev: stored, next });
      },
    });

    await subscribeStore.partialUpdateMany(
      { label: "stale" },
      { $set: { label: "next" } },
    );

    assert.deepEqual(events, ["read 1", "read 2", "write 1", "write 2"]);
  });
});

describe("SubscribeStore without listeners", () => {
  const createUnsubscribedStore = (
    store: Partial<TestStore>,
  ): TestSubscribeStore =>
    new SubscribeStore({ keyPath: "_id", ...store } as TestStore);

  const unexpected = (): Promise<never> =>
    Promise.reject(new Error("per-document path used without listeners"));

  it("delegates partial updates to the wrapped store", async () => {
    const calls: unknown[][] = [];
    const subscribeStore = createUnsubscribedStore({
      partialUpdateByKey: ((...args: unknown[]) => {
        calls.push(["partialUpdateByKey", ...args]);
        return Promise.resolve(next);
      }) as TestStore["partialUpdateByKey"],
      partialUpdateMany: (...args) => {
        calls.push(["partialUpdateMany", ...args]);
        return Promise.resolve();
      },
      partialUpdateByKeyWithInfo: unexpected,
      cursor: unexpected,
    });

    const result = await subscribeStore.partialUpdateOne(
      staleCopy,
      { $set: { label: "next" } },
      { touchUpdated: false },
    );
    await subscribeStore.partialUpdateMany(
      { label: "stale" },
      { $set: { label: "next" } },
      { touchUpdated: false },
    );

    assert.equal(result, next);
    assert.deepEqual(calls, [
      [
        "partialUpdateByKey",
        "1",
        { $set: { label: "next" } },
        undefined,
        { touchUpdated: false },
      ],
      [
        "partialUpdateMany",
        { label: "stale" },
        { $set: { label: "next" } },
        { touchUpdated: false },
      ],
    ]);
  });

  it("delegates replaces to the wrapped store", async () => {
    const replaced: unknown[] = [];
    const subscribeStore = createUnsubscribedStore({
      replaceOne: ((object: TestModel) => {
        replaced.push(object);
        return Promise.resolve(next);
      }) as TestStore["replaceOne"],
      replaceSeveral: (objects) => {
        replaced.push(objects);
        return Promise.resolve([next]);
      },
      replaceOneWithInfo: unexpected,
    });

    assert.equal(await subscribeStore.replaceOne(staleCopy), next);
    assert.deepEqual(await subscribeStore.replaceSeveral([staleCopy]), [next]);
    assert.deepEqual(replaced, [staleCopy, [staleCopy]]);
  });

  it("delegates deletes to the wrapped store", async () => {
    const calls: unknown[][] = [];
    const subscribeStore = createUnsubscribedStore({
      deleteByKey: (...args) => {
        calls.push(["deleteByKey", ...args]);
        return Promise.resolve();
      },
      deleteMany: (...args) => {
        calls.push(["deleteMany", ...args]);
        return Promise.resolve();
      },
      deleteByKeyWithInfo: unexpected,
      cursor: unexpected,
    });

    await subscribeStore.deleteOne(staleCopy);
    await subscribeStore.deleteMany({ label: "stale" });

    assert.deepEqual(calls, [
      ["deleteByKey", "1", undefined],
      ["deleteMany", { label: "stale" }],
    ]);
  });
});

describe("SubscribeStore notifyChanged", () => {
  it("re-reads the keys and emits changed with the stored documents", async () => {
    const stored: TestModel = { _id: "1", label: "a", created, updated };
    const criteriaSeen: unknown[] = [];
    const { subscribeStore, actions } = createSubscribeStore({
      findAll: (criteria) => {
        criteriaSeen.push(criteria);
        return Promise.resolve([stored]);
      },
    });

    await subscribeStore.notifyChanged(["1", "2"]);

    assert.deepEqual(criteriaSeen, [{ _id: { $in: ["1", "2"] } }]);
    assert.deepEqual(actions, [
      { type: "changed", keys: ["1", "2"], next: [stored] },
    ]);
  });

  it("reads nothing without listeners", async () => {
    let readCount = 0;
    const subscribeStore: TestSubscribeStore = new SubscribeStore({
      keyPath: "_id",
      findAll: () => {
        readCount++;
        return Promise.resolve([]);
      },
    } as unknown as TestStore);

    await subscribeStore.notifyChanged(["1"]);

    assert.equal(readCount, 0);
  });
});

describe("SubscribeStore resync", () => {
  it("emits resync", () => {
    const { subscribeStore, actions } = createSubscribeStore({});

    subscribeStore.resync();

    assert.deepEqual(actions, [{ type: "resync" }]);
  });
});

describe("SubscribeStore subscribeChangedKeys", () => {
  it("receives the keys of every write, not of notified documents", async () => {
    const object: TestModel = { _id: "1", label: "a", created, updated };
    const subscribeStore: TestSubscribeStore = new SubscribeStore({
      keyPath: "_id",
      insertOne: () => Promise.resolve(object),
      findAll: () => Promise.resolve([]),
    } as unknown as TestStore);
    const receivedKeys: string[][] = [];
    subscribeStore.subscribeChangedKeys((keys) => receivedKeys.push(keys));

    await subscribeStore.insertOne(object);
    subscribeStore.callSubscribed({ type: "deleted", prev: [object] });
    subscribeStore.callSubscribed({
      type: "updated",
      changes: [[object, { ...object, label: "b" }]],
    });
    await subscribeStore.notifyChanged(["2"]);
    subscribeStore.resync();

    assert.deepEqual(receivedKeys, [["1"], ["1"], ["1"]]);
  });
});
