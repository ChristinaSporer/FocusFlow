/* eslint-disable no-unused-vars */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { appReducer } from "../../modules/app-reducer.js";
import {
  escapeIcsText,
  getIcsProp,
  hashText,
  normalizeIcs,
  parseIcsDate,
  parseIcsEvents,
  serializeEventsToIcs,
  toIcsDate,
  toIcsDateTimeUtc,
} from "../../modules/ics-utils.js";
import { createCalendarManager } from "../../modules/calendar-manager.js";
import { initFormHandlers } from "../../modules/form-handlers.js";
import { createIcsManager } from "../../modules/ics-manager.js";
import { createJsonManager } from "../../modules/json-manager.js";
import {
  STORAGE_KEY,
  createStore,
  defaultData,
  loadState,
  persistState,
} from "../../modules/state-store.js";
import { buildDemoState } from "../../modules/demo-data.js";
import {
  renderDetailPlans,
  renderGoals,
  renderRoughPlans,
  renderStats,
  renderTimerDetailPlanSelect,
  renderTrackedSessions,
} from "../../modules/render-main-view.js";
import { createThemeManager, normalizeThemeMode } from "../../modules/theme-manager.js";
import { createTimerManager } from "../../modules/timer-manager.js";
import { createPomodoroManager } from "../../modules/pomodoro-manager.js";

function baseState() {
  return {
    goals: [
      {
        id: "g1",
        title: "Goal",
        targetDate: "2026-04-01",
        completed: false,
        completedAt: null,
        milestones: [{ id: "m1", title: "MS1", done: false }],
      },
    ],
    roughPlans: [{ id: "r1", date: "2026-04-02", hours: 2, note: "Read", goalId: "g1" }],
    detailPlans: [
      {
        id: "d1",
        date: "2026-04-03",
        topic: "Topic",
        milestone: "MS1",
        milestoneId: "m1",
        goalId: "g1",
        roughPlanId: "r1",
        minutes: 60,
        done: false,
      },
    ],
    trackedSessions: [{ id: "t1", minutes: 30 }],
    importedEvents: [{ id: "i1", sourceKey: "a", summary: "old" }],
    settings: {
      inactivityDays: 3,
      lastReminderRun: null,
      notificationEnabled: false,
      activeView: "list",
      calendarMonth: null,
      themeMode: "auto",
    },
    timer: { start: null, selectedDetailPlanId: null },
  };
}

describe("modules/form-handlers", () => {
  function mountFormHandlersDom() {
    document.body.innerHTML = [
      '<form id="goal-form"><button id="goal-submit" type="submit">X</button></form>',
      '<input id="goal-edit-id" value="preset">',
      '<input id="goal-title" value="">',
      '<input id="goal-start-date" value="">',
      '<input id="goal-date" value="">',
      '<input id="goal-workload-hours" value="">',
      '<textarea id="goal-description"></textarea>',
      '<input type="radio" name="goal-color" id="goal-color-light-blue" value="light-blue" checked>',
      '<button id="goal-cancel-edit" type="button" class="d-none"></button>',
      '<form id="rough-form"><button id="rough-submit" type="submit">X</button></form>',
      '<input id="rough-edit-id" value="">',
      '<select id="rough-goal"><option value="">Kein Ziel</option><option value="g1">Goal</option></select>',
      '<div id="rough-plan-summary"></div>',
      '<div id="rough-plan-grid"></div>',
      '<button id="rough-load-more" type="button" class="d-none"></button>',
      '<form id="detail-form"></form>',
      '<input id="detail-date" value="">',
      '<input id="detail-minutes" value="">',
      '<input id="detail-topic" value="">',
      '<input id="detail-milestone" value="">',
      '<input id="month-select" value="2026-03">',
      '<button id="tab-list" data-view="list" type="button"></button>',
      '<button id="tab-calendar" data-view="calendar" type="button"></button>',
      '<button id="calendar-prev" type="button"></button>',
      '<button id="calendar-next" type="button"></button>',
      '<button id="timer-start" type="button"></button>',
      '<button id="timer-pause" type="button"></button>',
      '<button id="timer-stop" type="button"></button>',
      '<select id="track-detail-select"><option value="">Kein Detail</option><option value="d1">D1</option></select>',
      '<input id="track-edit-id" value="">',
      '<form id="track-manual-form"><input id="track-manual-date" value="2026-03-24"><input id="track-manual-hours" value=""><input id="track-manual-extra-minutes" value=""><input id="track-manual-minutes" value=""><button id="track-manual-submit" type="submit">save</button></form>',
      '<button id="track-cancel-edit" type="button" class="d-none"></button>',
      '<input id="track-note" value="">',
      '<button id="menu-demo" type="button"></button>',
      '<button id="menu-reset" type="button"></button>',
      '<button data-menu-theme-mode="auto" type="button"></button>',
      '<button data-menu-theme-mode="light" type="button"></button>',
      '<button data-menu-theme-mode="dark" type="button"></button>',
      '<button id="menu-ics-import" type="button"></button>',
      '<input id="menu-ics-file" type="file">',
      '<button id="menu-ics-export" type="button"></button>',
      '<button id="menu-json-import" type="button"></button>',
      '<input id="menu-json-file" type="file">',
      '<button id="menu-json-export" type="button"></button>',
      '<input id="menu-notification-enabled" type="checkbox">',
      '<input id="menu-notification-lead" value="15">',
      '<p id="menu-notification-status"></p>',
      '<button id="menu-save-learning-times" type="button"></button>',
      '<input id="slt-mon-start" value="08:00"><input id="slt-mon-end" value="10:00">',
      '<input id="slt-tue-start" value="08:00"><input id="slt-tue-end" value="10:00">',
      '<input id="slt-wed-start" value="08:00"><input id="slt-wed-end" value="10:00">',
      '<input id="slt-thu-start" value="08:00"><input id="slt-thu-end" value="10:00">',
      '<input id="slt-fri-start" value="08:00"><input id="slt-fri-end" value="10:00">',
      '<input id="slt-sat-start" value=""><input id="slt-sat-end" value="">',
      '<input id="slt-sun-start" value=""><input id="slt-sun-end" value="">',
    ].join("");
  }

  function setupHandlers(overrides = {}) {
    mountFormHandlersDom();
    const deps = {
      dispatch: vi.fn(),
      renderAll: vi.fn(),
      getState: vi.fn(() => ({
        goals: [
          {
            id: "g1",
            title: "Goal",
            startDate: "2026-04-01",
            workloadHours: 4,
            completed: false,
          },
        ],
        roughPlans: [],
        detailPlans: [],
        settings: {
          standardLearningTimes: {
            mon: { startTime: "08:00", endTime: "10:00" },
            tue: { startTime: "08:00", endTime: "10:00" },
            wed: { startTime: "08:00", endTime: "10:00" },
            thu: { startTime: "08:00", endTime: "10:00" },
            fri: { startTime: "08:00", endTime: "10:00" },
            sat: { startTime: "", endTime: "" },
            sun: { startTime: "", endTime: "" },
          },
          notificationEnabled: false,
          notificationLeadMinutes: 15,
        },
      })),
      touchActivity: vi.fn(),
      defaultData: vi.fn(() => ({ ok: true })),
      setInitialValues: vi.fn(),
      loadDemoData: vi.fn(),
      normalizeThemeMode: vi.fn((value) => value),
      applyTheme: vi.fn(),
      getCalendarMonth: vi.fn(() => "2026-03"),
      setCalendarMonth: vi.fn(),
      renderCalendar: vi.fn(),
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      setSelectedTimerDetailPlan: vi.fn(),
      addManualTrackedSession: vi.fn(() => true),
      updateTrackedSession: vi.fn(() => true),
      importIcsFile: vi.fn(async () => ({ ok: false })),
      exportIcsFile: vi.fn(),
      importJsonFile: vi.fn(async () => ({ ok: false })),
      exportJsonFile: vi.fn(),
      startPomodoro: vi.fn(),
      pausePomodoro: vi.fn(),
      skipPomodoroPhase: vi.fn(),
      resetPomodoro: vi.fn(),
      notificationPermission: vi.fn(async () => "granted"),
      getNotificationPermission: vi.fn(() => "default"),
      syncNotifications: vi.fn(),
      ...overrides,
    };

    const api = initFormHandlers(deps);
    return { deps, api };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("setzt die Zielbearbeitung zurueck und startet sie ueber die exponierte API", () => {
    const { api } = setupHandlers();

    expect(document.getElementById("goal-submit").textContent).toBe("Hinzufügen");
    expect(document.getElementById("goal-cancel-edit").classList.contains("d-none")).toBe(true);

    api.startGoalEdit({
      id: "g1",
      title: "Neues Ziel",
      startDate: "2026-03-01",
      targetDate: "2026-03-30",
      workloadHours: 12.5,
      colorKey: "light-blue",
      description: "Beschreibung",
    });

    expect(document.getElementById("goal-edit-id").value).toBe("g1");
    expect(document.getElementById("goal-title").value).toBe("Neues Ziel");
    expect(document.getElementById("goal-start-date").value).toBe("2026-03-01");
    expect(document.getElementById("goal-date").value).toBe("2026-03-30");
    expect(document.getElementById("goal-workload-hours").value).toBe("12.5");
    expect(document.getElementById("goal-description").value).toBe("Beschreibung");
    expect(document.getElementById("goal-submit").textContent).toContain("speichern");
    expect(document.getElementById("goal-cancel-edit").classList.contains("d-none")).toBe(false);

    api.resetGoalForm();
    expect(document.getElementById("goal-edit-id").value).toBe("");
    expect(document.getElementById("goal-title").value).toBe("");
  });

  it("filtert und sortiert das Ziel-Dropdown und ignoriert ein fehlendes Select", () => {
    const { api } = setupHandlers();

    api.populateGoalDropdown({
      goals: [
        { id: "g2", title: "Beta", startDate: "2026-04-03", completed: false },
        { id: "g3", title: "Alpha", startDate: "2026-04-03", completed: false },
        { id: "g4", title: "Erledigt", startDate: "2026-04-01", completed: true },
        { id: "g5", title: "Nur Zieltermin", targetDate: "2026-04-02", completed: false },
      ],
      roughPlans: [{ goalId: "g2", plannedDays: [{ date: "2026-04-03" }] }],
    });

    const optionValues = Array.from(document.getElementById("rough-goal").options).map(
      (option) => option.value
    );
    expect(optionValues).toEqual(["", "g5", "g3"]);

    document.getElementById("rough-goal").remove();
    expect(() => api.populateGoalDropdown({ goals: [], roughPlans: [] })).not.toThrow();
  });

  it("setzt beim Bearbeiten Fallbacks fuer Arbeitslast, Farbe und getrackte Minuten", () => {
    const { api } = setupHandlers();

    document.body.insertAdjacentHTML(
      "beforeend",
      '<input type="radio" name="goal-color" id="goal-color-dark-blue" value="dark-blue">'
    );

    api.startGoalEdit({
      id: "g7",
      title: "Fallback-Ziel",
      startDate: "2026-04-01",
      targetDate: "2026-04-30",
      workloadHours: 0,
      colorKey: "unbekannt",
      description: "",
    });

    expect(document.getElementById("goal-workload-hours").value).toBe("");
    expect(document.getElementById("goal-color-light-blue").checked).toBe(true);

    api.startTrackedEdit({
      id: "t2",
      start: "2026-03-24T08:00:00.000Z",
      minutes: 0,
      note: "",
      detailPlanId: null,
    });

    expect(document.getElementById("track-manual-minutes").value).toBe("");
    expect(document.getElementById("track-manual-hours").value).toBe("0");
    expect(document.getElementById("track-manual-extra-minutes").value).toBe("0");
    expect(document.getElementById("track-detail-select").value).toBe("");
  });

  it("verarbeitet Ziel-Anlegen, Ziel-Aktualisieren und Bearbeitungsabbruch", () => {
    const { deps } = setupHandlers();
    const goalForm = document.getElementById("goal-form");

    goalForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.dispatch).not.toHaveBeenCalled();

    document.getElementById("goal-title").value = "Ziel A";
    document.getElementById("goal-start-date").value = "2026-04-01";
    document.getElementById("goal-description").value = "Text";
    goalForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "GOAL_ADD" }));
    expect(deps.touchActivity).toHaveBeenCalled();
    expect(deps.renderAll).toHaveBeenCalled();

    document.getElementById("goal-edit-id").value = "g42";
    document.getElementById("goal-title").value = "Ziel B";
    document.getElementById("goal-start-date").value = "2026-04-02";
    goalForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "GOAL_UPDATE",
        payload: expect.objectContaining({
          goal: expect.objectContaining({ id: "g42", title: "Ziel B" }),
        }),
      })
    );

    document.getElementById("goal-cancel-edit").click();
    expect(document.getElementById("goal-edit-id").value).toBe("");
  });

  it("verarbeitet Interaktionen fuer Grobplan, Detailplan, Monat und Tabs", () => {
    const { deps } = setupHandlers();

    const roughForm = document.getElementById("rough-form");
    document.getElementById("rough-goal").value = "g1";
    document.getElementById("rough-goal").dispatchEvent(new Event("change", { bubbles: true }));
    roughForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "ROUGH_ADD" }));
    expect(deps.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "DETAIL_ADD" }));

    const detailForm = document.getElementById("detail-form");
    document.getElementById("detail-date").value = "2026-03-30";
    document.getElementById("detail-minutes").value = "90";
    document.getElementById("detail-topic").value = "Topic";
    document.getElementById("detail-milestone").value = "MS";
    detailForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "DETAIL_ADD" }));

    document.getElementById("month-select").dispatchEvent(new Event("change", { bubbles: true }));
    expect(deps.renderAll).toHaveBeenCalled();

    document.getElementById("tab-calendar").click();
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "SET_ACTIVE_VIEW",
      payload: { view: "calendar" },
    });
  });

  it("verarbeitet Legacy-Grobplan-Update, Nachladen und unvollstaendige Detaileingaben", () => {
    const { deps } = setupHandlers();
    document.body.insertAdjacentHTML(
      "beforeend",
      [
        '<input id="rough-week" value="">',
        '<input id="rough-hours" value="">',
        '<input id="rough-note" value="">',
        '<button id="rough-cancel-edit" type="button" class="d-none"></button>',
      ].join("")
    );

    document.getElementById("rough-goal").value = "g1";
    document.getElementById("rough-goal").dispatchEvent(new Event("change", { bubbles: true }));
    const initialCheckboxCount = document.querySelectorAll(
      '#rough-plan-grid input[type="checkbox"]'
    ).length;

    document.getElementById("rough-load-more").click();
    const expandedCheckboxCount = document.querySelectorAll(
      '#rough-plan-grid input[type="checkbox"]'
    ).length;
    expect(expandedCheckboxCount).toBeGreaterThanOrEqual(initialCheckboxCount);

    document.getElementById("rough-edit-id").value = "r-existing";
    document.getElementById("rough-week").value = "2026-W14";
    document.getElementById("rough-hours").value = "2.5";
    document.getElementById("rough-note").value = "Altbestand";
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ROUGH_UPDATE",
        payload: expect.objectContaining({
          id: "r-existing",
          update: expect.objectContaining({
            hours: 2.5,
            note: "Altbestand",
            goalId: "g1",
          }),
        }),
      })
    );

    const dispatchCount = deps.dispatch.mock.calls.length;
    document.getElementById("detail-date").value = "2026-03-30";
    document.getElementById("detail-minutes").value = "45";
    document.getElementById("detail-topic").value = "";
    document
      .getElementById("detail-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.dispatch).toHaveBeenCalledTimes(dispatchCount);
  });

  it("verarbeitet Kalender- und Timer-Steuerungen", () => {
    const { deps } = setupHandlers();

    document.getElementById("calendar-prev").click();
    document.getElementById("calendar-next").click();
    expect(deps.setCalendarMonth).toHaveBeenCalledTimes(2);
    expect(deps.renderCalendar).toHaveBeenCalledTimes(2);

    document.getElementById("timer-start").click();
    document.getElementById("timer-stop").click();
    document.getElementById("track-detail-select").value = "d1";
    document
      .getElementById("track-detail-select")
      .dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("track-note").value = "Manual note";
    document.getElementById("track-manual-hours").value = "1.5";
    document.getElementById("track-manual-extra-minutes").value = "10";
    document
      .getElementById("track-manual-extra-minutes")
      .dispatchEvent(new Event("input", { bubbles: true }));
    const submittedDate = document.getElementById("track-manual-date").value;
    document
      .getElementById("track-manual-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.startTimer).toHaveBeenCalledTimes(1);
    expect(deps.stopTimer).toHaveBeenCalledTimes(1);
    expect(deps.setSelectedTimerDetailPlan).toHaveBeenCalledWith("d1");
    expect(deps.addManualTrackedSession).toHaveBeenCalledWith({
      date: submittedDate,
      minutes: 100,
      note: "Manual note",
      detailPlanId: "d1",
    });
    expect(document.getElementById("track-manual-minutes").value).toBe("");
    expect(document.getElementById("track-note").value).toBe("");

    document.getElementById("track-edit-id").value = "t1";
    document.getElementById("track-manual-date").value = "2026-03-25";
    document.getElementById("track-manual-hours").value = "0";
    document.getElementById("track-manual-extra-minutes").value = "30";
    document
      .getElementById("track-manual-extra-minutes")
      .dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("track-note").value = "Updated note";
    document
      .getElementById("track-manual-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.updateTrackedSession).toHaveBeenCalledWith({
      id: "t1",
      date: "2026-03-25",
      minutes: 30,
      note: "Updated note",
      detailPlanId: "d1",
    });

    document.getElementById("track-cancel-edit").click();
    expect(document.getElementById("track-edit-id").value).toBe("");
  });

  it("behält Legacy-Minuten bei Split-Eingaben und setzt bei Fehlern das Tracking nicht zurueck", () => {
    const { deps } = setupHandlers({
      addManualTrackedSession: vi.fn(() => false),
      updateTrackedSession: vi.fn(() => false),
    });

    document.getElementById("track-note").value = "Legacy gewinnt";
    document.getElementById("track-manual-date").value = "2026-03-26";
    document.getElementById("track-manual-minutes").value = "50";
    document.getElementById("track-manual-hours").value = "1";
    document.getElementById("track-manual-extra-minutes").value = "20";
    document
      .getElementById("track-manual-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(deps.addManualTrackedSession).toHaveBeenCalledWith({
      date: "2026-03-26",
      minutes: 50,
      note: "Legacy gewinnt",
      detailPlanId: null,
    });
    expect(document.getElementById("track-note").value).toBe("Legacy gewinnt");
    expect(document.getElementById("track-manual-minutes").value).toBe("50");

    document.getElementById("track-edit-id").value = "t-fail";
    document.getElementById("track-manual-hours").value = "";
    document.getElementById("track-manual-extra-minutes").value = "";
    document.getElementById("track-manual-minutes").value = "30";
    document
      .getElementById("track-manual-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(deps.updateTrackedSession).toHaveBeenCalledWith({
      id: "t-fail",
      date: "2026-03-26",
      minutes: 30,
      note: "Legacy gewinnt",
      detailPlanId: null,
    });
    expect(document.getElementById("track-edit-id").value).toBe("t-fail");
  });

  it("verarbeitet Demo-, Theme-, Import-, Export- und Reset-Aktionen", async () => {
    const importIcsFile = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, calendarMonth: "2026-04" });
    const importJsonFile = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, state: { restored: true } });
    const normalizeThemeMode = vi.fn(() => "dark");
    const { deps } = setupHandlers({ importIcsFile, importJsonFile, normalizeThemeMode });

    document.getElementById("menu-demo").click();
    expect(deps.loadDemoData).toHaveBeenCalledTimes(1);

    document.querySelector('[data-menu-theme-mode="dark"]').click();
    expect(normalizeThemeMode).toHaveBeenCalledWith("dark");
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "SET_THEME_MODE",
      payload: { themeMode: "dark" },
    });
    expect(deps.applyTheme).toHaveBeenCalledTimes(1);

    const fileInput = document.getElementById("menu-ics-file");
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      value: [{ name: "a.ics" }],
    });

    document.getElementById("menu-ics-import").click();
    await Promise.resolve();
    expect(importIcsFile).toHaveBeenNthCalledWith(1, { name: "a.ics" });

    document.getElementById("menu-ics-import").click();
    await Promise.resolve();
    expect(importIcsFile).toHaveBeenNthCalledWith(2, { name: "a.ics" });
    expect(deps.setCalendarMonth).toHaveBeenCalledWith("2026-04");

    document.getElementById("menu-ics-export").click();
    expect(deps.exportIcsFile).toHaveBeenCalledTimes(1);

    const jsonFileInput = document.getElementById("menu-json-file");
    Object.defineProperty(jsonFileInput, "files", {
      configurable: true,
      value: [{ name: "backup.json" }],
    });

    document.getElementById("menu-json-import").click();
    await Promise.resolve();
    expect(importJsonFile).toHaveBeenNthCalledWith(1, { name: "backup.json" });

    document.getElementById("menu-json-import").click();
    await Promise.resolve();
    expect(importJsonFile).toHaveBeenNthCalledWith(2, { name: "backup.json" });
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "REPLACE_STATE",
      payload: { state: { restored: true } },
    });
    expect(deps.setInitialValues).toHaveBeenCalledTimes(1);

    document.getElementById("menu-json-export").click();
    expect(deps.exportJsonFile).toHaveBeenCalledTimes(1);

    const confirmSpy = vi
      .spyOn(globalThis, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const dispatchCountBeforeReset = deps.dispatch.mock.calls.length;
    document.getElementById("menu-reset").click();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(deps.dispatch).toHaveBeenCalledTimes(dispatchCountBeforeReset);

    document.getElementById("menu-reset").click();
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(deps.defaultData).toHaveBeenCalledTimes(1);
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "REPLACE_STATE",
      payload: { state: { ok: true } },
    });
    expect(deps.setInitialValues).toHaveBeenCalledTimes(2);
  });

  it("verarbeitet Pomodoro-Buttons, Statusmeldungen und Benachrichtigungswerte", async () => {
    const alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {});
    const { deps } = setupHandlers({
      getState: vi.fn(() => ({
        goals: [],
        roughPlans: [],
        detailPlans: [],
        settings: {
          standardLearningTimes: {
            mon: { startTime: "08:00", endTime: "16:00" },
            tue: { startTime: "08:00", endTime: "16:00" },
            wed: { startTime: "08:00", endTime: "16:00" },
            thu: { startTime: "08:00", endTime: "16:00" },
            fri: { startTime: "08:00", endTime: "12:00" },
            sat: { startTime: "", endTime: "" },
            sun: { startTime: "", endTime: "" },
          },
          notificationEnabled: true,
          notificationLeadMinutes: 120,
          themeMode: "dark",
        },
      })),
      getNotificationPermission: vi
        .fn()
        .mockReturnValueOnce("unsupported")
        .mockReturnValueOnce("unsupported")
        .mockReturnValueOnce("granted"),
    });

    document.body.insertAdjacentHTML(
      "beforeend",
      [
        '<button id="pomodoro-start" type="button"></button>',
        '<button id="pomodoro-pause" type="button"></button>',
        '<button id="pomodoro-save-next" type="button"></button>',
        '<button id="pomodoro-reset" type="button"></button>',
        '<button id="pomodoro-save-cancel" type="button"></button>',
      ].join("")
    );
    initFormHandlers({ ...deps });

    expect(document.getElementById("menu-notification-status").textContent).toContain(
      "unterstützt keine Benachrichtigungen"
    );

    const saveAndReset = vi.fn();
    window.pomodoroManagerSaveAndReset = saveAndReset;
    document.getElementById("pomodoro-start").click();
    document.getElementById("pomodoro-pause").click();
    document.getElementById("pomodoro-save-next").click();
    document.getElementById("pomodoro-reset").click();
    document.getElementById("pomodoro-save-cancel").click();

    expect(deps.startPomodoro).toHaveBeenCalledTimes(1);
    expect(deps.pausePomodoro).toHaveBeenCalledTimes(1);
    expect(deps.skipPomodoroPhase).toHaveBeenCalledTimes(1);
    expect(deps.resetPomodoro).toHaveBeenCalledTimes(1);
    expect(saveAndReset).toHaveBeenCalledTimes(1);

    const toggle = document.getElementById("menu-notification-enabled");
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();

    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "SET_NOTIFICATION_ENABLED",
      payload: { enabled: false },
    });
    expect(deps.syncNotifications).toHaveBeenCalled();

    document.getElementById("menu-notification-lead").value = "120";
    document
      .getElementById("menu-notification-lead")
      .dispatchEvent(new Event("change", { bubbles: true }));

    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "SET_NOTIFICATION_LEAD_MINUTES",
      payload: { minutes: 90 },
    });
    expect(
      document.querySelector('[data-menu-theme-mode="dark"]').getAttribute("aria-pressed")
    ).toBe("true");

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("meldet fehlende Importdateien ueber die Standardtexte", async () => {
    const alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {});
    const { deps } = setupHandlers({
      importIcsFile: vi.fn(async () => ({ ok: false })),
      importJsonFile: vi.fn(async () => ({ ok: false })),
    });

    document.getElementById("menu-ics-import").click();
    await Promise.resolve();
    expect(deps.importIcsFile).toHaveBeenCalledWith(undefined);

    document.getElementById("menu-json-import").click();
    await Promise.resolve();
    expect(deps.importJsonFile).toHaveBeenCalledWith(undefined);

    expect(alertSpy).toHaveBeenNthCalledWith(1, "ICS-Import fehlgeschlagen.");
    expect(alertSpy).toHaveBeenNthCalledWith(2, "JSON-Import fehlgeschlagen.");
  });

  it("initialisiert sich auch mit dem Standard-getState und fehlenden Optionalfeldern robust", () => {
    mountFormHandlersDom();
    ["rough-plan-grid", "detail-form", "tab-calendar", "track-manual-minutes"].forEach((id) => {
      document.getElementById(id)?.remove();
    });

    expect(() =>
      initFormHandlers({
        dispatch: vi.fn(),
        renderAll: vi.fn(),
        touchActivity: vi.fn(),
        defaultData: vi.fn(() => ({ ok: true })),
        setInitialValues: vi.fn(),
        loadDemoData: vi.fn(),
        normalizeThemeMode: vi.fn((value) => value),
        applyTheme: vi.fn(),
        getCalendarMonth: vi.fn(() => "2026-03"),
        setCalendarMonth: vi.fn(),
        renderCalendar: vi.fn(),
        startTimer: vi.fn(),
        stopTimer: vi.fn(),
        setSelectedTimerDetailPlan: vi.fn(),
        addManualTrackedSession: vi.fn(() => true),
        updateTrackedSession: vi.fn(() => true),
        importIcsFile: vi.fn(async () => ({ ok: false })),
        exportIcsFile: vi.fn(),
        importJsonFile: vi.fn(async () => ({ ok: false })),
        exportJsonFile: vi.fn(),
        startPomodoro: vi.fn(),
        pausePomodoro: vi.fn(),
        skipPomodoroPhase: vi.fn(),
        resetPomodoro: vi.fn(),
        notificationPermission: vi.fn(async () => "default"),
        getNotificationPermission: vi.fn(() => "default"),
        syncNotifications: vi.fn(),
      })
    ).not.toThrow();
  });

  it("legt einen Legacy-Grobplan an und bricht ohne Ziel oder ohne verteilte Tage sauber ab", () => {
    const alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {});
    const { deps } = setupHandlers({
      getState: vi.fn(() => ({
        goals: [
          {
            id: "g1",
            title: "Goal",
            startDate: "2026-04-01",
            workloadHours: 4,
            completed: false,
          },
        ],
        roughPlans: [],
        detailPlans: [],
        settings: {
          standardLearningTimes: {
            mon: { startTime: "", endTime: "" },
            tue: { startTime: "", endTime: "" },
            wed: { startTime: "", endTime: "" },
            thu: { startTime: "", endTime: "" },
            fri: { startTime: "", endTime: "" },
            sat: { startTime: "", endTime: "" },
            sun: { startTime: "", endTime: "" },
          },
          notificationEnabled: false,
          notificationLeadMinutes: 15,
        },
      })),
    });

    document.body.insertAdjacentHTML(
      "beforeend",
      [
        '<input id="rough-week" value="">',
        '<input id="rough-hours" value="">',
        '<input id="rough-note" value="">',
        '<button id="rough-cancel-edit" type="button" class="d-none"></button>',
      ].join("")
    );

    document.getElementById("rough-goal").value = "g1";
    document.getElementById("rough-week").value = "2026-W15";
    document.getElementById("rough-hours").value = "3";
    document.getElementById("rough-note").value = "Legacy-Plan";
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ROUGH_ADD",
        payload: expect.objectContaining({
          plan: expect.objectContaining({
            hours: 3,
            note: "Legacy-Plan",
            goalId: "g1",
          }),
        }),
      })
    );

    const dispatchCount = deps.dispatch.mock.calls.length;
    document.getElementById("rough-week").value = "";
    document.getElementById("rough-hours").value = "";
    document.getElementById("rough-goal").value = "fehlend";
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.dispatch).toHaveBeenCalledTimes(dispatchCount);

    document.getElementById("rough-goal").value = "g1";
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(alertSpy).toHaveBeenCalledWith("Keine planbaren Lerntage für dieses Ziel verfügbar.");
  });

  it("stoppt beim Pausieren optional das Timer-Intervall und toleriert fehlendes Pomodoro-Save", () => {
    const { deps } = setupHandlers();
    const stopInterval = vi.fn();
    window.timerManagerGetElapsed = vi.fn(() => 1234);
    window.timerManagerStopInterval = stopInterval;

    document.body.insertAdjacentHTML(
      "beforeend",
      '<button id="pomodoro-save-cancel" type="button"></button>'
    );
    initFormHandlers({ ...deps });

    document.getElementById("timer-pause").click();
    expect(stopInterval).toHaveBeenCalled();

    Reflect.deleteProperty(window, "pomodoroManagerSaveAndReset");
    expect(() => document.getElementById("pomodoro-save-cancel").click()).not.toThrow();
  });

  it("zeigt weitere Benachrichtigungsstatus an und klemmt negative Vorlaufzeiten auf null", () => {
    const { deps } = setupHandlers({
      getState: vi.fn(() => ({
        goals: [],
        roughPlans: [],
        detailPlans: [],
        settings: {
          standardLearningTimes: {
            mon: { startTime: "08:00", endTime: "10:00" },
            tue: { startTime: "08:00", endTime: "10:00" },
            wed: { startTime: "08:00", endTime: "10:00" },
            thu: { startTime: "08:00", endTime: "10:00" },
            fri: { startTime: "08:00", endTime: "10:00" },
            sat: { startTime: "", endTime: "" },
            sun: { startTime: "", endTime: "" },
          },
          notificationEnabled: false,
          notificationLeadMinutes: undefined,
        },
      })),
      getNotificationPermission: vi.fn(() => "denied"),
    });

    expect(document.getElementById("menu-notification-status").textContent).toContain(
      "Browser-Benachrichtigungen blockiert"
    );

    deps.getNotificationPermission.mockReturnValue("default");
    initFormHandlers({ ...deps });
    expect(document.getElementById("menu-notification-status").textContent).toContain(
      "noch nicht bestätigt"
    );
    expect(document.getElementById("menu-notification-lead").value).toBe("15");

    document.getElementById("menu-notification-lead").value = "-7";
    document
      .getElementById("menu-notification-lead")
      .dispatchEvent(new Event("change", { bubbles: true }));

    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "SET_NOTIFICATION_LEAD_MINUTES",
      payload: { minutes: 0 },
    });
  });

  it("meldet erfolgreiche Importe ohne Zusatzdaten mit den Fallback-Texten", async () => {
    const alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {});
    const { deps } = setupHandlers({
      importIcsFile: vi.fn(async () => ({ ok: true })),
      importJsonFile: vi.fn(async () => ({ ok: true, state: { restored: true } })),
    });

    document.getElementById("menu-ics-import").click();
    await Promise.resolve();
    expect(deps.setCalendarMonth).not.toHaveBeenCalled();

    document.getElementById("menu-json-import").click();
    await Promise.resolve();

    expect(alertSpy).toHaveBeenNthCalledWith(1, "ICS-Import erfolgreich.");
    expect(alertSpy).toHaveBeenNthCalledWith(2, "JSON-Import erfolgreich.");
  });

  it("speichert Standard-Lernzeiten wenn der Button geklickt wird", () => {
    const alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {});
    const { deps } = setupHandlers();

    document.getElementById("slt-mon-start").value = "09:00";
    document.getElementById("slt-mon-end").value = "11:00";
    document.getElementById("menu-save-learning-times").click();

    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SET_STANDARD_LEARNING_TIMES",
        payload: expect.objectContaining({
          standardLearningTimes: expect.objectContaining({
            mon: expect.objectContaining({ startTime: "09:00", endTime: "11:00" }),
          }),
        }),
      })
    );
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it("deaktiviert Benachrichtigungen wenn Berechtigung verweigert wird", async () => {
    const alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {});
    const { deps } = setupHandlers({
      notificationPermission: vi.fn(async () => "denied"),
    });

    const toggle = document.getElementById("menu-notification-enabled");
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();

    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "SET_NOTIFICATION_ENABLED",
      payload: { enabled: false },
    });
    expect(toggle.checked).toBe(false);
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it("pausiert und nimmt den Timer wieder auf", () => {
    const { deps } = setupHandlers();

    // Starte den Timer
    document.getElementById("timer-start").click();
    expect(deps.startTimer).toHaveBeenCalledTimes(1);

    // Pausiere
    document.getElementById("timer-pause").click();
    // Nach Pause ist der Start-Button wieder sichtbar (d-none entfernt)
    expect(document.getElementById("timer-start").classList.contains("d-none")).toBe(false);

    // Resume (Start-Button erneut klicken wenn pausiert)
    document.getElementById("timer-start").click();
    expect(deps.startTimer).toHaveBeenCalledTimes(2);
    expect(deps.startTimer).toHaveBeenLastCalledWith(expect.objectContaining({ resume: true }));
  });

  it("setzt Formulare auch ohne optionale Farbauswahl und mit leeren Stunden robust", () => {
    const { api } = setupHandlers();
    document.body.insertAdjacentHTML(
      "beforeend",
      [
        '<input id="rough-week" value="">',
        '<input id="rough-hours" value="">',
        '<input id="rough-note" value="">',
        '<button id="rough-cancel-edit" type="button" class="d-none"></button>',
      ].join("")
    );

    document.getElementById("goal-color-light-blue").remove();
    expect(() => api.resetGoalForm()).not.toThrow();

    api.startRoughEdit({
      id: "r1",
      goalId: "g1",
      week: "2026-W14",
      hours: 0,
      note: "",
    });

    expect(document.getElementById("rough-edit-id").value).toBe("r1");
    expect(document.getElementById("rough-hours").value).toBe("");
    expect(document.getElementById("rough-submit").textContent).toContain("speichern");
  });

  it("vertraegt fehlende optionale DOM-Felder beim Zuruecksetzen und Bearbeiten", () => {
    const { api } = setupHandlers();

    [
      "goal-edit-id",
      "goal-title",
      "goal-start-date",
      "goal-date",
      "goal-workload-hours",
      "goal-description",
      "goal-color-light-blue",
      "goal-submit",
      "goal-cancel-edit",
      "rough-goal",
      "rough-week",
      "rough-hours",
      "rough-note",
      "rough-submit",
      "rough-cancel-edit",
    ].forEach((id) => {
      document.getElementById(id)?.remove();
    });

    expect(() => api.resetGoalForm()).not.toThrow();
    expect(() =>
      api.startRoughEdit({ id: "r2", goalId: "g1", week: "2026-W15", hours: 0, note: "" })
    ).not.toThrow();
  });

  it("zeigt Restzeit an wenn keine verteilbaren Lernslots verfuegbar sind", () => {
    setupHandlers({
      getState: vi.fn(() => ({
        goals: [
          {
            id: "g1",
            title: "Goal",
            startDate: "2026-04-01",
            workloadHours: 4,
            completed: false,
          },
        ],
        roughPlans: [],
        detailPlans: [],
        settings: {
          standardLearningTimes: {
            mon: { startTime: "", endTime: "" },
            tue: { startTime: "", endTime: "" },
            wed: { startTime: "", endTime: "" },
            thu: { startTime: "", endTime: "" },
            fri: { startTime: "", endTime: "" },
            sat: { startTime: "", endTime: "" },
            sun: { startTime: "", endTime: "" },
          },
          notificationEnabled: false,
          notificationLeadMinutes: 15,
        },
      })),
    });

    document.getElementById("rough-goal").value = "g1";
    document.getElementById("rough-goal").dispatchEvent(new Event("change", { bubbles: true }));

    expect(document.getElementById("rough-plan-summary").textContent).toContain("Rest: 4.0 h");
    expect(document.querySelectorAll('#rough-plan-grid input[type="checkbox"]').length).toBe(0);
  });

  it("uebernimmt automatische Slots in die manuelle Auswahl und entfernt sie wieder", () => {
    setupHandlers();

    document.getElementById("rough-goal").value = "g1";
    document.getElementById("rough-goal").dispatchEvent(new Event("change", { bubbles: true }));

    const checkboxes = Array.from(
      document.querySelectorAll('#rough-plan-grid input[type="checkbox"]')
    );
    const autoCheckbox = checkboxes.find((checkbox) => checkbox.checked);
    const manualCheckbox = checkboxes.find((checkbox) => !checkbox.checked);

    expect(autoCheckbox).toBeTruthy();
    expect(manualCheckbox).toBeTruthy();
    expect(document.getElementById("rough-plan-summary").textContent).toContain("voll verteilt");

    manualCheckbox.checked = true;
    manualCheckbox.dispatchEvent(new Event("change", { bubbles: true }));

    const selectedCheckboxes = Array.from(
      document.querySelectorAll('#rough-plan-grid input[type="checkbox"]')
    ).filter((checkbox) => checkbox.checked);
    expect(selectedCheckboxes.length).toBeGreaterThan(2);

    const toggledCheckbox = Array.from(
      document.querySelectorAll('#rough-plan-grid input[type="checkbox"]')
    ).find((checkbox) => checkbox.dataset.roughSlotKey === manualCheckbox.dataset.roughSlotKey);
    toggledCheckbox.checked = false;
    toggledCheckbox.dispatchEvent(new Event("change", { bubbles: true }));

    const afterUncheck = Array.from(
      document.querySelectorAll('#rough-plan-grid input[type="checkbox"]')
    ).find((checkbox) => checkbox.dataset.roughSlotKey === manualCheckbox.dataset.roughSlotKey);
    expect(afterUncheck.checked).toBe(false);
  });
});
