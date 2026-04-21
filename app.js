import { byId } from "./modules/dom.js";
import { monthOf, nowIso } from "./modules/date-utils.js";
import { appReducer } from "./modules/app-reducer.js";
import {
  renderDetailPlans,
  renderGoals,
  renderPomodoro,
  renderRoughPlans,
  renderStats,
  renderTimerDetailPlanSelect,
  renderTrackedSessions,
} from "./modules/render-main-view.js";
import { createStore, defaultData, loadState } from "./modules/state-store.js";
import { buildDemoState } from "./modules/demo-data.js";
import { initFormHandlers } from "./modules/form-handlers.js";
import { createThemeManager, normalizeThemeMode } from "./modules/theme-manager.js";
import { createTimerManager } from "./modules/timer-manager.js";
import { createPomodoroManager } from "./modules/pomodoro-manager.js";
import { createCalendarManager } from "./modules/calendar-manager.js";
import { createIcsManager } from "./modules/ics-manager.js";
import { createJsonManager } from "./modules/json-manager.js";
import { createNotificationManager } from "./modules/notification-manager.js";

const store = createStore(loadState(), appReducer);
let state = store.getState();
let handlersInitialized = false;
let goalFormController = {
  resetGoalForm() {},
  startGoalEdit() {},
};
let roughFormController = {
  populateGoalDropdown() {},
  startRoughEdit() {},
  resetRoughForm() {},
};
let trackedFormController = {
  resetTrackedForm() {},
  startTrackedEdit() {},
};
let detachMainCardCollapse = null;

function getMainCardDefaultCollapsed() {
  if (typeof window.matchMedia !== "function") return false;
  return !window.matchMedia("(min-width: 1200px)").matches;
}

function setMainCardCollapsed(toggleButton, cardBody, collapsed) {
  cardBody.classList.toggle("d-none", collapsed);
  toggleButton.setAttribute("aria-expanded", String(!collapsed));
  toggleButton.setAttribute("aria-label", collapsed ? "Bereich ausklappen" : "Bereich einklappen");
  toggleButton.title = collapsed ? "Bereich ausklappen" : "Bereich einklappen";
  toggleButton.innerHTML = collapsed
    ? '<i class="bi bi-chevron-down" aria-hidden="true"></i>'
    : '<i class="bi bi-chevron-up" aria-hidden="true"></i>';
}

function initMainCardCollapse() {
  const cardToggles = Array.from(document.querySelectorAll("[data-main-card-toggle]"));
  const controls = cardToggles
    .map((toggleButton) => {
      const key = toggleButton.getAttribute("data-main-card-toggle");
      const cardBody = document.querySelector(`[data-main-card-body="${key}"]`);
      if (!cardBody) return null;
      return { toggleButton, cardBody };
    })
    .filter(Boolean);

  if (!controls.length) return () => {};

  function applyDefaultCollapsedState() {
    const collapsed = getMainCardDefaultCollapsed();
    controls.forEach(({ toggleButton, cardBody }) => {
      setMainCardCollapsed(toggleButton, cardBody, collapsed);
    });
  }

  controls.forEach(({ toggleButton, cardBody }) => {
    toggleButton.addEventListener("click", () => {
      const shouldCollapse = !cardBody.classList.contains("d-none");
      setMainCardCollapsed(toggleButton, cardBody, shouldCollapse);
    });
  });

  applyDefaultCollapsedState();

  if (typeof window.matchMedia !== "function") return () => {};

  const mediaQuery = window.matchMedia("(min-width: 1200px)");
  const handleBreakpointChange = () => {
    applyDefaultCollapsedState();
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleBreakpointChange);
    return () => mediaQuery.removeEventListener("change", handleBreakpointChange);
  }

  if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(handleBreakpointChange);
    return () => mediaQuery.removeListener(handleBreakpointChange);
  }

  return () => {};
}

function getState() {
  return state;
}

function dispatch(action) {
  state = store.dispatch(action);
  return state;
}

function touchActivity() {
  dispatch({ type: "TOUCH_ACTIVITY", payload: { timestamp: nowIso() } });
}

function renderAll() {
  const selectedMonth = byId("month-select")?.value || monthOf(new Date());
  const renderContext = { state: getState(), dispatch, onRenderAll: renderAll };

  // Apply the active tab/view immediately before heavy rendering.
  calendarManager.renderViewState();

  roughFormController.populateGoalDropdown?.(getState());
  renderGoals({
    ...renderContext,
    onActivity: touchActivity,
    onEditGoal: goalFormController.startGoalEdit,
  });
  renderRoughPlans({
    ...renderContext,
    onEditRoughPlan: roughFormController.startRoughEdit,
  });
  renderDetailPlans({
    ...renderContext,
    selectedMonth,
    onActivity: touchActivity,
    onStartTrackingDetail: timerManager.startTimerForDetailPlan,
  });
  renderTimerDetailPlanSelect({ state: getState() });
  renderTrackedSessions({
    ...renderContext,
    onEditTrackedSession: trackedFormController.startTrackedEdit,
  });
  renderStats({ state: getState(), currentMonth: selectedMonth });
  timerManager.renderTimer();
  const isRunning = Boolean(getState().timer?.start);
  const isPaused = timerManager.isPaused?.() || false;
  byId("timer-start")?.classList.toggle("d-none", isRunning && !isPaused);
  byId("timer-pause")?.classList.toggle("d-none", !isRunning || isPaused);
  byId("timer-stop")?.classList.toggle("d-none", !isRunning);
  renderPomodoro({ pomodoroState: pomodoroManager.getState() });
  calendarManager.renderCalendar();
  notificationManager.sync();
}

function loadDemoData() {
  const themeMode = normalizeThemeMode(getState().settings.themeMode);
  dispatch({
    type: "REPLACE_STATE",
    payload: {
      state: {
        ...defaultData(),
        ...buildDemoState({ themeMode }),
      },
    },
  });
  goalFormController.resetGoalForm?.();
  roughFormController.resetRoughForm?.();
  trackedFormController.resetTrackedForm?.();
  setInitialValues();
}

function setInitialValues() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthSelect = byId("month-select");
  if (monthSelect) {
    monthSelect.value = month;
  }
  if (monthSelect && !getState().settings.calendarMonth) {
    dispatch({ type: "SET_CALENDAR_MONTH", payload: { month } });
  }

  const manualTrackDate = byId("track-manual-date");
  if (manualTrackDate && !manualTrackDate.value) {
    manualTrackDate.value = now.toISOString().slice(0, 10);
  }

  const currentThemeMode = getState().settings.themeMode;
  const normalizedTheme = normalizeThemeMode(currentThemeMode);
  if (normalizedTheme !== currentThemeMode) {
    dispatch({ type: "SET_THEME_MODE", payload: { themeMode: normalizedTheme } });
  }

  themeManager.applyTheme();
  timerManager.syncFromState();
  pomodoroManager.syncFromState();
}

function initHandlers() {
  if (handlersInitialized) return;

  const handlersResult = initFormHandlers({
    dispatch,
    renderAll,
    getState,
    touchActivity,
    defaultData,
    setInitialValues,
    loadDemoData,
    normalizeThemeMode,
    applyTheme: themeManager.applyTheme,
    getCalendarMonth: calendarManager.getCalendarMonth,
    setCalendarMonth: calendarManager.setCalendarMonth,
    renderCalendar: calendarManager.renderCalendar,
    startTimer: timerManager.startTimer,
    stopTimer: timerManager.stopTimer,
    setSelectedTimerDetailPlan: timerManager.setSelectedDetailPlan,
    startPomodoro: pomodoroManager.start,
    pausePomodoro: pomodoroManager.pause,
    skipPomodoroPhase: pomodoroManager.skipPhase,
    resetPomodoro: pomodoroManager.reset,
    addManualTrackedSession: timerManager.addManualSession,
    updateTrackedSession: timerManager.updateTrackedSession,
    importIcsFile: icsManager.importFromFile,
    exportIcsFile: icsManager.exportToFile,
    importJsonFile: jsonManager.importFromFile,
    exportJsonFile: jsonManager.exportToFile,
    notificationPermission: notificationManager.requestPermission,
    getNotificationPermission: notificationManager.getPermission,
    syncNotifications: notificationManager.sync,
  });

  goalFormController = {
    resetGoalForm: handlersResult.resetGoalForm,
    startGoalEdit: handlersResult.startGoalEdit,
  };

  roughFormController = {
    populateGoalDropdown: handlersResult.populateGoalDropdown,
    startRoughEdit: handlersResult.startRoughEdit,
    resetRoughForm: handlersResult.resetRoughForm,
  };

  trackedFormController = {
    resetTrackedForm: handlersResult.resetTrackedForm,
    startTrackedEdit: handlersResult.startTrackedEdit,
  };

  handlersInitialized = true;
}

const themeManager = createThemeManager({
  getThemeMode: () => getState().settings.themeMode,
});

const calendarManager = createCalendarManager({
  getState,
  dispatch,
});

const timerManager = createTimerManager({
  getState,
  dispatch,
  onActivity: touchActivity,
  onRenderAll: renderAll,
  nowIso,
});
// Für Pause/Resume Zugriff aus form-handlers.js
window.timerManagerGetElapsed = timerManager.getElapsed;

const pomodoroManager = createPomodoroManager({
  startTimer: timerManager.startTimer,
  stopTimer: timerManager.stopTimer,
  onRender: () => renderPomodoro({ pomodoroState: pomodoroManager.getState() }),
  getState,
  dispatch,
});
// Für Buttons in form-handlers.js
window.pomodoroManagerSaveAndReset = pomodoroManager.saveAndReset;

const icsManager = createIcsManager({
  getState,
  dispatch,
});

const jsonManager = createJsonManager({
  getState,
});

const notificationManager = createNotificationManager({
  getState,
  dispatch,
});

export function bootstrap() {
  themeManager.initSystemTheme();
  setInitialValues();
  initHandlers();
  detachMainCardCollapse?.();
  detachMainCardCollapse = initMainCardCollapse();
  renderAll();
}

export function shutdown() {
  detachMainCardCollapse?.();
  detachMainCardCollapse = null;
  timerManager.dispose();
  pomodoroManager.dispose();
  themeManager.dispose();
  notificationManager.dispose();
}
