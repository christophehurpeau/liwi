import type AbstractConnection from "./AbstractConnection.ts";
import type { QueryParams } from "./Query.ts";
import type { Store } from "./Store.ts";
import type { SubscribableStoreQuery } from "./SubscribableStoreQuery.ts";
import type {
  AllowedKeyValue,
  BaseModel,
  CreateQueryOptions,
  InsertType,
} from "./types.ts";

export interface SubscribableStore<
  KeyPath extends keyof Model,
  KeyValue extends AllowedKeyValue,
  Model extends BaseModel & Record<KeyPath, KeyValue>,
  ModelInsertType extends InsertType<Model, KeyPath>,
  Connection extends AbstractConnection,
> extends Store<KeyPath, KeyValue, Model, ModelInsertType, Connection> {
  createQuerySingleItem: <
    Result extends Record<KeyPath, KeyValue>,
    Params extends QueryParams<Params>,
  >(
    options: CreateQueryOptions<Model, Result>,
  ) => SubscribableStoreQuery<KeyPath, KeyValue, Model, any, Result, Params>;

  createQueryCollection: <
    Item extends Record<KeyPath, KeyValue>,
    Params extends QueryParams<Params>,
  >(
    options: CreateQueryOptions<Model, Item>,
  ) => SubscribableStoreQuery<KeyPath, KeyValue, Model, any, Item[], Params>;
}
