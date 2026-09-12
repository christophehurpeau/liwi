import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { detectVisibilitySource } from "./detectVisibilitySource.ts";

interface FakeDocument {
  visibilityState: string;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

const withDocument = (
  document: Partial<FakeDocument> | undefined,
  run: () => void,
): void => {
  const globalWithDocument = globalThis as { document?: unknown };
  const previousDocument = globalWithDocument.document;
  if (document) globalWithDocument.document = document;
  else delete globalWithDocument.document;

  try {
    run();
  } finally {
    if (previousDocument === undefined) delete globalWithDocument.document;
    else globalWithDocument.document = previousDocument;
  }
};

describe("detectVisibilitySource", () => {
  test("returns undefined on a node host", () => {
    withDocument(undefined, () => {
      assert.equal(detectVisibilitySource(), undefined);
    });
  });

  test("returns undefined when the document lacks the visibility api", () => {
    withDocument({ addEventListener: () => {} }, () => {
      assert.equal(detectVisibilitySource(), undefined);
    });
  });

  test("reads visibilityState and listens on the document", () => {
    const listeners = new Map<string, () => void>();
    const fakeDocument: FakeDocument = {
      visibilityState: "visible",
      addEventListener: (type, listener) => {
        listeners.set(type, listener);
      },
      removeEventListener: (type) => {
        listeners.delete(type);
      },
    };

    withDocument(fakeDocument, () => {
      const source = detectVisibilitySource();
      assert.ok(source);
      assert.equal(source.isHidden(), false);

      fakeDocument.visibilityState = "hidden";
      assert.equal(source.isHidden(), true);

      let notified = 0;
      const unlisten = source.listen(() => {
        notified++;
      });
      assert.ok(listeners.has("visibilitychange"));

      listeners.get("visibilitychange")?.();
      assert.equal(notified, 1);

      unlisten();
      assert.equal(listeners.has("visibilitychange"), false);
    });
  });
});
