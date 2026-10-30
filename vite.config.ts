import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  build: {
    target: "chrome87",
    cssTarget: "chrome87",
    sourcemap: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
