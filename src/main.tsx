import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App";

function enableMobileDebugTools() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("debug") !== "1") return;
  if ((window as typeof window & { eruda?: { init: () => void } }).eruda) return;

  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/eruda";
  script.async = true;
  script.onload = () => {
    const erudaWindow = window as typeof window & { eruda?: { init: () => void } };
    erudaWindow.eruda?.init();
  };
  document.head.appendChild(script);
}

enableMobileDebugTools();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
