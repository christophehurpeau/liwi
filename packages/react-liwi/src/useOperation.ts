import { useCallback, useState } from "react";

export interface OperationState {
  loading: boolean;
  error: Error | undefined;
}

export type OperationCallWrapper<T extends (...args: any) => Promise<any>> = (
  ...args: Parameters<T>
) => Promise<[Error | any | undefined, Awaited<ReturnType<T>> | undefined]>;

export function useOperation<T extends (...args: any) => Promise<any>>(
  operationCall: T,
): [OperationCallWrapper<T>, OperationState] {
  const [state, setState] = useState<OperationState>(() => ({
    loading: false,
    error: undefined,
  }));

  const operationCallWrapper = useCallback<OperationCallWrapper<T>>(
    (...params: Parameters<T>) => {
      setState({
        loading: true,
        error: undefined,
      });
      try {
        // oxlint-disable-next-line typescript/no-unsafe-argument
        return operationCall(...(params as any)).then(
          (result) => {
            setState({
              loading: false,
              error: undefined,
            });
            return [undefined, result];
          },
          (error: unknown) => {
            setState({
              loading: false,
              error: error instanceof Error ? error : new Error(String(error)),
            });
            return [error, undefined];
          },
        );
      } catch (error) {
        setState({
          loading: false,
          error: error as Error,
        });
        return Promise.resolve([error, undefined]);
      }
    },
    [operationCall],
  );
  return [operationCallWrapper, state];
}
