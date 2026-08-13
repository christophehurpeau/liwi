import type { MongoRegistryStore } from "./MongoRegistryStore.ts";
import type { MongoIndexPlan, MongoIndexSyncResult, SyncIndexesOptions } from "./indexes/types.ts";
export interface MongoRegistryOptions {
    dropUndeclaredIndexes?: boolean;
}
export default class MongoRegistry {
    private readonly _stores;
    private readonly dropUndeclaredIndexes;
    constructor(stores?: readonly MongoRegistryStore[], { dropUndeclaredIndexes }?: MongoRegistryOptions);
    get stores(): readonly MongoRegistryStore[];
    add(store: MongoRegistryStore): this;
    remove(store: MongoRegistryStore): this;
    getStore(collectionName: string): MongoRegistryStore | undefined;
    private resolveOptions;
    private sortedStores;
    private runSequentially;
    planIndexes(options?: SyncIndexesOptions): Promise<MongoIndexPlan[]>;
    syncIndexes(options?: SyncIndexesOptions): Promise<MongoIndexSyncResult[]>;
}
//# sourceMappingURL=MongoRegistry.d.ts.map