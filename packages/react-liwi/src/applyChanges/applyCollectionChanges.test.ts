import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Changes, QueryInfo, QueryMeta } from "liwi-store";
import { applyCollectionChanges } from "./applyCollectionChanges.ts";

interface Item {
  _id: string;
  name: string;
  age: number;
}

const keyPath = "_id" as const;

const makeMeta = (total = 0): QueryMeta => ({ total });

const item = (id: string, name: string, age = 0): Item => ({
  _id: id,
  name,
  age,
});

describe("applyCollectionChanges", () => {
  test("returns state untouched when state is undefined", () => {
    const changes: Changes<string, Item[]> = [
      { type: "inserted", result: [item("1", "a")] },
    ];
    const queryInfo: QueryInfo<Item> = { keyPath };
    const result = applyCollectionChanges(
      undefined,
      changes,
      makeMeta(),
      queryInfo,
    );
    assert.equal(result.state, undefined);
  });

  describe("initial", () => {
    test("sets initial state and copies meta", () => {
      const changes: Changes<string, Item[]> = [
        {
          type: "initial",
          initial: [item("1", "a"), item("2", "b")],
          meta: { total: 2 },
          queryInfo: { keyPath },
        },
      ];
      const queryInfo: QueryInfo<Item> = { keyPath };
      const { state, meta } = applyCollectionChanges(
        [],
        changes,
        makeMeta(),
        queryInfo,
      );
      assert.deepEqual(state, [item("1", "a"), item("2", "b")]);
      assert.equal(meta.total, 2);
    });

    test("keeps existing reference when value is unchanged", () => {
      const existing = item("1", "a");
      const changes: Changes<string, Item[]> = [
        {
          type: "initial",
          initial: [item("1", "a")],
          meta: { total: 1 },
          queryInfo: { keyPath },
        },
      ];
      const queryInfo: QueryInfo<Item> = { keyPath };
      const { state } = applyCollectionChanges(
        [existing],
        changes,
        makeMeta(),
        queryInfo,
      );
      assert.equal(state?.[0], existing);
    });

    test("replaces reference when value changed", () => {
      const existing = item("1", "a");
      const changes: Changes<string, Item[]> = [
        {
          type: "initial",
          initial: [item("1", "b")],
          meta: { total: 1 },
          queryInfo: { keyPath },
        },
      ];
      const queryInfo: QueryInfo<Item> = { keyPath };
      const { state } = applyCollectionChanges(
        [existing],
        changes,
        makeMeta(),
        queryInfo,
      );
      assert.notEqual(state?.[0], existing);
      assert.equal(state?.[0]?.name, "b");
    });
  });

  describe("inserted", () => {
    test("prepends inserted items and increments total", () => {
      const changes: Changes<string, Item[]> = [
        { type: "inserted", result: [item("2", "b")] },
      ];
      const queryInfo: QueryInfo<Item> = { keyPath };
      const { state, meta } = applyCollectionChanges(
        [item("1", "a")],
        changes,
        makeMeta(1),
        queryInfo,
      );
      assert.deepEqual(state, [item("2", "b"), item("1", "a")]);
      assert.equal(meta.total, 2);
    });

    describe("mingo $sort", () => {
      test("sorts ascending by a single field", () => {
        const changes: Changes<string, Item[]> = [
          { type: "inserted", result: [item("3", "b", 2)] },
        ];
        const queryInfo: QueryInfo<Item> = {
          keyPath,
          sort: { age: 1 },
        };
        const { state } = applyCollectionChanges(
          [item("1", "a", 1), item("2", "c", 3)],
          changes,
          makeMeta(2),
          queryInfo,
        );
        assert.deepEqual(
          state?.map((i) => i.age),
          [1, 2, 3],
        );
      });

      test("sorts descending by a single field", () => {
        const changes: Changes<string, Item[]> = [
          { type: "inserted", result: [item("3", "b", 2)] },
        ];
        const queryInfo: QueryInfo<Item> = {
          keyPath,
          sort: { age: -1 },
        };
        const { state } = applyCollectionChanges(
          [item("1", "a", 1), item("2", "c", 3)],
          changes,
          makeMeta(2),
          queryInfo,
        );
        assert.deepEqual(
          state?.map((i) => i.age),
          [3, 2, 1],
        );
      });

      test("sorts by multiple fields in declaration order", () => {
        const changes: Changes<string, Item[]> = [
          { type: "inserted", result: [item("4", "a", 1)] },
        ];
        const queryInfo: QueryInfo<Item> = {
          keyPath,
          sort: { name: 1, age: -1 },
        };
        const { state } = applyCollectionChanges(
          [item("1", "b", 5), item("2", "a", 3), item("3", "a", 9)],
          changes,
          makeMeta(3),
          queryInfo,
        );
        assert.deepEqual(
          state?.map((i) => [i.name, i.age]),
          [
            ["a", 9],
            ["a", 3],
            ["a", 1],
            ["b", 5],
          ],
        );
      });

      test("is a stable sort across equal keys (idKey _id tiebreak)", () => {
        const changes: Changes<string, Item[]> = [
          { type: "inserted", result: [item("z", "x", 1)] },
        ];
        const queryInfo: QueryInfo<Item> = {
          keyPath,
          sort: { age: 1 },
        };
        const { state } = applyCollectionChanges(
          [item("a", "x", 1), item("b", "x", 1)],
          changes,
          makeMeta(2),
          queryInfo,
        );
        // inserted "z" is prepended then sorted; equal ages keep input order
        assert.deepEqual(
          state?.map((i) => i._id),
          ["z", "a", "b"],
        );
      });
    });

    describe("limit", () => {
      test("slices the collection accounting for inserted count", () => {
        const changes: Changes<string, Item[]> = [
          { type: "inserted", result: [item("3", "c", 0)] },
        ];
        const queryInfo: QueryInfo<Item> = {
          keyPath,
          sort: { age: 1 },
          limit: 3,
        };
        const { state } = applyCollectionChanges(
          [item("1", "a", 1), item("2", "b", 2)],
          changes,
          makeMeta(2),
          queryInfo,
        );
        // limit - inserted.length = 3 - 1 = 2 retained
        assert.deepEqual(
          state?.map((i) => i.age),
          [0, 1],
        );
      });
    });
  });

  describe("deleted", () => {
    test("removes items by key and decrements total", () => {
      const changes: Changes<string, Item[]> = [
        { type: "deleted", keys: ["1"] },
      ];
      const queryInfo: QueryInfo<Item> = { keyPath };
      const { state, meta } = applyCollectionChanges(
        [item("1", "a"), item("2", "b")],
        changes,
        makeMeta(2),
        queryInfo,
      );
      assert.deepEqual(state, [item("2", "b")]);
      assert.equal(meta.total, 1);
    });
  });

  describe("updated", () => {
    test("replaces matching items, leaves total unchanged", () => {
      const changes: Changes<string, Item[]> = [
        { type: "updated", result: [item("1", "updated")] },
      ];
      const queryInfo: QueryInfo<Item> = { keyPath };
      const { state, meta } = applyCollectionChanges(
        [item("1", "a"), item("2", "b")],
        changes,
        makeMeta(2),
        queryInfo,
      );
      assert.deepEqual(state, [item("1", "updated"), item("2", "b")]);
      assert.equal(meta.total, 2);
    });

    test("ignores updates for unknown keys", () => {
      const changes: Changes<string, Item[]> = [
        { type: "updated", result: [item("9", "x")] },
      ];
      const queryInfo: QueryInfo<Item> = { keyPath };
      const original = [item("1", "a")];
      const { state } = applyCollectionChanges(
        original,
        changes,
        makeMeta(1),
        queryInfo,
      );
      assert.deepEqual(state, [item("1", "a")]);
    });
  });

  test("applies multiple changes in sequence", () => {
    const changes: Changes<string, Item[]> = [
      { type: "inserted", result: [item("2", "b", 2)] },
      { type: "deleted", keys: ["1"] },
    ];
    const queryInfo: QueryInfo<Item> = { keyPath, sort: { age: 1 } };
    const { state, meta } = applyCollectionChanges(
      [item("1", "a", 1)],
      changes,
      makeMeta(1),
      queryInfo,
    );
    assert.deepEqual(state, [item("2", "b", 2)]);
    assert.equal(meta.total, 1);
  });
});
