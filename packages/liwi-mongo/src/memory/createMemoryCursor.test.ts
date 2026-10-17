import assert from "node:assert/strict";
import { describe, it } from "node:test";
import mongodb from "mongodb";
import type { MemoryFindOptions } from "./createMemoryCursor.ts";
import {
  createMemoryCursor,
  createMemoryFindCursor,
} from "./createMemoryCursor.ts";

describe("createMemoryCursor", () => {
  it("runs once, on the first read, and reads each result once", async () => {
    let runs = 0;
    const cursor = createMemoryCursor(() => {
      runs += 1;
      return [1, 2, 3];
    });
    assert.equal(runs, 0);

    assert.equal(await cursor.next(), 1);
    assert.equal(await cursor.hasNext(), true);
    assert.deepEqual(await cursor.toArray(), [2, 3]);
    assert.equal(await cursor.next(), null);
    assert.equal(runs, 1);
  });

  it("iterates with for await and stops forEach on false", async () => {
    const iterated: number[] = [];
    for await (const value of createMemoryCursor(() => [1, 2])) {
      iterated.push(value);
    }

    const visited: number[] = [];
    await createMemoryCursor(() => [1, 2, 3]).forEach((value) => {
      visited.push(value);
      return value < 2;
    });

    assert.deepEqual(iterated, [1, 2]);
    assert.deepEqual(visited, [1, 2]);
  });

  it("rejects instead of throwing when the run fails", async () => {
    const cursor = createMemoryCursor(() => {
      throw new Error("run failed");
    });

    await assert.rejects(cursor.toArray(), { message: "run failed" });
  });
});

describe("createMemoryFindCursor", () => {
  it("passes the options set before the first read", async () => {
    let received: MemoryFindOptions | undefined;
    const cursor = createMemoryFindCursor(
      (options) => {
        received = options;
        return [];
      },
      { limit: 5 },
    );

    await cursor.sort({ a: 1 }).skip(2).project({ a: 1 }).toArray();

    assert.deepEqual(received, {
      limit: 5,
      sort: { a: 1 },
      skip: 2,
      projection: { a: 1 },
    });
  });

  it("refuses options once reading started, like the driver", async () => {
    const cursor = createMemoryFindCursor(() => [1], {});
    await cursor.next();

    assert.throws(() => cursor.limit(1), mongodb.MongoCursorInUseError);
  });
});
