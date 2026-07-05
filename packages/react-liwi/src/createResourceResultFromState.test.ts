import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { QueryInfo, QueryMeta } from "liwi-store";
// eslint-disable-next-line import-x/extensions
import { createResourceResultFromState } from "./createResourceResultFromState.ts";
// eslint-disable-next-line import-x/extensions
import type { State } from "./reducer.ts";

interface Item {
  _id: string;
}

type Params = undefined;

const query = { key: "queryAll" } as unknown as State<Item[], Params>["query"];
const queryInfo: QueryInfo<Item> = { keyPath: "_id" };
const meta: QueryMeta = { total: 1 };

describe("createResourceResultFromState", () => {
  test("maps an initial fetching state to initialLoading", () => {
    const result = createResourceResultFromState<Item[], Params>({
      fetched: false,
      fetching: true,
      query,
      result: undefined,
      meta: undefined,
      queryInfo: undefined,
      error: undefined,
    });
    assert.equal(result.initialLoading, true);
    assert.equal(result.initialError, false);
    assert.equal(result.data, undefined);
    assert.equal(result.meta, undefined);
    assert.equal(result.queryInfo, undefined);
  });

  test("maps a not-yet-fetched error state to initialError", () => {
    const error = new Error("boom");
    const result = createResourceResultFromState<Item[], Params>({
      fetched: false,
      fetching: false,
      query,
      result: undefined,
      meta: undefined,
      queryInfo: undefined,
      error,
    });
    assert.equal(result.initialLoading, false);
    assert.equal(result.initialError, true);
    assert.equal(result.error, error);
  });

  test("maps a fetched state to loaded data", () => {
    const result = createResourceResultFromState<Item[], Params>({
      fetched: true,
      fetching: false,
      query,
      result: [{ _id: "1" }],
      meta,
      queryInfo,
      error: undefined,
    });
    assert.equal(result.initialLoading, false);
    assert.equal(result.initialError, false);
    assert.equal(result.fetched, true);
    assert.deepEqual(result.data, [{ _id: "1" }]);
    assert.equal(result.meta, meta);
    assert.equal(result.queryInfo, queryInfo);
  });

  test("a refetch after load (fetched + error) is not an initialError", () => {
    const error = new Error("boom");
    const result = createResourceResultFromState<Item[], Params>({
      fetched: true,
      fetching: true,
      query,
      result: [{ _id: "1" }],
      meta,
      queryInfo,
      error,
    });
    assert.equal(result.initialError, false);
    assert.equal(result.initialLoading, false);
    assert.deepEqual(result.data, [{ _id: "1" }]);
    assert.equal(result.error, error);
  });
});
