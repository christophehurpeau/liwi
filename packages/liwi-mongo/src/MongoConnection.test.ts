import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMongoConnectionString } from "./MongoConnection.ts";

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
