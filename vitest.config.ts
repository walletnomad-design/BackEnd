import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.ts"],
    hookTimeout: 60000,
    testTimeout: 30000,
    fileParallelism: false,
  },
});