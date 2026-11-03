import type {
  Query,
  QueryMeta,
  QueryParams,
  ResourcesServerError,
} from "liwi-resources-client";
import type { QueryInfo } from "liwi-store";
import type { State } from "./reducer.ts";

export interface ResourceResultInitialLoading<
  Data,
  Params extends QueryParams<Params>,
> {
  query: Query<Data, Params>;
  initialLoading: true;
  initialError: false;
  fetched: false;
  fetching: true;
  data: undefined;
  meta: undefined;
  queryInfo: undefined;
  error: undefined;
}

export interface ResourceResultInitialError<
  Data,
  Params extends QueryParams<Params>,
> {
  query: Query<Data, Params>;
  initialLoading: false;
  initialError: true;
  fetched: false;
  fetching: false;
  data: undefined;
  meta: undefined;
  queryInfo: undefined;
  error: Error | ResourcesServerError;
}

export interface ResourceResultLoaded<
  Data,
  Params extends QueryParams<Params>,
> {
  query: Query<Data, Params>;
  initialLoading: false;
  initialError: false;
  fetched: true;
  fetching: boolean;
  data: Data;
  meta: QueryMeta;
  queryInfo: QueryInfo<any>;
  error: Error | ResourcesServerError | undefined;
}

export type ResourceResult<Data, Params extends QueryParams<Params>> =
  | ResourceResultInitialError<Data, Params>
  | ResourceResultInitialLoading<Data, Params>
  | ResourceResultLoaded<Data, Params>;

export const createResourceResultFromState = <
  Result,
  Params extends QueryParams<Params>,
>(
  state: State<Result, Params>,
): ResourceResult<Result, Params> =>
  // oxlint-disable-next-line typescript/consistent-type-assertions
  ({
    query: state.query,
    initialLoading: !state.fetched && state.fetching,
    initialError: !state.fetched && !!state.error,
    fetched: state.fetched,
    fetching: state.fetching,
    data: !state.fetched ? undefined : state.result,
    meta: !state.fetched ? undefined : state.meta,
    queryInfo: !state.fetched ? undefined : state.queryInfo,
    error: state.error,
  }) as ResourceResult<Result, Params>;
