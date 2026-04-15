const { test, expect } = require("@playwright/test");

test("Smoke: Lernziel kann angelegt werden", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Lernzeitplaner" })).toBeVisible();

  const title = `E2E Ziel ${Date.now()}`;
  await page.locator("#goal-title").fill(title);
  await page.locator("#goal-start-date").fill("2026-03-15");
  await page.locator("#goal-submit").click();

  await expect(page.locator("#goal-list")).toContainText(title);
});

test("Smoke: Kalenderansicht zeigt angelegte Detailplanung", async ({ page }) => {
  await page.goto("/");

  await page.locator('[data-detail-plan-toggle="additional"]').click();
  await page.locator('[data-detail-date="additional"]').fill("2026-04-15");
  await page.locator('[data-detail-start="additional"]').fill("09:00");
  await page.locator('[data-detail-end="additional"]').fill("10:00");
  await page.locator('[data-detail-topic="additional"]').fill("Kalendertest");
  await page.locator('[data-detail-block-form="additional"] button[type="submit"]').click();

  await page.locator("#tab-calendar").click();

  await expect(page.locator("#calendar-view")).toBeVisible();
  await expect(page.locator("#calendar-grid")).toContainText("Kalendertest");
});
