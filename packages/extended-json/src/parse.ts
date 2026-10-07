import type { ExtendedJsonValue } from "./ExtendedJsonValue.ts";

const regexpStringDate =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/;

type JsonReviver = <T extends ExtendedJsonValue>(
  key: string,
  value: T,
) => ExtendedJsonValue;

const internalReviver: JsonReviver = function internalReviver<
  T extends ExtendedJsonValue,
>(key: string, value: T): Date | T {
  if (typeof value === "string") {
    const matchDate = regexpStringDate.exec(value);
    if (matchDate) {
      return new Date(
        Date.UTC(
          +matchDate[1]!,
          +matchDate[2]! - 1,
          +matchDate[3]!,
          +matchDate[4]!,
          +matchDate[5]!,
          +matchDate[6]!,
        ),
      );
    }
  }

  return value;
};

/**
 * @param  {string}   text      The string to parse as JSON
 * @param  {function} [reviver] If a function, prescribes how the value originally produced by parsing is transformed, before being returned
 * @return {*}
 */
export default function parse<Value = ExtendedJsonValue>(
  text: string,
  reviver?: JsonReviver,
): Value {
  return JSON.parse(
    text,
    reviver == null
      ? internalReviver
      : (key, value) => reviver(key, internalReviver(key, value)),
  ) as Value;
}
