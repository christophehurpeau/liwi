/* eslint-disable camelcase */
import type { BaseModel, Criteria } from "./types";

interface Test1 extends BaseModel {
  name: string;
  nested: {
    value: number;
  }[];
  deep: {
    items: { id: number }[];
  };
}

type CriteriaTest1 = Criteria<Test1>;

export const test1_properties: CriteriaTest1 = {
  name: "test",
  nested: [{ value: 1 }],
};

export const test1_arrayne: CriteriaTest1 = {
  name: "test",
  nested: { $ne: [] },
};

export const test1_array0ne: CriteriaTest1 = {
  name: "test",
  "nested.0": { $ne: { value: 9 } },
  "nested.1": { value: 2 },
  "nested.2.value": 3,
  "nested.3.value": { $ne: 4 },
  // @ts-expect-error -- invalid path
  "nested.4.invalid": 6,
};

export const test1_invalid: CriteriaTest1 = {
  // @ts-expect-error -- invalid path
  invalid: true,
};

export const test1_arrayIndexless: CriteriaTest1 = {
  "nested.value": 1,
};

export const test1_arrayIndexlessOperator: CriteriaTest1 = {
  "nested.value": { $in: [1, 2] },
  "deep.items.id": { $ne: 3 },
};

export const test1_arrayIndexlessInvalidValue: CriteriaTest1 = {
  // @ts-expect-error -- invalid value type
  "nested.value": "not-a-number",
};

export const test1_arrayIndexlessInvalidPath: CriteriaTest1 = {
  // @ts-expect-error -- invalid path
  "nested.invalid": 1,
};

export const test1_elemMatch: CriteriaTest1 = {
  nested: { $elemMatch: { value: { $gt: 1 } } },
};

export const test1_elemMatchInvalidPath: CriteriaTest1 = {
  // @ts-expect-error -- invalid path in element
  nested: { $elemMatch: { invalid: 1 } },
};

export const test1_elemMatchOnNonArray: CriteriaTest1 = {
  // @ts-expect-error -- $elemMatch is only valid on array fields
  name: { $elemMatch: { value: 1 } },
};

export const test1_all: CriteriaTest1 = {
  nested: { $all: [{ value: 1 }] },
};

export const test1_size: CriteriaTest1 = {
  nested: { $size: 1 },
  // @ts-expect-error -- $size is only valid on array fields
  name: { $size: 1 },
};

interface Test2 extends BaseModel {
  location: { type: "Point"; coordinates: [number, number] };
  tags: string[];
}

type CriteriaTest2 = Criteria<Test2>;

export const test2_geoWithin: CriteriaTest2 = {
  location: {
    $geoWithin: {
      $geometry: { type: "Polygon", coordinates: [[[0, 0]]] },
    },
  },
};

export const test2_near: CriteriaTest2 = {
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [0, 0] },
      $maxDistance: 100,
    },
  },
};

export const test2_geoInvalid: CriteriaTest2 = {
  location: {
    // @ts-expect-error -- unknown geometry type
    $geoWithin: { $geometry: { type: "Circle", coordinates: [0, 0] } },
  },
};

export const test2_scalarArrayElemMatch: CriteriaTest2 = {
  tags: { $elemMatch: { $in: ["a", "b"] } },
};
