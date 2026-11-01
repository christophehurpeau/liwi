import type { StoreRelayBatch, StoreRelayService } from "liwi-resources";
import type { AllowedKeyValue } from "liwi-store";
import type { TransportClient } from "./TransportClient.ts";
import { createResourceClientService } from "./createResourceClientService.ts";

/** A `SubscribeStore` of `liwi-subscribe-store` satisfies it. */
export interface RelayTargetStore<
  KeyValue extends AllowedKeyValue = AllowedKeyValue,
> {
  notifyChanged: (keys: KeyValue[]) => Promise<void>;
  resync: () => void;
}

export interface StoreRelayState {
  /** the producer listens and nothing was missed since the last resync, as far as the transport knows */
  isLive: boolean;
  /** last batch or heartbeat: compare it with the producer's heartbeat interval to detect a half-open connection */
  lastMessageAt: Date | null;
}

export interface ConnectStoreRelayOptions {
  /** connected by the caller; a reconnection resyncs every store */
  transportClient: TransportClient;
  /** the name the producer's `createStoreRelayResource` is served under */
  resourceName: string;
  /** keyed by the names the producer uses; the keys are trusted to be of each store's type */
  stores: Record<string, RelayTargetStore<any>>;
  onStateChange?: (state: StoreRelayState) => void;
  onError: (error: unknown) => void;
}

export interface StoreRelayConnection {
  getState: () => StoreRelayState;
  close: () => void;
}

/**
 * Feeds `stores` with the writes of another process, exposed there with
 * `createStoreRelayResource` (`liwi-resources-server`). Writes made while
 * disconnected are lost: every `initial`, sent on each (re)subscription, resyncs
 * every store instead. Once the transport is `closed` (`close()`, or a failure it
 * does not retry), the relay is over: `onError` is told, connect a new one.
 */
export const connectStoreRelay = ({
  transportClient,
  resourceName,
  stores,
  onStateChange,
  onError,
}: ConnectStoreRelayOptions): StoreRelayConnection => {
  const relayService = createResourceClientService<StoreRelayService>(
    resourceName,
    { queries: { queryChanges: null }, operations: {} },
  )(transportClient);

  let state: StoreRelayState = { isLive: false, lastMessageAt: null };
  const setState = (patch: Partial<StoreRelayState>): void => {
    state = { ...state, ...patch };
    onStateChange?.(state);
  };

  const resyncStores = (): void => {
    Object.values(stores).forEach((store) => {
      store.resync();
    });
  };

  const applyBatches = (batches: StoreRelayBatch[]): void => {
    batches.forEach(({ store: storeName, keys }) => {
      const store = stores[storeName];
      if (!store) {
        onError(new Error(`Unknown relayed store: ${storeName}`));
        return;
      }
      store
        .notifyChanged(keys.map((key) => JSON.parse(key) as AllowedKeyValue))
        .catch(onError);
    });
  };

  const subscription = relayService.queries
    .queryChanges({})
    .fetchAndSubscribe((error, changes) => {
      if (error) {
        onError(error);
        return;
      }
      changes.forEach((change) => {
        if (change.type === "initial") {
          resyncStores();
          setState({ isLive: true });
        } else if (change.type === "inserted") {
          applyBatches(change.result);
        }
      });
      setState({ lastMessageAt: new Date() });
    });
  subscription.then(undefined, onError);

  const stopListeningState = transportClient.listenStateChange((newState) => {
    if (newState !== "connected" && state.isLive) setState({ isLive: false });
    if (newState === "closed") {
      onError(
        new Error("Store relay transport closed: no more changes will arrive"),
      );
    }
  });

  return {
    getState: () => state,
    close: () => {
      stopListeningState();
      subscription.stop();
    },
  };
};
