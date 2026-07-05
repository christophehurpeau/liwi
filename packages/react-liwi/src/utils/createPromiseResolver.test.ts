import assert from "node:assert/strict";
import { describe, test } from "node:test";
// eslint-disable-next-line import-x/extensions
import { createPromiseResolver } from "./createPromiseResolver.ts";

describe("createPromiseResolver", () => {
  test("exposes a promise that resolves with the value passed to resolve", async () => {
    const { resolve, promise } = createPromiseResolver<number>();
    resolve(42);
    assert.equal(await promise, 42);
  });

  test("resolve is available synchronously after creation", () => {
    const { resolve } = createPromiseResolver<undefined>();
    assert.equal(typeof resolve, "function");
  });

  test("adopts a promise value", async () => {
    const { resolve, promise } = createPromiseResolver<string>();
    resolve(Promise.resolve("done"));
    assert.equal(await promise, "done");
  });
});
