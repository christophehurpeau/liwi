import type { Query, QueryParams } from "liwi-resources-client";
import type { ResourceResult } from "./createResourceResultFromState.ts";
import type { UseResourceOptions } from "./useResource.ts";

export function useResource<Result, Params extends QueryParams<Params>>(
  createQuery: (initialParams: Params) => Query<Result, Params>,
  options: UseResourceOptions<Params>,
  deps: any[],
): ResourceResult<Result, Params> {
  return {
    query: undefined as any,
    initialLoading: true,
    initialError: false,
    fetched: false,
    fetching: true,
    data: undefined,
    meta: undefined,
    queryInfo: undefined,
    error: undefined,
  };
}
