const { test, expect } = require("@playwright/test");
const {
  addGoal,
  addRoughPlan,
  seedAppState,
  setMonth,
} = require("./helpers/e2e-helpers");

test("Lernzeit-Tracking: Zeit nachtragen mit und ohne Detailbezug", async ({ page }) => {
  await page.goto("/");

  await page.locator("#manual-tab").click();

  await page.locator("#track-manual-date").fill("2026-04-19");
  await page.locator("#track-manual-hours").fill("0.5");
  await page.locator("#track-manual-extra-minutes").fill("0");
  await page.locator("#track-note").fill("Tracking initial");
  await page.locator("#track-manual-submit").click();

  const trackedRow = page.locator("#track-list li").filter({ hasText: "Tracking initial" }).first();
  await expect(trackedRow).toBeVisible();

  await trackedRow.locator("[data-tracked-edit]").click();
  await expect(page.locator("#track-edit-id")).not.toHaveValue("");
  await expect(page.locator("#track-manual-submit")).toContainText("Änderungen speichern");
  await page.locator("#track-manual-hours").fill("0");
  await page.locator("#track-manual-extra-minutes").fill("45");
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

  await page.locator("#track-manual-date").fill("2026-04-20");
  await page.locator("#track-manual-hours").fill("0.5");
  await page.locator("#track-manual-extra-minutes").fill("0");
  await page.locator("#track-note").fill("Ohne Detail");
  await page.locator("#track-detail-select").selectOption({ value: "" });
  await page.locator("#track-manual-submit").click();
  await expect(page.locator("#track-list")).toContainText("Ohne Detail");
});

test("Stoppuhr startet über Detailplanungspunkt und wechselt auf den Stoppuhr-Tab", async ({
  page,
}) => {
  await page.goto("/");
  await setMonth(page, "2026-04");

  const zielTitel = `Tracking Ziel ${Date.now()}`;
  await addGoal(page, { title: zielTitel, date: "2026-04-25" });
  await addRoughPlan(page, {
    goalTitle: zielTitel,
    week: "2026-W16",
    hours: 2,
    note: "Trackingblock",
  });

  await page
    .locator('[data-detail-plan-toggle]:not([data-detail-plan-toggle="additional"])')
    .first()
    .click();
  await page.locator("[data-detail-date]:visible").fill("2026-04-18");
  await page.locator("[data-detail-start]:visible").fill("09:00");
  await page.locator("[data-detail-end]:visible").fill("10:00");
  await page.locator("[data-detail-topic]:visible").fill("Tracking Detail");
  await page.locator('[data-detail-block-form]:visible button[type="submit"]').click();

  await page.locator("#manual-tab").click();
  await page.locator('[data-detail-start-tracking]').first().click();

  await expect(page.locator("#timer-display")).toBeVisible();
  await expect(page.locator("#timer-stop")).toBeVisible();

  await page.waitForTimeout(1200);
  await page.locator("#timer-stop").click();

  await expect(page.locator("#track-list")).toContainText("Min fokussierte Lernzeit");
  await expect(page.locator("#track-list")).toContainText("Detail:");
  await expect(page.locator("#detail-list")).toContainText("Getrackt");
  await expect(page.locator("#goal-list")).toContainText("Getrackt");
});

test("Stoppuhr unterstützt Start-Pause-Start-Pause-Stop", async ({ page }) => {
  await page.goto("/");

  await page.locator("#stopwatch-tab").click();
  await page.locator("#timer-start").click();
  await page.waitForTimeout(400);
  await page.locator("#timer-pause").click();
  await expect(page.locator("#timer-start")).toBeVisible();
  await page.locator("#timer-start").click();
  await page.waitForTimeout(400);
  await page.locator("#timer-pause").click();
  await page.locator("#timer-stop").click();

  await expect(page.locator("#timer-display")).toContainText("00:00:");
  await expect(page.locator("#track-list li")).toHaveCount(1);
});

test("Pomodoro stellt gespeicherte lange Pause dar", async ({ page }) => {
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

test("Pomodoro wechselt nach der vierten Arbeitsphase in die lange Pause", async ({ page }) => {
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

test("Pomodoro-Reset setzt den Ablauf wieder auf Arbeitsphase", async ({ page }) => {
  await page.goto("/");

  await page.locator("#pomodoro-tab").click();
  await page.locator("#pomodoro-save-next").click();
  await expect(page.locator("#pomodoro-phase")).toHaveText("Kurze Pause (5 Min.)");

  await page.locator("#pomodoro-save-cancel").click();

  await expect(page.locator("#pomodoro-phase")).toHaveText("Arbeitsphase");
  await expect(page.locator("#pomodoro-display")).toHaveText("25:00");
});
