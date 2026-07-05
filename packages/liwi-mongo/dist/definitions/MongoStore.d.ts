import type { AllowedKeyValue, Criteria, Fields, OptionalBaseModelKeysForInsert, QueryOptions, QueryParams, Sort, SubscribableStore, Transformer, Update, UpsertPartialObject, UpsertResult } from "liwi-store";
import type { Collection } from "mongodb";
import type { MongoBaseModel, MongoInsertType, MongoKeyPath } from "./MongoBaseModel.ts";
import type MongoConnection from "./MongoConnection.ts";
import MongoCursor from "./MongoCursor.ts";
import MongoQueryCollection from "./MongoQueryCollection.ts";
import MongoQuerySingleItem from "./MongoQuerySingleItem.ts";
export interface MongoUpsertResult<KeyValue extends AllowedKeyValue, Model extends MongoBaseModel<KeyValue>> extends UpsertResult<Model> {
    object: Model;
    inserted: boolean;
}
export default class MongoStore<Model extends MongoBaseModel<KeyValue>, KeyValue extends AllowedKeyValue = Model[MongoKeyPath]> implements SubscribableStore<MongoKeyPath, KeyValue, Model, MongoInsertType<Model>, MongoConnection> {
    readonly keyPath: MongoKeyPath;
    readonly connection: MongoConnection;
    private _collection;
    constructor(connection: MongoConnection, collectionName: string);
    get collection(): Promise<Collection<Model>>;
    createQuerySingleItem<Result extends Record<MongoKeyPath, KeyValue> = Model, Params extends QueryParams<Params> = never>(options: QueryOptions<Model>, transformer?: Transformer<Model, Result>): MongoQuerySingleItem<Model, Params, Result, KeyValue>;
    createQueryCollection<Item extends Record<MongoKeyPath, KeyValue> = Model, Params extends QueryParams<Params> = never>(options: QueryOptions<Model>, transformer?: Transformer<Model, Item>): MongoQueryCollection<Model, Params, Model["_id"], Item>;
    insertOne(object: MongoInsertType<Model>): Promise<Model>;
    replaceOne(object: Model): Promise<Model>;
    upsertOne<K extends Exclude<keyof Model, MongoKeyPath | OptionalBaseModelKeysForInsert>>(object: UpsertPartialObject<MongoKeyPath, KeyValue, Model, K>, setOnInsertPartialObject?: Update<Model>["$setOnInsert"]): Promise<Model>;
    upsertOneWithInfo<K extends Exclude<keyof Model, MongoKeyPath | OptionalBaseModelKeysForInsert>>(object: UpsertPartialObject<MongoKeyPath, KeyValue, Model, K>, setOnInsertPartialObject?: Update<Model>["$setOnInsert"]): Promise<MongoUpsertResult<KeyValue, Model>>;
    replaceSeveral(objects: Model[]): Promise<Model[]>;
    partialUpdateByKey(key: KeyValue, partialUpdate: Update<Model>, criteria?: Criteria<Model>): Promise<Model>;
    partialUpdateOne(object: Model, partialUpdate: Update<Model>): Promise<Model>;
    partialUpdateMany(criteria: Criteria<Model>, partialUpdate: Update<Model>): Promise<void>;
    deleteByKey(key: KeyValue, criteria?: Criteria<Model>): Promise<void>;
    deleteOne(object: Model): Promise<void>;
    deleteMany(selector: Criteria<Model>): Promise<void>;
    count(filter?: Criteria<Model>): Promise<number>;
    cursor<Result extends Partial<Model> = Model>(filter?: Criteria<Model>, sort?: Sort<Model>, fields?: Fields<Model>): Promise<MongoCursor<Model, Result, KeyValue>>;
    findByKey(key: KeyValue, criteria?: Criteria<Model>): Promise<Model | undefined>;
    findAll(criteria?: Criteria<Model>, sort?: Sort<Model>): Promise<Model[]>;
    findOne(filter: Criteria<Model>, sort?: Sort<Model>): Promise<Model | undefined>;
}
//# sourceMappingURL=MongoStore.d.ts.map