/* eslint-disable complexity */
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
import mingo from "mingo";
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

export default class MongoQueryCollection<
  Model extends MongoBaseModel<KeyValue>,
  Params extends QueryParams<Params> = never,
  KeyValue extends AllowedKeyValue = Model["_id"],
  Item extends Record<MongoKeyPath, KeyValue> = Model,
> extends AbstractSubscribableStoreQuery<
  MongoKeyPath,
  KeyValue,
  Model,
  MongoInsertType<Model, KeyValue>,
  Params,
  Item[]
> {
  private readonly store: MongoStore<Model, KeyValue>;

  private readonly options: QueryOptions<Model>;

  private testCriteria?: TestCriteria;

  private readonly transformer: Transformer<Model, Item>;

  constructor(
    store: MongoStore<Model, KeyValue>,
    options: QueryOptions<Model>,
    transformer: Transformer<Model, Item> = identityTransformer,
  ) {
    super();
    this.store = store;
    this.options = options;
    this.transformer = transformer;
  }

  createTestCriteria(): TestCriteria {
    if (!this.testCriteria) {
      if (!this.options.criteria) {
        return () => true;
      }

      // criteria not supported by mingo: updates will not work
      if ("$text" in this.options.criteria) {
        return () => false;
      }

      const mingoQuery = new mingo.Query(this.options.criteria);
      this.testCriteria = mingoQuery.test.bind(mingoQuery);
    }
    return this.testCriteria;
  }

  async fetch<T>(onFulfilled: (result: QueryResult<Item[]>) => T): Promise<T> {
    const [result, count] = await Promise.all([
      this.createMongoCursor().then((cursor) => cursor.toArray()),
      this.store.count(this.options.criteria),
    ]);

    return onFulfilled({
      result: result.map(this.transformer),
      meta: { total: count },
      info: {
        sort: this.options.sort,
        limit: this.options.limit,
        keyPath: this.store.keyPath,
      },
    });
  }

  _subscribe(
    callback: SubscribeCallback<KeyValue, Item[]>,
    _includeInitial: boolean,
  ): QuerySubscription {
    const store = super.getSubscribeStore();
    const testCriteria: TestCriteria = this.createTestCriteria();

    const promise: Promise<void> = _includeInitial
      ? this.fetch(({ result, meta, info }: QueryResult<Item[]>) => {
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

    const unsubscribe = store.subscribe((action: Actions<Model>) => {
      const changes: Changes<KeyValue, Item[]> = [];
      switch (action.type) {
        case "inserted": {
          const filtered = action.next.filter(testCriteria);
          if (filtered.length > 0) {
            changes.push({
              type: "inserted",
              result: filtered.map(this.transformer),
            });
          }
          break;
        }
        case "deleted": {
          const filtered = action.prev.filter(testCriteria);
          if (filtered.length > 0) {
            changes.push({
              type: "deleted",
              keys: filtered.map((object) => object[this.store.keyPath]),
            });
          }
          break;
        }
        case "updated": {
          const {
            deleted,
            updated,
            inserted,
          }: {
            deleted: KeyValue[];
            updated: Item[];
            inserted: Item[];
          } = { deleted: [], updated: [], inserted: [] };

          action.changes.forEach(([prevObject, nextObject]: [Model, Model]) => {
            if (testCriteria(prevObject)) {
              if (!testCriteria(nextObject)) {
                deleted.push(prevObject[this.store.keyPath]);
              } else {
                updated.push(this.transformer(nextObject));
              }
            } else if (testCriteria(nextObject)) {
              inserted.push(this.transformer(nextObject));
            }
          });

          if (deleted.length > 0) {
            changes.push({ type: "deleted", keys: deleted });
          }
          if (updated.length > 0) {
            changes.push({ type: "updated", result: updated });
          }
          if (inserted.length > 0) {
            changes.push({ type: "inserted", result: inserted });
          }

          break;
        }
        default:
          throw new Error("Unsupported type");
      }

      if (changes.length === 0) return;

      callback(null, changes);
    });
    // let _feed;
    // const promise = this.queryCallback(this.store.query(), this.store.r)
    //   .changes({
    //     includeInitial: _includeInitial,
    //     includeStates: true,
    //     includeTypes: true,
    //     includeOffsets: true,
    //   })
    //   .then((feed) => {
    //     if (args.length === 0) {
    //       _feed = feed;
    //       delete this._promise;
    //     }
    //
    //     feed.each(callback);
    //     return feed;
    //   });
    //
    // if (args.length === 0) this._promise = promise;

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

    if (this.options.skip) {
      cursor.advance(this.options.skip);
    }

    if (this.options.limit) {
      await cursor.limit(this.options.limit);
    }

    return cursor;
  }
}
