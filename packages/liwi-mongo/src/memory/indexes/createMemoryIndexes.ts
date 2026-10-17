import type { Document, IndexDescription, IndexDescriptionInfo } from "mongodb";
import {
  createIndexKeySpecsConflictError,
  createIndexNotFoundError,
  createIndexOptionsConflictError,
  createInvalidOptionsError,
} from "../errors.ts";
import { serializeKey } from "../serializeKey.ts";
import { createIndexInfo, idIndexInfo } from "./createIndexInfo.ts";
import type { UniqueConstraint } from "./createUniqueConstraint.ts";
import { createUniqueConstraint } from "./createUniqueConstraint.ts";

interface MemoryIndex {
  info: IndexDescriptionInfo;
  unique?: UniqueConstraint;
}

export interface MemoryIndexChanges {
  name: string;
  hidden?: boolean;
  expireAfterSeconds?: number;
}

export interface MemoryIndexes {
  list: () => IndexDescriptionInfo[];
  /** Validates every description first, like `createIndexes`: nothing is created on a conflict. */
  create: (
    descriptions: readonly IndexDescription[],
    documents: ReadonlyMap<string, Document>,
  ) => string[];
  drop: (name: string) => void;
  dropAll: () => void;
  modify: (changes: MemoryIndexChanges) => void;
  assertCanWrite: (documentKey: string, document: Document) => void;
  write: (
    documentKey: string,
    previous: Document | undefined,
    next: Document | undefined,
  ) => void;
  clearDocuments: () => void;
}

const serializeSpec = ({
  v: _version,
  ...info
}: IndexDescriptionInfo): string =>
  serializeKey(
    Object.fromEntries(
      Object.entries(info).toSorted(([fieldA], [fieldB]) =>
        fieldA.localeCompare(fieldB),
      ),
    ),
  );

const isSameKeySpace = (
  a: IndexDescriptionInfo,
  b: IndexDescriptionInfo,
): boolean =>
  serializeKey(a.key) === serializeKey(b.key) &&
  serializeKey(a.partialFilterExpression ?? null) ===
    serializeKey(b.partialFilterExpression ?? null) &&
  serializeKey(a.collation ?? null) === serializeKey(b.collation ?? null);

const isTextInfo = (info: IndexDescriptionInfo): boolean => "_fts" in info.key;

export const createMemoryIndexes = (namespace: string): MemoryIndexes => {
  const indexes = new Map<string, MemoryIndex>();

  const listInfos = (): IndexDescriptionInfo[] => [
    idIndexInfo,
    ...[...indexes.values()].map(({ info }) => info),
  ];

  const isAlreadyCreated = (info: IndexDescriptionInfo): boolean => {
    const sameName = listInfos().find(({ name }) => name === info.name);
    if (sameName) {
      if (serializeSpec(sameName) === serializeSpec(info)) return true;
      throw createIndexKeySpecsConflictError(
        `An existing index has the same name as the requested index. Requested index: ${JSON.stringify(info)}, existing index: ${JSON.stringify(sameName)}`,
      );
    }
    const sameKey = listInfos().find((existing) =>
      isSameKeySpace(existing, info),
    );
    if (sameKey) {
      throw createIndexOptionsConflictError(
        `Index already exists with a different name: ${String(sameKey.name)}`,
      );
    }
    const otherText = isTextInfo(info) && listInfos().find(isTextInfo);
    if (otherText) {
      throw createIndexOptionsConflictError(
        `An equivalent index already exists with a different name and options. Requested index: ${JSON.stringify(info)}, existing index: ${JSON.stringify(otherText)}`,
      );
    }
    return false;
  };

  const buildIndex = (
    description: IndexDescription,
    info: IndexDescriptionInfo,
    documents: ReadonlyMap<string, Document>,
  ): MemoryIndex => {
    if (!description.unique) return { info };
    const unique = createUniqueConstraint({
      namespace,
      indexName: info.name!,
      description,
    });
    documents.forEach((document, documentKey) => {
      unique.assertCanWrite(documentKey, document);
      unique.write(documentKey, undefined, document);
    });
    return { info, unique };
  };

  const getIndex = (name: string): MemoryIndex => {
    const index = indexes.get(name);
    if (!index) throw createIndexNotFoundError(name);
    return index;
  };

  const listUniqueConstraints = (): UniqueConstraint[] =>
    [...indexes.values()].flatMap(({ unique }) => (unique ? [unique] : []));

  return {
    list: listInfos,
    create: (descriptions, documents) => {
      const created = descriptions
        .map((description) => ({
          description,
          info: createIndexInfo(description),
        }))
        .filter(({ info }) => !isAlreadyCreated(info))
        .map(({ description, info }) =>
          buildIndex(description, info, documents),
        );

      created.forEach((index) => indexes.set(index.info.name!, index));
      return descriptions.map(
        (description) => createIndexInfo(description).name!,
      );
    },
    drop: (name) => {
      if (name === idIndexInfo.name) {
        throw createInvalidOptionsError("cannot drop _id index");
      }
      getIndex(name);
      indexes.delete(name);
    },
    dropAll: () => {
      indexes.clear();
    },
    modify: ({ name, hidden, expireAfterSeconds }) => {
      const { info } = getIndex(name);
      if (hidden === true) info.hidden = true;
      if (hidden === false) delete info.hidden;
      if (expireAfterSeconds !== undefined) {
        info.expireAfterSeconds = expireAfterSeconds;
      }
    },
    assertCanWrite: (documentKey, document) => {
      listUniqueConstraints().forEach((unique) =>{ 
        unique.assertCanWrite(documentKey, document); },
      );
    },
    write: (documentKey, previous, next) => {
      listUniqueConstraints().forEach((unique) =>{ 
        unique.write(documentKey, previous, next); },
      );
    },
    clearDocuments: () => {
      listUniqueConstraints().forEach((unique) =>{  unique.clear(); });
    },
  };
};
