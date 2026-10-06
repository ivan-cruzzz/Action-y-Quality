import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import "./i18n";
import "./index.css";

// PWA: open like an installed app, work offline via the cached shell.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

// Offline reads: the whole server-data cache is mirrored into localStorage, so
// the app renders its data with zero network. Restored before first render.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, gcTime: 1000 * 60 * 60 * 24 * 30 } },
});
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "aq.query-cache",
});
void persistQueryClient({ queryClient, persister, maxAge: 1000 * 60 * 60 * 24 * 30 });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App queryClient={queryClient} />
    </ErrorBoundary>
  </React.StrictMode>,
);
