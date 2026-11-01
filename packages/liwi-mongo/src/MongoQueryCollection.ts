/* eslint-disable complexity */
import type {
  AllowedKeyValue,
  Changes,
  Criteria,
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

interface Memberships<KeyValue, Item> {
  deleted: KeyValue[];
  updated: Item[];
  inserted: Item[];
}

type LocalAction<Model> = Exclude<
  Actions<Model>,
  { type: "changed" } | { type: "resync" }
>;

/** the stored state of each document a local write is about, `undefined` once deleted */
const getWrittenStates = <
  Model extends MongoBaseModel<KeyValue>,
  KeyValue extends AllowedKeyValue,
>(
  action: LocalAction<Model>,
  keyPath: MongoKeyPath,
): Map<KeyValue, Model | undefined> => {
  const states = new Map<KeyValue, Model | undefined>();
  switch (action.type) {
    case "inserted":
      action.next.forEach((next) => states.set(next[keyPath], next));
      break;
    case "deleted":
      action.prev.forEach((prev) => states.set(prev[keyPath], undefined));
      break;
    case "updated":
      action.changes.forEach(([, next]) => states.set(next[keyPath], next));
      break;
    default:
      throw new Error("Unsupported type");
  }
  return states;
};

const toCollectionChanges = <KeyValue, Item>({
  deleted,
  updated,
  inserted,
}: Memberships<KeyValue, Item>): Changes<KeyValue, Item[]> => {
  const changes: Changes<KeyValue, Item[]> = [];
  if (deleted.length > 0) changes.push({ type: "deleted", keys: deleted });
  if (updated.length > 0) changes.push({ type: "updated", result: updated });
  if (inserted.length > 0) changes.push({ type: "inserted", result: inserted });
  return changes;
};

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

      const mingoQuery = new MingoQuery(this.options.criteria);
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

  /**
   * Each subscription keeps the keys its client holds, and decides from them and
   * the stored document alone, never from the emitted `prev`. A `changed`
   * notification (written by another process) is re-read here, in this
   * subscription's order, if it concerns it: a repeated, late or crossing
   * notification leaves the client equal to a fresh fetch. A subscription opened
   * without its initial result still fetches it, to know those keys, and sends it
   * when a write raced with that fetch. With `limit` or `skip`, a document
   * entering or leaving refetches instead: only the server knows what fills or
   * leaves the window.
   */
  _subscribe(
    callback: SubscribeCallback<KeyValue, Item[]>,
    _includeInitial: boolean,
  ): QuerySubscription {
    const store = super.getSubscribeStore();
    const keyPath = this.store.keyPath;
    const testCriteria = this.createTestCriteria();
    let sentKeys = new Set<KeyValue>();
    let total = 0;
    // false until a fetch succeeded: before, the held keys are unknown
    let isReady = false;
    let isInitializing = true;
    let hasActionDuringInit = false;
    let isStopped = false;

    const send = (changes: Changes<KeyValue, Item[]>): void => {
      if (!isStopped && changes.length > 0) callback(null, changes);
    };

    const refetch = (): Promise<Changes<KeyValue, Item[]>> =>
      this.fetch(({ result, meta, info }: QueryResult<Item[]>) => {
        sentKeys = new Set(result.map((item) => item[keyPath]));
        total = meta.total;
        isReady = true;
        return [{ type: "initial", initial: result, queryInfo: info, meta }];
      });

    // without its initial result, the client holds what it fetched itself: a
    // write racing with this fetch may be in neither, so the result reconciles it
    const initialPromise: Promise<void> = refetch().then((changes) => {
      isInitializing = false;
      if (_includeInitial || hasActionDuringInit) send(changes);
    });

    const applyStates = (
      states: Map<KeyValue, Model | undefined>,
    ): Promise<void> | undefined => {
      const memberships = this.computeMemberships(states, sentKeys);
      if (
        this.isWindowed() &&
        (memberships.inserted.length > 0 || memberships.deleted.length > 0)
      ) {
        return refetch().then(send);
      }

      memberships.deleted.forEach((key) => sentKeys.delete(key));
      memberships.inserted.forEach((item) => sentKeys.add(item[keyPath]));
      send(toCollectionChanges(memberships));
      return undefined;
    };

    const rereadAndApply = async (keys: KeyValue[]): Promise<void> => {
      const states = new Map<KeyValue, Model | undefined>(
        keys.map((key) => [key, undefined]),
      );
      const byKeys: Record<string, unknown> = { [keyPath]: { $in: keys } };
      const stored = await this.store.findAll(byKeys as Criteria<Model>);
      stored.forEach((model) => states.set(model[keyPath], model));
      if (!isStopped) await applyStates(states);
    };

    const handleAction = (
      action: Actions<Model>,
    ): Promise<void> | undefined => {
      if (isStopped) return undefined;
      if (action.type === "resync") return refetch().then(send);
      if (!isReady || !this.canTestCriteria()) return undefined;

      // a document the client does not hold may have left the matching set
      // (before a skipped window: shifting the page; past a limit: changing the
      // total), and neither its key nor its new state can tell
      if (this.options.skip || (this.options.limit && total > sentKeys.size)) {
        const keys =
          action.type === "changed"
            ? (action.keys as KeyValue[])
            : [...getWrittenStates<Model, KeyValue>(action, keyPath).keys()];
        if (keys.some((key) => !sentKeys.has(key))) {
          return refetch().then(send);
        }
      }

      if (action.type === "changed") {
        const matchingKeys = new Set(
          action.next.filter(testCriteria).map((model) => model[keyPath]),
        );
        const concernedKeys = (action.keys as KeyValue[]).filter(
          (key) => sentKeys.has(key) || matchingKeys.has(key),
        );
        return concernedKeys.length > 0
          ? rereadAndApply(concernedKeys)
          : undefined;
      }

      return applyStates(getWrittenStates<Model, KeyValue>(action, keyPath));
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

  private canTestCriteria(): boolean {
    return !this.options.criteria || !("$text" in this.options.criteria);
  }

  private isWindowed(): boolean {
    return !!this.options.limit || !!this.options.skip;
  }

  private computeMemberships(
    states: Map<KeyValue, Model | undefined>,
    sentKeys: ReadonlySet<KeyValue>,
  ): Memberships<KeyValue, Item> {
    const testCriteria = this.createTestCriteria();
    const memberships: Memberships<KeyValue, Item> = {
      deleted: [],
      updated: [],
      inserted: [],
    };

    states.forEach((next, key) => {
      const isSent = sentKeys.has(key);
      const isMatching = next !== undefined && testCriteria(next);
      if (isSent && isMatching) {
        memberships.updated.push(this.transformer(next));
      } else if (isSent) {
        memberships.deleted.push(key);
      } else if (isMatching) {
        memberships.inserted.push(this.transformer(next));
      }
    });

    return memberships;
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
