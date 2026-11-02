export { default as AbstractConnection } from "./AbstractConnection.ts";
export { default as AbstractCursor } from "./AbstractCursor.ts";
export { default as AbstractStoreCursor } from "./AbstractStoreCursor.ts";
export { default as DeletedAfterUpdateError } from "./DeletedAfterUpdateError.ts";
export { default as NotFoundError } from "./NotFoundError.ts";
export { default as ProtectedFieldUpdateError } from "./ProtectedFieldUpdateError.ts";
export { resolveAllowingNotFound } from "./resolveAllowingNotFound.ts";

export type { InternalCommonStoreClient } from "./InternalCommonStoreClient.ts";

export type { SubscribableStore } from "./SubscribableStore.ts";
export type { SubscribableStoreQuery } from "./SubscribableStoreQuery.ts";

export type {
  AllowNotFoundOptions,
  DeleteResult,
  PartialUpdateOptions,
  PartialUpdateResult,
  ResultAllowingNotFound,
  Store,
  TouchUpdatedOptions,
  UpsertResult,
  UpsertPartialObject,
  WriteResult,
} from "./Store.ts";

export type {
  Query,
  QuerySubscription,
  QueryParams,
  QueryResult,
  SubscribeCallback,
} from "./Query.ts";

export type * from "./types.ts";
