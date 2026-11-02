import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MongoBaseModel } from "./MongoBaseModel.ts";
import MongoConnection from "./MongoConnection.ts";
import MongoStore from "./MongoStore.ts";
import { createMemoryMongoClient } from "./memory/createMemoryMongoClient.ts";

interface TestModel extends MongoBaseModel {
  label: string;
}

const createStore = async (): Promise<MongoStore<TestModel>> => {
  const { client } = createMemoryMongoClient();
  const store = new MongoStore<TestModel>(
    new MongoConnection({ client }),
    "tasks",
  );
  await store.insertOne({ _id: "1", label: "a" });
  await store.insertOne({ _id: "2", label: "b" });
  return store;
};

describe("MongoCursor", () => {
  it("iterates with for await and stops at the end", async () => {
    const store = await createStore();
    const cursor = await store.cursor({}, { _id: 1 });

    const labels: string[] = [];
    for await (const result of cursor) {
      labels.push(result.label);
      assert.equal(cursor.key, result._id);
    }

    assert.deepEqual(labels, ["a", "b"]);
  });

  it("iterates keys with keysAsyncIterator", async () => {
    const store = await createStore();
    const cursor = await store.cursor({}, { _id: -1 });

    const keys: unknown[] = [];
    for await (const key of cursor.keysAsyncIterator()) keys.push(key);

    assert.deepEqual(keys, ["2", "1"]);
  });
});
