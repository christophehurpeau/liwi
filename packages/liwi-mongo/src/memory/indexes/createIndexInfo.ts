import type { Document, IndexDescription, IndexDescriptionInfo } from "mongodb";
import { buildIndexName } from "../../indexes/buildIndexName.ts";
import type { MongoIndexDirection } from "../../indexes/types.ts";

const textKeyEntries: [string, MongoIndexDirection | 1][] = [
  ["_fts", "text"],
  ["_ftsx", 1],
];

const toKeyRecord = (
  key: IndexDescription["key"],
): Record<string, MongoIndexDirection> =>
  (key instanceof Map ? Object.fromEntries(key) : key) as Record<
    string,
    MongoIndexDirection
  >;

/** mongod lists the text fields of a key as `_fts` / `_ftsx`, where the first text field was. */
const toStoredKey = (key: Record<string, MongoIndexDirection>): Document => {
  const entries = Object.entries(key);
  const firstTextIndex = entries.findIndex(
    ([, direction]) => direction === "text",
  );
  if (firstTextIndex === -1) return key;

  const otherEntries = entries.filter(([, direction]) => direction !== "text");
  const textPosition = entries
    .slice(0, firstTextIndex)
    .filter(([, direction]) => direction !== "text").length;
  return Object.fromEntries([
    ...otherEntries.slice(0, textPosition),
    ...textKeyEntries,
    ...otherEntries.slice(textPosition),
  ]);
};

const buildTextOptions = (
  key: Record<string, MongoIndexDirection>,
  description: IndexDescription,
): Document => ({
  weights: {
    ...Object.fromEntries(
      Object.entries(key)
        .filter(([, direction]) => direction === "text")
        .map(([field]) => [field, 1]),
    ),
    ...description.weights,
  },
  // oxlint-disable-next-line eslint-js/camelcase -- mongo option name
  default_language: description.default_language ?? "english",
  // oxlint-disable-next-line eslint-js/camelcase -- mongo option name
  language_override: description.language_override ?? "language",
  textIndexVersion: 3,
});

const isText = (key: Record<string, MongoIndexDirection>): boolean =>
  Object.values(key).includes("text");

/** The index as `listIndexes` returns it once created from `description`. */
export const createIndexInfo = (
  description: IndexDescription,
): IndexDescriptionInfo => {
  const key = toKeyRecord(description.key);
  const { key: _key, name, version: _version, ...options } = description;
  const definedOptions = Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  );

  return {
    v: 2,
    key: toStoredKey(key),
    name: name ?? buildIndexName(key),
    ...definedOptions,
    ...(isText(key) ? buildTextOptions(key, description) : {}),
  };
};

export const idIndexInfo: IndexDescriptionInfo = {
  v: 2,
  key: { _id: 1 },
  name: "_id_",
};
