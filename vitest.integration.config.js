import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.{test,spec}.js"],
    setupFiles: ["./tests/integration/setup.js"],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
