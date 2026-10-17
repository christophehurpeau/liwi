import { ProcessingMode, aggregate, find } from "mingo";
import type {
  Document,
  IndexDescription,
  IndexDirection,
  Sort,
  UpdateResult,
} from "mongodb";
import mongodb from "mongodb";
import type { MemoryUpdate } from "./applyUpdate.ts";
import { applyUpdate, assertUpdate, createUpsertBase } from "./applyUpdate.ts";
import { cloneDocument } from "./cloneAsStored.ts";
import type { MemoryCursor, MemoryFindOptions } from "./createMemoryCursor.ts";
import {
  createMemoryCursor,
  createMemoryFindCursor,
} from "./createMemoryCursor.ts";
import {
  createDuplicateKeyError,
  createImmutableIdError,
  createNamespaceNotFoundError,
} from "./errors.ts";
import { guardUnsupported } from "./guardUnsupported.ts";
import type { MemoryIndexChanges } from "./indexes/createMemoryIndexes.ts";
import { createMemoryIndexes } from "./indexes/createMemoryIndexes.ts";
import { normalizeSort } from "./normalizeSort.ts";
import { queryOptions } from "./queryOptions.ts";
import { serializeKey } from "./serializeKey.ts";
import { settle } from "./settle.ts";

interface UpdateOptions {
  upsert?: boolean;
  arrayFilters?: Document[];
  sort?: Sort;
}

interface UpdateWrite {
  filter: Document;
  update: MemoryUpdate;
  arrayFilters: Document[] | undefined;
}

interface FindOneAndUpdateOptions extends UpdateOptions {
  returnDocument?: "after" | "before";
  projection?: Document;
}

interface FindOneAndDeleteOptions {
  sort?: Sort;
  projection?: Document;
}

export interface MemoryCollection {
  /** The driver's `Collection`, for the methods this package implements. */
  readonly api: object;
  readonly listDocuments: () => Document[];
  readonly modifyIndex: (changes: MemoryIndexChanges) => void;
  readonly clear: () => void;
  readonly drop: () => void;
}

interface CreateMemoryCollectionParams {
  databaseName: string;
  collectionName: string;
  /** `$lookup`, `$graphLookup` and `$unionWith` read other collections of the database. */
  resolveCollection: (collectionName: string) => Document[];
}

/** mongod stores `_id` first. */
const toStoredDocument = (document: Document): Document => {
  const stored = cloneDocument(document);
  return Object.fromEntries([
    ["_id", stored._id as unknown],
    ...Object.entries(stored).filter(([field]) => field !== "_id"),
  ]);
};

export const createMemoryCollection = ({
  databaseName,
  collectionName,
  resolveCollection,
}: CreateMemoryCollectionParams): MemoryCollection => {
  const namespace = `${databaseName}.${collectionName}`;
  const documents = new Map<string, Document>();
  const indexes = createMemoryIndexes(namespace);
  let exists = false;

  const listDocuments = (): Document[] => [...documents.values()];

  /**
   * Stored documents themselves: clone before handing them out. The filter is read
   * as the driver serializes it, `undefined` as `null`.
   */
  const findStored = (
    filter: Document = {},
    { sort, projection, skip, limit }: MemoryFindOptions = {},
  ): Document[] => {
    const cursor = find<Document>(
      listDocuments(),
      cloneDocument(filter),
      projection,
      queryOptions,
    );
    if (sort) cursor.sort(normalizeSort(sort));
    if (skip) cursor.skip(skip);
    if (limit) cursor.limit(Math.abs(limit));
    return cursor.all();
  };

  const findFirstStored = (
    filter: Document | undefined,
    sort: Sort | undefined,
  ): Document | undefined => findStored(filter, { sort, limit: 1 })[0];

  const project = (
    document: Document,
    projection: Document | undefined,
  ): Document =>
    cloneDocument(
      projection
        ? find<Document>([document], {}, projection, queryOptions).all()[0]!
        : document,
    );

  const insertStored = (document: Document): void => {
    const documentKey = serializeKey(document._id);
    if (documents.has(documentKey)) {
      throw createDuplicateKeyError({
        namespace,
        indexName: "_id_",
        keyPattern: { _id: 1 },
        keyValue: { _id: document._id as unknown },
      });
    }
    indexes.assertCanWrite(documentKey, document);
    indexes.write(documentKey, undefined, document);
    documents.set(documentKey, document);
    exists = true;
  };

  const replaceStored = (previous: Document, next: Document): void => {
    const documentKey = serializeKey(previous._id);
    if (serializeKey(next._id) !== documentKey) throw createImmutableIdError();
    indexes.assertCanWrite(documentKey, next);
    indexes.write(documentKey, previous, next);
    documents.set(documentKey, next);
  };

  const removeStored = (document: Document): void => {
    const documentKey = serializeKey(document._id);
    indexes.write(documentKey, document, undefined);
    documents.delete(documentKey);
  };

  /** Like the driver, sets a generated `_id` on the caller's document when it has none. */
  const assignId = (document: Document): Document => {
    if (document._id === undefined) document._id = new mongodb.ObjectId();
    return document;
  };

  const updateStored = (
    previous: Document,
    { filter, update, arrayFilters }: UpdateWrite,
  ): Document | undefined => {
    const { next, isModified } = applyUpdate(previous, update, {
      filter,
      arrayFilters,
      isInsert: false,
    });
    if (!isModified) return undefined;
    const stored = toStoredDocument(next);
    replaceStored(previous, stored);
    return stored;
  };

  const upsertStored = ({
    filter,
    update,
    arrayFilters,
  }: UpdateWrite): Document => {
    const { next } = applyUpdate(createUpsertBase(filter), update, {
      filter,
      arrayFilters,
      isInsert: true,
    });
    const stored = toStoredDocument(assignId(next));
    insertStored(stored);
    return stored;
  };

  const updateMatching = (
    write: UpdateWrite,
    { upsert, sort }: UpdateOptions,
    limit: number | undefined,
  ): UpdateResult => {
    assertUpdate(write.update);
    const matched = findStored(write.filter, { sort, limit });
    if (matched.length === 0 && upsert) {
      const inserted = upsertStored(write);
      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 1,
        upsertedId: inserted._id as mongodb.ObjectId,
      };
    }
    const modifiedCount = matched.filter((previous) =>
      updateStored(previous, write),
    ).length;
    return {
      acknowledged: true,
      matchedCount: matched.length,
      modifiedCount,
      upsertedCount: 0,
      upsertedId: null,
    };
  };

  const assertExists = (): void => {
    if (!exists) throw createNamespaceNotFoundError(namespace);
  };

  const createIndexes = (
    descriptions: readonly IndexDescription[],
  ): string[] => {
    const names = indexes.create(descriptions, documents);
    exists = true;
    return names;
  };

  const listIndexes = (): Document[] => {
    assertExists();
    return indexes.list().map(cloneDocument);
  };

  const drop = (): void => {
    documents.clear();
    indexes.dropAll();
    exists = false;
  };

  const api = {
    collectionName,
    dbName: databaseName,
    namespace,

    insertOne: (document: Document) =>
      settle(() => {
        const stored = toStoredDocument(assignId(document));
        insertStored(stored);
        return { acknowledged: true, insertedId: stored._id as unknown };
      }),
    insertMany: (newDocuments: readonly Document[]) =>
      settle(() => {
        const insertedIds = Object.fromEntries(
          newDocuments.map((document, index) => {
            const stored = toStoredDocument(assignId(document));
            insertStored(stored);
            return [index, stored._id as unknown];
          }),
        );
        return {
          acknowledged: true,
          insertedCount: newDocuments.length,
          insertedIds,
        };
      }),

    findOne: (filter?: Document, options: MemoryFindOptions = {}) =>
      settle(() => {
        const [document] = findStored(filter, { ...options, limit: 1 });
        return document ? cloneDocument(document) : null;
      }),
    find: (filter?: Document, options: MemoryFindOptions = {}) =>
      createMemoryFindCursor(
        (findOptions) => findStored(filter, findOptions).map(cloneDocument),
        options,
      ),
    countDocuments: (
      filter?: Document,
      { skip, limit }: MemoryFindOptions = {},
    ) => settle(() => findStored(filter, { skip, limit }).length),
    estimatedDocumentCount: () => settle(() => documents.size),
    aggregate: (pipeline: Document[] = []): MemoryCursor<Document> =>
      createMemoryCursor(() =>
        aggregate(listDocuments(), pipeline, {
          ...queryOptions,
          processingMode: ProcessingMode.CLONE_INPUT,
          collectionResolver: resolveCollection,
        }).map(cloneDocument),
      ),

    updateOne: (
      filter: Document,
      update: MemoryUpdate,
      options: UpdateOptions = {},
    ) =>
      settle(() =>
        updateMatching(
          { filter, update, arrayFilters: options.arrayFilters },
          options,
          1,
        ),
      ),
    updateMany: (
      filter: Document,
      update: MemoryUpdate,
      options: UpdateOptions = {},
    ) =>
      settle(() =>
        updateMatching(
          { filter, update, arrayFilters: options.arrayFilters },
          options,
          undefined,
        ),
      ),
    findOneAndUpdate: (
      filter: Document,
      update: MemoryUpdate,
      {
        upsert,
        arrayFilters,
        sort,
        returnDocument = "before",
        projection,
      }: FindOneAndUpdateOptions = {},
    ) =>
      settle(() => {
        assertUpdate(update);
        const write: UpdateWrite = { filter, update, arrayFilters };
        const previous = findFirstStored(filter, sort);
        if (!previous) {
          if (!upsert) return null;
          const inserted = upsertStored(write);
          return returnDocument === "after"
            ? project(inserted, projection)
            : null;
        }
        const next = updateStored(previous, write) ?? previous;
        return project(
          returnDocument === "after" ? next : previous,
          projection,
        );
      }),

    deleteOne: (filter?: Document) =>
      settle(() => {
        const document = findFirstStored(filter, undefined);
        if (document) removeStored(document);
        return { acknowledged: true, deletedCount: document ? 1 : 0 };
      }),
    deleteMany: (filter?: Document) =>
      settle(() => {
        const matched = findStored(filter);
        matched.forEach(removeStored);
        return { acknowledged: true, deletedCount: matched.length };
      }),
    findOneAndDelete: (
      filter: Document,
      { sort, projection }: FindOneAndDeleteOptions = {},
    ) =>
      settle(() => {
        const document = findFirstStored(filter, sort);
        if (!document) return null;
        removeStored(document);
        return project(document, projection);
      }),

    createIndexes: (descriptions: readonly IndexDescription[]) =>
      settle(() => createIndexes(descriptions)),
    createIndex: (
      key: Record<string, IndexDirection>,
      options: Omit<IndexDescription, "key"> = {},
    ) => settle(() => createIndexes([{ ...options, key }])[0]!),
    listIndexes: () => createMemoryCursor(listIndexes),
    indexes: () => settle(listIndexes),
    dropIndex: (name: string) =>
      settle(() => {
        assertExists();
        indexes.drop(name);
        return { ok: 1 };
      }),

    drop: () =>
      settle(() => {
        drop();
        return true;
      }),
  };

  return {
    api: guardUnsupported(api, `collection(${collectionName})`),
    listDocuments,
    modifyIndex: (changes) => {
      assertExists();
      indexes.modify(changes);
    },
    clear: () => {
      documents.clear();
      indexes.clearDocuments();
    },
    drop,
  };
};
