const { test, expect } = require("@playwright/test");
const fs = require("fs/promises");
const { addGoal } = require("./helpers/e2e-helpers");

test("user can import app state from JSON backup", async ({ page }) => {
  await page.goto("/");

  const importedGoalTitle = `Imported Goal ${Date.now()}`;
  const backupPayload = {
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
      activeView: "backup",
    },
    timer: {},
    pomodoro: {},
  };

  await page.locator("#tab-backup").click();
  await page.locator("#json-file").setInputFiles({
    name: "focusflow-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backupPayload)),
  });
  await page.locator("#json-import").click();

  await expect(page.locator("#json-status")).toContainText("Import erfolgreich");

  await page.locator("#tab-list").click();
  await expect(page.locator("#goal-list")).toContainText(importedGoalTitle);
});

test("user can export app state as JSON file", async ({ page }) => {
  await page.goto("/");

  const goalTitle = `Export Goal ${Date.now()}`;
  await addGoal(page, { title: goalTitle, date: "2026-04-27" });

  await page.locator("#tab-backup").click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#json-export").click(),
  ]);

  const downloadPath = await download.path();
  const content = await fs.readFile(downloadPath, "utf-8");
  const exported = JSON.parse(content);

  expect(Array.isArray(exported.goals)).toBe(true);
  expect(exported.goals.some((goal) => goal.title === goalTitle)).toBe(true);
  await expect(page.locator("#json-status")).toContainText("exportiert");
});
