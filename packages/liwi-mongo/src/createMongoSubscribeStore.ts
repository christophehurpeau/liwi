import type { AllowedKeyValue } from "liwi-store";
import { SubscribeStore } from "liwi-subscribe-store";
import type {
  MongoBaseModel,
  MongoInsertType,
  MongoKeyPath,
} from "./MongoBaseModel.ts";
import type MongoConnection from "./MongoConnection.ts";
import type MongoStore from "./MongoStore.ts";

export default function createMongoSubscribeStore<
  Model extends MongoBaseModel<KeyValue>,
  KeyValue extends AllowedKeyValue = Model[MongoKeyPath],
>(
  mongoStore: MongoStore<Model, KeyValue>,
): SubscribeStore<
  MongoKeyPath,
  KeyValue,
  Model,
  MongoInsertType<Model, KeyValue>,
  MongoConnection,
  MongoStore<Model, KeyValue>
> {
  return new SubscribeStore(mongoStore);
}

export { type SubscribeStore } from "liwi-subscribe-store";
