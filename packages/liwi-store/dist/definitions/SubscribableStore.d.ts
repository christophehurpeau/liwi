import type AbstractConnection from "./AbstractConnection";
import type { QueryParams } from "./Query";
import type { Store } from "./Store";
import type { SubscribableStoreQuery } from "./SubscribableStoreQuery";
import type { AllowedKeyValue, BaseModel, CreateQueryOptions, InsertType } from "./types";
export interface SubscribableStore<KeyPath extends keyof Model, KeyValue extends AllowedKeyValue, Model extends BaseModel & Record<KeyPath, KeyValue>, ModelInsertType extends InsertType<Model, KeyPath>, Connection extends AbstractConnection> extends Store<KeyPath, KeyValue, Model, ModelInsertType, Connection> {
    createQuerySingleItem: <Result extends Record<KeyPath, KeyValue>, Params extends QueryParams<Params>>(options: CreateQueryOptions<Model, Result>) => SubscribableStoreQuery<KeyPath, KeyValue, Model, any, Result, Params>;
    createQueryCollection: <Item extends Record<KeyPath, KeyValue>, Params extends QueryParams<Params>>(options: CreateQueryOptions<Model, Item>) => SubscribableStoreQuery<KeyPath, KeyValue, Model, any, Item[], Params>;
}
//# sourceMappingURL=SubscribableStore.d.ts.map