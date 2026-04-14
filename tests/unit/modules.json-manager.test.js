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

describe("modules/json-manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T10:00:00.000Z"));
    document.body.innerHTML = '<div id="json-status"></div>';

    if (!URL.createObjectURL) {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: vi.fn(() => "blob:mock-url"),
      });
    }

    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: vi.fn(),
      });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  function createManager(stateOverride = {}) {
    const state = {
      ...defaultData(),
      ...stateOverride,
      settings: { ...defaultData().settings, ...(stateOverride.settings || {}) },
      timer: { ...defaultData().timer, ...(stateOverride.timer || {}) },
    };

    const manager = createJsonManager({
      getState: () => state,
    });

    return { manager, state };
  }

  it("exportiert den Zustand als JSON-Datei", async () => {
    const createUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:json-export");
    const revokeUrlSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const { manager } = createManager({
      goals: [{ id: "g1", title: "Goal" }],
    });

    const result = manager.exportToFile();
    expect(result).toEqual({
      ok: true,
      status: "JSON-App-Stand als focusflow-export-2026-03-24.json exportiert.",
      fileName: "focusflow-export-2026-03-24.json",
    });

    const blobArg = createUrlSpy.mock.calls[0][0];
    const text = await blobArg.text();
    const parsed = JSON.parse(text);
    expect(parsed.goals).toHaveLength(1);
    expect(document.getElementById("json-status").textContent).toBe(
      "JSON-App-Stand als focusflow-export-2026-03-24.json exportiert."
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrlSpy).toHaveBeenCalledWith("blob:json-export");
  });

  it("importiert gueltiges JSON und fuehrt Sammlungen sowie Einstellungen zusammen", async () => {
    const { manager } = createManager({
      goals: [{ id: "g1", title: "Bestand", colorKey: "blue" }],
      settings: { activeView: "list", inactivityDays: 3 },
    });

    const file = {
      name: "backup.json",
      text: vi.fn(async () =>
        JSON.stringify({
          goals: [
            {
              id: "g1",
              title: "Import aktualisiert",
              startDate: "2026-03-20",
              workloadHours: 6.5,
              colorKey: "red",
            },
            { id: "g2", title: "Neu" },
          ],
          settings: { activeView: "calendar", inactivityDays: 5, themeMode: "dark" },
        })
      ),
    };

    const result = await manager.importFromFile(file);
    expect(result.ok).toBe(true);
    expect(result.state.goals).toHaveLength(2);
    expect(result.state.goals.find((goal) => goal.id === "g1").title).toBe("Import aktualisiert");
    expect(result.state.goals.find((goal) => goal.id === "g1")).toMatchObject({
      startDate: "2026-03-20",
      workloadHours: 6.5,
      colorKey: "red",
    });
    expect(result.state.goals.find((goal) => goal.id === "g2")).toMatchObject({
      startDate: "",
      workloadHours: 0,
      colorKey: "blue",
    });
    expect(result.state.settings.activeView).toBe("calendar");
    expect(result.state.settings.inactivityDays).toBe(5);
    expect(result.state.settings.themeMode).toBe("dark");
  });

  it("verarbeitet ungueltige oder fehlende Import-Dateipfade", async () => {
    const { manager } = createManager();

    const missing = await manager.importFromFile();
    expect(missing).toEqual({ ok: false, status: "Bitte zuerst eine JSON-Datei auswählen." });

    const invalidFile = {
      name: "broken.json",
      text: vi.fn(async () => "{not-json"),
    };
    const invalid = await manager.importFromFile(invalidFile);
    expect(invalid).toEqual({
      ok: false,
      status: "Import fehlgeschlagen. Bitte gültige JSON-Datei prüfen.",
    });
    expect(document.getElementById("json-status").textContent).toBe(
      "Import fehlgeschlagen. Bitte gültige JSON-Datei prüfen."
    );
  });

  it("importiert teilweise und meldet Warnungen fuer ungueltige Eintraege", async () => {
    const { manager } = createManager({ goals: [{ id: "g1", title: "Bestand" }] });

    const file = {
      name: "partial.json",
      text: vi.fn(async () =>
        JSON.stringify({
          goals: [{ id: "g2", title: "Neu" }, { title: "Ohne ID" }],
          roughPlans: "wrong",
          settings: { activeView: "unknown-view" },
        })
      ),
    };

    const result = await manager.importFromFile(file);
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.state.goals.find((goal) => goal.id === "g2")).toBeTruthy();
    expect(result.state.settings.activeView).toBe("list");
    expect(result.status).toContain("teilweise erfolgreich");
  });

  it("klemmt notificationLeadMinutes auf 90 wenn der Wert groesser ist", async () => {
    const { manager } = createManager();

    const file = {
      name: "settings.json",
      text: vi.fn(async () =>
        JSON.stringify({
          settings: { notificationLeadMinutes: 200 },
        })
      ),
    };

    const result = await manager.importFromFile(file);
    expect(result.ok).toBe(true);
    expect(result.state.settings.notificationLeadMinutes).toBe(90);
  });

  it("gibt ok:false zurueck wenn importiertes JSON ein Array statt Objekt ist", async () => {
    const { manager } = createManager();

    const file = {
      name: "array.json",
      text: vi.fn(async () => JSON.stringify([{ id: "g1" }])),
    };

    const result = await manager.importFromFile(file);
    expect(result.ok).toBe(false);
    expect(result.status).toContain("ungültig");
  });

  it("behaelt standardLearningTimes aus dem Import wenn angegeben", async () => {
    const { manager } = createManager();

    const customLearningTimes = {
      mon: { startTime: "07:00", endTime: "09:00" },
      tue: { startTime: "07:00", endTime: "09:00" },
      wed: { startTime: "", endTime: "" },
      thu: { startTime: "", endTime: "" },
      fri: { startTime: "", endTime: "" },
      sat: { startTime: "", endTime: "" },
      sun: { startTime: "", endTime: "" },
    };

    const file = {
      name: "full.json",
      text: vi.fn(async () =>
        JSON.stringify({
          settings: { standardLearningTimes: customLearningTimes },
        })
      ),
    };

    const result = await manager.importFromFile(file);
    expect(result.ok).toBe(true);
    expect(result.state.settings.standardLearningTimes).toEqual(customLearningTimes);
  });

  it("behaelt timer.start aus dem Import wenn es ein String ist", async () => {
    const { manager } = createManager();

    const file = {
      name: "timer.json",
      text: vi.fn(async () =>
        JSON.stringify({
          timer: { start: "2026-03-24T09:00:00.000Z" },
        })
      ),
    };

    const result = await manager.importFromFile(file);
    expect(result.ok).toBe(true);
    expect(result.state.timer.start).toBe("2026-03-24T09:00:00.000Z");
  });
});
