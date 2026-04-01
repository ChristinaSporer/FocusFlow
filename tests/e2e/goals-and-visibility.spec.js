const { test, expect } = require("@playwright/test");
const { addGoal, addMilestoneToGoal, setMonth } = require("./helpers/e2e-helpers");

test("user can create goal with milestone", async ({ page }) => {
  await page.goto("/");

  const goalTitle = `E2E Goal ${Date.now()}`;
  const milestoneTitle = "MS Architektur";

  await addGoal(page, { title: goalTitle, date: "2026-04-20" });
  await addMilestoneToGoal(page, { goalTitle, milestoneTitle });

  await expect(page.locator("#goal-list")).toContainText(goalTitle);
  await expect(page.locator("#goal-list")).toContainText(milestoneTitle);
});

test("completed milestone hides linked planning", async ({ page }) => {
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

test("completed goal hides planning and moves to achieved; uncheck restores planning", async ({
  page,
}) => {
  await page.goto("/");
  await setMonth(page, "2026-04");

  const goalTitle = `E2E Goal ${Date.now()}`;
  const roughNote = "Goal Rough Note";
  const detailTopic = "Goal Linked Detail";

  await addGoal(page, { title: goalTitle, date: "2026-04-28" });

  await page.locator("#rough-week").fill("2026-W16");
  await page.locator("#rough-hours").fill("4");
  await page.locator("#rough-note").fill(roughNote);
  await page.locator("#rough-goal").selectOption({ label: goalTitle });
  await page.locator("#rough-submit").click();
  await expect(page.locator("#rough-list")).toContainText(roughNote);

  await page
    .locator('[data-detail-plan-toggle]:not([data-detail-plan-toggle="additional"])')
    .first()
    .click();
  await page.locator("[data-detail-date]:visible").fill("2026-04-17");
  await page.locator("[data-detail-start]:visible").fill("09:00");
  await page.locator("[data-detail-end]:visible").fill("10:00");
  await page.locator("[data-detail-topic]:visible").fill(detailTopic);
  await page.locator('[data-detail-block-form]:visible button[type="submit"]').click();
  await expect(page.locator("#detail-list")).toContainText(detailTopic);

  const openGoalRow = page.locator("#goal-list li").filter({ hasText: goalTitle }).first();
  await openGoalRow.locator("[data-goal-toggle]").click();

  await expect(page.locator("#achieved-list")).toContainText(goalTitle);
  await expect(page.locator("#goal-list")).not.toContainText(goalTitle);
  await expect(page.locator("#rough-list")).not.toContainText(roughNote);
  await expect(page.locator("#detail-list")).not.toContainText(detailTopic);

  const achievedGoalRow = page.locator("#achieved-list li").filter({ hasText: goalTitle }).first();
  await achievedGoalRow.locator("[data-goal-toggle]").click();

  await expect(page.locator("#goal-list")).toContainText(goalTitle);
  await expect(page.locator("#rough-list")).toContainText(roughNote);
  await expect(page.locator("#detail-list")).toContainText(detailTopic);
});
