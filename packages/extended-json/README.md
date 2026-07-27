<h1 align="center">
  extended-json
</h1>

<p align="center">
  extended json with date using reviver
</p>

<p align="center">
  <a href="https://npmjs.org/package/extended-json"><img src="https://img.shields.io/npm/v/extended-json.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/extended-json"><img src="https://img.shields.io/npm/dw/extended-json.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/extended-json"><img src="https://img.shields.io/node/v/extended-json.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/extended-json"><img src="https://img.shields.io/npm/types/extended-json.svg?style=flat-square" alt="types"></a>
  <a href="https://codecov.io/gh/christophehurpeau/liwi"><img src="https://img.shields.io/codecov/c/github/christophehurpeau/liwi/main.svg?style=flat-square"></a>
</p>

## About

JSON with `Date` support. `stringify` is plain `JSON.stringify` (dates already serialize to ISO strings through `toJSON`); `parse` adds a reviver turning ISO-8601 UTC strings back into `Date` instances.

This is the wire format used between `liwi-resources-client` and `liwi-resources-server`.

## Install

```bash
npm install --save extended-json
```

## Usage

```js
import { parse, stringify } from "extended-json";

const json = stringify({
  label: "task",
  created: new Date("2020-01-01T10:00:00Z"),
});
// '{"label":"task","created":"2020-01-01T10:00:00.000Z"}'

const value = parse(json);
value.created instanceof Date; // true
```

`encode` / `decode` are aliases of `stringify` / `parse`:

```js
import { decode, encode } from "extended-json";
```

## API

### `stringify(value, replacer?, space?): string`

Same signature and behaviour as `JSON.stringify`.

### `parse<Value = ExtendedJsonValue>(text, reviver?): Value`

Parses `text` and revives every string matching `YYYY-MM-DDTHH:mm:ss(.sss)Z` as a `Date` (built with `Date.UTC`). A custom `reviver` runs _after_ the internal one, so it receives the already-revived value.

```ts
const value = parse<{ created: Date }>(
  '{"created":"2020-01-01T10:00:00.000Z"}',
);
```

### `ExtendedJsonValue`

```ts
type ExtendedJsonValue =
  | Date
  | ExtendedJsonRecord
  | ExtendedJsonValue[]
  | boolean
  | number
  | string
  | null
  | undefined;
```

## Caveats

- Only UTC (`Z`-suffixed) ISO strings are revived; offsets like `+02:00` are left as strings.
- Any string that looks like an ISO-8601 UTC date becomes a `Date`, even when it was meant to stay a string.
