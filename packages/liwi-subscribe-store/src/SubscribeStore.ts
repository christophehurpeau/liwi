import { DeletedAfterUpdateError, NotFoundError } from "liwi-store";
import type {
  AbstractConnection,
  AbstractStoreCursor,
  AllowedKeyValue,
  BaseModel,
  CreateQueryOptions,
  Criteria,
  InsertType,
  OptionalBaseModelKeysForInsert,
  PartialUpdateResult,
  QueryParams,
  Sort,
  Store as StoreInterface,
  SubscribableStore,
  SubscribableStoreQuery,
  Update,
  UpsertPartialObject,
  UpsertResult,
} from "liwi-store";

export type Actions<Model> =
  | { type: "deleted"; prev: Model[] }
  | { type: "inserted"; next: Model[] }
  | { type: "updated"; changes: [Model, Model][] };

export type Listener<Model> = (action: Actions<Model>) => unknown;

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

  callSubscribed(action: Actions<Model>): void {
    this.listeners.forEach((listener) => listener(action));
  }

  private async replaceOneAndGetChange(object: Model): Promise<[Model, Model]> {
    const key = object[this.keyPath];
    if (this.store.replaceOneWithInfo) {
      const result = await this.store.replaceOneWithInfo(object);
      if (!result) {
        throw new NotFoundError(`Document not found: ${String(key)}`);
      }
      return [result.prev, result.next];
    }
    const prev = await this.store.findByKey(key);
    if (!prev) throw new NotFoundError(`Document not found: ${String(key)}`);
    return [prev, await this.store.replaceOne(object)];
  }

  private async partialUpdateByKeyAndGetResult(
    key: KeyValue,
    partialUpdate: Update<Model>,
    criteria?: Criteria<Model>,
  ): Promise<PartialUpdateResult<Model> | undefined> {
    if (this.store.partialUpdateByKeyWithInfo) {
      return this.store.partialUpdateByKeyWithInfo(
        key,
        partialUpdate,
        criteria,
      );
    }
    const prev = await this.store.findOne({
      [this.keyPath]: key,
      ...criteria,
    });
    if (!prev) return undefined;
    return {
      prev,
      next: await this.store.partialUpdateByKey(key, partialUpdate, criteria),
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

  async replaceOne(object: Model): Promise<Model> {
    const change = await this.replaceOneAndGetChange(object);
    this.callSubscribed({ type: "updated", changes: [change] });
    return change[1];
  }

  async replaceSeveral(objects: Model[]): Promise<Model[]> {
    const results = await Promise.allSettled(
      objects.map((object) => this.replaceOneAndGetChange(object)),
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

  async partialUpdateByKey(
    key: KeyValue,
    partialUpdate: Update<Model>,
    criteria?: Criteria<Model>,
  ): Promise<Model> {
    const result = await this.partialUpdateByKeyAndGetResult(
      key,
      partialUpdate,
      criteria,
    );
    if (!result) throw new NotFoundError(`Document not found: ${String(key)}`);
    if (!result.next) {
      throw new DeletedAfterUpdateError(
        `Document deleted after update: ${String(key)}`,
      );
    }
    this.callSubscribed({
      type: "updated",
      changes: [[result.prev, result.next]],
    });
    return result.next;
  }

  partialUpdateOne(
    object: Model,
    partialUpdate: Update<Model>,
  ): Promise<Model> {
    return this.partialUpdateByKey(object[this.keyPath], partialUpdate);
  }

  async partialUpdateMany(
    criteria: Criteria<Model>,
    partialUpdate: Update<Model>,
  ): Promise<void> {
    const cursor = await this.store.cursor(criteria);
    const changes: [Model, Model][] = [];

    try {
      await cursor.forEach(async (model) => {
        const result = await this.partialUpdateByKeyAndGetResult(
          model[this.keyPath],
          partialUpdate,
          criteria,
        );
        if (result?.next) changes.push([result.prev, result.next]);
      });
    } finally {
      if (changes.length > 0) this.callSubscribed({ type: "updated", changes });
    }
  }

  async deleteByKey(key: KeyValue, criteria?: Criteria<Model>): Promise<void> {
    const prev = await this.deleteByKeyAndGetPrev(key, criteria);
    if (!prev) return;
    this.callSubscribed({ type: "deleted", prev: [prev] });
  }

  deleteOne(object: Model): Promise<void> {
    return this.deleteByKey(object[this.keyPath]);
  }

  async deleteMany(criteria: Criteria<Model>): Promise<void> {
    const cursor = await this.store.cursor(criteria);
    const prev: Model[] = await cursor.toArray();
    await this.store.deleteMany(criteria);
    this.callSubscribed({ type: "deleted", prev });
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
