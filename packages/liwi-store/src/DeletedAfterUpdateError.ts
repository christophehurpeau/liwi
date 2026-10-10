import NotFoundError from "./NotFoundError.ts";

/**
 * The update was applied, but a concurrent write deleted the document
 * before it could be read back.
 */
export default class DeletedAfterUpdateError extends NotFoundError {
  constructor(message = "Deleted after update") {
    super(message);
    this.name = "DeletedAfterUpdateError";
  }
}
