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
    expect(state.roughPlans).toHaveLength(4);
    expect(state.detailPlans).toHaveLength(4);
    expect(state.trackedSessions).toHaveLength(4);
    expect(state.importedEvents).toEqual([]);
    expect(state.timer).toEqual({ start: null });

    expect(state.goals[0]).toMatchObject({
      title: "Modul Software Engineering abschließen",
      targetDate: "2026-04-13",
      completed: false,
      completedAt: null,
    });
    expect(state.goals[0].milestones).toHaveLength(2);

    expect(state.goals[1]).toMatchObject({
      title: "Klausurvorbereitung Mathematik",
      targetDate: "2026-04-03",
      completed: true,
      completedAt: "2026-03-24T10:00:00.000Z",
    });

    // Teste nur auf arrayContaining, da Demo-Daten dynamisch sind
    expect(state.roughPlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ note: "Wiederholung UML" }),
        expect.objectContaining({ note: "Altklausuren" }),
        expect.objectContaining({ note: "Datenaufbereitung" }),
        expect.objectContaining({ note: "Englisch Hörverstehen" }),
      ])
    );

    expect(state.roughPlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ note: "Wiederholung UML" }),
        expect.objectContaining({ note: "Altklausuren" }),
        expect.objectContaining({ note: "Datenaufbereitung" }),
        expect.objectContaining({ note: "Englisch Hörverstehen" }),
      ])
    );

    expect(state.detailPlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ topic: "User Stories" }),
        expect.objectContaining({ topic: "Testmethoden" }),
        expect.objectContaining({ topic: "Daten bereinigen" }),
        expect.objectContaining({ topic: "Listening Comprehension" }),
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
});
