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
    expect(
      document.getElementById("timer-start").classList.contains("d-none")
    ).toBe(false);

    // Resume (Start-Button erneut klicken wenn pausiert)
    document.getElementById("timer-start").click();
    expect(deps.startTimer).toHaveBeenCalledTimes(2);
    expect(deps.startTimer).toHaveBeenLastCalledWith(
      expect.objectContaining({ resume: true })
    );
  });
});
