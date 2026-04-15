const { expect } = require("@playwright/test");

const DEFAULT_STATE = {
  goals: [],
  roughPlans: [],
  detailPlans: [],
  trackedSessions: [],
  importedEvents: [],
  settings: {
    inactivityDays: 3,
    lastReminderRun: null,
    notificationEnabled: false,
    activeView: "list",
    calendarMonth: null,
    themeMode: "auto",
  },
  timer: {
    start: null,
    selectedDetailPlanId: null,
  },
  pomodoro: {
    active: false,
    phase: "work",
    pomodorosCompleted: 0,
    secondsLeft: 1500,
    phaseStartedAt: null,
  },
};

async function seedAppState(page, partialState) {
  const state = {
    ...DEFAULT_STATE,
    ...partialState,
    settings: {
      ...DEFAULT_STATE.settings,
      ...(partialState?.settings || {}),
    },
    timer: {
      ...DEFAULT_STATE.timer,
      ...(partialState?.timer || {}),
    },
    pomodoro: {
      ...DEFAULT_STATE.pomodoro,
      ...(partialState?.pomodoro || {}),
    },
  };

  await page.addInitScript((seededState) => {
    window.localStorage.setItem("focusflow-v1", JSON.stringify(seededState));
  }, state);
}

async function addGoal(page, { title, date, description = "", workloadHours = null }) {
  await page.locator("#goal-title").fill(title);
  await page.locator("#goal-start-date").fill(date);
  if (workloadHours !== null && workloadHours !== undefined) {
    await page.locator("#goal-workload-hours").fill(String(workloadHours));
  }
  await page.locator("#goal-description").fill(description);
  await page.locator("#goal-submit").click();
  await expect(page.locator("#goal-list")).toContainText(title);
}

async function addMilestoneToGoal(page, { goalTitle, milestoneTitle }) {
  const goalRow = page.locator("#goal-list li").filter({ hasText: goalTitle }).first();
  await goalRow.getByPlaceholder("Zwischenziel hinzufügen").fill(milestoneTitle);
  await goalRow.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(goalRow).toContainText(milestoneTitle);
}

async function setMonth(page, monthValue) {
  const monthSelect = page.locator("#month-select");
  await monthSelect.fill(monthValue);
  await monthSelect.dispatchEvent("change");
}

async function openMenu(page) {
  const toggle = page.locator("#quick-actions-toggle");
  const expanded = await toggle.getAttribute("aria-expanded");
  if (expanded !== "true") {
    await toggle.click();
  }
}

async function openMenuSection(page, sectionLabel) {
  await openMenu(page);
  const section = page
    .locator(".lz-quick-menu details")
    .filter({ has: page.getByText(sectionLabel, { exact: true }) })
    .first();
  const isOpen = await section.evaluate((el) => el.hasAttribute("open"));
  if (!isOpen) {
    await section.locator("summary").click();
  }
}

async function clickAndAcceptDialogIfPresent(page, clickAction, timeout = 1500) {
  const clickPromise = clickAction();
  const dialogPromise = page.waitForEvent("dialog", { timeout }).catch(() => null);
  const dialog = await dialogPromise;
  if (dialog) {
    await dialog.accept();
  }
  await clickPromise;
}

async function addRoughPlan(page, { goalTitle, week, hours, note = "" }) {
  await page.locator("#rough-week").fill(week);
  await page.locator("#rough-hours").fill(String(hours));
  await page.locator("#rough-note").fill(note);
  await page.locator("#rough-goal").selectOption({ label: goalTitle });
  await page.locator("#rough-submit").click();
}

async function addAdditionalDetailPlan(
  page,
  { date, startTime, endTime, topic, milestoneLabel = null }
) {
  const additionalToggle = page.locator('[data-detail-plan-toggle="additional"]');
  await additionalToggle.click();
  await page.locator('[data-detail-date="additional"]').fill(date);
  await page.locator('[data-detail-start="additional"]').fill(startTime);
  await page.locator('[data-detail-end="additional"]').fill(endTime);
  if (milestoneLabel) {
    const milestoneSelect = page.locator('[data-detail-milestone-select="additional"]');
    const milestoneValue = await milestoneSelect.evaluate((select, label) => {
      const options = Array.from(select.options || []);
      const matched = options.find((option) =>
        (option.textContent || "").toLowerCase().includes(String(label).toLowerCase())
      );
      return matched ? matched.value : null;
    }, milestoneLabel);
    if (milestoneValue) {
      await milestoneSelect.selectOption(milestoneValue);
    }
  }
  await page.locator('[data-detail-topic="additional"]').fill(topic);
  await page.locator('[data-detail-block-form="additional"] button[type="submit"]').click();
}

async function installNotificationMock(page, { permission = "granted" } = {}) {
  await page.addInitScript(
    ({ initialPermission }) => {
      window.__notificationCalls = [];

      class MockNotification {
        static permission = initialPermission;

        static requestPermission() {
          this.permission = "granted";
          return Promise.resolve("granted");
        }

        constructor(title, options = {}) {
          window.__notificationCalls.push({ title, options });
        }
      }

      Object.defineProperty(window, "Notification", {
        configurable: true,
        writable: true,
        value: MockNotification,
      });
    },
    { initialPermission: permission }
  );
}

async function getNotificationCalls(page) {
  return page.evaluate(() => window.__notificationCalls || []);
}

module.exports = {
  seedAppState,
  addGoal,
  addMilestoneToGoal,
  setMonth,
  openMenu,
  openMenuSection,
  clickAndAcceptDialogIfPresent,
  addRoughPlan,
  addAdditionalDetailPlan,
  installNotificationMock,
  getNotificationCalls,
};
