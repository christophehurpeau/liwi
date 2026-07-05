export type Except<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type SetOptional<T, K extends keyof T> = Except<T, K> & Partial<Pick<T, K>>;
type Flatten<Type> = Type extends readonly (infer Item)[] ? Item : Type;
export interface BaseModel {
    created: Date;
    updated: Date;
}
export type OptionalBaseModelKeysForInsert = keyof BaseModel;
export type AllowedKeyValue = number | string;
export type InsertType<Model extends BaseModel & Record<KeyPath, unknown>, KeyPath extends keyof Model> = SetOptional<Model, KeyPath | OptionalBaseModelKeysForInsert>;
type KeysOfAType<Model, Type> = {
    [key in keyof Model]: NonNullable<Model[key]> extends Type ? key : never;
}[keyof Model];
type KeysOfOtherType<Model, Type> = {
    [key in keyof Model]: NonNullable<Model[key]> extends Type ? never : key;
}[keyof Model];
type AcceptedFields<Model, FieldType, AssignableType> = Readonly<Partial<Record<KeysOfAType<Model, FieldType>, AssignableType>>>;
type NotAcceptedFields<Model, FieldType> = Readonly<Partial<Record<KeysOfOtherType<Model, FieldType>, never>>>;
type OnlyFieldsOfType<Model, FieldType, AssignableType = FieldType> = AcceptedFields<Model, FieldType, AssignableType> & NotAcceptedFields<Model, FieldType> & Record<string, AssignableType>;
type NestedPathsOfType<Model, Type> = KeysOfAType<{
    [Property in Join<NestedPaths<Model, []>, ".">]: PropertyType<Model, Property>;
}, Type>;
export type $CurrentDateSpec = true | {
    $type: "date";
} | {
    $type: "timestamp";
};
type ArrayElement<Type> = Type extends readonly (infer Item)[] ? Item : never;
type MatchKeysAndValues<Model extends BaseModel> = Partial<Record<`${NestedPathsOfType<Model, Record<string, any>[]>}.$${"" | `[${string}]`}.${string}`, any>> & {
    [Property in `${NestedPathsOfType<Model, any[]>}.$${"" | `[${string}]`}`]?: ArrayElement<PropertyType<Model, Property extends `${infer Key}.$${string}` ? Key : never>>;
} & {
    [Property in Join<NestedPaths<Model, []>, ".">]?: PropertyType<Model, Property>;
};
type NumericType = number;
interface AddToSetOperators<Type> {
    $each?: Flatten<Type>[];
}
type SetFields<Model> = NotAcceptedFields<Model, readonly any[] | undefined> & Readonly<Record<string, AddToSetOperators<any> | any>> & {
    readonly [key in KeysOfAType<Model, readonly any[] | undefined>]?: AddToSetOperators<Flatten<Model[key]>[]> | Flatten<Model[key]>;
};
type FilterOperations<T> = T extends Record<string, any> ? {
    [key in keyof T]?: FilterOperators<T[key]>;
} : FilterOperators<T>;
type PullOperator<TSchema> = NotAcceptedFields<TSchema, readonly any[]> & Readonly<Record<string, FilterOperators<any> | any>> & {
    readonly [key in KeysOfAType<TSchema, readonly any[]>]?: FilterOperations<Flatten<TSchema[key]>> | Partial<Flatten<TSchema[key]>>;
};
type PullAllOperator<TSchema> = NotAcceptedFields<TSchema, readonly any[]> & Readonly<Record<string, readonly any[]>> & {
    readonly [key in KeysOfAType<TSchema, readonly any[]>]?: TSchema[key];
};
type PushOperator<TSchema> = NotAcceptedFields<TSchema, readonly any[]> & Readonly<Record<string, ArrayOperator<any> | any>> & {
    readonly [key in KeysOfAType<TSchema, readonly any[]>]?: ArrayOperator<Flatten<TSchema[key]>[]> | Flatten<TSchema[key]>;
};
interface ArrayOperator<Type> {
    $each?: Flatten<Type>[];
    $slice?: number;
    $position?: number;
}
export interface Update<Model extends BaseModel> {
    $currentDate?: OnlyFieldsOfType<Model, Date, $CurrentDateSpec>;
    $inc?: OnlyFieldsOfType<Model, NumericType | undefined>;
    $min?: MatchKeysAndValues<Model>;
    $max?: MatchKeysAndValues<Model>;
    $mul?: OnlyFieldsOfType<Model, NumericType | undefined>;
    $rename?: Record<string, string>;
    $set?: MatchKeysAndValues<Model>;
    $setOnInsert?: MatchKeysAndValues<Model>;
    $unset?: OnlyFieldsOfType<Model, any, true>;
    $addToSet?: SetFields<Model>;
    $pop?: OnlyFieldsOfType<Model, readonly any[], -1 | 1>;
    $pull?: PullOperator<Model>;
    /** The $push operator appends a specified value to an array. */
    $push?: PushOperator<Model>;
    $pullAll?: PullAllOperator<Model>;
}
export type ExcludeOnlyFields<Model extends BaseModel> = Record<string, 0> & {
    [P in keyof Model]?: 0;
};
export type IncludeOnlyFields<Model extends BaseModel> = Record<string, 1> & {
    [P in keyof Model]?: 1;
};
export type Fields<Model extends BaseModel> = ExcludeOnlyFields<Model> | IncludeOnlyFields<Model>;
type BitwiseFilter = number /** numeric bit mask */ | readonly number[];
interface FilterRegex {
    pattern: string;
    options: string;
}
interface FilterOperators<TValue> {
    $eq?: TValue;
    $gt?: TValue;
    $gte?: TValue;
    $in?: readonly TValue[];
    $lt?: TValue;
    $lte?: TValue;
    $ne?: TValue;
    $nin?: readonly TValue[];
    $not?: TValue extends string ? FilterOperators<TValue> | RegExp : FilterOperators<TValue>;
    /**
     * When `true`, `$exists` matches the documents that contain the field,
     * including documents where the field value is null.
     */
    $exists?: boolean;
    $expr?: Record<string, any>;
    $jsonSchema?: Record<string, any>;
    $mod?: TValue extends number ? [number, number] : never;
    $regex?: TValue extends string ? FilterRegex | RegExp | string : never;
    $options?: TValue extends string ? string : never;
    $geoIntersects?: {
        $geometry: Document;
    };
    $geoWithin?: Document;
    $near?: Document;
    $nearSphere?: Document;
    $maxDistance?: number;
    $all?: readonly any[];
    $elemMatch?: Document;
    $size?: TValue extends readonly any[] ? number : never;
    $bitsAllClear?: BitwiseFilter;
    $bitsAllSet?: BitwiseFilter;
    $bitsAnyClear?: BitwiseFilter;
    $bitsAnySet?: BitwiseFilter;
    $rand?: Record<string, never>;
}
type Join<T extends unknown[], D extends string> = T extends [] ? "" : T extends [number | string] ? `${T[0]}` : T extends [number | string, ...infer R] ? `${T[0]}${D}${Join<R, D>}` : string;
export declare type NestedPaths<Type, Depth extends number[]> = Depth["length"] extends 8 ? [] : Type extends Buffer | Date | RegExp | Uint8Array | bigint | boolean | number | string | ((...args: any[]) => any) | {
    _bsontype: string;
} ? [] : Type extends readonly (infer ArrayType)[] ? [number, ...NestedPaths<ArrayType, [...Depth, 1]>] | [number] : Type extends Map<string, any> ? [string] : Type extends object ? {
    [Key in Extract<keyof Type, string>]: Type[Key] extends Type ? [Key] : Type extends Type[Key] ? [Key] : Type[Key] extends readonly (infer ArrayType)[] ? Type extends ArrayType ? [Key] : ArrayType extends Type ? [Key] : [Key, ...NestedPaths<Type[Key], [...Depth, 1]>] | [Key] : [Key, ...NestedPaths<Type[Key], [...Depth, 1]>] | [Key];
}[Extract<keyof Type, string>] : [];
type PropertyType<Type, Property extends string> = string extends Property ? unknown : Property extends keyof Type ? Type[Property] : Property extends `${number}` ? Type extends readonly (infer ArrayType)[] ? ArrayType : unknown : Property extends `${infer Key}.${infer Rest}` ? Key extends `${number}` ? Type extends readonly (infer ArrayType)[] ? PropertyType<ArrayType, Rest> : unknown : Key extends keyof Type ? Type[Key] extends Map<string, infer MapType> ? MapType : PropertyType<Type[Key], Rest> : unknown : unknown;
type RegExpOrString<T> = T extends string ? RegExp | T : T;
type AlternativeType<T> = T extends readonly (infer U)[] ? RegExpOrString<U> | T : RegExpOrString<T>;
type Condition<T> = AlternativeType<T> | FilterOperators<AlternativeType<T>>;
export type Criteria<Model extends BaseModel> = Partial<Model> | ({
    [Property in Join<NestedPaths<Model, []>, ".">]?: Condition<PropertyType<Model, Property>>;
} & {
    $and?: Criteria<Model>[];
    $nor?: Criteria<Model>[];
    $or?: Criteria<Model>[];
    $text?: {
        $search: string;
        $language?: string;
        $caseSensitive?: boolean;
        $diacriticSensitive?: boolean;
    };
    $where?: string | ((this: Model) => boolean);
    $comment?: Document | string;
});
export type Sort<Model extends BaseModel> = Record<string, -1 | 1> & {
    [P in keyof Model]?: -1 | 1;
};
export interface QueryMeta {
    total: number;
}
export interface QueryInfo<Item extends Record<keyof Item, unknown>> {
    limit?: number;
    sort?: Sort<any>;
    keyPath: keyof Item;
}
export interface InitialChange<Value = any> {
    type: "initial";
    initial: Value;
    meta: QueryMeta;
    queryInfo: QueryInfo<any>;
}
export type Change<KeyValue, Result> = InitialChange<Result> | {
    type: "deleted";
    keys: KeyValue[];
} | {
    type: "inserted";
    result: Result;
} | {
    type: "updated";
    result: Result;
};
export type Changes<KeyValue, Result> = Change<KeyValue, Result>[];
export interface QueryOptions<Model extends BaseModel> {
    criteria?: Criteria<Model>;
    sort?: Sort<Model>;
    fields?: Fields<Model>;
    limit?: number;
    skip?: number;
}
export type ResourceOperationKey = "cursor toArray" | "cursor" | "do" | "fetch" | "fetchAndSubscribe" | "subscribe" | "unsubscribe";
export type Transformer<Model extends BaseModel, Transformed = Model> = (model: Model) => Transformed;
/**
 * Options of createQueryCollection / createQuerySingleItem.
 *
 * When `fields` is passed the query returns a projected (partial) document, so
 * the result type must be set explicitly: `transformer` becomes required and
 * its return type pins the result. Without `fields` the transformer stays
 * optional and the result defaults to the model.
 */
export type CreateQueryOptions<Model extends BaseModel, Transformed> = (QueryOptions<Model> & {
    fields: Fields<Model>;
    transformer: Transformer<Model, Transformed>;
}) | (QueryOptions<Model> & {
    fields?: undefined;
    transformer?: Transformer<Model, Transformed>;
});
export {};
//# sourceMappingURL=types.d.ts.map