import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSort } from "./normalizeSort.ts";

describe("normalizeSort", () => {
  it("reads every sort shape the driver accepts, in order", () => {
    assert.deepEqual(normalizeSort("a"), { a: 1 });
    assert.deepEqual(normalizeSort(["a", "desc"]), { a: -1 });
    assert.deepEqual(
      normalizeSort([
        ["b", -1],
        ["a", "ascending"],
      ]),
      { b: -1, a: 1 },
    );
    assert.deepEqual(normalizeSort(["a", "b"]), { a: 1, b: 1 });
    assert.deepEqual(
      normalizeSort(
        new Map([
          ["b", 1],
          ["a", -1],
        ]),
      ),
      { b: 1, a: -1 },
    );
    assert.deepEqual(Object.keys(normalizeSort({ b: 1, a: "desc" })), [
      "b",
      "a",
    ]);
  });

  it("rejects a $meta sort", () => {
    assert.throws(() => normalizeSort({ score: { $meta: "textScore" } }), {
      message: /is not supported/,
    });
  });
});
