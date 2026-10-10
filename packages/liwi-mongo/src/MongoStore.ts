import { NotFoundError } from "liwi-store";
import type {
  AllowedKeyValue,
  CreateQueryOptions,
  Criteria,
  DeleteResult,
  Fields,
  OptionalBaseModelKeysForInsert,
  PartialUpdateResult,
  QueryParams,
  Sort,
  SubscribableStore,
  Update,
  UpsertPartialObject,
  UpsertResult,
  WriteResult,
} from "liwi-store";
import type {
  Collection,
  Filter,
  FindCursor,
  MongoClient,
  UpdateFilter,
} from "mongodb";
import mongodb from "mongodb";
import type {
  MongoBaseModel,
  MongoInsertType,
  MongoKeyPath,
} from "./MongoBaseModel.ts";
import type MongoConnection from "./MongoConnection.ts";
import MongoCursor from "./MongoCursor.ts";
import MongoQueryCollection from "./MongoQueryCollection.ts";
import MongoQuerySingleItem from "./MongoQuerySingleItem.ts";
import { applyIndexPlan } from "./indexes/applyIndexPlan.ts";
import { diffIndexes } from "./indexes/diffIndexes.ts";
import { isNamespaceNotFoundError } from "./indexes/isIndexConflictError.ts";
import { normalizeDeclaredIndexes } from "./indexes/normalizeIndex.ts";
import type {
  MongoIndex,
  MongoIndexPlan,
  MongoIndexSyncResult,
  SyncIndexesOptions,
} from "./indexes/types.ts";

export type MongoUpsertResult<
  KeyValue extends AllowedKeyValue,
  Model extends MongoBaseModel<KeyValue>,
> = UpsertResult<Model>;

export interface MongoStoreOptions<Model extends MongoBaseModel<any>> {
  indexes?: readonly MongoIndex<Model>[];
}

export default class MongoStore<
  Model extends MongoBaseModel<KeyValue>,
  KeyValue extends AllowedKeyValue = Model[MongoKeyPath],
> implements SubscribableStore<
  MongoKeyPath,
  KeyValue,
  Model,
  MongoInsertType<Model>,
  MongoConnection
> {
  readonly keyPath: MongoKeyPath = "_id";

  readonly connection: MongoConnection;

  readonly collectionName: string;

  private readonly declaredIndexes: readonly MongoIndex<Model>[];

  private _collection: Collection<Model> | Promise<Collection<Model>>;

  constructor(
    connection: MongoConnection,
    collectionName: string,
    { indexes = [] }: MongoStoreOptions<Model> = {},
  ) {
    this.connection = connection;

    if (!collectionName) {
      throw new Error(`Invalid collectionName: "${collectionName}"`);
    }

    this.collectionName = collectionName;
    this.declaredIndexes = indexes;
    normalizeDeclaredIndexes({ collectionName, indexes });

    this._collection = connection.getConnection().then(
      (client: MongoClient) => {
        this._collection = client.db().collection(collectionName);
        return this._collection;
      },
      (error: Error) => {
        this._collection = Promise.reject(error);
        return this._collection;
      },
    );
  }

  get collection(): Promise<Collection<Model>> {
    if (this.connection.connectionFailed) {
      return Promise.reject(new Error("MongoDB connection failed"));
    }

    return Promise.resolve(this._collection);
  }

  async planIndexes({
    dropUndeclaredIndexes = true,
  }: SyncIndexesOptions = {}): Promise<MongoIndexPlan> {
    const collection = await this.collection;

    const existingIndexes = await collection
      .listIndexes()
      .toArray()
      .catch((error: unknown) => {
        if (isNamespaceNotFoundError(error)) return [];
        throw error;
      });

    return diffIndexes<Model>({
      collectionName: this.collectionName,
      declaredIndexes: this.declaredIndexes,
      existingIndexes,
      dropUndeclaredIndexes,
    });
  }

  async syncIndexes(
    options: SyncIndexesOptions = {},
  ): Promise<MongoIndexSyncResult> {
    const plan = await this.planIndexes(options);
    const collection = await this.collection;
    const client = await this.connection.getConnection();

    return applyIndexPlan({
      plan,
      collection: collection as Collection<any>,
      db: client.db(),
      dryRun: options.dryRun ?? false,
    });
  }

  createQuerySingleItem<
    Result extends Record<MongoKeyPath, KeyValue> = Model,
    Params extends QueryParams<Params> = never,
  >({
    transformer,
    ...options
  }: CreateQueryOptions<Model, Result>): MongoQuerySingleItem<
    Model,
    Params,
    Result,
    KeyValue
  > {
    return new MongoQuerySingleItem<Model, Params, Result, KeyValue>(
      this,
      options,
      transformer,
    );
  }

  createQueryCollection<
    Item extends Record<MongoKeyPath, KeyValue> = Model,
    Params extends QueryParams<Params> = never,
  >({
    transformer,
    ...options
  }: CreateQueryOptions<Model, Item>): MongoQueryCollection<
    Model,
    Params,
    Model["_id"],
    Item
  > {
    return new MongoQueryCollection<Model, Params, KeyValue, Item>(
      this,
      options,
      transformer,
    );
  }

  async insertOne(object: MongoInsertType<Model>): Promise<Model> {
    if (!object._id) {
      object._id = new mongodb.ObjectId().toString() as Model["_id"];
    }

    if (!object.created) object.created = new Date();
    if (!object.updated) object.updated = new Date();

    const collection = await this.collection;
    const { acknowledged: isAcknowledged } = await collection.insertOne(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      object as any,
    );
    if (!isAcknowledged) {
      throw new Error("Fail to insert");
    }

    return object as Model;
  }

  async replaceOne(object: Model): Promise<Model> {
    if (!object.updated) object.updated = new Date();

    const collection = await this.collection;
    const { matchedCount } = await collection.replaceOne(
      { _id: object._id } as Filter<Model>,
      object,
    );
    if (matchedCount === 0) {
      throw new NotFoundError(`Document not found: ${String(object._id)}`);
    }
    return { ...object };
  }

  async replaceOneWithInfo(
    object: Model,
  ): Promise<WriteResult<Model> | undefined> {
    if (!object.updated) object.updated = new Date();

    const collection = await this.collection;
    const prev = await collection.findOneAndReplace(
      { _id: object._id } as Filter<Model>,
      object,
      { returnDocument: "before" },
    );
    if (!prev) return undefined;

    return { prev: prev as Model, next: { ...object } };
  }

  async upsertOne<
    K extends Exclude<
      keyof Model,
      MongoKeyPath | OptionalBaseModelKeysForInsert
    >,
  >(
    object: UpsertPartialObject<MongoKeyPath, KeyValue, Model, K>,
    setOnInsertPartialObject?: Update<Model>["$setOnInsert"],
  ): Promise<Model> {
    const result = await this.upsertOneWithInfo(
      object,
      setOnInsertPartialObject,
    );
    return result.object;
  }

  async upsertOneWithInfo<
    K extends Exclude<
      keyof Model,
      MongoKeyPath | OptionalBaseModelKeysForInsert
    >,
  >(
    object: UpsertPartialObject<MongoKeyPath, KeyValue, Model, K>,
    setOnInsertPartialObject?: Update<Model>["$setOnInsert"],
  ): Promise<MongoUpsertResult<KeyValue, Model>> {
    const $setOnInsert: Update<Model>["$setOnInsert"] = {
      // @ts-expect-error -- created is Date as set in BaseModel
      created: object.created || new Date(),
      ...setOnInsertPartialObject,
    };

    if (!object.updated) {
      (object as MongoBaseModel).updated = new Date();
    }

    const $set: Partial<typeof object> = { ...object };
    delete $set.created;

    const collection = await this.collection;

    const prev = await collection.findOneAndUpdate(
      { _id: object._id } as Filter<Model>,
      { $set, $setOnInsert } as UpdateFilter<Model>,
      { upsert: true, returnDocument: "before" },
    );

    if (!prev) {
      Object.assign(object, $setOnInsert);
      return {
        resolvedAs: "inserted",
        inserted: true,
        object: object as unknown as Model,
      };
    }

    const next = { ...prev, ...$set };

    return {
      resolvedAs: "updated",
      inserted: false,
      object: next as Model,
      prev: prev as Model,
    };
  }

  replaceSeveral(objects: Model[]): Promise<Model[]> {
    return Promise.all(objects.map((object: Model) => this.replaceOne(object)));
  }

  async partialUpdateByKey(
    key: KeyValue,
    partialUpdate: Update<Model>,
    criteria?: Criteria<Model>,
  ): Promise<Model> {
    const collection = await this.collection;
    const next = await collection.findOneAndUpdate(
      { _id: key, ...criteria } as Filter<Model>,
      partialUpdate as UpdateFilter<Model>,
      { returnDocument: "after" },
    );
    if (!next) throw new NotFoundError(`Document not found: ${String(key)}`);
    return next as Model;
  }

  /**
   * `prev` is read atomically with the write. `next` is read right after it,
   * so it may already include a later concurrent write, which emits its own change.
   * Resolves `undefined` when no document matches.
   */
  async partialUpdateByKeyWithInfo(
    key: KeyValue,
    partialUpdate: Update<Model>,
    criteria?: Criteria<Model>,
  ): Promise<PartialUpdateResult<Model> | undefined> {
    const collection = await this.collection;
    const prev = await collection.findOneAndUpdate(
      { _id: key, ...criteria } as Filter<Model>,
      partialUpdate as UpdateFilter<Model>,
      { returnDocument: "before" },
    );
    if (!prev) return undefined;

    return { prev: prev as Model, next: await this.findByKey(key) };
  }

  partialUpdateOne(
    object: Model,
    partialUpdate: Update<Model>,
  ): Promise<Model> {
    return this.partialUpdateByKey(object._id, partialUpdate);
  }

  partialUpdateMany(
    criteria: Criteria<Model>,
    partialUpdate: Update<Model>,
  ): Promise<void> {
    return this.collection
      .then((collection) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        collection.updateMany(criteria as Filter<Model>, partialUpdate as any),
      )
      .then((res) => undefined); // TODO return updated object
  }

  async deleteByKey(key: KeyValue, criteria?: Criteria<Model>): Promise<void> {
    const collection = await this.collection;
    await collection.deleteOne({ _id: key, ...criteria } as Filter<Model>);
  }

  async deleteByKeyWithInfo(
    key: KeyValue,
    criteria?: Criteria<Model>,
  ): Promise<DeleteResult<Model> | undefined> {
    const collection = await this.collection;
    const prev = await collection.findOneAndDelete({
      _id: key,
      ...criteria,
    } as Filter<Model>);
    if (!prev) return undefined;

    return { prev: prev as Model };
  }

  deleteOne(object: Model): Promise<void> {
    return this.deleteByKey(object._id);
  }

  deleteMany(selector: Criteria<Model>): Promise<void> {
    return this.collection
      .then((collection) => collection.deleteMany(selector as Filter<Model>))
      .then(() => undefined);
  }

  async count(filter?: Criteria<Model>): Promise<number> {
    const collection = await this.collection;
    return filter
      ? collection.countDocuments(filter as Filter<Model>)
      : collection.countDocuments();
  }

  async cursor<Result extends Partial<Model> = Model>(
    filter?: Criteria<Model>,
    sort?: Sort<Model>,
    fields?: Fields<Model>,
  ): Promise<MongoCursor<Model, Result, KeyValue>> {
    const collection = await this.collection;
    const findCursor = filter
      ? collection.find<Result>(filter as Filter<Model>)
      : (collection.find() as unknown as FindCursor<Result>);
    if (sort) findCursor.sort(sort);
    if (fields) findCursor.project(fields);
    return new MongoCursor<Model, Result, KeyValue>(this, findCursor);
  }

  async findByKey(
    key: KeyValue,
    criteria?: Criteria<Model>,
  ): Promise<Model | undefined> {
    const collection = await this.collection;
    const result = await collection.findOne<Model>({
      _id: key,
      ...criteria,
    } as Filter<Model>);
    return result || undefined;
  }

  findAll(criteria?: Criteria<Model>, sort?: Sort<Model>): Promise<Model[]> {
    return this.cursor<Model>(criteria, sort).then((cursor) =>
      cursor.toArray(),
    );
  }

  async findOne(
    filter: Criteria<Model>,
    sort?: Sort<Model>,
  ): Promise<Model | undefined> {
    const collection = await this.collection;
    const result = await collection.findOne<Model>(filter as Filter<Model>, {
      sort,
    });
    return result || undefined;
  }
}
