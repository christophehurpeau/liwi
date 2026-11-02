import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { NotFoundError, ProtectedFieldUpdateError } from "liwi-store";
import mongodb from "mongodb";
import type { MongoBaseModel } from "./MongoBaseModel.ts";
import MongoConnection from "./MongoConnection.ts";
import MongoStore from "./MongoStore.ts";
import { createReplacePipeline } from "./writes/createReplacePipeline.ts";

interface TestModel extends MongoBaseModel {
  label: string;
  status?: string;
}

let findOneAndUpdateCalls: unknown[][];
let findOneAndDeleteCalls: unknown[][];
let updateManyCalls: unknown[][];
let existingDocument: TestModel | null;
let documentAfterWrite: TestModel | null;

const collection = {
  findOneAndUpdate: (...args: unknown[]) => {
    findOneAndUpdateCalls.push(args);
    return Promise.resolve(existingDocument);
  },
  findOneAndDelete: (...args: unknown[]) => {
    findOneAndDeleteCalls.push(args);
    return Promise.resolve(existingDocument);
  },
  findOne: () => Promise.resolve(documentAfterWrite),
  updateMany: (...args: unknown[]) => {
    updateManyCalls.push(args);
    return Promise.resolve({ matchedCount: 1 });
  },
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

  it("computes next with undefined values as the driver stores them", async () => {
    existingDocument = {
      _id: "1",
      label: "old",
      status: "x",
      created,
      updated,
    };

    const result = await createStore().upsertOneWithInfo({
      _id: "1",
      label: "a",
      status: undefined,
      updated,
    });

    assert.equal(result.object.status, null);
  });

  it("rejects updated in setOnInsert, which would conflict with $set", async () => {
    await assert.rejects(
      createStore().upsertOneWithInfo(
        { _id: "1", label: "a" },
        { updated: new Date() },
      ),
      ProtectedFieldUpdateError,
    );
    assert.deepEqual(findOneAndUpdateCalls, []);
  });
});

describe("MongoStore writes with info", () => {
  const stored: TestModel = { _id: "1", label: "stored", created, updated };
  const next: TestModel = { _id: "1", label: "next", created, updated };
  let writeStart: number;

  const assertWriteTime = (value: unknown): Date => {
    assert.ok(value instanceof Date);
    assert.ok(value.getTime() >= writeStart && value.getTime() <= Date.now());
    return value;
  };

  const stampOf = (update: unknown): unknown =>
    (update as { $set: { updated: unknown } }).$set.updated;

  const replacementStampOf = (pipeline: unknown): unknown =>
    (
      pipeline as [
        {
          $replaceWith: {
            $mergeObjects: [{ $literal: { updated: unknown } }];
          };
        },
      ]
    )[0].$replaceWith.$mergeObjects[0].$literal.updated;

  beforeEach(() => {
    writeStart = Date.now();
    findOneAndUpdateCalls = [];
    findOneAndDeleteCalls = [];
    updateManyCalls = [];
    existingDocument = stored;
    documentAfterWrite = next;
  });

  it("partially updates atomically with the criteria and the write time, then reads next", async () => {
    const result = await createStore().partialUpdateByKeyWithInfo(
      "1",
      { $set: { label: "next" } },
      { status: "open" },
    );

    const writeTime = assertWriteTime(stampOf(findOneAndUpdateCalls[0]?.[1]));
    assert.deepEqual(findOneAndUpdateCalls, [
      [
        { _id: "1", status: "open" },
        { $set: { label: "next", updated: writeTime } },
        { returnDocument: "before" },
      ],
    ]);
    assert.deepEqual(result, { prev: stored, next });
  });

  it("does not stamp updated with touchUpdated: false", async () => {
    await createStore().partialUpdateByKey(
      "1",
      { $set: { label: "next" } },
      undefined,
      { touchUpdated: false },
    );

    assert.deepEqual(findOneAndUpdateCalls, [
      [{ _id: "1" }, { $set: { label: "next" } }, { returnDocument: "after" }],
    ]);
  });

  it("rejects a protected field update before writing", async () => {
    await assert.rejects(
      createStore().partialUpdateByKey("1", { $set: { created: new Date() } }),
      ProtectedFieldUpdateError,
    );
    assert.deepEqual(findOneAndUpdateCalls, []);
  });

  it("partially updates many documents in one command with one write time", async () => {
    await createStore().partialUpdateMany(
      { status: "open" },
      { $set: { label: "next" } },
    );

    const writeTime = assertWriteTime(stampOf(updateManyCalls[0]?.[1]));
    assert.deepEqual(updateManyCalls, [
      [{ status: "open" }, { $set: { label: "next", updated: writeTime } }],
    ]);
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

  it("resolves undefined with allowNotFound when the partial update matches nothing", async () => {
    existingDocument = null;

    const store = createStore();

    assert.equal(
      await store.partialUpdateByKey("1", { $set: { label: "x" } }, undefined, {
        allowNotFound: true,
      }),
      undefined,
    );
    assert.equal(
      await store.partialUpdateOne(
        { _id: "1", label: "x", created, updated },
        { $set: { label: "x" } },
        { allowNotFound: true },
      ),
      undefined,
    );
  });

  it("replaces atomically, keeping the stored created and stamping updated", async () => {
    const callerCreated = new Date("2025-01-01");
    const object: TestModel = {
      _id: "1",
      label: "next",
      created: callerCreated,
      updated,
    };

    const result = await createStore().replaceOneWithInfo(object);

    const writeTime = assertWriteTime(
      replacementStampOf(findOneAndUpdateCalls[0]?.[1]),
    );
    const replacement = { ...object, updated: writeTime };
    assert.deepEqual(findOneAndUpdateCalls, [
      [
        { _id: "1" },
        createReplacePipeline(replacement),
        { returnDocument: "before" },
      ],
    ]);
    assert.deepEqual(result, {
      prev: stored,
      next: { ...replacement, created },
    });
    assert.equal(object.updated, updated);
  });

  it("partially updates in one call returning the document after the write", async () => {
    existingDocument = next;

    const result = await createStore().partialUpdateByKey("1", {
      $set: { label: "next" },
    });

    const writeTime = assertWriteTime(stampOf(findOneAndUpdateCalls[0]?.[1]));
    assert.deepEqual(findOneAndUpdateCalls, [
      [
        { _id: "1" },
        { $set: { label: "next", updated: writeTime } },
        { returnDocument: "after" },
      ],
    ]);
    assert.deepEqual(result, next);
  });

  it("replaceOne returns the stored document and leaves the caller's object untouched", async () => {
    existingDocument = next;
    const object: TestModel = { _id: "1", label: "next", created, updated };

    const result = await createStore().replaceOne(object);

    const writeTime = assertWriteTime(
      replacementStampOf(findOneAndUpdateCalls[0]?.[1]),
    );
    assert.deepEqual(findOneAndUpdateCalls, [
      [
        { _id: "1" },
        createReplacePipeline({ ...object, updated: writeTime }),
        { returnDocument: "after" },
      ],
    ]);
    assert.equal(result, next);
    assert.equal(object.updated, updated);
  });

  it("throws NotFoundError when replacing a missing document", async () => {
    existingDocument = null;

    await assert.rejects(
      createStore().replaceOne({ _id: "1", label: "x", created, updated }),
      NotFoundError,
    );
  });

  it("resolves undefined with allowNotFound when replacing a missing document", async () => {
    existingDocument = null;

    assert.equal(
      await createStore().replaceOne(
        { _id: "1", label: "x", created, updated },
        { allowNotFound: true },
      ),
      undefined,
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
