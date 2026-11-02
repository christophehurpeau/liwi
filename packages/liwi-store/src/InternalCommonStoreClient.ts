import type {
  AllowNotFoundOptions,
  PartialUpdateOptions,
  ResultAllowingNotFound,
} from "./Store.ts";
import type { BaseModel, Criteria, Update } from "./types.ts";

export interface InternalCommonStoreClient<Model extends BaseModel> {
  findByKey: (
    key: any,
    criteria?: Criteria<Model>,
  ) => Promise<Model | undefined>;

  replaceOne: <Options extends AllowNotFoundOptions | undefined = undefined>(
    object: Model,
    options?: Options,
  ) => Promise<ResultAllowingNotFound<Model, Options>>;

  partialUpdateByKey: <
    Options extends PartialUpdateOptions | undefined = undefined,
  >(
    key: any,
    partialUpdate: Update<Model>,
    criteria?: Criteria<Model>,
    options?: Options,
  ) => Promise<ResultAllowingNotFound<Model, Options>>;

  deleteByKey: (key: any, criteria?: Criteria<Model>) => Promise<void>;
}
