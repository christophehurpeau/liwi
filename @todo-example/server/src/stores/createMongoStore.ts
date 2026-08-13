import { config } from "alp-node";
import { MongoConnection, MongoRegistry, MongoStore } from "liwi-mongo";
import type {
  MongoBaseModel,
  MongoConfig,
  MongoStoreOptions,
} from "liwi-mongo";

export { createMongoSubscribeStore, type SubscribeStore } from "liwi-mongo";

declare module "alp-node" {
  interface DbConfig {
    mongodb: MongoConfig;
  }

  interface ConfigValues {
    db?: DbConfig;
  }
}

const mongoConfig = config.get("db")?.mongodb;
if (!mongoConfig) throw new Error("Invalid mongo config (db.mongodb)");

export const mongoConnection: MongoConnection = new MongoConnection({
  ...mongoConfig,
  ...(process.env.MONGO_PORT ? { port: process.env.MONGO_PORT } : {}),
});

export const mongoRegistry: MongoRegistry = new MongoRegistry();

export const createMongoStore = <Model extends MongoBaseModel>(
  collectionName: string,
  options?: MongoStoreOptions<Model>,
): MongoStore<Model> => {
  const store = new MongoStore<Model>(mongoConnection, collectionName, options);
  mongoRegistry.add(store);
  return store;
};
