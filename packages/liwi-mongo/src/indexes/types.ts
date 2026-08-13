import type { Criteria, DottedPaths } from "liwi-store";
import type {
  CollationOptions,
  IndexDescription,
  IndexDescriptionInfo,
} from "mongodb";
import type { MongoBaseModel } from "../MongoBaseModel.ts";

export type MongoIndexDirection =
  | -1
  | "2d"
  | "2dsphere"
  | "hashed"
  | "text"
  | 1;

export type MongoIndexKey<Model extends MongoBaseModel<any>> = Partial<
  Record<
    DottedPaths<Model> | "$**" | `${DottedPaths<Model>}.$**`,
    MongoIndexDirection
  >
>;

export interface MongoIndexOptions<Model extends MongoBaseModel<any>> {
  name?: string;
  unique?: boolean;
  sparse?: boolean;
  hidden?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: Criteria<Model>;
  collation?: CollationOptions;
  weights?: Partial<Record<DottedPaths<Model>, number>>;

  default_language?: string;

  language_override?: string;
  wildcardProjection?: Record<string, 0 | 1>;
}

export interface MongoIndex<
  Model extends MongoBaseModel<any>,
> extends MongoIndexOptions<Model> {
  key: MongoIndexKey<Model>;
}

export interface SyncIndexesOptions {
  dryRun?: boolean;
  dropUndeclaredIndexes?: boolean;
}

export type MongoIndexComparedField =
  | "collation"
  | "default_language"
  | "expireAfterSeconds"
  | "hidden"
  | "key"
  | "language_override"
  | "partialFilterExpression"
  | "sparse"
  | "unique"
  | "weights"
  | "wildcardProjection";

export interface MongoIndexDifference {
  field: MongoIndexComparedField;
  declared: unknown;
  existing: unknown;
}

export interface MongoIndexCollModChanges {
  expireAfterSeconds?: number;
  hidden?: boolean;
}

export interface MongoIndexPlanCreate {
  name: string;
  index: IndexDescription;
}

export interface MongoIndexPlanRecreate {
  name: string;
  index: IndexDescription;
  existing: IndexDescriptionInfo;
  differences: MongoIndexDifference[];
}

export interface MongoIndexPlanCollMod {
  name: string;
  changes: MongoIndexCollModChanges;
  differences: MongoIndexDifference[];
}

export interface MongoIndexPlanDrop {
  name: string;
  existing: IndexDescriptionInfo;
}

export interface MongoIndexPlan {
  collectionName: string;
  toCreate: MongoIndexPlanCreate[];
  toRecreate: MongoIndexPlanRecreate[];
  toCollMod: MongoIndexPlanCollMod[];
  toDrop: MongoIndexPlanDrop[];
  unchanged: string[];
  undeclaredKept: string[];
}

export interface MongoIndexSyncResult {
  collectionName: string;
  plan: MongoIndexPlan;
  dryRun: boolean;
  created: string[];
  dropped: string[];
  modified: string[];
}
