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

describe("modules/state-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads defaults and handles invalid persisted JSON", () => {
    expect(loadState()).toMatchObject(defaultData());

    localStorage.setItem(STORAGE_KEY, "not-json");
    expect(loadState()).toMatchObject(defaultData());
  });

  it("loads and normalizes persisted shape", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        goals: [{ id: "g1" }],
        importedEvents: "bad-shape",
        settings: { activeView: "calendar" },
      })
    );

    const loaded = loadState();
    expect(loaded.goals).toHaveLength(1);
    expect(loaded.importedEvents).toEqual([]);
    expect(loaded.settings.activeView).toBe("calendar");
    expect(loaded.settings.themeMode).toBe("auto");
    expect(loaded.timer.start).toBeNull();
    expect(loaded.timer.selectedDetailPlanId).toBeNull();
  });

  it("persists state and supports store methods", () => {
    const initial = defaultData();
    const reducer = vi.fn((state, action) => ({ ...state, lastAction: action.type }));
    const store = createStore(initial, reducer);

    expect(store.getState()).toBe(initial);

    const replaced = store.replace({ ...defaultData(), marker: "replaced" });
    expect(replaced.marker).toBe("replaced");

    const dispatched = store.dispatch({ type: "TEST_ACTION" });
    expect(reducer).toHaveBeenCalledTimes(1);
    expect(dispatched.lastAction).toBe("TEST_ACTION");

    store.persist();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved.lastAction).toBe("TEST_ACTION");

    persistState({ custom: true });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual({ custom: true });
  });
});
