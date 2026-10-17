import type { Document } from "mongodb";
import mongodb from "mongodb";

const isBSONValue = (value: object): boolean => "_bsontype" in value;

const listEntries = (value: object): [string, unknown][] =>
  value instanceof Map
    ? [...(value as Map<string, unknown>).entries()]
    : Object.entries(value);

/**
 * Copies a value the way the driver writes it then reads it back: `undefined`
 * becomes `null` (`ignoreUndefined` is off), functions are dropped, bytes become
 * a `Binary`, a `Map` or a class instance becomes a plain document.
 * BSON values (`ObjectId`, `Decimal128`...) are immutable and kept as is.
 */
export const cloneAsStored = (value: unknown): unknown => {
  if (value === undefined) return null;
  if (typeof value !== "object" || value === null) return value;
  if (value instanceof Date) return new Date(value);
  if (value instanceof RegExp || isBSONValue(value)) return value;
  if (value instanceof Uint8Array) {
    return new mongodb.Binary(Uint8Array.from(value));
  }
  if (Array.isArray(value)) return value.map(cloneAsStored);
  return Object.fromEntries(
    listEntries(value)
      .filter(([, fieldValue]) => typeof fieldValue !== "function")
      .map(([field, fieldValue]) => [field, cloneAsStored(fieldValue)]),
  );
};

export const cloneDocument = <T extends Document>(document: T): T =>
  cloneAsStored(document) as T;
