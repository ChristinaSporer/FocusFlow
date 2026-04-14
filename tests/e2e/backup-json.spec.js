const { test, expect } = require("@playwright/test");
const fs = require("fs/promises");
const { addGoal } = require("./helpers/e2e-helpers");

test("user can import app state from JSON export", async ({ page }) => {
  await page.goto("/");

  const importedGoalTitle = `Imported Goal ${Date.now()}`;
  const exportedPayload = {
    goals: [
      {
        id: "goal-import-1",
        title: importedGoalTitle,
        targetDate: "2026-04-30",
        description: "Import",
        completed: false,
        completedAt: null,
        milestones: [],
      },
    ],
    roughPlans: [],
    detailPlans: [],
    trackedSessions: [],
    importedEvents: [],
    settings: {
      activeView: "list",
    },
    timer: {},
    pomodoro: {},
  };

  await page.locator("#quick-actions-toggle").click();
  await page.locator(".lz-quick-menu details:has(#menu-json-file) summary").click();
  await page.locator("#menu-json-file").setInputFiles({
    name: "focusflow-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exportedPayload)),
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#menu-json-import").click();

  await expect(page.locator("#json-status")).toContainText("Import erfolgreich");

  await expect(page.locator("#goal-list")).toContainText(importedGoalTitle);
});

test("user can export app state as JSON file", async ({ page }) => {
  await page.goto("/");

  const goalTitle = `Export Goal ${Date.now()}`;
  await addGoal(page, { title: goalTitle, date: "2026-04-27" });

  await page.locator("#quick-actions-toggle").click();
  await page.locator(".lz-quick-menu details:has(#menu-json-export) summary").click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#menu-json-export").click(),
  ]);

  const downloadPath = await download.path();
  const content = await fs.readFile(downloadPath, "utf-8");
  const exported = JSON.parse(content);

  expect(Array.isArray(exported.goals)).toBe(true);
  expect(exported.goals.some((goal) => goal.title === goalTitle)).toBe(true);
  await expect(page.locator("#json-status")).toContainText("exportiert");
});
