import type { TransportClient } from "liwi-resources-client";
import type {
  WebSocketConstructorLike,
  WebsocketTransportClientOptions,
} from "liwi-resources-websocket-client";
import { createWebsocketTransportClient } from "liwi-resources-websocket-client";
import type { ClientOptions } from "ws";
import NodeWebSocket from "ws";

export interface NodeWebsocketTransportClientOptions extends Omit<
  WebsocketTransportClientOptions,
  | "getThirdWebsocketArgument"
  | "thirdWebsocketArgument"
  | "url"
  | "visibilitySource"
> {
  url: string;
  /** resolved per connection attempt when passed as a function, so a refreshed token reaches every reconnect */
  headers?: Record<string, string> | (() => Record<string, string>);
  webSocketOptions?: ClientOptions;
  webSocketImplementation?: WebSocketConstructorLike;
}

export const createNodeWebsocketTransportClient = ({
  headers,
  webSocketOptions,
  webSocketImplementation = NodeWebSocket as unknown as WebSocketConstructorLike,
  ...options
}: NodeWebsocketTransportClientOptions): TransportClient =>
  createWebsocketTransportClient({
    ...options,
    webSocketImplementation,
    visibilitySource: false,
    getThirdWebsocketArgument: () => ({
      ...webSocketOptions,
      headers: {
        ...webSocketOptions?.headers,
        ...(typeof headers === "function" ? headers() : headers),
      },
    }),
  });
