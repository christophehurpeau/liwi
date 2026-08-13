import type { MongoIndexDirection } from "./types.ts";

export const buildIndexName = (
  key: Record<string, MongoIndexDirection>,
): string =>
  Object.entries(key)
    .map(([field, direction]) => `${field}_${direction}`)
    .join("_");
