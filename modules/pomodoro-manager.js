const DEFAULT_WORK_MIN = 25;
const DEFAULT_SHORT_BREAK_MIN = 5;
const DEFAULT_LONG_BREAK_MIN = 15;
const POMODOROS_BEFORE_LONG_BREAK = 4;

function getPhaseDurationSeconds(phase) {
  if (phase === "work") return DEFAULT_WORK_MIN * 60;
  if (phase === "short-break") return DEFAULT_SHORT_BREAK_MIN * 60;
  if (phase === "long-break") return DEFAULT_LONG_BREAK_MIN * 60;
  return DEFAULT_WORK_MIN * 60;
}

function formatCountdown(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function sendNotification(title, body) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

export function createPomodoroManager({ startTimer, stopTimer, onRender, getState, dispatch }) {
  let active = false;
  let phase = "work";
  let pomodorosCompleted = 0;
  let secondsLeft = getPhaseDurationSeconds("work");
  let phaseStartedAt = null;
  let countdownInterval = null;

  function persist() {
    dispatch({
      type: "POMODORO_SAVE",
      payload: { active, phase, pomodorosCompleted, secondsLeft, phaseStartedAt },
    });
  }

  function stopCountdown() {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  function nextBreakPhase() {
    if (pomodorosCompleted > 0 && pomodorosCompleted % POMODOROS_BEFORE_LONG_BREAK === 0) {
      return "long-break";
    }
    return "short-break";
  }

  function onPhaseEnd() {
    stopCountdown();
    active = false;

    if (phase === "work") {
      pomodorosCompleted += 1;
      const pomodoroNumber = pomodorosCompleted;
      stopTimer({ autoStopNote: `Pomodoro #${pomodoroNumber} abgeschlossen` });

      const breakPhase = nextBreakPhase();
      phase = breakPhase;
      secondsLeft = getPhaseDurationSeconds(phase);
      phaseStartedAt = null;
      persist();

      const breakLabel =
        breakPhase === "long-break" ? "Lange Pause (15 Min.)" : "Kurze Pause (5 Min.)";
      sendNotification(
        `🍅 Pomodoro #${pomodoroNumber} abgeschlossen!`,
        `Gut gemacht! Zeit für: ${breakLabel}`
      );
    } else {
      phase = "work";
      secondsLeft = getPhaseDurationSeconds("work");
      phaseStartedAt = null;
      persist();
      sendNotification("⏰ Pause vorbei!", "Weiter geht's – nächste Arbeitsphase kann starten.");
    }

    onRender();
  }

  function startCountdown() {
    stopCountdown();
    phaseStartedAt = new Date().toISOString();
    persist();
    countdownInterval = setInterval(() => {
      secondsLeft -= 1;
      onRender();
      if (secondsLeft <= 0) {
        onPhaseEnd();
      }
    }, 1000);
  }

  async function start() {
    if (active) return;
    await requestNotificationPermission();
    active = true;
    if (phase === "work") {
      startTimer();
    }
    startCountdown();
    onRender();
  }

  function pause() {
    if (!active) return;
    active = false;
    stopCountdown();
    phaseStartedAt = null;
    persist();
    onRender();
  }

  function skipPhase() {
    stopCountdown();
    active = false;

    if (phase === "work") {
      pomodorosCompleted += 1; // Dot setzen wie bei regulärem Abschluss
      stopTimer({ autoStopNote: "Pomodoro-Phase manuell übersprungen" });
      phase = "short-break";
    } else {
      phase = "work";
    }
    secondsLeft = getPhaseDurationSeconds(phase);
    phaseStartedAt = null;
    persist();
    onRender();
  }

  function reset() {
    stopCountdown();
    active = false;
    if (phase === "work") {
      stopTimer({ autoStopNote: "Pomodoro zurückgesetzt" });
    }
    phase = "work";
    pomodorosCompleted = 0;
    secondsLeft = getPhaseDurationSeconds("work");
    phaseStartedAt = null;
    persist();
    onRender();
  }

  function getPomodoroState() {
    return {
      active,
      phase,
      pomodorosCompleted,
      secondsLeft,
      formattedCountdown: formatCountdown(secondsLeft),
    };
  }

  function syncFromState() {
    const stored = getState().pomodoro;
    if (!stored) return;

    phase = stored.phase || "work";
    pomodorosCompleted = stored.pomodorosCompleted || 0;

    if (stored.active && stored.phaseStartedAt) {
      phaseStartedAt = stored.phaseStartedAt;
      const elapsed = Math.floor(
        (Date.now() - new Date(phaseStartedAt).getTime()) / 1000
      );
      secondsLeft = Math.max(
        0,
        (typeof stored.secondsLeft === "number" ? stored.secondsLeft : getPhaseDurationSeconds(phase)) - elapsed
      );
      active = true;

      if (secondsLeft > 0) {
        stopCountdown();
        countdownInterval = setInterval(() => {
          secondsLeft -= 1;
          onRender();
          if (secondsLeft <= 0) {
            onPhaseEnd();
          }
        }, 1000);
      } else {
        onPhaseEnd();
        return;
      }
    } else {
      active = false;
      phaseStartedAt = null;
      secondsLeft =
        typeof stored.secondsLeft === "number"
          ? stored.secondsLeft
          : getPhaseDurationSeconds(phase);
    }

    onRender();
  }

  function dispose() {
    stopCountdown();
  }

  function cancel() {
    stopCountdown();
    active = false;
    phaseStartedAt = null;
    // Kein Tracking-Eintrag, nur abbrechen
    persist();
    onRender();
  }

  function save() {
    // Nur speichern, wenn in Arbeitsphase und Timer lief
    if (phase === "work" && phaseStartedAt) {
      // Optional: Berechne Minuten, falls für spätere Erweiterung benötigt
      // const start = new Date(phaseStartedAt);
      // const end = new Date();
      stopTimer({ autoStopNote: "Pomodoro manuell gespeichert" });
      stopCountdown();
      active = false;
      phaseStartedAt = null;
      persist();
      onRender();
    }
  }

  function saveAndReset() {
    save();
    reset();
  }

  return {
    start,
    pause,
    skipPhase,
    reset,
    cancel,
    save,
    saveAndReset,
    getState: getPomodoroState,
    syncFromState,
    dispose,
  };
}
