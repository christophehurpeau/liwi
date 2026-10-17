import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createIndexInfo } from "./createIndexInfo.ts";

describe("createIndexInfo", () => {
  it("names the index from its key and keeps only the given options", () => {
    assert.deepEqual(
      createIndexInfo({
        key: { a: 1, b: -1 },
        unique: true,
        sparse: undefined,
      }),
      { v: 2, key: { a: 1, b: -1 }, name: "a_1_b_-1", unique: true },
    );
  });

  it("lists text fields as _fts / _ftsx where the first one was", () => {
    assert.deepEqual(
      createIndexInfo({
        key: { tenant: 1, title: "text", body: "text", done: 1 },
        weights: { body: 2 },
      }),
      {
        v: 2,
        key: { tenant: 1, _fts: "text", _ftsx: 1, done: 1 },
        name: "tenant_1_title_text_body_text_done_1",
        weights: { title: 1, body: 2 },
        // oxlint-disable-next-line eslint-js/camelcase -- mongo option name
        default_language: "english",
        // oxlint-disable-next-line eslint-js/camelcase -- mongo option name
        language_override: "language",
        textIndexVersion: 3,
      },
    );
  });
});
