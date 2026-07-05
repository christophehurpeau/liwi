import type {
  AbstractConnection,
  AbstractStoreCursor,
  AllowedKeyValue,
  BaseModel,
  CreateQueryOptions,
  Criteria,
  InsertType,
  OptionalBaseModelKeysForInsert,
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
    const replaced = await this.store.replaceOne(object);
    this.callSubscribed({ type: "updated", changes: [[object, replaced]] });
    return replaced;
  }

  async replaceSeveral(objects: Model[]): Promise<Model[]> {
    const replacedObjects = await this.store.replaceSeveral(objects);
    this.callSubscribed({
      type: "updated",
      changes: objects.map((prev, index) => [prev, replacedObjects[index]!]),
    });
    return replacedObjects;
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
    if (upsertedWithInfo.inserted) {
      this.callSubscribed({
        type: "inserted",
        next: [upsertedWithInfo.object],
      });
    } else {
      throw new Error("TODO");
    }
    return upsertedWithInfo;
  }

  async partialUpdateByKey(
    key: KeyValue,
    partialUpdate: Update<Model>,
    criteria?: Criteria<Model>,
  ): Promise<Model> {
    return this.partialUpdateOne(
      (await this.findOne({
        [this.store.keyPath]: key,
        ...criteria,
      }))!,
      partialUpdate,
    );
  }

  async partialUpdateOne(
    object: Model,
    partialUpdate: Update<Model>,
  ): Promise<Model> {
    const updated = await this.store.partialUpdateOne(object, partialUpdate);
    this.callSubscribed({ type: "updated", changes: [[object, updated]] });
    return updated;
  }

  async partialUpdateMany(
    criteria: Criteria<Model>,
    partialUpdate: Update<Model>,
  ): Promise<void> {
    const cursor = await this.store.cursor(criteria);
    const changes: [Model, Model][] = [];

    await cursor.forEach(async (model) => {
      const key = model[this.store.keyPath];
      const updated = await this.store.partialUpdateByKey(
        key,
        partialUpdate,
        criteria,
      );
      changes.push([model, updated]);
    });
    this.callSubscribed({ type: "updated", changes });
  }

  async deleteByKey(key: KeyValue, criteria?: Criteria<Model>): Promise<void> {
    return this.deleteOne((await this.findByKey(key, criteria))!);
  }

  async deleteOne(object: Model): Promise<void> {
    await this.store.deleteOne(object);
    this.callSubscribed({ type: "deleted", prev: [object] });
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
