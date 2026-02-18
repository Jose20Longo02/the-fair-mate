import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["lib/**/*.ts"],
      exclude: ["**/*.d.ts", "**/__tests__/**", "**/node_modules/**"],
    },
    env: {
      SESSION_SECRET: "test-session-secret-at-least-32-characters-long",
      ADMIN_SECRET: "test-admin-secret-16ch",
      MATCHMAKING_SECRET: "test-matchmaking-secret-16",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
