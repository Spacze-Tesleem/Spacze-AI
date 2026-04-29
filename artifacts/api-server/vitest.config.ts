import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Each test file gets its own module registry so vi.resetModules() works
    // correctly when tests re-import app.ts with different env vars.
    isolate: true,
    include: ["src/**/*.test.ts"],
  },
});
