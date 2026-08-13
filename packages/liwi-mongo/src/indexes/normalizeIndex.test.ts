import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MongoBaseModel } from "../MongoBaseModel.ts";
import {
  normalizeDeclaredIndex,
  normalizeDeclaredIndexes,
  normalizeExistingIndex,
} from "./normalizeIndex.ts";

interface TestModel extends MongoBaseModel {
  completed: boolean;
  label: string;
  title: string;
}

describe("normalizeDeclaredIndex", () => {
  it("fills boolean defaults and derives the name", () => {
    const normalized = normalizeDeclaredIndex<TestModel>({
      key: { completed: 1 },
    });

    assert.equal(normalized.name, "completed_1");
    assert.equal(normalized.isText, false);
    assert.deepEqual(normalized.keyEntries, [["completed", 1]]);
    assert.equal(normalized.options.unique, false);
    assert.equal(normalized.options.sparse, false);
    assert.equal(normalized.options.hidden, false);
    assert.equal(normalized.options.weights, undefined);
    assert.equal(normalized.options.defaultLanguage, undefined);
  });

  it("keeps an explicit name and builds the driver description", () => {
    const normalized = normalizeDeclaredIndex<TestModel>({
      key: { completed: 1 },
      name: "custom",
      unique: true,
    });

    assert.equal(normalized.name, "custom");
    assert.deepEqual(normalized.description, {
      key: { completed: 1 },
      name: "custom",
      unique: true,
    });
  });

  it("synthesizes weights and language defaults for a text index", () => {
    const normalized = normalizeDeclaredIndex<TestModel>({
      key: { completed: 1, label: "text" },
    });

    assert.equal(normalized.isText, true);
    assert.deepEqual(normalized.keyEntries, [["completed", 1]]);
    assert.deepEqual(normalized.options.weights, { label: 1 });
    assert.equal(normalized.options.defaultLanguage, "english");
    assert.equal(normalized.options.languageOverride, "language");
  });

  it("throws on an empty key", () => {
    assert.throws(
      () => normalizeDeclaredIndex<TestModel>({ key: {} }),
      /at least one field/,
    );
  });

  it("throws when the index resolves to the _id index", () => {
    assert.throws(
      () => normalizeDeclaredIndex<TestModel>({ key: { _id: 1 } }),
      /_id is always indexed/,
    );
  });
});

describe("normalizeExistingIndex", () => {
  it("ignores server managed fields", () => {
    const normalized = normalizeExistingIndex({
      v: 2,
      key: { completed: 1 },
      name: "completed_1",
      ns: "test.tasks",
      background: true,
    });

    assert.deepEqual(normalized.options, {
      unique: false,
      sparse: false,
      hidden: false,
      expireAfterSeconds: undefined,
      partialFilterExpression: undefined,
      collation: undefined,
      weights: undefined,
      defaultLanguage: undefined,
      languageOverride: undefined,
      wildcardProjection: undefined,
    });
  });

  it("reconstructs a text index from _fts / _ftsx and weights", () => {
    const normalized = normalizeExistingIndex({
      v: 2,
      key: { completed: 1, _fts: "text", _ftsx: 1 },
      name: "completed_1_label_text",
      weights: { label: 1 },
      // eslint-disable-next-line camelcase -- mongo option name
      default_language: "english",
      // eslint-disable-next-line camelcase -- mongo option name
      language_override: "language",
      textIndexVersion: 3,
    });

    assert.equal(normalized.isText, true);
    assert.deepEqual(normalized.keyEntries, [["completed", 1]]);
    assert.deepEqual(normalized.options.weights, { label: 1 });
  });
});

describe("normalizeDeclaredIndexes", () => {
  it("throws on duplicate names", () => {
    assert.throws(
      () =>
        normalizeDeclaredIndexes<TestModel>({
          collectionName: "tasks",
          indexes: [
            { key: { completed: 1 }, name: "same" },
            { key: { label: 1 }, name: "same" },
          ],
        }),
      /Duplicate index name "same"/,
    );
  });

  it("throws when more than one text index is declared", () => {
    assert.throws(
      () =>
        normalizeDeclaredIndexes<TestModel>({
          collectionName: "tasks",
          indexes: [{ key: { label: "text" } }, { key: { title: "text" } }],
        }),
      /Only one text index is allowed/,
    );
  });

  it("accepts a valid declaration", () => {
    const normalized = normalizeDeclaredIndexes<TestModel>({
      collectionName: "tasks",
      indexes: [{ key: { completed: 1, created: 1 } }, { key: { label: 1 } }],
    });

    assert.deepEqual(
      normalized.map(({ name }) => name),
      ["completed_1_created_1", "label_1"],
    );
  });
});
