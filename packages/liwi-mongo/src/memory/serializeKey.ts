import mongodb from "mongodb";

/**
 * Same string for values mongo considers the same key: canonical extended JSON
 * keeps types apart (`"1"` and `1`, a `Date` and its timestamp).
 */
export const serializeKey = (value: unknown): string =>
  typeof value === "string"
    ? `s:${value}`
    : mongodb.BSON.EJSON.stringify({ value }, { relaxed: false });
