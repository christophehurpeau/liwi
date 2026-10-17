import assert from "node:assert/strict";
import { describe, it } from "node:test";
import mongodb from "mongodb";
import { cloneAsStored, cloneDocument } from "./cloneAsStored.ts";

class Point {
  x = 1;

  y = 2;

  norm(): number {
    return Math.hypot(this.x, this.y);
  }
}

describe("cloneAsStored", () => {
  it("stores undefined as null, in documents and arrays", () => {
    assert.deepEqual(cloneAsStored({ a: undefined, list: [1, undefined] }), {
      a: null,
      list: [1, null],
    });
  });

  it("drops functions and turns maps and class instances into documents", () => {
    const stored = cloneDocument({
      run: () => undefined,
      map: new Map([["key", 1]]),
      point: new Point(),
    });

    assert.deepEqual(stored, { map: { key: 1 }, point: { x: 1, y: 2 } });
    assert.equal(Object.getPrototypeOf(stored.point), Object.prototype);
  });

  it("stores bytes as a Binary copy", () => {
    const bytes = Uint8Array.from([1, 2]);

    const stored = cloneAsStored(bytes) as mongodb.Binary;
    bytes[0] = 9;

    assert.ok(stored instanceof mongodb.Binary);
    assert.deepEqual([...stored.buffer], [1, 2]);
  });

  it("copies dates and keeps BSON values", () => {
    const date = new Date(0);
    const id = new mongodb.ObjectId();

    const stored = cloneDocument({ date, id });

    assert.notEqual(stored.date, date);
    assert.deepEqual(stored.date, date);
    assert.equal(stored.id, id);
  });
});
