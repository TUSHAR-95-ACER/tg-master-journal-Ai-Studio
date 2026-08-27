import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger && componentTagger(), typeof mcpPlugin === 'function' ? mcpPlugin() : null].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
    // Let Rollup bundle recharts/d3 with their consumers. Manually splitting
    // them into a vendor-charts chunk caused a circular-init ReferenceError
    // ("Cannot access 'P' before initialization") at runtime / white screen.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('/react@')) return 'vendor-react';
          if (id.includes('@supabase') || id.includes('@tanstack/react-query')) return 'vendor-data';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('date-fns')) return 'vendor-date';
          if (id.includes('lucide-react')) return 'vendor-icons';
          // NOTE: recharts + d3-* intentionally NOT split — see comment above.
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
}));

