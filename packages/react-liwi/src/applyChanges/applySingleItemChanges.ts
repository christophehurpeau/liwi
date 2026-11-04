import type { Change, Changes, QueryInfo, QueryMeta } from "liwi-store";

const applySingleItemChange = <Value extends Record<keyof Value, any>>(
  state: Value | null,
  change: Change<any, Value | null>,
  queryMeta: QueryMeta,
  queryInfo: QueryInfo<Value>,
): Value | null => {
  switch (change.type) {
    case "initial":
      queryMeta.total = change.initial === null ? 0 : 1;
      return change.initial;

    case "updated": {
      queryMeta.total = change.result === null ? 0 : 1;
      return change.result;
    }

    case "deleted": {
      queryMeta.total = 0;
      return null;
    }

    case "inserted":
    default:
      throw new Error("Invalid type");
  }
};

// https://github.com/rethinkdb/horizon/blob/next/client/src/ast.js
export function applySingleItemChanges<
  Value extends Record<keyof Value, unknown>,
>(
  state: Value | null | undefined,
  changes: Changes<any, Value | null>,
  queryMeta: QueryMeta,
  queryInfo: QueryInfo<Value>,
): { state: Value | null | undefined; meta: QueryMeta } {
  if (state === undefined) return { state, meta: queryMeta };

  const newQueryMeta = { ...queryMeta };

  return {
    // oxlint-disable-next-line unicorn/no-array-reduce
    state: changes.reduce<Value | null>(
      (result: Value | null, change: Change<any, Value | null>) =>
        applySingleItemChange<Value>(result, change, newQueryMeta, queryInfo),
      state,
    ),
    meta: newQueryMeta,
  };
}
