import type {
  CollationOptions,
  Document,
  IndexDescription,
  IndexDescriptionInfo,
} from "mongodb";
import type { MongoBaseModel } from "../MongoBaseModel.ts";
import { buildIndexName } from "./buildIndexName.ts";
import type { MongoIndex, MongoIndexDirection } from "./types.ts";

const textDefaultLanguage = "english";
const textLanguageOverride = "language";

export interface NormalizedIndexOptions {
  unique: boolean;
  sparse: boolean;
  hidden: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: Document;
  collation?: CollationOptions;
  weights?: Record<string, number>;
  defaultLanguage?: string;
  languageOverride?: string;
  wildcardProjection?: Document;
}

export interface NormalizedIndex {
  name: string;
  key: Record<string, MongoIndexDirection>;
  keyEntries: [string, MongoIndexDirection][];
  isText: boolean;
  options: NormalizedIndexOptions;
}

export interface NormalizedDeclaredIndex extends NormalizedIndex {
  description: IndexDescription;
}

const buildDescription = (
  index: MongoIndex<any>,
  name: string,
): IndexDescription => {
  const description: IndexDescription = {
    key: index.key as Record<string, MongoIndexDirection>,
    name,
  };

  if (index.unique !== undefined) description.unique = index.unique;
  if (index.sparse !== undefined) description.sparse = index.sparse;
  if (index.hidden !== undefined) description.hidden = index.hidden;
  if (index.expireAfterSeconds !== undefined) {
    description.expireAfterSeconds = index.expireAfterSeconds;
  }
  if (index.partialFilterExpression) {
    description.partialFilterExpression = index.partialFilterExpression;
  }
  if (index.collation) description.collation = index.collation;
  if (index.weights) description.weights = index.weights;
  if (index.default_language) {
    // eslint-disable-next-line camelcase -- mongo option name
    description.default_language = index.default_language;
  }
  if (index.language_override) {
    // eslint-disable-next-line camelcase -- mongo option name
    description.language_override = index.language_override;
  }
  if (index.wildcardProjection) {
    description.wildcardProjection = index.wildcardProjection;
  }

  return description;
};

export const normalizeDeclaredIndex = <Model extends MongoBaseModel<any>>(
  index: MongoIndex<Model>,
): NormalizedDeclaredIndex => {
  const key = index.key as Record<string, MongoIndexDirection>;
  const entries = Object.entries(key);

  if (entries.length === 0) {
    throw new Error("Invalid index: key must have at least one field");
  }

  const textFields = entries
    .filter(([, direction]) => direction === "text")
    .map(([field]) => field);
  const isText = textFields.length > 0;

  const name = index.name ?? buildIndexName(key);
  const isIdOnly = entries.length === 1 && entries[0]![0] === "_id";
  if (name === "_id_" || isIdOnly) {
    throw new Error(
      "Invalid index: _id is always indexed by mongo and cannot be declared",
    );
  }

  const weights = isText
    ? {
        ...Object.fromEntries(textFields.map((field) => [field, 1])),
        ...index.weights,
      }
    : undefined;

  return {
    name,
    key,
    keyEntries: entries.filter(([, direction]) => direction !== "text"),
    isText,
    options: {
      unique: index.unique ?? false,
      sparse: index.sparse ?? false,
      hidden: index.hidden ?? false,
      expireAfterSeconds: index.expireAfterSeconds,
      partialFilterExpression: index.partialFilterExpression,
      collation: index.collation,
      weights,
      defaultLanguage: isText
        ? (index.default_language ?? textDefaultLanguage)
        : undefined,
      languageOverride: isText
        ? (index.language_override ?? textLanguageOverride)
        : undefined,
      wildcardProjection: index.wildcardProjection,
    },
    description: buildDescription(index, name),
  };
};

export const normalizeExistingIndex = (
  existing: IndexDescriptionInfo,
): NormalizedIndex => {
  const key = existing.key as Record<string, MongoIndexDirection>;
  const entries = Object.entries(key);
  const isText = entries.some(([field]) => field === "_fts");

  return {
    name: existing.name ?? buildIndexName(key),
    key,
    keyEntries: entries.filter(
      ([field]) => field !== "_fts" && field !== "_ftsx",
    ),
    isText,
    options: {
      unique: existing.unique ?? false,
      sparse: existing.sparse ?? false,
      hidden: existing.hidden ?? false,
      expireAfterSeconds: existing.expireAfterSeconds,
      partialFilterExpression: existing.partialFilterExpression,
      collation: existing.collation,
      weights: isText ? existing.weights : undefined,
      defaultLanguage: isText
        ? (existing.default_language ?? textDefaultLanguage)
        : undefined,
      languageOverride: isText
        ? (existing.language_override ?? textLanguageOverride)
        : undefined,
      wildcardProjection: existing.wildcardProjection,
    },
  };
};

interface NormalizeDeclaredIndexesParams<Model extends MongoBaseModel<any>> {
  collectionName: string;
  indexes: readonly MongoIndex<Model>[];
}

export const normalizeDeclaredIndexes = <Model extends MongoBaseModel<any>>({
  collectionName,
  indexes,
}: NormalizeDeclaredIndexesParams<Model>): NormalizedDeclaredIndex[] => {
  const normalized = indexes.map((index) => normalizeDeclaredIndex(index));

  const names = new Set<string>();
  normalized.forEach(({ name }) => {
    if (names.has(name)) {
      throw new Error(
        `Duplicate index name "${name}" declared on collection "${collectionName}"`,
      );
    }
    names.add(name);
  });

  const textIndexes = normalized.filter(({ isText }) => isText);
  if (textIndexes.length > 1) {
    throw new Error(
      `Only one text index is allowed per collection, "${collectionName}" declares ${textIndexes.length}`,
    );
  }

  return normalized;
};
