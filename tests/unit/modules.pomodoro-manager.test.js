import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPomodoroManager } from "../../modules/pomodoro-manager.js";

describe("modules/pomodoro-manager", () => {
  let actions;
  let startTimer;
  let stopTimer;
  let onRender;
  let dispatch;
  let state;
  let notificationMock;

  function createManager() {
    return createPomodoroManager({
      startTimer,
      stopTimer,
      onRender,
      getState: () => state,
      dispatch,
    });
  }

  function getLastSaveAction() {
    return actions.filter((entry) => entry.type === "dispatch").at(-1)?.payload;
  }

  beforeEach(() => {
    actions = [];
    state = { pomodoro: {} };
    startTimer = vi.fn(() => actions.push({ type: "startTimer" }));
    stopTimer = vi.fn((payload) => actions.push({ type: "stopTimer", payload }));
    onRender = vi.fn(() => actions.push({ type: "render" }));
    dispatch = vi.fn((payload) => actions.push({ type: "dispatch", payload }));
    notificationMock = vi.fn();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("start() fordert die Benachrichtigungsberechtigung an und startet den Arbeitstimer", async () => {
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn().mockResolvedValue("granted"),
    });

    const pomodoro = createManager();

    await pomodoro.start();

    expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(startTimer).toHaveBeenCalledTimes(1);
    expect(onRender).toHaveBeenCalled();
    expect(getLastSaveAction()).toMatchObject({
      type: "POMODORO_SAVE",
      payload: expect.objectContaining({
        active: true,
        phase: "work",
        pomodorosCompleted: 0,
        secondsLeft: 25 * 60,
      }),
    });
  });

  it("start() startet die getrackte Zeit nicht erneut, wenn bereits aktiv", async () => {
    const pomodoro = createManager();

    await pomodoro.start();
    actions.length = 0;
    startTimer.mockClear();

    await pomodoro.start();

    expect(startTimer).not.toHaveBeenCalled();
    expect(actions).toEqual([]);
  });

  it("start() startet waehrend einer Pause nicht den getrackten Arbeitstimer", async () => {
    state = {
      pomodoro: {
        active: false,
        phase: "short-break",
        pomodorosCompleted: 1,
        secondsLeft: 5 * 60,
        phaseStartedAt: null,
      },
    };

    const pomodoro = createManager();
    pomodoro.syncFromState();
    actions.length = 0;

    await pomodoro.start();

    expect(startTimer).not.toHaveBeenCalled();
    expect(getLastSaveAction()).toMatchObject({
      type: "POMODORO_SAVE",
      payload: expect.objectContaining({
        active: true,
        phase: "short-break",
      }),
    });
  });

  it("pause() macht nichts, wenn der Pomodoro inaktiv ist", () => {
    const pomodoro = createManager();

    pomodoro.pause();

    expect(actions).toEqual([]);
  });

  it("pause() speichert nach dem Start den inaktiven Arbeitsstatus", async () => {
    const pomodoro = createManager();

    await pomodoro.start();
    actions.length = 0;

    pomodoro.pause();

    expect(getLastSaveAction()).toMatchObject({
      type: "POMODORO_SAVE",
      payload: expect.objectContaining({
        active: false,
        phase: "work",
        phaseStartedAt: null,
      }),
    });
    expect(onRender).toHaveBeenCalled();
  });

  it("skipPhase() wechselt von kurzer Pause zurueck zur Arbeit, ohne das Tracking zu stoppen", () => {
    state = {
      pomodoro: {
        active: false,
        phase: "short-break",
        pomodorosCompleted: 2,
        secondsLeft: 5 * 60,
        phaseStartedAt: null,
      },
    };

    const pomodoro = createManager();
    pomodoro.syncFromState();
    actions.length = 0;

    pomodoro.skipPhase();

    expect(stopTimer).not.toHaveBeenCalled();
    expect(getLastSaveAction()).toMatchObject({
      type: "POMODORO_SAVE",
      payload: expect.objectContaining({
        active: false,
        phase: "work",
        pomodorosCompleted: 2,
        secondsLeft: 25 * 60,
      }),
    });
  });

  it("skipPhase() wechselt nach dem vierten Pomodoro in die lange Pause", () => {
    state = {
      pomodoro: {
        active: false,
        phase: "work",
        pomodorosCompleted: 3,
        secondsLeft: 25 * 60,
        phaseStartedAt: null,
      },
    };

    const pomodoro = createManager();
    pomodoro.syncFromState();
    actions.length = 0;

    pomodoro.skipPhase();

    expect(stopTimer).toHaveBeenCalledWith({ autoStopNote: "Pomodoro-Phase manuell übersprungen" });
    expect(getLastSaveAction()).toMatchObject({
      type: "POMODORO_SAVE",
      payload: expect.objectContaining({
        phase: "long-break",
        pomodorosCompleted: 4,
        active: false,
      }),
    });
  });

  it("save() speichert eine aktive Arbeitsphase, ohne den Pomodoro-Fortschritt zurueckzusetzen", async () => {
    const pomodoro = createManager();

    await pomodoro.start();
    actions.length = 0;

    pomodoro.save();

    expect(stopTimer).toHaveBeenCalledWith({ autoStopNote: "Pomodoro manuell gespeichert" });
    expect(getLastSaveAction()).toMatchObject({
      type: "POMODORO_SAVE",
      payload: expect.objectContaining({
        active: false,
        phase: "work",
        pomodorosCompleted: 0,
        phaseStartedAt: null,
      }),
    });
  });

  it("save() macht ausserhalb einer aktiven Arbeitsphase nichts", () => {
    state = {
      pomodoro: {
        active: false,
        phase: "long-break",
        pomodorosCompleted: 4,
        secondsLeft: 15 * 60,
        phaseStartedAt: null,
      },
    };

    const pomodoro = createManager();
    pomodoro.syncFromState();
    actions.length = 0;

    pomodoro.save();

    expect(stopTimer).not.toHaveBeenCalled();
    expect(actions).toEqual([]);
  });

  it("reset() loescht den Fortschritt und stoppt das Tracking waehrend der Arbeitsphase", async () => {
    const pomodoro = createManager();

    await pomodoro.start();
    actions.length = 0;

    pomodoro.reset();

    expect(stopTimer).toHaveBeenCalledWith({ autoStopNote: "Pomodoro zurückgesetzt" });
    expect(pomodoro.getState()).toEqual({
      active: false,
      phase: "work",
      pomodorosCompleted: 0,
      secondsLeft: 25 * 60,
      formattedCountdown: "25:00",
    });
  });

  it("reset() setzt waehrend einer Pause auf Arbeit zurueck, ohne das Tracking zu stoppen", () => {
    state = {
      pomodoro: {
        active: false,
        phase: "short-break",
        pomodorosCompleted: 2,
        secondsLeft: 5 * 60,
        phaseStartedAt: null,
      },
    };

    const pomodoro = createManager();
    pomodoro.syncFromState();
    actions.length = 0;

    pomodoro.reset();

    expect(stopTimer).not.toHaveBeenCalled();
    expect(pomodoro.getState()).toEqual({
      active: false,
      phase: "work",
      pomodorosCompleted: 0,
      secondsLeft: 25 * 60,
      formattedCountdown: "25:00",
    });
  });

  it("cancel() speichert den aktuellen Pomodoro-Status, ohne einen Tracking-Eintrag zu erzeugen", async () => {
    const pomodoro = createManager();

    await pomodoro.start();
    actions.length = 0;

    pomodoro.cancel();

    expect(stopTimer).not.toHaveBeenCalled();
    expect(getLastSaveAction()).toMatchObject({
      type: "POMODORO_SAVE",
      payload: expect.objectContaining({
        active: false,
        phase: "work",
        phaseStartedAt: null,
      }),
    });
  });

  it("syncFromState() stellt eine inaktive kurze Pause mit Standarddauer als Fallback wieder her", () => {
    state = {
      pomodoro: {
        active: false,
        phase: "short-break",
        pomodorosCompleted: 1,
        phaseStartedAt: null,
      },
    };

    const pomodoro = createManager();
    pomodoro.syncFromState();

    expect(pomodoro.getState()).toEqual({
      active: false,
      phase: "short-break",
      pomodorosCompleted: 1,
      secondsLeft: 5 * 60,
      formattedCountdown: "05:00",
    });
  });

  it("syncFromState() ignoriert einen fehlenden gespeicherten Pomodoro-Status", () => {
    state = { pomodoro: null };

    const pomodoro = createManager();
    pomodoro.syncFromState();

    expect(actions).toEqual([]);
    expect(pomodoro.getState()).toEqual({
      active: false,
      phase: "work",
      pomodorosCompleted: 0,
      secondsLeft: 25 * 60,
      formattedCountdown: "25:00",
    });
  });

  it("syncFromState() verwendet den Phasen-Fallback fuer aktive Statuswerte ohne gespeicherte Sekunden", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:02.000Z"));
    state = {
      pomodoro: {
        active: true,
        phase: "unknown-phase",
        pomodorosCompleted: 0,
        phaseStartedAt: "2026-04-01T12:00:00.000Z",
      },
    };

    const pomodoro = createManager();
    pomodoro.syncFromState();

    expect(pomodoro.getState()).toMatchObject({
      active: true,
      phase: "unknown-phase",
      secondsLeft: 25 * 60 - 2,
      formattedCountdown: "24:58",
    });
  });

  it("syncFromState() setzt einen aktiven Countdown mit den verbleibenden Sekunden fort", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:05.000Z"));
    state = {
      pomodoro: {
        active: true,
        phase: "work",
        pomodorosCompleted: 1,
        secondsLeft: 10,
        phaseStartedAt: "2026-04-01T12:00:00.000Z",
      },
    };

    const pomodoro = createManager();
    pomodoro.syncFromState();

    expect(pomodoro.getState()).toMatchObject({
      active: true,
      phase: "work",
      pomodorosCompleted: 1,
      secondsLeft: 5,
      formattedCountdown: "00:05",
    });

    vi.advanceTimersByTime(2000);

    expect(pomodoro.getState()).toMatchObject({
      active: true,
      secondsLeft: 3,
      formattedCountdown: "00:03",
    });
  });

  it("syncFromState() schliesst eine abgelaufene Arbeitsphase ab und benachrichtigt ueber die Pause", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:10.000Z"));
    vi.stubGlobal(
      "Notification",
      Object.assign(notificationMock, {
        permission: "granted",
        requestPermission: vi.fn(),
      })
    );

    state = {
      pomodoro: {
        active: true,
        phase: "work",
        pomodorosCompleted: 0,
        secondsLeft: 3,
        phaseStartedAt: "2026-04-01T12:00:00.000Z",
      },
    };

    const pomodoro = createManager();
    pomodoro.syncFromState();

    expect(stopTimer).toHaveBeenCalledWith({ autoStopNote: "Pomodoro #1 abgeschlossen" });
    expect(getLastSaveAction()).toMatchObject({
      type: "POMODORO_SAVE",
      payload: expect.objectContaining({
        active: false,
        phase: "short-break",
        pomodorosCompleted: 1,
        secondsLeft: 5 * 60,
      }),
    });
    expect(notificationMock).toHaveBeenCalledWith("🍅 Pomodoro #1 abgeschlossen!", {
      body: "Gut gemacht! Zeit für: Kurze Pause (5 Min.)",
    });
  });

  it("syncFromState() schliesst eine abgelaufene Pause ab und benachrichtigt ueber die Rueckkehr zur Arbeit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:20:00.000Z"));
    vi.stubGlobal(
      "Notification",
      Object.assign(notificationMock, {
        permission: "granted",
        requestPermission: vi.fn(),
      })
    );

    state = {
      pomodoro: {
        active: true,
        phase: "long-break",
        pomodorosCompleted: 4,
        secondsLeft: 5,
        phaseStartedAt: "2026-04-01T12:00:00.000Z",
      },
    };

    const pomodoro = createManager();
    pomodoro.syncFromState();

    expect(stopTimer).not.toHaveBeenCalled();
    expect(getLastSaveAction()).toMatchObject({
      type: "POMODORO_SAVE",
      payload: expect.objectContaining({
        active: false,
        phase: "work",
        pomodorosCompleted: 4,
        secondsLeft: 25 * 60,
      }),
    });
    expect(notificationMock).toHaveBeenCalledWith("⏰ Pause vorbei!", {
      body: "Weiter geht's – nächste Arbeitsphase kann starten.",
    });
  });

  it("ein ablaufender Countdown wechselt waehrend der Laufzeit von Arbeit zu kurzer Pause", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "Notification",
      Object.assign(notificationMock, {
        permission: "granted",
        requestPermission: vi.fn(),
      })
    );

    const pomodoro = createManager();
    await pomodoro.start();
    state = {
      pomodoro: {
        active: true,
        phase: "work",
        pomodorosCompleted: 0,
        secondsLeft: 1,
        phaseStartedAt: new Date().toISOString(),
      },
    };

    pomodoro.syncFromState();
    actions.length = 0;
    vi.advanceTimersByTime(1000);

    expect(stopTimer).toHaveBeenCalledWith({ autoStopNote: "Pomodoro #1 abgeschlossen" });
    expect(pomodoro.getState()).toMatchObject({
      active: false,
      phase: "short-break",
      pomodorosCompleted: 1,
      secondsLeft: 5 * 60,
    });
  });

  it("saveAndReset() speichert die aktuelle Arbeitsphase und setzt danach den gesamten Pomodoro-Fortschritt zurueck", async () => {
    const pomodoro = createManager();

    await pomodoro.start();
    actions.length = 0;

    pomodoro.saveAndReset();

    expect(stopTimer).toHaveBeenNthCalledWith(1, {
      autoStopNote: "Pomodoro manuell gespeichert",
    });
    expect(stopTimer).toHaveBeenNthCalledWith(2, {
      autoStopNote: "Pomodoro zurückgesetzt",
    });
    expect(pomodoro.getState()).toEqual({
      active: false,
      phase: "work",
      pomodorosCompleted: 0,
      secondsLeft: 25 * 60,
      formattedCountdown: "25:00",
    });
  });

  it("dispose() stoppt den laufenden Countdown", async () => {
    vi.useFakeTimers();
    const pomodoro = createManager();

    await pomodoro.start();
    const renderCallsBeforeDispose = onRender.mock.calls.length;

    pomodoro.dispose();
    vi.advanceTimersByTime(3000);

    expect(onRender.mock.calls.length).toBe(renderCallsBeforeDispose);
    expect(pomodoro.getState()).toMatchObject({
      active: true,
      phase: "work",
      secondsLeft: 25 * 60,
    });
  });
});
