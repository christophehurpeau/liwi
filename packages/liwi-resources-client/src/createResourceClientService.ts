import type { ServiceInterface as ClientServiceInterface } from "liwi-resources";
import { ClientQuery } from "./ClientQuery.ts";
import type { TransportClient } from "./TransportClient";

const getKeys = <T extends Record<keyof T, unknown>>(o: T): (keyof T)[] =>
  Object.keys(o) as (keyof T)[];

interface CreateResourceClientOptions<
  QueryKeys extends keyof any,
  OperationKeys extends keyof any,
> {
  queries: Record<QueryKeys, null>;
  operations: Record<OperationKeys, null>;
}

export const createResourceClientService = <
  Service extends ClientServiceInterface<any, any>,
>(
  resourceName: string,
  options: CreateResourceClientOptions<
    keyof Service["queries"],
    keyof Service["operations"]
  >,
): ((transportClient: TransportClient) => Service) => {
  return (transportClient: TransportClient): Service => {
    const queries: Partial<Service["queries"]> = {};
    const operations: Partial<Service["operations"]> = {};
    getKeys(options.queries).forEach((queryKey) => {
      queries[queryKey] = ((params: any) =>
        new ClientQuery(
          resourceName,
          transportClient,
          queryKey as string,
          params,
        )) as any;
    });
    getKeys(options.operations).forEach((operationKey) => {
      operations[operationKey] = ((params: any) =>
        transportClient.send("do", {
          resourceName,
          operationKey: operationKey as string,
          params,
        })) as any;
    });
    return {
      queries,
      operations,
    } as unknown as Service;
  };
};
