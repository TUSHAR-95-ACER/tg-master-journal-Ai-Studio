import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";

// Apply persisted journal font instantly to avoid a flash of unstyled typography.
try {
  const saved = localStorage.getItem('ef_journal_font') || 'notion';
  document.documentElement.setAttribute('data-journal-font', saved);
} catch {
  document.documentElement.setAttribute('data-journal-font', 'notion');
}

import App from "./App.tsx";
import { AuthProvider } from "@/contexts/AuthContext";
import { TradingProvider } from "@/contexts/TradingContext";

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <AuthProvider>
      <TradingProvider>
        <App />
      </TradingProvider>
    </AuthProvider>
  </HelmetProvider>
);
