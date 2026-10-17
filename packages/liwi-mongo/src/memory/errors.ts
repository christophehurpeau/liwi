import { MingoError } from "mingo/util";
import type { Document } from "mongodb";
import mongodb from "mongodb";

const createServerError = (
  code: number,
  codeName: string,
  errmsg: string,
  details: Document = {},
): mongodb.MongoServerError =>
  new mongodb.MongoServerError({ ok: 0, errmsg, code, codeName, ...details });

const formatKeyValue = (keyValue: Document): string =>
  `{ ${Object.entries(keyValue)
    .map(([field, value]) => `${field}: ${JSON.stringify(value) ?? "null"}`)
    .join(", ")} }`;

interface DuplicateKeyErrorParams {
  namespace: string;
  indexName: string;
  keyPattern: Document;
  keyValue: Document;
}

export const createDuplicateKeyError = ({
  namespace,
  indexName,
  keyPattern,
  keyValue,
}: DuplicateKeyErrorParams): mongodb.MongoServerError =>
  createServerError(
    11_000,
    "DuplicateKey",
    `E11000 duplicate key error collection: ${namespace} index: ${indexName} dup key: ${formatKeyValue(keyValue)}`,
    { keyPattern, keyValue },
  );

export const createNamespaceNotFoundError = (
  namespace: string,
): mongodb.MongoServerError =>
  createServerError(26, "NamespaceNotFound", `ns does not exist: ${namespace}`);

export const createIndexNotFoundError = (
  name: string,
): mongodb.MongoServerError =>
  createServerError(27, "IndexNotFound", `index not found with name [${name}]`);

export const createInvalidOptionsError = (
  message: string,
): mongodb.MongoServerError => createServerError(72, "InvalidOptions", message);

export const createIndexOptionsConflictError = (
  message: string,
): mongodb.MongoServerError =>
  createServerError(85, "IndexOptionsConflict", message);

export const createIndexKeySpecsConflictError = (
  message: string,
): mongodb.MongoServerError =>
  createServerError(86, "IndexKeySpecsConflict", message);

export const createImmutableIdError = (): mongodb.MongoServerError =>
  createServerError(
    66,
    "ImmutableField",
    "Performing an update on the path '_id' would modify the immutable field '_id'",
  );

const mingoUpdateErrorCodes: [RegExp, number, string][] = [
  [/immutable field/, 66, "ImmutableField"],
  [/would create a conflict/, 40, "ConflictingUpdateOperators"],
  [/Unknown update operator/, 9, "FailedToParse"],
];

/** The server error mongod answers for an update mingo rejects. */
export const toServerError = (error: unknown): unknown => {
  if (!(error instanceof MingoError)) return error;
  const [, code, codeName] = mingoUpdateErrorCodes.find(([pattern]) =>
    pattern.test(error.message),
  ) ?? [undefined, 2, "BadValue"];
  return createServerError(code, codeName, error.message);
};

export const createUnsupportedError = (feature: string): TypeError =>
  new TypeError(`liwi-mongo/memory: ${feature} is not supported`);
