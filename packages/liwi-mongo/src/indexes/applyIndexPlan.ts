import type {
  Collection,
  Db,
  IndexDescription,
  IndexDescriptionInfo,
} from "mongodb";
import { Logger } from "nightingale-logger";
import {
  isIndexConflictError,
  isIndexNotFoundError,
} from "./isIndexConflictError.ts";
import type { MongoIndexPlan, MongoIndexSyncResult } from "./types.ts";

const logger = new Logger("liwi:mongo:indexes");

const idIndexName = "_id_";

const serializeKey = (key: IndexDescription["key"]): string =>
  JSON.stringify(key instanceof Map ? [...key.entries()] : Object.entries(key));

const findConflictingIndex = (
  existingIndexes: readonly IndexDescriptionInfo[],
  description: IndexDescription,
): IndexDescriptionInfo | undefined => {
  const byName = existingIndexes.find(({ name }) => name === description.name);
  if (byName) return byName;

  const serializedKey = serializeKey(description.key);
  return existingIndexes.find(
    ({ key, name }) =>
      name !== idIndexName && serializeKey(key) === serializedKey,
  );
};

interface CreateIndexParams {
  collection: Collection<any>;
  collectionName: string;
  description: IndexDescription;
}

const createIndexWithConflictRecovery = async ({
  collection,
  collectionName,
  description,
}: CreateIndexParams): Promise<void> => {
  try {
    await collection.createIndexes([description]);
    return;
  } catch (error: unknown) {
    if (!isIndexConflictError(error)) throw error;

    logger.warn("index conflict, recovering", {
      collectionName,
      name: description.name,
      error,
    });

    const existingIndexes = await collection.listIndexes().toArray();
    const conflicting = findConflictingIndex(existingIndexes, description);
    if (!conflicting?.name) throw error;

    await collection.dropIndex(conflicting.name);
  }

  await collection.createIndexes([description]);
};

interface ApplyIndexPlanParams {
  plan: MongoIndexPlan;
  collection: Collection<any>;
  db: Db;
  dryRun: boolean;
}

export const applyIndexPlan = async ({
  plan,
  collection,
  db,
  dryRun,
}: ApplyIndexPlanParams): Promise<MongoIndexSyncResult> => {
  const { collectionName } = plan;
  const result: MongoIndexSyncResult = {
    collectionName,
    plan,
    dryRun,
    created: [],
    dropped: [],
    modified: [],
  };

  if (dryRun) return result;

  const namesToDrop = [...plan.toDrop, ...plan.toRecreate]
    .map(({ name }) => name)
    .filter((name) => name !== idIndexName);

  for (const name of namesToDrop) {
    try {
      await collection.dropIndex(name);
      logger.info("dropIndex", { collectionName, name });
      result.dropped.push(name);
    } catch (error: unknown) {
      if (!isIndexNotFoundError(error)) throw error;
      logger.warn("index already dropped", { collectionName, name });
    }
  }

  for (const { name, changes } of plan.toCollMod) {
    await db.command({
      collMod: collectionName,
      index: { name, ...changes },
    });
    logger.info("collMod", { collectionName, name, changes });
    result.modified.push(name);
  }

  const descriptions = [...plan.toCreate, ...plan.toRecreate].map(
    ({ index }) => index,
  );

  if (descriptions.length > 0) {
    try {
      await collection.createIndexes(descriptions);
    } catch (error: unknown) {
      logger.warn("createIndexes failed, retrying one by one", {
        collectionName,
        error,
      });
      for (const description of descriptions) {
        await createIndexWithConflictRecovery({
          collection,
          collectionName,
          description,
        });
      }
    }
    result.created.push(...descriptions.map(({ name }) => name!));
    logger.info("createIndexes", { collectionName, names: result.created });
  }

  logger.info("syncIndexes done", {
    collectionName,
    created: result.created,
    dropped: result.dropped,
    modified: result.modified,
  });

  return result;
};
