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

describe("modules/timer-manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T10:00:00.000Z"));
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  function setupTimerManager(initialState) {
    const state = initialState || { timer: { start: null, selectedDetailPlanId: null } };
    const dispatch = vi.fn((action) => {
      if (action.type === "TIMER_START") {
        state.timer.start = action.payload.start;
        state.timer.selectedDetailPlanId =
          action.payload.selectedDetailPlanId ?? state.timer.selectedDetailPlanId;
      }
      if (action.type === "TIMER_STOP_AND_STORE_SESSION") {
        state.timer.start = null;
      }
      if (action.type === "TIMER_SET_SELECTED_DETAIL_PLAN") {
        state.timer.selectedDetailPlanId = action.payload.detailPlanId;
      }
    });

    const manager = createTimerManager({
      getState: () => state,
      dispatch,
      onActivity: vi.fn(),
      onRenderAll: vi.fn(),
      nowIso: vi.fn(() => "2026-03-24T10:00:00.000Z"),
    });

    return { manager, state, dispatch };
  }

  it("rendert eine Null-Uhr, wenn kein Timer aktiv ist", () => {
    document.body.innerHTML = '<div id="timer-display"></div>';
    const { manager } = setupTimerManager();

    manager.renderTimer();
    expect(document.getElementById("timer-display").textContent).toBe("00:00:00");
  });

  it("ignoriert den Render-Aufruf, wenn die Timer-Anzeige fehlt", () => {
    const { manager } = setupTimerManager();
    expect(() => manager.renderTimer()).not.toThrow();
  });

  it("startet den Timer, aktualisiert die Anzeige und blockiert doppeltes Starten", () => {
    document.body.innerHTML = '<div id="timer-display"></div>';
    const { manager, dispatch } = setupTimerManager();

    manager.startTimer();
    manager.startTimer();

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "TIMER_START",
      payload: { start: "2026-03-24T10:00:00.000Z", selectedDetailPlanId: null },
    });

    vi.advanceTimersByTime(1000);
    expect(document.getElementById("timer-display").textContent).toBe("00:00:01");
  });

  it("stoppt den Timer, speichert die Session und leert die Notiz", () => {
    document.body.innerHTML =
      '<div id="timer-display"></div><input id="track-note" value="  Deep Work  ">';

    const onActivity = vi.fn();
    const onRenderAll = vi.fn();
    const state = { timer: { start: "2026-03-24T09:57:30.000Z", selectedDetailPlanId: "d1" } };

    const dispatch = vi.fn((action) => {
      if (action.type === "TIMER_STOP_AND_STORE_SESSION") {
        state.timer.start = null;
      }
    });

    const manager = createTimerManager({
      getState: () => state,
      dispatch,
      onActivity,
      onRenderAll,
      nowIso: vi.fn(() => "2026-03-24T10:00:00.000Z"),
    });

    manager.stopTimer();

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0][0];
    expect(action.type).toBe("TIMER_STOP_AND_STORE_SESSION");
    expect(action.payload.session.note).toBe("Deep Work");
    expect(action.payload.session.minutes).toBe(3);
    expect(action.payload.session.detailPlanId).toBe("d1");
    expect(action.payload.session.id).toBeTruthy();
    expect(document.getElementById("track-note").value).toBe("");
    expect(onActivity).toHaveBeenCalledTimes(1);
    expect(onRenderAll).toHaveBeenCalledTimes(1);
  });

  it("synchronisiert das Intervall aus dem Zustand und unterstuetzt dispose", () => {
    document.body.innerHTML = '<div id="timer-display"></div>';
    const state = { timer: { start: "2026-03-24T09:59:58.000Z", selectedDetailPlanId: null } };

    const manager = createTimerManager({
      getState: () => state,
      dispatch: vi.fn(),
      onActivity: vi.fn(),
      onRenderAll: vi.fn(),
      nowIso: vi.fn(() => "2026-03-24T10:00:00.000Z"),
    });

    manager.syncFromState();
    vi.advanceTimersByTime(2000);
    expect(document.getElementById("timer-display").textContent).toBe("00:00:04");

    state.timer.start = null;
    manager.syncFromState();
    expect(document.getElementById("timer-display").textContent).toBe("00:00:00");

    manager.dispose();
    vi.advanceTimersByTime(5000);
    expect(document.getElementById("timer-display").textContent).toBe("00:00:00");
  });

  it("wechselt den laufenden Timer, wenn er aus einem anderen Detailplan gestartet wird", () => {
    document.body.innerHTML =
      '<div id="timer-display"></div><input id="track-note" value="Deep Work">';
    const onActivity = vi.fn();
    const onRenderAll = vi.fn();
    const state = { timer: { start: "2026-03-24T09:58:00.000Z", selectedDetailPlanId: "d1" } };

    const dispatch = vi.fn((action) => {
      if (action.type === "TIMER_STOP_AND_STORE_SESSION") {
        state.timer.start = null;
      }
      if (action.type === "TIMER_SET_SELECTED_DETAIL_PLAN") {
        state.timer.selectedDetailPlanId = action.payload.detailPlanId;
      }
      if (action.type === "TIMER_START") {
        state.timer.start = action.payload.start;
        state.timer.selectedDetailPlanId = action.payload.selectedDetailPlanId;
      }
    });

    const manager = createTimerManager({
      getState: () => state,
      dispatch,
      onActivity,
      onRenderAll,
      nowIso: vi.fn(() => "2026-03-24T10:00:00.000Z"),
    });

    manager.startTimerForDetailPlan("d2", "Neues Detail");

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "TIMER_STOP_AND_STORE_SESSION",
        payload: expect.objectContaining({
          session: expect.objectContaining({
            detailPlanId: "d1",
          }),
        }),
      })
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "TIMER_SET_SELECTED_DETAIL_PLAN",
      payload: { detailPlanId: "d2" },
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "TIMER_START",
      payload: { start: "2026-03-24T10:00:00.000Z", selectedDetailPlanId: "d2" },
    });
    expect(document.getElementById("track-note").value).toBe("");
    expect(state.timer.start).toBe("2026-03-24T10:00:00.000Z");
    expect(state.timer.selectedDetailPlanId).toBe("d2");
    expect(onRenderAll).toHaveBeenCalled();
    expect(onActivity).toHaveBeenCalled();
  });

  it("fuegt eine manuell erfasste Session mit Detail und Notiz hinzu", () => {
    const onActivity = vi.fn();
    const onRenderAll = vi.fn();
    const state = { timer: { start: null, selectedDetailPlanId: null } };
    const dispatch = vi.fn();

    const manager = createTimerManager({
      getState: () => state,
      dispatch,
      onActivity,
      onRenderAll,
      nowIso: vi.fn(() => "2026-03-24T10:00:00.000Z"),
    });

    const ok = manager.addManualSession({
      date: "2026-03-24",
      minutes: 40,
      note: "Manuell",
      detailPlanId: "d1",
    });

    expect(ok).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "TRACKED_ADD",
        payload: expect.objectContaining({
          session: expect.objectContaining({
            minutes: 40,
            note: "Manuell",
            detailPlanId: "d1",
          }),
        }),
      })
    );
    expect(onActivity).toHaveBeenCalledTimes(1);
    expect(onRenderAll).toHaveBeenCalledTimes(1);
  });

  it("aktualisiert eine bestehende getrackte Session", () => {
    const onActivity = vi.fn();
    const onRenderAll = vi.fn();
    const state = {
      timer: { start: null, selectedDetailPlanId: null },
      trackedSessions: [
        {
          id: "t1",
          start: "2026-03-24T12:00:00.000Z",
          end: "2026-03-24T12:25:00.000Z",
          minutes: 25,
          note: "Initial",
          detailPlanId: null,
        },
      ],
    };
    const dispatch = vi.fn();

    const manager = createTimerManager({
      getState: () => state,
      dispatch,
      onActivity,
      onRenderAll,
      nowIso: vi.fn(() => "2026-03-24T10:00:00.000Z"),
    });

    const ok = manager.updateTrackedSession({
      id: "t1",
      date: "2026-03-25",
      minutes: 40,
      note: "Updated",
      detailPlanId: "d1",
    });

    expect(ok).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "TRACKED_UPDATE",
        payload: expect.objectContaining({
          session: expect.objectContaining({
            id: "t1",
            minutes: 40,
            note: "Updated",
            detailPlanId: "d1",
          }),
        }),
      })
    );
    expect(onActivity).toHaveBeenCalledTimes(1);
    expect(onRenderAll).toHaveBeenCalledTimes(1);
  });
});

// --- Pomodoro Manager Tests ---
