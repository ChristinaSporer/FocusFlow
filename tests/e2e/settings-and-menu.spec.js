const { test, expect } = require("@playwright/test");
const {
  addGoal,
  addAdditionalDetailPlan,
  installNotificationMock,
  getNotificationCalls,
  seedAppState,
  openMenu,
  openMenuSection,
  clickAndAcceptDialogIfPresent,
  setMonth,
} = require("./helpers/e2e-helpers");

test("Menü: Demo-Daten laden, Übersicht prüfen und anschließend Alles löschen", async ({
  page,
}) => {
  await page.goto("/");
  await openMenu(page);

  await page.locator("#menu-demo").click();

  await expect(page.locator("#goal-list")).toContainText("Modul Software Engineering abschließen");
  await expect(page.locator("#overview-next-items")).toContainText(
    "Alle nächsten (Detailplanung & Ziele)"
  );
  await expect(page.locator("#overview-next-items")).toContainText("Detail:");

  await clickAndAcceptDialogIfPresent(page, async () => {
    await page.locator("#menu-reset").click({ force: true });
  });

  await expect(page.locator("#goal-list")).toContainText("Keine Ziele vorhanden");
  await expect(page.locator("#rough-list")).toContainText("Keine Grobplanung vorhanden");
  await expect(page.locator("#detail-list")).toContainText("Noch keine weitere Detailplanung");
});

test("Darstellung kann auf Hell, Dunkel und zurück auf Auto gewechselt werden", async ({
  page,
}) => {
  await page.goto("/");
  await openMenu(page);

  await page.locator('[data-menu-theme-mode="light"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "light");

  let state = await page.evaluate(() => JSON.parse(localStorage.getItem("focusflow-v1")));
  expect(state.settings.themeMode).toBe("light");

  await page.locator('[data-menu-theme-mode="dark"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "dark");
  state = await page.evaluate(() => JSON.parse(localStorage.getItem("focusflow-v1")));
  expect(state.settings.themeMode).toBe("dark");

  await page.locator('[data-menu-theme-mode="auto"]').click();
  state = await page.evaluate(() => JSON.parse(localStorage.getItem("focusflow-v1")));
  expect(state.settings.themeMode).toBe("auto");
});

test("Erinnerung kann ein- und ausgeschaltet werden; ausgeschaltet kommt keine Benachrichtigung", async ({
  page,
}) => {
  await installNotificationMock(page, { permission: "granted" });
  await page.goto("/");

  await openMenu(page);
  await openMenuSection(page, "Benachrichtigungen");
  await page.locator("#menu-notification-lead").fill("0");
  await page.locator("#menu-notification-lead").dispatchEvent("change");

  await page.locator("#menu-notification-enabled").check();
  await page.locator("#menu-notification-enabled").uncheck();

  await setMonth(page, "2026-04");
  await addGoal(page, { title: `Notification Ziel ${Date.now()}`, date: "2026-04-30" });
  await addAdditionalDetailPlan(page, {
    date: "2026-04-20",
    startTime: "09:00",
    endTime: "10:00",
    topic: "Termin ohne aktive Erinnerung",
  });

  const calls = await getNotificationCalls(page);
  expect(calls.length).toBe(0);
});

test("Inaktivitaets-Benachrichtigung wird beim Oeffnen der App nachgeholt", async ({ page }) => {
  await installNotificationMock(page, { permission: "granted" });
  await seedAppState(page, {
    trackedSessions: [
      {
        id: "t1",
        start: "2026-04-10T08:00:00.000Z",
        end: "2026-04-10T09:00:00.000Z",
        minutes: 60,
        note: "Alt",
        detailPlanId: null,
      },
    ],
    settings: {
      inactivityDays: 7,
      inactivityNotificationEnabled: true,
      lastInactivityNotificationAt: null,
    },
  });

  await page.goto("/");

  const calls = await getNotificationCalls(page);
  expect(calls).toHaveLength(1);
  expect(calls[0].title).toContain("keine Lernzeit erfasst");
});

test("Standard-Lernzeiten beeinflussen die Vorschläge in der Grobplanung", async ({ page }) => {
  await page.goto("/");
  await setMonth(page, "2026-04");

  const goalTitle = `Lernzeiten Ziel ${Date.now()}`;
  await addGoal(page, { title: goalTitle, date: "2026-04-24", workloadHours: 4 });

  await openMenu(page);
  await openMenuSection(page, "Standard-Lernzeiten");
  await page.locator("#slt-mon-start").fill("08:00");
  await page.locator("#slt-mon-end").fill("10:00");
  await page.locator("#slt-tue-start").fill("08:00");
  await page.locator("#slt-tue-end").fill("10:00");
  await page.locator("#slt-wed-start").fill("08:00");
  await page.locator("#slt-wed-end").fill("10:00");
  await page.locator("#slt-thu-start").fill("08:00");
  await page.locator("#slt-thu-end").fill("10:00");
  await page.locator("#slt-fri-start").fill("08:00");
  await page.locator("#slt-fri-end").fill("10:00");

  await clickAndAcceptDialogIfPresent(page, async () => {
    await page.locator("#menu-save-learning-times").click({ force: true });
  });

  await page.locator("#rough-goal").selectOption({ label: goalTitle });
  await expect(page.locator("#rough-plan-grid")).toContainText("120 Min");
  await expect(page.locator("#rough-plan-summary")).toContainText("Workload");
});
