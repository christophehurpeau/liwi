import type { IndexDescriptionInfo } from "mongodb";
import type { MongoBaseModel } from "../MongoBaseModel.ts";
import type { MongoIndex, MongoIndexPlan } from "./types.ts";
interface DiffIndexesParams<Model extends MongoBaseModel<any>> {
    collectionName: string;
    declaredIndexes: readonly MongoIndex<Model>[];
    existingIndexes: readonly IndexDescriptionInfo[];
    dropUndeclaredIndexes: boolean;
}
export declare const diffIndexes: <Model extends MongoBaseModel<any>>({ collectionName, declaredIndexes, existingIndexes, dropUndeclaredIndexes, }: DiffIndexesParams<Model>) => MongoIndexPlan;
export declare const isMongoIndexPlanEmpty: (plan: MongoIndexPlan) => boolean;
export {};
//# sourceMappingURL=diffIndexes.d.ts.map