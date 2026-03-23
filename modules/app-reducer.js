export function appReducer(currentState, action) {
  switch (action?.type) {
    case "TOUCH_ACTIVITY":
      return {
        ...currentState,
        settings: {
          ...currentState.settings,
          lastReminderRun: action.payload.timestamp,
        },
      };
    case "GOAL_ADD":
      return { ...currentState, goals: [...currentState.goals, action.payload.goal] };
    case "GOAL_DELETE":
      return {
        ...currentState,
        goals: currentState.goals.filter((item) => item.id !== action.payload.id),
      };
    case "GOAL_SET_COMPLETED":
      return {
        ...currentState,
        goals: currentState.goals.map((item) =>
          item.id === action.payload.id
            ? {
                ...item,
                completed: action.payload.completed,
                completedAt: action.payload.completedAt,
              }
            : item
        ),
      };
    case "ROUGH_ADD":
      return { ...currentState, roughPlans: [...currentState.roughPlans, action.payload.plan] };
    case "ROUGH_DELETE":
      return {
        ...currentState,
        roughPlans: currentState.roughPlans.filter((item) => item.id !== action.payload.id),
      };
    case "DETAIL_ADD":
      return { ...currentState, detailPlans: [...currentState.detailPlans, action.payload.plan] };
    case "DETAIL_DELETE":
      return {
        ...currentState,
        detailPlans: currentState.detailPlans.filter((item) => item.id !== action.payload.id),
      };
    case "DETAIL_SET_DONE":
      return {
        ...currentState,
        detailPlans: currentState.detailPlans.map((item) =>
          item.id === action.payload.id ? { ...item, done: action.payload.done } : item
        ),
      };
    case "TRACKED_DELETE":
      return {
        ...currentState,
        trackedSessions: currentState.trackedSessions.filter((item) => item.id !== action.payload.id),
      };
    case "TIMER_START":
      return {
        ...currentState,
        timer: {
          ...currentState.timer,
          start: action.payload.start,
        },
      };
    case "TIMER_STOP_AND_STORE_SESSION":
      return {
        ...currentState,
        trackedSessions: [...currentState.trackedSessions, action.payload.session],
        timer: {
          ...currentState.timer,
          start: null,
        },
      };
    case "SET_CALENDAR_MONTH":
      return {
        ...currentState,
        settings: {
          ...currentState.settings,
          calendarMonth: action.payload.month,
        },
      };
    case "SET_ACTIVE_VIEW":
      return {
        ...currentState,
        settings: {
          ...currentState.settings,
          activeView: action.payload.view,
        },
      };
    case "SET_INACTIVITY_DAYS":
      return {
        ...currentState,
        settings: {
          ...currentState.settings,
          inactivityDays: action.payload.days,
        },
      };
    case "SET_NOTIFICATION_ENABLED":
      return {
        ...currentState,
        settings: {
          ...currentState.settings,
          notificationEnabled: action.payload.enabled,
        },
      };
    case "SET_THEME_MODE":
      return {
        ...currentState,
        settings: {
          ...currentState.settings,
          themeMode: action.payload.themeMode,
        },
      };
    case "REPLACE_IMPORTED_EVENTS":
      return {
        ...currentState,
        importedEvents: [
          ...currentState.importedEvents.filter((item) => item.sourceKey !== action.payload.sourceKey),
          ...action.payload.events,
        ],
      };
    case "REPLACE_STATE":
      return action.payload.state;
    default:
      return currentState;
  }
}
