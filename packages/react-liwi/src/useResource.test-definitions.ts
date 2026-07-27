import type { Query } from "liwi-resources-client";
import { useResource } from "./useResource";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Test {}

export function TestDataNotUndefinedWhenLoadingTrue(): void {
  const testResource = useResource(
    (() => {}) as unknown as (
      params: Record<string, unknown>,
    ) => Query<Test[], any>,
    {
      params: {},
    },
    [],
  );

  if (testResource.initialLoading) return;
  if (testResource.initialError) return;

  console.log(testResource.data[0]);
}

export function TestDataNotUndefinedWhenLoadingTrueWhenDestructuring(): void {
  const { initialLoading, data: tests } = useResource(
    (() => {}) as unknown as (
      params: Record<string, unknown>,
    ) => Query<Test[], any>,
    {
      params: {},
    },
    [],
  );

  if (initialLoading) return;

  // @ts-expect-error tests could be undefined
  console.log(tests[0]);
}

export function TestParamsUndefined(): void {
  const { initialLoading, data: tests } = useResource(
    (() => {}) as unknown as (
      params: Record<string, unknown>,
    ) => Query<Test[], any>,
    {},
    [],
  );

  if (initialLoading) return;

  // @ts-expect-error tests could be undefined
  console.log(tests[0]);
}

export function TestParamsShouldBeRequired(): void {
  const { initialLoading, data: tests } = useResource(
    (() => {}) as unknown as (params: {
      page: number;
    }) => Query<Test[], { page: number }>,
    // @ts-expect-error we don't care about params for this test
    {},
    [],
  );

  if (initialLoading) return;

  // @ts-expect-error tests could be undefined
  console.log(tests[0]);
}

/* Alternatives

const tests = useResource();
if (tests.loading) return;
console.log(tests[0]);

const { data: tests } = useResource();
if (!data) return;
console.log(tests[0]);

///////

const { loading, data: test } = useSingleItemResource();

// bad: can be null
if (!data) return;
console.log(tests[0]);

*/
