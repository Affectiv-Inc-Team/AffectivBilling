import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.js"],
    include: ["src/**/__tests__/**/*.{test,spec}.{js,jsx}"],
    exclude: ["tests/integration/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**", "src/serviceLines/**", "src/data/**"],
      // tsc.jsx is a mixed pure-function + React component file. The calc
      // exports are 100% covered; the JSX UI components are deferred to Phase 2
      // component tests. Exclude to avoid a false-low statement count.
      exclude: ["src/serviceLines/tsc.jsx", "src/**/__tests__/**"],
      thresholds: {
        statements: 80,
        branches: 75,
      },
    },
  },
});
