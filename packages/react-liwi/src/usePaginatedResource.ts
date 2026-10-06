import type { Query, QueryParams } from "liwi-resources-client";
import { useMemo } from "react";
import type {
  ResourceResultInitialError,
  ResourceResultInitialLoading,
  ResourceResultLoaded,
} from "./createResourceResultFromState";
import type { UseResourceOptions } from "./useResource";
import { useResource } from "./useResource.ts";

export interface PaginatedQueryRequiredParams {
  page: number;
}

type PaginatedQueryParams<Params extends Record<string, unknown>> =
  PaginatedQueryRequiredParams & QueryParams<Params>;

type UsePaginatedResourceOptions<Params extends PaginatedQueryParams<Params>> =
  UseResourceOptions<Params>;

export interface Pagination {
  totalPages: number;
}

interface PaginatedResourceResultInitialLoading<
  Data,
  Params extends PaginatedQueryParams<Params>,
> extends ResourceResultInitialLoading<Data, Params> {
  pagination: undefined;
}

interface PaginatedResourceResultInitialError<
  Data,
  Params extends PaginatedQueryParams<Params>,
> extends ResourceResultInitialError<Data, Params> {
  pagination: undefined;
}

interface PaginatedResourceResultLoaded<
  Data,
  Params extends PaginatedQueryParams<Params>,
> extends ResourceResultLoaded<Data, Params> {
  pagination: Pagination;
}

export type PaginatedResourceResult<
  Data,
  Params extends PaginatedQueryParams<Params>,
> =
  | PaginatedResourceResultInitialError<Data, Params>
  | PaginatedResourceResultInitialLoading<Data, Params>
  | PaginatedResourceResultLoaded<Data, Params>;

export function usePaginatedResource<
  Result,
  Params extends PaginatedQueryParams<Params>,
>(
  createQuery: (initialParams: Params) => Query<Result, Params>,
  options: UsePaginatedResourceOptions<Params>,
  deps: any[],
): PaginatedResourceResult<Result, Params> {
  const result = useResource(createQuery, options, deps);
  const total = result.meta?.total;
  const limit = result.queryInfo?.limit;

  const pagination = useMemo<Pagination | undefined>(() => {
    if (total === undefined) return undefined;

    return {
      totalPages: limit ? Math.ceil(total / limit) : 1,
    };
  }, [total, limit]);

  return useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ({ ...result, pagination }) as PaginatedResourceResult<Result, Params>,
    [result, pagination],
  );
}
