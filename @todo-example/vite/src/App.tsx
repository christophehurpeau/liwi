import { createVoidTransportClient } from "liwi-resources-void-client";
import type { WebsocketTransportClientOptions } from "liwi-resources-websocket-client";
import { createWebsocketTransportClient } from "liwi-resources-websocket-client";
import { appLogger } from "nightingale-app-console";
import type { ReactNode } from "react";
import { TransportClientProvider, useTransportClientState } from "react-liwi";
import { TodoServicesProvider } from "./app/services/TodoServicesProvider";
import { ConnectionStateBadge } from "./components/ConnectionStateBadge";
import Info from "./components/Info";
import Main from "./components/Main";
import { NewTaskForm } from "./components/NewTaskForm";
import Paginated from "./components/Paginated";

appLogger.debug("Loading App.tsx");

function AppConnectionState(): ReactNode {
  const transportClientState = useTransportClientState();
  return <ConnectionStateBadge transportClientState={transportClientState} />;
}

function Home(): ReactNode {
  return (
    <>
      <section className="todoapp">
        <header className="header">
          <h1>todos</h1>
          <NewTaskForm />
        </header>
        <Main />
      </section>
      <Info />

      <div style={{ display: "flex" }}>
        <div style={{ flex: "0 0 50%" }}>
          Version subscribe=true
          <Paginated subscribe />
        </div>
        <div style={{ flex: "0 0 50%" }}>
          Version subscribe=false
          <Paginated subscribe={false} />
        </div>
      </div>
    </>
  );
}

export function App(): ReactNode {
  return (
    <TransportClientProvider<WebsocketTransportClientOptions>
      url={import.meta.env.VITE_WS_URL ?? "ws://localhost:4005/ws"}
      createFn={
        globalThis.window === undefined
          ? createVoidTransportClient
          : createWebsocketTransportClient
      }
      onError={console.error}
    >
      <AppConnectionState />
      <TodoServicesProvider>
        <Home />
      </TodoServicesProvider>
    </TransportClientProvider>
  );
}
