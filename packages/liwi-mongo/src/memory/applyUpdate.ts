import { updateOne } from "mingo";
import type { Document } from "mongodb";
import mongodb from "mongodb";
import { cloneAsStored, cloneDocument } from "./cloneAsStored.ts";
import { toServerError } from "./errors.ts";
import { queryOptions } from "./queryOptions.ts";
import { serializeKey } from "./serializeKey.ts";

export type MemoryUpdate = Document | Document[];

const isOperatorObject = (value: unknown): value is Document =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !(value instanceof RegExp) &&
  !("_bsontype" in value) &&
  Object.keys(value).some((key) => key.startsWith("$"));

/** The driver rejects these before sending them. */
export const assertUpdate = (update: MemoryUpdate): void => {
  if (Array.isArray(update)) return;
  const operators = Object.keys(update);
  if (
    operators.length === 0 ||
    !operators.every((operator) => operator.startsWith("$"))
  ) {
    throw new mongodb.MongoInvalidArgumentError(
      "Update document requires atomic operators",
    );
  }
};

const omitField = (document: Document, omitted: string): Document =>
  Object.fromEntries(
    Object.entries(document).filter(([field]) => field !== omitted),
  );

const prepareModifier = (
  update: Document,
  isInsert: boolean,
): Document | undefined => {
  const $setOnInsert = update.$setOnInsert as Document | undefined;
  const modifier = omitField(update, "$setOnInsert");
  if (isInsert && $setOnInsert) {
    return {
      ...modifier,
      $set: { ...(modifier.$set as Document | undefined), ...$setOnInsert },
    };
  }
  return Object.keys(modifier).length === 0 ? undefined : modifier;
};

/**
 * mongod accepts `$set` of `_id` to its current value, as `upsertOne` sends, and of
 * any value on an upsert without one; mingo rejects every `_id` write.
 */
const omitIdWrite = (modifier: Document, working: Document): Document => {
  const $set = modifier.$set as Document | undefined;
  if (!$set || !("_id" in $set)) return modifier;
  const id: unknown = $set._id;
  if (working._id === undefined) {
    working._id = id;
  } else if (serializeKey(id) !== serializeKey(working._id)) {
    return modifier;
  }
  return { ...modifier, $set: omitField($set, "_id") };
};

const setPath = (document: Document, path: string, value: unknown): void => {
  const fields = path.split(".");
  const lastField = fields.pop()!;
  let parent = document;
  for (const field of fields) {
    parent[field] ??= {};
    parent = parent[field] as Document;
  }
  parent[lastField] = value;
};

/** The document an upsert starts from: the equality conditions of its filter. */
export const createUpsertBase = (filter: Document): Document => {
  const base: Document = {};
  const collect = (criteria: Document): void => {
    Object.entries(criteria).forEach(([field, condition]) => {
      if (field === "$and") {
        (condition as Document[]).forEach(collect);
        return;
      }
      if (field.startsWith("$") || condition instanceof RegExp) return;
      if (!isOperatorObject(condition)) {
        setPath(base, field, condition);
      } else if ("$eq" in condition) {
        setPath(base, field, condition.$eq);
      }
    });
  };
  collect(filter);
  return cloneDocument(base);
};

interface ApplyUpdateOptions {
  /** The filter that matched `document`: the positional `$` resolves against it. */
  filter: Document;
  arrayFilters?: Document[];
  isInsert: boolean;
}

interface AppliedUpdate {
  next: Document;
  isModified: boolean;
}

/**
 * Applies `update` to a copy: `document` is never mutated. The update is read as
 * the driver serializes it, `undefined` as `null`.
 */
export const applyUpdate = (
  document: Document,
  update: MemoryUpdate,
  { filter, arrayFilters, isInsert }: ApplyUpdateOptions,
): AppliedUpdate => {
  const storedUpdate = cloneAsStored(update) as MemoryUpdate;
  const modifier = Array.isArray(storedUpdate)
    ? storedUpdate
    : prepareModifier(storedUpdate, isInsert);
  if (!modifier) return { next: document, isModified: false };

  const working = cloneDocument(document);
  const documents = [working];
  try {
    const { modifiedCount } = updateOne(
      documents,
      isInsert ? {} : cloneDocument(filter),
      Array.isArray(modifier) ? modifier : omitIdWrite(modifier, working),
      { arrayFilters: cloneAsStored(arrayFilters) as Document[] | undefined },
      queryOptions,
    );
    return {
      next: cloneDocument(documents[0]!),
      isModified: modifiedCount > 0,
    };
  } catch (error: unknown) {
    throw toServerError(error);
  }
};
