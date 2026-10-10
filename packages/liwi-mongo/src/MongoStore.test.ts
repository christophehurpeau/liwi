import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { NotFoundError } from "liwi-store";
import mongodb from "mongodb";
import type { MongoBaseModel } from "./MongoBaseModel.ts";
import MongoConnection from "./MongoConnection.ts";
import MongoStore from "./MongoStore.ts";

interface TestModel extends MongoBaseModel {
  label: string;
  status?: string;
}

let findOneAndUpdateCalls: unknown[][];
let findOneAndReplaceCalls: unknown[][];
let findOneAndDeleteCalls: unknown[][];
let existingDocument: TestModel | null;
let documentAfterWrite: TestModel | null;

const collection = {
  findOneAndUpdate: (...args: unknown[]) => {
    findOneAndUpdateCalls.push(args);
    return Promise.resolve(existingDocument);
  },
  findOneAndReplace: (...args: unknown[]) => {
    findOneAndReplaceCalls.push(args);
    return Promise.resolve(existingDocument);
  },
  findOneAndDelete: (...args: unknown[]) => {
    findOneAndDeleteCalls.push(args);
    return Promise.resolve(existingDocument);
  },
  findOne: () => Promise.resolve(documentAfterWrite),
  replaceOne: () => Promise.resolve({ matchedCount: existingDocument ? 1 : 0 }),
  deleteOne: () => Promise.resolve({ deletedCount: existingDocument ? 1 : 0 }),
};

mock.method(mongodb.MongoClient, "connect", () =>
  Promise.resolve({
    on: () => undefined,
    db: () => ({ collection: () => collection }),
  } as unknown as mongodb.MongoClient),
);

const createStore = (): InstanceType<typeof MongoStore<TestModel>> =>
  new MongoStore<TestModel>(new MongoConnection({ database: "test" }), "tasks");

const created = new Date("2020-01-01");
const updated = new Date("2021-01-01");

describe("MongoStore upsertOneWithInfo", () => {
  beforeEach(() => {
    findOneAndUpdateCalls = [];
    existingDocument = null;
  });

  it("upserts atomically, requesting the document before the update", async () => {
    await createStore().upsertOneWithInfo(
      { _id: "1", label: "a", created, updated },
      { status: "new" },
    );

    assert.deepEqual(findOneAndUpdateCalls, [
      [
        { _id: "1" },
        {
          $set: { _id: "1", label: "a", updated },
          $setOnInsert: { created, status: "new" },
        },
        { upsert: true, returnDocument: "before" },
      ],
    ]);
  });

  it("resolves as inserted when no document existed", async () => {
    const result = await createStore().upsertOneWithInfo(
      { _id: "1", label: "a", created, updated },
      { status: "new" },
    );

    assert.deepEqual(result, {
      resolvedAs: "inserted",
      inserted: true,
      object: { _id: "1", label: "a", created, updated, status: "new" },
    });
  });

  it("resolves as updated with prev and the full next document", async () => {
    existingDocument = {
      _id: "1",
      label: "old",
      status: "existing",
      created,
      updated: created,
    };

    const result = await createStore().upsertOneWithInfo(
      { _id: "1", label: "a", updated },
      { status: "new" },
    );

    assert.deepEqual(result, {
      resolvedAs: "updated",
      inserted: false,
      object: {
        _id: "1",
        label: "a",
        status: "existing",
        created,
        updated,
      },
      prev: existingDocument,
    });
  });
});

describe("MongoStore writes with info", () => {
  const stored: TestModel = { _id: "1", label: "stored", created, updated };
  const next: TestModel = { _id: "1", label: "next", created, updated };

  beforeEach(() => {
    findOneAndUpdateCalls = [];
    findOneAndReplaceCalls = [];
    findOneAndDeleteCalls = [];
    existingDocument = stored;
    documentAfterWrite = next;
  });

  it("partially updates atomically with the criteria, then reads next", async () => {
    const result = await createStore().partialUpdateByKeyWithInfo(
      "1",
      { $set: { label: "next" } },
      { status: "open" },
    );

    assert.deepEqual(findOneAndUpdateCalls, [
      [
        { _id: "1", status: "open" },
        { $set: { label: "next" } },
        { returnDocument: "before" },
      ],
    ]);
    assert.deepEqual(result, { prev: stored, next });
  });

  it("resolves next undefined when the document is deleted before the read-back", async () => {
    documentAfterWrite = null;

    const result = await createStore().partialUpdateByKeyWithInfo("1", {
      $set: { label: "next" },
    });

    assert.deepEqual(result, { prev: stored, next: undefined });
  });

  it("resolves undefined when the partial update matches nothing", async () => {
    existingDocument = null;

    const store = createStore();

    assert.equal(
      await store.partialUpdateByKeyWithInfo("1", { $set: { label: "x" } }),
      undefined,
    );
    await assert.rejects(
      store.partialUpdateByKey("1", { $set: { label: "x" } }),
      NotFoundError,
    );
  });

  it("replaces atomically and returns a copy, not the caller's object", async () => {
    const object: TestModel = { _id: "1", label: "next", created, updated };

    const result = await createStore().replaceOneWithInfo(object);

    assert.deepEqual(findOneAndReplaceCalls, [
      [{ _id: "1" }, object, { returnDocument: "before" }],
    ]);
    assert.deepEqual(result, { prev: stored, next: object });
    assert.notEqual(result?.next, object);
  });

  it("partially updates in one call returning the document after the write", async () => {
    existingDocument = next;

    const result = await createStore().partialUpdateByKey("1", {
      $set: { label: "next" },
    });

    assert.deepEqual(findOneAndUpdateCalls, [
      [{ _id: "1" }, { $set: { label: "next" } }, { returnDocument: "after" }],
    ]);
    assert.deepEqual(result, next);
  });

  it("replaceOne returns a copy, not the caller's object", async () => {
    const object: TestModel = { _id: "1", label: "next", created, updated };

    const result = await createStore().replaceOne(object);

    assert.deepEqual(result, object);
    assert.notEqual(result, object);
    assert.deepEqual(findOneAndReplaceCalls, []);
  });

  it("throws NotFoundError when replacing a missing document", async () => {
    existingDocument = null;

    await assert.rejects(
      createStore().replaceOne({ _id: "1", label: "x", created, updated }),
      NotFoundError,
    );
  });

  it("deletes atomically with the criteria and returns prev", async () => {
    const result = await createStore().deleteByKeyWithInfo("1", {
      status: "open",
    });

    assert.deepEqual(findOneAndDeleteCalls, [[{ _id: "1", status: "open" }]]);
    assert.deepEqual(result, { prev: stored });
  });

  it("resolves when deleting a missing document", async () => {
    existingDocument = null;

    const store = createStore();

    assert.equal(await store.deleteByKeyWithInfo("1"), undefined);
    await store.deleteByKey("1");
  });
});
