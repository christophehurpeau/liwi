import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { ResourcesServerError } from "liwi-resources";
import type { ResourcesServerService } from "./ResourcesServerService.ts";
import type { ServiceResource } from "./ServiceResource.ts";
import { createMessageHandler } from "./createMessageHandler.ts";

const noopCallback = (): void => undefined;

interface FakeSubscription extends PromiseLike<unknown> {
  stop: () => void;
  stopped: boolean;
  callback: (error: Error | null, result: unknown) => void;
}

const createFakeSubscription = (): FakeSubscription => {
  const subscription: FakeSubscription = Object.assign(Promise.resolve(null), {
    stopped: false,
    callback: noopCallback,
    stop: () => {
      subscription.stopped = true;
    },
  });
  return subscription;
};

interface FakeQuery {
  fetch: (onFulfilled: (result: unknown) => unknown) => Promise<unknown>;
  fetchAndSubscribe: (cb: FakeSubscription["callback"]) => FakeSubscription;
  subscribe: (cb: FakeSubscription["callback"]) => FakeSubscription;
  subscription: FakeSubscription;
}

const createFakeQuery = (fetchResult: unknown): FakeQuery => {
  const subscription = createFakeSubscription();
  return {
    subscription,
    fetch: (onFulfilled) => Promise.resolve(onFulfilled(fetchResult)),
    fetchAndSubscribe: (cb) => {
      subscription.callback = cb;
      return subscription;
    },
    subscribe: (cb) => {
      subscription.callback = cb;
      return subscription;
    },
  };
};

interface BuildServiceOptions {
  query?: FakeQuery;
  operation?: (params: unknown, user: unknown) => unknown;
  subscribeHook?: ServiceResource<any, any>["subscribeHooks"];
}

const buildService = ({
  query,
  operation,
  subscribeHook,
}: BuildServiceOptions): ResourcesServerService => {
  const resource = {
    queries: {
      queryAll: () => query,
    },
    operations: operation ? { doThing: operation } : {},
    subscribeHooks: subscribeHook,
  } as unknown as ServiceResource<any, any>;

  return {
    getServiceResource: (name: string) => {
      if (name !== "posts")
        throw new Error(`Invalid service resource: ${name}`);
      return resource;
    },
  } as unknown as ResourcesServerService;
};

describe("createMessageHandler", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
  });

  test("fetch resolves the query result", async () => {
    const query = createFakeQuery(["a", "b"]);
    const { messageHandler } = createMessageHandler(
      buildService({ query }),
      null,
      false,
    );
    const result = await messageHandler(
      {
        id: 1,
        type: "fetch",
        payload: {
          resourceName: "posts",
          key: "queryAll",
          params: undefined,
        },
      },
      noopCallback,
    );
    assert.deepEqual(result, ["a", "b"]);
  });

  test("fetch rejects when the query key does not start with 'query'", async () => {
    const { messageHandler } = createMessageHandler(
      buildService({ query: createFakeQuery(null) }),
      null,
      false,
    );
    await assert.rejects(
      messageHandler(
        {
          id: 1,
          type: "fetch",
          payload: {
            resourceName: "posts",
            key: "badKey",
            params: undefined,
          },
        },
        noopCallback,
      ),
      /Invalid query key/,
    );
  });

  test("do runs the operation and returns its result", async () => {
    let received: unknown;
    const user = { id: "u1" };
    const { messageHandler } = createMessageHandler(
      buildService({
        operation: (params) => {
          received = params;
          return "op-result";
        },
      }),
      user,
      false,
    );
    const result = await messageHandler(
      {
        id: 1,
        type: "do",
        payload: {
          resourceName: "posts",
          operationKey: "doThing",
          params: { x: 1 },
        },
      },
      noopCallback,
    );
    assert.equal(result, "op-result");
    assert.deepEqual(received, { x: 1 });
  });

  test("do rejects with OPERATION_NOT_FOUND for an unknown operation", async () => {
    const { messageHandler } = createMessageHandler(
      buildService({}),
      null,
      false,
    );
    await assert.rejects(
      messageHandler(
        {
          id: 1,
          type: "do",
          payload: {
            resourceName: "posts",
            operationKey: "missing",
            params: undefined,
          },
        },
        noopCallback,
      ),
      (error: unknown) =>
        error instanceof ResourcesServerError &&
        error.code === "OPERATION_NOT_FOUND",
    );
  });

  test("rejects unknown message types with INVALID_MESSAGE_TYPE", async () => {
    const { messageHandler } = createMessageHandler(
      buildService({}),
      null,
      false,
    );
    await assert.rejects(
      messageHandler({ id: 1, type: "nope" } as any, noopCallback),
      (error: unknown) =>
        error instanceof ResourcesServerError &&
        error.code === "INVALID_MESSAGE_TYPE",
    );
  });

  describe("subscriptions disallowed", () => {
    test("subscribe rejects when subscriptions are not allowed", async () => {
      const { messageHandler } = createMessageHandler(
        buildService({ query: createFakeQuery(null) }),
        null,
        false,
      );
      await assert.rejects(
        messageHandler(
          {
            id: 1,
            type: "subscribe",
            payload: {
              resourceName: "posts",
              key: "queryAll",
              params: undefined,
              subscriptionId: 1,
            },
          },
          noopCallback,
        ),
        /Subscriptions not allowed/,
      );
    });

    test("subscribe:close rejects when subscriptions are not allowed", async () => {
      const { messageHandler } = createMessageHandler(
        buildService({}),
        null,
        false,
      );
      await assert.rejects(
        messageHandler(
          {
            id: 1,
            type: "subscribe:close",
            payload: { subscriptionId: 1 },
          },
          noopCallback,
        ),
        /Subscriptions not allowed/,
      );
    });
  });

  describe("subscriptions allowed", () => {
    test("fetchAndSubscribe registers a subscription and forwards results to the callback", async () => {
      const query = createFakeQuery(null);
      const { messageHandler, close } = createMessageHandler(
        buildService({ query }),
        null,
        true,
      );

      const received: [number, Error | null, unknown][] = [];
      await messageHandler(
        {
          id: 1,
          type: "fetchAndSubscribe",
          payload: {
            resourceName: "posts",
            key: "queryAll",
            params: undefined,
            subscriptionId: 7,
          },
        },
        (subscriptionId, error, result) => {
          received.push([subscriptionId, error, result]);
        },
      );

      query.subscription.callback(null, ["live"]);
      assert.deepEqual(received, [[7, null, ["live"]]]);

      close();
      assert.equal(query.subscription.stopped, true);
    });

    test("duplicate subscriptionId rejects with ALREADY_HAVE_WATCHER", async () => {
      const query = createFakeQuery(null);
      const { messageHandler } = createMessageHandler(
        buildService({ query }),
        null,
        true,
      );

      const payload = {
        resourceName: "posts",
        key: "queryAll",
        params: undefined,
        subscriptionId: 3,
      } as any;

      await messageHandler({ id: 1, type: "subscribe", payload }, noopCallback);
      await assert.rejects(
        messageHandler({ id: 2, type: "subscribe", payload }, noopCallback),
        (error: unknown) =>
          error instanceof ResourcesServerError &&
          error.code === "ALREADY_HAVE_WATCHER",
      );
    });

    test("subscribe invokes subscribeHook.subscribed and subscribe:close invokes unsubscribed", async () => {
      const events: string[] = [];
      const user = { id: "u1" };
      const query = createFakeQuery(null);
      const { messageHandler } = createMessageHandler(
        buildService({
          query,
          subscribeHook: {
            queryAll: {
              subscribed: () => events.push("subscribed"),
              unsubscribed: () => events.push("unsubscribed"),
            },
          },
        }),
        user,
        true,
      );

      const payload = {
        resourceName: "posts",
        key: "queryAll",
        params: { foo: 1 },
        subscriptionId: 9,
      } as any;

      await messageHandler({ id: 1, type: "subscribe", payload }, noopCallback);
      assert.deepEqual(events, ["subscribed"]);

      await messageHandler(
        { id: 2, type: "subscribe:close", payload: { subscriptionId: 9 } },
        noopCallback,
      );
      assert.deepEqual(events, ["subscribed", "unsubscribed"]);
      assert.equal(query.subscription.stopped, true);
    });

    test("subscribe:close on an unknown subscription is a no-op (no throw)", async () => {
      const { messageHandler } = createMessageHandler(
        buildService({}),
        null,
        true,
      );
      await assert.doesNotReject(
        messageHandler(
          { id: 1, type: "subscribe:close", payload: { subscriptionId: 404 } },
          noopCallback,
        ),
      );
    });
  });
});
