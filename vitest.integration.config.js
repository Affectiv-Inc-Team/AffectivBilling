import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.{test,spec}.js"],
    setupFiles: ["./tests/integration/setup.js"],
    testTimeout: 20000,
    hookTimeout: 30000,
    // Pin the test runtime at the LOCAL Supabase instance.
    // Setting these here (not in .env.local) makes src/supabase.js bind its
    // module-level client to local BEFORE import, and guarantees tests never
    // read the app's production .env.local URL.
    //
    // The URL is HARD-CODED to localhost — it is the safety-critical value and
    // must never come from the environment (defense against hitting prod).
    // The publishable (anon) key is the CLI's well-known local-dev default; it
    // is public-safe (not a secret) and may be overridden from the environment.
    // The service-role (secret) key is NEVER committed — it is supplied at
    // runtime via process.env by the `test:integration` npm script (which reads
    // it from `supabase status`). setup.js throws if it is missing.
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_ANON_KEY:
        process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  },
});
