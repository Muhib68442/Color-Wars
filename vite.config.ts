import { execFileSync } from "node:child_process";
import process from "node:process";
import { defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

/**
 * Date shown on the About screen. Uses `APP_UPDATED` when set, otherwise the
 * date of the latest commit, so a rebuild of the same commit stays stable.
 * Falls back to today when git is unavailable (for example a source archive).
 */
function resolveUpdated(): string {
  const override = process.env["APP_UPDATED"]?.trim();
  if (override) return override;

  try {
    const date = execFileSync(
      "git",
      ["log", "-1", "--date=short", "--format=%cs"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    if (date) return date;
  } catch {
    // Fall through to the build date.
  }

  return new Date().toISOString().slice(0, 10);
}

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_UPDATED__: JSON.stringify(resolveUpdated()),
  },
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
