import { createUnsupportedError } from "./errors.ts";

/** Probed by `await`, serializers and test matchers: reading them must not throw. */
const probedProperties = new Set([
  "then",
  "toJSON",
  "asymmetricMatch",
  "$$typeof",
  "nodeType",
]);

/** A driver method this package does not implement throws its name instead of `undefined is not a function`. */
export const guardUnsupported = <T extends object>(
  target: T,
  label: string,
): T =>
  new Proxy(target, {
    get: (object, property, receiver) => {
      if (typeof property === "symbol" || property in object) {
        return Reflect.get(object, property, receiver) as unknown;
      }
      if (probedProperties.has(property)) return undefined;
      throw createUnsupportedError(`${label}.${property}`);
    },
  });
