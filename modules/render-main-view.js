import { byId } from "./dom.js";
import { formatDate, isWithinNextSixMonths, monthOf, nowIso } from "./date-utils.js";
import { buildRow, renderEmptyList } from "./list-render-utils.js";

function toMinutes(hours) {
  return Math.round(Number(hours) * 60);
}

function sum(array) {
  return array.reduce((acc, value) => acc + value, 0);
}

export function renderGoals({ state, dispatch, onActivity, onRenderAll }) {
  const list = byId("goal-list");
  const achieved = byId("achieved-list");
  list.innerHTML = "";
  achieved.innerHTML = "";

  const sorted = [...state.goals].sort((a, b) => a.targetDate.localeCompare(b.targetDate));

  sorted.forEach((goal) => {
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

    const goalRow = buildRow(goal.title, `Bis ${formatDate(goal.targetDate)}`, {
      done: goal.completed,
      onDelete: () => {
        dispatch({ type: "GOAL_DELETE", payload: { id: goal.id } });
        onRenderAll();
      },
      actions: [checkbox],
    });

    list.appendChild(goalRow);

    if (goal.completed) {
      const doneRow = document.createElement("li");
      doneRow.className = "list-group-item list-group-item-success";
      doneRow.innerHTML = `<div class="d-flex flex-column gap-1"><span>${goal.title}</span><small class="text-body-secondary">Erreicht am ${formatDate(goal.completedAt)}</small></div>`;
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

export function renderRoughPlans({ state, dispatch, onRenderAll }) {
  const list = byId("rough-list");
  list.innerHTML = "";

  const data = [...state.roughPlans]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((plan) => isWithinNextSixMonths(plan.date));

  data.forEach((plan) => {
    const row = buildRow(
      `${plan.hours} h geplant`,
      `${formatDate(plan.date)}${plan.note ? ` · ${plan.note}` : ""}`,
      {
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
