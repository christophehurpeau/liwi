import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { Changes } from "liwi-store";
import { SubscribeStore } from "liwi-subscribe-store";
import type { MongoBaseModel } from "./MongoBaseModel.ts";
import MongoQuerySingleItem from "./MongoQuerySingleItem.ts";
import type MongoStore from "./MongoStore.ts";

interface TestModel extends MongoBaseModel {
  status: string;
}

const created = new Date("2020-01-01");
const updated = new Date("2021-01-01");

interface SubscribeSingleItemOptions {
  cursor?: MongoStore<TestModel>["cursor"];
  sort?: Record<string, -1 | 1>;
}

const subscribeSingleItem = ({
  cursor = () => Promise.reject(new Error("unexpected fetch")),
  sort,
}: SubscribeSingleItemOptions = {}): {
  subscribeStore: SubscribeStore<any, any, TestModel, any, any, any>;
  received: Changes<string, TestModel | null>[];
  errors: Error[];
} => {
  const store = { keyPath: "_id", cursor } as unknown as MongoStore<TestModel>;
  const subscribeStore = new SubscribeStore<any, any, TestModel, any, any, any>(
    store,
  );
  const query = new MongoQuerySingleItem<TestModel, never, TestModel | null>(
    store,
    { criteria: { status: "open" }, sort },
  );
  query.setSubscribeStore(subscribeStore);

  const received: Changes<string, TestModel | null>[] = [];
  const errors: Error[] = [];
  query.subscribe((error, changes) => {
    if (error) errors.push(error);
    else received.push(changes);
  });
  return { subscribeStore, received, errors };
};

const createCursor = (
  documents: TestModel[],
): MongoStore<TestModel>["cursor"] =>
  (() => {
    const cursor = {
      limit: () => Promise.resolve(cursor),
      toArray: () => Promise.resolve(documents),
    };
    return Promise.resolve(cursor);
  }) as unknown as MongoStore<TestModel>["cursor"];

const draft: TestModel = { _id: "1", status: "draft", created, updated };
const open: TestModel = { _id: "1", status: "open", created, updated };
const closed: TestModel = { _id: "1", status: "closed", created, updated };
const draft2: TestModel = { ...draft, _id: "2" };
const open2: TestModel = { ...open, _id: "2" };

describe("MongoQuerySingleItem subscription", () => {
  it("pushes a document that enters the criteria through an update", async () => {
    const { subscribeStore, received } = subscribeSingleItem();

    subscribeStore.callSubscribed({
      type: "updated",
      changes: [[draft, open]],
    });
    await setImmediate();

    assert.deepEqual(received, [[{ type: "updated", result: open }]]);
  });

  it("pushes null when the document leaves the criteria", async () => {
    const { subscribeStore, received } = subscribeSingleItem();

    subscribeStore.callSubscribed({
      type: "updated",
      changes: [[open, closed]],
    });
    await setImmediate();

    assert.deepEqual(received, [[{ type: "updated", result: null }]]);
  });

  it("ignores an update outside the criteria before and after", async () => {
    const { subscribeStore, received, errors } = subscribeSingleItem();

    subscribeStore.callSubscribed({
      type: "updated",
      changes: [[draft, closed]],
    });
    await setImmediate();

    assert.deepEqual(received, []);
    assert.deepEqual(errors, []);
  });

  it("reports several matches without sort through the callback", async () => {
    const { subscribeStore, received, errors } = subscribeSingleItem();

    subscribeStore.callSubscribed({
      type: "updated",
      changes: [
        [draft, open],
        [draft2, open2],
      ],
    });
    await setImmediate();

    assert.deepEqual(received, []);
    assert.deepEqual(
      errors.map((error) => error.message),
      ["should not match more than 1, use sort if you can have multiple match"],
    );
  });

  it("refetches with a sort when several documents enter the criteria", async () => {
    const { subscribeStore, received, errors } = subscribeSingleItem({
      cursor: createCursor([open2]),
      sort: { _id: -1 },
    });

    subscribeStore.callSubscribed({
      type: "updated",
      changes: [
        [draft, open],
        [draft2, open2],
      ],
    });
    await setImmediate();

    assert.deepEqual(errors, []);
    assert.deepEqual(received, [[{ type: "updated", result: open2 }]]);
  });

  it("reports a failed refetch through the callback", async () => {
    const { subscribeStore, received, errors } = subscribeSingleItem({
      sort: { _id: -1 },
    });

    subscribeStore.callSubscribed({
      type: "updated",
      changes: [
        [draft, open],
        [draft2, open2],
      ],
    });
    await setImmediate();

    assert.deepEqual(received, []);
    assert.deepEqual(
      errors.map((error) => error.message),
      ["unexpected fetch"],
    );
  });
});
