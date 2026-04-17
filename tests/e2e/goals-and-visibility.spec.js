const { test, expect } = require("@playwright/test");
const {
  addGoal,
  addMilestoneToGoal,
  setMonth,
  addRoughPlan,
  clickAndAcceptDialogIfPresent,
} = require("./helpers/e2e-helpers");

test("Lernziel mit Zwischenziel kann angelegt werden", async ({ page }) => {
  await page.goto("/");

  const goalTitle = `E2E Goal ${Date.now()}`;
  const milestoneTitle = "MS Architektur";

  await addGoal(page, { title: goalTitle, date: "2026-04-20" });
  await addMilestoneToGoal(page, { goalTitle, milestoneTitle });

  await expect(page.locator("#goal-list")).toContainText(goalTitle);
  await expect(page.locator("#goal-list")).toContainText(milestoneTitle);
});

test("Erledigtes Zwischenziel blendet verknüpfte Detailplanung aus", async ({ page }) => {
  await page.goto("/");
  await setMonth(page, "2026-04");

  const goalTitle = `E2E Goal ${Date.now()}`;
  const milestoneTitle = "MS Verstecken";

  await addGoal(page, { title: goalTitle, date: "2026-04-25" });
  await addMilestoneToGoal(page, { goalTitle, milestoneTitle });

  await page.locator('[data-detail-plan-toggle="additional"]').click();
  await page.locator('[data-detail-date="additional"]').fill("2026-04-16");
  await page.locator('[data-detail-start="additional"]').fill("10:00");
  await page.locator('[data-detail-end="additional"]').fill("11:00");

  const milestoneSelect = page.locator('[data-detail-milestone-select="additional"]');
  const linkedMilestoneId = await milestoneSelect
    .locator('option:not([value=""])')
    .first()
    .getAttribute("value");
  await milestoneSelect.selectOption(linkedMilestoneId);
  await page.locator('[data-detail-topic="additional"]').fill("Linked Topic");
  await page.locator('[data-detail-block-form="additional"] button[type="submit"]').click();

  await expect(page.locator("#detail-list")).toContainText(`60 Min für ${milestoneTitle}`);

  await page.locator("#goal-list [data-goal-milestone-toggle]").first().check();
  await expect(page.locator("#detail-list")).not.toContainText(`60 Min für ${milestoneTitle}`);
});

test("Erledigtes Ziel wandert zu erreichten Zielen und kann wieder aktiviert werden", async ({
  page,
}) => {
  await page.goto("/");
  await setMonth(page, "2026-04");

  const goalTitle = `E2E Goal ${Date.now()}`;
  const roughNote = "Goal Rough Note";
  const detailTopic = "Goal Linked Detail";

  await addGoal(page, { title: goalTitle, date: "2026-04-28" });
  await addMilestoneToGoal(page, { goalTitle, milestoneTitle: "MS Abschluss" });

  await addRoughPlan(page, {
    goalTitle,
    week: "2026-W16",
    hours: 4,
    note: roughNote,
  });
  await expect(page.locator("#rough-list")).toContainText(roughNote);

  await page
    .locator('[data-detail-plan-toggle]:not([data-detail-plan-toggle="additional"])')
    .first()
    .click();
  await page.locator("[data-detail-date]:visible").fill("2026-04-17");
  await page.locator("[data-detail-start]:visible").fill("09:00");
  await page.locator("[data-detail-end]:visible").fill("10:00");
  await page.locator("[data-detail-topic]:visible").fill(detailTopic);
  await page.locator("[data-detail-milestone-select]:visible").selectOption({ index: 1 });
  await page.locator('[data-detail-block-form]:visible button[type="submit"]').click();
  await expect(page.locator("#detail-list")).toContainText(detailTopic);

  await page.locator("#manual-tab").click();
  await page.locator("#track-detail-select").selectOption({ index: 1 });
  await page.locator("#track-manual-date").fill("2026-04-17");
  await page.locator("#track-manual-hours").fill("1");
  await page.locator("#track-manual-extra-minutes").fill("0");
  await page.locator("#track-note").fill("Abschlusssession");
  await page.locator("#track-manual-submit").click();
  await expect(page.locator("#track-list")).toContainText("Abschlusssession");

  await page.locator("#tab-list").click();
  await expect(page.locator("#goal-list")).toContainText("Geplant:");
  await expect(page.locator("#goal-list")).toContainText("Getrackt:");

  const openGoalRow = page.locator("#goal-list li").filter({ hasText: goalTitle }).first();
  await clickAndAcceptDialogIfPresent(page, async () => {
    await openGoalRow.locator("[data-goal-toggle]").click();
  });

  await expect(page.locator("#achieved-list")).toContainText(goalTitle);
  await expect(page.locator("#achieved-list")).toContainText("Zeit geplant:");
  await expect(page.locator("#achieved-list")).toContainText("Lernzeit verwendet:");
  await expect(page.locator("#goal-list")).not.toContainText(goalTitle);
  await expect(page.locator("#rough-list")).not.toContainText(roughNote);
  await expect(page.locator("#detail-list")).not.toContainText(detailTopic);

  await page.locator("#tab-calendar").click();
  await expect(page.locator("#calendar-grid")).toContainText("MS Abschluss");

  const fadedEntries = page
    .locator(".lz-calendar-event.lz-calendar-event-completed")
    .filter({ hasText: "MS Abschluss" });
  await expect(fadedEntries.first()).toBeVisible();

  const opacityValue = await fadedEntries.first().evaluate((node) => getComputedStyle(node).opacity);
  expect(Number(opacityValue)).toBeCloseTo(0.35, 2);

  await page.locator("#tab-list").click();
  const achievedGoalRow = page.locator("#achieved-list li").filter({ hasText: goalTitle }).first();
  await clickAndAcceptDialogIfPresent(page, async () => {
    await achievedGoalRow.locator("[data-goal-toggle]").click();
  });

  await expect(page.locator("#goal-list")).toContainText(goalTitle);
  await expect(page.locator("#rough-list")).toContainText(roughNote);
  await expect(page.locator("#detail-list")).toContainText(detailTopic);
  await page.locator("#tab-calendar").click();
  await expect(page.locator("#calendar-grid")).toContainText("MS Abschluss");
});
