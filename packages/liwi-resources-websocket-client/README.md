<h1 align="center">
  liwi-resources-websocket-client
</h1>

<p align="center">
  websocket client implementation for liwi
</p>

<p align="center">
  <a href="https://npmjs.org/package/liwi-resources-websocket-client"><img src="https://img.shields.io/npm/v/liwi-resources-websocket-client.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/liwi-resources-websocket-client"><img src="https://img.shields.io/npm/dw/liwi-resources-websocket-client.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/liwi-resources-websocket-client"><img src="https://img.shields.io/node/v/liwi-resources-websocket-client.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/liwi-resources-websocket-client"><img src="https://img.shields.io/npm/types/liwi-resources-websocket-client.svg?style=flat-square" alt="types"></a>
</p>

## About

Websocket [`TransportClient`](../liwi-resources-client#transportclient), to be used against [`liwi-resources-websocket-server`](../liwi-resources-websocket-server). Handles the connection lifecycle: ack correlation, reconnection with backoff, and re-opening subscriptions after a reconnect.

It is host-agnostic: the `WebSocket` implementation and the page-visibility capability are both injectable, so it runs unchanged in a browser, in react-native, and in node. For node, prefer [`liwi-resources-websocket-node-client`](../liwi-resources-websocket-node-client), which wires `ws` and header authentication for you.

## Install

```bash
npm install --save liwi-resources-websocket-client
```

## Usage

Standalone:

```ts
import { createWebsocketTransportClient } from "liwi-resources-websocket-client";

const transportClient = createWebsocketTransportClient({
  url: "ws://localhost:4005/ws",
  onError: console.error,
});
transportClient.connect();

const tasksService = createTasksServiceClient(transportClient);
```

With React, let the provider create and connect it:

```tsx
import {
  createWebsocketTransportClient,
  WebsocketTransportClientOptions,
} from "liwi-resources-websocket-client";
import type { ReactElement } from "react";
import { TransportClientProvider } from "react-liwi";
import App from "./core/Layout";

export default function BrowserApp(): ReactElement {
  return (
    <TransportClientProvider<WebsocketTransportClientOptions>
      url="ws://localhost:4005/ws"
      createFn={createWebsocketTransportClient}
      onError={console.error}
    >
      <App />
    </TransportClientProvider>
  );
}
```

For SSR, swap `createFn` for [`createVoidTransportClient`](../liwi-resources-void-client) on the server. This client performs no host detection of its own: picking the void client when prerendering is the caller's decision.

## Options

`WebsocketTransportClientOptions`:

| Option                      | Default                      | Description                                                                                                                    |
| --------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `url`                       | `ws[s]://<location.host>/ws` | Websocket endpoint. Required where there is no `globalThis.location`, which throws otherwise                                   |
| `protocols`                 | —                            | Websocket sub-protocols                                                                                                        |
| `reconnection`              | `true`                       | Reconnect automatically when the socket drops                                                                                  |
| `reconnectionDelayMin`      | `1000`                       | Initial reconnection delay (ms)                                                                                                |
| `reconnectionDelayMax`      | `30000`                      | Upper bound for the reconnection delay (ms), backoff factor 1.2                                                                |
| `reconnectionAttempts`      | `Infinity`                   | Max reconnection attempts before giving up                                                                                     |
| `webSocketImplementation`   | `globalThis.WebSocket`       | `WebSocket` constructor to use. Resolved at each `connect()`; throws when neither is available                                 |
| `thirdWebsocketArgument`    | —                            | Third `WebSocket` constructor argument (react-native)                                                                          |
| `getThirdWebsocketArgument` | —                            | Same, computed per connection attempt. Wins over `thirdWebsocketArgument`; use it so a refreshed token reaches every reconnect |
| `visibilitySource`          | auto-detected                | Page-visibility capability. `false` disables it; when none is available the client reconnects immediately rather than waiting  |
| `onError`                   | logs to `console.error`      | Called with the raw websocket error event                                                                                      |
| `onConnectionFailure`       | —                            | Called once per failed connection with the cause and whether a reconnection follows                                            |

`timeout` and `inactivityTimeout` are accepted by the type but currently unused.

## Connection failures

`onConnectionFailure` fires exactly once per lost or rejected connection, with a tagged union plus `willReconnect`:

```ts
type ConnectionFailure = (
  | { type: "close"; code: number; reason: string; wasClean: boolean }
  | { type: "handshake"; status: number; statusText: string | undefined }
) & { willReconnect: boolean };
```

A `handshake` failure whose `status` is in the 4xx range is treated as unrecoverable: the client stops reconnecting and moves to `"closed"`, which rejects pending acks and open subscriptions. This is what turns an expired token into a "sign in again" prompt instead of a silent infinite reconnect loop. The rule is exported as `isUnrecoverableFailure` if you need it elsewhere.

```ts
createWebsocketTransportClient({
  url: "ws://localhost:4005/ws",
  onConnectionFailure: (failure) => {
    if (failure.type === "handshake" && failure.status === 401) promptSignIn();
  },
});
```

The handshake status is only observable through the node emitter api of [`ws`](https://github.com/websockets/ws). Browsers do not expose the rejected upgrade response by spec, so there a rejected handshake surfaces as `{ type: "close", code: 1006 }` and reconnection continues.

## Behaviour

- Messages are encoded with [`extended-json`](../extended-json), so `Date` params and results survive the round trip.
- `send` resolves when the server acks the message id, and rejects with a `ResourcesServerError` carrying the server `code` when the ack holds an error. Sending while disconnected throws a `NetworkError` (`Websocket not connected`); pending acks are rejected when the connection is lost.
- `subscribe` returns a thenable resolving after the first server response, with `stop()` (sends `subscribe:close`) and `cancel()`.
- Open subscriptions are re-sent after a reconnection, so consumers keep receiving changes without re-subscribing. On `close`, pending subscriptions reject with `Subscription closed`.
- `listenStateChange` reports `"connecting" | "connected" | "reconnect-scheduled" | "wait-for-visibility" | "closed"`. `connected` is set when the server sends its `connection-ack`; `wait-for-visibility` means reconnection is deferred while the tab is hidden, and resumes on `visibilitychange`. It is never reported when no visibility source is available. (`"opening"` exists in `ConnectionStates` but this client does not emit it.)
