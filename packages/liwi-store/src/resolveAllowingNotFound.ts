import type NotFoundError from "./NotFoundError.ts";
import type { AllowNotFoundOptions, ResultAllowingNotFound } from "./Store.ts";

/** Throws the created error when `result` is missing, unless `allowNotFound`. */
export const resolveAllowingNotFound = <
  Model,
  Options extends AllowNotFoundOptions | undefined,
>(
  result: Model | null | undefined,
  options: Options | undefined,
  createError: () => NotFoundError,
): ResultAllowingNotFound<Model, Options> => {
  if (result == null && !options?.allowNotFound) throw createError();
  return (result ?? undefined) as ResultAllowingNotFound<Model, Options>;
};
