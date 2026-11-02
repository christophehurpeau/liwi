import type AbstractConnection from "./AbstractConnection.ts";
import type AbstractStoreCursor from "./AbstractStoreCursor.ts";
import type { InternalCommonStoreClient } from "./InternalCommonStoreClient.ts";
import type { Query, QueryParams } from "./Query.ts";
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
} from "./types.ts";

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

export interface TouchUpdatedOptions {
  /**
   * Set `updated` to the write time (the app clock). Defaults to `true`.
   *
   * Pass `false` for writes that must not count as a change to the document:
   * backfills, migrations, technical flags. `updated` then keeps its stored value,
   * so rules based on it ("delete what has not changed in 12 months") are not reset.
   * It costs nothing: the update is sent as is, in the same single operation.
   *
   * The caller can still set `updated` explicitly with `$set`, `$currentDate` or
   * `$max`; any other operator on `updated`, or any operator on `created`, throws
   * `ProtectedFieldUpdateError` whatever this option.
   */
  touchUpdated?: boolean;
}

export interface AllowNotFoundOptions {
  /**
   * Resolve `undefined` instead of throwing `NotFoundError` when no stored
   * document matches. Defaults to `false`.
   */
  allowNotFound?: boolean;
}

export interface PartialUpdateOptions
  extends TouchUpdatedOptions, AllowNotFoundOptions {}

/** `Model`, or `Model | undefined` when `allowNotFound` may be `true`. */
export type ResultAllowingNotFound<
  Model,
  Options extends object | undefined,
> = Options extends { allowNotFound?: infer AllowNotFound }
  ? true extends AllowNotFound
    ? Model | undefined
    : Model
  : Model;

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

  replaceOne: <Options extends AllowNotFoundOptions | undefined = undefined>(
    object: Model,
    options?: Options,
  ) => Promise<ResultAllowingNotFound<Model, Options>>;

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

  partialUpdateByKey: <
    Options extends PartialUpdateOptions | undefined = undefined,
  >(
    key: KeyValue,
    partialUpdate: Update<Model>,
    criteria?: Criteria<Model>,
    options?: Options,
  ) => Promise<ResultAllowingNotFound<Model, Options>>;

  /** Resolves `undefined` when no stored document matches the key and criteria. */
  partialUpdateByKeyWithInfo?: (
    key: KeyValue,
    partialUpdate: Update<Model>,
    criteria?: Criteria<Model>,
    options?: TouchUpdatedOptions,
  ) => Promise<PartialUpdateResult<Model> | undefined>;

  partialUpdateOne: <
    Options extends PartialUpdateOptions | undefined = undefined,
  >(
    object: Model,
    partialUpdate: Update<Model>,
    options?: Options,
  ) => Promise<ResultAllowingNotFound<Model, Options>>;

  partialUpdateMany: (
    criteria: Criteria<Model>,
    partialUpdate: Update<Model>,
    options?: TouchUpdatedOptions,
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
