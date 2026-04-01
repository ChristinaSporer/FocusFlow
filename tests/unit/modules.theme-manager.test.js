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


  describe("modules/theme-manager", () => {
    const originalMatchMedia = window.matchMedia;

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
      document.documentElement.removeAttribute("data-bs-theme");
    });

    it("normalizes mode values", () => {
      expect(normalizeThemeMode("light")).toBe("light");
      expect(normalizeThemeMode("x")).toBe("auto");
    });

    it("applies fallback when matchMedia is unavailable", () => {
      window.matchMedia = undefined;
      const manager = createThemeManager({ getThemeMode: () => "light" });

      manager.initSystemTheme();
      expect(document.documentElement.getAttribute("data-bs-theme")).toBe("light");
    });

    it("uses matchMedia listeners and auto resolution", () => {
      const addEventListener = vi.fn();
      const removeEventListener = vi.fn();
      const query = {
        matches: true,
        addEventListener,
        removeEventListener,
      };

      window.matchMedia = vi.fn(() => query);
      const getThemeMode = vi.fn(() => "auto");
      const manager = createThemeManager({ getThemeMode });

      manager.initSystemTheme();
      expect(window.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
      expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
      expect(document.documentElement.getAttribute("data-bs-theme")).toBe("dark");

      manager.applyTheme("invalid");
      expect(document.documentElement.getAttribute("data-bs-theme")).toBe("dark");

      manager.dispose();
      expect(removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("falls back to addListener/removeListener APIs", () => {
      const addListener = vi.fn();
      const removeListener = vi.fn();
      const query = {
        matches: false,
        addListener,
        removeListener,
      };

      window.matchMedia = vi.fn(() => query);
      const manager = createThemeManager({ getThemeMode: () => "auto" });

      manager.initSystemTheme();
      expect(addListener).toHaveBeenCalledWith(expect.any(Function));

      manager.dispose();
      expect(removeListener).toHaveBeenCalledWith(expect.any(Function));
    });
  });

