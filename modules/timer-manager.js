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

  function renderTimer() {
    const display = byId("timer-display");
    if (!display) return;

    const state = getState();
    if (!state.timer.start) {
      display.textContent = "00:00:00";
      return;
    }

    const elapsed = Date.now() - new Date(state.timer.start).getTime();
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

  function startTimer() {
    const state = getState();
    if (state.timer.start) return;

    dispatch({ type: "TIMER_START", payload: { start: nowIso() } });
    onActivity();
    renderTimer();
    ensureInterval();
  }

  function stopTimer() {
    const state = getState();
    if (!state.timer.start) return;

    const noteField = byId("track-note");
    const note = noteField?.value.trim() || "";
    const end = new Date();
    const start = new Date(state.timer.start);
    const minutes = Math.max(1, Math.round((end - start) / 60000));

    const session = {
      id: uid(),
      start: start.toISOString(),
      end: end.toISOString(),
      minutes,
      note,
    };

    dispatch({ type: "TIMER_STOP_AND_STORE_SESSION", payload: { session } });

    if (noteField) {
      noteField.value = "";
    }

    onActivity();
    stopInterval();
    onRenderAll();
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

  return {
    renderTimer,
    startTimer,
    stopTimer,
    syncFromState,
    dispose,
  };
}
