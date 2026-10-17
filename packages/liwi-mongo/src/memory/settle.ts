/** Runs `run` now, its throw as a rejection: driver methods never throw synchronously. */
export const settle = <Result>(run: () => Result): Promise<Result> =>
  new Promise((resolve) => {
    resolve(run());
  });
