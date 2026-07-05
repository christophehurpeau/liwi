import mongodb from 'mongodb';
import { AbstractStoreCursor, AbstractConnection } from 'liwi-store';
import { AbstractSubscribableStoreQuery, SubscribeStore } from 'liwi-subscribe-store';
import mingo from 'mingo';
import { Logger } from 'nightingale-logger';

class MongoCursor extends AbstractStoreCursor {
  // key in AbstractCursor
  cursor;
  _result;
  constructor(store, cursor) {
    super(store);
    this.cursor = cursor;
  }
  advance(count) {
    this.cursor.skip(count);
  }
  next() {
    return this.cursor.next().then((value) => {
      this._result = value;
      this.key = value?._id;
      return this.key;
    });
  }
  async forEach(callback) {
    for await (const result of this.cursor) {
      await callback(result);
    }
  }
  limit(newLimit) {
    this.cursor.limit(newLimit);
    return Promise.resolve(this);
  }
  result() {
    if (!this._result) throw new Error("Cannot call result() before next()");
    return Promise.resolve(this._result);
  }
  close() {
    if (this.cursor) {
      this.cursor.close();
    }
    return Promise.resolve();
  }
  toArray() {
    return this.cursor.toArray();
  }
}

const identityTransformer$1 = (model) => model;
class MongoQueryCollection extends AbstractSubscribableStoreQuery {
  store;
  options;
  testCriteria;
  transformer;
  constructor(store, options, transformer = identityTransformer$1) {
    super();
    this.store = store;
    this.options = options;
    this.transformer = transformer;
  }
  createTestCriteria() {
    if (!this.testCriteria) {
      if (!this.options.criteria) {
        return () => true;
      }
      if ("$text" in this.options.criteria) {
        return () => false;
      }
      const mingoQuery = new mingo.Query(this.options.criteria);
      this.testCriteria = mingoQuery.test.bind(mingoQuery);
    }
    return this.testCriteria;
  }
  async fetch(onFulfilled) {
    const [result, count] = await Promise.all([
      this.createMongoCursor().then((cursor) => cursor.toArray()),
      this.store.count(this.options.criteria)
    ]);
    return onFulfilled({
      result: result.map(this.transformer),
      meta: { total: count },
      info: {
        sort: this.options.sort,
        limit: this.options.limit,
        keyPath: this.store.keyPath
      }
    });
  }
  _subscribe(callback, _includeInitial) {
    const store = super.getSubscribeStore();
    const testCriteria = this.createTestCriteria();
    const promise = _includeInitial ? this.fetch(({ result, meta, info }) => {
      callback(null, [
        {
          type: "initial",
          initial: result,
          queryInfo: info,
          meta
        }
      ]);
    }) : Promise.resolve();
    const unsubscribe = store.subscribe((action) => {
      const changes = [];
      switch (action.type) {
        case "inserted": {
          const filtered = action.next.filter(testCriteria);
          if (filtered.length > 0) {
            changes.push({
              type: "inserted",
              result: filtered.map(this.transformer)
            });
          }
          break;
        }
        case "deleted": {
          const filtered = action.prev.filter(testCriteria);
          if (filtered.length > 0) {
            changes.push({
              type: "deleted",
              keys: filtered.map((object) => object[this.store.keyPath])
            });
          }
          break;
        }
        case "updated": {
          const {
            deleted,
            updated,
            inserted
          } = { deleted: [], updated: [], inserted: [] };
          action.changes.forEach(([prevObject, nextObject]) => {
            if (testCriteria(prevObject)) {
              if (!testCriteria(nextObject)) {
                deleted.push(prevObject[this.store.keyPath]);
              } else {
                updated.push(this.transformer(nextObject));
              }
            } else if (testCriteria(nextObject)) {
              inserted.push(this.transformer(nextObject));
            }
          });
          if (deleted.length > 0) {
            changes.push({ type: "deleted", keys: deleted });
          }
          if (updated.length > 0) {
            changes.push({ type: "updated", result: updated });
          }
          if (inserted.length > 0) {
            changes.push({ type: "inserted", result: inserted });
          }
          break;
        }
        default:
          throw new Error("Unsupported type");
      }
      if (changes.length === 0) return;
      callback(null, changes);
    });
    return {
      stop: unsubscribe,
      cancel: unsubscribe,
      then: (onFulfilled, onRejected) => promise.then(onFulfilled, onRejected)
    };
  }
  async createMongoCursor() {
    const cursor = await this.store.cursor(
      this.options.criteria,
      this.options.sort,
      this.options.fields
    );
    if (this.options.skip) {
      cursor.advance(this.options.skip);
    }
    if (this.options.limit) {
      await cursor.limit(this.options.limit);
    }
    return cursor;
  }
}

const identityTransformer = (model) => model;
class MongoQuerySingleItem extends AbstractSubscribableStoreQuery {
  store;
  options;
  testCriteria;
  transformer;
  constructor(store, options, transformer = identityTransformer) {
    super();
    this.store = store;
    this.options = options;
    this.transformer = transformer;
  }
  createMingoTestCriteria() {
    if (!this.testCriteria) {
      if (!this.options.criteria) {
        return () => true;
      }
      const mingoQuery = new mingo.Query(this.options.criteria);
      this.testCriteria = mingoQuery.test.bind(mingoQuery);
    }
    return this.testCriteria;
  }
  async fetch(onFulfilled) {
    const cursor = await this.createMongoCursor();
    await cursor.limit(1);
    return cursor.toArray().then((result) => {
      const item = result.length === 0 ? null : this.transformer(result[0]);
      return onFulfilled({
        result: item,
        meta: { total: result === null ? 0 : 1 },
        info: {
          limit: 1,
          keyPath: this.store.keyPath
        }
      });
    });
  }
  _subscribe(callback, _includeInitial) {
    const store = super.getSubscribeStore();
    const testCriteria = this.createMingoTestCriteria();
    const promise = _includeInitial ? this.fetch(({ result, meta, info }) => {
      callback(null, [
        {
          type: "initial",
          initial: result,
          queryInfo: info,
          meta
        }
      ]);
    }) : Promise.resolve();
    const unsubscribe = store.subscribe(async (action) => {
      const changes = [];
      switch (action.type) {
        case "inserted": {
          const filtered = action.next.filter(testCriteria);
          if (filtered.length > 0) {
            changes.push({
              type: "updated",
              result: this.transformer(filtered[0])
            });
          }
          break;
        }
        case "deleted": {
          const filtered = action.prev.filter(testCriteria);
          if (filtered.length > 0) {
            changes.push({
              type: "deleted",
              keys: filtered.map((object) => object[this.store.keyPath])
            });
          }
          break;
        }
        case "updated": {
          const filtered = action.changes.filter(
            ([prev, next]) => testCriteria(prev)
          );
          if (filtered.length > 0) {
            if (this.options.sort) {
              const { result } = await this.fetch((res) => res);
              changes.push({
                type: "updated",
                result
              });
            } else if (filtered.length !== 1) {
              throw new Error(
                "should not match more than 1, use sort if you can have multiple match"
              );
            } else {
              const [, next] = filtered[0];
              changes.push({
                type: "updated",
                result: testCriteria(next) ? this.transformer(next) : null
              });
            }
          } else if (filtered.length === 0) ;
          break;
        }
        default:
          throw new Error("Unsupported type");
      }
      if (changes.length === 0) return;
      callback(null, changes);
    });
    return {
      stop: unsubscribe,
      cancel: unsubscribe,
      then: (onFulfilled, onRejected) => promise.then(onFulfilled, onRejected)
    };
  }
  async createMongoCursor() {
    const cursor = await this.store.cursor(
      this.options.criteria,
      this.options.sort,
      this.options.fields
    );
    if (this.options.limit) {
      await cursor.limit(this.options.limit);
    }
    return cursor;
  }
}

class MongoStore {
  keyPath = "_id";
  connection;
  _collection;
  constructor(connection, collectionName) {
    this.connection = connection;
    if (!collectionName) {
      throw new Error(`Invalid collectionName: "${collectionName}"`);
    }
    this._collection = connection.getConnection().then(
      (client) => {
        this._collection = client.db().collection(collectionName);
        return this._collection;
      },
      (error) => {
        this._collection = Promise.reject(error);
        return this._collection;
      }
    );
  }
  get collection() {
    if (this.connection.connectionFailed) {
      return Promise.reject(new Error("MongoDB connection failed"));
    }
    return Promise.resolve(this._collection);
  }
  createQuerySingleItem({
    transformer,
    ...options
  }) {
    return new MongoQuerySingleItem(
      this,
      options,
      transformer
    );
  }
  createQueryCollection({
    transformer,
    ...options
  }) {
    return new MongoQueryCollection(
      this,
      options,
      transformer
    );
  }
  async insertOne(object) {
    if (!object._id) {
      object._id = new mongodb.ObjectId().toString();
    }
    if (!object.created) object.created = /* @__PURE__ */ new Date();
    if (!object.updated) object.updated = /* @__PURE__ */ new Date();
    const collection = await this.collection;
    const { acknowledged: isAcknowledged } = await collection.insertOne(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      object
    );
    if (!isAcknowledged) {
      throw new Error("Fail to insert");
    }
    return object;
  }
  async replaceOne(object) {
    if (!object.updated) object.updated = /* @__PURE__ */ new Date();
    const collection = await this.collection;
    await collection.replaceOne({ _id: object._id }, object);
    return object;
  }
  async upsertOne(object, setOnInsertPartialObject) {
    const result = await this.upsertOneWithInfo(
      object,
      setOnInsertPartialObject
    );
    return result.object;
  }
  async upsertOneWithInfo(object, setOnInsertPartialObject) {
    const $setOnInsert = {
      // @ts-expect-error -- created is Date as set in BaseModel
      created: object.created || /* @__PURE__ */ new Date(),
      ...setOnInsertPartialObject
    };
    if (!object.updated) {
      object.updated = /* @__PURE__ */ new Date();
    }
    const $set = { ...object };
    delete $set.created;
    const collection = await this.collection;
    const { upsertedCount } = await collection.updateOne(
      { _id: object._id },
      { $set, $setOnInsert },
      { upsert: true }
    );
    if (upsertedCount) {
      Object.assign(object, $setOnInsert);
    }
    return { object, inserted: !!upsertedCount };
  }
  replaceSeveral(objects) {
    return Promise.all(objects.map((object) => this.replaceOne(object)));
  }
  async partialUpdateByKey(key, partialUpdate, criteria) {
    const collection = await this.collection;
    const commandResult = await collection.updateOne(
      { _id: key, ...criteria },
      partialUpdate
    );
    if (!commandResult.acknowledged) {
      console.error(commandResult);
      throw new Error("Update failed");
    }
    const object = await this.findByKey(key);
    return object;
  }
  partialUpdateOne(object, partialUpdate) {
    return this.partialUpdateByKey(object._id, partialUpdate);
  }
  partialUpdateMany(criteria, partialUpdate) {
    return this.collection.then(
      (collection) => (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        collection.updateMany(criteria, partialUpdate)
      )
    ).then((res) => void 0);
  }
  deleteByKey(key, criteria) {
    return this.collection.then(
      (collection) => collection.deleteOne({ _id: key, ...criteria })
    ).then(() => void 0);
  }
  deleteOne(object) {
    return this.deleteByKey(object._id);
  }
  deleteMany(selector) {
    return this.collection.then((collection) => collection.deleteMany(selector)).then(() => void 0);
  }
  async count(filter) {
    const collection = await this.collection;
    return filter ? collection.countDocuments(filter) : collection.countDocuments();
  }
  async cursor(filter, sort, fields) {
    const collection = await this.collection;
    const findCursor = filter ? collection.find(filter) : collection.find();
    if (sort) findCursor.sort(sort);
    if (fields) findCursor.project(fields);
    return new MongoCursor(this, findCursor);
  }
  async findByKey(key, criteria) {
    const collection = await this.collection;
    const result = await collection.findOne({
      _id: key,
      ...criteria
    });
    return result || void 0;
  }
  findAll(criteria, sort) {
    return this.cursor(criteria, sort).then(
      (cursor) => cursor.toArray()
    );
  }
  async findOne(filter, sort) {
    const collection = await this.collection;
    const result = await collection.findOne(filter, {
      sort
    });
    return result || void 0;
  }
}

const logger = new Logger("liwi:mongo:MongoConnection");
class MongoConnection extends AbstractConnection {
  _connection;
  _connecting;
  connectionFailed;
  // TODO interface
  constructor({
    host = "localhost",
    port = "27017",
    database,
    user,
    password
  }) {
    super();
    if (!database) {
      throw new Error("Missing config database");
    }
    const buildConnectionString = (redactCredentials) => `mongodb://${user ? `${redactCredentials ? `${user.slice(0, 2)}[redacted]` : encodeURIComponent(user)}:${redactCredentials ? "[redacted]" : encodeURIComponent(password ?? "")}@` : ""}${host}:${port}/${encodeURIComponent(database)}`;
    const connectionString = buildConnectionString(false);
    const connectionStringRedacted = buildConnectionString(true);
    this.connect(connectionString, connectionStringRedacted);
  }
  connect(connectionString, connectionStringRedacted) {
    logger.info("connecting", { connectionStringRedacted });
    const connectPromise = mongodb.MongoClient.connect(connectionString).then((connection) => {
      logger.info("connected", { connectionStringRedacted });
      connection.on("close", () => {
        logger.warn("close", { connectionStringRedacted });
        this.connectionFailed = true;
        this.getConnection = () => {
          throw new Error("MongoDB connection closed");
        };
      });
      connection.on("timeout", () => {
        logger.warn("timeout", { connectionStringRedacted });
        this.connectionFailed = true;
        this.getConnection = () => {
          throw new Error("MongoDB connection timeout");
        };
      });
      connection.on("reconnect", () => {
        logger.warn("reconnect", { connectionStringRedacted });
        this.connectionFailed = false;
        this.getConnection = () => Promise.resolve(this._connection);
      });
      connection.on("error", (err) => {
        logger.warn("error", { connectionStringRedacted, err });
      });
      this._connection = connection;
      this._connecting = void 0;
      this.getConnection = () => Promise.resolve(this._connection);
      return connection;
    }).catch((error) => {
      logger.info("not connected", { connectionStringRedacted });
      console.error(error.message || error);
      process.nextTick(() => {
        process.exit(1);
      });
      throw error;
    });
    this.getConnection = () => Promise.resolve(connectPromise);
    this._connecting = this.getConnection();
  }
  getConnection() {
    throw new Error("call connect()");
  }
  async close() {
    this.getConnection = () => Promise.reject(new Error("Connection closed"));
    if (this._connection) {
      await this._connection.close();
      this._connection = void 0;
    } else if (this._connecting) {
      await this._connecting;
      await this.close();
    }
  }
}

function createMongoSubscribeStore(mongoStore) {
  return new SubscribeStore(mongoStore);
}

export { MongoConnection, MongoStore, createMongoSubscribeStore };
//# sourceMappingURL=index-node.mjs.map
