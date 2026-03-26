import { byId } from "./dom.js";
import { uid } from "./app-utils.js";

function toClock(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function createTimerManager({ getState, dispatch, onActivity, onRenderAll, nowIso }) {
  let timerInterval = null;
  let pausedElapsed = 0;
  let isPaused = false;

  function renderTimer() {
    const display = byId("timer-display");
    if (!display) return;

    const state = getState();
    if (!state.timer.start) {
      display.textContent = "00:00:00";
      return;
    }

    let elapsed;
    if (isPaused) {
      elapsed = pausedElapsed;
    } else {
      elapsed = Date.now() - new Date(state.timer.start).getTime() + pausedElapsed;
    }
    display.textContent = toClock(elapsed);
  }

  function stopInterval() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function ensureInterval() {
    stopInterval();
    timerInterval = setInterval(renderTimer, 1000);
  }

  function startTimer(options = {}) {
    const state = getState();
    if (state.timer.start && !options.resume) return;

    if (options.resume) {
      // Resume: Passe die Startzeit so an, dass die Pausenzeit nicht doppelt gezählt wird
      isPaused = false;
      if (state.timer.start) {
        // Berechne die neue Startzeit, indem wir die Pausenzeit auf die alte Startzeit aufschlagen
        const oldStart = new Date(state.timer.start).getTime();
        const now = Date.now();
        const pauseDuration = now - (window.__timerPausedAt || now);
        // Korrigiere Startzeit um die Pausenlänge
        const newStart = new Date(oldStart + pauseDuration);
        dispatch({
          type: "TIMER_START",
          payload: {
            start: newStart.toISOString(),
            selectedDetailPlanId: state.timer.selectedDetailPlanId || null,
          },
        });
        pausedElapsed = 0;
      }
    } else {
      isPaused = false;
      pausedElapsed = 0;
      dispatch({
        type: "TIMER_START",
        payload: {
          start: nowIso(),
          selectedDetailPlanId: state.timer.selectedDetailPlanId || null,
        },
      });
    }
    onActivity();
    renderTimer();
    ensureInterval();
  }

  function stopTimer(options = {}) {
    const state = getState();
    if (!state.timer.start) return;

    const noteField = byId("track-note");
    const baseNote = noteField?.value.trim() || "";
    const autoNote = options.autoStopNote?.trim() || "";
    const note = [baseNote, autoNote].filter(Boolean).join(" | ");
    const end = new Date();
    const start = new Date(state.timer.start);
    let elapsedMs = isPaused ? pausedElapsed : end - start + pausedElapsed;
    const minutes = Math.max(1, Math.round(elapsedMs / 60000));

    const session = {
      id: uid(),
      start: start.toISOString(),
      end: end.toISOString(),
      minutes,
      note,
      detailPlanId: state.timer.selectedDetailPlanId || null,
    };

    dispatch({ type: "TIMER_STOP_AND_STORE_SESSION", payload: { session } });

    if (noteField && options.clearNote !== false) {
      noteField.value = "";
    }

    isPaused = false;
    pausedElapsed = 0;
    onActivity();
    stopInterval();
    onRenderAll();
  }

  // Für Pause-Button: gibt die aktuell verstrichene Zeit in ms zurück
  function getElapsed() {
    const state = getState();
    if (!state.timer.start) return 0;
    if (isPaused) return pausedElapsed;
    return Date.now() - new Date(state.timer.start).getTime() + pausedElapsed;
  }

  function setSelectedDetailPlan(detailPlanId) {
    dispatch({
      type: "TIMER_SET_SELECTED_DETAIL_PLAN",
      payload: { detailPlanId: detailPlanId || null },
    });
    onRenderAll();
  }

  function startTimerForDetailPlan(detailPlanId, detailLabel) {
    const selectedDetailPlanId = detailPlanId || null;
    const stateBefore = getState();

    if (stateBefore.timer.start) {
      const switchLabel = String(detailLabel || "Detailplanung").trim();
      stopTimer({
        autoStopNote: `Automatisch beendet: Wechsel zu ${switchLabel}`,
      });
    }

    dispatch({
      type: "TIMER_SET_SELECTED_DETAIL_PLAN",
      payload: { detailPlanId: selectedDetailPlanId },
    });
    dispatch({
      type: "TIMER_START",
      payload: {
        start: nowIso(),
        selectedDetailPlanId,
      },
    });
    onActivity();
    renderTimer();
    ensureInterval();
    onRenderAll();
  }

  function addManualSession({ date, minutes, note, detailPlanId }) {
    const normalizedDate = String(date || "").trim();
    const parsedMinutes = Number(minutes);
    if (!normalizedDate || !Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      return false;
    }

    const roundedMinutes = Math.max(1, Math.round(parsedMinutes));
    const start = new Date(`${normalizedDate}T12:00:00`);
    if (Number.isNaN(start.getTime())) {
      return false;
    }

    const end = new Date(start.getTime() + roundedMinutes * 60000);
    const session = {
      id: uid(),
      start: start.toISOString(),
      end: end.toISOString(),
      minutes: roundedMinutes,
      note: String(note || "").trim(),
      detailPlanId: detailPlanId || null,
    };

    dispatch({ type: "TRACKED_ADD", payload: { session } });
    onActivity();
    onRenderAll();
    return true;
  }

  function updateTrackedSession({ id, date, minutes, note, detailPlanId }) {
    const sessionId = String(id || "").trim();
    const normalizedDate = String(date || "").trim();
    const parsedMinutes = Number(minutes);
    if (!sessionId || !normalizedDate || !Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      return false;
    }

    const existingSession = getState().trackedSessions.find((item) => item.id === sessionId);
    if (!existingSession) {
      return false;
    }

    const roundedMinutes = Math.max(1, Math.round(parsedMinutes));
    const start = new Date(`${normalizedDate}T00:00:00`);
    if (Number.isNaN(start.getTime())) {
      return false;
    }

    const existingStart = new Date(existingSession.start);
    if (Number.isNaN(existingStart.getTime())) {
      start.setHours(12, 0, 0, 0);
    } else {
      start.setHours(
        existingStart.getHours(),
        existingStart.getMinutes(),
        existingStart.getSeconds(),
        existingStart.getMilliseconds()
      );
    }

    const end = new Date(start.getTime() + roundedMinutes * 60000);
    const session = {
      ...existingSession,
      start: start.toISOString(),
      end: end.toISOString(),
      minutes: roundedMinutes,
      note: String(note || "").trim(),
      detailPlanId: detailPlanId || null,
    };

    dispatch({ type: "TRACKED_UPDATE", payload: { session } });
    onActivity();
    onRenderAll();
    return true;
  }

  function syncFromState() {
    const state = getState();
    if (state.timer.start) {
      ensureInterval();
    } else {
      stopInterval();
    }
    renderTimer();
  }

  function dispose() {
    stopInterval();
  }

  // Für Zugriff im window-Objekt (Workaround für Pause)
  if (typeof window !== "undefined") {
    window.timerManagerGetElapsed = getElapsed;
    window.timerManagerStopInterval = stopInterval;
  }
  return {
    renderTimer,
    startTimer,
    stopTimer,
    setSelectedDetailPlan,
    startTimerForDetailPlan,
    addManualSession,
    updateTrackedSession,
    syncFromState,
    dispose,
    getElapsed,
    stopInterval,
  };
}
