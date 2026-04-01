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

describe("modules/ics-manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T10:00:00.000Z"));
    document.body.innerHTML = '<div id="ics-status"></div>';

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
      detailPlans: [],
      roughPlans: [],
      ...stateOverride,
    };
    const dispatch = vi.fn();
    const manager = createIcsManager({
      getState: () => state,
      dispatch,
    });

    return { manager, dispatch };
  }

  it("sets status and handles import with missing file", async () => {
    const { manager, dispatch } = createManager();

    manager.setStatus("Bereit");
    expect(document.getElementById("ics-status").textContent).toBe("Bereit");

    const result = await manager.importFromFile();
    expect(result).toEqual({ ok: false, status: "Bitte zuerst eine .ics-Datei auswählen." });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("imports valid ICS events and dispatches mapped records", async () => {
    const { manager, dispatch } = createManager();
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:test-1",
      "DTSTART;VALUE=DATE:20260328",
      "SUMMARY:Sprint Review",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");

    const file = {
      name: "Plan.ics",
      text: vi.fn(async () => ics),
    };

    const result = await manager.importFromFile(file);

    expect(result).toMatchObject({
      ok: true,
      status: "1 Termin(e) aus Plan.ics importiert.",
      calendarMonth: "2026-03",
    });
    expect(document.getElementById("ics-status").textContent).toBe(
      "1 Termin(e) aus Plan.ics importiert."
    );
    expect(dispatch).toHaveBeenCalledTimes(1);

    const action = dispatch.mock.calls[0][0];
    expect(action.type).toBe("REPLACE_IMPORTED_EVENTS");
    expect(action.payload.sourceKey).toBe("file:plan.ics");
    expect(action.payload.events).toHaveLength(1);
    expect(action.payload.events[0]).toMatchObject({
      sourceKey: "file:plan.ics",
      sourceName: "Plan.ics",
      externalUid: "test-1",
      date: "2026-03-28",
      summary: "Sprint Review",
      createdAt: "2026-03-24T10:00:00.000Z",
    });
    expect(action.payload.events[0].id).toBeTruthy();
    expect(action.payload.events[0].sourceHash).toBe(hashText(ics));
  });

  it("handles import with no events and parser errors", async () => {
    const { manager, dispatch } = createManager();

    const emptyFile = {
      name: "empty.ics",
      text: vi.fn(async () => "BEGIN:VCALENDAR\nEND:VCALENDAR"),
    };
    const emptyResult = await manager.importFromFile(emptyFile);
    expect(emptyResult).toEqual({
      ok: false,
      status: "Keine importierbaren Termine in der Datei gefunden.",
    });
    expect(dispatch).not.toHaveBeenCalled();

    const brokenFile = {
      name: "broken.ics",
      text: vi.fn(async () => {
        throw new Error("read failed");
      }),
    };
    const brokenResult = await manager.importFromFile(brokenFile);
    expect(brokenResult).toEqual({
      ok: false,
      status: "Import fehlgeschlagen. Bitte gültige .ics-Datei prüfen.",
    });
    expect(document.getElementById("ics-status").textContent).toBe(
      "Import fehlgeschlagen. Bitte gültige .ics-Datei prüfen."
    );
  });

  it("exports app events to ICS file and handles empty export", () => {
    const createUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export");
    const revokeUrlSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const empty = createManager();
    const emptyResult = empty.manager.exportToFile();
    expect(emptyResult).toEqual({
      ok: false,
      status: "Keine App-Termine für den Export vorhanden.",
    });
    expect(document.getElementById("ics-status").textContent).toBe(
      "Keine App-Termine für den Export vorhanden."
    );

    const { manager } = createManager({
      detailPlans: [
        {
          id: "d1",
          date: "2026-03-25",
          topic: "Architektur",
          minutes: 60,
          milestone: "Kapitel 6",
        },
      ],
      roughPlans: [
        {
          id: "r1",
          date: "2026-03-24",
          hours: 2,
          note: "Review",
        },
      ],
    });

    const appendSpy = vi.spyOn(document.body, "appendChild");
    const result = manager.exportToFile();

    expect(result).toEqual({
      ok: true,
      status: "2 App-Termin(e) als lernzeitplaner-export-2026-03-24.ics exportiert.",
    });
    expect(document.getElementById("ics-status").textContent).toBe(
      "2 App-Termin(e) als lernzeitplaner-export-2026-03-24.ics exportiert."
    );
    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrlSpy).toHaveBeenCalledWith("blob:export");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledTimes(1);

    const blobArg = createUrlSpy.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
  });

  it("exports with fallback branches for missing ids, milestone and note", async () => {
    const createUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fallback");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const { manager } = createManager({
      detailPlans: [
        {
          date: "2026-03-24",
          topic: "Alpha",
          minutes: 30,
          milestone: "",
        },
      ],
      roughPlans: [
        {
          date: "2026-03-24",
          hours: 1,
          note: "",
        },
      ],
    });

    const result = manager.exportToFile();
    expect(result.ok).toBe(true);

    const blobArg = createUrlSpy.mock.calls[0][0];
    const text = await blobArg.text();

    expect(text).toContain("SUMMARY:Detailplanung: Alpha");
    expect(text).toContain("DESCRIPTION:30 Minuten");
    expect(text).toContain("SUMMARY:Grobplanung: 1 h");
    expect(text).toContain("DESCRIPTION:\r\nEND:VEVENT");
    expect(text).not.toContain("UID:undefined");

    const idxDetail = text.indexOf("SUMMARY:Detailplanung: Alpha");
    const idxRough = text.indexOf("SUMMARY:Grobplanung: 1 h");
    expect(idxDetail).toBeGreaterThan(-1);
    expect(idxRough).toBeGreaterThan(-1);
    expect(idxDetail).toBeLessThan(idxRough);
  });
});
