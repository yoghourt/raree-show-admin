import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Unit tests do not import CSS; skip PostCSS/Tailwind native bindings (oxide).
  css: false,
  test: {
    environment: "node",
    globals: true,
    env: {
      SOURCE_CONNECTOR_MODE: "mock",
      COPILOT_LLM_CALL_GAP_MS: "0",
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
