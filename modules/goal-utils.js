export const GOAL_COLOR_KEYS = [
  "light-blue",
  "dark-blue",
  "turquoise",
  "dark-green",
  "purple",
  "orange",
  "pink",
  "yellow",
  "blue",
  "teal",
  "green",
  "amber",
  "red",
  "rose",
  "slate",
];

export const DEFAULT_GOAL_COLOR_KEY = GOAL_COLOR_KEYS[0];

const COLOR_ALIASES = {
  blue: "dark-blue",
  teal: "turquoise",
  green: "dark-green",
  amber: "yellow",
  red: "pink",
  rose: "pink",
  slate: "purple",
};

export function normalizeGoalColorKey(rawValue) {
  if (typeof rawValue !== "string") return DEFAULT_GOAL_COLOR_KEY;
  const normalized = rawValue.trim().toLowerCase();
  return GOAL_COLOR_KEYS.includes(normalized) ? normalized : DEFAULT_GOAL_COLOR_KEY;
}

export function resolveGoalColorKey(rawValue) {
  const normalized = normalizeGoalColorKey(rawValue);
  return COLOR_ALIASES[normalized] || normalized;
}

export function normalizeGoal(goal) {
  if (!goal || typeof goal !== "object") {
    return null;
  }

  const fallbackColorKey = Object.prototype.hasOwnProperty.call(goal, "colorKey")
    ? goal.colorKey
    : "blue";

  return {
    ...goal,
    startDate: typeof goal.startDate === "string" ? goal.startDate : "",
    targetDate: typeof goal.targetDate === "string" ? goal.targetDate : "",
    workloadHours: Number.isFinite(Number(goal.workloadHours))
      ? Math.max(0, Number(goal.workloadHours))
      : 0,
    colorKey: normalizeGoalColorKey(fallbackColorKey),
    milestones: Array.isArray(goal.milestones) ? goal.milestones : [],
  };
}

export function normalizeGoals(goals) {
  if (!Array.isArray(goals)) return [];
  return goals.map(normalizeGoal).filter(Boolean);
}

export function goalColorCssVar(colorKey, shade = "base") {
  const safeKey = resolveGoalColorKey(colorKey);
  const safeShade = shade === "soft" ? "soft" : "base";
  return `var(--goal-color-${safeKey}-${safeShade})`;
}

export function formatMinutesAsHoursLabel(minutes) {
  const safeMinutes = Math.max(0, Number(minutes || 0));
  const hours = safeMinutes / 60;
  return `${hours.toFixed(1)} h`;
}
