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

export function createPomodoroManager({ startTimer, stopTimer, onRender }) {
  let active = false;
  let phase = "work";
  let pomodorosCompleted = 0;
  let secondsLeft = getPhaseDurationSeconds("work");
  let countdownInterval = null;

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

      const breakLabel =
        breakPhase === "long-break" ? "Lange Pause (15 Min.)" : "Kurze Pause (5 Min.)";
      sendNotification(
        `🍅 Pomodoro #${pomodoroNumber} abgeschlossen!`,
        `Gut gemacht! Zeit für: ${breakLabel}`
      );
    } else {
      phase = "work";
      secondsLeft = getPhaseDurationSeconds("work");
      sendNotification("⏰ Pause vorbei!", "Weiter geht's – nächste Arbeitsphase kann starten.");
    }

    onRender();
  }

  function startCountdown() {
    stopCountdown();
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
    onRender();
  }

  function skipPhase() {
    stopCountdown();
    active = false;

    if (phase === "work") {
      stopTimer({ autoStopNote: "Pomodoro-Phase manuell übersprungen" });
      phase = "short-break";
    } else {
      phase = "work";
    }
    secondsLeft = getPhaseDurationSeconds(phase);
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

  function dispose() {
    stopCountdown();
  }

  return {
    start,
    pause,
    skipPhase,
    reset,
    getState: getPomodoroState,
    dispose,
  };
}
