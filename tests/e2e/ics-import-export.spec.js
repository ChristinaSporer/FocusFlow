const { test, expect } = require("@playwright/test");
const fs = require("fs/promises");
const {
  addGoal,
  addAdditionalDetailPlan,
  openMenuSection,
  setMonth,
  clickAndAcceptDialogIfPresent,
} = require("./helpers/e2e-helpers");

test("ICS-Export erstellt eine Datei mit App-Terminen", async ({ page }) => {
  await page.goto("/");

  const zielTitel = `ICS Ziel ${Date.now()}`;
  const detailThema = `ICS Detail ${Date.now()}`;

  await addGoal(page, { title: zielTitel, date: "2026-05-20" });
  await addAdditionalDetailPlan(page, {
    date: "2026-05-10",
    startTime: "09:00",
    endTime: "10:00",
    topic: detailThema,
  });

  await openMenuSection(page, "ICS");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#menu-ics-export").click(),
  ]);

  const downloadPath = await download.path();
  const content = await fs.readFile(downloadPath, "utf-8");

  expect(content).toContain("BEGIN:VCALENDAR");
  expect(content).toContain("BEGIN:VEVENT");
  expect(content).toContain("SUMMARY:Detailplanung");
  await expect(page.locator("#ics-status")).toContainText("exportiert");
});

test("ICS-Import übernimmt gültige Termine in Kalender und Status", async ({ page }) => {
  await page.goto("/");

  const importTitel = `Import Termin ${Date.now()}`;
  const gueltigeIcs = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FocusFlow Test//DE",
    "BEGIN:VEVENT",
    "UID:ff-import-1",
    "DTSTART;VALUE=DATE:20260512",
    `SUMMARY:${importTitel}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  await openMenuSection(page, "ICS");
  await page.locator("#menu-ics-file").setInputFiles({
    name: "termine.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(gueltigeIcs, "utf-8"),
  });

  await clickAndAcceptDialogIfPresent(page, async () => {
    await page.locator("#menu-ics-import").click();
  });

  await expect(page.locator("#ics-status")).toContainText("importiert");

  await setMonth(page, "2026-05");
  await page.locator("#tab-calendar").click();
  await expect(page.locator("#calendar-grid")).toContainText(importTitel);
});

test("ICS-Import zeigt Fehler bei kaputter ICS-Datei", async ({ page }) => {
  await page.goto("/");
  await openMenuSection(page, "ICS");

  await page.locator("#menu-ics-file").setInputFiles({
    name: "kaputt.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from("BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Kaputt\nEND:VCALENDAR", "utf-8"),
  });

  const [dialog] = await Promise.all([
    page.waitForEvent("dialog"),
    page.locator("#menu-ics-import").click(),
  ]);
  expect(dialog.message()).toMatch(/Import fehlgeschlagen|Keine importierbaren Termine/);
  await dialog.accept();
});

test("ICS-Import zeigt Fehler bei falschem Dateiformat", async ({ page }) => {
  await page.goto("/");
  await openMenuSection(page, "ICS");

  await page.locator("#menu-ics-file").setInputFiles({
    name: "falsch.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("kein kalenderinhalt", "utf-8"),
  });

  const [dialog] = await Promise.all([
    page.waitForEvent("dialog"),
    page.locator("#menu-ics-import").click(),
  ]);
  expect(dialog.message()).toMatch(/Import fehlgeschlagen|Keine importierbaren Termine/);
  await dialog.accept();
});
