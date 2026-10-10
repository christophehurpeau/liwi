import type {
  AllowedKeyValue,
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
} from "./MongoBaseModel";
import type MongoCursor from "./MongoCursor";
import type MongoStore from "./MongoStore";

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

  private async computeChanges(
    action: Actions<Model>,
    testCriteria: TestCriteria,
  ): Promise<Changes<KeyValue, Result>> {
    switch (action.type) {
      case "inserted": {
        const filtered = action.next.filter(testCriteria);
        if (filtered.length === 0) return [];
        return [{ type: "updated", result: this.transformer(filtered[0]!) }];
      }
      case "deleted": {
        const filtered = action.prev.filter(testCriteria);
        if (filtered.length === 0) return [];
        return [
          {
            type: "deleted",
            keys: filtered.map((object) => object[this.store.keyPath]),
          },
        ];
      }
      case "updated": {
        const filtered = action.changes.filter(
          ([prev, next]) => testCriteria(prev) || testCriteria(next),
        );
        if (filtered.length === 0) return [];

        if (this.options.sort) {
          const { result } = await this.fetch((res) => res);
          return [{ type: "updated", result }];
        }

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

    const promise: Promise<void> = _includeInitial
      ? this.fetch(({ result, meta, info }: QueryResult<Result>) => {
          callback(null, [
            {
              type: "initial",
              initial: result,
              queryInfo: info,
              meta,
            },
          ]);
        })
      : Promise.resolve();

    const unsubscribe = store.subscribe(async (action: Actions<Model>) => {
      let changes: Changes<KeyValue, Result>;
      try {
        changes = await this.computeChanges(action, testCriteria);
      } catch (error: unknown) {
        callback(error as Error, []);
        return;
      }

      if (changes.length === 0) return;

      callback(null, changes);
    });

    return {
      stop: unsubscribe,
      cancel: unsubscribe,
      then: <T, U>(
        onFulfilled: () => Promise<T> | T,
        onRejected?: (error: any) => Promise<U> | U,
      ): Promise<T | U> => promise.then(onFulfilled, onRejected),
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
