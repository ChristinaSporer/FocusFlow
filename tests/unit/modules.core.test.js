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
import { createReminderManager } from "../../modules/reminder-manager.js";
import {
  renderDetailPlans,
  renderGoals,
  renderRoughPlans,
  renderStats,
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
    timer: { start: null },
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
    expect(document.getElementById("ics-status").textContent).toBe("1 Termin(e) aus Plan.ics importiert.");
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
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const empty = createManager();
    const emptyResult = empty.manager.exportToFile();
    expect(emptyResult).toEqual({ ok: false, status: "Keine App-Termine für den Export vorhanden." });
    expect(document.getElementById("ics-status").textContent).toBe("Keine App-Termine für den Export vorhanden.");

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
          goals: [{ id: "g1", title: "Import aktualisiert" }, { id: "g2", title: "Neu" }],
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
    expect(invalid).toEqual({ ok: false, status: "Import fehlgeschlagen. Bitte gültige JSON-Datei prüfen." });
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
      '<form id="settings-form"></form>',
      '<input id="inactivity-days" value="">',
      '<button id="enable-notifications" type="button"></button>',
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
      activateNotifications: vi.fn(),
      getCalendarMonth: vi.fn(() => "2026-03"),
      setCalendarMonth: vi.fn(),
      renderCalendar: vi.fn(),
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
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

  it("handles calendar, timer and settings controls", () => {
    const { deps } = setupHandlers();

    document.getElementById("calendar-prev").click();
    document.getElementById("calendar-next").click();
    expect(deps.setCalendarMonth).toHaveBeenCalledTimes(2);
    expect(deps.renderCalendar).toHaveBeenCalledTimes(2);

    document.getElementById("timer-start").click();
    document.getElementById("timer-stop").click();
    expect(deps.startTimer).toHaveBeenCalledTimes(1);
    expect(deps.stopTimer).toHaveBeenCalledTimes(1);

    const settingsForm = document.getElementById("settings-form");
    document.getElementById("inactivity-days").value = "0";
    settingsForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "SET_INACTIVITY_DAYS" }));

    document.getElementById("inactivity-days").value = "5";
    settingsForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(deps.dispatch).toHaveBeenCalledWith({ type: "SET_INACTIVITY_DAYS", payload: { days: 5 } });
  });

  it("handles notification, demo, theme, import/export and reset actions", async () => {
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

    document.getElementById("enable-notifications").click();
    expect(deps.activateNotifications).toHaveBeenCalledTimes(1);

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

    const confirmSpy = vi.spyOn(globalThis, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
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
      detailPlans: [
        { id: "d1", date: "2026-03-24", topic: "Design", minutes: 45, milestone: "MS1" },
        { id: "d2", date: "2026-03-24", topic: "Alpha", minutes: 30, milestone: "" },
      ],
      roughPlans: [
        { id: "r1", date: "2026-03-24", hours: 2, note: "Plan" },
        { id: "r2", date: "2026-03-26", hours: 1, note: "Later" },
      ],
      trackedSessions: [{ id: "t1", start: "2026-03-24T08:00:00.000Z", minutes: 20, note: "Track" }],
      importedEvents: [{ id: "i1", date: "2026-03-24", summary: "Import", sourceName: "a.ics" }],
    });

    manager.renderCalendar();

    expect(document.getElementById("calendar-month-label").textContent.toLowerCase()).toContain("märz");

    const weekdayCells = document.querySelectorAll(".lz-calendar-weekday");
    expect(weekdayCells).toHaveLength(7);

    const dayCells = document.querySelectorAll(".lz-calendar-day");
    expect(dayCells).toHaveLength(42);
    expect(document.querySelectorAll(".lz-calendar-day.outside").length).toBeGreaterThan(0);

    const allEvents = document.querySelectorAll(".lz-calendar-event");
    expect(allEvents.length).toBeGreaterThanOrEqual(5);
    expect(document.querySelector(".lz-calendar-event.lz-source-detail")).toBeTruthy();
    expect(document.querySelector(".lz-calendar-event.lz-source-rough")).toBeTruthy();
    expect(document.querySelector(".lz-calendar-event.lz-source-tracked")).toBeTruthy();
    expect(document.querySelector(".lz-calendar-event.lz-source-import")).toBeTruthy();

    const detailEventsOnDate = Array.from(document.querySelectorAll(".lz-calendar-event.lz-source-detail"))
      .filter((element) => element.parentElement.querySelector(".lz-calendar-day-number")?.textContent === "24")
      .map((element) => element.textContent);
    expect(detailEventsOnDate).toEqual(["Alpha (30 Min)", "MS1 (45 Min)"]);

    const allEventsByDate = Array.from(document.querySelectorAll(".lz-calendar-event")).map((element) => ({
      text: element.textContent,
      day: element.parentElement.querySelector(".lz-calendar-day-number")?.textContent,
    }));
    expect(allEventsByDate.some((item) => item.day === "26" && item.text.includes("1 h geplant"))).toBe(true);

    const legendItems = document.querySelectorAll("#calendar-legend .lz-legend-dot");
    expect(legendItems).toHaveLength(4);
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
      '<div id="stats"></div>',
      '<div id="time-progress" aria-valuenow="0"></div>',
      '<div id="goal-progress" aria-valuenow="0"></div>',
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
    expect(document.getElementById("achieved-list").textContent).toContain("Noch keine erreichten Ziele");
  });

  it("renders and interacts with goal rows including milestones and achieved goals", () => {
    const dispatch = vi.fn();
    const onActivity = vi.fn();
    const onRenderAll = vi.fn();
    const onEditGoal = vi.fn();
    const confirmSpy = vi.spyOn(globalThis, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);

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

    document.querySelector('[data-goal-toggle="g1"]').dispatchEvent(new Event("change", { bubbles: true }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "GOAL_SET_COMPLETED", payload: expect.objectContaining({ id: "g1" }) })
    );

    document.querySelector('[data-goal-milestone-toggle="m1"]').dispatchEvent(new Event("change", { bubbles: true }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "GOAL_TOGGLE_MILESTONE", payload: expect.objectContaining({ milestoneId: "m1" }) })
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
      expect.objectContaining({ type: "GOAL_UPDATE_MILESTONE", payload: expect.objectContaining({ title: "MS updated" }) })
    );

    document.querySelector('[data-goal-milestone-delete="m1"]').click();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    document.querySelector('[data-goal-milestone-delete="m1"]').click();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "GOAL_DELETE_MILESTONE", payload: expect.objectContaining({ milestoneId: "m1" }) })
    );

    const addMilestoneForm = document.querySelector('input[aria-label="Zwischenziel für Goal 1"]').closest("form");
    const addMilestoneInput = addMilestoneForm.querySelector("input");
    addMilestoneInput.value = "MS new";
    addMilestoneForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "GOAL_ADD_MILESTONE" }));

    document.querySelector("#goal-list > li .ms-auto .btn-outline-secondary").click();
    expect(onEditGoal).toHaveBeenCalled();

    document.querySelector("#goal-list > li .ms-auto .btn-outline-danger").click();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "GOAL_DELETE", payload: { id: "g1" } }));

    expect(onActivity).toHaveBeenCalled();
    expect(onRenderAll).toHaveBeenCalled();
    expect(document.getElementById("achieved-list").textContent).toContain("Erreicht am");
  });

  it("renders rough/detail/tracked lists including block-based detail planning", () => {
    const dispatch = vi.fn();
    const onRenderAll = vi.fn();

    renderRoughPlans({
      state: {
        roughPlans: [
          { id: "r1", date: "2026-03-24", week: "2026-W13", hours: 2, note: "Heute", goalId: "g1" },
          { id: "r3", date: "2026-03-26", week: "2026-W13", hours: 1, note: "Vorher", goalId: "g2" },
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
    expect(document.getElementById("rough-list").textContent).not.toContain("Zu spät");

    const roughRows = Array.from(document.querySelectorAll("#rough-list .list-group-item"));
    expect(roughRows[0].textContent).toContain("A Goal");

    document.querySelector("#rough-list .btn-outline-danger").click();
    expect(dispatch).toHaveBeenCalledWith({ type: "ROUGH_DELETE", payload: { id: "r3" } });

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
        roughPlans: [{ id: "r1", date: "2026-03-25", week: "2026-W13", hours: 2, note: "Block", goalId: "g1" }],
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
      },
      dispatch,
      onRenderAll,
      selectedMonth: "2026-03",
    });

    expect(document.getElementById("detail-list").textContent).toContain("2 h geplant für Goal");
    expect(document.getElementById("detail-list").textContent).toContain("Verteilt: 45 von 120 Min");
    expect(document.getElementById("detail-list").textContent).toContain("Weitere Detailplanung");
    expect(document.querySelector('[data-detail-block-form="r1"]')).toBeTruthy();
    expect(document.querySelector('[aria-label="Detailplanung bearbeiten"]')).toBeTruthy();

    const detailCheckbox = document.querySelector("#detail-list input[type='checkbox']");
    detailCheckbox.checked = true;
    detailCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    expect(dispatch).toHaveBeenCalledWith({ type: "DETAIL_SET_DONE", payload: { id: "d1", done: true } });

    document.querySelector("#detail-list .btn-outline-danger").click();
    expect(dispatch).toHaveBeenCalledWith({ type: "DETAIL_DELETE", payload: { id: "d1" } });

    document.getElementById("detail-list").innerHTML = "";
    renderDetailPlans({ state: { goals: [], roughPlans: [], detailPlans: [] }, dispatch, onRenderAll, selectedMonth: "2026-03" });
    expect(document.getElementById("detail-list").textContent).toContain("Weitere Detailplanung");
    expect(document.querySelector('[data-detail-block-form="additional"]')).toBeTruthy();

    renderTrackedSessions({
      state: {
        trackedSessions: [
          { id: "t1", start: "2026-03-24T10:00:00.000Z", minutes: 25, note: "X" },
        ],
      },
      dispatch,
      onRenderAll,
    });
    document.querySelector("#track-list .btn-outline-danger").click();
    expect(dispatch).toHaveBeenCalledWith({ type: "TRACKED_DELETE", payload: { id: "t1" } });

    document.getElementById("track-list").innerHTML = "";
    renderTrackedSessions({ state: { trackedSessions: [] }, dispatch, onRenderAll });
    expect(document.getElementById("track-list").textContent).toContain("Noch keine getrackte Lernzeit");
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
    expect(document.getElementById("detail-list").textContent).toContain("Verteilt: 320 von 120 Min");

    document.getElementById("detail-list").innerHTML = "";
    renderDetailPlans({ state, dispatch, onRenderAll, selectedMonth: "2026-04" });
    expect(document.getElementById("detail-list").textContent).toContain("Cross Goal");
    expect(document.getElementById("detail-list").textContent).toContain("Verteilt: 320 von 120 Min");
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

    renderStats({
      state: {
        roughPlans: [{ date: "2026-03-25", hours: 1 }],
        detailPlans: [{ date: "2026-03-26", minutes: 60 }],
        trackedSessions: [{ minutes: 500, start: "2026-03-24T10:00:00.000Z" }],
        goals: [{ completed: true }, { completed: false }],
      },
      currentMonth: "2026-03",
    });

    expect(document.getElementById("time-progress").textContent).toBe("100%");
    expect(document.getElementById("goal-progress").textContent).toBe("50%");
    expect(document.getElementById("stats").textContent).toContain("Geplant (6M)");
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
    state = appReducer(state, { type: "DETAIL_DELETE", payload: { id: "d1" } });
    expect(state.detailPlans.find((plan) => plan.id === "d1")).toBeUndefined();

    state = appReducer(state, {
      type: "TIMER_START",
      payload: { start: "2026-03-24T08:00:00Z" },
    });
    expect(state.timer.start).toBe("2026-03-24T08:00:00Z");

    state = appReducer(state, {
      type: "TIMER_STOP_AND_STORE_SESSION",
      payload: { session: { id: "t2", minutes: 50 } },
    });
    expect(state.timer.start).toBeNull();
    expect(state.trackedSessions.find((session) => session.id === "t2")).toBeTruthy();

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

    expect(state.goals).toHaveLength(2);
    expect(state.roughPlans).toHaveLength(2);
    expect(state.detailPlans).toHaveLength(2);
    expect(state.trackedSessions).toHaveLength(2);
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

    expect(state.detailPlans).toEqual([
      expect.objectContaining({
        date: "2026-03-29",
        minutes: 90,
        topic: "User Stories",
        milestone: "Kapitel 4 durcharbeiten",
        done: false,
      }),
      expect.objectContaining({
        date: "2026-04-03",
        minutes: 120,
        topic: "Testmethoden",
        milestone: "10 Übungsaufgaben",
        done: true,
      }),
    ]);

    state.trackedSessions.forEach((session) => {
      expect(session.minutes === 45 || session.minutes === 60).toBe(true);
      expect(session.start).toBe("2026-03-24T10:00:00.000Z");
      expect(session.end === "2026-03-24T10:45:00.000Z" || session.end === "2026-03-24T11:00:00.000Z").toBe(
        true
      );
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
    const state = initialState || { timer: { start: null } };
    const dispatch = vi.fn((action) => {
      if (action.type === "TIMER_START") {
        state.timer.start = action.payload.start;
      }
      if (action.type === "TIMER_STOP_AND_STORE_SESSION") {
        state.timer.start = null;
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
      payload: { start: "2026-03-24T10:00:00.000Z" },
    });

    vi.advanceTimersByTime(1000);
    expect(document.getElementById("timer-display").textContent).toBe("00:00:01");
  });

  it("stops timer, stores session and clears note", () => {
    document.body.innerHTML = '<div id="timer-display"></div><input id="track-note" value="  Deep Work  ">';

    const onActivity = vi.fn();
    const onRenderAll = vi.fn();
    const state = { timer: { start: "2026-03-24T09:57:30.000Z" } };

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
    expect(action.payload.session.id).toBeTruthy();
    expect(document.getElementById("track-note").value).toBe("");
    expect(onActivity).toHaveBeenCalledTimes(1);
    expect(onRenderAll).toHaveBeenCalledTimes(1);
  });

  it("syncs interval from state and supports dispose", () => {
    document.body.innerHTML = '<div id="timer-display"></div>';
    const state = { timer: { start: "2026-03-24T09:59:58.000Z" } };

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
});

describe("modules/reminder-manager", () => {
  const originalNotification = globalThis.Notification;
  const originalAlert = globalThis.alert;
  let secureContextDescriptor;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T10:00:00.000Z"));

    document.body.innerHTML = [
      '<div id="notification-status"></div>',
      '<div id="reminder-hint"></div>',
      '<ul id="reminder-list"></ul>',
    ].join("");

    globalThis.alert = vi.fn();
    secureContextDescriptor = Object.getOwnPropertyDescriptor(window, "isSecureContext");
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";

    if (typeof originalNotification === "undefined") {
      delete globalThis.Notification;
    } else {
      globalThis.Notification = originalNotification;
    }

    globalThis.alert = originalAlert;

    if (secureContextDescriptor) {
      Object.defineProperty(window, "isSecureContext", secureContextDescriptor);
    } else {
      delete window.isSecureContext;
    }
  });

  function setupReminderManager(overrideState = {}) {
    const state = {
      roughPlans: [],
      goals: [],
      trackedSessions: [{ end: "2026-03-24T09:30:00.000Z" }],
      settings: {
        inactivityDays: 3,
        notificationEnabled: false,
      },
      ...overrideState,
    };

    const dispatch = vi.fn((action) => {
      if (action.type === "SET_NOTIFICATION_ENABLED") {
        state.settings.notificationEnabled = action.payload.enabled;
      }
    });
    const onRenderAll = vi.fn();

    const manager = createReminderManager({
      getState: () => state,
      dispatch,
      onRenderAll,
    });

    return { manager, state, dispatch, onRenderAll };
  }

  it("writes notification status and shows empty reminder state", () => {
    const { manager } = setupReminderManager();

    manager.setNotificationStatus("OK");
    expect(document.getElementById("notification-status").textContent).toBe("OK");

    manager.runReminders();
    expect(document.getElementById("reminder-list").textContent).toContain("Keine aktuellen Erinnerungen");
    expect(document.getElementById("reminder-hint").textContent).toContain("aktuell nichts offen");
  });

  it("renders upcoming reminders and emits browser notifications when granted", () => {
    const NotificationMock = vi.fn();
    NotificationMock.permission = "granted";
    NotificationMock.requestPermission = vi.fn(async () => "granted");
    globalThis.Notification = NotificationMock;

    const today = "2026-03-24";
    const { manager } = setupReminderManager({
      roughPlans: [{ date: today, hours: 2 }],
      goals: [{ title: "Abgabe", targetDate: today, completed: false }],
      settings: { inactivityDays: 3, notificationEnabled: true },
    });

    manager.runReminders();

    const list = document.getElementById("reminder-list");
    expect(list.children.length).toBe(2);
    expect(list.textContent).toContain("Geplante Lernzeit");
    expect(list.textContent).toContain("Ziel bald fällig");
    expect(document.getElementById("reminder-hint").textContent).toContain("Erinnerungen aktiv (2 Hinweis(e))");
    expect(NotificationMock).toHaveBeenCalledTimes(2);
  });

  it("supports reminder loop start and stop", () => {
    const { manager } = setupReminderManager({
      roughPlans: [{ date: "2026-03-24", hours: 1 }],
      settings: { inactivityDays: 3, notificationEnabled: false },
    });

    manager.startLoop();
    vi.advanceTimersByTime(60000);
    expect(document.getElementById("reminder-list").children.length).toBe(1);

    manager.stopLoop();
    document.getElementById("reminder-list").innerHTML = "";
    vi.advanceTimersByTime(60000);
    expect(document.getElementById("reminder-list").children.length).toBe(0);
  });

  it("handles notification activation error branches", async () => {
    const { manager, dispatch, onRenderAll } = setupReminderManager();

    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    await manager.activateNotifications();
    expect(globalThis.alert).toHaveBeenCalled();
    expect(document.getElementById("notification-status").textContent).toContain("Aktivierung fehlgeschlagen");

    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    delete globalThis.Notification;
    await manager.activateNotifications();
    expect(document.getElementById("notification-status").textContent).toContain("unterstützt keine Benachrichtigungen");

    const deniedPermission = vi.fn();
    deniedPermission.permission = "denied";
    deniedPermission.requestPermission = vi.fn(async () => "denied");
    globalThis.Notification = deniedPermission;
    await manager.activateNotifications();
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_NOTIFICATION_ENABLED",
      payload: { enabled: false },
    });

    const grantedPermission = vi.fn();
    grantedPermission.permission = "default";
    grantedPermission.requestPermission = vi.fn(async () => "granted");
    globalThis.Notification = grantedPermission;
    await manager.activateNotifications();
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_NOTIFICATION_ENABLED",
      payload: { enabled: true },
    });
    expect(onRenderAll).toHaveBeenCalled();

    const throwingPermission = vi.fn();
    throwingPermission.permission = "default";
    throwingPermission.requestPermission = vi.fn(async () => {
      throw new Error("boom");
    });
    globalThis.Notification = throwingPermission;
    await manager.activateNotifications();
    expect(document.getElementById("notification-status").textContent).toContain("konnte nicht angefragt werden");
  });
});
