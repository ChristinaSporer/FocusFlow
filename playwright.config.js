const { defineConfig } = require("@playwright/test");

const isCI = Boolean(process.env.CI);

module.exports = defineConfig({
  testDir: "./tests/e2e",
  reporter: isCI
    ? [
        ["list"],
        ["json", { outputFile: "test-results/playwright/results.json" }],
        ["html", { outputFolder: "test-results/playwright/html-report", open: "never" }],
      ]
    : "list",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
  },
  webServer: {
    command: "npx http-server . -p 4173 -s",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
