import type { BaseModel, Criteria } from "./types";
interface Test1 extends BaseModel {
    name: string;
    nested: {
        value: number;
    }[];
    deep: {
        items: {
            id: number;
        }[];
    };
}
type CriteriaTest1 = Criteria<Test1>;
export declare const test1_properties: CriteriaTest1;
export declare const test1_arrayne: CriteriaTest1;
export declare const test1_array0ne: CriteriaTest1;
export declare const test1_invalid: CriteriaTest1;
export declare const test1_arrayIndexless: CriteriaTest1;
export declare const test1_arrayIndexlessOperator: CriteriaTest1;
export declare const test1_arrayIndexlessInvalidValue: CriteriaTest1;
export declare const test1_arrayIndexlessInvalidPath: CriteriaTest1;
export declare const test1_elemMatch: CriteriaTest1;
export declare const test1_elemMatchInvalidPath: CriteriaTest1;
export declare const test1_elemMatchOnNonArray: CriteriaTest1;
export declare const test1_all: CriteriaTest1;
export declare const test1_size: CriteriaTest1;
interface Test2 extends BaseModel {
    location: {
        type: "Point";
        coordinates: [number, number];
    };
    tags: string[];
}
type CriteriaTest2 = Criteria<Test2>;
export declare const test2_geoWithin: CriteriaTest2;
export declare const test2_near: CriteriaTest2;
export declare const test2_geoInvalid: CriteriaTest2;
export declare const test2_scalarArrayElemMatch: CriteriaTest2;
export {};
//# sourceMappingURL=types-test.d.ts.map