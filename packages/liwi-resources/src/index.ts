import type { ExtendedJsonValue } from "extended-json";
import type { Query, QueryParams } from "liwi-store";

export type {
  Query,
  QuerySubscription,
  QueryParams,
  QueryResult,
  QueryMeta,
  SubscribeCallback,
} from "liwi-store";

export interface ResourceSubscribePayload<Options> {
  resourceName: string;
  type: string;
  args: Options;
}

export type ServiceQuery<Result, Params extends QueryParams<Params>> = (
  params: Params,
) => Query<Result, Params>;

export type ServiceOperation<
  Result extends Promise<any>,
  Params extends QueryParams<Params>,
> = (params: Params) => Result;

type InferQueryResult<T> = T extends Query<infer R, any> ? R : never;

type ServiceInterfaceQueries<
  Queries extends Record<keyof Queries, ServiceQuery<any, any>>,
> = {
  [key in keyof Queries]: (
    params: QueryParams<Parameters<Queries[key]>[0]>,
  ) => Query<
    InferQueryResult<ReturnType<Queries[key]>>,
    QueryParams<Parameters<Queries[key]>[0]>
  >;
};

type ServiceInterfaceOperations<
  Operations extends Record<keyof Operations, ServiceOperation<any, any>>,
> = {
  [key in keyof Operations]: (
    params: QueryParams<Parameters<Operations[key]>[0]>,
  ) => ReturnType<Operations[key]>;
};

export interface ServiceInterface<
  Queries extends ServiceInterfaceQueries<Queries>,
  Operations extends ServiceInterfaceOperations<Operations>,
> {
  queries: Queries;
  operations: Operations;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type AckError = {
  code: string;
  message: string;
};

export type ToClientMessage<T = ExtendedJsonValue> = [
  "ack" | "subscription", // type
  number, // id
  AckError | null, // error
  T, // result
];

export interface DoPayload {
  resourceName: string;
  operationKey: string;
  params: Record<string, ExtendedJsonValue> | undefined;
}

export interface ToServerQueryPayload<Key extends string = string> {
  resourceName: string;
  key: Key;
  params: Record<string, ExtendedJsonValue> | undefined;
}

export interface ToServerSubscribeQueryPayload<
  Key extends string = string,
> extends ToServerQueryPayload<Key> {
  subscriptionId: number;
}

export interface ToServerSubscribeClose {
  subscriptionId: number;
}

// export type ToServerSubscribeQueryChangePayload = ToServerQueryPayload;

type Message<RequestPayload, ResponsePayload> = [
  RequestPayload,
  ResponsePayload,
];

type SubscribeMessage<
  RequestPayload extends {
    params: Record<string, ExtendedJsonValue> | undefined;
  },
  ResponsePayload,
  SubscribeCallbackMessage,
> = [RequestPayload, ResponsePayload, SubscribeCallbackMessage];

export interface ToServerSimpleMessages {
  do: Message<DoPayload, undefined>;
  fetch: Message<ToServerQueryPayload, unknown>;
  // 'subscribe:changePayload': Message<
  //   ToServerSubscribeClose & Record<string, ExtendedJsonValue | undefined>,
  //   undefined
  // >;
  "subscribe:close": Message<ToServerSubscribeClose, undefined>;
}

export interface ToServerSubscribeMessages<
  // oxlint-disable-next-line no-unused-vars -- kept for public API compatibility
  Params extends Record<keyof Params, ExtendedJsonValue> | undefined = never,
  Result = unknown,
> {
  subscribe: SubscribeMessage<ToServerSubscribeQueryPayload, undefined, Result>;
  fetchAndSubscribe: SubscribeMessage<
    ToServerSubscribeQueryPayload,
    undefined,
    Result
  >;
}

export type ToServerMessages = ToServerSimpleMessages &
  ToServerSubscribeMessages<Record<string, ExtendedJsonValue> | undefined>;

export type ToServerMessage = {
  id: number;
} & ( // eslint-disable-next-line @typescript-eslint/sort-type-constituents
  | {
      type: "do";
      payload: ToServerSimpleMessages["do"][0];
    }
  | {
      type: "fetch";
      payload: ToServerSimpleMessages["fetch"][0];
    }
  // | {
  //     type: 'subscribe:changePayload';
  //     payload: ToServerSimpleMessages['subscribe:changePayload'][0];
  //   }
  | {
      type: "subscribe:close";
      payload: ToServerSimpleMessages["subscribe:close"][0];
    }
  | {
      type: "subscribe";
      payload: ToServerSubscribeMessages["subscribe"][0];
    }
  | {
      type: "fetchAndSubscribe";
      payload: ToServerSubscribeMessages["fetchAndSubscribe"][0];
    }
);

export class ResourcesServerError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ResourcesServerError";
    this.code = code;
  }
}
