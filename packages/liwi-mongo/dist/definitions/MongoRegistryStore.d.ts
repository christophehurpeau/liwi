import type { MongoIndexPlan, MongoIndexSyncResult, SyncIndexesOptions } from "./indexes/types.ts";
export interface MongoRegistryStore {
    readonly collectionName: string;
    planIndexes: (options?: SyncIndexesOptions) => Promise<MongoIndexPlan>;
    syncIndexes: (options?: SyncIndexesOptions) => Promise<MongoIndexSyncResult>;
}
//# sourceMappingURL=MongoRegistryStore.d.ts.map