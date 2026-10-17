import type { Sort, SortDirection } from "mongodb";
import { createUnsupportedError } from "./errors.ts";

const toDirection = (direction: SortDirection): -1 | 1 => {
  switch (direction) {
    case 1:
    case "asc":
    case "ascending":
      return 1;
    case -1:
    case "desc":
    case "descending":
      return -1;
    default:
      throw createUnsupportedError(`sort ${JSON.stringify(direction)}`);
  }
};

const sortDirections = new Set<unknown>([
  1,
  -1,
  "asc",
  "ascending",
  "desc",
  "descending",
]);

const isSortPair = (
  sort: readonly unknown[],
): sort is [string, SortDirection] =>
  sort.length === 2 &&
  typeof sort[0] === "string" &&
  sortDirections.has(sort[1]);

const listSortEntries = (sort: Sort): [string, SortDirection][] => {
  if (typeof sort === "string") return [[sort, 1]];
  if (sort instanceof Map) {
    return [...(sort as Map<string, SortDirection>).entries()];
  }
  if (Array.isArray(sort)) {
    if (isSortPair(sort)) return [sort];
    return (sort as (string | [string, SortDirection])[]).map((entry) =>
      typeof entry === "string" ? [entry, 1] : entry,
    );
  }
  return Object.entries(sort as Record<string, SortDirection>);
};

/** The driver's sort shapes as one `{ field: 1 | -1 }`, in order. */
export const normalizeSort = (sort: Sort): Record<string, -1 | 1> =>
  Object.fromEntries(
    listSortEntries(sort).map(([field, direction]) => [
      field,
      toDirection(direction),
    ]),
  );
