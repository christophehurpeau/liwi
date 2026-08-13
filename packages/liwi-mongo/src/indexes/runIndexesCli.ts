import type MongoConnection from "../MongoConnection.ts";
import type MongoRegistry from "../MongoRegistry.ts";
import { isMongoIndexPlanEmpty } from "./diffIndexes.ts";
import { formatIndexPlans } from "./formatIndexPlan.ts";
import type { MongoIndexSyncResult, SyncIndexesOptions } from "./types.ts";

const usage = `Usage: [plan|sync] [options]

  plan               print the plan, changes nothing (default)
  sync               apply the plan

  --check            with plan, exit 1 when the plan is not empty
  --dry-run          with sync, compute everything but apply nothing
  --keep-undeclared  do not drop indexes that are not declared`;

const formatSyncResult = ({
  collectionName,
  created,
  modified,
  dropped,
}: MongoIndexSyncResult): string =>
  `${collectionName}: ${created.length} created, ${modified.length} modified, ${dropped.length} dropped`;

export interface RunIndexesCliParams {
  registry: MongoRegistry;
  argv?: readonly string[];
  connection?: MongoConnection;
  log?: (message: string) => void;
  logError?: (message: string) => void;
}

export const runIndexesCli = async ({
  registry,
  argv = process.argv.slice(2),
  connection,
  log = console.log,
  logError = console.error,
}: RunIndexesCliParams): Promise<number> => {
  const command = argv.find((arg) => !arg.startsWith("--")) ?? "plan";
  const options: SyncIndexesOptions = {
    ...(argv.includes("--keep-undeclared")
      ? { dropUndeclaredIndexes: false }
      : {}),
    dryRun: argv.includes("--dry-run"),
  };

  try {
    if (command === "plan") {
      const plans = await registry.planIndexes(options);
      log(formatIndexPlans(plans));
      const hasChanges = !plans.every((plan) => isMongoIndexPlanEmpty(plan));
      return argv.includes("--check") && hasChanges ? 1 : 0;
    }

    if (command === "sync") {
      const results = await registry.syncIndexes(options);
      log(formatIndexPlans(results.map(({ plan }) => plan)));
      log(
        results
          .map(
            (result) =>
              `${formatSyncResult(result)}${result.dryRun ? " (dry run, nothing applied)" : ""}`,
          )
          .join("\n"),
      );
      return 0;
    }

    logError(`Unknown command "${command}".\n\n${usage}`);
    return 2;
  } finally {
    await connection?.close();
  }
};
