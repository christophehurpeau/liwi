import assert from "node:assert/strict";
import { describe, test } from "node:test";
// eslint-disable-next-line import-x/extensions
import { ClientQuery } from "./ClientQuery.ts";
// eslint-disable-next-line import-x/extensions
import type { TransportClient } from "./TransportClient.ts";

interface Item {
  _id: string;
}

interface Params {
  status: string;
  limit: number;
}

interface SendCall {
  type: string;
  message: any;
}

interface SubscribeCall {
  type: string;
  message: any;
  callback: unknown;
}

const createFakeTransportClient = (): {
  transportClient: TransportClient;
  sendCalls: SendCall[];
  subscribeCalls: SubscribeCall[];
} => {
  const sendCalls: SendCall[] = [];
  const subscribeCalls: SubscribeCall[] = [];
  const transportClient = {
    connect: () => undefined,
    close: () => undefined,
    listenStateChange: () => () => undefined,
    send: (type: string, message: any) => {
      sendCalls.push({ type, message });
      return Promise.resolve("send-result");
    },
    subscribe: (type: string, message: any, callback: unknown) => {
      subscribeCalls.push({ type, message, callback });
      return { subscription: true };
    },
  } as unknown as TransportClient;
  return { transportClient, sendCalls, subscribeCalls };
};

const initialParams: Params = { status: "open", limit: 10 };

describe("ClientQuery", () => {
  test("changeParams replaces the params sent in the payload", async () => {
    const { transportClient, sendCalls } = createFakeTransportClient();
    const query = new ClientQuery(
      "posts",
      transportClient,
      "queryAll",
      initialParams,
    );
    query.changeParams({ status: "closed", limit: 5 });
    await query.fetch();
    assert.deepEqual(sendCalls[0]!.message.params, {
      status: "closed",
      limit: 5,
    });
  });

  test("changePartialParams merges over existing params", async () => {
    const { transportClient, sendCalls } = createFakeTransportClient();
    const query = new ClientQuery(
      "posts",
      transportClient,
      "queryAll",
      initialParams,
    );
    query.changePartialParams({ limit: 20 });
    await query.fetch();
    assert.deepEqual(sendCalls[0]!.message.params, {
      status: "open",
      limit: 20,
    });
  });

  test("fetch sends a fetch message with resourceName, key and params", async () => {
    const { transportClient, sendCalls } = createFakeTransportClient();
    const query = new ClientQuery(
      "posts",
      transportClient,
      "queryAll",
      initialParams,
    );
    const result = await query.fetch();
    assert.equal(sendCalls.length, 1);
    assert.equal(sendCalls[0]!.type, "fetch");
    assert.deepEqual(sendCalls[0]!.message, {
      resourceName: "posts",
      key: "queryAll",
      params: initialParams,
    });
    assert.equal(result, "send-result");
  });

  test("fetch applies the onFulfilled transform", async () => {
    const { transportClient } = createFakeTransportClient();
    const query = new ClientQuery(
      "posts",
      transportClient,
      "queryAll",
      initialParams,
    );
    const result = await query.fetch(
      (value) => `${value as unknown as string}!`,
    );
    assert.equal(result, "send-result!");
  });

  test("fetchAndSubscribe forwards type, payload and callback to the transport", () => {
    const { transportClient, subscribeCalls } = createFakeTransportClient();
    const query = new ClientQuery<Item[], Params>(
      "posts",
      transportClient,
      "queryAll",
      initialParams,
    );
    const callback = () => undefined;
    query.fetchAndSubscribe(callback);
    assert.equal(subscribeCalls.length, 1);
    assert.equal(subscribeCalls[0]!.type, "fetchAndSubscribe");
    assert.deepEqual(subscribeCalls[0]!.message, {
      resourceName: "posts",
      key: "queryAll",
      params: initialParams,
    });
    assert.equal(subscribeCalls[0]!.callback, callback);
  });

  test("subscribe forwards the subscribe type to the transport", () => {
    const { transportClient, subscribeCalls } = createFakeTransportClient();
    const query = new ClientQuery<Item[], Params>(
      "posts",
      transportClient,
      "queryAll",
      initialParams,
    );
    query.subscribe(() => undefined);
    assert.equal(subscribeCalls[0]!.type, "subscribe");
  });
});
