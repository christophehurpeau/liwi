import { Logger } from "nightingale-logger";
import type { MongoRegistryStore } from "./MongoRegistryStore.ts";
import type {
  MongoIndexPlan,
  MongoIndexSyncResult,
  SyncIndexesOptions,
} from "./indexes/types.ts";

const logger = new Logger("liwi:mongo:MongoRegistry");

export interface MongoRegistryOptions {
  dropUndeclaredIndexes?: boolean;
}

export default class MongoRegistry {
  private readonly _stores: MongoRegistryStore[];

  private readonly dropUndeclaredIndexes: boolean;

  constructor(
    stores: readonly MongoRegistryStore[] = [],
    { dropUndeclaredIndexes = true }: MongoRegistryOptions = {},
  ) {
    this._stores = [];
    this.dropUndeclaredIndexes = dropUndeclaredIndexes;
    stores.forEach((store) => this.add(store));
  }

  get stores(): readonly MongoRegistryStore[] {
    return this._stores;
  }

  add(store: MongoRegistryStore): this {
    if (this.getStore(store.collectionName)) {
      logger.warn("collection already registered", {
        collectionName: store.collectionName,
      });
    }
    this._stores.push(store);
    return this;
  }

  remove(store: MongoRegistryStore): this {
    const index = this._stores.indexOf(store);
    if (index !== -1) this._stores.splice(index, 1);
    return this;
  }

  getStore(collectionName: string): MongoRegistryStore | undefined {
    return this._stores.find(
      (store) => store.collectionName === collectionName,
    );
  }

  private resolveOptions(options: SyncIndexesOptions = {}): SyncIndexesOptions {
    return {
      ...options,
      dropUndeclaredIndexes:
        options.dropUndeclaredIndexes ?? this.dropUndeclaredIndexes,
    };
  }

  private sortedStores(): MongoRegistryStore[] {
    return this._stores.toSorted((storeA, storeB) =>
      storeA.collectionName.localeCompare(storeB.collectionName),
    );
  }

  private async runSequentially<Result>(
    operation: string,
    run: (store: MongoRegistryStore) => Promise<Result>,
  ): Promise<Result[]> {
    const results: Result[] = [];
    const errors: unknown[] = [];

    for (const store of this.sortedStores()) {
      try {
        results.push(await run(store));
      } catch (error: unknown) {
        logger.error(operation, {
          collectionName: store.collectionName,
          error,
        });
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, `${operation} failed`);
    }

    return results;
  }

  planIndexes(options?: SyncIndexesOptions): Promise<MongoIndexPlan[]> {
    const resolvedOptions = this.resolveOptions(options);
    return this.runSequentially("planIndexes", (store) =>
      store.planIndexes(resolvedOptions),
    );
  }

  syncIndexes(options?: SyncIndexesOptions): Promise<MongoIndexSyncResult[]> {
    const resolvedOptions = this.resolveOptions(options);
    return this.runSequentially("syncIndexes", (store) =>
      store.syncIndexes(resolvedOptions),
    );
  }
}
