import type {
  Query,
  QueryParams,
  QueryResult,
  QuerySubscription,
  SubscribeCallback,
  ToServerQueryPayload,
} from "liwi-resources";
import { Logger } from "nightingale-logger";
import type { TransportClient } from "./TransportClient.ts";

const logger = new Logger("liwi:resources:query");

export class ClientQuery<
  Result,
  Params extends QueryParams<Params>,
> implements Query<Result, Params> {
  private readonly resourceName: string;

  private readonly transportClient: TransportClient;

  key: string;

  private params: Params;

  // eslint-disable-next-line @typescript-eslint/max-params
  constructor(
    resourceName: string,
    transportClient: TransportClient,
    key: string,
    params: Params,
  ) {
    this.resourceName = resourceName;
    this.transportClient = transportClient;
    this.key = key;
    this.params = params;
  }

  changeParams(params: Params): void {
    this.params = params;
  }

  changePartialParams(
    params: Params extends undefined ? never : Partial<Params>,
  ): void {
    this.params = { ...this.params, ...params };
  }

  private getTransportPayload(): ToServerQueryPayload {
    return {
      resourceName: this.resourceName,
      key: this.key,
      params: this.params,
    };
  }

  fetch<T>(onFulfilled?: (result: QueryResult<Result>) => T): Promise<T> {
    logger.debug("fetch", {
      resourceName: this.resourceName,
      key: this.key,
    });
    return this.transportClient
      .send<"fetch", QueryResult<Result>>("fetch", this.getTransportPayload())
      .then(onFulfilled);
  }

  fetchAndSubscribe(
    callback: SubscribeCallback<any, Result>,
  ): QuerySubscription {
    logger.debug("fetchAndSubscribe", {
      resourceName: this.resourceName,
      key: this.key,
    });

    return this.transportClient.subscribe(
      "fetchAndSubscribe",
      this.getTransportPayload(),
      callback,
    );
  }

  subscribe(callback: SubscribeCallback<any, Result>): QuerySubscription {
    logger.debug("subscribe", {
      resourceName: this.resourceName,
      key: this.key,
    });

    return this.transportClient.subscribe(
      "subscribe",
      this.getTransportPayload(),
      callback,
    );
  }
}
