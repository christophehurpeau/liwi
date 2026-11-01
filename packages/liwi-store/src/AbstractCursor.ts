import type { BaseModel } from "./types.ts";

export default abstract class AbstractCursor<
  Model extends BaseModel,
  Result extends Partial<Model> = Model,
> {
  abstract close(): Promise<void> | void;

  abstract next(): Promise<any>;

  nextResult(): Promise<Result> {
    return this.next().then(() => this.result());
  }

  abstract limit(newLimit: number): Promise<this>;

  abstract toArray(): Promise<Result[]>;

  abstract result(): Promise<Result>;

  async forEachKeys(
    callback: (key: any) => Promise<void> | void,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const key = await this.next();
      if (!key) return;

      await callback(key);
    }
  }

  forEach(callback: (result: Result) => Promise<void> | void): Promise<void> {
    return this.forEachKeys(() =>
      this.result().then((result) => callback(result)),
    );
  }

  *keysIterator(): Generator<Promise<any>, void, undefined> {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      yield this.next();
    }
  }

  *[Symbol.iterator](): Generator<Promise<Result>, void, undefined> {
    for (const keyPromise of this.keysIterator()) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      yield keyPromise.then((key) => key && this.result());
    }
  }

  // TODO Symbol.asyncIterator, https://phabricator.babeljs.io/T7356
  /*
    async *keysAsyncIterator() {
        while (true) {
             const key = await this.next();
             if (!key) return;

             yield key;
        }
     }

     async *[Symbol.asyncIterator] {
        for await (let key of this.keysAsyncIterator()) {
            yield await this.result();
        }
     }
     */
}
