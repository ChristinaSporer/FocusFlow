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

describe("modules/app-reducer", () => {
  it("verarbeitet Ziel- und Meilenstein-Aktionen", () => {
    let state = baseState();

    state = appReducer(state, {
      type: "GOAL_ADD",
      payload: { goal: { id: "g2", title: "New" } },
    });
    expect(state.goals).toHaveLength(2);

    state = appReducer(state, {
      type: "GOAL_UPDATE",
      payload: {
        goal: {
          id: "g2",
          title: "Updated",
          startDate: "2026-04-01",
          targetDate: "2026-04-10",
          workloadHours: 10.5,
          colorKey: "turquoise",
        },
      },
    });
    expect(state.goals.find((goal) => goal.id === "g2").title).toBe("Updated");
    expect(state.goals.find((goal) => goal.id === "g2")).toMatchObject({
      startDate: "2026-04-01",
      workloadHours: 10.5,
      colorKey: "turquoise",
    });

    state = appReducer(state, {
      type: "GOAL_ADD_MILESTONE",
      payload: { goalId: "g2", milestone: { id: "m2", title: "M2", done: false } },
    });
    expect(state.goals.find((goal) => goal.id === "g2").milestones).toHaveLength(1);

    state = appReducer(state, {
      type: "GOAL_TOGGLE_MILESTONE",
      payload: { goalId: "g2", milestoneId: "m2", done: true },
    });
    expect(state.goals.find((goal) => goal.id === "g2").milestones[0].done).toBe(true);

    state = appReducer(state, {
      type: "GOAL_UPDATE_MILESTONE",
      payload: { goalId: "g2", milestoneId: "m2", title: "M2-updated" },
    });
    expect(state.goals.find((goal) => goal.id === "g2").milestones[0].title).toBe("M2-updated");

    state = appReducer(state, {
      type: "GOAL_DELETE_MILESTONE",
      payload: { goalId: "g2", milestoneId: "m2" },
    });
    expect(state.goals.find((goal) => goal.id === "g2").milestones).toHaveLength(0);

    state = appReducer(state, {
      type: "GOAL_SET_COMPLETED",
      payload: { id: "g2", completed: true, completedAt: "2026-03-24T08:00:00Z" },
    });
    expect(state.goals.find((goal) => goal.id === "g2").completed).toBe(true);

    state = appReducer(state, { type: "GOAL_DELETE", payload: { id: "g2" } });
    expect(state.goals.find((goal) => goal.id === "g2")).toBeUndefined();
  });

  it("verarbeitet Planungs-, Timer-, Einstellungs- und Ersetzungs-Aktionen", () => {
    let state = baseState();

    state = appReducer(state, {
      type: "TOUCH_ACTIVITY",
      payload: { timestamp: "2026-03-24T08:10:00Z" },
    });
    expect(state.settings.lastReminderRun).toBe("2026-03-24T08:10:00Z");

    state = appReducer(state, {
      type: "ROUGH_ADD",
      payload: { plan: { id: "r2", date: "2026-04-10", hours: 1 } },
    });
    state = appReducer(state, { type: "ROUGH_DELETE", payload: { id: "r1" } });
    expect(state.roughPlans.map((plan) => plan.id)).toEqual(["r2"]);

    state = appReducer(state, {
      type: "DETAIL_ADD",
      payload: { plan: { id: "d2", date: "2026-04-11", minutes: 45, done: false } },
    });
    state = appReducer(state, {
      type: "DETAIL_UPDATE",
      payload: { id: "d2", update: { roughPlanId: "r1", goalId: "g1", milestoneId: "m1" } },
    });
    expect(state.detailPlans.find((plan) => plan.id === "d2")).toMatchObject({
      roughPlanId: "r1",
      goalId: "g1",
      milestoneId: "m1",
    });
    state = appReducer(state, { type: "DETAIL_SET_DONE", payload: { id: "d2", done: true } });
    expect(state.detailPlans.find((plan) => plan.id === "d2").done).toBe(true);

    state = appReducer(state, {
      type: "TIMER_SET_SELECTED_DETAIL_PLAN",
      payload: { detailPlanId: "d2" },
    });
    expect(state.timer.selectedDetailPlanId).toBe("d2");

    state = appReducer(state, { type: "DETAIL_DELETE", payload: { id: "d1" } });
    expect(state.detailPlans.find((plan) => plan.id === "d1")).toBeUndefined();

    state = appReducer(state, {
      type: "TIMER_START",
      payload: { start: "2026-03-24T08:00:00Z", selectedDetailPlanId: "d2" },
    });
    expect(state.timer.start).toBe("2026-03-24T08:00:00Z");
    expect(state.timer.selectedDetailPlanId).toBe("d2");

    state = appReducer(state, { type: "DETAIL_DELETE", payload: { id: "d2" } });
    expect(state.timer.selectedDetailPlanId).toBeNull();

    state = appReducer(state, {
      type: "TIMER_STOP_AND_STORE_SESSION",
      payload: { session: { id: "t2", minutes: 50 } },
    });
    expect(state.timer.start).toBeNull();
    expect(state.trackedSessions.find((session) => session.id === "t2")).toBeTruthy();

    state = appReducer(state, {
      type: "TRACKED_ADD",
      payload: { session: { id: "t3", minutes: 35, note: "manual" } },
    });
    expect(state.trackedSessions.find((session) => session.id === "t3")).toBeTruthy();

    state = appReducer(state, {
      type: "TRACKED_UPDATE",
      payload: { session: { id: "t3", minutes: 40, note: "updated" } },
    });
    expect(state.trackedSessions.find((session) => session.id === "t3")).toMatchObject({
      id: "t3",
      minutes: 40,
      note: "updated",
    });

    state = appReducer(state, { type: "TRACKED_DELETE", payload: { id: "t1" } });
    expect(state.trackedSessions.find((session) => session.id === "t1")).toBeUndefined();

    state = appReducer(state, { type: "SET_CALENDAR_MONTH", payload: { month: "2026-04" } });
    state = appReducer(state, { type: "SET_ACTIVE_VIEW", payload: { view: "calendar" } });
    state = appReducer(state, { type: "SET_INACTIVITY_DAYS", payload: { days: 7 } });
    state = appReducer(state, { type: "SET_NOTIFICATION_ENABLED", payload: { enabled: true } });
    state = appReducer(state, { type: "SET_THEME_MODE", payload: { themeMode: "dark" } });

    expect(state.settings).toMatchObject({
      calendarMonth: "2026-04",
      activeView: "calendar",
      inactivityDays: 7,
      notificationEnabled: true,
      themeMode: "dark",
    });

    state = appReducer(state, {
      type: "REPLACE_IMPORTED_EVENTS",
      payload: {
        sourceKey: "a",
        events: [{ id: "i2", sourceKey: "a", summary: "new" }],
      },
    });
    expect(state.importedEvents).toEqual([{ id: "i2", sourceKey: "a", summary: "new" }]);

    const replaced = appReducer(state, {
      type: "REPLACE_STATE",
      payload: { state: { ...defaultData(), marker: true } },
    });
    expect(replaced.marker).toBe(true);

    const unchanged = appReducer(state, { type: "UNKNOWN_ACTION" });
    expect(unchanged).toBe(state);
  });

  it("aktualisiert Grobplanungen mit ROUGH_UPDATE", () => {
    let state = baseState();

    state = appReducer(state, {
      type: "ROUGH_UPDATE",
      payload: {
        id: "r1",
        update: { date: "2026-04-01", hours: 5, note: "Updated", goalId: "g1" },
      },
    });

    const plan = state.roughPlans.find((p) => p.id === "r1");
    expect(plan).toMatchObject({
      id: "r1",
      date: "2026-04-01",
      hours: 5,
      note: "Updated",
      goalId: "g1",
    });

    state = appReducer(state, {
      type: "ROUGH_UPDATE",
      payload: { id: "r1", update: { goalId: null } },
    });
    expect(state.roughPlans.find((p) => p.id === "r1").goalId).toBeNull();

    const unchanged = appReducer(state, {
      type: "ROUGH_UPDATE",
      payload: { id: "unknown", update: { hours: 99 } },
    });
    expect(unchanged).toEqual(state);
  });
});
