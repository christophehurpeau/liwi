import type {
  Query,
  QueryParams,
  ResourcesServerError,
} from "liwi-resources-client";
import type { QueryInfo, QueryMeta } from "liwi-store";
import type { Reducer } from "react";

export interface InitialState<Result, Params extends QueryParams<Params>> {
  fetched: false;
  fetching: true;
  query: Query<Result, Params>;
  result: undefined;
  meta: undefined;
  queryInfo: undefined;
  promise?: Promise<void>;
  error: undefined;
}

export interface InitialErrorState<Result, Params extends QueryParams<Params>> {
  fetched: false;
  fetching: boolean;
  query: Query<Result, Params>;
  result: undefined;
  meta: undefined;
  queryInfo: undefined;
  promise?: Promise<void>;
  error: Error | ResourcesServerError;
}

export interface FetchedState<Result, Params extends QueryParams<Params>> {
  fetched: true;
  fetching: boolean;
  query: Query<Result, Params>;
  result: Result;
  meta: QueryMeta;
  queryInfo: QueryInfo<any>;
  promise?: Promise<void>;
  error: Error | ResourcesServerError | undefined;
}

export interface InitAction {
  type: "init";
}

export interface FetchingAction {
  type: "fetching";
}

export interface RefetchAction {
  type: "refetch";
  promise: Promise<void>;
}

export interface ResolveAction<Result> {
  type: "resolve";
  result: Result;
  meta: QueryMeta;
  queryInfo: QueryInfo<any>;
}
export interface ErrorAction {
  type: "error";
  error: Error | ResourcesServerError;
}

export type Action<Result> =
  | ErrorAction
  | FetchingAction
  | RefetchAction
  | ResolveAction<Result>;
export type State<Result, Params extends QueryParams<Params>> =
  | FetchedState<Result, Params>
  | InitialErrorState<Result, Params>
  | InitialState<Result, Params>;
export type ResourceReducer<
  Result,
  Params extends QueryParams<Params>,
> = Reducer<State<Result, Params>, Action<Result>>;
export interface ResourceReducerInitializerReturn<
  Result,
  Params extends QueryParams<Params>,
> {
  query: Query<Result, Params>;
  promise?: Promise<void>;
}

export function initReducer<Result, Params extends QueryParams<Params>>(
  initializer: () => ResourceReducerInitializerReturn<Result, Params>,
): InitialState<Result, Params> {
  const init = initializer();
  const { query, promise } = init;
  return {
    fetched: false,
    fetching: true,
    query,
    result: undefined,
    meta: undefined,
    queryInfo: undefined,
    promise,
    error: undefined,
  };
}

export default function reducer<Result, Params extends QueryParams<Params>>(
  state: State<Result, Params>,
  action: Action<Result>,
): State<Result, Params> {
  switch (action.type) {
    case "resolve":
      return {
        fetched: true,
        fetching: false,
        query: state.query,
        result: action.result,
        meta: action.meta,
        queryInfo: action.queryInfo,
        error: undefined,
      };
    case "refetch":
      // oxlint-disable-next-line typescript/consistent-type-assertions
      return {
        fetched: state.fetched,
        fetching: true,
        query: state.query,
        result: state.result,
        meta: state.meta,
        queryInfo: state.queryInfo,
        promise: action.promise,
        error: state.error,
      } as FetchedState<Result, Params> | InitialState<Result, Params>;
    case "fetching":
      return {
        ...state,
        fetching: true,
      };
    case "error":
      return {
        ...state,
        fetching: false,
        error: action.error,
      };
    default:
      throw new Error("Invalid action");
  }
}
