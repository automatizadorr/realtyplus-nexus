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
    // Sin manualChunks: dejamos que Vite/Rollup hagan el code-splitting automático.
    // Separar react-dom/framer-motion/recharts en chunks manuales causaba una
    // dependencia circular entre chunks → "React undefined" (__SECRET_INTERNALS) →
    // pantalla en blanco en producción. El chunking automático respeta el orden de React.
    chunkSizeWarningLimit: 1500,
  },
}));
