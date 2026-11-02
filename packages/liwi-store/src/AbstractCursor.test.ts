import assert from "node:assert/strict";
import { describe, it } from "node:test";
import AbstractCursor from "./AbstractCursor.ts";
import type { BaseModel } from "./types.ts";

interface TestModel extends BaseModel {
  _id: string;
  label: string;
}

class TestCursor extends AbstractCursor<TestModel> {
  private readonly documents: TestModel[];

  private current?: TestModel;

  constructor(documents: TestModel[]) {
    super();
    this.documents = [...documents];
  }

  close(): void {
    this.documents.length = 0;
  }

  next(): Promise<string | undefined> {
    this.current = this.documents.shift();
    return Promise.resolve(this.current?._id);
  }

  limit(newLimit: number): Promise<this> {
    this.documents.length = Math.min(this.documents.length, newLimit);
    return Promise.resolve(this);
  }

  toArray(): Promise<TestModel[]> {
    return Promise.resolve(this.documents.splice(0));
  }

  result(): Promise<TestModel> {
    if (!this.current) throw new Error("Cannot call result() before next()");
    return Promise.resolve(this.current);
  }
}

const created = new Date("2020-01-01");

const documents: TestModel[] = [
  { _id: "1", label: "a", created, updated: created },
  { _id: "2", label: "b", created, updated: created },
];

describe("AbstractCursor", () => {
  it("nextResult advances and resolves the current result", async () => {
    const cursor = new TestCursor(documents);

    assert.deepEqual(await cursor.nextResult(), documents[0]);
    assert.deepEqual(await cursor.nextResult(), documents[1]);
  });

  it("forEachKeys calls back each key in order and resolves at the end", async () => {
    const keys: unknown[] = [];

    await new TestCursor(documents).forEachKeys((key) => {
      keys.push(key);
    });

    assert.deepEqual(keys, ["1", "2"]);
  });

  it("forEachKeys awaits each callback before reading the next key", async () => {
    const events: string[] = [];
    const cursor = new TestCursor(documents);
    const next = cursor.next.bind(cursor);
    cursor.next = () => {
      events.push("next");
      return next();
    };

    await cursor.forEachKeys(async (key) => {
      await Promise.resolve();
      events.push(`callback ${String(key)}`);
    });

    assert.deepEqual(events, [
      "next",
      "callback 1",
      "next",
      "callback 2",
      "next",
    ]);
  });

  it("forEach calls back each result in order", async () => {
    const results: TestModel[] = [];

    await new TestCursor(documents).forEach((result) => {
      results.push(result);
    });

    assert.deepEqual(results, documents);
  });

  it("forEach does nothing on an empty cursor", async () => {
    let calls = 0;

    await new TestCursor([]).forEach(() => {
      calls++;
    });

    assert.equal(calls, 0);
  });

  it("Symbol.iterator yields result promises, the last undefined, then ends", async () => {
    const iterator = new TestCursor(documents)[Symbol.iterator]();

    assert.deepEqual(await iterator.next().value, documents[0]);
    assert.deepEqual(await iterator.next().value, documents[1]);
    assert.equal(await iterator.next().value, undefined);
    assert.equal(iterator.next().done, true);
  });

  it("Symbol.iterator ends a for of loop awaiting each promise", async () => {
    const results: (TestModel | undefined)[] = [];

    for (const resultPromise of new TestCursor(documents)) {
      results.push(await resultPromise);
    }

    assert.deepEqual(results, [...documents, undefined]);
  });

  it("keysIterator yields key promises, the last undefined, then ends", async () => {
    const keys: unknown[] = [];

    for (const keyPromise of new TestCursor(documents).keysIterator()) {
      keys.push(await keyPromise);
    }

    assert.deepEqual(keys, ["1", "2", undefined]);
  });

  it("keysAsyncIterator yields each key and stops at the end", async () => {
    const keys: unknown[] = [];

    for await (const key of new TestCursor(documents).keysAsyncIterator()) {
      keys.push(key);
    }

    assert.deepEqual(keys, ["1", "2"]);
  });

  it("Symbol.asyncIterator yields each result and stops at the end", async () => {
    const results: TestModel[] = [];

    for await (const result of new TestCursor(documents)) results.push(result);

    assert.deepEqual(results, documents);
  });

  it("Symbol.asyncIterator yields nothing on an empty cursor", async () => {
    const results: TestModel[] = [];

    for await (const result of new TestCursor([])) results.push(result);

    assert.deepEqual(results, []);
  });

  it("Symbol.asyncIterator stops reading when returned early, as a break does", async () => {
    const cursor = new TestCursor(documents);
    const iterator = cursor[Symbol.asyncIterator]();

    const first = await iterator.next();

    assert.deepEqual(first.value, documents[0]);
    assert.deepEqual(await iterator.return(), { done: true, value: undefined });
    assert.deepEqual(await iterator.next(), { done: true, value: undefined });
    assert.deepEqual(await cursor.nextResult(), documents[1]);
  });
});
