import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    // Whole-page interaction tests in jsdom are slow, and slower still when
    // the machine is busy: the longest takes ~6s alone but has been seen to
    // take over 20s under load. The limit is there to catch hangs, not to
    // measure speed.
    testTimeout: 60_000,
  },
});
