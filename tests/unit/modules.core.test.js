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

describe("modules/ics-utils", () => {
  it("normalizes ICS text and reads properties", () => {
    const raw = "BEGIN:VCALENDAR\r\nSUMMARY: A\r\n folded\r\nEND:VCALENDAR";
    const normalized = normalizeIcs(raw);

    expect(normalized).toContain("SUMMARY: Afolded");

    const lines = ["DTSTART;VALUE=DATE:20260312", "SUMMARY: Focus"];
    expect(getIcsProp(lines, "DTSTART")).toBe("20260312");
    expect(getIcsProp(lines, "SUMMARY")).toBe("Focus");
    expect(getIcsProp(lines, "MISSING")).toBe("");
  });

  it("parses ICS dates and rejects invalid input", () => {
    expect(parseIcsDate("20260312")).toBe("2026-03-12");
    expect(parseIcsDate("20260312T000000Z")).toBe("2026-03-12");
    expect(parseIcsDate("not-a-date")).toBeNull();
    expect(parseIcsDate("")).toBeNull();
  });

  it("parses, deduplicates and serializes ICS events", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:abc",
      "DTSTART;VALUE=DATE:20260320",
      "SUMMARY:Exam",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:abc",
      "DTSTART;VALUE=DATE:20260320",
      "SUMMARY:Exam",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:def",
      "DTSTART:20260321T120000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");

    const parsed = parseIcsEvents(ics);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ externalUid: "abc", date: "2026-03-20", summary: "Exam" });
    expect(parsed[1]).toMatchObject({ externalUid: "def", summary: "Importierter Termin" });

    const exported = serializeEventsToIcs([
      { uid: "u1", date: "2026-03-22", summary: "A, B", description: "Line1\nLine2" },
    ]);

    expect(exported).toContain("BEGIN:VCALENDAR");
    expect(exported).toContain("UID:u1");
    expect(exported).toContain("SUMMARY:A\\, B");
    expect(exported).toContain("DESCRIPTION:Line1\\nLine2");
    expect(exported).toContain("DTSTART;VALUE=DATE:20260322");
    expect(exported).toContain("DTEND;VALUE=DATE:20260323");

    expect(escapeIcsText("A;B,C\\D\nE")).toBe("A\\;B\\,C\\\\D\\nE");
    expect(toIcsDate("2026-03-09T08:00:00Z")).toBe("20260309");
    expect(toIcsDateTimeUtc("2026-03-09T08:00:00Z")).toMatch(/^20260309T080000Z$/);
    expect(hashText("same")).toBe(hashText("same"));
    expect(hashText("same")).not.toBe(hashText("other"));
  });

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

  it("exports state as JSON file", async () => {
    const createUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:json-export");
    const revokeUrlSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const { manager } = createManager({
      goals: [{ id: "g1", title: "Goal" }],
    });

    const result = manager.exportToFile();
    expect(result).toEqual({
      ok: true,
      status: "Backup als focusflow-backup-2026-03-24.json exportiert.",
      fileName: "focusflow-backup-2026-03-24.json",
    });

    const blobArg = createUrlSpy.mock.calls[0][0];
    const text = await blobArg.text();
    const parsed = JSON.parse(text);
    expect(parsed.goals).toHaveLength(1);
    expect(document.getElementById("json-status").textContent).toBe(
      "Backup als focusflow-backup-2026-03-24.json exportiert."
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrlSpy).toHaveBeenCalledWith("blob:json-export");
  });

  it("imports valid JSON and merges collections/settings", async () => {
    const { manager } = createManager({
      goals: [{ id: "g1", title: "Bestand" }],
      settings: { activeView: "list", inactivityDays: 3 },
    });

    const file = {
      name: "backup.json",
      text: vi.fn(async () =>
        JSON.stringify({
          goals: [
            { id: "g1", title: "Import aktualisiert" },
            { id: "g2", title: "Neu" },
          ],
          settings: { activeView: "backup", inactivityDays: 5, themeMode: "dark" },
        })
      ),
    };

    const result = await manager.importFromFile(file);
    expect(result.ok).toBe(true);
    expect(result.state.goals).toHaveLength(2);
    expect(result.state.goals.find((goal) => goal.id === "g1").title).toBe("Import aktualisiert");
    expect(result.state.settings.activeView).toBe("backup");
    expect(result.state.settings.inactivityDays).toBe(5);
    expect(result.state.settings.themeMode).toBe("dark");
  });

  it("handles invalid/missing import file paths", async () => {
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

  it("imports partially and reports warnings for invalid records", async () => {
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
});

describe("modules/form-handlers", () => {
  function mountFormHandlersDom() {
    document.body.innerHTML = [
      '<form id="goal-form"><button id="goal-submit" type="submit">X</button></form>',
      '<input id="goal-edit-id" value="preset">',
      '<input id="goal-title" value="">',
      '<input id="goal-date" value="">',
      '<textarea id="goal-description"></textarea>',
      '<button id="goal-cancel-edit" type="button" class="d-none"></button>',
      '<form id="rough-form"><button id="rough-submit" type="submit">X</button></form>',
      '<input id="rough-edit-id" value="">',
      '<input id="rough-week" value="">',
      '<input id="rough-hours" value="">',
      '<input id="rough-note" value="">',
      '<select id="rough-goal"><option value="">Kein Ziel</option></select>',
      '<button id="rough-cancel-edit" type="button" class="d-none"></button>',
      '<form id="detail-form"></form>',
      '<input id="detail-date" value="">',
      '<input id="detail-minutes" value="">',
      '<input id="detail-topic" value="">',
      '<input id="detail-milestone" value="">',
      '<input id="month-select" value="2026-03">',
      '<button id="tab-list" data-view="list" type="button"></button>',
      '<button id="tab-calendar" data-view="calendar" type="button"></button>',
      '<button id="tab-backup" data-view="backup" type="button"></button>',
      '<button id="calendar-prev" type="button"></button>',
      '<button id="calendar-next" type="button"></button>',
      '<button id="timer-start" type="button"></button>',
      '<button id="timer-stop" type="button"></button>',
      '<select id="track-detail-select"><option value="">Kein Detail</option><option value="d1">D1</option></select>',
      '<input id="track-edit-id" value="">',
      '<form id="track-manual-form"><input id="track-manual-date" value="2026-03-24"><input id="track-manual-minutes" value=""><button id="track-manual-submit" type="submit">save</button></form>',
      '<button id="track-cancel-edit" type="button" class="d-none"></button>',
      '<input id="track-note" value="">',
      '<button id="load-demo" type="button"></button>',
      '<input type="radio" name="theme-mode" id="theme-mode-auto" value="auto">',
      '<input type="radio" name="theme-mode" id="theme-mode-light" value="light">',
      '<input type="radio" name="theme-mode" id="theme-mode-dark" value="dark">',
      '<button id="ics-import" type="button"></button>',
      '<input id="ics-file" type="file">',
      '<button id="ics-export" type="button"></button>',
      '<button id="json-import" type="button"></button>',
      '<input id="json-file" type="file">',
      '<button id="json-export" type="button"></button>',
      '<button id="reset-data" type="button"></button>',
    ].join("");
  }

  function setupHandlers(overrides = {}) {
    mountFormHandlersDom();
    const deps = {
      dispatch: vi.fn(),
      renderAll: vi.fn(),
      touchActivity: vi.fn(),
      defaultData: vi.fn(() => ({ ok: true })),
      setInitialValues: vi.fn(),
      loadDemoData: vi.fn(),
      normalizeThemeMode: vi.fn((value) => value),
      applyTheme: vi.fn(),
      getCalendarMonth: vi.fn(() => "2026-03"),
      setCalendarMonth: vi.fn(),
      renderCalendar: vi.fn(),
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      setSelectedTimerDetailPlan: vi.fn(),
      addManualTrackedSession: vi.fn(() => true),
      updateTrackedSession: vi.fn(() => true),
      importIcsFile: vi.fn(async () => ({ ok: false })),
      exportIcsFile: vi.fn(),
      importJsonFile: vi.fn(async () => ({ ok: false })),
      exportJsonFile: vi.fn(),
      ...overrides,
    };

    const api = initFormHandlers(deps);
    return { deps, api };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("resets and starts goal edit via exposed API", () => {
    const { api } = setupHandlers();

    expect(document.getElementById("goal-submit").textContent).toBe("Hinzufügen");
    expect(document.getElementById("goal-cancel-edit").classList.contains("d-none")).toBe(true);

    api.startGoalEdit({
      id: "g1",
      title: "Neues Ziel",
      targetDate: "2026-03-30",
      description: "Beschreibung",
    });

    expect(document.getElementById("goal-edit-id").value).toBe("g1");
    expect(document.getElementById("goal-title").value).toBe("Neues Ziel");
    expect(document.getElementById("goal-date").value).toBe("2026-03-30");
    expect(document.getElementById("goal-description").value).toBe("Beschreibung");
    expect(document.getElementById("goal-submit").textContent).toContain("speichern");
    expect(document.getElementById("goal-cancel-edit").classList.contains("d-none")).toBe(false);

    api.resetGoalForm();
    expect(document.getElementById("goal-edit-id").value).toBe("");
    expect(document.getElementById("goal-title").value).toBe("");
  });

  it("handles goal add/update and cancel edit", () => {
    const { deps } = setupHandlers();
    const goalForm = document.getElementById("goal-form");

    goalForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.dispatch).not.toHaveBeenCalled();

    document.getElementById("goal-title").value = "Ziel A";
    document.getElementById("goal-date").value = "2026-04-01";
    document.getElementById("goal-description").value = "Text";
    goalForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "GOAL_ADD" }));
    expect(deps.touchActivity).toHaveBeenCalled();
    expect(deps.renderAll).toHaveBeenCalled();

    document.getElementById("goal-edit-id").value = "g42";
    document.getElementById("goal-title").value = "Ziel B";
    document.getElementById("goal-date").value = "2026-04-02";
    goalForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "GOAL_UPDATE",
        payload: expect.objectContaining({
          goal: expect.objectContaining({ id: "g42", title: "Ziel B" }),
        }),
      })
    );

    document.getElementById("goal-cancel-edit").click();
    expect(document.getElementById("goal-edit-id").value).toBe("");
  });

  it("handles rough/detail, month and tab interactions", () => {
    const { deps } = setupHandlers();

    const roughForm = document.getElementById("rough-form");
    document.getElementById("rough-week").value = "2026-W13";
    document.getElementById("rough-hours").value = "2";
    document.getElementById("rough-note").value = "Note";
    roughForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "ROUGH_ADD" }));

    const detailForm = document.getElementById("detail-form");
    document.getElementById("detail-date").value = "2026-03-30";
    document.getElementById("detail-minutes").value = "90";
    document.getElementById("detail-topic").value = "Topic";
    document.getElementById("detail-milestone").value = "MS";
    detailForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "DETAIL_ADD" }));

    document.getElementById("month-select").dispatchEvent(new Event("change", { bubbles: true }));
    expect(deps.renderAll).toHaveBeenCalled();

    document.getElementById("tab-calendar").click();
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "SET_ACTIVE_VIEW",
      payload: { view: "calendar" },
    });

    document.getElementById("tab-backup").click();
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "SET_ACTIVE_VIEW",
      payload: { view: "backup" },
    });
  });

  it("handles calendar and timer controls", () => {
    const { deps } = setupHandlers();

    document.getElementById("calendar-prev").click();
    document.getElementById("calendar-next").click();
    expect(deps.setCalendarMonth).toHaveBeenCalledTimes(2);
    expect(deps.renderCalendar).toHaveBeenCalledTimes(2);

    document.getElementById("timer-start").click();
    document.getElementById("timer-stop").click();
    document.getElementById("track-detail-select").value = "d1";
    document
      .getElementById("track-detail-select")
      .dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("track-note").value = "Manual note";
    document.getElementById("track-manual-minutes").value = "45";
    const submittedDate = document.getElementById("track-manual-date").value;
    document
      .getElementById("track-manual-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.startTimer).toHaveBeenCalledTimes(1);
    expect(deps.stopTimer).toHaveBeenCalledTimes(1);
    expect(deps.setSelectedTimerDetailPlan).toHaveBeenCalledWith("d1");
    expect(deps.addManualTrackedSession).toHaveBeenCalledWith({
      date: submittedDate,
      minutes: 45,
      note: "Manual note",
      detailPlanId: "d1",
    });
    expect(document.getElementById("track-manual-minutes").value).toBe("");
    expect(document.getElementById("track-note").value).toBe("");

    document.getElementById("track-edit-id").value = "t1";
    document.getElementById("track-manual-date").value = "2026-03-25";
    document.getElementById("track-manual-minutes").value = "30";
    document.getElementById("track-note").value = "Updated note";
    document
      .getElementById("track-manual-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.updateTrackedSession).toHaveBeenCalledWith({
      id: "t1",
      date: "2026-03-25",
      minutes: 30,
      note: "Updated note",
      detailPlanId: "d1",
    });

    document.getElementById("track-cancel-edit").click();
    expect(document.getElementById("track-edit-id").value).toBe("");
  });

  it("handles demo, theme, import/export and reset actions", async () => {
    const importIcsFile = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, calendarMonth: "2026-04" });
    const importJsonFile = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, state: { restored: true } });
    const normalizeThemeMode = vi.fn(() => "dark");
    const { deps } = setupHandlers({ importIcsFile, importJsonFile, normalizeThemeMode });

    document.getElementById("load-demo").click();
    expect(deps.loadDemoData).toHaveBeenCalledTimes(1);

    const theme = document.getElementById("theme-mode-dark");
    theme.checked = true;
    theme.dispatchEvent(new Event("change", { bubbles: true }));
    expect(normalizeThemeMode).toHaveBeenCalledWith("dark");
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "SET_THEME_MODE",
      payload: { themeMode: "dark" },
    });
    expect(deps.applyTheme).toHaveBeenCalledTimes(1);

    const fileInput = document.getElementById("ics-file");
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      value: [{ name: "a.ics" }],
    });

    document.getElementById("ics-import").click();
    await Promise.resolve();
    expect(importIcsFile).toHaveBeenNthCalledWith(1, { name: "a.ics" });

    document.getElementById("ics-import").click();
    await Promise.resolve();
    expect(importIcsFile).toHaveBeenNthCalledWith(2, { name: "a.ics" });
    expect(deps.setCalendarMonth).toHaveBeenCalledWith("2026-04");

    document.getElementById("ics-export").click();
    expect(deps.exportIcsFile).toHaveBeenCalledTimes(1);

    const jsonFileInput = document.getElementById("json-file");
    Object.defineProperty(jsonFileInput, "files", {
      configurable: true,
      value: [{ name: "backup.json" }],
    });

    document.getElementById("json-import").click();
    await Promise.resolve();
    expect(importJsonFile).toHaveBeenNthCalledWith(1, { name: "backup.json" });

    document.getElementById("json-import").click();
    await Promise.resolve();
    expect(importJsonFile).toHaveBeenNthCalledWith(2, { name: "backup.json" });
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "REPLACE_STATE",
      payload: { state: { restored: true } },
    });
    expect(deps.setInitialValues).toHaveBeenCalledTimes(1);

    document.getElementById("json-export").click();
    expect(deps.exportJsonFile).toHaveBeenCalledTimes(1);

    const confirmSpy = vi
      .spyOn(globalThis, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const dispatchCountBeforeReset = deps.dispatch.mock.calls.length;
    document.getElementById("reset-data").click();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(deps.dispatch).toHaveBeenCalledTimes(dispatchCountBeforeReset);

    document.getElementById("reset-data").click();
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(deps.defaultData).toHaveBeenCalledTimes(1);
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "REPLACE_STATE",
      payload: { state: { ok: true } },
    });
    expect(deps.setInitialValues).toHaveBeenCalledTimes(2);
  });
});

describe("modules/calendar-manager", () => {
  function mountCalendarDom() {
    document.body.innerHTML = [
      '<div id="list-view"></div>',
      '<div id="calendar-view"></div>',
      '<div id="backup-view"></div>',
      '<button id="tab-list" type="button"></button>',
      '<button id="tab-calendar" type="button"></button>',
      '<button id="tab-backup" type="button"></button>',
      '<div id="calendar-month-label"></div>',
      '<div id="calendar-grid"></div>',
      '<div id="calendar-legend"></div>',
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

  it("gets and sets calendar month", () => {
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

  it("renders list/calendar/backup view state for all branches", () => {
    const { manager, state } = createManager();

    state.settings.activeView = "list";
    manager.renderViewState();
    expect(document.getElementById("list-view").classList.contains("d-none")).toBe(false);
    expect(document.getElementById("calendar-view").classList.contains("d-none")).toBe(true);
    expect(document.getElementById("backup-view").classList.contains("d-none")).toBe(true);
    expect(document.getElementById("tab-list").getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("tab-calendar").getAttribute("aria-selected")).toBe("false");
    expect(document.getElementById("tab-backup").getAttribute("aria-selected")).toBe("false");

    state.settings.activeView = "calendar";
    manager.renderViewState();
    expect(document.getElementById("list-view").classList.contains("d-none")).toBe(true);
    expect(document.getElementById("calendar-view").classList.contains("d-none")).toBe(false);
    expect(document.getElementById("backup-view").classList.contains("d-none")).toBe(true);
    expect(document.getElementById("tab-list").getAttribute("aria-selected")).toBe("false");
    expect(document.getElementById("tab-calendar").getAttribute("aria-selected")).toBe("true");

    state.settings.activeView = "backup";
    manager.renderViewState();
    expect(document.getElementById("list-view").classList.contains("d-none")).toBe(true);
    expect(document.getElementById("calendar-view").classList.contains("d-none")).toBe(true);
    expect(document.getElementById("backup-view").classList.contains("d-none")).toBe(false);
    expect(document.getElementById("tab-backup").getAttribute("aria-selected")).toBe("true");

    state.settings.activeView = "unknown";
    manager.renderViewState();
    expect(document.getElementById("list-view").classList.contains("d-none")).toBe(false);
    expect(document.getElementById("calendar-view").classList.contains("d-none")).toBe(true);
    expect(document.getElementById("backup-view").classList.contains("d-none")).toBe(true);
  });

  it("returns early in renderCalendar when grid/label are missing", () => {
    document.body.innerHTML = '<div id="calendar-grid"></div>';
    const { manager } = createManager();
    expect(() => manager.renderCalendar()).not.toThrow();

    document.body.innerHTML = '<div id="calendar-month-label"></div>';
    expect(() => manager.renderCalendar()).not.toThrow();
  });

  it("renders events, sorting, outside days and legend", () => {
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

    const legendItems = document.querySelectorAll("#calendar-legend .lz-legend-dot");
    expect(legendItems).toHaveLength(3);
  });
});

describe("modules/render-main-view", () => {
  function mountRenderMainViewDom() {
    document.body.innerHTML = [
      '<ul id="goal-list"></ul>',
      '<ul id="achieved-list"></ul>',
      '<ul id="rough-list"></ul>',
      '<ul id="detail-list"></ul>',
      '<ul id="track-list"></ul>',
      '<select id="track-detail-select"></select>',
      '<div id="stats"></div>',
      '<div id="time-progress" aria-valuenow="0"></div>',
      '<div id="goal-progress" aria-valuenow="0"></div>',
      '<div id="overview-next-items"></div>',
    ].join("");
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T10:00:00.000Z"));
    mountRenderMainViewDom();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("renders empty goals/achieved lists", () => {
    renderGoals({
      state: { goals: [] },
      dispatch: vi.fn(),
      onActivity: vi.fn(),
      onRenderAll: vi.fn(),
      onEditGoal: vi.fn(),
    });

    expect(document.getElementById("goal-list").textContent).toContain("Keine Ziele vorhanden");
    expect(document.getElementById("achieved-list").textContent).toContain(
      "Noch keine erreichten Ziele"
    );
  });

  it("renders and interacts with goal rows including milestones and achieved goals", () => {
    const dispatch = vi.fn();
    const onActivity = vi.fn();
    const onRenderAll = vi.fn();
    const onEditGoal = vi.fn();
    const confirmSpy = vi
      .spyOn(globalThis, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    renderGoals({
      state: {
        goals: [
          {
            id: "g1",
            title: "Goal 1",
            targetDate: "2026-03-30",
            description: "Desc",
            completed: false,
            completedAt: null,
            milestones: [{ id: "m1", title: "MS", done: true }],
          },
          {
            id: "g2",
            title: "Goal 2",
            targetDate: "2026-03-25",
            description: "",
            completed: true,
            completedAt: "2026-03-24T09:00:00.000Z",
            milestones: [
              { id: "m2", title: "Done MS", done: true },
              { id: "m3", title: "Open MS", done: false },
            ],
          },
        ],
      },
      dispatch,
      onActivity,
      onRenderAll,
      onEditGoal,
    });

    document
      .querySelector('[data-goal-toggle="g1"]')
      .dispatchEvent(new Event("change", { bubbles: true }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "GOAL_SET_COMPLETED",
        payload: expect.objectContaining({ id: "g1" }),
      })
    );

    document
      .querySelector('[data-goal-milestone-toggle="m1"]')
      .dispatchEvent(new Event("change", { bubbles: true }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "GOAL_TOGGLE_MILESTONE",
        payload: expect.objectContaining({ milestoneId: "m1" }),
      })
    );

    expect(document.getElementById("goal-list").textContent).not.toContain("Goal 2");
    expect(document.getElementById("achieved-list").textContent).toContain("Goal 2");
    expect(document.getElementById("achieved-list").textContent).toContain("Done MS (erledigt)");
    expect(document.getElementById("achieved-list").textContent).toContain("Open MS (offen)");

    const achievedToggle = document.querySelector('#achieved-list [data-goal-toggle="g2"]');
    achievedToggle.checked = false;
    achievedToggle.dispatchEvent(new Event("change", { bubbles: true }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "GOAL_SET_COMPLETED",
        payload: expect.objectContaining({ id: "g2", completed: false, completedAt: null }),
      })
    );

    document.querySelector('[data-goal-milestone-edit="m1"]').click();
    const inlineForm = document.querySelector('[data-goal-milestone-inline-edit="m1"]');
    const inlineInput = inlineForm.querySelector("input");
    inlineInput.value = "MS updated";
    inlineForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "GOAL_UPDATE_MILESTONE",
        payload: expect.objectContaining({ title: "MS updated" }),
      })
    );

    document.querySelector('[data-goal-milestone-delete="m1"]').click();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    document.querySelector('[data-goal-milestone-delete="m1"]').click();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "GOAL_DELETE_MILESTONE",
        payload: expect.objectContaining({ milestoneId: "m1" }),
      })
    );

    const addMilestoneForm = document
      .querySelector('input[aria-label="Zwischenziel für Goal 1"]')
      .closest("form");
    const addMilestoneInput = addMilestoneForm.querySelector("input");
    addMilestoneInput.value = "MS new";
    addMilestoneForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "GOAL_ADD_MILESTONE" }));

    document.querySelector("#goal-list > li .ms-auto .btn-outline-secondary").click();
    expect(onEditGoal).toHaveBeenCalled();

    document.querySelector("#goal-list > li .ms-auto .btn-outline-danger").click();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "GOAL_DELETE", payload: { id: "g1" } })
    );

    expect(onActivity).toHaveBeenCalled();
    expect(onRenderAll).toHaveBeenCalled();
    expect(document.getElementById("achieved-list").textContent).toContain("Erreicht am");
  });

  it("renders rough/detail/tracked lists including block-based detail planning", () => {
    const dispatch = vi.fn();
    const onRenderAll = vi.fn();
    const onStartTrackingDetail = vi.fn();

    renderRoughPlans({
      state: {
        roughPlans: [
          { id: "r1", date: "2026-03-24", week: "2026-W13", hours: 2, note: "Heute", goalId: "g1" },
          {
            id: "r3",
            date: "2026-03-26",
            week: "2026-W13",
            hours: 1,
            note: "Vorher",
            goalId: "g2",
          },
          { id: "r4", date: "2026-03-23", week: "2026-W12", hours: 1, note: "KW 12" },
          { id: "r5", date: "2026-11-23", week: "2026-W48", hours: 1, note: "KW 48" },
          { id: "r2", date: "2027-03-24", week: "2027-W12", hours: 2, note: "Zu spät" },
        ],
        goals: [
          { id: "g1", title: "Goal", milestones: [] },
          { id: "g2", title: "A Goal", milestones: [] },
        ],
      },
      dispatch,
      onRenderAll,
    });
    expect(document.getElementById("rough-list").textContent).toContain("2 h geplant");
    expect(document.getElementById("rough-list").textContent).toContain("KW 13/2026");
    expect(document.getElementById("rough-list").textContent).toContain("Zu spät");
    expect(document.getElementById("rough-list").textContent.indexOf("KW 12/2026")).toBeLessThan(
      document.getElementById("rough-list").textContent.indexOf("KW 48/2026")
    );

    document.getElementById("rough-list").innerHTML = "";
    renderRoughPlans({
      state: {
        roughPlans: [
          { id: "rx1", date: "2026-11-09", week: "KW 46/2026", hours: 1, note: "KW 46" },
          { id: "rx2", date: "2026-03-16", week: "KW 12/2026", hours: 1, note: "KW 12" },
        ],
        goals: [],
      },
      dispatch,
      onRenderAll,
    });
    expect(document.getElementById("rough-list").textContent.indexOf("KW 12")).toBeLessThan(
      document.getElementById("rough-list").textContent.indexOf("KW 46")
    );

    document.querySelector("#rough-list .btn-outline-danger").click();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ROUGH_DELETE",
        payload: expect.objectContaining({ id: expect.any(String) }),
      })
    );

    document.getElementById("rough-list").innerHTML = "";
    renderRoughPlans({ state: { roughPlans: [] }, dispatch, onRenderAll });
    expect(document.getElementById("rough-list").textContent).toContain("Keine Grobplanung");

    renderDetailPlans({
      state: {
        goals: [
          {
            id: "g1",
            title: "Goal",
            milestones: [{ id: "m1", title: "M", done: true }],
          },
        ],
        roughPlans: [
          { id: "r1", date: "2026-03-25", week: "2026-W13", hours: 2, note: "Block", goalId: "g1" },
        ],
        detailPlans: [
          {
            id: "d1",
            date: "2026-03-25",
            minutes: 45,
            topic: "A",
            milestone: "M",
            milestoneId: "m1",
            goalId: "g1",
            roughPlanId: "r1",
            done: false,
          },
          { id: "d2", date: "2026-03-26", minutes: 30, topic: "Legacy", milestone: "", done: true },
        ],
        trackedSessions: [
          { id: "t1", detailPlanId: "d1", minutes: 15, start: "2026-03-24T10:00:00.000Z" },
        ],
      },
      dispatch,
      onRenderAll,
      selectedMonth: "2026-03",
      onStartTrackingDetail,
    });

    expect(document.getElementById("detail-list").textContent).toContain("2 h geplant für Goal");
    expect(document.getElementById("detail-list").textContent).toContain("Verteilt: 0 von 120 Min");
    expect(document.getElementById("detail-list").textContent).toContain("Weitere Detailplanung");
    expect(document.getElementById("detail-list").textContent).toContain(
      "Noch keine Detailplanung für diesen Grobplanungsblock"
    );
    expect(document.getElementById("detail-list").textContent).toContain("30 Min für Legacy");
    expect(document.querySelector('[data-detail-block-form="r1"]')).toBeTruthy();
    expect(document.querySelector('[aria-label="Detailplanung bearbeiten"]')).toBeTruthy();
    expect(document.querySelector('[data-detail-start-tracking="d1"]')).toBeNull();

    document.querySelector('[data-detail-start-tracking="d2"]').click();
    expect(onStartTrackingDetail).toHaveBeenCalledWith("d2", "Legacy");

    document.querySelector("#detail-list .btn-outline-danger").click();
    expect(dispatch).toHaveBeenCalledWith({ type: "DETAIL_DELETE", payload: { id: "d2" } });

    document.getElementById("detail-list").innerHTML = "";
    renderDetailPlans({
      state: { goals: [], roughPlans: [], detailPlans: [], trackedSessions: [] },
      dispatch,
      onRenderAll,
      selectedMonth: "2026-03",
    });
    expect(document.getElementById("detail-list").textContent).toContain("Weitere Detailplanung");
    expect(document.querySelector('[data-detail-block-form="additional"]')).toBeTruthy();

    const onEditTrackedSession = vi.fn();

    renderTrackedSessions({
      state: {
        detailPlans: [{ id: "d1", date: "2026-03-24", topic: "A", milestone: "", minutes: 25 }],
        trackedSessions: [
          {
            id: "t1",
            start: "2026-03-24T10:00:00.000Z",
            minutes: 25,
            note: "X",
            detailPlanId: "d1",
          },
        ],
      },
      dispatch,
      onRenderAll,
      onEditTrackedSession,
    });
    expect(document.getElementById("track-list").textContent).toContain("Detail:");
    document.querySelector("#track-list [data-tracked-edit]").click();
    expect(onEditTrackedSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1", minutes: 25, note: "X" })
    );
    document.querySelector("#track-list .btn-outline-danger").click();
    expect(dispatch).toHaveBeenCalledWith({ type: "TRACKED_DELETE", payload: { id: "t1" } });

    document.getElementById("track-list").innerHTML = "";
    renderTrackedSessions({
      state: { trackedSessions: [], detailPlans: [] },
      dispatch,
      onRenderAll,
    });
    expect(document.getElementById("track-list").textContent).toContain(
      "Noch keine getrackte Lernzeit"
    );

    renderTimerDetailPlanSelect({
      state: {
        detailPlans: [{ id: "d1", date: "2026-03-24", topic: "Alpha", milestone: "", minutes: 20 }],
        goals: [],
        timer: { start: null, selectedDetailPlanId: "d1" },
      },
    });
    expect(document.getElementById("track-detail-select").value).toBe("d1");
  });

  it("shows a rough planning week in both overlapping months", () => {
    const dispatch = vi.fn();
    const onRenderAll = vi.fn();
    const state = {
      goals: [
        {
          id: "g1",
          title: "Cross Goal",
          milestones: [{ id: "m1", title: "Milestone", done: false }],
        },
      ],

      roughPlans: [
        {
          id: "r-cross",
          date: "2026-03-30",
          week: "2026-W14",
          hours: 2,
          note: "KW mit Monatswechsel",
          goalId: "g1",
        },
      ],
      detailPlans: [
        {
          id: "d-cross-1",
          date: "2026-03-31",
          minutes: 120,
          topic: "März Eintrag",
          milestone: "Milestone",
          milestoneId: "m1",
          goalId: "g1",
          roughPlanId: "r-cross",
          done: false,
        },
        {
          id: "d-cross-2",
          date: "2026-04-02",
          minutes: 200,
          topic: "April Eintrag",
          milestone: "Milestone",
          milestoneId: "m1",
          goalId: "g1",
          roughPlanId: "r-cross",
          done: false,
        },
      ],
    };

    renderDetailPlans({ state, dispatch, onRenderAll, selectedMonth: "2026-03" });
    expect(document.getElementById("detail-list").textContent).toContain("Cross Goal");
    expect(document.getElementById("detail-list").textContent).toContain(
      "Verteilt: 120 von 120 Min"
    );

    document.getElementById("detail-list").innerHTML = "";
    renderDetailPlans({ state, dispatch, onRenderAll, selectedMonth: "2026-04" });
    expect(document.getElementById("detail-list").textContent).toContain("Cross Goal");
    expect(document.getElementById("detail-list").textContent).toContain(
      "Verteilt: 200 von 120 Min"
    );
  });

  it("renders stats for zero-planned and non-zero planned branches", () => {
    renderStats({
      state: {
        roughPlans: [],
        detailPlans: [],
        trackedSessions: [{ minutes: 30, start: "2026-03-24T10:00:00.000Z" }],
        goals: [],
      },
      currentMonth: "2026-03",
    });

    expect(document.getElementById("time-progress").textContent).toBe("0%");
    expect(document.getElementById("goal-progress").textContent).toBe("0%");
    expect(document.getElementById("overview-next-items").textContent).toContain(
      "Keine anstehenden Einträge"
    );

    renderStats({
      state: {
        roughPlans: [{ date: "2026-03-25", hours: 1 }],
        detailPlans: [
          {
            id: "d-1",
            date: "2026-03-25",
            minutes: 20,
            topic: "Detail A",
            goalId: "g-open",
          },
          {
            id: "d-2",
            date: "2026-03-25",
            minutes: 40,
            topic: "Detail B",
            startTime: "09:00",
            endTime: "10:00",
            goalId: "g-open",
          },
          {
            id: "d-3",
            date: "2026-03-26",
            minutes: 60,
            topic: "Detail C",
            goalId: "g-open",
          },
          {
            id: "d-hidden-goal",
            date: "2026-03-27",
            minutes: 30,
            topic: "Detail hidden goal",
            goalId: "g-completed",
          },
          {
            id: "d-hidden-milestone",
            date: "2026-03-28",
            minutes: 30,
            topic: "Detail hidden milestone",
            milestoneId: "m-done",
            goalId: "g-open",
          },
        ],
        trackedSessions: [{ minutes: 500, start: "2026-03-24T10:00:00.000Z" }],
        goals: [
          {
            id: "g-open",
            title: "Offenes Ziel",
            targetDate: "2026-03-25",
            completed: false,
            milestones: [{ id: "m-done", title: "Erledigt", done: true }],
          },
          {
            id: "g-open-2",
            title: "Weiteres Ziel",
            targetDate: "2026-03-27",
            completed: false,
            milestones: [],
          },
          {
            id: "g-completed",
            title: "Abgeschlossenes Ziel",
            targetDate: "2026-03-26",
            completed: true,
            milestones: [],
          },
        ],
      },
      currentMonth: "2026-03",
    });

    expect(document.getElementById("time-progress").textContent).toBe("100%");
    expect(document.getElementById("goal-progress").textContent).toBe("33%");

    const upcoming = Array.from(
      document.querySelectorAll("#overview-next-items .list-group-item span")
    ).map((node) => node.textContent);

    const upcomingSubtitles = Array.from(
      document.querySelectorAll("#overview-next-items .list-group-item small")
    ).map((node) => node.textContent);

    expect(upcoming).toHaveLength(5);
    expect(upcoming[0]).toContain("Detail:");
    expect(upcoming[1]).toContain("Detail:");
    expect(upcoming[2]).toContain("Ziel:");
    expect(upcoming[3]).toContain("Detail:");
    expect(upcoming[4]).toContain("Ziel:");
    expect(upcomingSubtitles.some((line) => line.includes("09:00-10:00"))).toBe(true);
    expect(upcoming).not.toContain("Detail: Detail hidden goal");
    expect(upcoming).not.toContain("Detail: Detail hidden milestone");
  });
});

describe("modules/app-reducer", () => {
  it("handles goal and milestone actions", () => {
    let state = baseState();

    state = appReducer(state, { type: "GOAL_ADD", payload: { goal: { id: "g2", title: "New" } } });
    expect(state.goals).toHaveLength(2);

    state = appReducer(state, {
      type: "GOAL_UPDATE",
      payload: { goal: { id: "g2", title: "Updated", targetDate: "2026-04-10" } },
    });
    expect(state.goals.find((goal) => goal.id === "g2").title).toBe("Updated");

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

  it("handles planning, timer, settings and replacement actions", () => {
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

  it("updates rough plans with ROUGH_UPDATE", () => {
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

describe("modules/demo-data", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds deterministic demo state structure with relative planning dates", () => {
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

    expect(state.roughPlans).toEqual([
      expect.objectContaining({ date: "2026-03-29", hours: 3, note: "Wiederholung UML" }),
      expect.objectContaining({ date: "2026-04-03", hours: 4, note: "Altklausuren" }),
    ]);

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

  it("renders zero clock when no timer is active", () => {
    document.body.innerHTML = '<div id="timer-display"></div>';
    const { manager } = setupTimerManager();

    manager.renderTimer();
    expect(document.getElementById("timer-display").textContent).toBe("00:00:00");
  });

  it("ignores render call when timer display is missing", () => {
    const { manager } = setupTimerManager();
    expect(() => manager.renderTimer()).not.toThrow();
  });

  it("starts timer, updates display and blocks duplicate start", () => {
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

  it("stops timer, stores session and clears note", () => {
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

  it("syncs interval from state and supports dispose", () => {
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

  it("switches running timer when started from another detail plan", () => {
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

  it("adds manual tracked session with detail and note", () => {
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

  it("updates an existing tracked session", () => {
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
})
