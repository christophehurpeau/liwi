import AbstractCursor from "./AbstractCursor.ts";
import type { InternalCommonStoreClient } from "./InternalCommonStoreClient";
import type { AllowedKeyValue, BaseModel } from "./types";

export default abstract class AbstractStoreCursor<
  Store extends InternalCommonStoreClient<Model>,
  KeyValue extends AllowedKeyValue,
  Model extends BaseModel,
  Result extends Partial<Model> = Model,
> extends AbstractCursor<Model, Result> {
  key: KeyValue | undefined;

  protected _store: Store;

  constructor(store: Store) {
    super();
    this._store = store;
  }

  get store(): Store {
    return this._store;
  }

  overrideStore(store: Store): void {
    this._store = store;
  }

  result(): Promise<Result> {
    if (!this.key) throw new Error("Cannot call result() before next()");
    return this.store.findByKey(this.key) as unknown as Promise<Result>;
  }

  delete(): Promise<void> {
    return this.store.deleteByKey(this.key);
  }
}
