import type { Change, Changes, QueryInfo, QueryMeta } from "liwi-store";
import { initOptions } from "mingo/core";
import { Lazy } from "mingo/lazy";
import { $sort } from "mingo/operators/pipeline";

function sortCollection<T>(collection: T[], sort: Record<string, -1 | 1>): T[] {
  return $sort(Lazy(collection), sort, initOptions({ idKey: "_id" })).value();
}

const copy = <Value>(state: Value[]): Value[] => [...state];

const applyCollectionChange = <Value>(
  state: Value[],
  change: Change<any, Value[]>,
  queryMeta: QueryMeta,
  queryInfo: QueryInfo<Value>,
  // eslint-disable-next-line @typescript-eslint/max-params
): Value[] => {
  switch (change.type) {
    case "initial": {
      const keyPath = queryInfo.keyPath;

      // update meta
      Object.assign(queryMeta, change.meta);

      // update state if exists, keeping ref to avoid rerendering everything
      return !state
        ? change.initial
        : change.initial.map((value) => {
            const existing = state.find((v) => v[keyPath] === value[keyPath]);
            if (!existing) return value;
            return JSON.stringify(existing) === JSON.stringify(value)
              ? existing
              : value;
          });
    }
    case "inserted": {
      queryMeta.total += change.result.length;

      let newCollection = [...change.result, ...state];

      if (queryInfo.sort) {
        newCollection = sortCollection(newCollection, queryInfo.sort);
      }

      if (!queryInfo.limit) return newCollection;

      return newCollection.slice(0, queryInfo.limit - change.result.length);
    }

    case "deleted": {
      queryMeta.total -= change.keys.length;

      const keyPath = queryInfo.keyPath;
      const deletedKeys = change.keys;
      return state.filter((value) => !deletedKeys.includes(value[keyPath]));
    }

    case "updated": {
      const keyPath = queryInfo.keyPath;
      const newState = copy(state);

      change.result.forEach((newObject) => {
        const index = newState.findIndex(
          (o: Value) => o[keyPath] === newObject[keyPath],
        );
        if (index === -1) return;
        newState[index] = newObject;
      });
      return newState;
    }

    default:
      throw new Error("Invalid type");
  }
};

// https://github.com/rethinkdb/horizon/blob/next/client/src/ast.js
// eslint-disable-next-line @typescript-eslint/max-params
export function applyCollectionChanges<Item>(
  state: Item[] | undefined,
  changes: Changes<any, Item[]>,
  queryMeta: QueryMeta,
  queryInfo: QueryInfo<Item>,
): { state: Item[] | undefined; meta: QueryMeta } {
  if (state === undefined) return { state, meta: queryMeta };

  const newQueryMeta = { ...queryMeta };

  return {
    // eslint-disable-next-line unicorn/no-array-reduce
    state: changes.reduce<Item[]>(
      (result: Item[], change: Change<any, Item[]>) =>
        applyCollectionChange<Item>(result, change, newQueryMeta, queryInfo),
      state,
    ),
    meta: newQueryMeta,
  };
}
