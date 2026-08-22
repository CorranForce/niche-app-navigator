import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary", "html"],
      reportsDirectory: "coverage",
      include: ["src/lib/**/*.ts", "src/hooks/**/*.ts"],
      exclude: ["**/*.test.ts", "src/integrations/**"],
    },
  },
});
