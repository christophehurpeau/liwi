import type { AllowedKeyValue, Changes, QueryInfo, QueryMeta } from "./types";
export interface QuerySubscription extends PromiseLike<void> {
    cancel: () => void;
    stop: () => void;
}
export type SubscribeCallback<KeyValue extends AllowedKeyValue, Result> = (err: Error | null, changes: Changes<KeyValue, Result>) => unknown;
export type AllowedParamValue = AllowedParamValue[] | Date | boolean | number | string | null | undefined;
export type QueryParams<Params extends Record<string, unknown>> = {
    [P in keyof Params]: Extract<Params[P], AllowedParamValue>;
};
export interface QueryResult<Result> {
    result: Result;
    info: QueryInfo<any>;
    meta: QueryMeta;
}
export interface Query<Result, Params extends QueryParams<Params>, KeyValue extends AllowedKeyValue = AllowedKeyValue> {
    changeParams: (params: Params) => void;
    changePartialParams: (params: Params extends undefined ? never : Partial<Params>) => void;
    fetch: <T>(onFulfilled: (result: QueryResult<Result>) => T) => Promise<T>;
    fetchAndSubscribe: (callback: SubscribeCallback<KeyValue, Result>) => QuerySubscription;
    subscribe: (callback: SubscribeCallback<KeyValue, Result>) => QuerySubscription;
}
//# sourceMappingURL=Query.d.ts.map