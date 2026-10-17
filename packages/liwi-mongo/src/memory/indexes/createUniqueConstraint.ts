import { Query } from "mingo";
import type { CollationOptions, Document, IndexDescription } from "mongodb";
import { createDuplicateKeyError } from "../errors.ts";
import { serializeKey } from "../serializeKey.ts";

const emptyArray = Symbol("empty array");

interface IndexEntry {
  key: string;
  values: unknown[];
}

export interface UniqueConstraint {
  /** Throws mongod's duplicate key error when another document holds one of its keys. */
  assertCanWrite: (documentKey: string, document: Document) => void;
  /** Moves the keys of `previous` to `next`; either is `undefined` on insert / delete. */
  write: (
    documentKey: string,
    previous: Document | undefined,
    next: Document | undefined,
  ) => void;
  clear: () => void;
}

const isDocument = (value: unknown): value is Document =>
  typeof value === "object" &&
  value !== null &&
  !(value instanceof Date) &&
  !(value instanceof RegExp) &&
  !("_bsontype" in value);

/** Every value a multikey index sees at `path`: array items, not the array. */
const valuesAtPath = (value: unknown, path: readonly string[]): unknown[] => {
  if (path.length === 0) {
    if (!Array.isArray(value)) return [value];
    return value.length === 0 ? [emptyArray] : value;
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => valuesAtPath(item, path));
  }
  if (!isDocument(value)) return [undefined];
  const [field, ...rest] = path;
  return valuesAtPath(value[field!], rest);
};

const cartesianProduct = (lists: readonly unknown[][]): unknown[][] => {
  let combinations: unknown[][] = [[]];
  for (const list of lists) {
    combinations = combinations.flatMap((combination) =>
      list.map((value) => [...combination, value]),
    );
  }
  return combinations;
};

/** Strength 1 ignores case and accents, 2 ignores case: the strengths a unique index uses in practice. */
const createStringFolder = (
  collation: CollationOptions | undefined,
): ((value: string) => string) => {
  const strength = collation?.strength ?? 3;
  if (!collation || strength >= 3) return (value) => value;
  const locale = collation.locale === "simple" ? undefined : collation.locale;
  if (strength === 2) return (value) => value.toLocaleLowerCase(locale);
  return (value) =>
    value
      .normalize("NFD")
      .replaceAll(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase(locale);
};

interface CreateUniqueConstraintParams {
  namespace: string;
  indexName: string;
  description: IndexDescription;
}

export const createUniqueConstraint = ({
  namespace,
  indexName,
  description,
}: CreateUniqueConstraintParams): UniqueConstraint => {
  const keyPattern: Document = Object.fromEntries(
    Object.entries(description.key).filter(
      ([, direction]) => direction !== "text",
    ),
  );
  const paths = Object.keys(keyPattern).map((field) => field.split("."));
  const partialFilter = description.partialFilterExpression
    ? new Query(description.partialFilterExpression, { idKey: "_id" })
    : undefined;
  const foldString = createStringFolder(description.collation);
  const owners = new Map<string, string>();

  const serializeValue = (value: unknown): string => {
    if (value === emptyArray) return "[]";
    if (value === undefined) return serializeKey(null);
    return serializeKey(typeof value === "string" ? foldString(value) : value);
  };

  const listEntries = (document: Document): IndexEntry[] => {
    if (partialFilter && !partialFilter.test(document)) return [];
    const valuesByField = paths.map((path) => valuesAtPath(document, path));
    const isMissingEveryField = valuesByField.every((values) =>
      values.every((value) => value === undefined),
    );
    if (description.sparse && isMissingEveryField) return [];

    const entries = new Map<string, IndexEntry>();
    cartesianProduct(valuesByField).forEach((values) => {
      const key = JSON.stringify(values.map(serializeValue));
      entries.set(key, { key, values });
    });
    return [...entries.values()];
  };

  const toKeyValue = (values: readonly unknown[]): Document =>
    Object.fromEntries(
      Object.keys(keyPattern).map((field, index) => {
        const value = values[index];
        return [field, value === emptyArray ? [] : (value ?? null)];
      }),
    );

  return {
    assertCanWrite: (documentKey, document) => {
      listEntries(document).forEach(({ key, values }) => {
        const owner = owners.get(key);
        if (owner === undefined || owner === documentKey) return;
        throw createDuplicateKeyError({
          namespace,
          indexName,
          keyPattern,
          keyValue: toKeyValue(values),
        });
      });
    },
    write: (documentKey, previous, next) => {
      if (previous) {
        listEntries(previous).forEach(({ key }) => {
          if (owners.get(key) === documentKey) owners.delete(key);
        });
      }
      if (next) {
        listEntries(next).forEach(({ key }) => owners.set(key, documentKey));
      }
    },
    clear: () => {
      owners.clear();
    },
  };
};
