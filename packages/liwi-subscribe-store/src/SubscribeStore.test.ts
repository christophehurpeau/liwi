import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
  upsertResult: UpsertResult<TestModel>,
): {
  subscribeStore: TestSubscribeStore;
  actions: Actions<TestModel>[];
} => {
  const store: Pick<TestStore, "keyPath" | "upsertOneWithInfo"> = {
    keyPath: "_id",
    upsertOneWithInfo: () => Promise.resolve(upsertResult),
  };
  const subscribeStore: TestSubscribeStore = new SubscribeStore(
    store as TestStore,
  );
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
    const { subscribeStore, actions } = createSubscribeStore(upsertResult);

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
    const { subscribeStore, actions } = createSubscribeStore(upsertResult);

    const result = await subscribeStore.upsertOneWithInfo({
      _id: "1",
      label: "a",
      updated,
    });

    assert.equal(result, upsertResult);
    assert.deepEqual(actions, [{ type: "updated", changes: [[prev, object]] }]);
  });
});
