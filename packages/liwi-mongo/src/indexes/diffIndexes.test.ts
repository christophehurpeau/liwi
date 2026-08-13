import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IndexDescriptionInfo } from "mongodb";
import type { MongoBaseModel } from "../MongoBaseModel.ts";
import { diffIndexes, isMongoIndexPlanEmpty } from "./diffIndexes.ts";
import type { MongoIndex, MongoIndexPlan } from "./types.ts";

interface TestModel extends MongoBaseModel {
  completed: boolean;
  label: string;
  status: string;
  sessionEnd: Date;
}

const idIndex: IndexDescriptionInfo = {
  v: 2,
  key: { _id: 1 },
  name: "_id_",
};

interface PlanParams {
  declaredIndexes?: readonly MongoIndex<TestModel>[];
  existingIndexes?: readonly IndexDescriptionInfo[];
  dropUndeclaredIndexes?: boolean;
}

const plan = ({
  declaredIndexes = [],
  existingIndexes = [idIndex],
  dropUndeclaredIndexes = true,
}: PlanParams): MongoIndexPlan =>
  diffIndexes<TestModel>({
    collectionName: "tasks",
    declaredIndexes,
    existingIndexes,
    dropUndeclaredIndexes,
  });

describe("diffIndexes", () => {
  it("creates every declared index on a fresh collection", () => {
    const result = plan({
      declaredIndexes: [{ key: { completed: 1, created: 1 } }],
    });

    assert.deepEqual(
      result.toCreate.map(({ name }) => name),
      ["completed_1_created_1"],
    );
    assert.deepEqual(result.toDrop, []);
    assert.equal(isMongoIndexPlanEmpty(result), false);
  });

  it("never drops or reports the _id index", () => {
    const result = plan({});

    assert.deepEqual(result.toDrop, []);
    assert.deepEqual(result.unchanged, []);
    assert.equal(isMongoIndexPlanEmpty(result), true);
  });

  it("ignores server managed fields when comparing", () => {
    const result = plan({
      declaredIndexes: [{ key: { completed: 1 } }],
      existingIndexes: [
        idIndex,
        {
          v: 2,
          key: { completed: 1 },
          name: "completed_1",
          ns: "test.tasks",
          background: true,
          textIndexVersion: 3,
        },
      ],
    });

    assert.deepEqual(result.unchanged, ["completed_1"]);
    assert.equal(isMongoIndexPlanEmpty(result), true);
  });

  it("recreates when the key order changes", () => {
    const result = plan({
      declaredIndexes: [
        { key: { completed: 1, created: 1 }, name: "compound" },
      ],
      existingIndexes: [
        idIndex,
        { v: 2, key: { created: 1, completed: 1 }, name: "compound" },
      ],
    });

    assert.deepEqual(
      result.toRecreate.map(({ name, differences }) => [
        name,
        differences[0]!.field,
      ]),
      [["compound", "key"]],
    );
  });

  it("recreates when a direction changes", () => {
    const result = plan({
      declaredIndexes: [{ key: { created: -1 }, name: "created" }],
      existingIndexes: [
        idIndex,
        { v: 2, key: { created: 1 }, name: "created" },
      ],
    });

    assert.equal(result.toRecreate.length, 1);
  });

  it("recreates when unique is added", () => {
    const result = plan({
      declaredIndexes: [{ key: { label: 1 }, unique: true }],
      existingIndexes: [idIndex, { v: 2, key: { label: 1 }, name: "label_1" }],
    });

    assert.deepEqual(
      result.toRecreate.map(({ differences }) => differences[0]!.field),
      ["unique"],
    );
  });

  it("uses collMod when an existing ttl value changes", () => {
    const result = plan({
      declaredIndexes: [{ key: { sessionEnd: 1 }, expireAfterSeconds: 60 }],
      existingIndexes: [
        idIndex,
        {
          v: 2,
          key: { sessionEnd: 1 },
          name: "sessionEnd_1",
          expireAfterSeconds: 3600,
        },
      ],
    });

    assert.deepEqual(result.toRecreate, []);
    assert.deepEqual(
      result.toCollMod.map(({ name, changes }) => [name, changes]),
      [["sessionEnd_1", { expireAfterSeconds: 60 }]],
    );
  });

  it("recreates when ttl is added to a non ttl index", () => {
    const result = plan({
      declaredIndexes: [{ key: { sessionEnd: 1 }, expireAfterSeconds: 60 }],
      existingIndexes: [
        idIndex,
        { v: 2, key: { sessionEnd: 1 }, name: "sessionEnd_1" },
      ],
    });

    assert.deepEqual(result.toCollMod, []);
    assert.equal(result.toRecreate.length, 1);
  });

  it("uses collMod when hidden is toggled", () => {
    const result = plan({
      declaredIndexes: [{ key: { label: 1 }, hidden: true }],
      existingIndexes: [idIndex, { v: 2, key: { label: 1 }, name: "label_1" }],
    });

    assert.deepEqual(
      result.toCollMod.map(({ changes }) => changes),
      [{ hidden: true }],
    );
  });

  it("drops undeclared indexes by default", () => {
    const result = plan({
      existingIndexes: [
        idIndex,
        { v: 2, key: { status: 1 }, name: "legacy_status_1" },
      ],
    });

    assert.deepEqual(
      result.toDrop.map(({ name }) => name),
      ["legacy_status_1"],
    );
    assert.deepEqual(result.undeclaredKept, []);
  });

  it("keeps undeclared indexes when dropUndeclaredIndexes is false", () => {
    const result = plan({
      existingIndexes: [
        idIndex,
        { v: 2, key: { status: 1 }, name: "legacy_status_1" },
      ],
      dropUndeclaredIndexes: false,
    });

    assert.deepEqual(result.toDrop, []);
    assert.deepEqual(result.undeclaredKept, ["legacy_status_1"]);
    assert.equal(isMongoIndexPlanEmpty(result), true);
  });

  it("treats a reordered partialFilterExpression as unchanged", () => {
    const result = plan({
      declaredIndexes: [
        {
          key: { label: 1 },
          partialFilterExpression: { completed: true, status: "open" },
        },
      ],
      existingIndexes: [
        idIndex,
        {
          v: 2,
          key: { label: 1 },
          name: "label_1",
          partialFilterExpression: { status: "open", completed: true },
        },
      ],
    });

    assert.deepEqual(result.unchanged, ["label_1"]);
  });

  it("compares only the declared collation keys", () => {
    const result = plan({
      declaredIndexes: [{ key: { label: 1 }, collation: { locale: "en" } }],
      existingIndexes: [
        idIndex,
        {
          v: 2,
          key: { label: 1 },
          name: "label_1",
          collation: {
            locale: "en",
            caseLevel: false,
            caseFirst: "off",
            strength: 3,
            numericOrdering: false,
            alternate: "non-ignorable",
            maxVariable: "punct",
            normalization: false,
            backwards: false,
          },
        },
      ],
    });

    assert.deepEqual(result.unchanged, ["label_1"]);
  });

  it("treats a text index stored as _fts/_ftsx as unchanged", () => {
    const result = plan({
      declaredIndexes: [{ key: { label: "text" } }],
      existingIndexes: [
        idIndex,
        {
          v: 2,
          key: { _fts: "text", _ftsx: 1 },
          name: "label_text",
          weights: { label: 1 },
          // eslint-disable-next-line camelcase -- mongo option name
          default_language: "english",
          // eslint-disable-next-line camelcase -- mongo option name
          language_override: "language",
          textIndexVersion: 3,
        },
      ],
    });

    assert.deepEqual(result.unchanged, ["label_text"]);
    assert.equal(isMongoIndexPlanEmpty(result), true);
  });

  it("handles a rename as a drop plus a create", () => {
    const result = plan({
      declaredIndexes: [{ key: { label: 1 }, name: "label_new" }],
      existingIndexes: [
        idIndex,
        { v: 2, key: { label: 1 }, name: "label_old" },
      ],
    });

    assert.deepEqual(
      result.toCreate.map(({ name }) => name),
      ["label_new"],
    );
    assert.deepEqual(
      result.toDrop.map(({ name }) => name),
      ["label_old"],
    );
  });
});
