import { byId } from "./dom.js";
import { formatDate, monthOf, nowIso, weekOverlapsMonth } from "./date-utils.js";
import { resolveDetailPlanContext } from "./detail-plan-utils.js";
import { buildRow, renderEmptyList } from "./list-render-utils.js";
import { uid } from "./app-utils.js";
import { formatMinutesAsHoursLabel, goalColorCssVar, normalizeGoalColorKey } from "./goal-utils.js";

function formatLegacyCalendarWeek(weekValue = "") {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(String(weekValue).trim());
  if (!match) return weekValue || "";
  return `KW ${Number(match[2])}/${match[1]}`;
}

function toMinutes(hours) {
  return Math.round(Number(hours) * 60);
}

function sum(array) {
  return array.reduce((acc, value) => acc + value, 0);
}

function parseTimeToMinutes(value) {
  if (typeof value !== "string" || !value.includes(":")) return NaN;
  const [hoursPart, minutesPart] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return NaN;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
  return hours * 60 + minutes;
}

function formatMinutesAsTime(totalMinutes) {
  const normalized = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getDetailPlanFocusTitle(state, detailPlan) {
  const { milestone } = resolveDetailPlanContext(state, detailPlan);
  return milestone?.title || detailPlan.milestone || detailPlan.topic || "Detailplanung";
}

function buildDetailPlanSelectionLabel(state, detailPlan) {
  const { goal } = resolveDetailPlanContext(state, detailPlan);
  const focusTitle = getDetailPlanFocusTitle(state, detailPlan);
  const parts = [formatDate(detailPlan.date), focusTitle];
  if (goal?.title) {
    parts.push(goal.title);
  }
  if (detailPlan.startTime && detailPlan.endTime) {
    parts.push(`${detailPlan.startTime}-${detailPlan.endTime}`);
  }
  return parts.filter(Boolean).join(" · ");
}

function isDetailPlanHiddenByCompletion(state, item) {
  const goalsById = new Map((state.goals || []).map((goal) => [goal.id, goal]));
  const completedMilestoneIds = new Set(
    (state.goals || []).flatMap((goal) =>
      (goal.milestones || []).filter((milestone) => milestone.done).map((milestone) => milestone.id)
    )
  );
  if (item.goalId && goalsById.get(item.goalId)?.completed) return true;
  if (item.milestoneId && completedMilestoneIds.has(item.milestoneId)) return true;
  return false;
}

export function renderGoals({ state, dispatch, onActivity, onRenderAll, onEditGoal }) {
  const list = byId("goal-list");
  const achieved = byId("achieved-list");

  const collapsedGoalState = new Map(
    Array.from(list.querySelectorAll("[data-goal-body]")).map((node) => [
      node.getAttribute("data-goal-body"),
      node.classList.contains("d-none"),
    ])
  );

  const goalItems = [];

  function updateCollapseAllButton() {
    const collapseAllBtn = byId("goal-collapse-all");
    if (!collapseAllBtn) return;
    const anyExpanded = goalItems.some(
      ({ milestoneSection }) => !milestoneSection.classList.contains("d-none")
    );
    collapseAllBtn.innerHTML = anyExpanded
      ? '<i class="bi bi-arrows-collapse" aria-hidden="true"></i>'
      : '<i class="bi bi-arrows-expand" aria-hidden="true"></i>';
    collapseAllBtn.setAttribute("aria-label", anyExpanded ? "Alle einklappen" : "Alle ausklappen");
    collapseAllBtn.title = anyExpanded ? "Alle einklappen" : "Alle ausklappen";
  }

  function setGoalCollapsed(toggleButton, goalBody, collapsed) {
    goalBody.classList.toggle("d-none", collapsed);
    toggleButton.setAttribute("aria-expanded", String(!collapsed));
    toggleButton.setAttribute("aria-label", collapsed ? "Ausklappen" : "Einklappen");
    toggleButton.title = collapsed ? "Ausklappen" : "Einklappen";
    toggleButton.innerHTML = collapsed
      ? '<i class="bi bi-chevron-down" aria-hidden="true"></i>'
      : '<i class="bi bi-chevron-up" aria-hidden="true"></i>';
  }

  list.innerHTML = "";
  achieved.innerHTML = "";

  const trackedMinutesByDetailId = (state.trackedSessions || []).reduce((map, session) => {
    if (!session.detailPlanId) return map;
    map.set(
      session.detailPlanId,
      (map.get(session.detailPlanId) || 0) + Number(session.minutes || 0)
    );
    return map;
  }, new Map());

  const plannedByGoalId = new Map();
  const trackedByGoalId = new Map();
  const plannedByMilestoneId = new Map();
  const trackedByMilestoneId = new Map();
  (state.detailPlans || []).forEach((plan) => {
    const planned = Number(plan.minutes || 0);
    const tracked = trackedMinutesByDetailId.get(plan.id) || 0;
    if (plan.goalId) {
      plannedByGoalId.set(plan.goalId, (plannedByGoalId.get(plan.goalId) || 0) + planned);
      trackedByGoalId.set(plan.goalId, (trackedByGoalId.get(plan.goalId) || 0) + tracked);
    }
    if (plan.milestoneId) {
      plannedByMilestoneId.set(
        plan.milestoneId,
        (plannedByMilestoneId.get(plan.milestoneId) || 0) + planned
      );
      trackedByMilestoneId.set(
        plan.milestoneId,
        (trackedByMilestoneId.get(plan.milestoneId) || 0) + tracked
      );
    }
  });

  const sorted = [...state.goals].sort((a, b) =>
    (a.targetDate || "").localeCompare(b.targetDate || "")
  );

  sorted.forEach((goal) => {
    const goalColorKey = normalizeGoalColorKey(goal.colorKey);
    const goalBaseColor = goalColorCssVar(goalColorKey, "base");
    const milestones = Array.isArray(goal.milestones) ? goal.milestones : [];
    const completedMilestones = milestones.filter((milestone) => milestone.done).length;

    if (goal.completed) {
      const doneRow = document.createElement("li");
      doneRow.className = "list-group-item list-group-item-success";

      const doneWrap = document.createElement("div");
      doneWrap.className = "d-flex flex-column gap-1";

      const doneTitleRow = document.createElement("label");
      doneTitleRow.className = "form-check d-flex align-items-start gap-2 mb-0";

      const doneCheckbox = document.createElement("input");
      doneCheckbox.type = "checkbox";
      doneCheckbox.checked = true;
      doneCheckbox.title = "Als offen markieren";
      doneCheckbox.className = "form-check-input mt-1";
      doneCheckbox.setAttribute("data-goal-toggle", goal.id);
      doneCheckbox.addEventListener("change", () => {
        dispatch({
          type: "GOAL_SET_COMPLETED",
          payload: {
            id: goal.id,
            completed: doneCheckbox.checked,
            completedAt: doneCheckbox.checked ? nowIso() : null,
          },
        });
        onActivity();
        onRenderAll();
      });

      const doneTitleText = document.createElement("span");
      doneTitleText.textContent = goal.title;
      doneTitleText.className = "text-body-secondary";

      doneTitleRow.append(doneCheckbox, doneTitleText);
      doneWrap.appendChild(doneTitleRow);

      if (goal.description) {
        const doneDescription = document.createElement("small");
        doneDescription.className = "text-body-secondary";
        doneDescription.textContent = goal.description;
        doneWrap.appendChild(doneDescription);
      }

      const doneTimeSummary = document.createElement("small");
      doneTimeSummary.className = "text-body-secondary";
      const donePlannedMinutes = plannedByGoalId.get(goal.id) || 0;
      const doneTrackedMinutes = trackedByGoalId.get(goal.id) || 0;
      doneTimeSummary.textContent = `Zeit geplant: ${donePlannedMinutes} Min (${formatMinutesAsHoursLabel(donePlannedMinutes)}) · Lernzeit verwendet: ${doneTrackedMinutes} Min (${formatMinutesAsHoursLabel(doneTrackedMinutes)})`;
      doneWrap.appendChild(doneTimeSummary);

      if (milestones.length) {
        const milestoneSummary = document.createElement("small");
        milestoneSummary.className = "text-body-secondary";
        milestoneSummary.textContent = `Zwischenziele erledigt: ${completedMilestones}/${milestones.length}`;
        doneWrap.appendChild(milestoneSummary);

        const milestoneList = document.createElement("ul");
        milestoneList.className = "mb-0 ps-3 small text-body-secondary";
        milestones.forEach((milestone) => {
          const milestoneItem = document.createElement("li");
          milestoneItem.textContent = milestone.done
            ? `${milestone.title} (erledigt)`
            : `${milestone.title} (offen)`;
          milestoneList.appendChild(milestoneItem);
        });
        doneWrap.appendChild(milestoneList);
      }

      const reachedAt = document.createElement("small");
      reachedAt.className = "text-body-secondary";
      reachedAt.textContent = `Erreicht am ${formatDate(goal.completedAt)}`;
      doneWrap.appendChild(reachedAt);

      doneRow.appendChild(doneWrap);
      achieved.appendChild(doneRow);
      return;
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = goal.completed;
    checkbox.title = "Als erreicht markieren";
    checkbox.addEventListener("change", () => {
      dispatch({
        type: "GOAL_SET_COMPLETED",
        payload: {
          id: goal.id,
          completed: checkbox.checked,
          completedAt: checkbox.checked ? nowIso() : null,
        },
      });
      onActivity();
      onRenderAll();
    });

    const editButton = document.createElement("button");
    editButton.className = "btn btn-outline-secondary btn-sm";
    editButton.type = "button";
    editButton.setAttribute("aria-label", "Bearbeiten");
    editButton.setAttribute("data-goal-edit", goal.id);
    editButton.innerHTML = '<i class="bi bi-pencil"></i>';
    editButton.addEventListener("click", () => {
      onEditGoal?.(goal);
    });

    const toggleButton = document.createElement("button");
    toggleButton.className = "btn btn-outline-primary btn-sm";
    toggleButton.type = "button";
    toggleButton.setAttribute("data-goal-collapse-toggle", goal.id);

    const goalDetails = [];
    if (goal.startDate) {
      goalDetails.push(`Start ${formatDate(goal.startDate)}`);
    }
    goalDetails.push(goal.targetDate ? `Ende ${formatDate(goal.targetDate)}` : "Ende wird geplant");
    goalDetails.push(`Workload ${Number(goal.workloadHours || 0).toFixed(1)} h`);
    if (goal.description) {
      goalDetails.push(goal.description);
    }
    if (milestones.length) {
      goalDetails.push(`Zwischenziele: ${completedMilestones}/${milestones.length} erledigt`);
    }

    const goalRow = buildRow(goal.title, goalDetails.join(" · "), {
      done: goal.completed,
      onDelete: () => {
        dispatch({ type: "GOAL_DELETE", payload: { id: goal.id } });
        onRenderAll();
      },
      actions: [editButton],
    });
    goalRow.style.borderLeftColor = goalBaseColor;
    goalRow.style.boxShadow = `0 10px 20px -18px ${goalBaseColor}`;

    const info = goalRow.querySelector(".flex-grow-1");
    const titleElement = info.querySelector("span");

    const goalTitleRow = document.createElement("label");
    goalTitleRow.className = "form-check d-flex align-items-start gap-2 mb-0";

    checkbox.classList.add("form-check-input", "mt-1");
    checkbox.setAttribute("data-goal-toggle", goal.id);

    const goalTitleText = document.createElement("span");
    goalTitleText.textContent = goal.title;
    if (goal.completed) {
      goalTitleText.classList.add("text-decoration-line-through", "text-body-secondary");
    }

    goalTitleRow.append(checkbox, goalTitleText);
    titleElement.replaceWith(goalTitleRow);

    const goalPlanned = plannedByGoalId.get(goal.id) || 0;
    const goalTracked = trackedByGoalId.get(goal.id) || 0;
    if (goalPlanned > 0) {
      const goalProgressPercent = Math.min(100, Math.round((goalTracked / goalPlanned) * 100));
      const goalTrackedText = document.createElement("small");
      goalTrackedText.className = "text-body-secondary";
      goalTrackedText.textContent = `Geplant: ${goalPlanned} Min · Getrackt: ${goalTracked} Min`;
      const goalProgressWrap = document.createElement("div");
      goalProgressWrap.className = "progress";
      const goalProgressBar = document.createElement("div");
      goalProgressBar.className = "progress-bar bg-info";
      goalProgressBar.setAttribute("role", "progressbar");
      goalProgressBar.setAttribute("aria-valuemin", "0");
      goalProgressBar.setAttribute("aria-valuemax", "100");
      goalProgressBar.setAttribute("aria-valuenow", String(goalProgressPercent));
      goalProgressBar.style.width = `${goalProgressPercent}%`;
      goalProgressWrap.appendChild(goalProgressBar);
      info.append(goalTrackedText, goalProgressWrap);
    }

    const milestoneSection = document.createElement("div");
    milestoneSection.className = "mt-2";
    milestoneSection.setAttribute("data-goal-body", goal.id);

    const milestoneHeading = document.createElement("small");
    milestoneHeading.className = "text-body-secondary d-block mb-1";
    milestoneHeading.textContent = "Zwischenziele";
    milestoneSection.appendChild(milestoneHeading);

    if (milestones.length) {
      const milestoneList = document.createElement("div");
      milestoneList.className = "d-flex flex-column gap-1";

      milestones.forEach((milestone) => {
        const milestoneRow = document.createElement("div");
        milestoneRow.className = "d-flex align-items-start gap-2 flex-wrap";

        const label = document.createElement("label");
        label.className = "form-check d-flex align-items-start gap-2 mb-0 flex-grow-1";

        const milestoneCheckbox = document.createElement("input");
        milestoneCheckbox.type = "checkbox";
        milestoneCheckbox.className = "form-check-input mt-1";
        milestoneCheckbox.setAttribute("data-goal-milestone-toggle", milestone.id);
        milestoneCheckbox.checked = Boolean(milestone.done);
        milestoneCheckbox.addEventListener("change", () => {
          dispatch({
            type: "GOAL_TOGGLE_MILESTONE",
            payload: {
              goalId: goal.id,
              milestoneId: milestone.id,
              done: milestoneCheckbox.checked,
            },
          });
          onActivity();
          onRenderAll();
        });

        const milestoneText = document.createElement("span");
        milestoneText.textContent = milestone.title;
        milestoneText.setAttribute("data-goal-milestone-title", milestone.id);
        if (milestone.done) {
          milestoneText.classList.add("text-decoration-line-through", "text-body-secondary");
        }

        const milestoneContent = document.createElement("span");
        milestoneContent.className = "d-flex flex-column gap-1 flex-grow-1";
        milestoneContent.appendChild(milestoneText);

        const editMilestoneButton = document.createElement("button");
        editMilestoneButton.type = "button";
        editMilestoneButton.className = "btn btn-outline-secondary btn-sm";
        editMilestoneButton.setAttribute("aria-label", "Bearbeiten");
        editMilestoneButton.innerHTML = '<i class="bi bi-pencil"></i>';
        editMilestoneButton.setAttribute("data-goal-milestone-edit", milestone.id);
        editMilestoneButton.addEventListener("click", () => {
          label.classList.add("d-none");
          editMilestoneButton.classList.add("d-none");
          deleteMilestoneButton.classList.add("d-none");
          inlineEditForm.classList.remove("d-none");
          inlineEditInput.focus();
          inlineEditInput.select();
        });

        const deleteMilestoneButton = document.createElement("button");
        deleteMilestoneButton.type = "button";
        deleteMilestoneButton.className = "btn btn-outline-danger btn-sm";
        deleteMilestoneButton.setAttribute("aria-label", "Löschen");
        deleteMilestoneButton.innerHTML = '<i class="bi bi-trash"></i>';
        deleteMilestoneButton.setAttribute("data-goal-milestone-delete", milestone.id);
        deleteMilestoneButton.addEventListener("click", () => {
          const ok = confirm("Zwischenziel wirklich löschen?");
          if (!ok) return;

          dispatch({
            type: "GOAL_DELETE_MILESTONE",
            payload: {
              goalId: goal.id,
              milestoneId: milestone.id,
            },
          });
          onActivity();
          onRenderAll();
        });

        const inlineEditForm = document.createElement("form");
        inlineEditForm.className = "d-none d-flex flex-wrap gap-2 flex-grow-1 align-items-start";
        inlineEditForm.setAttribute("data-goal-milestone-inline-edit", milestone.id);

        const inlineEditInput = document.createElement("input");
        inlineEditInput.type = "text";
        inlineEditInput.className = "form-control form-control-sm";
        inlineEditInput.value = milestone.title;
        inlineEditInput.setAttribute("aria-label", `Zwischenziel bearbeiten: ${milestone.title}`);

        const saveMilestoneButton = document.createElement("button");
        saveMilestoneButton.type = "submit";
        saveMilestoneButton.className = "btn btn-primary btn-sm";
        saveMilestoneButton.textContent = "Speichern";

        const cancelMilestoneButton = document.createElement("button");
        cancelMilestoneButton.type = "button";
        cancelMilestoneButton.className = "btn btn-outline-secondary btn-sm";
        cancelMilestoneButton.textContent = "Abbrechen";
        cancelMilestoneButton.addEventListener("click", () => {
          inlineEditInput.value = milestone.title;
          inlineEditForm.classList.add("d-none");
          label.classList.remove("d-none");
          editMilestoneButton.classList.remove("d-none");
          deleteMilestoneButton.classList.remove("d-none");
        });

        inlineEditForm.addEventListener("submit", (event) => {
          event.preventDefault();
          const title = inlineEditInput.value.trim();
          if (!title) return;

          dispatch({
            type: "GOAL_UPDATE_MILESTONE",
            payload: {
              goalId: goal.id,
              milestoneId: milestone.id,
              title,
            },
          });
          onActivity();
          onRenderAll();
        });

        inlineEditForm.append(inlineEditInput, saveMilestoneButton, cancelMilestoneButton);

        const msPlanned = plannedByMilestoneId.get(milestone.id) || 0;
        const msTracked = trackedByMilestoneId.get(milestone.id) || 0;
        if (msPlanned > 0) {
          const msProgressPercent = Math.min(100, Math.round((msTracked / msPlanned) * 100));
          const msTrackedText = document.createElement("small");
          msTrackedText.className = "text-body-secondary";
          msTrackedText.textContent = `Geplant: ${msPlanned} Min · Getrackt: ${msTracked} Min`;
          const msProgressWrap = document.createElement("div");
          msProgressWrap.className = "progress";
          msProgressWrap.style.height = "6px";
          const msProgressBar = document.createElement("div");
          msProgressBar.className = "progress-bar bg-info";
          msProgressBar.setAttribute("role", "progressbar");
          msProgressBar.setAttribute("aria-valuemin", "0");
          msProgressBar.setAttribute("aria-valuemax", "100");
          msProgressBar.setAttribute("aria-valuenow", String(msProgressPercent));
          msProgressBar.style.width = `${msProgressPercent}%`;
          msProgressWrap.appendChild(msProgressBar);
          milestoneContent.append(msTrackedText, msProgressWrap);
        }

        label.append(milestoneCheckbox, milestoneContent);
        milestoneRow.append(label, inlineEditForm, editMilestoneButton, deleteMilestoneButton);
        milestoneList.appendChild(milestoneRow);
      });

      milestoneSection.appendChild(milestoneList);
    } else {
      const emptyMilestones = document.createElement("small");
      emptyMilestones.className = "text-body-secondary";
      emptyMilestones.textContent = "Noch keine Zwischenziele";
      milestoneSection.appendChild(emptyMilestones);
    }

    const addMilestoneForm = document.createElement("form");
    addMilestoneForm.className = "d-flex flex-wrap gap-2 mt-2";

    const addMilestoneInput = document.createElement("input");
    addMilestoneInput.type = "text";
    addMilestoneInput.className = "form-control form-control-sm";
    addMilestoneInput.placeholder = "Zwischenziel hinzufügen";
    addMilestoneInput.setAttribute("aria-label", `Zwischenziel für ${goal.title}`);

    const addMilestoneButton = document.createElement("button");
    addMilestoneButton.type = "submit";
    addMilestoneButton.className = "btn btn-outline-primary btn-sm";
    addMilestoneButton.textContent = "Hinzufügen";

    addMilestoneForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const title = addMilestoneInput.value.trim();
      if (!title) return;

      dispatch({
        type: "GOAL_ADD_MILESTONE",
        payload: {
          goalId: goal.id,
          milestone: { id: uid(), title, done: false },
        },
      });
      addMilestoneInput.value = "";
      onActivity();
      onRenderAll();
    });

    addMilestoneForm.append(addMilestoneInput, addMilestoneButton);
    milestoneSection.appendChild(addMilestoneForm);

    setGoalCollapsed(toggleButton, milestoneSection, collapsedGoalState.get(goal.id) || false);
    goalItems.push({ toggleButton, milestoneSection });
    toggleButton.addEventListener("click", () => {
      const isCollapsed = !milestoneSection.classList.contains("d-none");
      setGoalCollapsed(toggleButton, milestoneSection, isCollapsed);
      updateCollapseAllButton();
    });

    info.appendChild(milestoneSection);

    const actionsContainer = goalRow.querySelector(".ms-auto");
    actionsContainer.insertBefore(toggleButton, editButton);

    list.appendChild(goalRow);
  });

  const collapseAllBtn = byId("goal-collapse-all");
  if (collapseAllBtn) {
    const newBtn = collapseAllBtn.cloneNode(true);
    collapseAllBtn.replaceWith(newBtn);
    updateCollapseAllButton();
    newBtn.addEventListener("click", () => {
      const anyExpanded = goalItems.some(
        ({ milestoneSection }) => !milestoneSection.classList.contains("d-none")
      );
      goalItems.forEach(({ toggleButton, milestoneSection }) => {
        setGoalCollapsed(toggleButton, milestoneSection, anyExpanded);
      });
      updateCollapseAllButton();
    });
  }

  if (!list.children.length) {
    renderEmptyList(list, "Keine Ziele vorhanden");
  }
  if (!achieved.children.length) {
    renderEmptyList(achieved, "Noch keine erreichten Ziele");
  }
}

export function renderRoughPlans({ state, dispatch, onRenderAll, onEditRoughPlan }) {
  const list = byId("rough-list");
  list.innerHTML = "";

  const data = [...state.roughPlans]
    .filter((plan) => {
      if (!plan.goalId) return true;
      const goal = state.goals.find((g) => g.id === plan.goalId);
      return !goal?.completed;
    })
    .sort((left, right) => (left.startDate || "").localeCompare(right.startDate || ""));

  data.forEach((plan) => {
    const goal = plan.goalId ? state.goals.find((g) => g.id === plan.goalId) : null;
    const rowColorKey = goal?.id ? normalizeGoalColorKey(goal.colorKey) : null;
    const isLegacyPlan = typeof plan.hours === "number" || typeof plan.week === "string";

    const primaryText = isLegacyPlan
      ? goal
        ? `${plan.hours} h geplant für ${goal.title}`
        : `${plan.hours} h geplant`
      : goal
        ? `${goal.title} · ${Number(plan.totalWorkloadHours || 0).toFixed(1)} h`
        : `Workload-Plan · ${Number(plan.totalWorkloadHours || 0).toFixed(1)} h`;

    const endDate = plan.plannedDays?.length
      ? plan.plannedDays[plan.plannedDays.length - 1]?.date
      : "";
    const secondaryText = isLegacyPlan
      ? [formatLegacyCalendarWeek(plan.week || ""), plan.note || "", "Workload", "Tage: 1"]
          .filter(Boolean)
          .join(" · ")
      : [
          plan.startDate ? `Start ${formatDate(plan.startDate)}` : "",
          endDate ? `Ende ${formatDate(endDate)}` : "",
          `Tage: ${Array.isArray(plan.plannedDays) ? plan.plannedDays.length : 0}`,
        ]
          .filter(Boolean)
          .join(" · ");

    const actions = [];
    if (isLegacyPlan && onEditRoughPlan) {
      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-outline-secondary btn-sm";
      editBtn.type = "button";
      editBtn.setAttribute("aria-label", "Bearbeiten");
      editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
      editBtn.addEventListener("click", () => onEditRoughPlan(plan));
      actions.push(editBtn);
    }

    const row = buildRow(primaryText, secondaryText, {
      actions,
      onDelete: () => {
        dispatch({ type: "ROUGH_DELETE", payload: { id: plan.id } });
        onRenderAll();
      },
    });
    if (rowColorKey) {
      row.style.borderLeftColor = goalColorCssVar(rowColorKey, isLegacyPlan ? "base" : "soft");
      row.style.boxShadow = `0 10px 20px -18px ${goalColorCssVar(rowColorKey, isLegacyPlan ? "base" : "soft")}`;
    }
    list.appendChild(row);
  });

  if (!data.length) {
    renderEmptyList(list, "Keine Grobplanung vorhanden");
  }
}

export function renderDetailPlans({
  state,
  dispatch,
  onRenderAll,
  selectedMonth,
  onActivity,
  onStartTrackingDetail,
}) {
  const list = byId("detail-list");

  // Keep the current collapse state when re-rendering (e.g., after checkbox changes).
  const collapsedStateByPlanId = new Map(
    Array.from(list.querySelectorAll("[data-detail-block-body]"))
      .filter((node) => node.getAttribute("data-detail-block-body") !== "additional")
      .map((node) => [
        node.getAttribute("data-detail-block-body"),
        node.classList.contains("d-none"),
      ])
  );
  const additionalBlockWasCollapsed = Boolean(
    list.querySelector("[data-detail-additional-body]")?.classList.contains("d-none")
  );

  list.innerHTML = "";

  const goalsById = new Map((state.goals || []).map((goal) => [goal.id, goal]));

  const monthlyRoughPlans = [...state.roughPlans]
    .filter((plan) => {
      if (Array.isArray(plan.plannedDays) && plan.plannedDays.length) {
        return plan.plannedDays.some((day) => monthOf(day.date) === selectedMonth);
      }
      return plan.week
        ? weekOverlapsMonth(plan.week, selectedMonth)
        : monthOf(plan.date || plan.startDate) === selectedMonth;
    })
    .filter((plan) => {
      if (!plan.goalId) return true;
      return !goalsById.get(plan.goalId)?.completed;
    })
    .sort((a, b) => (a.startDate || a.date || "").localeCompare(b.startDate || b.date || ""));

  const monthlyDetailPlans = [...state.detailPlans]
    .filter((item) => monthOf(item.date) === selectedMonth)
    .filter((item) => !isDetailPlanHiddenByCompletion(state, item))
    .sort((a, b) => a.date.localeCompare(b.date));

  const trackedMinutesByDetailId = (state.trackedSessions || []).reduce((map, session) => {
    if (!session.detailPlanId) return map;
    const current = map.get(session.detailPlanId) || 0;
    map.set(session.detailPlanId, current + Number(session.minutes || 0));
    return map;
  }, new Map());

  const collapsibleBlockControls = [];

  function setBlockCollapsed(toggleButton, blockBody, collapsed) {
    blockBody.classList.toggle("d-none", collapsed);
    toggleButton.setAttribute("aria-expanded", String(!collapsed));
    toggleButton.setAttribute("aria-label", collapsed ? "Ausklappen" : "Einklappen");
    toggleButton.title = collapsed ? "Ausklappen" : "Einklappen";
    toggleButton.innerHTML = collapsed
      ? '<i class="bi bi-chevron-down" aria-hidden="true"></i>'
      : '<i class="bi bi-chevron-up" aria-hidden="true"></i>';
  }

  function updateDetailCollapseAllButton() {
    const btn = byId("detail-collapse-all");
    if (!btn) return;
    const anyExpanded = collapsibleBlockControls.some(
      ({ blockBody }) => !blockBody.classList.contains("d-none")
    );
    btn.innerHTML = anyExpanded
      ? '<i class="bi bi-arrows-collapse" aria-hidden="true"></i>'
      : '<i class="bi bi-arrows-expand" aria-hidden="true"></i>';
    btn.setAttribute("aria-label", anyExpanded ? "Alle einklappen" : "Alle ausklappen");
    btn.title = anyExpanded ? "Alle einklappen" : "Alle ausklappen";
  }

  if (monthlyRoughPlans.length) {
    const btn = byId("detail-collapse-all");
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.replaceWith(newBtn);
      updateDetailCollapseAllButton();
      newBtn.addEventListener("click", () => {
        const anyExpanded = collapsibleBlockControls.some(
          ({ blockBody }) => !blockBody.classList.contains("d-none")
        );
        collapsibleBlockControls.forEach(({ toggleButton, blockBody }) => {
          setBlockCollapsed(toggleButton, blockBody, anyExpanded);
        });
        updateDetailCollapseAllButton();
      });
    }
  }

  const todayIso = nowIso().slice(0, 10);
  const defaultMonthDate = todayIso.startsWith(selectedMonth) ? todayIso : `${selectedMonth}-01`;

  function createDetailEntryRow(item, { onEdit } = {}) {
    const { goal, milestone } = resolveDetailPlanContext(state, item);
    const detailColorKey = goal?.id ? normalizeGoalColorKey(goal.colorKey) : null;
    const focusTitle = milestone?.title || item.milestone || item.topic || "Detailplanung";
    const details = [formatDate(item.date)];
    if (item.startTime && item.endTime) details.push(`${item.startTime}-${item.endTime}`);
    if (goal?.title) details.push(`Hauptziel: ${goal.title}`);
    if (item.topic && item.topic !== focusTitle) details.push(item.topic);

    const trackedMinutes = trackedMinutesByDetailId.get(item.id) || 0;
    const plannedMinutes = Number(item.minutes || 0);
    const progressPercent =
      plannedMinutes > 0 ? Math.min(100, Math.round((trackedMinutes / plannedMinutes) * 100)) : 0;

    const editButton = document.createElement("button");
    editButton.className = "btn btn-outline-secondary btn-sm";
    editButton.type = "button";
    editButton.setAttribute("aria-label", "Detailplanung bearbeiten");
    editButton.innerHTML = '<i class="bi bi-pencil"></i>';
    editButton.addEventListener("click", () => onEdit?.(item));

    const trackingButton = document.createElement("button");
    trackingButton.className = "btn btn-outline-primary btn-sm";
    trackingButton.type = "button";
    trackingButton.setAttribute("aria-label", "Tracking starten");
    trackingButton.setAttribute("title", "Tracking starten");
    trackingButton.setAttribute("data-detail-start-tracking", item.id);
    trackingButton.innerHTML = '<i class="bi bi-stopwatch"></i>';
    trackingButton.addEventListener("click", () => {
      onStartTrackingDetail?.(item.id, focusTitle);
    });

    const row = buildRow(`${item.minutes} Min für ${focusTitle}`, details.join(" · "), {
      done: item.done,
      onDelete: () => {
        dispatch({ type: "DETAIL_DELETE", payload: { id: item.id } });
        onActivity?.();
        onRenderAll();
      },
      actions: [trackingButton, editButton],
    });
    if (detailColorKey) {
      row.style.borderLeftColor = goalColorCssVar(detailColorKey, "soft");
      row.style.boxShadow = `0 10px 20px -18px ${goalColorCssVar(detailColorKey, "soft")}`;
    }

    const info = row.querySelector(".flex-grow-1");
    const trackedText = document.createElement("small");
    trackedText.className = "text-body-secondary";
    trackedText.textContent = `Getrackt: ${trackedMinutes} von ${plannedMinutes} Min`;

    const progressWrap = document.createElement("div");
    progressWrap.className = "progress";

    const progressBar = document.createElement("div");
    progressBar.className = "progress-bar bg-info";
    progressBar.setAttribute("role", "progressbar");
    progressBar.setAttribute("aria-valuemin", "0");
    progressBar.setAttribute("aria-valuemax", "100");
    progressBar.setAttribute("aria-valuenow", String(progressPercent));
    progressBar.style.width = `${progressPercent}%`;

    progressWrap.appendChild(progressBar);
    info.append(trackedText, progressWrap);

    return row;
  }

  function createDetailBlockForm({
    blockKey,
    defaultDate,
    toggleButton,
    goal,
    milestones,
    roughPlanId,
    onDone,
  }) {
    const form = document.createElement("form");
    form.className = "row g-2 d-none mt-3";
    form.setAttribute("data-detail-block-form", blockKey);

    const editIdInput = document.createElement("input");
    editIdInput.type = "hidden";
    editIdInput.setAttribute("data-detail-edit-id", blockKey);
    form.appendChild(editIdInput);

    const dateCol = document.createElement("div");
    dateCol.className = "col-12 col-lg-4";
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.className = "form-control";
    dateInput.required = true;
    dateInput.value = defaultDate;
    dateInput.setAttribute("data-detail-date", blockKey);
    dateCol.appendChild(dateInput);

    const milestoneCol = document.createElement("div");
    milestoneCol.className = "col-12 col-lg-4";
    const milestoneSelect = document.createElement("select");
    milestoneSelect.className = "form-control";
    milestoneSelect.setAttribute("data-detail-milestone-select", blockKey);

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "Kein Zwischenziel (optional)";
    milestoneSelect.appendChild(emptyOption);

    milestones.forEach((milestone) => {
      const option = document.createElement("option");
      option.value = milestone.id;
      const goalLabel = milestone.goal?.title ? ` - ${milestone.goal.title}` : "";
      option.textContent = milestone.done
        ? `${milestone.title}${goalLabel} (erledigt)`
        : `${milestone.title}${goalLabel}`;
      milestoneSelect.appendChild(option);
    });
    milestoneCol.appendChild(milestoneSelect);

    const startCol = document.createElement("div");
    startCol.className = "col-12 col-md-6 col-lg-4";
    const startInput = document.createElement("input");
    startInput.type = "time";
    startInput.className = "form-control";
    startInput.placeholder = "Von";
    startInput.setAttribute("data-detail-start", blockKey);
    startCol.appendChild(startInput);

    const endCol = document.createElement("div");
    endCol.className = "col-12 col-md-6 col-lg-4";
    const endInput = document.createElement("input");
    endInput.type = "time";
    endInput.className = "form-control";
    endInput.placeholder = "Bis";
    endInput.setAttribute("data-detail-end", blockKey);
    endCol.appendChild(endInput);

    const topicCol = document.createElement("div");
    topicCol.className = "col-12 col-lg-8";
    const topicInput = document.createElement("input");
    topicInput.type = "text";
    topicInput.className = "form-control";
    topicInput.placeholder = "Lerninhalt (optional)";
    topicInput.setAttribute("data-detail-topic", blockKey);
    topicCol.appendChild(topicInput);

    const buttonCol = document.createElement("div");
    buttonCol.className = "col-12 col-md-6 col-lg-3 d-grid";
    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.className = "btn btn-primary";
    submitButton.textContent = "Zeit eintragen";
    buttonCol.appendChild(submitButton);

    const cancelCol = document.createElement("div");
    cancelCol.className = "col-12 col-md-6 col-lg-3 d-grid";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "btn btn-outline-secondary d-none";
    cancelButton.textContent = "Bearbeitung abbrechen";
    cancelButton.setAttribute("data-detail-cancel", blockKey);
    cancelCol.appendChild(cancelButton);

    function setFormVisible(visible) {
      form.classList.toggle("d-none", !visible);
      if (toggleButton) {
        toggleButton.innerHTML = visible
          ? '<i class="bi bi-dash-circle" aria-hidden="true"></i>'
          : '<i class="bi bi-plus-circle" aria-hidden="true"></i>';
        toggleButton.setAttribute("aria-label", visible ? "Planung ausblenden" : "Lernzeit planen");
        toggleButton.title = visible ? "Planung ausblenden" : "Lernzeit planen";
        toggleButton.setAttribute("aria-expanded", String(visible));
      }
    }

    function toggleFormVisibility() {
      const showForm = form.classList.contains("d-none");
      setFormVisible(showForm);
      return showForm;
    }

    function resetBlockForm() {
      editIdInput.value = "";
      dateInput.value = defaultDate;
      milestoneSelect.value = "";
      startInput.value = "";
      endInput.value = "";
      topicInput.value = "";
      submitButton.textContent = "Zeit eintragen";
      cancelButton.classList.add("d-none");
    }

    function startDetailEdit(item) {
      setFormVisible(true);
      editIdInput.value = item.id;
      dateInput.value = item.date;
      milestoneSelect.value = item.milestoneId || "";
      const startMinutes = parseTimeToMinutes(item.startTime || "");
      const endMinutes = parseTimeToMinutes(item.endTime || "");
      if (
        Number.isFinite(startMinutes) &&
        Number.isFinite(endMinutes) &&
        endMinutes > startMinutes
      ) {
        startInput.value = item.startTime;
        endInput.value = item.endTime;
      } else {
        const fallbackStart = 9 * 60;
        const fallbackEnd = fallbackStart + Number(item.minutes || 0);
        startInput.value = formatMinutesAsTime(fallbackStart);
        endInput.value = formatMinutesAsTime(fallbackEnd);
      }
      topicInput.value = item.topic || "";
      submitButton.textContent = "Änderungen speichern";
      cancelButton.classList.remove("d-none");
      dateInput.focus();
    }

    cancelButton.addEventListener("click", () => {
      resetBlockForm();
      setFormVisible(false);
    });

    form.append(dateCol, startCol, endCol, milestoneCol, topicCol, buttonCol, cancelCol);
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const editId = editIdInput.value;
      const date = dateInput.value;
      const milestoneId = milestoneSelect.value;
      const startTime = startInput.value;
      const endTime = endInput.value;
      const startMinutes = parseTimeToMinutes(startTime);
      const endMinutes = parseTimeToMinutes(endTime);
      const minutes = endMinutes - startMinutes;
      const topic = topicInput.value.trim();
      const selectedMilestone = milestones.find((item) => item.id === milestoneId) || null;

      if (!date) return;
      if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return;
      if (minutes <= 0) return;
      if (!selectedMilestone && !topic) return;

      const payloadPlan = {
        date,
        minutes,
        startTime,
        endTime,
        topic,
        milestone: selectedMilestone?.title || "",
        milestoneId: selectedMilestone?.id || null,
        goalId: selectedMilestone?.goalId || goal?.id || null,
        roughPlanId: roughPlanId || null,
      };

      if (editId) {
        dispatch({
          type: "DETAIL_UPDATE",
          payload: {
            id: editId,
            update: payloadPlan,
          },
        });
      } else {
        dispatch({
          type: "DETAIL_ADD",
          payload: {
            plan: {
              id: uid(),
              ...payloadPlan,
              done: false,
            },
          },
        });
      }

      onActivity?.();
      resetBlockForm();
      setFormVisible(false);
      onDone?.();
    });

    setFormVisible(false);

    return {
      form,
      startDetailEdit,
      toggleFormVisibility,
    };
  }

  monthlyRoughPlans.forEach((plan) => {
    const goal = plan.goalId ? state.goals.find((item) => item.id === plan.goalId) : null;
    const milestones = Array.isArray(goal?.milestones) ? goal.milestones : [];
    const entries = monthlyDetailPlans
      .filter((item) => item.roughPlanId === plan.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    const block = document.createElement("li");
    block.className = "list-group-item";
    const blockColorKey = goal?.id ? normalizeGoalColorKey(goal.colorKey) : null;
    if (blockColorKey) {
      block.style.borderLeftColor = goalColorCssVar(blockColorKey, "base");
      block.style.boxShadow = `0 10px 20px -18px ${goalColorCssVar(blockColorKey, "base")}`;
    }

    const headerRow = document.createElement("div");
    headerRow.className = "d-flex align-items-start justify-content-between gap-2";

    const header = document.createElement("div");
    header.className = "d-flex flex-column gap-1";

    const title = document.createElement("strong");
    const planHours = Number(plan.totalWorkloadHours || plan.hours || 0);
    title.textContent = goal
      ? `${planHours} h geplant für ${goal.title}`
      : `${planHours} h geplant`;

    const subtitle = document.createElement("small");
    subtitle.className = "text-body-secondary";
    const endDate =
      Array.isArray(plan.plannedDays) && plan.plannedDays.length
        ? plan.plannedDays[plan.plannedDays.length - 1].date
        : "";
    subtitle.textContent = [
      plan.startDate ? `Start: ${formatDate(plan.startDate)}` : "",
      endDate ? `Ende: ${formatDate(endDate)}` : "",
      goal ? "Ziel-Workload-Block" : "Kein Hauptziel zugeordnet",
    ]
      .filter(Boolean)
      .join(" · ");
    header.append(title, subtitle);

    const plannedMinutes = toMinutes(Number(plan.totalWorkloadHours || plan.hours || 0));
    const allocatedMinutes = sum(entries.map((item) => Number(item.minutes)));
    const allocation = document.createElement("small");
    allocation.className = "text-body-secondary";
    allocation.textContent = `Verteilt: ${allocatedMinutes} von ${plannedMinutes} Min · Offen: ${Math.max(0, plannedMinutes - allocatedMinutes)} Min`;
    header.appendChild(allocation);

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "btn btn-outline-secondary btn-sm";
    toggleButton.setAttribute("data-detail-block-toggle", plan.id);
    toggleButton.setAttribute("aria-controls", `detail-block-body-${plan.id}`);

    const blockBody = document.createElement("div");
    blockBody.className = "mt-3";
    blockBody.setAttribute("data-detail-block-body", plan.id);
    blockBody.id = `detail-block-body-${plan.id}`;

    setBlockCollapsed(toggleButton, blockBody, collapsedStateByPlanId.get(plan.id) || false);
    collapsibleBlockControls.push({ toggleButton, blockBody });

    toggleButton.addEventListener("click", () => {
      const isCollapsed = !blockBody.classList.contains("d-none");
      setBlockCollapsed(toggleButton, blockBody, isCollapsed);
      updateDetailCollapseAllButton();
    });

    const planToggleButton = document.createElement("button");
    planToggleButton.type = "button";
    planToggleButton.className = "btn btn-outline-primary btn-sm";
    planToggleButton.setAttribute("data-detail-plan-toggle", plan.id);
    planToggleButton.innerHTML = '<i class="bi bi-plus-circle" aria-hidden="true"></i>';
    planToggleButton.setAttribute("aria-label", "Lernzeit planen");
    planToggleButton.title = "Lernzeit planen";

    const btnGroup = document.createElement("div");
    btnGroup.className = "d-flex gap-1 flex-shrink-0";
    btnGroup.append(planToggleButton, toggleButton);
    headerRow.append(header, btnGroup);
    block.appendChild(headerRow);

    const { form, startDetailEdit, toggleFormVisibility } = createDetailBlockForm({
      blockKey: plan.id,
      defaultDate: plan.startDate || plan.date,
      toggleButton: planToggleButton,
      goal,
      milestones,
      roughPlanId: plan.id,
      onDone: onRenderAll,
    });
    planToggleButton.addEventListener("click", () => {
      const blockWasCollapsed = blockBody.classList.contains("d-none");
      const shouldShowForm = form.classList.contains("d-none");

      if (blockWasCollapsed) {
        setBlockCollapsed(toggleButton, blockBody, false);
        updateDetailCollapseAllButton();
      }

      if (shouldShowForm || !blockWasCollapsed) {
        toggleFormVisibility();
      }
    });
    blockBody.appendChild(form);

    const entryList = document.createElement("ul");
    entryList.className = "list-group mt-3";
    if (entries.length) {
      entries.forEach((item) =>
        entryList.appendChild(createDetailEntryRow(item, { onEdit: startDetailEdit }))
      );
    } else {
      renderEmptyList(entryList, "Noch keine Detailplanung für diesen Grobplanungsblock");
    }
    blockBody.appendChild(entryList);
    block.appendChild(blockBody);
    list.appendChild(block);
  });

  const monthlyRoughPlanIds = new Set(monthlyRoughPlans.map((plan) => plan.id));
  const additionalEntries = monthlyDetailPlans.filter(
    (item) => !item.roughPlanId || !monthlyRoughPlanIds.has(item.roughPlanId)
  );

  const additionalBlock = document.createElement("li");
  additionalBlock.className = "list-group-item";

  const additionalHeaderRow = document.createElement("div");
  additionalHeaderRow.className = "d-flex align-items-start justify-content-between gap-2";

  const additionalHeader = document.createElement("div");
  additionalHeader.className = "d-flex flex-column gap-1";

  const additionalTitle = document.createElement("strong");
  additionalTitle.textContent = "Weitere Detailplanung";
  const additionalHint = document.createElement("small");
  additionalHint.className = "text-body-secondary d-block mt-1";
  additionalHint.textContent = "Freitext oder optionales Zwischenziel - auch ohne Grobplanung";
  additionalHeader.append(additionalTitle, additionalHint);

  const additionalToggleButton = document.createElement("button");
  additionalToggleButton.type = "button";
  additionalToggleButton.className = "btn btn-outline-secondary btn-sm";
  additionalToggleButton.setAttribute("data-detail-additional-toggle", "true");
  additionalToggleButton.setAttribute("aria-controls", "detail-additional-body");

  const additionalBody = document.createElement("div");
  additionalBody.className = "mt-3";
  additionalBody.setAttribute("data-detail-additional-body", "true");
  additionalBody.id = "detail-additional-body";

  setBlockCollapsed(additionalToggleButton, additionalBody, additionalBlockWasCollapsed);
  collapsibleBlockControls.push({
    toggleButton: additionalToggleButton,
    blockBody: additionalBody,
  });
  additionalToggleButton.addEventListener("click", () => {
    const isCollapsed = !additionalBody.classList.contains("d-none");
    setBlockCollapsed(additionalToggleButton, additionalBody, isCollapsed);
    updateDetailCollapseAllButton();
  });

  const additionalGoalMilestones = state.goals.flatMap((goal) =>
    (goal.milestones || []).map((milestone) => ({ ...milestone, goalId: goal.id, goal }))
  );

  const additionalPlanToggleButton = document.createElement("button");
  additionalPlanToggleButton.type = "button";
  additionalPlanToggleButton.className = "btn btn-outline-primary btn-sm";
  additionalPlanToggleButton.setAttribute("data-detail-plan-toggle", "additional");
  additionalPlanToggleButton.innerHTML = '<i class="bi bi-plus-circle" aria-hidden="true"></i>';
  additionalPlanToggleButton.setAttribute("aria-label", "Lernzeit planen");
  additionalPlanToggleButton.title = "Lernzeit planen";

  const additionalBtnGroup = document.createElement("div");
  additionalBtnGroup.className = "d-flex gap-1 flex-shrink-0";
  additionalBtnGroup.append(additionalPlanToggleButton, additionalToggleButton);
  additionalHeaderRow.append(additionalHeader, additionalBtnGroup);
  additionalBlock.appendChild(additionalHeaderRow);

  const {
    form: additionalForm,
    startDetailEdit: startAdditionalEdit,
    toggleFormVisibility: toggleAdditionalFormVisibility,
  } = createDetailBlockForm({
    blockKey: "additional",
    defaultDate: defaultMonthDate,
    toggleButton: additionalPlanToggleButton,
    goal: null,
    milestones: additionalGoalMilestones,
    roughPlanId: null,
    onDone: onRenderAll,
  });
  additionalPlanToggleButton.addEventListener("click", () => {
    const blockWasCollapsed = additionalBody.classList.contains("d-none");
    const shouldShowForm = additionalForm.classList.contains("d-none");

    if (blockWasCollapsed) {
      setBlockCollapsed(additionalToggleButton, additionalBody, false);
      updateDetailCollapseAllButton();
    }

    if (shouldShowForm || !blockWasCollapsed) {
      toggleAdditionalFormVisibility();
    }
  });
  additionalBody.appendChild(additionalForm);

  const additionalList = document.createElement("ul");
  additionalList.className = "list-group mt-3";
  if (additionalEntries.length) {
    additionalEntries.forEach((item) =>
      additionalList.appendChild(createDetailEntryRow(item, { onEdit: startAdditionalEdit }))
    );
  } else {
    renderEmptyList(additionalList, "Noch keine weitere Detailplanung");
  }
  additionalBody.appendChild(additionalList);

  additionalBlock.appendChild(additionalBody);

  list.appendChild(additionalBlock);
}

export function renderTrackedSessions({ state, dispatch, onRenderAll, onEditTrackedSession }) {
  const list = byId("track-list");
  list.innerHTML = "";

  const detailPlans = state.detailPlans || [];
  const data = [...state.trackedSessions].sort((a, b) => b.start.localeCompare(a.start));

  data.forEach((session) => {
    const linkedDetailPlan = detailPlans.find((item) => item.id === session.detailPlanId) || null;
    const linkedGoal = linkedDetailPlan?.goalId
      ? state.goals.find((item) => item.id === linkedDetailPlan.goalId) || null
      : null;
    const linkedDetailText = linkedDetailPlan
      ? `Detail: ${buildDetailPlanSelectionLabel(state, linkedDetailPlan)}`
      : "";

    const editButton = document.createElement("button");
    editButton.className = "btn btn-outline-secondary btn-sm";
    editButton.type = "button";
    editButton.setAttribute("aria-label", "Bearbeiten");
    editButton.setAttribute("data-tracked-edit", session.id);
    editButton.innerHTML = '<i class="bi bi-pencil"></i>';
    editButton.addEventListener("click", () => {
      onEditTrackedSession?.(session);
    });

    const metaLine = [formatDate(session.start), linkedDetailText].filter(Boolean).join(" · ");

    const row = buildRow(
      `${session.minutes} Min fokussierte Lernzeit`,
      [metaLine, session.note].filter(Boolean),
      {
        actions: [editButton],
        onDelete: () => {
          dispatch({ type: "TRACKED_DELETE", payload: { id: session.id } });
          onRenderAll();
        },
      }
    );
    if (linkedGoal?.id) {
      const trackingColorKey = normalizeGoalColorKey(linkedGoal.colorKey);
      row.style.borderLeftColor = goalColorCssVar(trackingColorKey, "base");
      row.style.boxShadow = `0 10px 20px -18px ${goalColorCssVar(trackingColorKey, "base")}`;
    }
    list.appendChild(row);
  });

  if (!data.length) {
    renderEmptyList(list, "Noch keine getrackte Lernzeit");
  }
}

export function renderTimerDetailPlanSelect({ state }) {
  const select = byId("track-detail-select");
  if (!select) return;

  const selectedId = state.timer?.selectedDetailPlanId || "";
  const detailPlans = [...state.detailPlans]
    .filter((item) => !isDetailPlanHiddenByCompletion(state, item))
    .sort((left, right) => {
      const byDate = left.date.localeCompare(right.date);
      if (byDate !== 0) return byDate;
      return getDetailPlanFocusTitle(state, left).localeCompare(
        getDetailPlanFocusTitle(state, right),
        "de",
        {
          sensitivity: "base",
        }
      );
    });

  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Kein Detailplanungspunkt";
  select.appendChild(defaultOption);

  detailPlans.forEach((detailPlan) => {
    const option = document.createElement("option");
    option.value = detailPlan.id;
    option.textContent = buildDetailPlanSelectionLabel(state, detailPlan);
    select.appendChild(option);
  });

  select.value = detailPlans.some((item) => item.id === selectedId) ? selectedId : "";
}

export function renderPomodoro({ pomodoroState }) {
  const display = byId("pomodoro-display");
  const phaseLabel = byId("pomodoro-phase");
  const dots = byId("pomodoro-dots");
  const startBtn = byId("pomodoro-start");
  const pauseBtn = byId("pomodoro-pause");
  const saveNextBtn = byId("pomodoro-save-next");
  const saveResetBtn = byId("pomodoro-save-cancel");

  if (!display || !phaseLabel || !dots || !startBtn || !pauseBtn || !saveNextBtn || !saveResetBtn)
    return;

  const { active, phase, pomodorosCompleted, formattedCountdown } = pomodoroState;

  display.textContent = formattedCountdown;

  const phaseColorClass = phase === "work" ? "text-success" : "text-primary";
  display.className = `mb-0 fs-3 fw-bold lz-pomodoro-display ${phaseColorClass}`;

  const phaseLabels = {
    work: "Arbeitsphase",
    "short-break": "Kurze Pause (5 Min.)",
    "long-break": "Lange Pause (15 Min.)",
  };
  phaseLabel.textContent = phaseLabels[phase] ?? phase;

  const dotsInCycle = pomodorosCompleted % 4;
  dots.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const dot = document.createElement("span");
    dot.textContent = i < dotsInCycle ? "🍅" : "○";
    dot.className = "lz-pomodoro-dot";
    dots.appendChild(dot);
  }

  startBtn.classList.toggle("d-none", active);
  pauseBtn.classList.toggle("d-none", !active);

  // Dynamische Button-Anzeige je nach Phase
  if (phase === "work") {
    saveNextBtn.classList.remove("d-none");
    saveNextBtn.innerHTML =
      '<i class="bi bi-arrow-right-circle" aria-hidden="true"></i> Speichern &amp; weiter';
    saveResetBtn.classList.remove("d-none");
    saveResetBtn.innerHTML =
      '<i class="bi bi-save" aria-hidden="true"></i> Speichern &amp; Zurücksetzen';
  } else {
    saveNextBtn.classList.remove("d-none");
    saveNextBtn.innerHTML = '<i class="bi bi-arrow-right-circle" aria-hidden="true"></i> Weiter';
    saveResetBtn.classList.remove("d-none");
    saveResetBtn.innerHTML = '<i class="bi bi-save" aria-hidden="true"></i> Zurücksetzen';
  }

  // Auto-show panel on reload if a session was in progress
  const toggle = byId("pomodoro-toggle");
  const panel = byId("pomodoro-panel");
  const hasSession = active || pomodorosCompleted > 0 || phase !== "work";
  if (toggle && panel && hasSession && !toggle.checked) {
    toggle.checked = true;
    panel.classList.remove("d-none");
  }
}

export function renderStats({ state }) {
  const plannedTotalMin =
    sum(state.roughPlans.map((item) => toMinutes(item.totalWorkloadHours || item.hours || 0))) +
    sum(state.detailPlans.map((item) => Number(item.minutes)));

  const trackedMin = sum(state.trackedSessions.map((item) => Number(item.minutes)));

  const totalGoals = state.goals.length;
  const completedGoals = state.goals.filter((g) => g.completed).length;

  // const monthlyPlanned = sum(
  //   state.detailPlans
  //     .filter((item) => monthOf(item.date) === currentMonth)
  //     .map((item) => Number(item.minutes))
  // );
  // const monthlyTracked = sum(
  //   state.trackedSessions
  //     .filter((item) => monthOf(item.start) === currentMonth)
  //     .map((item) => Number(item.minutes))
  // );

  byId("stats").innerHTML = "";

  const timePercent =
    plannedTotalMin === 0 ? 0 : Math.min(100, Math.round((trackedMin / plannedTotalMin) * 100));
  const goalPercent = totalGoals === 0 ? 0 : Math.round((completedGoals / totalGoals) * 100);

  const timeProgress = byId("time-progress");
  const goalProgress = byId("goal-progress");

  timeProgress.style.width = `${timePercent}%`;
  timeProgress.setAttribute("aria-valuenow", String(timePercent));
  timeProgress.textContent = `${timePercent}%`;

  goalProgress.style.width = `${goalPercent}%`;
  goalProgress.setAttribute("aria-valuenow", String(goalPercent));
  goalProgress.textContent = `${goalPercent}%`;

  const upcomingContainer = byId("overview-next-items");
  if (!upcomingContainer) return;

  const today = nowIso().slice(0, 10);

  const upcomingGoalItems = (state.goals || [])
    .filter((goal) => !goal.completed)
    .filter((goal) => goal.targetDate && goal.targetDate >= today)
    .map((goal) => ({
      type: "goal",
      date: goal.targetDate,
      title: goal.title,
      subtitle: `Fällig: ${formatDate(goal.targetDate)}`,
      accentColor: goalColorCssVar(normalizeGoalColorKey(goal.colorKey), "base"),
    }));

  const upcomingDetailItems = (state.detailPlans || [])
    .filter((item) => item.date && item.date >= today)
    .filter((item) => !isDetailPlanHiddenByCompletion(state, item))
    .map((item) => {
      const timeRange =
        item.startTime && item.endTime
          ? `${item.startTime}-${item.endTime}`
          : item.startTime || item.endTime || "";

      return {
        type: "detail",
        date: item.date,
        title: getDetailPlanFocusTitle(state, item),
        subtitle: [formatDate(item.date), timeRange, `${Number(item.minutes || 0)} Min`]
          .filter(Boolean)
          .join(" · "),
        accentColor: item.goalId
          ? goalColorCssVar(
              normalizeGoalColorKey(
                (state.goals || []).find((goal) => goal.id === item.goalId)?.colorKey
              ),
              "soft"
            )
          : "var(--source-detail)",
      };
    });

  const nextItems = [...upcomingDetailItems, ...upcomingGoalItems].sort((left, right) => {
    const byDate = left.date.localeCompare(right.date);
    if (byDate !== 0) return byDate;
    if (left.type !== right.type) {
      return left.type === "detail" ? -1 : 1;
    }
    return left.title.localeCompare(right.title, "de", { sensitivity: "base" });
  });

  upcomingContainer.innerHTML = "";

  const label = document.createElement("label");
  label.className = "form-label text-body-secondary small mb-1";
  label.textContent = "Alle nächsten (Detailplanung & Ziele)";
  upcomingContainer.appendChild(label);

  const list = document.createElement("ul");
  list.className = "list-group lz-next-items-scroll";

  if (!nextItems.length) {
    renderEmptyList(list, "Keine anstehenden Einträge.");
    upcomingContainer.appendChild(list);
    return;
  }

  nextItems.forEach((item) => {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex flex-column gap-1";
    li.style.borderLeft = `6px solid ${item.accentColor}`;

    const heading = document.createElement("div");
    heading.className = "d-flex align-items-center gap-2";

    const dot = document.createElement("span");
    dot.className = "lz-legend-dot";
    dot.style.backgroundColor = item.accentColor;

    const title = document.createElement("span");
    title.className = "lz-next-item-title";
    title.textContent = `${item.type === "detail" ? "Detail" : "Ziel"}: ${item.title}`;

    const subtitle = document.createElement("small");
    subtitle.className = "text-body-secondary";
    subtitle.textContent = item.subtitle;

    heading.append(dot, title);
    li.append(heading, subtitle);
    list.appendChild(li);
  });

  upcomingContainer.appendChild(list);
}
