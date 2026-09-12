import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isUnrecoverableFailure } from "./isUnrecoverableFailure.ts";

describe("isUnrecoverableFailure", () => {
  const handshake = (status: number) =>
    ({ type: "handshake", status, statusText: undefined }) as const;

  test("treats 4xx handshake failures as unrecoverable", () => {
    assert.equal(isUnrecoverableFailure(handshake(400)), true);
    assert.equal(isUnrecoverableFailure(handshake(401)), true);
    assert.equal(isUnrecoverableFailure(handshake(404)), true);
    assert.equal(isUnrecoverableFailure(handshake(499)), true);
  });

  test("keeps retrying outside the 4xx range", () => {
    assert.equal(isUnrecoverableFailure(handshake(399)), false);
    assert.equal(isUnrecoverableFailure(handshake(500)), false);
    assert.equal(isUnrecoverableFailure(handshake(0)), false);
  });

  test("keeps retrying on close failures whatever the code", () => {
    assert.equal(
      isUnrecoverableFailure({
        type: "close",
        code: 1006,
        reason: "",
        wasClean: false,
      }),
      false,
    );
    assert.equal(
      isUnrecoverableFailure({
        type: "close",
        code: 4401,
        reason: "expired",
        wasClean: true,
      }),
      false,
    );
  });
});
