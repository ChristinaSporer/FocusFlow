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

describe("modules/calendar-manager", () => {
  function mountCalendarDom() {
    document.body.innerHTML = [
      '<div id="list-view"></div>',
      '<div id="calendar-view"></div>',
      '<button id="tab-list" type="button"></button>',
      '<button id="tab-calendar" type="button"></button>',
      '<div id="calendar-month-label"></div>',
      '<div id="calendar-grid"></div>',
    ].join("");
  }

  function createManager(stateOverride = {}) {
    const state = {
      detailPlans: [],
      roughPlans: [],
      trackedSessions: [],
      importedEvents: [],
      settings: {
        activeView: "list",
        calendarMonth: null,
      },
      ...stateOverride,
    };

    const dispatch = vi.fn((action) => {
      if (action.type === "SET_CALENDAR_MONTH") {
        state.settings.calendarMonth = action.payload.month;
      }
    });

    const manager = createCalendarManager({
      getState: () => state,
      dispatch,
    });

    return { manager, state, dispatch };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T10:00:00.000Z"));
    mountCalendarDom();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("liest und setzt den Kalendermonat", () => {
    const { manager, state, dispatch } = createManager();

    expect(manager.getCalendarMonth()).toBe("2026-03");

    state.settings.calendarMonth = "2026-04";
    expect(manager.getCalendarMonth()).toBe("2026-04");

    manager.setCalendarMonth("2026-05");
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_CALENDAR_MONTH",
      payload: { month: "2026-05" },
    });
    expect(state.settings.calendarMonth).toBe("2026-05");
  });

  it("rendert den Listen- und Kalender-Ansichtsstatus fuer alle Zweige", () => {
    const { manager, state } = createManager();

    state.settings.activeView = "list";
    manager.renderViewState();
    expect(document.getElementById("list-view").classList.contains("d-none")).toBe(false);
    expect(document.getElementById("calendar-view").classList.contains("d-none")).toBe(true);
    expect(document.getElementById("tab-list").getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("tab-calendar").getAttribute("aria-selected")).toBe("false");

    state.settings.activeView = "calendar";
    manager.renderViewState();
    expect(document.getElementById("list-view").classList.contains("d-none")).toBe(true);
    expect(document.getElementById("calendar-view").classList.contains("d-none")).toBe(false);
    expect(document.getElementById("tab-list").getAttribute("aria-selected")).toBe("false");
    expect(document.getElementById("tab-calendar").getAttribute("aria-selected")).toBe("true");

    state.settings.activeView = "unknown";
    manager.renderViewState();
    expect(document.getElementById("list-view").classList.contains("d-none")).toBe(false);
    expect(document.getElementById("calendar-view").classList.contains("d-none")).toBe(true);
  });

  it("bricht in renderCalendar frueh ab, wenn Grid oder Label fehlen", () => {
    document.body.innerHTML = '<div id="calendar-grid"></div>';
    const { manager } = createManager();
    expect(() => manager.renderCalendar()).not.toThrow();

    document.body.innerHTML = '<div id="calendar-month-label"></div>';
    expect(() => manager.renderCalendar()).not.toThrow();
  });

  it("rendert Ereignisse, Sortierung und Aussentage", () => {
    const { manager } = createManager({
      settings: { activeView: "calendar", calendarMonth: "2026-03" },
      goals: [
        {
          id: "g1",
          title: "SE Abgabe",
          targetDate: "2026-03-24",
          completed: false,
          milestones: [{ id: "m1", title: "Kapitel 1", done: false }],
        },
      ],
      detailPlans: [
        { id: "d1", date: "2026-03-24", topic: "Design", minutes: 45, milestone: "MS1" },
        { id: "d2", date: "2026-03-24", topic: "Alpha", minutes: 30, milestone: "" },
      ],
      roughPlans: [
        { id: "r1", date: "2026-03-24", hours: 2, note: "Plan" },
        { id: "r2", date: "2026-03-26", hours: 1, note: "Later" },
      ],
      trackedSessions: [
        { id: "t1", start: "2026-03-24T08:00:00.000Z", minutes: 20, note: "Track" },
      ],
      importedEvents: [{ id: "i1", date: "2026-03-24", summary: "Import", sourceName: "a.ics" }],
    });

    manager.renderCalendar();

    expect(document.getElementById("calendar-month-label").textContent.toLowerCase()).toContain(
      "märz"
    );

    const weekdayCells = document.querySelectorAll(".lz-calendar-weekday");
    expect(weekdayCells).toHaveLength(7);

    const dayCells = document.querySelectorAll(".lz-calendar-day");
    expect(dayCells).toHaveLength(42);
    expect(document.querySelectorAll(".lz-calendar-day.lz-outside").length).toBeGreaterThan(0);

    const allEvents = document.querySelectorAll(".lz-calendar-event");
    expect(allEvents.length).toBeGreaterThanOrEqual(4);
    expect(document.querySelector(".lz-calendar-event.lz-source-detail")).toBeTruthy();
    expect(document.querySelector(".lz-calendar-event.lz-source-import")).toBeTruthy();
    expect(document.querySelector(".lz-calendar-event.lz-source-goal")).toBeTruthy();

    const detailEventsOnDate = Array.from(
      document.querySelectorAll(".lz-calendar-event.lz-source-detail")
    )
      .filter(
        (element) =>
          element.parentElement.querySelector(".lz-calendar-day-number")?.textContent === "24"
      )
      .map((element) => element.textContent);
    expect(detailEventsOnDate).toEqual(["Alpha (30 Min)", "MS1 (45 Min)"]);

    const allEventsByDate = Array.from(document.querySelectorAll(".lz-calendar-event")).map(
      (element) => ({
        text: element.textContent,
        day: element.parentElement.querySelector(".lz-calendar-day-number")?.textContent,
      })
    );
    expect(allEventsByDate.some((item) => item.day === "24" && item.text === "SE Abgabe")).toBe(
      true
    );
  });
});
