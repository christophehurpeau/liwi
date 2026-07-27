<h1 align="center">
  liwi-resources-void-client
</h1>

<p align="center">
  void client implementation for liwi
</p>

<p align="center">
  <a href="https://npmjs.org/package/liwi-resources-void-client"><img src="https://img.shields.io/npm/v/liwi-resources-void-client.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/liwi-resources-void-client"><img src="https://img.shields.io/npm/dw/liwi-resources-void-client.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/liwi-resources-void-client"><img src="https://img.shields.io/node/v/liwi-resources-void-client.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/liwi-resources-void-client"><img src="https://img.shields.io/npm/types/liwi-resources-void-client.svg?style=flat-square" alt="types"></a>
</p>

## About

No-op [`TransportClient`](../liwi-resources-client#transportclient). It satisfies the interface so a provider tree can be built, but never talks to a server: `send` and `subscribe` throw.

Its purpose is server-side rendering — render the shell with no data on the server, then let a real transport take over on the client after hydration.

## Install

```bash
npm install --save liwi-resources-void-client
```

## Usage

```tsx
import { createVoidTransportClient } from "liwi-resources-void-client";
import { createWebsocketTransportClient } from "liwi-resources-websocket-client";
import type { WebsocketTransportClientOptions } from "liwi-resources-websocket-client";
import { TransportClientProvider } from "react-liwi";

export function App() {
  return (
    <TransportClientProvider<WebsocketTransportClientOptions>
      url="ws://localhost:4005/ws"
      createFn={
        globalThis.window === undefined
          ? createVoidTransportClient
          : createWebsocketTransportClient
      }
      onError={console.error}
    >
      <Home />
    </TransportClientProvider>
  );
}
```

Components must therefore render something for the loading state (`initialLoading` in [`react-liwi`](../react-liwi)); that is what the server emits.

## API

### `createVoidTransportClient()`

Returns a `TransportClient` where `connect`, `close` and `listenStateChange` are no-ops, and `send` / `subscribe` throw `Void client: send should not be called` / `Void client: subscribe should not be called`.

Reaching one of those throws means a component tried to fetch during SSR. Guard the call site (skip the query on the server) rather than catching the error.
