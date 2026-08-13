import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import MongoRegistry from "../MongoRegistry.ts";
import type { MongoRegistryStore } from "../MongoRegistryStore.ts";
import { runIndexesCli } from "./runIndexesCli.ts";
import type {
  MongoIndexPlan,
  MongoIndexSyncResult,
  SyncIndexesOptions,
} from "./types.ts";

const collectionName = "tasks";

interface CreatePlanParams {
  empty: boolean;
}

const createPlan = ({ empty }: CreatePlanParams): MongoIndexPlan => ({
  collectionName,
  toCreate: empty
    ? []
    : [{ name: "completed_1", index: { key: { completed: 1 } } }],
  toRecreate: [],
  toCollMod: [],
  toDrop: [],
  unchanged: [],
  undeclaredKept: [],
});

let receivedOptions: SyncIndexesOptions[];
let logs: string[];
let errors: string[];

interface CreateRegistryParams {
  empty: boolean;
}

const createRegistry = ({ empty }: CreateRegistryParams): MongoRegistry => {
  const store: MongoRegistryStore = {
    collectionName,
    planIndexes: (options = {}) => {
      receivedOptions.push(options);
      return Promise.resolve(createPlan({ empty }));
    },
    syncIndexes: (options = {}) => {
      receivedOptions.push(options);
      return Promise.resolve<MongoIndexSyncResult>({
        collectionName,
        plan: createPlan({ empty }),
        dryRun: options.dryRun ?? false,
        created: empty ? [] : ["completed_1"],
        dropped: [],
        modified: [],
      });
    },
  };

  return new MongoRegistry([store]);
};

interface RunParams {
  argv: string[];
  empty?: boolean;
}

const run = ({ argv, empty = false }: RunParams): Promise<number> =>
  runIndexesCli({
    registry: createRegistry({ empty }),
    argv,
    log: (message) => logs.push(message),
    logError: (message) => errors.push(message),
  });

describe("runIndexesCli", () => {
  beforeEach(() => {
    receivedOptions = [];
    logs = [];
    errors = [];
  });

  it("plans by default and does not sync", async () => {
    assert.equal(await run({ argv: [] }), 0);
    assert.match(logs.join("\n"), /\+ create {2}completed_1/);
  });

  it("exits 1 with --check when the plan is not empty", async () => {
    assert.equal(await run({ argv: ["plan", "--check"] }), 1);
  });

  it("exits 0 with --check when the plan is empty", async () => {
    assert.equal(await run({ argv: ["plan", "--check"], empty: true }), 0);
  });

  it("syncs and reports what it did", async () => {
    assert.equal(await run({ argv: ["sync"] }), 0);
    assert.match(logs.join("\n"), /tasks: 1 created, 0 modified, 0 dropped$/);
  });

  it("passes --dry-run to the registry and says nothing was applied", async () => {
    assert.equal(await run({ argv: ["sync", "--dry-run"] }), 0);
    assert.deepEqual(receivedOptions, [
      { dryRun: true, dropUndeclaredIndexes: true },
    ]);
    assert.match(logs.join("\n"), /\(dry run, nothing applied\)/);
  });

  it("passes --keep-undeclared to the registry", async () => {
    assert.equal(await run({ argv: ["sync", "--keep-undeclared"] }), 0);
    assert.deepEqual(receivedOptions, [
      { dryRun: false, dropUndeclaredIndexes: false },
    ]);
  });

  it("returns 2 and prints the usage on an unknown command", async () => {
    assert.equal(await run({ argv: ["migrate"] }), 2);
    assert.match(errors.join("\n"), /Unknown command "migrate"/);
    assert.equal(logs.length, 0);
  });
});
