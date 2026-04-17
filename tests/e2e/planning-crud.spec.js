const { test, expect } = require("@playwright/test");
const {
  addGoal,
  addMilestoneToGoal,
  addRoughPlan,
  addAdditionalDetailPlan,
  openMenu,
  openMenuSection,
  clickAndAcceptDialogIfPresent,
  setMonth,
} = require("./helpers/e2e-helpers");

test("Grobplanung: Ziel mit Farbe, Slot-Auswahl, Detailerzeugung und erneute Planbarkeit", async ({
  page,
}) => {
  await page.goto("/");
  await setMonth(page, "2026-04");

  const zielA = `Grobplan Ziel A ${Date.now()}`;
  const zielB = `Grobplan Ziel B ${Date.now()}`;

  await page.locator("#goal-title").fill(zielA);
  await page.locator("#goal-start-date").fill("2026-04-07");
  await page.locator("#goal-workload-hours").fill("8");
  await page.locator('label[for="goal-color-dark-green"]').click();
  await page.locator("#goal-submit").click();

  await addGoal(page, { title: zielB, date: "2026-04-23" });

  const zielVorPlanung = await page.evaluate((title) => {
    const state = JSON.parse(window.localStorage.getItem("focusflow-v1"));
    return state.goals.find((goal) => goal.title === title);
  }, zielA);
  expect(zielVorPlanung.colorKey).toBe("dark-green");
  expect(zielVorPlanung.targetDate).toBe("");

  await addAdditionalDetailPlan(page, {
    date: "2026-04-08",
    startTime: "08:00",
    endTime: "10:00",
    topic: "Bereits belegter Slot",
  });

  await openMenu(page);
  await openMenuSection(page, "Standard-Lernzeiten");
  await page.locator("#slt-mon-start").fill("08:00");
  await page.locator("#slt-mon-end").fill("12:00");
  await page.locator("#slt-tue-start").fill("08:00");
  await page.locator("#slt-tue-end").fill("12:00");
  await page.locator("#slt-wed-start").fill("08:00");
  await page.locator("#slt-wed-end").fill("12:00");
  await page.locator("#slt-thu-start").fill("08:00");
  await page.locator("#slt-thu-end").fill("12:00");
  await page.locator("#slt-fri-start").fill("08:00");
  await page.locator("#slt-fri-end").fill("12:00");
  await clickAndAcceptDialogIfPresent(page, async () => {
    await page.locator("#menu-save-learning-times").click({ force: true });
  });

  await page.locator("#rough-goal").selectOption({ label: zielA });
  await expect(page.locator("#rough-plan-grid")).toBeVisible();
  await expect(page.locator("#rough-plan-grid")).toContainText("Min");

  const keysAreUnique = await page.evaluate(() => {
    const keys = Array.from(
      document.querySelectorAll('#rough-plan-grid input[type="checkbox"]')
    ).map((input) => input.getAttribute("data-rough-slot-key"));
    return new Set(keys).size === keys.length;
  });
  expect(keysAreUnique).toBe(true);

  await expect(page.locator("#rough-plan-grid")).toContainText("120 Min");

  const firstChecked = page.locator('#rough-plan-grid input[type="checkbox"]:checked').first();
  await expect(firstChecked).toBeVisible();
  const uncheckedBefore = page
    .locator('#rough-plan-grid input[type="checkbox"]:not(:checked)')
    .count();
  const checkedHandle = await firstChecked.elementHandle();
  await checkedHandle.evaluate((input) => {
    input.checked = false;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  if (await page.locator("#rough-load-more").isVisible()) {
    await page.locator("#rough-load-more").click();
  }
  const firstUnchecked = page
    .locator('#rough-plan-grid input[type="checkbox"]:not(:checked)')
    .first();
  const uncheckedHandle = await firstUnchecked.elementHandle();
  await uncheckedHandle.evaluate((input) => {
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator("#rough-submit").click();

  await expect(page.locator("#detail-list")).toContainText("automatisch geplant");

  const zustandNachPlanung = await page.evaluate((title) => {
    const state = JSON.parse(window.localStorage.getItem("focusflow-v1"));
    const goal = state.goals.find((item) => item.title === title);
    const details = state.detailPlans
      .filter((item) => item.goalId === goal.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    return { goal, details };
  }, zielA);

  expect(zustandNachPlanung.goal.targetDate).toBe(
    zustandNachPlanung.details[zustandNachPlanung.details.length - 1].date
  );

  const optionenNachPlan = await page.locator("#rough-goal option").allTextContents();
  expect(optionenNachPlan.join(" ")).not.toContain(zielA);
  expect(optionenNachPlan.join(" ")).toContain(zielB);

  const roughRow = page.locator("#rough-list li").filter({ hasText: zielA }).first();
  await roughRow.getByRole("button", { name: "Löschen" }).click();

  await page.locator("#rough-goal").selectOption({ label: zielA });
  await expect(page.locator("#rough-goal")).toHaveValue(
    await page.evaluate((title) => {
      const state = JSON.parse(window.localStorage.getItem("focusflow-v1"));
      return state.goals.find((goal) => goal.title === title).id;
    }, zielA)
  );
  expect(await uncheckedBefore).toBeGreaterThan(0);
});

test("Detailplanung: Bearbeiten, Kalender-Drag&Drop, mit und ohne Hauptziel planen", async ({
  page,
}) => {
  await page.goto("/");
  await setMonth(page, "2026-04");

  const zielTitel = `Detailplan Ziel ${Date.now()}`;
  const zwischenziel = "MS Vertiefung";
  const detailThema = "API-Design";

  await addGoal(page, { title: zielTitel, date: "2026-04-24" });
  await addMilestoneToGoal(page, { goalTitle: zielTitel, milestoneTitle: zwischenziel });
  await addRoughPlan(page, {
    goalTitle: zielTitel,
    week: "2026-W16",
    hours: 3,
    note: "Detailblock",
  });

  await page
    .locator('[data-detail-plan-toggle]:not([data-detail-plan-toggle="additional"])')
    .first()
    .click();
  await page.locator("[data-detail-date]:visible").fill("2026-04-18");
  await page.locator("[data-detail-start]:visible").fill("08:00");
  await page.locator("[data-detail-end]:visible").fill("09:30");
  await page.locator("[data-detail-topic]:visible").fill(detailThema);
  await page.locator("[data-detail-milestone-select]:visible").selectOption({ index: 1 });
  await page.locator('[data-detail-block-form]:visible button[type="submit"]').click();

  const detailRow = page.locator("#detail-list li").filter({ hasText: detailThema }).first();
  await expect(detailRow).toContainText(zwischenziel);

  await detailRow.getByRole("button", { name: "Detailplanung bearbeiten" }).click();
  await page.locator("[data-detail-date]:visible").fill("2026-04-27");
  await page.locator('[data-detail-block-form]:visible button[type="submit"]').click();

  const statusNachEdit = await page.evaluate((title) => {
    const state = JSON.parse(window.localStorage.getItem("focusflow-v1"));
    const goal = state.goals.find((goalItem) => goalItem.title === title);
    const details = state.detailPlans
      .filter((detail) => detail.goalId === goal.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    return {
      goalTargetDate: goal.targetDate,
      lastDetailDate: details[details.length - 1].date,
    };
  }, zielTitel);
  expect(statusNachEdit.goalTargetDate).toBe(statusNachEdit.lastDetailDate);

  await setMonth(page, "2026-04");
  await page.locator("#tab-calendar").click();
  await expect(page.locator("#calendar-grid")).toContainText(zwischenziel);

  const detailEvent = page
    .locator(".lz-calendar-event.lz-source-detail")
    .filter({ hasText: zwischenziel })
    .first();
  const targetDay = page.locator('[data-ymd="2026-04-29"]');
  await expect(detailEvent).toBeVisible();
  await expect(targetDay).toBeVisible();
  await detailEvent.dragTo(targetDay);

  await page.locator("#tab-list").click();
  const statusNachDrag = await page.evaluate(
    ({ title, thema }) => {
      const state = JSON.parse(window.localStorage.getItem("focusflow-v1"));
      const goal = state.goals.find((goalItem) => goalItem.title === title);
      const draggedDetail = state.detailPlans.find((detail) => detail.topic === thema);
      return {
        draggedDate: draggedDetail.date,
        goalTargetDate: goal.targetDate,
      };
    },
    { title: zielTitel, thema: detailThema }
  );
  expect(statusNachDrag.draggedDate).toBe("2026-04-29");
  expect(statusNachDrag.goalTargetDate).toBe("2026-04-29");

  await addAdditionalDetailPlan(page, {
    date: "2026-04-30",
    startTime: "12:00",
    endTime: "13:00",
    topic: "Zusatz mit Ziel",
    milestoneLabel: zwischenziel,
  });
  await addAdditionalDetailPlan(page, {
    date: "2026-04-30",
    startTime: "13:00",
    endTime: "13:30",
    topic: "Freier Zusatz ohne Ziel",
  });

  await expect(page.locator("#detail-list")).toContainText("Zusatz mit Ziel");
  await expect(page.locator("#detail-list")).toContainText("Freier Zusatz ohne Ziel");

  const goalDetailToDelete = page
    .locator("#detail-list li")
    .filter({ hasText: "Zusatz mit Ziel" })
    .first();
  await goalDetailToDelete.getByRole("button", { name: "Löschen" }).first().click();

  const zielNachLoeschen = await page.evaluate((title) => {
    const state = JSON.parse(window.localStorage.getItem("focusflow-v1"));
    const goal = state.goals.find((item) => item.title === title);
    const lastDate = state.detailPlans
      .filter((detail) => detail.goalId === goal.id)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-1)[0]?.date;
    return { targetDate: goal.targetDate, lastDate };
  }, zielTitel);
  expect(zielNachLoeschen.targetDate).toBe(zielNachLoeschen.lastDate);
});

test("Erledigtes Ziel gibt belegten Detailplanungstag fuer neue Grobplanung wieder frei", async ({
  page,
}) => {
  await page.goto("/");
  await setMonth(page, "2026-05");

  const altesZiel = `IT-Service lernen ${Date.now()}`;
  const neuesZiel = `Deutsch lernen ${Date.now()}`;

  await page.locator("#goal-title").fill(altesZiel);
  await page.locator("#goal-start-date").fill("2026-05-08");
  await page.locator("#goal-workload-hours").fill("4");
  await page.locator("#goal-submit").click();

  await openMenu(page);
  await openMenuSection(page, "Standard-Lernzeiten");
  await page.locator("#slt-fri-start").fill("08:00");
  await page.locator("#slt-fri-end").fill("12:00");
  await clickAndAcceptDialogIfPresent(page, async () => {
    await page.locator("#menu-save-learning-times").click({ force: true });
  });

  await page.locator("#rough-goal").selectOption({ label: altesZiel });
  await expect(page.locator("#rough-plan-grid")).toContainText("2026-05-08");
  const slotHandle = await page.locator('[data-rough-day="2026-05-08"]').first().elementHandle();
  await slotHandle.evaluate((input) => {
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator("#rough-submit").click();

  await expect(page.locator("#detail-list")).toContainText(altesZiel);

  const altesZielRow = page.locator("#goal-list li").filter({ hasText: altesZiel }).first();
  await clickAndAcceptDialogIfPresent(page, async () => {
    await altesZielRow.locator('[data-goal-toggle]').click();
  });

  await addGoal(page, { title: neuesZiel, date: "2026-05-08", workloadHours: 2 });
  await page.locator("#rough-goal").selectOption({ label: neuesZiel });

  await expect(page.locator("#rough-plan-grid")).toContainText("2026-05-08");
});
