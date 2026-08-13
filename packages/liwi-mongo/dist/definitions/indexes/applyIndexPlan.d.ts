import type { Collection, Db } from "mongodb";
import type { MongoIndexPlan, MongoIndexSyncResult } from "./types.ts";
interface ApplyIndexPlanParams {
    plan: MongoIndexPlan;
    collection: Collection<any>;
    db: Db;
    dryRun: boolean;
}
export declare const applyIndexPlan: ({ plan, collection, db, dryRun, }: ApplyIndexPlanParams) => Promise<MongoIndexSyncResult>;
export {};
//# sourceMappingURL=applyIndexPlan.d.ts.map