import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { QueryInfo, QueryMeta } from "liwi-store";
// eslint-disable-next-line import-x/extensions
import reducer, { initReducer } from "./reducer.ts";
// eslint-disable-next-line import-x/extensions
import type { Action, State } from "./reducer.ts";

interface Item {
  _id: string;
}

type Params = undefined;

const query = { key: "queryAll" } as unknown as State<Item[], Params>["query"];
const queryInfo: QueryInfo<Item> = { keyPath: "_id" };
const meta: QueryMeta = { total: 3 };

const initialState = (): State<Item[], Params> => ({
  fetched: false,
  fetching: true,
  query,
  result: undefined,
  meta: undefined,
  queryInfo: undefined,
  error: undefined,
});

const fetchedState = (): State<Item[], Params> => ({
  fetched: true,
  fetching: false,
  query,
  result: [{ _id: "1" }],
  meta,
  queryInfo,
  error: undefined,
});

describe("initReducer", () => {
  test("builds the initial fetching state from the initializer", () => {
    const promise = Promise.resolve();
    const state = initReducer<Item[], Params>(() => ({ query, promise }));
    assert.deepEqual(state, {
      fetched: false,
      fetching: true,
      query,
      result: undefined,
      meta: undefined,
      queryInfo: undefined,
      promise,
      error: undefined,
    });
  });
});

describe("reducer", () => {
  test("resolve populates result/meta/queryInfo and clears fetching and error", () => {
    const action: Action<Item[]> = {
      type: "resolve",
      result: [{ _id: "1" }],
      meta,
      queryInfo,
    };
    const state = reducer(initialState(), action);
    assert.equal(state.fetched, true);
    assert.equal(state.fetching, false);
    assert.deepEqual(state.result, [{ _id: "1" }]);
    assert.equal(state.meta, meta);
    assert.equal(state.queryInfo, queryInfo);
    assert.equal(state.error, undefined);
  });

  test("refetch preserves prior data and sets fetching with the new promise", () => {
    const promise = Promise.resolve();
    const prev = fetchedState();
    const state = reducer(prev, { type: "refetch", promise });
    assert.equal(state.fetched, true);
    assert.equal(state.fetching, true);
    assert.deepEqual(state.result, prev.result);
    assert.equal(state.meta, prev.meta);
    assert.equal(state.promise, promise);
  });

  test("fetching flips fetching to true without touching the rest", () => {
    const prev = fetchedState();
    const state = reducer(prev, { type: "fetching" });
    assert.equal(state.fetching, true);
    assert.equal(state.fetched, true);
    assert.deepEqual(state.result, prev.result);
  });

  test("error sets the error and stops fetching", () => {
    const error = new Error("boom");
    const state = reducer(initialState(), { type: "error", error });
    assert.equal(state.error, error);
    assert.equal(state.fetching, false);
  });

  test("throws on unknown action type", () => {
    assert.throws(
      () =>
        reducer(initialState(), {
          type: "unknown",
        } as unknown as Action<Item[]>),
      /Invalid action/,
    );
  });
});
