import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { App } from "./App.js";
import { dAppKit } from "./lib/dappKit.js";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <DAppKitProvider dAppKit={dAppKit}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </DAppKitProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
