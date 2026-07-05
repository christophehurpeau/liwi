class SubscribeStore {
  store;
  listeners = /* @__PURE__ */ new Set();
  keyPath;
  constructor(store) {
    this.store = store;
    this.keyPath = store.keyPath;
  }
  get connection() {
    return this.store.connection;
  }
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  callSubscribed(action) {
    this.listeners.forEach((listener) => listener(action));
  }
  createQuerySingleItem(options) {
    const query = this.store.createQuerySingleItem(options);
    query.setSubscribeStore(this);
    return query;
  }
  createQueryCollection(options) {
    const query = this.store.createQueryCollection(options);
    query.setSubscribeStore(this);
    return query;
  }
  findAll(criteria, sort) {
    return this.store.findAll(criteria, sort);
  }
  findByKey(key, criteria) {
    return this.store.findByKey(key, criteria);
  }
  findOne(criteria, sort) {
    return this.store.findOne(criteria, sort);
  }
  async insertOne(object) {
    const inserted = await this.store.insertOne(object);
    this.callSubscribed({ type: "inserted", next: [inserted] });
    return inserted;
  }
  async replaceOne(object) {
    const replaced = await this.store.replaceOne(object);
    this.callSubscribed({ type: "updated", changes: [[object, replaced]] });
    return replaced;
  }
  async replaceSeveral(objects) {
    const replacedObjects = await this.store.replaceSeveral(objects);
    this.callSubscribed({
      type: "updated",
      changes: objects.map((prev, index) => [prev, replacedObjects[index]])
    });
    return replacedObjects;
  }
  async upsertOne(object, setOnInsertPartialObject) {
    const result = await this.upsertOneWithInfo(
      object,
      setOnInsertPartialObject
    );
    return result.object;
  }
  async upsertOneWithInfo(object, setOnInsertPartialObject) {
    const upsertedWithInfo = await this.store.upsertOneWithInfo(
      object,
      setOnInsertPartialObject
    );
    if (upsertedWithInfo.inserted) {
      this.callSubscribed({
        type: "inserted",
        next: [upsertedWithInfo.object]
      });
    } else {
      throw new Error("TODO");
    }
    return upsertedWithInfo;
  }
  async partialUpdateByKey(key, partialUpdate, criteria) {
    return this.partialUpdateOne(
      await this.findOne({
        [this.store.keyPath]: key,
        ...criteria
      }),
      partialUpdate
    );
  }
  async partialUpdateOne(object, partialUpdate) {
    const updated = await this.store.partialUpdateOne(object, partialUpdate);
    this.callSubscribed({ type: "updated", changes: [[object, updated]] });
    return updated;
  }
  async partialUpdateMany(criteria, partialUpdate) {
    const cursor = await this.store.cursor(criteria);
    const changes = [];
    await cursor.forEach(async (model) => {
      const key = model[this.store.keyPath];
      const updated = await this.store.partialUpdateByKey(
        key,
        partialUpdate,
        criteria
      );
      changes.push([model, updated]);
    });
    this.callSubscribed({ type: "updated", changes });
  }
  async deleteByKey(key, criteria) {
    return this.deleteOne(await this.findByKey(key, criteria));
  }
  async deleteOne(object) {
    await this.store.deleteOne(object);
    this.callSubscribed({ type: "deleted", prev: [object] });
  }
  async deleteMany(criteria) {
    const cursor = await this.store.cursor(criteria);
    const prev = await cursor.toArray();
    await this.store.deleteMany(criteria);
    this.callSubscribed({ type: "deleted", prev });
  }
  async count(criteria) {
    return this.store.count(criteria);
  }
  async cursor(criteria, sort) {
    const cursor = await this.store.cursor(criteria, sort);
    cursor.overrideStore(this);
    return cursor;
  }
}

class AbstractSubscribableStoreQuery {
  changeParams(params) {
    throw new Error("Method not supported. Please create a new query.");
  }
  changePartialParams(params) {
    throw new Error("Method not supported. Please create a new query.");
  }
  _subscribeStore;
  setSubscribeStore(store) {
    this._subscribeStore = store;
  }
  getSubscribeStore() {
    if (!this._subscribeStore) {
      throw new Error("_subscribeStore is not initialized");
    }
    return this._subscribeStore;
  }
  fetchAndSubscribe(callback) {
    return this._subscribe(callback, true);
  }
  subscribe(callback) {
    return this._subscribe(callback, false);
  }
}

export { AbstractSubscribableStoreQuery, SubscribeStore };
//# sourceMappingURL=index-browser.es.js.map
