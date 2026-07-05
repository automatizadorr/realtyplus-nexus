import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@radix-ui"))       return "vendor-radix";
            if (id.includes("framer-motion"))    return "vendor-motion";
            if (id.includes("@supabase"))        return "vendor-supabase";
            if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-"))
                                                 return "vendor-charts";
            if (id.includes("@tanstack"))        return "vendor-query";
            if (id.includes("lucide-react"))     return "vendor-icons";
            if (id.includes("react-dom") || id.includes("react-router") || id.includes("scheduler"))
                                                 return "vendor-react";
          }
        },
      },
    },
  },
}));
