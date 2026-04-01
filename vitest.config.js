const { defineConfig } = require("vitest/config");

const isCI = Boolean(process.env.CI);

module.exports = defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.js"],
    globals: true,
    reporters: isCI ? ["default", "json"] : ["default"],
    outputFile: isCI ? { json: "test-results/vitest/results.json" } : undefined,
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
    },
  },
});
