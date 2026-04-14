import { afterEach, describe, expect, it, vi } from "vitest";

import { createNotificationManager } from "../../modules/notification-manager.js";

describe("modules/notification-manager", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends reminder only once in lead window", () => {
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

  it("requests browser permission when needed", async () => {
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

  it("sendet keine Benachrichtigung wenn leadMinutes=0 (Zeitfenster ist leer)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T08:59:59"));

    const notificationCtor = vi.fn();
    notificationCtor.permission = "granted";
    vi.stubGlobal("Notification", notificationCtor);

    // Mit leadMinutes=0 ist triggerAt === startTime, die Bedingung
    // (now < triggerAt || now >= startTime) ist immer wahr → nie eine Benachrichtigung
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
    expect(notificationCtor).not.toHaveBeenCalled();
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

  it("ueberspringt Benachrichtigung wenn Startzeit bereits vergangen ist", () => {
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
});
