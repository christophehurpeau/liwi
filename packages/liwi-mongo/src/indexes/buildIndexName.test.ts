import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildIndexName } from "./buildIndexName.ts";

describe("buildIndexName", () => {
  it("names a single ascending field like mongo does", () => {
    assert.equal(buildIndexName({ completed: 1 }), "completed_1");
  });

  it("names a compound index", () => {
    assert.equal(
      buildIndexName({ completed: 1, created: 1 }),
      "completed_1_created_1",
    );
  });

  it("keeps descending directions", () => {
    assert.equal(buildIndexName({ created: -1 }), "created_-1");
  });

  it("names dotted paths", () => {
    assert.equal(buildIndexName({ "author.name": 1 }), "author.name_1");
  });

  it("names non numeric directions", () => {
    assert.equal(buildIndexName({ label: "text" }), "label_text");
    assert.equal(buildIndexName({ location: "2dsphere" }), "location_2dsphere");
    assert.equal(buildIndexName({ tenant: "hashed" }), "tenant_hashed");
  });

  it("names wildcard indexes", () => {
    assert.equal(buildIndexName({ "$**": 1 }), "$**_1");
  });
});
