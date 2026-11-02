import type {
  AllowedKeyValue,
  Change,
  Changes,
  QueryOptions,
  QueryParams,
  QueryResult,
  QuerySubscription,
  SubscribeCallback,
  Transformer,
} from "liwi-store";
import type { Actions } from "liwi-subscribe-store";
import { AbstractSubscribableStoreQuery } from "liwi-subscribe-store";
import { Query as MingoQuery } from "mingo";
import type {
  MongoBaseModel,
  MongoInsertType,
  MongoKeyPath,
} from "./MongoBaseModel.ts";
import type MongoCursor from "./MongoCursor.ts";
import type MongoStore from "./MongoStore.ts";
import { createActionQueue } from "./createActionQueue.ts";

const identityTransformer = <
  Model extends MongoBaseModel<any>,
  Transformed = Model,
>(
  model: Model,
): Transformed => model as unknown as Transformed;

type TestCriteria = (obj: any) => boolean;

export default class MongoQuerySingleItem<
  Model extends MongoBaseModel<KeyValue>,
  Params extends QueryParams<Params> = never,
  Result extends Record<MongoKeyPath, KeyValue> | null = Model | null,
  KeyValue extends AllowedKeyValue = Model["_id"],
> extends AbstractSubscribableStoreQuery<
  MongoKeyPath,
  KeyValue,
  Model,
  MongoInsertType<Model, KeyValue>,
  Params,
  Result
> {
  private readonly store: MongoStore<Model, KeyValue>;

  private readonly options: QueryOptions<Model>;

  private testCriteria?: TestCriteria;

  private readonly transformer: Transformer<Model, Result>;

  constructor(
    store: MongoStore<Model, KeyValue>,
    options: QueryOptions<Model>,
    transformer: Transformer<Model, Result> = identityTransformer,
  ) {
    super();
    this.store = store;
    this.options = options;
    this.transformer = transformer;
  }

  createMingoTestCriteria(): TestCriteria {
    if (!this.testCriteria) {
      if (!this.options.criteria) {
        return () => true;
      }

      const mingoQuery = new MingoQuery(this.options.criteria);
      this.testCriteria = mingoQuery.test.bind(mingoQuery);
    }

    return this.testCriteria;
  }

  async fetch<T>(onFulfilled: (result: QueryResult<Result>) => T): Promise<T> {
    const cursor = await this.createMongoCursor();
    await cursor.limit(1);
    return cursor.toArray().then((result: Model[]) => {
      const item: Result =
        result.length === 0 ? (null as Result) : this.transformer(result[0]!);
      return onFulfilled({
        result: item,
        meta: { total: result === null ? 0 : 1 },
        info: {
          limit: 1,
          keyPath: this.store.keyPath,
        },
      });
    });
  }

  /**
   * From the key the client holds and the written documents, not from `prev`.
   * `refetch` when the result can only be known by querying again.
   */
  private computeChanges(
    action: Exclude<Actions<Model>, { type: "changed" | "resync" }>,
    testCriteria: TestCriteria,
    currentKey: KeyValue | null,
  ): Changes<KeyValue, Result> | "refetch" {
    const keyPath = this.store.keyPath;
    switch (action.type) {
      case "inserted": {
        const filtered = action.next.filter(testCriteria);
        if (filtered.length === 0) return [];
        return [{ type: "updated", result: this.transformer(filtered[0]!) }];
      }
      case "deleted": {
        const isCurrentDeleted =
          currentKey !== null &&
          action.prev.some((prev) => prev[keyPath] === currentKey);
        if (!isCurrentDeleted) return [];
        // another document may match
        if (this.options.sort) return "refetch";
        return [{ type: "deleted", keys: [currentKey] }];
      }
      case "updated": {
        const filtered = action.changes.filter(
          ([, next]) => next[keyPath] === currentKey || testCriteria(next),
        );
        if (filtered.length === 0) return [];

        if (this.options.sort) return "refetch";

        if (filtered.length > 1) {
          throw new Error(
            "should not match more than 1, use sort if you can have multiple match",
          );
        }

        const [, next] = filtered[0]!;
        return [
          {
            type: "updated",
            result: testCriteria(next) ? this.transformer(next) : null!,
          },
        ];
      }
      default:
        throw new Error("Unsupported type");
    }
  }

  _subscribe(
    callback: SubscribeCallback<KeyValue, Result>,
    _includeInitial: boolean,
  ): QuerySubscription {
    const store = super.getSubscribeStore();
    const testCriteria: TestCriteria = this.createMingoTestCriteria();
    const keyPath = this.store.keyPath;
    let currentKey: KeyValue | null = null;
    // false until a fetch succeeded: before, the held key is unknown
    let isReady = false;
    let isStopped = false;

    const getKeyAfter = (change: Change<KeyValue, Result>): KeyValue | null => {
      switch (change.type) {
        case "initial":
          return change.initial?.[keyPath] ?? null;
        case "inserted":
        case "updated":
          return change.result?.[keyPath] ?? null;
        case "deleted":
          return null;
        default:
          throw new Error("Unsupported type");
      }
    };

    const send = (changes: Changes<KeyValue, Result>): void => {
      if (isStopped || changes.length === 0) return;
      currentKey = getKeyAfter(changes.at(-1)!);
      callback(null, changes);
    };

    const refetch = (): Promise<QueryResult<Result>> =>
      this.fetch((result) => {
        isReady = true;
        return result;
      });

    // without its initial result, the client holds what it fetched itself: a
    // write racing with this fetch may be in neither, so the result reconciles it
    let isInitializing = true;
    let hasActionDuringInit = false;
    const initialPromise: Promise<void> = refetch().then(
      ({ result, meta, info }) => {
        isInitializing = false;
        currentKey = result?.[keyPath] ?? null;
        if (_includeInitial || hasActionDuringInit) {
          send([{ type: "initial", initial: result, queryInfo: info, meta }]);
        }
      },
    );

    const refetchAsUpdated = (): Promise<void> =>
      refetch().then(({ result }) => {
        send([{ type: "updated", result }]);
      });

    const handleAction = (
      action: Actions<Model>,
    ): Promise<void> | undefined => {
      if (isStopped) return undefined;
      if (action.type === "resync") {
        return refetch().then(({ result, meta, info }) => {
          send([{ type: "initial", initial: result, queryInfo: info, meta }]);
        });
      }
      if (!isReady) return undefined;
      if (action.type === "changed") {
        const isConcerned =
          (currentKey !== null && action.keys.includes(currentKey)) ||
          action.next.some(testCriteria);
        return isConcerned ? refetchAsUpdated() : undefined;
      }
      const changes = this.computeChanges(action, testCriteria, currentKey);
      if (changes === "refetch") return refetchAsUpdated();
      send(changes);
      return undefined;
    };

    const enqueue = createActionQueue(initialPromise, (error) => {
      if (!isStopped) callback(error as Error, []);
    });
    const unsubscribe = store.subscribe((action: Actions<Model>) => {
      if (isInitializing) hasActionDuringInit = true;
      enqueue(() => handleAction(action));
    });

    const stop = (): void => {
      isStopped = true;
      unsubscribe();
    };

    return {
      stop,
      cancel: stop,
      then: <T, U>(
        onFulfilled: () => Promise<T> | T,
        onRejected?: (error: any) => Promise<U> | U,
      ): Promise<T | U> => initialPromise.then(onFulfilled, onRejected),
    };
  }

  private async createMongoCursor(): Promise<
    MongoCursor<Model, Model, KeyValue>
  > {
    const cursor = await this.store.cursor(
      this.options.criteria,
      this.options.sort,
      this.options.fields,
    );

    if (this.options.limit) {
      await cursor.limit(this.options.limit);
    }

    return cursor;
  }
}
