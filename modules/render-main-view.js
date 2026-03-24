import { byId } from "./dom.js";
import { formatDate, isWithinNextSixMonths, monthOf, nowIso } from "./date-utils.js";
import { buildRow, renderEmptyList } from "./list-render-utils.js";
import { uid } from "./app-utils.js";

function toMinutes(hours) {
  return Math.round(Number(hours) * 60);
}

function sum(array) {
  return array.reduce((acc, value) => acc + value, 0);
}

export function renderGoals({ state, dispatch, onActivity, onRenderAll, onEditGoal }) {
  const list = byId("goal-list");
  const achieved = byId("achieved-list");
  list.innerHTML = "";
  achieved.innerHTML = "";

  const sorted = [...state.goals].sort((a, b) => a.targetDate.localeCompare(b.targetDate));

  sorted.forEach((goal) => {
    const milestones = Array.isArray(goal.milestones) ? goal.milestones : [];
    const completedMilestones = milestones.filter((milestone) => milestone.done).length;

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
    editButton.innerHTML = '<i class="bi bi-pencil"></i>';
    editButton.addEventListener("click", () => {
      onEditGoal?.(goal);
    });

    const goalDetails = [`Bis ${formatDate(goal.targetDate)}`];
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

    const milestoneSection = document.createElement("div");
    milestoneSection.className = "mt-2";

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

        label.append(milestoneCheckbox, milestoneText);

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
    info.appendChild(milestoneSection);

    list.appendChild(goalRow);

    if (goal.completed) {
      const doneRow = document.createElement("li");
      doneRow.className = "list-group-item list-group-item-success";
      doneRow.innerHTML = `<div class="d-flex flex-column gap-1"><span>${goal.title}</span>${goal.description ? `<small class="text-body-secondary">${goal.description}</small>` : ""}${milestones.length ? `<small class="text-body-secondary">Zwischenziele erledigt: ${completedMilestones}/${milestones.length}</small>` : ""}<small class="text-body-secondary">Erreicht am ${formatDate(goal.completedAt)}</small></div>`;
      achieved.appendChild(doneRow);
    }
  });

  if (!sorted.length) {
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
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((plan) => isWithinNextSixMonths(plan.date));

  data.forEach((plan) => {
    const goal = plan.goalId ? state.goals.find((g) => g.id === plan.goalId) : null;
    const primaryText = goal
      ? `${plan.hours} h geplant für ${goal.title}`
      : `${plan.hours} h geplant`;
    const secondaryText = `${formatDate(plan.date)}${plan.note ? ` · ${plan.note}` : ""}`;

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-outline-secondary btn-sm";
    editBtn.type = "button";
    editBtn.setAttribute("aria-label", "Bearbeiten");
    editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
    editBtn.addEventListener("click", () => onEditRoughPlan?.(plan));

    const row = buildRow(
      primaryText,
      secondaryText,
      {
        actions: [editBtn],
        onDelete: () => {
          dispatch({ type: "ROUGH_DELETE", payload: { id: plan.id } });
          onRenderAll();
        },
      }
    );
    list.appendChild(row);
  });

  if (!data.length) {
    renderEmptyList(list, "Keine Grobplanung in den nächsten 6 Monaten");
  }
}

export function renderDetailPlans({ state, dispatch, onRenderAll, selectedMonth }) {
  const list = byId("detail-list");
  list.innerHTML = "";

  const data = [...state.detailPlans]
    .filter((item) => monthOf(item.date) === selectedMonth)
    .sort((a, b) => a.date.localeCompare(b.date));

  data.forEach((item) => {
    const flag = document.createElement("input");
    flag.type = "checkbox";
    flag.checked = item.done;
    flag.title = "Zwischenziel erreicht";
    flag.addEventListener("change", () => {
      dispatch({ type: "DETAIL_SET_DONE", payload: { id: item.id, done: flag.checked } });
      onRenderAll();
    });

    const row = buildRow(
      `${item.minutes} Min · ${item.topic}`,
      `${formatDate(item.date)}${item.milestone ? ` · Zwischenziel: ${item.milestone}` : ""}`,
      {
        done: item.done,
        onDelete: () => {
          dispatch({ type: "DETAIL_DELETE", payload: { id: item.id } });
          onRenderAll();
        },
        actions: [flag],
      }
    );
    list.appendChild(row);
  });

  if (!data.length) {
    renderEmptyList(list, "Keine Detailplanung für diesen Monat");
  }
}

export function renderTrackedSessions({ state, dispatch, onRenderAll }) {
  const list = byId("track-list");
  list.innerHTML = "";

  const data = [...state.trackedSessions].sort((a, b) => b.start.localeCompare(a.start));

  data.forEach((session) => {
    const row = buildRow(
      `${session.minutes} Min fokussierte Lernzeit`,
      `${formatDate(session.start)}${session.note ? ` · ${session.note}` : ""}`,
      {
        onDelete: () => {
          dispatch({ type: "TRACKED_DELETE", payload: { id: session.id } });
          onRenderAll();
        },
      }
    );
    list.appendChild(row);
  });

  if (!data.length) {
    renderEmptyList(list, "Noch keine getrackte Lernzeit");
  }
}

export function renderStats({ state, currentMonth }) {
  const plannedSixMonthsMin =
    sum(
      state.roughPlans
        .filter((item) => isWithinNextSixMonths(item.date))
        .map((item) => toMinutes(item.hours))
    ) +
    sum(
      state.detailPlans
        .filter((item) => isWithinNextSixMonths(item.date))
        .map((item) => Number(item.minutes))
    );

  const trackedMin = sum(state.trackedSessions.map((item) => Number(item.minutes)));

  const totalGoals = state.goals.length;
  const completedGoals = state.goals.filter((g) => g.completed).length;

  const monthlyPlanned = sum(
    state.detailPlans
      .filter((item) => monthOf(item.date) === currentMonth)
      .map((item) => Number(item.minutes))
  );
  const monthlyTracked = sum(
    state.trackedSessions
      .filter((item) => monthOf(item.start) === currentMonth)
      .map((item) => Number(item.minutes))
  );

  byId("stats").innerHTML = `
    <div class="col">
      <div class="card border-0 bg-body-tertiary h-100">
        <div class="card-body py-3">
          <small class="d-block text-body-secondary">Geplant (6M)</small>
          <b class="fs-5">${plannedSixMonthsMin} Min</b>
        </div>
      </div>
    </div>
    <div class="col">
      <div class="card border-0 bg-body-tertiary h-100">
        <div class="card-body py-3">
          <small class="d-block text-body-secondary">Getrackt gesamt</small>
          <b class="fs-5">${trackedMin} Min</b>
        </div>
      </div>
    </div>
    <div class="col">
      <div class="card border-0 bg-body-tertiary h-100">
        <div class="card-body py-3">
          <small class="d-block text-body-secondary">Aktueller Monat geplant</small>
          <b class="fs-5">${monthlyPlanned} Min</b>
        </div>
      </div>
    </div>
    <div class="col">
      <div class="card border-0 bg-body-tertiary h-100">
        <div class="card-body py-3">
          <small class="d-block text-body-secondary">Aktueller Monat getrackt</small>
          <b class="fs-5">${monthlyTracked} Min</b>
        </div>
      </div>
    </div>
  `;

  const timePercent =
    plannedSixMonthsMin === 0
      ? 0
      : Math.min(100, Math.round((trackedMin / plannedSixMonthsMin) * 100));
  const goalPercent = totalGoals === 0 ? 0 : Math.round((completedGoals / totalGoals) * 100);

  const timeProgress = byId("time-progress");
  const goalProgress = byId("goal-progress");

  timeProgress.style.width = `${timePercent}%`;
  timeProgress.setAttribute("aria-valuenow", String(timePercent));
  timeProgress.textContent = `${timePercent}%`;

  goalProgress.style.width = `${goalPercent}%`;
  goalProgress.setAttribute("aria-valuenow", String(goalPercent));
  goalProgress.textContent = `${goalPercent}%`;
}
