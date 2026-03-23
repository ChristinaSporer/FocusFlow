export const STORAGE_KEY = "lernzeitplaner-poc-v1";

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
    activeView: "list",
    calendarMonth: null,
    themeMode: "auto",
  },
  timer: {
    start: null,
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
      importedEvents: Array.isArray(parsed.importedEvents) ? parsed.importedEvents : [],
      settings: { ...defaults.settings, ...(parsed.settings || {}) },
      timer: { ...defaults.timer, ...(parsed.timer || {}) },
    };
  } catch {
    return defaultData();
  }
}

export function persistState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createStore(initialState = loadState()) {
  let state = initialState;

  return {
    getState() {
      return state;
    },
    replace(nextState) {
      state = nextState;
      persistState(state);
      return state;
    },
    persist() {
      persistState(state);
    },
  };
}
