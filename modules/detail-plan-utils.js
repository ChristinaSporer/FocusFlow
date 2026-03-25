export function getGoalById(state, goalId) {
  if (!goalId || !Array.isArray(state?.goals)) return null;
  return state.goals.find((goal) => goal.id === goalId) || null;
}

export function getRoughPlanById(state, roughPlanId) {
  if (!roughPlanId || !Array.isArray(state?.roughPlans)) return null;
  return state.roughPlans.find((plan) => plan.id === roughPlanId) || null;
}

export function getMilestoneById(goal, milestoneId) {
  if (!goal || !milestoneId || !Array.isArray(goal.milestones)) return null;
  return goal.milestones.find((milestone) => milestone.id === milestoneId) || null;
}

export function resolveDetailPlanContext(state, item) {
  const roughPlan = getRoughPlanById(state, item?.roughPlanId);
  const goal = getGoalById(state, item?.goalId || roughPlan?.goalId);
  const milestone = getMilestoneById(goal, item?.milestoneId);

  return {
    roughPlan,
    goal,
    milestone,
  };
}
