import type { Document, Sort } from "mongodb";
import mongodb from "mongodb";
import { settle } from "./settle.ts";

export interface MemoryCursor<T> {
  next: () => Promise<T | null>;
  tryNext: () => Promise<T | null>;
  hasNext: () => Promise<boolean>;
  toArray: () => Promise<T[]>;
  /** Stops when `iterator` returns `false`. */
  forEach: (iterator: (document: T) => unknown) => Promise<void>;
  close: () => Promise<void>;
  [Symbol.asyncIterator]: () => AsyncGenerator<T, void>;
}

/** Runs `run` on the first read: the results are a snapshot, as a single batch would be. */
export const createMemoryCursor = <T>(
  run: () => T[],
): MemoryCursor<T> & { isStarted: () => boolean } => {
  let pending: T[] | undefined;
  const take = (): T[] => {
    pending ??= run();
    return pending;
  };
  const next = (): Promise<T | null> => settle(() => take().shift() ?? null);

  return {
    isStarted: () => pending !== undefined,
    next,
    tryNext: next,
    hasNext: () => settle(() => take().length > 0),
    toArray: () => settle(() => take().splice(0)),
    forEach: (iterator) =>
      settle(() => {
        for (const document of take().splice(0)) {
          if (iterator(document) === false) return;
        }
      }),
    close: () =>
      settle(() => {
        pending = [];
      }),
    // oxlint-disable-next-line typescript/require-await -- the protocol `for await` reads, nothing to wait for
    async *[Symbol.asyncIterator]() {
      const documents = take();
      while (documents.length > 0) yield documents.shift()!;
    },
  };
};

export interface MemoryFindOptions {
  sort?: Sort;
  projection?: Document;
  skip?: number;
  limit?: number;
}

export interface MemoryFindCursor<T> extends MemoryCursor<T> {
  sort: (sort: Sort) => MemoryFindCursor<T>;
  project: (projection: Document) => MemoryFindCursor<T>;
  skip: (skip: number) => MemoryFindCursor<T>;
  limit: (limit: number) => MemoryFindCursor<T>;
}

export const createMemoryFindCursor = <T>(
  run: (options: MemoryFindOptions) => T[],
  initialOptions: MemoryFindOptions,
): MemoryFindCursor<T> => {
  const options: MemoryFindOptions = { ...initialOptions };
  const { isStarted, ...cursor } = createMemoryCursor(() => run(options));

  const configure = (
    option: keyof MemoryFindOptions,
    value: unknown,
  ): MemoryFindCursor<T> => {
    if (isStarted()) throw new mongodb.MongoCursorInUseError();
    Object.assign(options, { [option]: value });
    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- returns the cursor being built
    return findCursor;
  };

  const findCursor: MemoryFindCursor<T> = {
    ...cursor,
    sort: (sort) => configure("sort", sort),
    project: (projection) => configure("projection", projection),
    skip: (skip) => configure("skip", skip),
    limit: (limit) => configure("limit", limit),
  };
  return findCursor;
};
