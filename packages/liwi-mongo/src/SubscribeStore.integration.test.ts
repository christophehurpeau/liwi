import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type { Changes } from "liwi-store";
import { NotFoundError } from "liwi-store";
import type { Actions } from "liwi-subscribe-store";
import type { MongoMemoryServer } from "mongodb-memory-server-core";
import type { MongoBaseModel } from "./MongoBaseModel.ts";
import MongoConnection from "./MongoConnection.ts";
import MongoStore from "./MongoStore.ts";
import createMongoSubscribeStore from "./createMongoSubscribeStore.ts";

interface Item extends MongoBaseModel {
  label: string;
  flag: boolean;
}

describe(
  "SubscribeStore over MongoStore (integration)",
  {
    skip: !process.env.LIWI_MONGO_INTEGRATION && "set LIWI_MONGO_INTEGRATION=1",
    timeout: 120_000,
  },
  () => {
    let mongod: MongoMemoryServer;
    let connection: MongoConnection;
    let mongoStore: MongoStore<Item>;
    let subscribeStore: ReturnType<typeof createMongoSubscribeStore<Item>>;
    let actions: Actions<Item>[];

    before(async () => {
      const { MongoMemoryServer: MemoryServer } =
        await import("mongodb-memory-server-core");
      mongod = await MemoryServer.create();
      connection = new MongoConnection({
        host: "127.0.0.1",
        port: mongod.instanceInfo!.port,
        database: "liwi-mongo-subscribe-store-test",
      });
      await connection.getConnection();
      mongoStore = new MongoStore<Item>(connection, "items");
    });

    after(async () => {
      await connection.close();
      await mongod.stop();
    });

    beforeEach(async () => {
      await mongoStore.deleteMany({});
      subscribeStore = createMongoSubscribeStore(mongoStore);
      await subscribeStore.insertOne({ _id: "1", label: "a", flag: true });
      actions = [];
      subscribeStore.subscribe((action) => actions.push(action));
    });

    const loadStored = async (): Promise<Item> =>
      (await mongoStore.findByKey("1"))!;

    it("emits the stored prev on partialUpdateOne of a mutated copy", async () => {
      const stored = await loadStored();
      const copy: Item = { ...stored, label: "mutated locally" };

      const next = await subscribeStore.partialUpdateOne(copy, {
        $set: { flag: false },
      });

      assert.deepEqual(next, { ...stored, flag: false });
      assert.deepEqual(actions, [
        { type: "updated", changes: [[stored, next]] },
      ]);
    });

    it("emits the stored prev on replaceOne of a stale copy", async () => {
      const stale = await loadStored();
      await mongoStore.partialUpdateByKey("1", { $set: { label: "b" } });
      const stored = await loadStored();

      const next = await subscribeStore.replaceOne({ ...stale, flag: false });

      assert.notEqual(next, stale);
      assert.deepEqual(actions, [
        { type: "updated", changes: [[stored, next]] },
      ]);
      assert.deepEqual(await loadStored(), next);
    });

    it("emits the stored prev on deleteOne of a stale copy", async () => {
      const stale = await loadStored();
      await mongoStore.partialUpdateByKey("1", { $set: { label: "b" } });
      const stored = await loadStored();

      await subscribeStore.deleteOne(stale);

      assert.deepEqual(actions, [{ type: "deleted", prev: [stored] }]);
      assert.equal(await mongoStore.findByKey("1"), undefined);
    });

    it("removes a document from a query collection when replaceOne makes it leave the criteria", async () => {
      const received: Changes<string, Item[]>[] = [];
      const query = subscribeStore.createQueryCollection<Item, never>({
        criteria: { flag: true },
      });
      query.subscribe((error, changes) => {
        if (error) throw error;
        received.push(changes);
      });

      const copy = await loadStored();
      copy.flag = false;
      await subscribeStore.replaceOne(copy);

      assert.deepEqual(received, [[{ type: "deleted", keys: ["1"] }]]);
    });

    it("emits nothing for writes on a missing key", async () => {
      await assert.rejects(
        subscribeStore.partialUpdateByKey("missing", { $set: { label: "x" } }),
        NotFoundError,
      );
      await assert.rejects(
        subscribeStore.replaceOne({ ...(await loadStored()), _id: "missing" }),
        NotFoundError,
      );
      await subscribeStore.deleteByKey("missing");

      assert.deepEqual(actions, []);
    });

    it("treats a key that no longer matches the criteria as missing", async () => {
      await assert.rejects(
        subscribeStore.partialUpdateByKey(
          "1",
          { $set: { label: "x" } },
          { flag: false },
        ),
        NotFoundError,
      );
      await subscribeStore.deleteByKey("1", { flag: false });

      const stored = await loadStored();
      assert.deepEqual(actions, []);
      assert.equal(stored.label, "a");
    });
  },
);
