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
});
