import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import mongodb from "mongodb";
import type { MongoBaseModel } from "./MongoBaseModel.ts";
import MongoConnection from "./MongoConnection.ts";
import MongoStore from "./MongoStore.ts";

interface TestModel extends MongoBaseModel {
  label: string;
  status?: string;
}

let findOneAndUpdateCalls: unknown[][];
let existingDocument: TestModel | null;

const collection = {
  findOneAndUpdate: (...args: unknown[]) => {
    findOneAndUpdateCalls.push(args);
    return Promise.resolve(existingDocument);
  },
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
