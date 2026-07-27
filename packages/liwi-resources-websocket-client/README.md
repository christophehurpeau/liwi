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

Websocket [`TransportClient`](../liwi-resources-client#transportclient), to be used against [`liwi-resources-websocket-server`](../liwi-resources-websocket-server). Handles the connection lifecycle: ack correlation, reconnection with backoff, ping/pong liveness, and re-opening subscriptions after a reconnect.

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

For SSR, swap `createFn` for [`createVoidTransportClient`](../liwi-resources-void-client) on the server.

## Options

`WebsocketTransportClientOptions`:

| Option                   | Default                      | Description                                                     |
| ------------------------ | ---------------------------- | --------------------------------------------------------------- |
| `url`                    | `ws[s]://<location.host>/ws` | Websocket endpoint                                              |
| `protocols`              | —                            | Websocket sub-protocols                                         |
| `reconnection`           | `true`                       | Reconnect automatically when the socket drops                   |
| `reconnectionDelayMin`   | `1000`                       | Initial reconnection delay (ms)                                 |
| `reconnectionDelayMax`   | `30000`                      | Upper bound for the reconnection delay (ms), backoff factor 1.2 |
| `reconnectionAttempts`   | `Infinity`                   | Max reconnection attempts before giving up                      |
| `thirdWebsocketArgument` | —                            | Third `WebSocket` constructor argument (react-native)           |
| `onError`                | logs to `console.error`      | Called with websocket error events                              |

`timeout` and `inactivityTimeout` are accepted by the type but currently unused.

## Behaviour

- Messages are encoded with [`extended-json`](../extended-json), so `Date` params and results survive the round trip.
- `send` resolves when the server acks the message id, and rejects with a `ResourcesServerError` carrying the server `code` when the ack holds an error. Sending while disconnected throws a `NetworkError` (`Websocket not connected`); pending acks are rejected when the connection is lost.
- `subscribe` returns a thenable resolving after the first server response, with `stop()` (sends `subscribe:close`) and `cancel()`.
- Open subscriptions are re-sent after a reconnection, so consumers keep receiving changes without re-subscribing. On `close`, pending subscriptions reject with `Subscription closed`.
- `listenStateChange` reports `"opening" | "connecting" | "connected" | "reconnect-scheduled" | "wait-for-visibility" | "closed"`. `connected` is set when the server sends its `connection-ack`; `wait-for-visibility` means reconnection is deferred while the tab is hidden, and resumes on `visibilitychange`.
