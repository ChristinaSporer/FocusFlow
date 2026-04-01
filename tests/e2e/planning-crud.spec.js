const { test, expect } = require("@playwright/test");
const { addGoal, setMonth } = require("./helpers/e2e-helpers");

test("user can create edit and delete rough planning", async ({ page }) => {
  await page.goto("/");

  const goalTitle = `E2E Goal ${Date.now()}`;
  const initialNote = "Rough initial";
  const updatedNote = "Rough updated";

  await addGoal(page, { title: goalTitle, date: "2026-04-22" });

  await page.locator("#rough-week").fill("2026-W16");
  await page.locator("#rough-hours").fill("3");
  await page.locator("#rough-note").fill(initialNote);
  await page.locator("#rough-goal").selectOption({ label: goalTitle });
  await page.locator("#rough-submit").click();

  const roughRow = page.locator("#rough-list li").filter({ hasText: initialNote }).first();
  await expect(roughRow).toBeVisible();

  await roughRow.getByRole("button", { name: "Bearbeiten" }).click();
  await page.locator("#rough-hours").fill("5");
  await page.locator("#rough-note").fill(updatedNote);
  await page.locator("#rough-submit").click();

  await expect(page.locator("#rough-list")).toContainText(updatedNote);

  const updatedRow = page.locator("#rough-list li").filter({ hasText: updatedNote }).first();
  await updatedRow.getByRole("button", { name: "Löschen" }).click();
  await expect(page.locator("#rough-list")).not.toContainText(updatedNote);
});

test("user can create edit and delete detail planning", async ({ page }) => {
  await page.goto("/");
  await setMonth(page, "2026-04");

  const goalTitle = `E2E Goal ${Date.now()}`;
  const detailTopic = "Detail initial";
  const updatedTopic = "Detail updated";

  await addGoal(page, { title: goalTitle, date: "2026-04-26" });

  await page.locator("#rough-week").fill("2026-W16");
  await page.locator("#rough-hours").fill("2");
  await page.locator("#rough-note").fill("Detail rough");
  await page.locator("#rough-goal").selectOption({ label: goalTitle });
  await page.locator("#rough-submit").click();

  await page
    .locator('[data-detail-plan-toggle]:not([data-detail-plan-toggle="additional"])')
    .first()
    .click();
  await page.locator("[data-detail-date]:visible").fill("2026-04-18");
  await page.locator("[data-detail-start]:visible").fill("08:00");
  await page.locator("[data-detail-end]:visible").fill("09:30");
  await page.locator("[data-detail-topic]:visible").fill(detailTopic);
  await page.locator('[data-detail-block-form]:visible button[type="submit"]').click();

  const detailRow = page.locator("#detail-list li").filter({ hasText: detailTopic }).first();
  await expect(detailRow).toBeVisible();

  await detailRow.getByRole("button", { name: "Detailplanung bearbeiten" }).click();
  await page.locator("[data-detail-topic]:visible").fill(updatedTopic);
  await page.locator('[data-detail-block-form]:visible button[type="submit"]').click();

  await expect(page.locator("#detail-list")).toContainText(updatedTopic);

  const updatedRow = page.locator("#detail-list li").filter({ hasText: updatedTopic }).first();
  await updatedRow.getByRole("button", { name: "Löschen" }).click();
  await expect(page.locator("#detail-list")).not.toContainText(updatedTopic);
});
