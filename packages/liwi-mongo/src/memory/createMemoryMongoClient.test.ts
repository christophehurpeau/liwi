import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Collection } from "mongodb";
import type { MongoBaseModel } from "../MongoBaseModel.ts";
import MongoConnection from "../MongoConnection.ts";
import MongoRegistry from "../MongoRegistry.ts";
import MongoStore from "../MongoStore.ts";
import { createMemoryMongoClient } from "./createMemoryMongoClient.ts";

interface User extends MongoBaseModel {
  email: string;
}

const createConnection = (): {
  connection: MongoConnection;
  clear: () => void;
} => {
  const { client, clear } = createMemoryMongoClient();
  return { connection: new MongoConnection({ client }), clear };
};

describe("createMemoryMongoClient", () => {
  it("keeps data across stores of the same collection until clear, and indexes after it", async () => {
    const { connection, clear } = createConnection();
    const users = new MongoStore<User>(connection, "users", {
      indexes: [{ key: { email: 1 }, unique: true }],
    });
    await new MongoRegistry([users]).syncIndexes();
    await users.insertOne({ _id: "1", email: "a@x" });

    const sameUsers = new MongoStore<User>(connection, "users");
    const found = await sameUsers.findByKey("1");
    assert.equal(found?.email, "a@x");

    clear();

    assert.equal(await users.count(), 0);
    await users.insertOne({ email: "a@x" });
    await assert.rejects(users.insertOne({ email: "a@x" }), { code: 11_000 });
  });

  it("keeps databases and clients apart", async () => {
    const { client } = createMemoryMongoClient({ database: "main" });
    await client
      .db()
      .collection("users")
      .insertOne({ _id: "1" } as never);

    assert.equal(client.db().databaseName, "main");
    assert.equal(
      await client.db("other").collection("users").countDocuments(),
      0,
    );
    assert.equal(
      await createMemoryMongoClient({ database: "main" })
        .client.db()
        .collection("users")
        .countDocuments(),
      0,
    );
  });

  it("names a driver method it does not implement", async () => {
    const { connection } = createConnection();
    const collection = (await new MongoStore<User>(connection, "users")
      .collection) as unknown as Collection;

    assert.throws(() => collection.watch(), {
      message: "liwi-mongo/memory: collection(users).watch is not supported",
    });
  });

  it("hands out copies: mutating a result leaves the stored document", async () => {
    const { connection } = createConnection();
    const users = new MongoStore<User>(connection, "users");
    const inserted = await users.insertOne({ _id: "1", email: "a@x" });
    inserted.email = "mutated";

    const [found] = await users.findAll();
    found!.email = "mutated";

    const stored = await users.findByKey("1");
    assert.equal(stored?.email, "a@x");
  });
});
