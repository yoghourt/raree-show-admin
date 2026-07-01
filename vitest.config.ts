import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    env: {
      SOURCE_CONNECTOR_MODE: "mock",
      COPILOT_LLM_CALL_GAP_MS: "0",
      DISCOVERY_PROPOSE_MODE: "mock",
    },
    include: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
    environmentOptions: {
      jsdom: {},
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
