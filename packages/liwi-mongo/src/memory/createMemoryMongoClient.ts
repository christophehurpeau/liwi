import type { MongoClient } from "mongodb";
import type { MemoryDb } from "./createMemoryDb.ts";
import { createMemoryDb } from "./createMemoryDb.ts";
import { guardUnsupported } from "./guardUnsupported.ts";

export interface MemoryMongoClient {
  /** For `new MongoConnection({ client })`. A driver method it does not implement throws when read. */
  client: MongoClient;
  /** Empties every collection of every database; indexes stay. */
  clear: () => void;
}

export interface MemoryMongoClientOptions {
  /** The database `client.db()` returns. */
  database?: string;
}

export const createMemoryMongoClient = ({
  database = "liwi-memory",
}: MemoryMongoClientOptions = {}): MemoryMongoClient => {
  const databases = new Map<string, MemoryDb>();

  const getDb = (databaseName: string): MemoryDb => {
    const existing = databases.get(databaseName);
    if (existing) return existing;
    const db = createMemoryDb(databaseName);
    databases.set(databaseName, db);
    return db;
  };

  const target: Record<string, unknown> = {
    db: (databaseName: string = database) => getDb(databaseName).api,
    close: () => Promise.resolve(),
  };
  const client = guardUnsupported(target, "client") as unknown as MongoClient;
  target.connect = () => Promise.resolve(client);
  target.on = () => client;

  return {
    client,
    clear: () => {
      databases.forEach((db) =>{  db.clear(); });
    },
  };
};
