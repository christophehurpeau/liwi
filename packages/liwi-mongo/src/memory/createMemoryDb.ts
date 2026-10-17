import type { Document } from "mongodb";
import { cloneDocument } from "./cloneAsStored.ts";
import type { MemoryCollection } from "./createMemoryCollection.ts";
import { createMemoryCollection } from "./createMemoryCollection.ts";
import { createUnsupportedError } from "./errors.ts";
import { guardUnsupported } from "./guardUnsupported.ts";
import type { MemoryIndexChanges } from "./indexes/createMemoryIndexes.ts";
import { settle } from "./settle.ts";

export interface MemoryDb {
  /** The driver's `Db`, for the methods this package implements. */
  readonly api: object;
  readonly clear: () => void;
}

export const createMemoryDb = (databaseName: string): MemoryDb => {
  const collections = new Map<string, MemoryCollection>();

  const getCollection = (collectionName: string): MemoryCollection => {
    const existing = collections.get(collectionName);
    if (existing) return existing;
    const collection = createMemoryCollection({
      databaseName,
      collectionName,
      resolveCollection: (otherName) =>
        getCollection(otherName).listDocuments().map(cloneDocument),
    });
    collections.set(collectionName, collection);
    return collection;
  };

  const runCommand = (command: Document): Document => {
    if ("ping" in command) return { ok: 1 };
    if ("collMod" in command && "index" in command) {
      getCollection(command.collMod as string).modifyIndex(
        command.index as MemoryIndexChanges,
      );
      return { ok: 1 };
    }
    throw createUnsupportedError(
      `db.command({ ${Object.keys(command)[0] ?? ""} })`,
    );
  };

  const api = {
    databaseName,
    collection: (collectionName: string) => getCollection(collectionName).api,
    command: (command: Document) => settle(() => runCommand(command)),
    dropDatabase: () =>
      settle(() => {
        collections.forEach((collection) =>{  collection.drop(); });
        return true;
      }),
  };

  return {
    api: guardUnsupported(api, `db(${databaseName})`),
    clear: () => {
      collections.forEach((collection) =>{  collection.clear(); });
    },
  };
};
