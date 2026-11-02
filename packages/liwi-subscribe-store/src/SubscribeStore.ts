import {
  DeletedAfterUpdateError,
  NotFoundError,
  resolveAllowingNotFound,
} from "liwi-store";
import type {
  AbstractConnection,
  AbstractStoreCursor,
  AllowNotFoundOptions,
  AllowedKeyValue,
  BaseModel,
  CreateQueryOptions,
  Criteria,
  InsertType,
  OptionalBaseModelKeysForInsert,
  PartialUpdateOptions,
  PartialUpdateResult,
  QueryParams,
  ResultAllowingNotFound,
  Sort,
  Store as StoreInterface,
  SubscribableStore,
  SubscribableStoreQuery,
  TouchUpdatedOptions,
  Update,
  UpsertPartialObject,
  UpsertResult,
} from "liwi-store";

/**
 * `changed`: documents written elsewhere (another process), re-read by key; a key
 * missing from `next` was deleted. `resync`: notifications may have been missed,
 * every subscription must refetch.
 */
export type Actions<Model> =
  | { type: "changed"; keys: AllowedKeyValue[]; next: Model[] }
  | { type: "deleted"; prev: Model[] }
  | { type: "inserted"; next: Model[] }
  | { type: "resync" }
  | { type: "updated"; changes: [Model, Model][] };

export type Listener<Model> = (action: Actions<Model>) => unknown;

export type ChangedKeysListener<KeyValue extends AllowedKeyValue> = (
  keys: KeyValue[],
) => unknown;

const getActionKeys = <Model, KeyValue extends AllowedKeyValue>(
  action: Actions<Model>,
  getKey: (model: Model) => KeyValue,
): KeyValue[] => {
  switch (action.type) {
    case "deleted":
      return action.prev.map(getKey);
    case "inserted":
      return action.next.map(getKey);
    case "updated":
      return action.changes.map(([, next]) => getKey(next));
    // written elsewhere: relaying them back would loop between two relays
    case "changed":
    case "resync":
      return [];
    default:
      throw new Error("Unsupported action type");
  }
};

const createNotFoundError = (key: unknown): NotFoundError =>
  new NotFoundError(`Document not found: ${String(key)}`);

export default class SubscribeStore<
  KeyPath extends keyof Model,
  KeyValue extends AllowedKeyValue,
  Model extends BaseModel & Record<KeyPath, KeyValue>,
  ModelInsertType extends InsertType<Model, KeyPath>,
  Connection extends AbstractConnection,
  Store extends SubscribableStore<
    KeyPath,
    KeyValue,
    Model,
    ModelInsertType,
    Connection
  >,
> implements StoreInterface<
  KeyPath,
  KeyValue,
  Model,
  ModelInsertType,
  Connection
> {
  private readonly store: Store;

  private readonly listeners = new Set<Listener<Model>>();

  readonly keyPath: KeyPath;

  constructor(store: Store) {
    this.store = store;
    this.keyPath = store.keyPath;
  }

  get connection(): Connection {
    return this.store.connection;
  }

  subscribe(callback: Listener<Model>): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * The keys of every document written through this store, not those notified
   * with `notifyChanged`. Like any listener, it makes writes read their `prev`.
   */
  subscribeChangedKeys(callback: ChangedKeysListener<KeyValue>): () => void {
    return this.subscribe((action) => {
      const keys = getActionKeys(action, (model) => model[this.keyPath]);
      if (keys.length > 0) callback(keys);
    });
  }

  callSubscribed(action: Actions<Model>): void {
    this.listeners.forEach((listener) => listener(action));
  }

  /**
   * For documents written outside this store, by another process: re-reads them
   * and emits `changed`. `next` is only a hint of who is concerned: a query
   * subscription holding one of the keys, or matching one of the documents,
   * re-reads them in its own order, so a notification repeated, late or crossing
   * a local write is harmless.
   */
  async notifyChanged(keys: KeyValue[]): Promise<void> {
    if (keys.length === 0 || !this.hasListeners()) return;
    const next = await this.store.findAll({
      [this.keyPath]: { $in: keys },
    } as Criteria<Model>);
    this.callSubscribed({ type: "changed", keys, next });
  }

  /** Every subscription refetches and sends its whole result again. */
  resync(): void {
    this.callSubscribed({ type: "resync" });
  }

  /**
   * Nobody needs `prev` without listeners: writes then go straight to the wrapped
   * store, skipping the per-document reads and loops.
   */
  private hasListeners(): boolean {
    return this.listeners.size > 0;
  }

  private async findKeys(criteria: Criteria<Model>): Promise<KeyValue[]> {
    const cursor = await this.store.cursor(criteria);
    const keys: KeyValue[] = [];
    await cursor.forEach((model) => {
      keys.push(model[this.keyPath]);
    });
    return keys;
  }

  private async replaceOneAndGetChange(
    object: Model,
  ): Promise<[Model, Model] | undefined> {
    if (this.store.replaceOneWithInfo) {
      const result = await this.store.replaceOneWithInfo(object);
      return result && [result.prev, result.next];
    }
    const prev = await this.store.findByKey(object[this.keyPath]);
    if (!prev) return undefined;
    const next = await this.store.replaceOne(object, { allowNotFound: true });
    return next && [prev, next];
  }

  private async partialUpdateByKeyAndGetResult(
    key: KeyValue,
    partialUpdate: Update<Model>,
    criteria?: Criteria<Model>,
    options?: PartialUpdateOptions,
  ): Promise<PartialUpdateResult<Model> | undefined> {
    if (this.store.partialUpdateByKeyWithInfo) {
      return this.store.partialUpdateByKeyWithInfo(
        key,
        partialUpdate,
        criteria,
        options,
      );
    }
    const prev = await this.store.findOne({
      [this.keyPath]: key,
      ...criteria,
    });
    if (!prev) return undefined;
    return {
      prev,
      next: await this.store.partialUpdateByKey(
        key,
        partialUpdate,
        criteria,
        options,
      ),
    };
  }

  private async deleteByKeyAndGetPrev(
    key: KeyValue,
    criteria?: Criteria<Model>,
  ): Promise<Model | undefined> {
    if (this.store.deleteByKeyWithInfo) {
      const result = await this.store.deleteByKeyWithInfo(key, criteria);
      return result?.prev;
    }
    const prev = await this.store.findByKey(key, criteria);
    if (!prev) return undefined;
    await this.store.deleteByKey(key, criteria);
    return prev;
  }

  createQuerySingleItem<
    Result extends Record<KeyPath, KeyValue>,
    Params extends QueryParams<Params>,
  >(
    options: CreateQueryOptions<Model, Result>,
  ): SubscribableStoreQuery<
    KeyPath,
    KeyValue,
    Model,
    SubscribableStore<KeyPath, KeyValue, Model, ModelInsertType, Connection>,
    Result,
    Params
  > {
    const query: SubscribableStoreQuery<
      KeyPath,
      KeyValue,
      Model,
      SubscribableStore<KeyPath, KeyValue, Model, ModelInsertType, Connection>,
      Result,
      Params
    > = this.store.createQuerySingleItem<Result, Params>(options);
    query.setSubscribeStore(this);
    return query;
  }

  createQueryCollection<
    Item extends Record<KeyPath, KeyValue>,
    Params extends QueryParams<Params>,
  >(
    options: CreateQueryOptions<Model, Item>,
  ): SubscribableStoreQuery<
    KeyPath,
    KeyValue,
    Model,
    SubscribableStore<KeyPath, KeyValue, Model, ModelInsertType, Connection>,
    Item[],
    Params
  > {
    const query: SubscribableStoreQuery<
      KeyPath,
      KeyValue,
      Model,
      SubscribableStore<KeyPath, KeyValue, Model, ModelInsertType, Connection>,
      Item[],
      Params
    > = this.store.createQueryCollection<Item, Params>(options);
    query.setSubscribeStore(this);
    return query;
  }

  findAll(criteria?: Criteria<Model>, sort?: Sort<Model>): Promise<Model[]> {
    return this.store.findAll(criteria, sort);
  }

  findByKey(
    key: KeyValue,
    criteria?: Criteria<Model>,
  ): Promise<Model | undefined> {
    return this.store.findByKey(key, criteria);
  }

  findOne(
    criteria: Criteria<Model>,
    sort?: Sort<Model>,
  ): Promise<Model | undefined> {
    return this.store.findOne(criteria, sort);
  }

  async insertOne(object: ModelInsertType): Promise<Model> {
    const inserted = await this.store.insertOne(object);
    this.callSubscribed({ type: "inserted", next: [inserted] });
    return inserted;
  }

  async replaceOne<
    Options extends AllowNotFoundOptions | undefined = undefined,
  >(
    object: Model,
    options?: Options,
  ): Promise<ResultAllowingNotFound<Model, Options>> {
    if (!this.hasListeners()) return this.store.replaceOne(object, options);

    const change = await this.replaceOneAndGetChange(object);
    if (change) this.callSubscribed({ type: "updated", changes: [change] });
    return resolveAllowingNotFound(change?.[1], options, () =>
      createNotFoundError(object[this.keyPath]),
    );
  }

  async replaceSeveral(objects: Model[]): Promise<Model[]> {
    if (!this.hasListeners()) return this.store.replaceSeveral(objects);

    const results = await Promise.allSettled(
      objects.map(async (object) => {
        const change = await this.replaceOneAndGetChange(object);
        if (!change) throw createNotFoundError(object[this.keyPath]);
        return change;
      }),
    );
    const changes = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    if (changes.length > 0) this.callSubscribed({ type: "updated", changes });

    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failure) throw failure.reason;
    return changes.map(([, next]) => next);
  }

  async upsertOne<
    K extends Exclude<keyof Model, KeyPath | OptionalBaseModelKeysForInsert>,
  >(
    object: UpsertPartialObject<KeyPath, KeyValue, Model, K>,
    setOnInsertPartialObject?: Update<Model>["$setOnInsert"],
  ): Promise<Model> {
    const result = await this.upsertOneWithInfo(
      object,
      setOnInsertPartialObject,
    );
    return result.object;
  }

  async upsertOneWithInfo<
    K extends Exclude<keyof Model, KeyPath | OptionalBaseModelKeysForInsert>,
  >(
    object: UpsertPartialObject<KeyPath, KeyValue, Model, K>,
    setOnInsertPartialObject?: Update<Model>["$setOnInsert"],
  ): Promise<UpsertResult<Model>> {
    const upsertedWithInfo = await this.store.upsertOneWithInfo(
      object,
      setOnInsertPartialObject,
    );
    if (upsertedWithInfo.resolvedAs === "inserted") {
      this.callSubscribed({
        type: "inserted",
        next: [upsertedWithInfo.object],
      });
    } else {
      this.callSubscribed({
        type: "updated",
        changes: [[upsertedWithInfo.prev, upsertedWithInfo.object]],
      });
    }
    return upsertedWithInfo;
  }

  async partialUpdateByKey<
    Options extends PartialUpdateOptions | undefined = undefined,
  >(
    key: KeyValue,
    partialUpdate: Update<Model>,
    criteria?: Criteria<Model>,
    options?: Options,
  ): Promise<ResultAllowingNotFound<Model, Options>> {
    if (!this.hasListeners()) {
      return this.store.partialUpdateByKey(
        key,
        partialUpdate,
        criteria,
        options,
      );
    }

    const result = await this.partialUpdateByKeyAndGetResult(
      key,
      partialUpdate,
      criteria,
      options,
    );
    if (result?.next) {
      this.callSubscribed({
        type: "updated",
        changes: [[result.prev, result.next]],
      });
    }
    return resolveAllowingNotFound(result?.next, options, () =>
      result
        ? new DeletedAfterUpdateError(
            `Document deleted after update: ${String(key)}`,
          )
        : createNotFoundError(key),
    );
  }

  partialUpdateOne<
    Options extends PartialUpdateOptions | undefined = undefined,
  >(
    object: Model,
    partialUpdate: Update<Model>,
    options?: Options,
  ): Promise<ResultAllowingNotFound<Model, Options>> {
    return this.partialUpdateByKey(
      object[this.keyPath],
      partialUpdate,
      undefined,
      options,
    );
  }

  /**
   * Without listeners, one command on the wrapped store. With listeners, the keys
   * matching `criteria` are read first, then each document is updated on its own
   * (re-checking `criteria`) so that every change carries its true `prev`: N + 1
   * round trips. A document inserted after the keys were read is not updated.
   */
  async partialUpdateMany(
    criteria: Criteria<Model>,
    partialUpdate: Update<Model>,
    options?: TouchUpdatedOptions,
  ): Promise<void> {
    if (!this.hasListeners()) {
      await this.store.partialUpdateMany(criteria, partialUpdate, options);
      return;
    }

    const keys = await this.findKeys(criteria);
    const changes: [Model, Model][] = [];

    try {
      for (const key of keys) {
        const result = await this.partialUpdateByKeyAndGetResult(
          key,
          partialUpdate,
          criteria,
          options,
        );
        if (result?.next) changes.push([result.prev, result.next]);
      }
    } finally {
      if (changes.length > 0) this.callSubscribed({ type: "updated", changes });
    }
  }

  async deleteByKey(key: KeyValue, criteria?: Criteria<Model>): Promise<void> {
    if (!this.hasListeners()) {
      await this.store.deleteByKey(key, criteria);
      return;
    }

    const prev = await this.deleteByKeyAndGetPrev(key, criteria);
    if (!prev) return;
    this.callSubscribed({ type: "deleted", prev: [prev] });
  }

  deleteOne(object: Model): Promise<void> {
    return this.deleteByKey(object[this.keyPath]);
  }

  /**
   * Without listeners, one command on the wrapped store. With listeners and a store
   * implementing `deleteByKeyWithInfo`, the keys matching `criteria` are read first,
   * then each document is deleted on its own (re-checking `criteria`), so that the
   * emitted documents are exactly the deleted ones: N + 1 round trips. A document
   * inserted after the keys were read is not deleted.
   */
  async deleteMany(criteria: Criteria<Model>): Promise<void> {
    if (!this.hasListeners()) {
      await this.store.deleteMany(criteria);
      return;
    }

    if (!this.store.deleteByKeyWithInfo) {
      const cursor = await this.store.cursor(criteria);
      const prev: Model[] = await cursor.toArray();
      await this.store.deleteMany(criteria);
      this.callSubscribed({ type: "deleted", prev });
      return;
    }

    const keys = await this.findKeys(criteria);
    const prev: Model[] = [];

    try {
      for (const key of keys) {
        const result = await this.store.deleteByKeyWithInfo(key, criteria);
        if (result) prev.push(result.prev);
      }
    } finally {
      if (prev.length > 0) this.callSubscribed({ type: "deleted", prev });
    }
  }

  async count(criteria?: Criteria<Model>): Promise<number> {
    return this.store.count(criteria);
  }

  async cursor<Result extends Partial<Model> = Model>(
    criteria?: Criteria<Model>,
    sort?: Sort<Model>,
  ): Promise<AbstractStoreCursor<any, KeyValue, Model, Result>> {
    const cursor = await this.store.cursor<Result>(criteria, sort);
    cursor.overrideStore(this);
    return cursor;
  }
}
