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
    case "GOAL_UPDATE":
      return {
        ...currentState,
        goals: currentState.goals.map((item) =>
          item.id === action.payload.goal.id ? { ...item, ...action.payload.goal } : item
        ),
      };
    case "GOAL_ADD_MILESTONE":
      return {
        ...currentState,
        goals: currentState.goals.map((item) =>
          item.id === action.payload.goalId
            ? {
                ...item,
                milestones: [...(item.milestones || []), action.payload.milestone],
              }
            : item
        ),
      };
    case "GOAL_TOGGLE_MILESTONE":
      return {
        ...currentState,
        goals: currentState.goals.map((item) =>
          item.id === action.payload.goalId
            ? {
                ...item,
                milestones: (item.milestones || []).map((milestone) =>
                  milestone.id === action.payload.milestoneId
                    ? { ...milestone, done: action.payload.done }
                    : milestone
                ),
              }
            : item
        ),
      };
    case "GOAL_UPDATE_MILESTONE":
      return {
        ...currentState,
        goals: currentState.goals.map((item) =>
          item.id === action.payload.goalId
            ? {
                ...item,
                milestones: (item.milestones || []).map((milestone) =>
                  milestone.id === action.payload.milestoneId
                    ? { ...milestone, title: action.payload.title }
                    : milestone
                ),
              }
            : item
        ),
      };
    case "GOAL_DELETE_MILESTONE":
      return {
        ...currentState,
        goals: currentState.goals.map((item) =>
          item.id === action.payload.goalId
            ? {
                ...item,
                milestones: (item.milestones || []).filter(
                  (milestone) => milestone.id !== action.payload.milestoneId
                ),
              }
            : item
        ),
      };
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
    case "ROUGH_UPDATE":
      return {
        ...currentState,
        roughPlans: currentState.roughPlans.map((item) =>
          item.id === action.payload.id ? { ...item, ...action.payload.update } : item
        ),
      };
    case "DETAIL_ADD":
      return { ...currentState, detailPlans: [...currentState.detailPlans, action.payload.plan] };
    case "DETAIL_UPDATE":
      return {
        ...currentState,
        detailPlans: currentState.detailPlans.map((item) =>
          item.id === action.payload.id ? { ...item, ...action.payload.update } : item
        ),
      };
    case "DETAIL_DELETE":
      return {
        ...currentState,
        detailPlans: currentState.detailPlans.filter((item) => item.id !== action.payload.id),
        timer:
          currentState.timer?.selectedDetailPlanId === action.payload.id
            ? {
                ...currentState.timer,
                selectedDetailPlanId: null,
              }
            : currentState.timer,
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
        trackedSessions: currentState.trackedSessions.filter(
          (item) => item.id !== action.payload.id
        ),
      };
    case "TRACKED_ADD":
      return {
        ...currentState,
        trackedSessions: [...currentState.trackedSessions, action.payload.session],
      };
    case "TRACKED_UPDATE":
      return {
        ...currentState,
        trackedSessions: currentState.trackedSessions.map((item) =>
          item.id === action.payload.session.id ? { ...item, ...action.payload.session } : item
        ),
      };
    case "TIMER_START":
      return {
        ...currentState,
        timer: {
          ...currentState.timer,
          start: action.payload.start,
          selectedDetailPlanId: Object.prototype.hasOwnProperty.call(
            action.payload,
            "selectedDetailPlanId"
          )
            ? action.payload.selectedDetailPlanId
            : currentState.timer?.selectedDetailPlanId || null,
        },
      };
    case "TIMER_SET_SELECTED_DETAIL_PLAN":
      return {
        ...currentState,
        timer: {
          ...currentState.timer,
          selectedDetailPlanId: action.payload.detailPlanId,
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
          ...currentState.importedEvents.filter(
            (item) => item.sourceKey !== action.payload.sourceKey
          ),
          ...action.payload.events,
        ],
      };
    case "REPLACE_STATE":
      return action.payload.state;
    default:
      return currentState;
  }
}
