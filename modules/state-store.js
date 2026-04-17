import { normalizeGoals } from "./goal-utils.js";
import { defaultStandardLearningTimes, normalizeStandardLearningTimes } from "./planning-utils.js";

export const STORAGE_KEY = "focusflow-v1";

export const defaultData = () => ({
  goals: [],
  roughPlans: [],
  detailPlans: [],
  trackedSessions: [],
  importedEvents: [],
  settings: {
    inactivityDays: 3,
    lastReminderRun: null,
    notificationEnabled: false,
    confirmDialogsEnabled: true,
    notificationLeadMinutes: 15,
    activeView: "list",
    calendarMonth: null,
    themeMode: "auto",
    standardLearningTimes: defaultStandardLearningTimes(),
  },
  timer: {
    start: null,
    selectedDetailPlanId: null,
  },
  pomodoro: {
    active: false,
    phase: "work",
    pomodorosCompleted: 0,
    secondsLeft: 1500,
    phaseStartedAt: null,
  },
});

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultData();

  try {
    const parsed = JSON.parse(raw);
    const defaults = defaultData();

    return {
      ...defaults,
      ...parsed,
      goals: normalizeGoals(parsed.goals),
      roughPlans: Array.isArray(parsed.roughPlans)
        ? parsed.roughPlans.map((plan) => ({
            ...plan,
            plannedDays: Array.isArray(plan.plannedDays) ? plan.plannedDays : [],
          }))
        : [],
      importedEvents: Array.isArray(parsed.importedEvents) ? parsed.importedEvents : [],
      settings: {
        ...defaults.settings,
        ...(parsed.settings || {}),
        standardLearningTimes: normalizeStandardLearningTimes(
          parsed.settings?.standardLearningTimes
        ),
      },
      timer: { ...defaults.timer, ...(parsed.timer || {}) },
      pomodoro: { ...defaults.pomodoro, ...(parsed.pomodoro || {}) },
    };
  } catch {
    return defaultData();
  }
}

export function persistState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function identityReducer(state) {
  return state;
}

export function createStore(initialState = loadState(), reducer = identityReducer) {
  let state = initialState;

  function applyState(nextState) {
    state = nextState;
    persistState(state);
    return state;
  }

  return {
    getState() {
      return state;
    },
    replace(nextState) {
      return applyState(nextState);
    },
    dispatch(action) {
      const nextState = reducer(state, action);
      return applyState(nextState);
    },
    persist() {
      persistState(state);
    },
  };
}
