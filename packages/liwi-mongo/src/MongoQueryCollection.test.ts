import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import mongodb from "mongodb";
import type { MongoBaseModel } from "./MongoBaseModel.ts";
import MongoConnection from "./MongoConnection.ts";
import MongoStore from "./MongoStore.ts";

interface TestModel extends MongoBaseModel {
  name: string;
  age: number;
}

interface FakeCursor {
  sortArg?: unknown;
  projectArg?: unknown;
  skipArg?: number;
  limitArg?: number;
  sort: (arg: unknown) => FakeCursor;
  project: (arg: unknown) => FakeCursor;
  skip: (arg: number) => FakeCursor;
  limit: (arg: number) => FakeCursor;
  toArray: () => Promise<TestModel[]>;
}

const documents: TestModel[] = [
  { _id: "1", name: "a", age: 1, created: new Date(), updated: new Date() },
];

let cursor: FakeCursor;

const createCursor = (): FakeCursor => ({
  sort(arg) {
    this.sortArg = arg;
    return this;
  },
  project(arg) {
    this.projectArg = arg;
    return this;
  },
  skip(arg) {
    this.skipArg = arg;
    return this;
  },
  limit(arg) {
    this.limitArg = arg;
    return this;
  },
  toArray: () => Promise.resolve(documents),
});

const collection = {
  find: () => cursor,
  countDocuments: () => Promise.resolve(documents.length),
};

mock.method(mongodb.MongoClient, "connect", () =>
  Promise.resolve({
    on: () => undefined,
    db: () => ({ collection: () => collection }),
  } as unknown as mongodb.MongoClient),
);

const createStore = (): InstanceType<typeof MongoStore<TestModel>> => {
  const connection = new MongoConnection({ database: "test" });
  return new MongoStore<TestModel>(connection, "test");
};

describe("MongoQueryCollection fields", () => {
  beforeEach(() => {
    cursor = createCursor();
  });

  it("applies the projection from options.fields", async () => {
    const query = createStore().createQueryCollection({
      criteria: { age: { $gt: 0 } },
      fields: { name: 1 },
      transformer: ({ _id, name }) => ({ _id, name }),
    });

    await query.fetch((result) => result);

    assert.deepEqual(cursor.projectArg, { name: 1 });
  });

  it("does not call project when options.fields is omitted", async () => {
    const query = createStore().createQueryCollection({
      criteria: { age: { $gt: 0 } },
    });

    await query.fetch((result) => result);

    assert.equal(cursor.projectArg, undefined);
  });
});
