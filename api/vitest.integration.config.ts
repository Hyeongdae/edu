import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.integration.test.ts"],
    restoreMocks: true,
    clearMocks: true,
    maxWorkers: 1,
    hookTimeout: 20000,
    testTimeout: 15000,
  },
});
