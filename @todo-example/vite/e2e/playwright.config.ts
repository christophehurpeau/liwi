import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import { WEB_PORT } from "./ports.ts";

export default defineConfig({
  testDir: ".",
  globalSetup: fileURLToPath(
    import.meta.resolve("./global-setup", import.meta.url),
  ),
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
  },
});
