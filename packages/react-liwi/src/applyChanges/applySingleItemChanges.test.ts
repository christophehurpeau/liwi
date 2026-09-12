import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Changes, QueryInfo, QueryMeta } from "liwi-store";
import { applySingleItemChanges } from "./applySingleItemChanges.ts";

interface Item {
  _id: string;
  name: string;
}

const queryInfo: QueryInfo<Item> = { keyPath: "_id" };

const makeMeta = (total = 0): QueryMeta => ({ total });

describe("applySingleItemChanges", () => {
  test("returns state untouched when state is undefined", () => {
    const changes: Changes<string, Item | null> = [
      { type: "updated", result: { _id: "1", name: "a" } },
    ];
    const { state } = applySingleItemChanges(
      undefined,
      changes,
      makeMeta(),
      queryInfo,
    );
    assert.equal(state, undefined);
  });

  describe("initial", () => {
    test("sets total to 1 for a non-null value", () => {
      const changes: Changes<string, Item | null> = [
        {
          type: "initial",
          initial: { _id: "1", name: "a" },
          meta: makeMeta(),
          queryInfo,
        },
      ];
      const { state, meta } = applySingleItemChanges(
        null,
        changes,
        makeMeta(),
        queryInfo,
      );
      assert.deepEqual(state, { _id: "1", name: "a" });
      assert.equal(meta.total, 1);
    });

    test("sets total to 0 for a null value", () => {
      const changes: Changes<string, Item | null> = [
        { type: "initial", initial: null, meta: makeMeta(), queryInfo },
      ];
      const { state, meta } = applySingleItemChanges(
        null,
        changes,
        makeMeta(5),
        queryInfo,
      );
      assert.equal(state, null);
      assert.equal(meta.total, 0);
    });
  });

  describe("updated", () => {
    test("replaces the value and keeps total at 1", () => {
      const changes: Changes<string, Item | null> = [
        { type: "updated", result: { _id: "1", name: "b" } },
      ];
      const { state, meta } = applySingleItemChanges(
        { _id: "1", name: "a" },
        changes,
        makeMeta(1),
        queryInfo,
      );
      assert.deepEqual(state, { _id: "1", name: "b" });
      assert.equal(meta.total, 1);
    });

    test("sets total to 0 when updated result is null", () => {
      const changes: Changes<string, Item | null> = [
        { type: "updated", result: null },
      ];
      const { state, meta } = applySingleItemChanges(
        { _id: "1", name: "a" },
        changes,
        makeMeta(1),
        queryInfo,
      );
      assert.equal(state, null);
      assert.equal(meta.total, 0);
    });
  });

  describe("deleted", () => {
    test("clears value and sets total to 0", () => {
      const changes: Changes<string, Item | null> = [
        { type: "deleted", keys: ["1"] },
      ];
      const { state, meta } = applySingleItemChanges(
        { _id: "1", name: "a" },
        changes,
        makeMeta(1),
        queryInfo,
      );
      assert.equal(state, null);
      assert.equal(meta.total, 0);
    });
  });

  test("throws on inserted change", () => {
    const changes: Changes<string, Item | null> = [
      { type: "inserted", result: { _id: "1", name: "a" } },
    ];
    assert.throws(
      () => applySingleItemChanges(null, changes, makeMeta(), queryInfo),
      /Invalid type/,
    );
  });

  test("applies multiple changes in sequence", () => {
    const changes: Changes<string, Item | null> = [
      { type: "updated", result: { _id: "1", name: "b" } },
      { type: "deleted", keys: ["1"] },
    ];
    const { state, meta } = applySingleItemChanges(
      { _id: "1", name: "a" },
      changes,
      makeMeta(1),
      queryInfo,
    );
    assert.equal(state, null);
    assert.equal(meta.total, 0);
  });
});
