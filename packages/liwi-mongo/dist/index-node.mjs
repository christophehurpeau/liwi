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

const indexOptionsConflict = 85;
const indexKeySpecsConflict = 86;
const indexNotFound = 27;
const namespaceNotFound = 26;
const getErrorCode = (error) => typeof error === "object" && error !== null ? error.code : void 0;
const isIndexConflictError = (error) => {
  const code = getErrorCode(error);
  return code === indexOptionsConflict || code === indexKeySpecsConflict;
};
const isIndexNotFoundError = (error) => getErrorCode(error) === indexNotFound;
const isNamespaceNotFoundError = (error) => getErrorCode(error) === namespaceNotFound;

const logger$2 = new Logger("liwi:mongo:indexes");
const idIndexName$1 = "_id_";
const serializeKey = (key) => JSON.stringify(key instanceof Map ? [...key.entries()] : Object.entries(key));
const findConflictingIndex = (existingIndexes, description) => {
  const byName = existingIndexes.find(({ name }) => name === description.name);
  if (byName) return byName;
  const serializedKey = serializeKey(description.key);
  return existingIndexes.find(
    ({ key, name }) => name !== idIndexName$1 && serializeKey(key) === serializedKey
  );
};
const createIndexWithConflictRecovery = async ({
  collection,
  collectionName,
  description
}) => {
  try {
    await collection.createIndexes([description]);
    return;
  } catch (error) {
    if (!isIndexConflictError(error)) throw error;
    logger$2.warn("index conflict, recovering", {
      collectionName,
      name: description.name,
      error
    });
    const existingIndexes = await collection.listIndexes().toArray();
    const conflicting = findConflictingIndex(existingIndexes, description);
    if (!conflicting?.name) throw error;
    await collection.dropIndex(conflicting.name);
  }
  await collection.createIndexes([description]);
};
const applyIndexPlan = async ({
  plan,
  collection,
  db,
  dryRun
}) => {
  const { collectionName } = plan;
  const result = {
    collectionName,
    plan,
    dryRun,
    created: [],
    dropped: [],
    modified: []
  };
  if (dryRun) return result;
  const namesToDrop = [...plan.toDrop, ...plan.toRecreate].map(({ name }) => name).filter((name) => name !== idIndexName$1);
  for (const name of namesToDrop) {
    try {
      await collection.dropIndex(name);
      logger$2.info("dropIndex", { collectionName, name });
      result.dropped.push(name);
    } catch (error) {
      if (!isIndexNotFoundError(error)) throw error;
      logger$2.warn("index already dropped", { collectionName, name });
    }
  }
  for (const { name, changes } of plan.toCollMod) {
    await db.command({
      collMod: collectionName,
      index: { name, ...changes }
    });
    logger$2.info("collMod", { collectionName, name, changes });
    result.modified.push(name);
  }
  const descriptions = [...plan.toCreate, ...plan.toRecreate].map(
    ({ index }) => index
  );
  if (descriptions.length > 0) {
    try {
      await collection.createIndexes(descriptions);
    } catch (error) {
      logger$2.warn("createIndexes failed, retrying one by one", {
        collectionName,
        error
      });
      for (const description of descriptions) {
        await createIndexWithConflictRecovery({
          collection,
          collectionName,
          description
        });
      }
    }
    result.created.push(...descriptions.map(({ name }) => name));
    logger$2.info("createIndexes", { collectionName, names: result.created });
  }
  logger$2.info("syncIndexes done", {
    collectionName,
    created: result.created,
    dropped: result.dropped,
    modified: result.modified
  });
  return result;
};

const isPlainRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof RegExp);
const deepEqualUnordered = (a, b) => {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqualUnordered(item, b[index]));
  }
  if (!isPlainRecord(a) || !isPlainRecord(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (key) => Object.hasOwn(b, key) && deepEqualUnordered(a[key], b[key])
  );
};

const buildIndexName = (key) => Object.entries(key).map(([field, direction]) => `${field}_${direction}`).join("_");

const textDefaultLanguage = "english";
const textLanguageOverride = "language";
const buildDescription = (index, name) => {
  const description = {
    key: index.key,
    name
  };
  if (index.unique !== void 0) description.unique = index.unique;
  if (index.sparse !== void 0) description.sparse = index.sparse;
  if (index.hidden !== void 0) description.hidden = index.hidden;
  if (index.expireAfterSeconds !== void 0) {
    description.expireAfterSeconds = index.expireAfterSeconds;
  }
  if (index.partialFilterExpression) {
    description.partialFilterExpression = index.partialFilterExpression;
  }
  if (index.collation) description.collation = index.collation;
  if (index.weights) description.weights = index.weights;
  if (index.default_language) {
    description.default_language = index.default_language;
  }
  if (index.language_override) {
    description.language_override = index.language_override;
  }
  if (index.wildcardProjection) {
    description.wildcardProjection = index.wildcardProjection;
  }
  return description;
};
const normalizeDeclaredIndex = (index) => {
  const key = index.key;
  const entries = Object.entries(key);
  if (entries.length === 0) {
    throw new Error("Invalid index: key must have at least one field");
  }
  const textFields = entries.filter(([, direction]) => direction === "text").map(([field]) => field);
  const isText = textFields.length > 0;
  const name = index.name ?? buildIndexName(key);
  const isIdOnly = entries.length === 1 && entries[0][0] === "_id";
  if (name === "_id_" || isIdOnly) {
    throw new Error(
      "Invalid index: _id is always indexed by mongo and cannot be declared"
    );
  }
  const weights = isText ? {
    ...Object.fromEntries(textFields.map((field) => [field, 1])),
    ...index.weights
  } : void 0;
  return {
    name,
    key,
    keyEntries: entries.filter(([, direction]) => direction !== "text"),
    isText,
    options: {
      unique: index.unique ?? false,
      sparse: index.sparse ?? false,
      hidden: index.hidden ?? false,
      expireAfterSeconds: index.expireAfterSeconds,
      partialFilterExpression: index.partialFilterExpression,
      collation: index.collation,
      weights,
      defaultLanguage: isText ? index.default_language ?? textDefaultLanguage : void 0,
      languageOverride: isText ? index.language_override ?? textLanguageOverride : void 0,
      wildcardProjection: index.wildcardProjection
    },
    description: buildDescription(index, name)
  };
};
const normalizeExistingIndex = (existing) => {
  const key = existing.key;
  const entries = Object.entries(key);
  const isText = entries.some(([field]) => field === "_fts");
  return {
    name: existing.name ?? buildIndexName(key),
    key,
    keyEntries: entries.filter(
      ([field]) => field !== "_fts" && field !== "_ftsx"
    ),
    isText,
    options: {
      unique: existing.unique ?? false,
      sparse: existing.sparse ?? false,
      hidden: existing.hidden ?? false,
      expireAfterSeconds: existing.expireAfterSeconds,
      partialFilterExpression: existing.partialFilterExpression,
      collation: existing.collation,
      weights: isText ? existing.weights : void 0,
      defaultLanguage: isText ? existing.default_language ?? textDefaultLanguage : void 0,
      languageOverride: isText ? existing.language_override ?? textLanguageOverride : void 0,
      wildcardProjection: existing.wildcardProjection
    }
  };
};
const normalizeDeclaredIndexes = ({
  collectionName,
  indexes
}) => {
  const normalized = indexes.map((index) => normalizeDeclaredIndex(index));
  const names = /* @__PURE__ */ new Set();
  normalized.forEach(({ name }) => {
    if (names.has(name)) {
      throw new Error(
        `Duplicate index name "${name}" declared on collection "${collectionName}"`
      );
    }
    names.add(name);
  });
  const textIndexes = normalized.filter(({ isText }) => isText);
  if (textIndexes.length > 1) {
    throw new Error(
      `Only one text index is allowed per collection, "${collectionName}" declares ${textIndexes.length}`
    );
  }
  return normalized;
};

const idIndexName = "_id_";
const isSameKey = (declared, existing) => declared.isText === existing.isText && declared.keyEntries.length === existing.keyEntries.length && declared.keyEntries.every(
  ([field, direction], index) => existing.keyEntries[index][0] === field && existing.keyEntries[index][1] === direction
);
const isSameCollation = (declared, existing) => {
  if (!declared) return !existing;
  if (!existing) return false;
  return Object.entries(declared).every(
    ([key, value]) => deepEqualUnordered(value, existing[key])
  );
};
const diffOptions = (declared, existing) => {
  const differences = [];
  const compare = (field, declaredValue, existingValue, equals = deepEqualUnordered) => {
    if (!equals(declaredValue, existingValue)) {
      differences.push({
        field,
        declared: declaredValue,
        existing: existingValue
      });
    }
  };
  compare("unique", declared.options.unique, existing.options.unique);
  compare("sparse", declared.options.sparse, existing.options.sparse);
  compare("hidden", declared.options.hidden, existing.options.hidden);
  compare(
    "expireAfterSeconds",
    declared.options.expireAfterSeconds,
    existing.options.expireAfterSeconds
  );
  compare(
    "partialFilterExpression",
    declared.options.partialFilterExpression,
    existing.options.partialFilterExpression
  );
  compare(
    "collation",
    declared.options.collation,
    existing.options.collation,
    (a, b) => isSameCollation(
      a,
      b
    )
  );
  compare("weights", declared.options.weights, existing.options.weights);
  compare(
    "default_language",
    declared.options.defaultLanguage,
    existing.options.defaultLanguage
  );
  compare(
    "language_override",
    declared.options.languageOverride,
    existing.options.languageOverride
  );
  compare(
    "wildcardProjection",
    declared.options.wildcardProjection,
    existing.options.wildcardProjection
  );
  return differences;
};
const isCollModApplicable = (differences) => differences.length > 0 && differences.every(
  (difference) => difference.field === "hidden" || difference.field === "expireAfterSeconds" && difference.declared !== void 0 && difference.existing !== void 0
);
const buildCollModChanges = (differences) => {
  const changes = {};
  differences.forEach((difference) => {
    if (difference.field === "hidden") {
      changes.hidden = difference.declared;
    } else if (difference.field === "expireAfterSeconds") {
      changes.expireAfterSeconds = difference.declared;
    }
  });
  return changes;
};
const diffIndexes = ({
  collectionName,
  declaredIndexes,
  existingIndexes,
  dropUndeclaredIndexes
}) => {
  const declared = normalizeDeclaredIndexes({
    collectionName,
    indexes: declaredIndexes
  });
  const remainingExisting = /* @__PURE__ */ new Map();
  existingIndexes.forEach((raw) => {
    const normalized = normalizeExistingIndex(raw);
    if (normalized.name === idIndexName) return;
    remainingExisting.set(normalized.name, { normalized, raw });
  });
  const plan = {
    collectionName,
    toCreate: [],
    toRecreate: [],
    toCollMod: [],
    toDrop: [],
    unchanged: [],
    undeclaredKept: []
  };
  declared.forEach((declaredIndex) => {
    const existing = remainingExisting.get(declaredIndex.name);
    if (!existing) {
      plan.toCreate.push({
        name: declaredIndex.name,
        index: declaredIndex.description
      });
      return;
    }
    remainingExisting.delete(declaredIndex.name);
    if (!isSameKey(declaredIndex, existing.normalized)) {
      plan.toRecreate.push({
        name: declaredIndex.name,
        index: declaredIndex.description,
        existing: existing.raw,
        differences: [
          {
            field: "key",
            declared: declaredIndex.key,
            existing: existing.normalized.key
          }
        ]
      });
      return;
    }
    const differences = diffOptions(declaredIndex, existing.normalized);
    if (differences.length === 0) {
      plan.unchanged.push(declaredIndex.name);
    } else if (isCollModApplicable(differences)) {
      plan.toCollMod.push({
        name: declaredIndex.name,
        changes: buildCollModChanges(differences),
        differences
      });
    } else {
      plan.toRecreate.push({
        name: declaredIndex.name,
        index: declaredIndex.description,
        existing: existing.raw,
        differences
      });
    }
  });
  remainingExisting.forEach(({ raw }, name) => {
    if (dropUndeclaredIndexes) {
      plan.toDrop.push({ name, existing: raw });
    } else {
      plan.undeclaredKept.push(name);
    }
  });
  return plan;
};
const isMongoIndexPlanEmpty = (plan) => plan.toCreate.length === 0 && plan.toRecreate.length === 0 && plan.toCollMod.length === 0 && plan.toDrop.length === 0;

class MongoStore {
  keyPath = "_id";
  connection;
  collectionName;
  declaredIndexes;
  _collection;
  constructor(connection, collectionName, { indexes = [] } = {}) {
    this.connection = connection;
    if (!collectionName) {
      throw new Error(`Invalid collectionName: "${collectionName}"`);
    }
    this.collectionName = collectionName;
    this.declaredIndexes = indexes;
    normalizeDeclaredIndexes({ collectionName, indexes });
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
  async planIndexes({
    dropUndeclaredIndexes = true
  } = {}) {
    const collection = await this.collection;
    const existingIndexes = await collection.listIndexes().toArray().catch((error) => {
      if (isNamespaceNotFoundError(error)) return [];
      throw error;
    });
    return diffIndexes({
      collectionName: this.collectionName,
      declaredIndexes: this.declaredIndexes,
      existingIndexes,
      dropUndeclaredIndexes
    });
  }
  async syncIndexes(options = {}) {
    const plan = await this.planIndexes(options);
    const collection = await this.collection;
    const client = await this.connection.getConnection();
    return applyIndexPlan({
      plan,
      collection,
      db: client.db(),
      dryRun: options.dryRun ?? false
    });
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

const logger$1 = new Logger("liwi:mongo:MongoConnection");
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
    logger$1.info("connecting", { connectionStringRedacted });
    const connectPromise = mongodb.MongoClient.connect(connectionString).then((connection) => {
      logger$1.info("connected", { connectionStringRedacted });
      connection.on("close", () => {
        logger$1.warn("close", { connectionStringRedacted });
        this.connectionFailed = true;
        this.getConnection = () => {
          throw new Error("MongoDB connection closed");
        };
      });
      connection.on("timeout", () => {
        logger$1.warn("timeout", { connectionStringRedacted });
        this.connectionFailed = true;
        this.getConnection = () => {
          throw new Error("MongoDB connection timeout");
        };
      });
      connection.on("reconnect", () => {
        logger$1.warn("reconnect", { connectionStringRedacted });
        this.connectionFailed = false;
        this.getConnection = () => Promise.resolve(this._connection);
      });
      connection.on("error", (err) => {
        logger$1.warn("error", { connectionStringRedacted, err });
      });
      this._connection = connection;
      this._connecting = void 0;
      this.getConnection = () => Promise.resolve(this._connection);
      return connection;
    }).catch((error) => {
      logger$1.info("not connected", { connectionStringRedacted });
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

const logger = new Logger("liwi:mongo:MongoRegistry");
class MongoRegistry {
  _stores;
  dropUndeclaredIndexes;
  constructor(stores = [], { dropUndeclaredIndexes = true } = {}) {
    this._stores = [];
    this.dropUndeclaredIndexes = dropUndeclaredIndexes;
    stores.forEach((store) => this.add(store));
  }
  get stores() {
    return this._stores;
  }
  add(store) {
    if (this.getStore(store.collectionName)) {
      logger.warn("collection already registered", {
        collectionName: store.collectionName
      });
    }
    this._stores.push(store);
    return this;
  }
  remove(store) {
    const index = this._stores.indexOf(store);
    if (index !== -1) this._stores.splice(index, 1);
    return this;
  }
  getStore(collectionName) {
    return this._stores.find(
      (store) => store.collectionName === collectionName
    );
  }
  resolveOptions(options = {}) {
    return {
      ...options,
      dropUndeclaredIndexes: options.dropUndeclaredIndexes ?? this.dropUndeclaredIndexes
    };
  }
  sortedStores() {
    return this._stores.toSorted(
      (storeA, storeB) => storeA.collectionName.localeCompare(storeB.collectionName)
    );
  }
  async runSequentially(operation, run) {
    const results = [];
    const errors = [];
    for (const store of this.sortedStores()) {
      try {
        results.push(await run(store));
      } catch (error) {
        logger.error(operation, {
          collectionName: store.collectionName,
          error
        });
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, `${operation} failed`);
    }
    return results;
  }
  planIndexes(options) {
    const resolvedOptions = this.resolveOptions(options);
    return this.runSequentially(
      "planIndexes",
      (store) => store.planIndexes(resolvedOptions)
    );
  }
  syncIndexes(options) {
    const resolvedOptions = this.resolveOptions(options);
    return this.runSequentially(
      "syncIndexes",
      (store) => store.syncIndexes(resolvedOptions)
    );
  }
}

const formatDifference = ({
  field,
  declared,
  existing
}) => `${field}: ${JSON.stringify(existing) ?? "undefined"} -> ${JSON.stringify(declared) ?? "undefined"}`;
const formatDifferences = (differences) => differences.map((difference) => formatDifference(difference)).join(", ");
const buildLines = (plan) => [
  ...plan.toCreate.map(({ name, index }) => ({
    action: "+ create",
    name,
    detail: JSON.stringify(index.key)
  })),
  ...plan.toRecreate.map(({ name, differences }) => ({
    action: "~ recreate",
    name,
    detail: formatDifferences(differences)
  })),
  ...plan.toCollMod.map(({ name, differences }) => ({
    action: "! modify",
    name,
    detail: formatDifferences(differences)
  })),
  ...plan.toDrop.map(({ name }) => ({ action: "- drop", name, detail: "" })),
  ...plan.undeclaredKept.map((name) => ({
    action: "? kept",
    name,
    detail: "undeclared, not dropped"
  }))
];
const formatIndexPlan = (plan) => {
  const lines = buildLines(plan);
  const unchangedCount = plan.unchanged.length;
  if (lines.length === 0) {
    return `${plan.collectionName}
  = ${unchangedCount} unchanged, nothing to do`;
  }
  const actionWidth = Math.max(...lines.map(({ action }) => action.length));
  const nameWidth = Math.max(...lines.map(({ name }) => name.length));
  const formattedLines = lines.map(
    ({ action, name, detail }) => `  ${action.padEnd(actionWidth)}  ${detail ? name.padEnd(nameWidth) : name}${detail ? `  ${detail}` : ""}`
  );
  if (unchangedCount > 0) {
    formattedLines.push(`  = ${unchangedCount} unchanged`);
  }
  return [plan.collectionName, ...formattedLines].join("\n");
};
const formatIndexPlans = (plans) => plans.map((plan) => formatIndexPlan(plan)).join("\n");

const usage = `Usage: [plan|sync] [options]

  plan               print the plan, changes nothing (default)
  sync               apply the plan

  --check            with plan, exit 1 when the plan is not empty
  --dry-run          with sync, compute everything but apply nothing
  --keep-undeclared  do not drop indexes that are not declared`;
const formatSyncResult = ({
  collectionName,
  created,
  modified,
  dropped
}) => `${collectionName}: ${created.length} created, ${modified.length} modified, ${dropped.length} dropped`;
const runIndexesCli = async ({
  registry,
  argv = process.argv.slice(2),
  connection,
  log = console.log,
  logError = console.error
}) => {
  const command = argv.find((arg) => !arg.startsWith("--")) ?? "plan";
  const options = {
    ...argv.includes("--keep-undeclared") ? { dropUndeclaredIndexes: false } : {},
    dryRun: argv.includes("--dry-run")
  };
  try {
    if (command === "plan") {
      const plans = await registry.planIndexes(options);
      log(formatIndexPlans(plans));
      const hasChanges = !plans.every((plan) => isMongoIndexPlanEmpty(plan));
      return argv.includes("--check") && hasChanges ? 1 : 0;
    }
    if (command === "sync") {
      const results = await registry.syncIndexes(options);
      log(formatIndexPlans(results.map(({ plan }) => plan)));
      log(
        results.map(
          (result) => `${formatSyncResult(result)}${result.dryRun ? " (dry run, nothing applied)" : ""}`
        ).join("\n")
      );
      return 0;
    }
    logError(`Unknown command "${command}".

${usage}`);
    return 2;
  } finally {
    await connection?.close();
  }
};

export { MongoConnection, MongoRegistry, MongoStore, buildIndexName, createMongoSubscribeStore, diffIndexes, formatIndexPlan, formatIndexPlans, isMongoIndexPlanEmpty, runIndexesCli };
//# sourceMappingURL=index-node.mjs.map
