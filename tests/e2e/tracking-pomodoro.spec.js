const { test, expect } = require("@playwright/test");
const { seedAppState } = require("./helpers/e2e-helpers");

test("user can create edit and delete manually tracked time", async ({ page }) => {
  await page.goto("/");

  await page.locator("#manual-tab").click();

  await page.locator("#track-manual-date").fill("2026-04-19");
  await page.locator("#track-manual-minutes").fill("30");
  await page.locator("#track-note").fill("Tracking initial");
  await page.locator("#track-manual-submit").click();

  const trackedRow = page.locator("#track-list li").filter({ hasText: "Tracking initial" }).first();
  await expect(trackedRow).toBeVisible();

  await trackedRow.locator('[data-tracked-edit]').click();
  await page.locator("#track-manual-minutes").fill("45");
  await page.locator("#track-note").fill("Tracking updated");
  await page.locator("#track-manual-submit").click();

  await expect(page.locator("#track-list")).toContainText("Tracking updated");
  await expect(page.locator("#track-list")).toContainText("45 Min fokussierte Lernzeit");

  const updatedTrackedRow = page
    .locator("#track-list li")
    .filter({ hasText: "Tracking updated" })
    .first();
  await updatedTrackedRow.getByRole("button", { name: "Löschen" }).click();
  await expect(page.locator("#track-list")).not.toContainText("Tracking updated");
});

test("pomodoro renders persisted long break state", async ({ page }) => {
  await seedAppState(page, {
    pomodoro: {
      active: false,
      phase: "long-break",
      pomodorosCompleted: 4,
      secondsLeft: 900,
      phaseStartedAt: null,
    },
  });

  await page.goto("/");
  await page.locator("#pomodoro-tab").click();

  await expect(page.locator("#pomodoro-phase")).toHaveText("Lange Pause (15 Min.)");
  await expect(page.locator("#pomodoro-display")).toHaveText("15:00");
});

test("pomodoro switches to long break after the fourth completed work phase", async ({ page }) => {
  await seedAppState(page, {
    pomodoro: {
      active: false,
      phase: "work",
      pomodorosCompleted: 3,
      secondsLeft: 1500,
      phaseStartedAt: null,
    },
  });

  await page.goto("/");
  await page.locator("#pomodoro-tab").click();
  await expect(page.locator("#pomodoro-phase")).toHaveText("Arbeitsphase");

  await page.locator("#pomodoro-save-next").click();

  await expect(page.locator("#pomodoro-phase")).toHaveText("Lange Pause (15 Min.)");
  await expect(page.locator("#pomodoro-display")).toHaveText("15:00");

  const persistedState = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("focusflow-v1"))
  );
  expect(persistedState.pomodoro.phase).toBe("long-break");
  expect(persistedState.pomodoro.pomodorosCompleted).toBe(4);
});

test("pomodoro reset in flow returns to work phase", async ({ page }) => {
  await page.goto("/");

  await page.locator("#pomodoro-tab").click();
  await page.locator("#pomodoro-save-next").click();
  await expect(page.locator("#pomodoro-phase")).toHaveText("Kurze Pause (5 Min.)");

  await page.locator("#pomodoro-save-cancel").click();

  await expect(page.locator("#pomodoro-phase")).toHaveText("Arbeitsphase");
  await expect(page.locator("#pomodoro-display")).toHaveText("25:00");
});
