import type { Query, QueryParams } from "liwi-resources-client";
import type { SetOptional } from "liwi-store";
import type { ResourceResult } from "./createResourceResultFromState.ts";
import { useRetrieveResource } from "./useRetrieveResource.ts";
import type { UseResourceAndSubscribeOptions } from "./useRetrieveResourceAndSubscribe.ts";
import { useRetrieveResourceAndSubscribe } from "./useRetrieveResourceAndSubscribe.ts";

interface UseResourceOptionsRequiredParams<Params extends QueryParams<Params>> {
  params: Params;
  skip?: boolean;
  subscribe?: boolean;
  subscribeOptions?: UseResourceAndSubscribeOptions;
}

export type UseResourceOptions<Params extends QueryParams<Params>> =
  Params extends Record<string, never>
    ? SetOptional<UseResourceOptionsRequiredParams<Params>, "params">
    : UseResourceOptionsRequiredParams<Params>;

// oxlint-disable-next-line unicorn/prefer-global-this
const isSSR = typeof window === "undefined";

export function useResource<Result, Params extends QueryParams<Params>>(
  createQuery: (initialParams: Params) => Query<Result, Params>,
  {
    params,
    skip = false,
    subscribe,
    subscribeOptions,
  }: UseResourceOptions<Params>,
  deps: any[],
): ResourceResult<Result, Params> {
  const result =
    subscribe && !isSSR
      ? // oxlint-disable-next-line react/rules-of-hooks
        useRetrieveResourceAndSubscribe<Result, Params>(
          createQuery,
          params as Params,
          skip,
          deps,
          subscribeOptions,
        )
      : // oxlint-disable-next-line react/rules-of-hooks
        useRetrieveResource<Result, Params>(
          createQuery,
          params as Params,
          skip,
          deps,
        );

  return result;
}
