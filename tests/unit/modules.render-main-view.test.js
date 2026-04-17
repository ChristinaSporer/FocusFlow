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

  it("rendert leere Ziel- und Erreicht-Listen", () => {
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

  it("rendert Zielzeilen und interagiert mit ihnen, inklusive Meilensteinen und erreichten Zielen", () => {
    const dispatch = vi.fn();
    const onActivity = vi.fn();
    const onRenderAll = vi.fn();
    const onEditGoal = vi.fn();
    const confirmSpy = vi
      .spyOn(globalThis, "confirm")
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
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

    const completeGoalButton = document.querySelector("#goal-list .btn-outline-success");
    completeGoalButton.click();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "GOAL_SET_COMPLETED",
        payload: expect.objectContaining({ id: "g1", completed: true }),
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

    const achievedToggle = Array.from(
      document.querySelectorAll('#achieved-list [data-goal-toggle="g2"]')
    ).find((button) => button.textContent.includes("Wieder aktivieren"));
    achievedToggle.click();
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
    expect(confirmSpy).toHaveBeenCalledTimes(3);
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
    expect(confirmSpy).toHaveBeenCalledTimes(5);
    expect(document.getElementById("achieved-list").textContent).toContain("Erreicht am");
  });

  it("rendert Grob-, Detail- und Tracking-Listen inklusive blockbasierter Detailplanung", () => {
    const dispatch = vi.fn();
    const onRenderAll = vi.fn();
    const onStartTrackingDetail = vi.fn();

    renderRoughPlans({
      state: {
        roughPlans: [
          {
            id: "r1",
            date: "2026-03-24",
            week: "2026-W13",
            hours: 2,
            note: "Heute",
            goalId: "g1",
          },
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
    expect(document.getElementById("rough-list").textContent).toContain("Workload");
    expect(document.getElementById("rough-list").textContent).toContain("Tage:");

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
    expect(document.getElementById("rough-list").textContent).toContain("Workload");

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
          {
            id: "r1",
            date: "2026-03-25",
            week: "2026-W13",
            hours: 2,
            note: "Block",
            goalId: "g1",
          },
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
          {
            id: "d2",
            date: "2026-03-26",
            minutes: 30,
            topic: "Legacy",
            milestone: "",
            done: true,
          },
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
          {
            id: "t2",
            start: "2026-03-24T11:00:00.000Z",
            minutes: 15,
            note: "Ohne Detail",
            detailPlanId: null,
          },
        ],
        goals: [],
      },
      dispatch,
      onRenderAll,
      onEditTrackedSession,
    });
    expect(document.getElementById("track-list").textContent).toContain("Detail:");
    document.querySelector("#track-list li:nth-child(2) [data-tracked-edit]").click();
    expect(onEditTrackedSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1", minutes: 25, note: "X" })
    );
    document.querySelector("#track-list li:nth-child(2) .btn-outline-danger").click();
    expect(dispatch).toHaveBeenCalledWith({ type: "TRACKED_DELETE", payload: { id: "t1" } });
    expect(document.querySelector("#track-list .lz-tracked-unlinked")?.textContent).toContain(
      "Ohne Detail"
    );

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

  it("zeigt eine Grobplanungswoche in beiden ueberlappenden Monaten", () => {
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

  it("rendert Statistiken fuer Zweige mit null und mit vorhandener Planung", () => {
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
      document.querySelectorAll("#overview-next-items .list-group-item .lz-next-item-title")
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

    const markers = Array.from(
      document.querySelectorAll("#overview-next-items .list-group-item .lz-legend-dot")
    );
    expect(markers).toHaveLength(5);

    const firstItem = document.querySelector("#overview-next-items .list-group-item");
    expect(firstItem?.style.borderLeft).toContain("6px solid");
  });
});
