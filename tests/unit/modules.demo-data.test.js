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

describe("modules/demo-data", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("erstellt eine deterministische Demodaten-Struktur mit relativen Planungsdaten", () => {
    const state = buildDemoState({ themeMode: "dark" });

    expect(state.goals).toHaveLength(4);
    expect(state.roughPlans).toHaveLength(3);
    expect(state.detailPlans).toHaveLength(6);
    expect(state.trackedSessions).toHaveLength(6);
    expect(state.importedEvents).toEqual([]);
    expect(state.timer).toEqual({ start: null });

    expect(state.goals[0]).toMatchObject({
      title: "Modul Software Engineering abschließen",
      targetDate: "2026-04-07",
      startDate: "2026-03-29",
      workloadHours: 50,
      colorKey: "dark-blue",
      completed: false,
      completedAt: null,
    });
    expect(state.goals[0].milestones).toHaveLength(2);

    expect(state.goals[1]).toMatchObject({
      title: "Klausurvorbereitung Mathematik",
      targetDate: "2026-03-23",
      workloadHours: 40,
      completed: true,
      completedAt: "2026-03-24T10:00:00.000Z",
    });

    state.roughPlans.forEach((plan) => {
      expect(typeof plan.startDate).toBe("string");
      expect(typeof plan.totalWorkloadHours).toBe("number");
      expect(Array.isArray(plan.plannedDays)).toBe(true);
      expect(plan.plannedDays.length).toBeGreaterThan(0);
    });

    expect(state.detailPlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ topic: "Anforderungsanalyse durcharbeiten" }),
        expect.objectContaining({ topic: "User Stories und Akzeptanzkriterien" }),
        expect.objectContaining({ topic: "Altklausur 2019 \u2013 Analysis" }),
        expect.objectContaining({ topic: "Lineare Algebra Formeln zusammenfassen" }),
        expect.objectContaining({ topic: "Datensatz explorieren und bereinigen" }),
        expect.objectContaining({ topic: "Feature Engineering und Modellauswahl" }),
      ])
    );

    state.trackedSessions.forEach((session) => {
      expect(typeof session.start).toBe("string");
      expect(typeof session.end).toBe("string");
      expect(typeof session.note).toBe("string");
      expect(session.id).toBeTruthy();
    });

    expect(state.settings).toEqual({
      inactivityDays: 3,
      lastReminderRun: "2026-03-24T10:00:00.000Z",
      notificationEnabled: false,
      activeView: "list",
      calendarMonth: "2026-03",
      themeMode: "dark",
    });
  });

  it("erstellt Demodaten ohne themeMode und setzt endTime auf Basis von startTime", () => {
    const state = buildDemoState({});

    // themeMode darf nicht gesetzt sein (undefined → kein themeMode-Wert)
    expect(state.settings.themeMode).toBeUndefined();

    // Jeder DetailPlan soll eine gueltige endTime haben (addMinutesToTime normal path)
    state.detailPlans.forEach((plan) => {
      expect(typeof plan.startTime).toBe("string");
      expect(typeof plan.endTime).toBe("string");
      if (plan.startTime) {
        expect(plan.endTime).toMatch(/^\d{2}:\d{2}$/);
      }
    });

    // roughPlans haben plannedDays
    state.roughPlans.forEach((plan) => {
      expect(Array.isArray(plan.plannedDays)).toBe(true);
    });
  });

  it("faellt auf das Startdatum zurueck wenn die Verteilung keine Tage liefert", async () => {
    vi.resetModules();
    vi.doMock("../../modules/planning-utils.js", async () => {
      const actual = await vi.importActual("../../modules/planning-utils.js");
      return {
        ...actual,
        distributeGoalWorkload: vi.fn(() => ({
          days: [],
          candidateSlots: [],
          remainingMinutes: 120,
          projectedEndDate: "",
        })),
      };
    });

    const { buildDemoState: buildDemoStateMitLeeremPlan } =
      await import("../../modules/demo-data.js");
    const state = buildDemoStateMitLeeremPlan({ themeMode: "light" });

    expect(state.goals.map((goal) => goal.targetDate)).toEqual([
      "2026-03-29",
      "2026-03-14",
      "2026-04-13",
      "2026-04-03",
    ]);
    expect(state.roughPlans.every((plan) => plan.plannedDays.length === 0)).toBe(true);
    expect(state.detailPlans.every((plan) => plan.startTime === "08:00")).toBe(true);

    vi.doUnmock("../../modules/planning-utils.js");
    vi.resetModules();
  });
});
