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

async function addGoal(page, { title, date, description = "" }) {
  await page.locator("#goal-title").fill(title);
  await page.locator("#goal-date").fill(date);
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

module.exports = {
  seedAppState,
  addGoal,
  addMilestoneToGoal,
  setMonth,
};
