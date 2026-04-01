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

describe("modules/pomodoro-manager", () => {
  let actions;
  let pomodoro;
  beforeEach(() => {
    actions = [];
    pomodoro = createPomodoroManager({
      startTimer: () => actions.push("startTimer"),
      stopTimer: (opts) => {
        actions.push(["stopTimer", opts]);
        actions.push("stopTimer");
      },
      onRender: () => actions.push("onRender"),
      getState: () => ({ pomodoro: {} }),
      dispatch: (a) => actions.push(["dispatch", a]),
    });
  });

  it("start() aktiviert Pomodoro und ruft startTimer auf", async () => {
    await pomodoro.start();
    expect(actions).toContain("startTimer");
    expect(actions).toContain("onRender");
  });

  it("pause() deaktiviert Pomodoro und stoppt Countdown", () => {
    // Set Pomodoro to active and start first, so pause() will run and onRender is called
    pomodoro.phase = "work";
    pomodoro.active = false;
    pomodoro.startTimer = () => actions.push("startTimer");
    pomodoro.onRender = () => actions.push("onRender");
    return pomodoro.start().then(() => {
      actions.length = 0;
      pomodoro.pause();
      expect(actions).toContain("onRender");
    });
  });

  it("skipPhase() erhöht pomodorosCompleted und setzt Phase", () => {
    // Set phase to work and active to test branch
    pomodoro.phase = "work";
    pomodoro.pomodorosCompleted = 0;
    pomodoro.active = true;
    pomodoro.skipPhase();
    // Should dispatch and call stopTimer
    expect(actions.some((a) => Array.isArray(a) && a[0] === "dispatch")).toBe(true);
    expect(actions.some((a) => Array.isArray(a) && a[0] === "stopTimer")).toBe(true);
    expect(actions).toContain("onRender");
  });

  it("skipPhase() wechselt nach dem vierten Pomodoro in die lange Pause", () => {
    const phaseActions = [];
    const pomodoroWithProgress = createPomodoroManager({
      startTimer: () => {},
      stopTimer: (opts) => phaseActions.push(["stopTimer", opts]),
      onRender: () => phaseActions.push("onRender"),
      getState: () => ({
        pomodoro: {
          active: false,
          phase: "work",
          pomodorosCompleted: 3,
          secondsLeft: 25 * 60,
          phaseStartedAt: null,
        },
      }),
      dispatch: (action) => phaseActions.push(["dispatch", action]),
    });

    pomodoroWithProgress.syncFromState();
    phaseActions.length = 0;
    pomodoroWithProgress.skipPhase();

    const saveAction = phaseActions.find(
      (entry) => Array.isArray(entry) && entry[0] === "dispatch"
    )?.[1];

    expect(saveAction).toMatchObject({
      type: "POMODORO_SAVE",
      payload: expect.objectContaining({
        phase: "long-break",
        pomodorosCompleted: 4,
        active: false,
      }),
    });
    expect(phaseActions.some((entry) => Array.isArray(entry) && entry[0] === "stopTimer")).toBe(
      true
    );
    expect(phaseActions).toContain("onRender");
  });

  it("reset() setzt alles zurück", () => {
    pomodoro.reset();
    expect(actions.some((a) => Array.isArray(a) && a[0] === "dispatch")).toBe(true);
    expect(actions).toContain("onRender");
  });

  it("cancel() setzt Pomodoro zurück ohne Tracking", () => {
    // Set state to ensure persist/dispatch is called
    pomodoro.active = true;
    pomodoro.phase = "work";
    pomodoro.cancel();
    expect(actions.some((a) => Array.isArray(a) && a[0] === "dispatch")).toBe(true);
    expect(actions).toContain("onRender");
  });

  it("saveAndReset() ruft save und reset", () => {
    // Patch save/reset to spies for coverage
    pomodoro.phase = "work";
    pomodoro.phaseStartedAt = new Date().toISOString();
    pomodoro.active = true;
    pomodoro.getState = () => ({ pomodoro: {} });
    actions.length = 0;
    pomodoro.saveAndReset();
    // save ruft stopTimer und onRender, reset ruft dispatch und onRender
    expect(actions.some((a) => Array.isArray(a) && a[0] === "stopTimer")).toBe(true);
    expect(actions.some((a) => Array.isArray(a) && a[0] === "dispatch")).toBe(true);
    expect(actions).toContain("onRender");
  });
});
