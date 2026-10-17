import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type mongodb from "mongodb";
import MongoConnection, {
  buildMongoConnectionString,
} from "./MongoConnection.ts";

describe("MongoConnection with a client", () => {
  it("uses the client without connecting, and closes it", async () => {
    const close = mock.fn(() => Promise.resolve());
    const client = {
      on: () => client,
      close,
    } as unknown as mongodb.MongoClient;

    const connection = new MongoConnection({ client });

    assert.equal(await connection.getConnection(), client);
    await connection.close();
    assert.equal(close.mock.callCount(), 1);
    await assert.rejects(connection.getConnection(), {
      message: "Connection closed",
    });
  });
});

describe("buildMongoConnectionString", () => {
  it("uses default host and port", () => {
    assert.equal(
      buildMongoConnectionString({ database: "db", redactCredentials: false }),
      "mongodb://localhost:27017/db",
    );
  });

  it("includes encoded credentials", () => {
    assert.equal(
      buildMongoConnectionString({
        host: "mongo",
        port: 1234,
        database: "db",
        user: "user@x",
        password: "p:ss",
        redactCredentials: false,
      }),
      "mongodb://user%40x:p%3Ass@mongo:1234/db",
    );
  });

  it("redacts credentials", () => {
    assert.equal(
      buildMongoConnectionString({
        database: "db",
        user: "username",
        password: "secret",
        redactCredentials: true,
      }),
      "mongodb://us[redacted]:[redacted]@localhost:27017/db",
    );
  });

  it("appends authSource when provided", () => {
    assert.equal(
      buildMongoConnectionString({
        database: "db",
        user: "user",
        password: "pass",
        authSource: "admin",
        redactCredentials: false,
      }),
      "mongodb://user:pass@localhost:27017/db?authSource=admin",
    );
  });

  it("keeps authSource in redacted connection string", () => {
    assert.equal(
      buildMongoConnectionString({
        database: "db",
        user: "user",
        password: "pass",
        authSource: "admin",
        redactCredentials: true,
      }),
      "mongodb://us[redacted]:[redacted]@localhost:27017/db?authSource=admin",
    );
  });

  it("omits authSource when empty", () => {
    assert.equal(
      buildMongoConnectionString({
        database: "db",
        authSource: "",
        redactCredentials: false,
      }),
      "mongodb://localhost:27017/db",
    );
  });
});
