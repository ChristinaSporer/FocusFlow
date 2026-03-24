import { byId } from "./modules/dom.js";
import { monthOf, nowIso } from "./modules/date-utils.js";
import { appReducer } from "./modules/app-reducer.js";
import {
  renderDetailPlans,
  renderGoals,
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
import { createReminderManager } from "./modules/reminder-manager.js";
import { createCalendarManager } from "./modules/calendar-manager.js";
import { createIcsManager } from "./modules/ics-manager.js";
import { createJsonManager } from "./modules/json-manager.js";

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
  renderGoals({ ...renderContext, onActivity: touchActivity, onEditGoal: goalFormController.startGoalEdit });
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
  renderTrackedSessions(renderContext);
  renderStats({ state: getState(), currentMonth: selectedMonth });
  timerManager.renderTimer();
  reminderManager.runReminders();
  calendarManager.renderCalendar();
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
  setInitialValues();
}

function setInitialValues() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  byId("month-select").value = month;
  if (!getState().settings.calendarMonth) {
    dispatch({ type: "SET_CALENDAR_MONTH", payload: { month } });
  }

  byId("inactivity-days").value = getState().settings.inactivityDays;
  const manualTrackDate = byId("track-manual-date");
  if (manualTrackDate && !manualTrackDate.value) {
    manualTrackDate.value = now.toISOString().slice(0, 10);
  }

  const currentThemeMode = getState().settings.themeMode;
  const normalizedTheme = normalizeThemeMode(currentThemeMode);
  if (normalizedTheme !== currentThemeMode) {
    dispatch({ type: "SET_THEME_MODE", payload: { themeMode: normalizedTheme } });
  }

  const themeModeValue = getState().settings.themeMode;
  const themeModeSelect = byId("theme-mode");
  if (themeModeSelect) {
    themeModeSelect.value = themeModeValue;
  }

  const themeModeRadio = document.querySelector(`input[name="theme-mode"][value="${themeModeValue}"]`);
  if (themeModeRadio) {
    themeModeRadio.checked = true;
  }

  themeManager.applyTheme();
  timerManager.syncFromState();

  const hasNotificationApi = "Notification" in window;
  const isEnabled = getState().settings.notificationEnabled;
  if (!hasNotificationApi) {
    reminderManager.setNotificationStatus("Dieser Browser unterstützt keine Benachrichtigungen.");
  } else if (Notification.permission === "granted" && isEnabled) {
    reminderManager.setNotificationStatus("Benachrichtigungen sind aktiv.");
  } else if (Notification.permission === "denied") {
    reminderManager.setNotificationStatus(
      "Benachrichtigungen sind blockiert. Bitte in den Browser-Seiteneinstellungen erlauben."
    );
  } else {
    reminderManager.setNotificationStatus("Benachrichtigungen sind derzeit nicht aktiviert.");
  }
}

function initHandlers() {
  if (handlersInitialized) return;

  const handlersResult = initFormHandlers({
    dispatch,
    renderAll,
    touchActivity,
    defaultData,
    setInitialValues,
    loadDemoData,
    normalizeThemeMode,
    applyTheme: themeManager.applyTheme,
    activateNotifications: reminderManager.activateNotifications,
    getCalendarMonth: calendarManager.getCalendarMonth,
    setCalendarMonth: calendarManager.setCalendarMonth,
    renderCalendar: calendarManager.renderCalendar,
    startTimer: timerManager.startTimer,
    stopTimer: timerManager.stopTimer,
    setSelectedTimerDetailPlan: timerManager.setSelectedDetailPlan,
    addManualTrackedSession: timerManager.addManualSession,
    importIcsFile: icsManager.importFromFile,
    exportIcsFile: icsManager.exportToFile,
    importJsonFile: jsonManager.importFromFile,
    exportJsonFile: jsonManager.exportToFile,
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

const reminderManager = createReminderManager({
  getState,
  dispatch,
  onRenderAll: renderAll,
});

const icsManager = createIcsManager({
  getState,
  dispatch,
});

const jsonManager = createJsonManager({
  getState,
});

export function bootstrap() {
  themeManager.initSystemTheme();
  setInitialValues();
  initHandlers();
  renderAll();
  reminderManager.startLoop();
}

export function shutdown() {
  timerManager.dispose();
  reminderManager.stopLoop();
  themeManager.dispose();
}
