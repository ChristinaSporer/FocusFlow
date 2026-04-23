const { test, expect } = require("@playwright/test");
const fs = require("fs/promises");
const {
  addGoal,
  openMenuSection,
  clickAndAcceptDialogIfPresent,
} = require("./helpers/e2e-helpers");

test("JSON-Import lädt einen gültigen App-Stand", async ({ page }) => {
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

  await openMenuSection(page, "JSON");
  await page.locator("#menu-json-file").setInputFiles({
    name: "focusflow-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exportedPayload)),
  });
  await clickAndAcceptDialogIfPresent(page, async () => {
    await page.locator("#menu-json-import").click();
  });

  await expect(page.locator("#json-status")).toContainText("Import erfolgreich");

  await expect(page.locator("#goal-list")).toContainText(importedGoalTitle);
});

test("JSON-Export erzeugt eine herunterladbare Sicherung", async ({ page }) => {
  await page.goto("/");

  const goalTitle = `Export Goal ${Date.now()}`;
  await addGoal(page, { title: goalTitle, date: "2026-04-27" });

  await openMenuSection(page, "JSON");

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

test("JSON-Import zeigt Fehler bei ungültigem JSON", async ({ page }) => {
  await page.goto("/");
  await openMenuSection(page, "JSON");

  await page.locator("#menu-json-file").setInputFiles({
    name: "kaputt.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"goals": [}', "utf-8"),
  });
  await clickAndAcceptDialogIfPresent(page, async () => {
    await page.locator("#menu-json-import").click();
  });

  await expect(page.locator("#json-status")).toContainText("Import fehlgeschlagen");
});

test("JSON-Import zeigt Fehler bei falschem Dateiformat", async ({ page }) => {
  await page.goto("/");
  await openMenuSection(page, "JSON");

  await page.locator("#menu-json-file").setInputFiles({
    name: "falsch.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("kein gueltiges json", "utf-8"),
  });
  await clickAndAcceptDialogIfPresent(page, async () => {
    await page.locator("#menu-json-import").click();
  });

  await expect(page.locator("#json-status")).toContainText("Import fehlgeschlagen");
});
