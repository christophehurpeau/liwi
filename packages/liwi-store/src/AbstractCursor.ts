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
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    while (true) {
      // oxlint-disable-next-line typescript/no-unsafe-assignment
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

  /**
   * Ends only once a yielded key has resolved empty: await each promise before
   * reading the next one, the last resolves `undefined`. Prefer `keysAsyncIterator`.
   */
  *keysIterator(): Generator<Promise<any>, void, undefined> {
    let ended = false;
    const markEndedIfEmpty = <Key>(key: Key): Key => {
      if (!key) ended = true;
      return key;
    };
    while (!ended) {
      yield this.next().then(markEndedIfEmpty);
    }
  }

  /**
   * Ends only once a yielded result has resolved empty: await each promise before
   * reading the next one, the last resolves `undefined`. Prefer `for await`.
   */
  *[Symbol.iterator](): Generator<Promise<Result>, void, undefined> {
    for (const keyPromise of this.keysIterator()) {
      // oxlint-disable-next-line typescript/no-unsafe-return
      yield keyPromise.then((key) => key && this.result());
    }
  }

  async *keysAsyncIterator(): AsyncGenerator<any, void, undefined> {
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    while (true) {
      // oxlint-disable-next-line typescript/no-unsafe-assignment
      const key = await this.next();
      if (!key) return;

      yield key;
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Result, void, undefined> {
    while (await this.next()) {
      yield await this.result();
    }
  }
}
