import type AbstractConnection from "./AbstractConnection";
import type AbstractStoreCursor from "./AbstractStoreCursor";
import type { InternalCommonStoreClient } from "./InternalCommonStoreClient";
import type { Query, QueryParams } from "./Query";
import type {
  AllowedKeyValue,
  BaseModel,
  CreateQueryOptions,
  Criteria,
  InsertType,
  OptionalBaseModelKeysForInsert,
  SetOptional,
  Sort,
  Update,
} from "./types";

export type UpsertPartialObject<
  KeyPath extends keyof Model,
  KeyValue extends AllowedKeyValue,
  Model extends BaseModel & Record<KeyPath, KeyValue>,
  K extends Exclude<keyof Model, KeyPath | OptionalBaseModelKeysForInsert>,
> = SetOptional<Model, K | KeyPath | OptionalBaseModelKeysForInsert>;

export type UpsertResult<Model extends BaseModel> =
  | {
      resolvedAs: "inserted";
      /** Shorthand for `resolvedAs === "inserted"`. */
      inserted: true;
      object: Model;
    }
  | {
      resolvedAs: "updated";
      /** Shorthand for `resolvedAs === "inserted"`. */
      inserted: false;
      object: Model;
      prev: Model;
    };

export interface WriteResult<Model extends BaseModel> {
  /** The stored document the write applied to. */
  prev: Model;
  /** The stored document after the write. */
  next: Model;
}

export interface PartialUpdateResult<Model extends BaseModel> {
  /** The stored document the update applied to. */
  prev: Model;
  /**
   * The stored document read back after the update. `undefined` when a
   * concurrent write deleted it first: the update was still applied.
   */
  next: Model | undefined;
}

export interface DeleteResult<Model extends BaseModel> {
  /** The stored document as it was deleted. */
  prev: Model;
}

export interface Store<
  KeyPath extends keyof Model,
  KeyValue extends AllowedKeyValue,
  Model extends BaseModel & Record<KeyPath, KeyValue>,
  ModelInsertType extends InsertType<Model, KeyPath>,
  Connection extends AbstractConnection,
> extends InternalCommonStoreClient<Model> {
  readonly connection: Connection;

  readonly keyPath: KeyPath;

  createQuerySingleItem: <
    Result extends Record<KeyPath, KeyValue>,
    Params extends QueryParams<Params>,
  >(
    options: CreateQueryOptions<Model, Result>,
  ) => Query<Result, Params, KeyValue>;

  createQueryCollection: <
    Item extends Record<KeyPath, KeyValue>,
    Params extends QueryParams<Params>,
  >(
    options: CreateQueryOptions<Model, Item>,
  ) => Query<Item[], Params, KeyValue>;

  findAll: (criteria?: Criteria<Model>, sort?: Sort<Model>) => Promise<Model[]>;

  findByKey: (
    key: KeyValue,
    criteria?: Criteria<Model>,
  ) => Promise<Model | undefined>;

  findOne: (
    criteria: Criteria<Model>,
    sort?: Sort<Model>,
  ) => Promise<Model | undefined>;

  count: (criteria?: Criteria<Model>) => Promise<number>;

  cursor: <Result extends Partial<Model> = Model>(
    criteria?: Criteria<Model>,
    sort?: Sort<Model>,
  ) => Promise<AbstractStoreCursor<any, KeyValue, Model, Result>>;

  insertOne: (object: ModelInsertType) => Promise<Model>;

  replaceOne: (object: Model) => Promise<Model>;

  /** Resolves `undefined` when no stored document has the object's key. */
  replaceOneWithInfo?: (
    object: Model,
  ) => Promise<WriteResult<Model> | undefined>;

  replaceSeveral: (objects: Model[]) => Promise<Model[]>;

  upsertOne: <
    K extends Exclude<keyof Model, KeyPath | OptionalBaseModelKeysForInsert>,
  >(
    object: UpsertPartialObject<KeyPath, KeyValue, Model, K>,
    setOnInsertPartialObject?: Update<Model>["$setOnInsert"],
  ) => Promise<Model>;

  upsertOneWithInfo: <
    K extends Exclude<keyof Model, KeyPath | OptionalBaseModelKeysForInsert>,
  >(
    object: UpsertPartialObject<KeyPath, KeyValue, Model, K>,
    setOnInsertPartialObject?: Update<Model>["$setOnInsert"],
  ) => Promise<UpsertResult<Model>>;

  partialUpdateByKey: (
    key: KeyValue,
    partialUpdate: Update<Model>,
    criteria?: Criteria<Model>,
  ) => Promise<Model>;

  /** Resolves `undefined` when no stored document matches the key and criteria. */
  partialUpdateByKeyWithInfo?: (
    key: KeyValue,
    partialUpdate: Update<Model>,
    criteria?: Criteria<Model>,
  ) => Promise<PartialUpdateResult<Model> | undefined>;

  partialUpdateOne: (
    object: Model,
    partialUpdate: Update<Model>,
  ) => Promise<Model>;

  partialUpdateMany: (
    criteria: Criteria<Model>,
    partialUpdate: Update<Model>,
  ) => Promise<void>;

  deleteByKey: (key: KeyValue, criteria?: Criteria<Model>) => Promise<void>;

  /** Resolves `undefined` when no stored document matches the key and criteria. */
  deleteByKeyWithInfo?: (
    key: KeyValue,
    criteria?: Criteria<Model>,
  ) => Promise<DeleteResult<Model> | undefined>;

  deleteOne: (object: Model) => Promise<void>;

  deleteMany: (selector: Criteria<Model>) => Promise<void>;
}
