import type {
  Query,
  QueryResult,
  QuerySubscription,
  StoreRelayBatch,
  StoreRelayService,
  SubscribeCallback,
} from "liwi-resources";
import { ResourcesServerError } from "liwi-resources";
import type { AllowedKeyValue } from "liwi-store";
import type { ServiceResource } from "./ServiceResource.ts";

/** A `SubscribeStore` of `liwi-subscribe-store` satisfies it. */
export interface RelayedStore {
  subscribeChangedKeys: (
    callback: (keys: AllowedKeyValue[]) => unknown,
  ) => () => void;
}

export interface CreateStoreRelayResourceOptions<LoggedInUser> {
  /** the names are the wire identifiers: the consumer uses the same ones */
  stores: Record<string, RelayedStore>;
  /** the resources server accepts unauthenticated connections: check here who may read the relay */
  authorize: (loggedInUser: LoggedInUser | undefined) => boolean;
  /** an empty batch is sent this often, so the consumer can tell a quiet producer from a dead one */
  heartbeatIntervalMs?: number;
}

type RelayResult = StoreRelayBatch[];

const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;

const emptyQueryResult: QueryResult<RelayResult> = {
  result: [],
  meta: { total: 0 },
  info: { keyPath: "store" },
};

const subscribeToStores = (
  stores: Record<string, RelayedStore>,
  heartbeatIntervalMs: number,
  callback: SubscribeCallback<AllowedKeyValue, RelayResult>,
  includeInitial: boolean,
): QuerySubscription => {
  const pendingKeysByStore = new Map<string, Set<AllowedKeyValue>>();
  let flushTimeout: ReturnType<typeof setTimeout> | undefined;

  const sendBatches = (batches: RelayResult): void => {
    callback(null, [{ type: "inserted", result: batches }]);
  };

  const flush = (): void => {
    flushTimeout = undefined;
    const batches = [...pendingKeysByStore].map(([store, keys]) => ({
      store,
      keys: [...keys].map((key) => JSON.stringify(key)),
    }));
    pendingKeysByStore.clear();
    sendBatches(batches);
  };

  const unsubscribes = Object.entries(stores).map(([name, store]) =>
    store.subscribeChangedKeys((keys) => {
      let pendingKeys = pendingKeysByStore.get(name);
      if (!pendingKeys) {
        pendingKeys = new Set();
        pendingKeysByStore.set(name, pendingKeys);
      }
      keys.forEach((key) => pendingKeys.add(key));
      flushTimeout ??= setTimeout(flush, 0);
    }),
  );

  // sent once listening, so the consumer knows that later writes reach it
  if (includeInitial) {
    callback(null, [
      {
        type: "initial",
        initial: emptyQueryResult.result,
        meta: emptyQueryResult.meta,
        queryInfo: emptyQueryResult.info,
      },
    ]);
  }

  const heartbeatInterval = setInterval(() => {
    sendBatches([]);
  }, heartbeatIntervalMs);

  const stop = (): void => {
    unsubscribes.forEach((unsubscribe) => {
      unsubscribe();
    });
    clearTimeout(flushTimeout);
    clearInterval(heartbeatInterval);
    pendingKeysByStore.clear();
  };

  return {
    stop,
    cancel: stop,
    then: <T, U>(
      onFulfilled: () => Promise<T> | T,
      onRejected?: (error: any) => Promise<U> | U,
    ): Promise<T | U> => Promise.resolve().then(onFulfilled, onRejected),
  };
};

const createChangesQuery = (
  stores: Record<string, RelayedStore>,
  heartbeatIntervalMs: number,
): Query<RelayResult, Record<string, never>> => ({
  changeParams: () => {
    throw new Error("Method not supported.");
  },
  changePartialParams: () => {
    throw new Error("Method not supported.");
  },
  fetch: (onFulfilled) => Promise.resolve(onFulfilled(emptyQueryResult)),
  fetchAndSubscribe: (callback) =>
    subscribeToStores(stores, heartbeatIntervalMs, callback, true),
  subscribe: (callback) =>
    subscribeToStores(stores, heartbeatIntervalMs, callback, false),
});

/**
 * Exposes the keys written through `stores` to another process, which feeds
 * them to its own stores with `connectStoreRelay` (`liwi-resources-client`).
 * Each subscription makes every write to `stores` read its `prev`, like any
 * `SubscribeStore` listener.
 */
export const createStoreRelayResource = <LoggedInUser>({
  stores,
  authorize,
  heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
}: CreateStoreRelayResourceOptions<LoggedInUser>): ServiceResource<
  StoreRelayService,
  LoggedInUser
> => ({
  queries: {
    queryChanges: (params, loggedInUser) => {
      if (!authorize(loggedInUser)) {
        throw new ResourcesServerError(
          "FORBIDDEN",
          "Not allowed to read the store relay",
        );
      }
      return createChangesQuery(stores, heartbeatIntervalMs);
    },
  },
  operations: {},
});
