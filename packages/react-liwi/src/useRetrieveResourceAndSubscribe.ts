import type {
  Query,
  QueryParams,
  QuerySubscription,
} from "liwi-resources-client";
import type { Changes, InitialChange, QueryInfo, QueryMeta } from "liwi-store";
import { Logger } from "nightingale-logger";
import { useEffect, useMemo, useReducer, useRef } from "react";
import type { ApplyChanges } from "./applyChanges/ApplyChanges";
import { applyCollectionChanges } from "./applyChanges/applyCollectionChanges.ts";
import { applySingleItemChanges } from "./applyChanges/applySingleItemChanges.ts";
import type { ResourceResult } from "./createResourceResultFromState";
import { createResourceResultFromState } from "./createResourceResultFromState.ts";
import type {
  Action,
  ResourceReducerInitializerReturn,
  State,
} from "./reducer";
import reducer, { initReducer } from "./reducer.ts";
import { useVisibilityChangeSubscriber } from "./utils/useVisibilityChangeSubscriber.ts";

export interface UseResourceAndSubscribeOptions {
  visibleTimeout: number;
}

const defaultOptions = {
  visibleTimeout: 1000 * 60 * 2, // 2 minutes
};

const logger = new Logger("react-liwi:useResourceAndSubscribe");

const isInitial = <Result>(
  changes: Changes<any, Result>,
): changes is [InitialChange<Result>] =>
  changes.length === 1 && changes[0]?.type === "initial";

export function useRetrieveResourceAndSubscribe<
  Result,
  Params extends QueryParams<Params>,
>(
  createQuery: (initialParams: Params) => Query<Result, Params>,
  params: Params,
  skip: boolean,
  deps: any[],
  { visibleTimeout }: UseResourceAndSubscribeOptions = defaultOptions,
): ResourceResult<Result, Params> {
  const visibilityChangeSubscriber = useVisibilityChangeSubscriber();
  const querySubscriptionRef = useRef<QuerySubscription | undefined>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const changeParamsRef = useRef<((params: Params) => void) | undefined>(
    undefined,
  );

  const skipRef = useRef(skip);
  skipRef.current = skip;

  const unsubscribe = (): void => {
    logger.info("unsubscribe");

    // reset timeout to allow resubscribing
    timeoutRef.current = undefined;

    if (querySubscriptionRef.current) {
      querySubscriptionRef.current.stop();
      querySubscriptionRef.current = undefined;
    }
  };

  const [state, dispatch] = useReducer<
    State<Result, Params>,
    () => ResourceReducerInitializerReturn<Result, Params>,
    [Action<Result>]
  >(
    reducer,
    () => {
      const query = createQuery(params);
      let applyChanges: ApplyChanges<Result, any>;

      let currentResult: Result | undefined;
      let currentMeta: QueryMeta | undefined;
      let currentQueryInfo: QueryInfo<any> | undefined;

      return {
        query,
        promise: new Promise((resolve, reject) => {
          const queryLogger = logger.context({
            resourceName: (query as any).resourceName,
            key: (query as any).key,
          });
          queryLogger.debug("init");

          const subscribe = (): void => {
            queryLogger.debug("subscribing", {
              querySubscriptionRef: querySubscriptionRef.current,
              timeoutRef: timeoutRef.current,
            });
            querySubscriptionRef.current = query.fetchAndSubscribe(
              (err: Error | null, changes: Changes<any, Result>) => {
                queryLogger.debug("received changes", { err, changes });

                if (err) {
                  dispatch({ type: "error", error: err });
                  return;
                }

                if (!currentResult && isInitial(changes)) {
                  const initialChange: InitialChange = changes[0];
                  currentResult = initialChange.initial;
                  currentMeta = initialChange.meta;
                  currentQueryInfo = initialChange.queryInfo;
                  dispatch({
                    type: "resolve",
                    result: initialChange.initial,
                    meta: initialChange.meta,
                    queryInfo: currentQueryInfo,
                  });
                  applyChanges = (
                    Array.isArray(initialChange.initial)
                      ? applyCollectionChanges
                      : applySingleItemChanges
                  ) as ApplyChanges<Result, any>;
                }
                // if a change happen before the initial result, applyChanges will be undefined
                else if (applyChanges && currentMeta && currentQueryInfo) {
                  const queryInfo = currentQueryInfo;
                  const { state: newResult, meta: newMeta } = applyChanges(
                    currentResult,
                    changes,
                    currentMeta,
                    queryInfo,
                  );

                  if (newResult && newResult !== currentResult) {
                    currentResult = newResult;
                    currentMeta = newMeta;
                    dispatch({
                      type: "resolve",
                      result: newResult,
                      meta: newMeta,
                      queryInfo,
                    });
                  }
                }
              },
            );
            querySubscriptionRef.current.then(
              () => {
                queryLogger.success("subscribed");
              },
              (error: any) => {
                dispatch({ type: "error", error });
              },
            );
          };

          changeParamsRef.current = (changedParams: Params): void => {
            queryLogger.info("change params", {
              skip: skipRef.current,
              params: changedParams,
            });

            if (querySubscriptionRef.current) {
              querySubscriptionRef.current.stop();
            }

            query.changeParams(changedParams);

            if (!document.hidden && !skipRef.current) {
              dispatch({ type: "fetching" });
              subscribe();
            }
          };

          const handleVisibilityChange = (): void => {
            if (skipRef.current) return;
            if (!document.hidden) {
              if (timeoutRef.current !== undefined) {
                queryLogger.debug("timeout cleared");
                clearTimeout(timeoutRef.current);
                timeoutRef.current = undefined;
              } else if (!querySubscriptionRef.current) {
                queryLogger.info("resubscribe");
                dispatch({ type: "fetching" });
                subscribe();
              }
              return;
            }

            if (querySubscriptionRef.current === undefined) return;

            queryLogger.debug("timeout visible");
            timeoutRef.current = setTimeout(unsubscribe, visibleTimeout);
          };

          visibilityChangeSubscriber.subscribe(handleVisibilityChange);

          if (!document.hidden && !skipRef.current) {
            subscribe();
          }
        }),
      };
    },
    initReducer,
  );

  const firstEffectChangeParams = useRef(false);

  useEffect(() => {
    if (!firstEffectChangeParams.current) {
      firstEffectChangeParams.current = true;
      return;
    }

    if (changeParamsRef.current) {
      changeParamsRef.current(params);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, ...deps]);

  useEffect(() => {
    return () => {
      visibilityChangeSubscriber.unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }

      unsubscribe();
    };
  }, [visibilityChangeSubscriber]);

  return useMemo(() => createResourceResultFromState(state), [state]);
}
