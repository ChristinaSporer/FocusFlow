const { test, expect } = require("@playwright/test");

test("user can add a goal", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Lernzeitplaner" })).toBeVisible();

  const title = `E2E Ziel ${Date.now()}`;
  await page.locator("#goal-title").fill(title);
  await page.locator("#goal-date").fill("2026-03-15");
  await page.locator("#goal-form button").click();

  await expect(page.locator("#goal-list")).toContainText(title);
});

test("user can switch to calendar and see created appointment", async ({ page }) => {
  await page.goto("/");

  await page.locator("#detail-date").fill("2026-03-15");
  await page.locator("#detail-minutes").fill("60");
  await page.locator("#detail-topic").fill("Kalendertest");
  await page.locator("#detail-form button").click();

  await page.locator("#tab-calendar").click();

  await expect(page.locator("#calendar-view")).toBeVisible();
  await expect(page.locator("#calendar-grid")).toContainText("Kalendertest");
});
