import { AbstractStoreCursor } from "liwi-store";
import type { AllowedKeyValue } from "liwi-store";
import type { FindCursor } from "mongodb";
import type { MongoBaseModel } from "./MongoBaseModel.ts";
import type MongoStore from "./MongoStore.ts";

export default class MongoCursor<
  Model extends MongoBaseModel<KeyValue>,
  Result extends Partial<Model> = Model,
  KeyValue extends AllowedKeyValue = Model["_id"],
> extends AbstractStoreCursor<
  MongoStore<Model, KeyValue>,
  KeyValue,
  Model,
  Result
> {
  // key in AbstractCursor

  private readonly cursor: FindCursor<Result>;

  private _result?: Result | null;

  constructor(store: MongoStore<Model, KeyValue>, cursor: FindCursor<Result>) {
    super(store);
    this.cursor = cursor;
  }

  advance(count: number): void {
    this.cursor.skip(count);
  }

  next(): Promise<KeyValue | undefined> {
    return this.cursor.next().then((value) => {
      this._result = value;
      this.key = value?._id;
      return this.key;
    });
  }

  override async forEach(
    callback: (result: Result) => Promise<void> | void,
  ): Promise<void> {
    for await (const result of this.cursor) {
      await callback(result);
    }
  }

  limit(newLimit: number): Promise<this> {
    this.cursor.limit(newLimit);
    return Promise.resolve(this);
  }

  override result(): Promise<Result> {
    if (!this._result) throw new Error("Cannot call result() before next()");
    return Promise.resolve(this._result);
  }

  async close(): Promise<void> {
    if (this.cursor) {
      await this.cursor.close();
    }
  }

  toArray(): Promise<Result[]> {
    return this.cursor.toArray();
  }
}
