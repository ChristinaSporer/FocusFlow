import { afterEach, describe, expect, it, vi } from "vitest";

import { createNotificationManager } from "../../modules/notification-manager.js";

describe("modules/notification-manager", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sendet die Erinnerung im Vorlaufzeitfenster nur einmal", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T08:50:00"));

    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    notificationCtor.requestPermission = vi.fn(async () => "granted");
    vi.stubGlobal("Notification", notificationCtor);

    const manager = createNotificationManager({
      getState: () => ({
        settings: { notificationEnabled: true, notificationLeadMinutes: 15 },
        detailPlans: [
          {
            id: "d1",
            date: "2026-04-06",
            startTime: "09:00",
            endTime: "10:00",
            topic: "Architecture deep dive",
            done: false,
          },
        ],
      }),
    });

    manager.sync();
    manager.sync();

    expect(notificationCtor).toHaveBeenCalledTimes(1);
    expect(notificationCtor).toHaveBeenCalledWith(
      "FocusFlow: In 15 Minuten beginnt deine Lernsession",
      {
        body: "Architecture deep dive \u00b7 Start um 09:00-10:00",
      }
    );

    manager.dispose();
  });

  it("fragt die Browser-Berechtigung nur bei Bedarf an", async () => {
    const notificationCtor = vi.fn();
    notificationCtor.permission = "default";
    notificationCtor.requestPermission = vi.fn(async () => "granted");
    vi.stubGlobal("Notification", notificationCtor);

    const manager = createNotificationManager({
      getState: () => ({ settings: {}, detailPlans: [] }),
    });

    await expect(manager.requestPermission()).resolves.toBe("granted");
    expect(notificationCtor.requestPermission).toHaveBeenCalledTimes(1);

    manager.dispose();
  });

  it("meldet 'unsupported' wenn Notification API nicht verfuegbar ist", async () => {
    vi.stubGlobal("Notification", undefined);

    const manager = createNotificationManager({
      getState: () => ({ settings: {}, detailPlans: [] }),
    });

    expect(manager.getPermission()).toBe("unsupported");
    await expect(manager.requestPermission()).resolves.toBe("unsupported");

    manager.dispose();
  });

  it("sendet keine Benachrichtigung wenn notificationEnabled false ist", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T08:50:00"));

    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    vi.stubGlobal("Notification", notificationCtor);

    const manager = createNotificationManager({
      getState: () => ({
        settings: { notificationEnabled: false, notificationLeadMinutes: 15 },
        detailPlans: [
          {
            id: "d1",
            date: "2026-04-06",
            startTime: "09:00",
            endTime: "10:00",
            topic: "Test",
            done: false,
          },
        ],
      }),
    });

    manager.sync();
    expect(notificationCtor).not.toHaveBeenCalled();
    manager.dispose();
  });

  it("unterdrueckt die Lernzeit-Erinnerung waehrend aktiver Stoppuhr", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T08:50:00"));

    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    vi.stubGlobal("Notification", notificationCtor);

    const manager = createNotificationManager({
      getState: () => ({
        settings: { notificationEnabled: true, notificationLeadMinutes: 15 },
        timer: { start: "2026-04-06T08:45:00.000Z" },
        pomodoro: { active: false },
        detailPlans: [
          {
            id: "d1",
            date: "2026-04-06",
            startTime: "09:00",
            endTime: "10:00",
            topic: "Test",
            done: false,
          },
        ],
      }),
    });

    manager.sync();
    expect(notificationCtor).not.toHaveBeenCalled();
    manager.dispose();
  });

  it("holt Lernzeit-Erinnerung nach aktiver Stoppuhr nicht nach", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T08:50:00"));

    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    vi.stubGlobal("Notification", notificationCtor);

    const state = {
      settings: { notificationEnabled: true, notificationLeadMinutes: 15 },
      timer: { start: "2026-04-06T08:45:00.000Z" },
      pomodoro: { active: false },
      detailPlans: [
        {
          id: "d1",
          date: "2026-04-06",
          startTime: "09:00",
          endTime: "10:00",
          topic: "Test",
          done: false,
        },
      ],
    };

    const manager = createNotificationManager({
      getState: () => state,
    });

    manager.sync();
    expect(notificationCtor).not.toHaveBeenCalled();

    state.timer.start = null;
    vi.setSystemTime(new Date("2026-04-06T08:52:00"));
    manager.sync();

    expect(notificationCtor).not.toHaveBeenCalled();
    manager.dispose();
  });

  it("ueberspringt Plaene ohne startTime", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T08:50:00"));

    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    vi.stubGlobal("Notification", notificationCtor);

    const manager = createNotificationManager({
      getState: () => ({
        settings: { notificationEnabled: true, notificationLeadMinutes: 15 },
        detailPlans: [
          { id: "d1", date: "2026-04-06", startTime: null, topic: "Kein Start", done: false },
        ],
      }),
    });

    manager.sync();
    expect(notificationCtor).not.toHaveBeenCalled();
    manager.dispose();
  });

  it("sendet bei leadMinutes=0 eine Benachrichtigung direkt zum Startzeitpunkt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T09:00:00"));

    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    vi.stubGlobal("Notification", notificationCtor);

    const manager = createNotificationManager({
      getState: () => ({
        settings: { notificationEnabled: true, notificationLeadMinutes: 0 },
        detailPlans: [
          {
            id: "d1",
            date: "2026-04-06",
            startTime: "09:00",
            endTime: "10:00",
            topic: "Direkt jetzt",
            done: false,
          },
        ],
      }),
    });

    manager.sync();
    expect(notificationCtor).toHaveBeenCalledTimes(1);
    expect(notificationCtor).toHaveBeenCalledWith("FocusFlow: Zeit zu lernen", {
      body: "Direkt jetzt · 09:00-10:00",
    });
    manager.dispose();
  });

  it("gibt 'granted' zurueck ohne requestPermission zu rufen wenn bereits granted", async () => {
    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    notificationCtor.requestPermission = vi.fn(async () => "granted");
    vi.stubGlobal("Notification", notificationCtor);

    const manager = createNotificationManager({
      getState: () => ({ settings: {}, detailPlans: [] }),
    });

    await expect(manager.requestPermission()).resolves.toBe("granted");
    expect(notificationCtor.requestPermission).not.toHaveBeenCalled();

    manager.dispose();
  });

  it("ueberspringt Plaene die als 'done' markiert sind", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T08:50:00"));

    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    vi.stubGlobal("Notification", notificationCtor);

    const manager = createNotificationManager({
      getState: () => ({
        settings: { notificationEnabled: true, notificationLeadMinutes: 15 },
        detailPlans: [
          {
            id: "d1",
            date: "2026-04-06",
            startTime: "09:00",
            topic: "Erledigt",
            done: true,
          },
        ],
      }),
    });

    manager.sync();
    expect(notificationCtor).not.toHaveBeenCalled();
    manager.dispose();
  });

  it("ueberspringt 0-Minuten-Benachrichtigung wenn Startzeitfenster bereits vorbei ist", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T09:05:00"));

    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    vi.stubGlobal("Notification", notificationCtor);

    const manager = createNotificationManager({
      getState: () => ({
        settings: { notificationEnabled: true, notificationLeadMinutes: 0 },
        detailPlans: [
          {
            id: "d1",
            date: "2026-04-06",
            startTime: "09:00",
            endTime: "10:00",
            topic: "Schon vorbei",
            done: false,
          },
        ],
      }),
    });

    manager.sync();
    expect(notificationCtor).not.toHaveBeenCalled();
    manager.dispose();
  });

  it("entfernt veraltete Benachrichtigungsschluessel wenn sich die Plaene aendern", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T08:50:00"));

    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    vi.stubGlobal("Notification", notificationCtor);

    const state = {
      settings: { notificationEnabled: true, notificationLeadMinutes: 15 },
      detailPlans: [
        {
          id: "d1",
          date: "2026-04-06",
          startTime: "09:00",
          endTime: "10:00",
          topic: "Erste Session",
          done: false,
        },
      ],
    };

    const manager = createNotificationManager({
      getState: () => state,
    });

    manager.sync();
    state.detailPlans = [
      {
        id: "d2",
        date: "2026-04-06",
        startTime: "09:00",
        endTime: "10:00",
        topic: "Zweite Session",
        done: false,
      },
    ];
    manager.sync();

    expect(notificationCtor).toHaveBeenCalledTimes(2);
    expect(notificationCtor).toHaveBeenLastCalledWith(
      "FocusFlow: In 15 Minuten beginnt deine Lernsession",
      { body: "Zweite Session · Start um 09:00-10:00" }
    );

    manager.dispose();
  });

  it("registriert das Polling nur einmal und gibt es beim Dispose wieder frei", () => {
    vi.useFakeTimers();

    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    vi.stubGlobal("Notification", notificationCtor);

    const manager = createNotificationManager({
      getState: () => ({ settings: {}, detailPlans: [] }),
    });

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    manager.dispose();
    manager.dispose();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it("sendet eine Inaktivitaets-Benachrichtigung auf Basis der letzten getrackten Session", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T10:00:00.000Z"));

    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    vi.stubGlobal("Notification", notificationCtor);
    const dispatch = vi.fn();

    const manager = createNotificationManager({
      dispatch,
      getState: () => ({
        settings: {
          inactivityNotificationEnabled: true,
          inactivityDays: 7,
          lastInactivityNotificationAt: null,
        },
        trackedSessions: [
          {
            id: "t1",
            start: "2026-04-11T08:00:00.000Z",
            end: "2026-04-11T09:00:00.000Z",
            minutes: 60,
          },
        ],
        detailPlans: [],
      }),
    });

    manager.sync();

    expect(notificationCtor).toHaveBeenCalledTimes(1);
    expect(notificationCtor).toHaveBeenCalledWith(
      "FocusFlow: Seit 10 Tagen keine Lernzeit erfasst",
      {
        body: "Du hast seit 10 Tagen keine Lernzeit getrackt. Zeit für den nächsten Fokusblock?",
      }
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_LAST_INACTIVITY_NOTIFICATION_AT",
      payload: { timestamp: "2026-04-21T10:00:00.000Z" },
    });

    manager.dispose();
  });

  it("sendet die Inaktivitaets-Benachrichtigung nicht doppelt ohne neue Session", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T10:00:00.000Z"));

    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    vi.stubGlobal("Notification", notificationCtor);

    const manager = createNotificationManager({
      dispatch: vi.fn(),
      getState: () => ({
        settings: {
          inactivityNotificationEnabled: true,
          inactivityDays: 7,
          lastInactivityNotificationAt: "2026-04-21T10:00:00.000Z",
        },
        trackedSessions: [
          {
            id: "t1",
            start: "2026-04-11T08:00:00.000Z",
            end: "2026-04-11T09:00:00.000Z",
            minutes: 60,
          },
        ],
        detailPlans: [],
      }),
    });

    manager.sync();
    expect(notificationCtor).not.toHaveBeenCalled();

    manager.dispose();
  });

  it("unterdrueckt Inaktivitaets-Benachrichtigung waehrend aktivem Pomodoro", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T10:00:00.000Z"));

    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    vi.stubGlobal("Notification", notificationCtor);
    const dispatch = vi.fn();

    const manager = createNotificationManager({
      dispatch,
      getState: () => ({
        settings: {
          inactivityNotificationEnabled: true,
          inactivityDays: 7,
          lastInactivityNotificationAt: null,
        },
        timer: { start: null },
        pomodoro: { active: true },
        trackedSessions: [
          {
            id: "t1",
            start: "2026-04-11T08:00:00.000Z",
            end: "2026-04-11T09:00:00.000Z",
            minutes: 60,
          },
        ],
        detailPlans: [],
      }),
    });

    manager.sync();
    expect(notificationCtor).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_LAST_INACTIVITY_NOTIFICATION_AT",
      payload: { timestamp: "2026-04-21T10:00:00.000Z" },
    });
    manager.dispose();
  });

  it("holt Inaktivitaets-Benachrichtigung nach aktivem Tracking nicht nach", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T10:00:00.000Z"));

    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    vi.stubGlobal("Notification", notificationCtor);

    const state = {
      settings: {
        inactivityNotificationEnabled: true,
        inactivityDays: 7,
        lastInactivityNotificationAt: null,
      },
      timer: { start: "2026-04-21T09:50:00.000Z" },
      pomodoro: { active: false },
      trackedSessions: [
        {
          id: "t1",
          start: "2026-04-11T08:00:00.000Z",
          end: "2026-04-11T09:00:00.000Z",
          minutes: 60,
        },
      ],
      detailPlans: [],
    };

    const dispatch = vi.fn((action) => {
      if (action?.type === "SET_LAST_INACTIVITY_NOTIFICATION_AT") {
        state.settings.lastInactivityNotificationAt = action.payload.timestamp;
      }
    });

    const manager = createNotificationManager({
      dispatch,
      getState: () => state,
    });

    manager.sync();
    expect(notificationCtor).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_LAST_INACTIVITY_NOTIFICATION_AT",
      payload: { timestamp: "2026-04-21T10:00:00.000Z" },
    });

    state.timer.start = null;
    vi.setSystemTime(new Date("2026-04-21T10:01:00.000Z"));
    manager.sync();

    expect(notificationCtor).not.toHaveBeenCalled();
    manager.dispose();
  });
});
