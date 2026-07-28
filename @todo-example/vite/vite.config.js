import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Prebundle (esbuild) for the client. The pre-built workspace packages are
// included so Vite does not try to load a tsconfig for their dist files when
// transforming them on the fly.
const optimizeInclude = [
  "react-liwi",
  "liwi-resources-client",
  "liwi-resources-void-client",
  "liwi-resources-websocket-client",
];

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // nightingale-logger / nightingale-app-console read process.env.NODE_ENV,
  // which is undefined in the browser (Next.js used to polyfill it). Replace it
  // at build time so the client bundle does not throw "process is not defined".
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode),
  },
  optimizeDeps: {
    include: optimizeInclude,
  },
}));
