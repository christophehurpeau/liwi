import type { CollationOptions, Document, IndexDescription, IndexDescriptionInfo } from "mongodb";
import type { MongoBaseModel } from "../MongoBaseModel.ts";
import type { MongoIndex, MongoIndexDirection } from "./types.ts";
export interface NormalizedIndexOptions {
    unique: boolean;
    sparse: boolean;
    hidden: boolean;
    expireAfterSeconds?: number;
    partialFilterExpression?: Document;
    collation?: CollationOptions;
    weights?: Record<string, number>;
    defaultLanguage?: string;
    languageOverride?: string;
    wildcardProjection?: Document;
}
export interface NormalizedIndex {
    name: string;
    key: Record<string, MongoIndexDirection>;
    keyEntries: [string, MongoIndexDirection][];
    isText: boolean;
    options: NormalizedIndexOptions;
}
export interface NormalizedDeclaredIndex extends NormalizedIndex {
    description: IndexDescription;
}
export declare const normalizeDeclaredIndex: <Model extends MongoBaseModel<any>>(index: MongoIndex<Model>) => NormalizedDeclaredIndex;
export declare const normalizeExistingIndex: (existing: IndexDescriptionInfo) => NormalizedIndex;
interface NormalizeDeclaredIndexesParams<Model extends MongoBaseModel<any>> {
    collectionName: string;
    indexes: readonly MongoIndex<Model>[];
}
export declare const normalizeDeclaredIndexes: <Model extends MongoBaseModel<any>>({ collectionName, indexes, }: NormalizeDeclaredIndexesParams<Model>) => NormalizedDeclaredIndex[];
export {};
//# sourceMappingURL=normalizeIndex.d.ts.map