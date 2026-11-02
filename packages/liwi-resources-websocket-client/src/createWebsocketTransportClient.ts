import type { ExtendedJsonValue } from "extended-json";
import { decode, encode } from "extended-json";
import { ResourcesServerError } from "liwi-resources-client";
import type {
  AckError,
  ToClientMessage,
  ToServerMessages,
  ToServerSubscribeMessages,
  TransportClient,
  TransportClientSubscribeCallback,
  TransportClientSubscribeResult,
} from "liwi-resources-client";
import { Logger } from "nightingale-logger";
import type { SimpleWebsocketClientOptions } from "./createSimpleWebsocketClient.ts";
import createSimpleWebsocketClient from "./createSimpleWebsocketClient.ts";

const logger = new Logger("liwi:resources-websocket-client");

type Resolve<T> = (result: T) => void;
type Reject = (reason?: any) => void;

interface Ack<T> {
  reject: Reject;
  resolve: Resolve<T>;
}

interface Subscription<
  T extends keyof ToServerSubscribeMessages<any>,
  U,
  Message extends { payload: any } = any,
> extends Ack<U> {
  type: T;
  message: Message;
  callback: TransportClientSubscribeCallback<U>;
  /** once settled, failures go to `callback`: its promise has nobody left to tell */
  isSettled: boolean;
}

export type WebsocketTransportClientOptions = Omit<
  SimpleWebsocketClientOptions,
  "onMessage" | "url"
> &
  Partial<Pick<SimpleWebsocketClientOptions, "url">>;

type PromiseExecutor<T> = (
  resolve: (value: PromiseLike<T> | T) => void,
  reject: (reason?: any) => void,
) => void;

type Handler<T> = (id: number, error: AckError | null, result: T) => void;

class SubscribeResultPromise<
  Result,
  Payload extends Record<string & keyof Payload, ExtendedJsonValue | undefined>,
>
  implements
    TransportClientSubscribeResult<Result, Payload>,
    PromiseLike<Result>
{
  private readonly promise: Promise<Result>;

  readonly stop: TransportClientSubscribeResult<Result, Payload>["stop"];

  readonly cancel: TransportClientSubscribeResult<Result, Payload>["cancel"];

  // readonly changePayload: TransportClientSubscribeResult<
  //   Result,
  //   Payload
  // >['changePayload'];

  constructor({
    executor,
    stop,
  }: {
    executor: PromiseExecutor<Result>;
    stop: TransportClientSubscribeResult<Result, Payload>["stop"];
    // changePayload: TransportClientSubscribeResult<
    //   Result,
    //   Payload
    // >['changePayload'];
  }) {
    this.promise = new Promise<Result>((resolve, reject) => {
      executor(resolve, reject);
    });
    this.stop = stop;
    this.cancel = stop;
    // this.changePayload = changePayload;
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => PromiseLike<TResult1> | TResult1) | null,
    onrejected?: ((reason: any) => PromiseLike<TResult2> | TResult2) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected);
  }

  catch<TResult2 = never>(
    onrejected?: ((reason: unknown) => PromiseLike<TResult2> | TResult2) | null,
  ): PromiseLike<Result | TResult2> {
    return this.promise.catch(onrejected);
  }
}

// TODO handle send before connected

const createSafeError = (error: AckError): ResourcesServerError => {
  return new ResourcesServerError(error.code, error.message);
};

export default function createResourcesWebsocketClient({
  url,
  ...options
}: WebsocketTransportClientOptions): TransportClient {
  let currentId = 1;
  let currentSubscriptionId = 1;
  const acks = new Map<number, Ack<any>>(); // TODO in progress / unsent / sending => find better name
  const subscriptions = new Map<number, Subscription<any, any>>();

  if (!url) {
    const { location } = globalThis;
    if (!location) {
      throw new Error(
        "`url` is required when globalThis.location is undefined",
      );
    }
    url = `ws${location.protocol === "https:" ? "s" : ""}://${location.host}/ws`;
  }
  logger.info("create", { url });

  const handlers: Record<ToClientMessage[0], Handler<any>> = {
    ack: (id, error, result) => {
      logger.debug("ack", { id });
      const ack = acks.get(id);
      if (!ack) {
        logger.warn("no ack found", { id });
      } else if (error) {
        ack.reject(createSafeError(error));
      } else {
        ack.resolve(result);
      }
    },
    subscription: (id, error, result) => {
      logger.debug("subscription", { id });
      const subscription = subscriptions.get(id);
      if (!subscription) {
        if (id < currentSubscriptionId) {
          logger.warn("subscription previously closed", { id });
        } else {
          logger.warn("no subscription found", { id });
        }
      } else if (error) {
        subscription.callback(createSafeError(error), null);
      } else {
        subscription.callback(null, result);
      }
    },
  };

  const wsClient = createSimpleWebsocketClient({
    ...options,
    url,
    onMessage: (message) => {
      logger.debug("message", { data: message.data });
      const [type, id, error, result] = decode<ToClientMessage>(
        message.data as string,
      );
      const handler = handlers[type];

      if (handler) {
        handler(id, error, result);
      }
    },
  });

  const sendMessage = <T extends keyof ToServerMessages>(
    type: T,
    id: number | null,
    payload: ToServerMessages[T][0],
  ): void => {
    wsClient.sendMessage(encode([type, id, payload as any]));
  };

  const sendWithAck = <T extends keyof ToServerMessages>(
    type: T,
    message: ToServerMessages[T][0],
  ): Promise<ToServerMessages[T][1]> => {
    return new Promise((resolve, reject) => {
      const id = currentId++;
      acks.set(id, {
        resolve: (result) => {
          acks.delete(id);

          resolve(result);
        },
        reject: (err: Error) => {
          acks.delete(id);
          reject(err);
        },
      });
      sendMessage(type, id, message);
    });
  };

  /**
   * A failure caused by a disconnection is retried on the next connection, and
   * settles nothing. A refusal by the server rejects the subscription's promise
   * the first time, and reaches its callback after a re-subscription.
   */
  const sendSubscription = (subscription: Subscription<any, any>): void => {
    sendWithAck(subscription.type, subscription.message).then(
      (result) => {
        subscription.isSettled = true;
        subscription.resolve(result);
      },
      (error: unknown) => {
        if (!wsClient.isConnected()) return;
        if (subscription.isSettled) {
          subscription.callback(error as Error, null);
        } else {
          subscription.isSettled = true;
          subscription.reject(error);
        }
      },
    );
  };

  const sendThrowNotConnected = (): never => {
    const error = new Error("Websocket not connected");
    error.name = "NetworkError";
    throw error;
  };

  const resourcesClient: TransportClient = {
    connect: () => {
      logger.debug("connect");
      wsClient.connect();
    },
    close: () => {
      logger.debug("close");
      wsClient.close();
    },
    listenStateChange: wsClient.listenStateChange,
    send: sendThrowNotConnected,

    subscribe: <
      T extends keyof ToServerSubscribeMessages<Payload>,
      Payload extends Record<string & keyof Payload, ExtendedJsonValue>,
      Result,
      V extends ToServerSubscribeMessages<Payload>[T][2],
    >(
      type: T,
      messageWithoutSubscriptionId: Omit<
        ToServerSubscribeMessages<Payload, Result>[T][0],
        "subscriptionId"
      >,
      callback: TransportClientSubscribeCallback<V>,
    ): TransportClientSubscribeResult<Result, Payload> => {
      const id = currentId++;
      const subscriptionId = currentSubscriptionId++;
      const message = { ...messageWithoutSubscriptionId, subscriptionId };

      return new SubscribeResultPromise<Result, Payload>({
        executor: (resolve, reject) => {
          const subscription: Subscription<any, any> = {
            type,
            message,
            resolve,
            reject,
            callback,
            isSettled: false,
          };
          subscriptions.set(subscriptionId, subscription);
          if (wsClient.isConnected()) sendSubscription(subscription);
        },
        stop: (): void => {
          acks.delete(id);
          subscriptions.delete(subscriptionId);
          // the server drops a socket's subscriptions when it closes: nothing to
          // tell it while disconnected
          if (wsClient.isConnected()) {
            sendMessage("subscribe:close", null, { subscriptionId });
          }
        },

        // changePayload: (payload: Payload): Promise<void> => {
        //   return new Promise((resolve, reject) => {
        //     const subscription = subscriptions.get(subscriptionId);
        //     if (!subscription) return reject(new Error('Invalid subscription'));
        //     subscription.message.payload = payload;
        //     if (wsClient.isConnected()) {
        //       sendWithAck('subscribe:changePayload', payload).then(
        //         resolve,
        //         reject,
        //       );
        //     } else {
        //       return reject(new Error('Not connected'));
        //     }
        //   });
        // },
      });
    },
  };

  wsClient.listenStateChange((newState) => {
    logger.info("newState", { newState });
    if (newState === "connected") {
      resourcesClient.send = sendWithAck as TransportClient["send"];
      subscriptions.forEach(sendSubscription);
    } else {
      resourcesClient.send = sendThrowNotConnected;
      acks.forEach((ack) => {
        ack.reject(
          new Error(`Failed to get ack, connection state is now ${newState}`),
        );
      });
      acks.clear();

      // closed is final: a later connect() does not resume them
      if (newState === "closed") {
        subscriptions.forEach((subscription) => {
          subscription.reject(new Error("Subscription closed"));
        });
        subscriptions.clear();
      }
    }
  });

  return resourcesClient;
}
