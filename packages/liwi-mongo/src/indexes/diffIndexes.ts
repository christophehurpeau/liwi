import type { IndexDescriptionInfo } from "mongodb";
import type { MongoBaseModel } from "../MongoBaseModel.ts";
import { deepEqualUnordered } from "./deepEqualUnordered.ts";
import type { NormalizedIndex } from "./normalizeIndex.ts";
import {
  normalizeDeclaredIndexes,
  normalizeExistingIndex,
} from "./normalizeIndex.ts";
import type {
  MongoIndex,
  MongoIndexCollModChanges,
  MongoIndexDifference,
  MongoIndexPlan,
} from "./types.ts";

const idIndexName = "_id_";

const isSameKey = (
  declared: NormalizedIndex,
  existing: NormalizedIndex,
): boolean =>
  declared.isText === existing.isText &&
  declared.keyEntries.length === existing.keyEntries.length &&
  declared.keyEntries.every(
    ([field, direction], index) =>
      existing.keyEntries[index]![0] === field &&
      existing.keyEntries[index]![1] === direction,
  );

const isSameCollation = (
  declared: NormalizedIndex["options"]["collation"],
  existing: NormalizedIndex["options"]["collation"],
): boolean => {
  if (!declared) return !existing;
  if (!existing) return false;

  return Object.entries(declared).every(([key, value]) =>
    deepEqualUnordered(value, (existing as any)[key]),
  );
};

const diffOptions = (
  declared: NormalizedIndex,
  existing: NormalizedIndex,
): MongoIndexDifference[] => {
  const differences: MongoIndexDifference[] = [];

  const compare = (
    field: MongoIndexDifference["field"],
    declaredValue: unknown,
    existingValue: unknown,
    equals: (a: unknown, b: unknown) => boolean = deepEqualUnordered,
  ): void => {
    if (!equals(declaredValue, existingValue)) {
      differences.push({
        field,
        declared: declaredValue,
        existing: existingValue,
      });
    }
  };

  compare("unique", declared.options.unique, existing.options.unique);
  compare("sparse", declared.options.sparse, existing.options.sparse);
  compare("hidden", declared.options.hidden, existing.options.hidden);
  compare(
    "expireAfterSeconds",
    declared.options.expireAfterSeconds,
    existing.options.expireAfterSeconds,
  );
  compare(
    "partialFilterExpression",
    declared.options.partialFilterExpression,
    existing.options.partialFilterExpression,
  );
  compare(
    "collation",
    declared.options.collation,
    existing.options.collation,
    (a, b) =>
      isSameCollation(
        a as NormalizedIndex["options"]["collation"],
        b as NormalizedIndex["options"]["collation"],
      ),
  );
  compare("weights", declared.options.weights, existing.options.weights);
  compare(
    "default_language",
    declared.options.defaultLanguage,
    existing.options.defaultLanguage,
  );
  compare(
    "language_override",
    declared.options.languageOverride,
    existing.options.languageOverride,
  );
  compare(
    "wildcardProjection",
    declared.options.wildcardProjection,
    existing.options.wildcardProjection,
  );

  return differences;
};

const isCollModApplicable = (
  differences: readonly MongoIndexDifference[],
): boolean =>
  differences.length > 0 &&
  differences.every(
    (difference) =>
      difference.field === "hidden" ||
      (difference.field === "expireAfterSeconds" &&
        difference.declared !== undefined &&
        difference.existing !== undefined),
  );

const buildCollModChanges = (
  differences: readonly MongoIndexDifference[],
): MongoIndexCollModChanges => {
  const changes: MongoIndexCollModChanges = {};
  differences.forEach((difference) => {
    if (difference.field === "hidden") {
      changes.hidden = difference.declared as boolean;
    } else if (difference.field === "expireAfterSeconds") {
      changes.expireAfterSeconds = difference.declared as number;
    }
  });
  return changes;
};

interface DiffIndexesParams<Model extends MongoBaseModel<any>> {
  collectionName: string;
  declaredIndexes: readonly MongoIndex<Model>[];
  existingIndexes: readonly IndexDescriptionInfo[];
  dropUndeclaredIndexes: boolean;
}

export const diffIndexes = <Model extends MongoBaseModel<any>>({
  collectionName,
  declaredIndexes,
  existingIndexes,
  dropUndeclaredIndexes,
}: DiffIndexesParams<Model>): MongoIndexPlan => {
  const declared = normalizeDeclaredIndexes({
    collectionName,
    indexes: declaredIndexes,
  });

  const remainingExisting = new Map<
    string,
    { normalized: NormalizedIndex; raw: IndexDescriptionInfo }
  >();
  existingIndexes.forEach((raw) => {
    const normalized = normalizeExistingIndex(raw);
    if (normalized.name === idIndexName) return;
    remainingExisting.set(normalized.name, { normalized, raw });
  });

  const plan: MongoIndexPlan = {
    collectionName,
    toCreate: [],
    toRecreate: [],
    toCollMod: [],
    toDrop: [],
    unchanged: [],
    undeclaredKept: [],
  };

  declared.forEach((declaredIndex) => {
    const existing = remainingExisting.get(declaredIndex.name);

    if (!existing) {
      plan.toCreate.push({
        name: declaredIndex.name,
        index: declaredIndex.description,
      });
      return;
    }

    remainingExisting.delete(declaredIndex.name);

    if (!isSameKey(declaredIndex, existing.normalized)) {
      plan.toRecreate.push({
        name: declaredIndex.name,
        index: declaredIndex.description,
        existing: existing.raw,
        differences: [
          {
            field: "key",
            declared: declaredIndex.key,
            existing: existing.normalized.key,
          },
        ],
      });
      return;
    }

    const differences = diffOptions(declaredIndex, existing.normalized);

    if (differences.length === 0) {
      plan.unchanged.push(declaredIndex.name);
    } else if (isCollModApplicable(differences)) {
      plan.toCollMod.push({
        name: declaredIndex.name,
        changes: buildCollModChanges(differences),
        differences,
      });
    } else {
      plan.toRecreate.push({
        name: declaredIndex.name,
        index: declaredIndex.description,
        existing: existing.raw,
        differences,
      });
    }
  });

  remainingExisting.forEach(({ raw }, name) => {
    if (dropUndeclaredIndexes) {
      plan.toDrop.push({ name, existing: raw });
    } else {
      plan.undeclaredKept.push(name);
    }
  });

  return plan;
};

export const isMongoIndexPlanEmpty = (plan: MongoIndexPlan): boolean =>
  plan.toCreate.length === 0 &&
  plan.toRecreate.length === 0 &&
  plan.toCollMod.length === 0 &&
  plan.toDrop.length === 0;
