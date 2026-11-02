import type {
  AllowedKeyValue,
  BaseModel,
  InsertType,
  Query,
  QueryParams,
  QueryResult,
  QuerySubscription,
  SubscribeCallback,
} from "liwi-store";
import type SubscribeStore from "./SubscribeStore.ts";

export default abstract class AbstractSubscribableStoreQuery<
  KeyPath extends keyof Model,
  KeyValue extends AllowedKeyValue,
  Model extends BaseModel & Record<KeyPath, KeyValue>,
  ModelInsertType extends InsertType<Model, KeyPath>,
  Params extends QueryParams<Params> = never,
  Result = Model,
> implements Query<Result, Params, KeyValue> {
  changeParams(params: Params): never {
    throw new Error("Method not supported. Please create a new query.");
  }

  changePartialParams(
    params: Params extends undefined ? never : Partial<Params>,
  ): never {
    throw new Error("Method not supported. Please create a new query.");
  }

  private _subscribeStore?: SubscribeStore<
    KeyPath,
    KeyValue,
    Model,
    ModelInsertType,
    any,
    any
  >;

  setSubscribeStore(
    store: SubscribeStore<KeyPath, KeyValue, Model, ModelInsertType, any, any>,
  ): void {
    this._subscribeStore = store;
  }

  getSubscribeStore(): SubscribeStore<
    KeyPath,
    KeyValue,
    Model,
    ModelInsertType,
    any,
    any
  > {
    if (!this._subscribeStore) {
      throw new Error("_subscribeStore is not initialized");
    }
    return this._subscribeStore;
  }

  abstract fetch<T>(
    onFulfilled: (result: QueryResult<Result>) => T,
  ): Promise<T>;

  fetchAndSubscribe(
    callback: SubscribeCallback<KeyValue, Result>,
  ): QuerySubscription {
    return this._subscribe(callback, true);
  }

  subscribe(callback: SubscribeCallback<KeyValue, Result>): QuerySubscription {
    return this._subscribe(callback, false);
  }

  abstract _subscribe(
    callback: SubscribeCallback<KeyValue, Result>,
    _includeInitial: boolean,
  ): QuerySubscription;
}
