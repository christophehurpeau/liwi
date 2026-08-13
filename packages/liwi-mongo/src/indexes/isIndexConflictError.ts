const indexOptionsConflict = 85;
const indexKeySpecsConflict = 86;
const indexNotFound = 27;
const namespaceNotFound = 26;

const getErrorCode = (error: unknown): unknown =>
  typeof error === "object" && error !== null
    ? (error as { code?: unknown }).code
    : undefined;

export const isIndexConflictError = (error: unknown): boolean => {
  const code = getErrorCode(error);
  return code === indexOptionsConflict || code === indexKeySpecsConflict;
};

export const isIndexNotFoundError = (error: unknown): boolean =>
  getErrorCode(error) === indexNotFound;

export const isNamespaceNotFoundError = (error: unknown): boolean =>
  getErrorCode(error) === namespaceNotFound;
