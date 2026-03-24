import { byId } from "./dom.js";
import { formatCalendarWeek, formatDate, monthOf, nowIso, weekOverlapsMonth, weekValueFromDate } from "./date-utils.js";
import { resolveDetailPlanContext } from "./detail-plan-utils.js";
import { buildRow, renderEmptyList } from "./list-render-utils.js";
import { uid } from "./app-utils.js";

function parseIsoWeek(weekValue) {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(String(weekValue || "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(week)) return null;
  return { year, week };
}

function parseCalendarWeekLabel(weekValue) {
  const match = /^KW\s*(\d{1,2})\/(\d{4})$/i.exec(String(weekValue || "").trim());
  if (!match) return null;
  const week = Number(match[1]);
  const year = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(week)) return null;
  return { year, week };
}

function getWeekPartsFromPlan(plan) {
  return (
    parseIsoWeek(plan?.week) ||
    parseCalendarWeekLabel(plan?.week) ||
    parseIsoWeek(weekValueFromDate(plan?.date))
  );
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

function roughPlansByGoalComparator(state, left, right) {
  const leftGoalTitle = left.goalId
    ? state.goals.find((goal) => goal.id === left.goalId)?.title || ""
    : "";
  const rightGoalTitle = right.goalId
    ? state.goals.find((goal) => goal.id === right.goalId)?.title || ""
    : "";

  const goalOrder = leftGoalTitle.localeCompare(rightGoalTitle, "de", { sensitivity: "base" });
  if (goalOrder !== 0) return goalOrder;

  const weekOrder = (left.week || "").localeCompare(right.week || "");
  if (weekOrder !== 0) return weekOrder;

  return (left.date || "").localeCompare(right.date || "");
}

function roughPlansByWeekComparator(left, right) {
  const leftWeek = getWeekPartsFromPlan(left);
  const rightWeek = getWeekPartsFromPlan(right);

  if (leftWeek && rightWeek) {
    if (leftWeek.year !== rightWeek.year) {
      return leftWeek.year - rightWeek.year;
    }
    if (leftWeek.week !== rightWeek.week) {
      return leftWeek.week - rightWeek.week;
    }
  } else if (leftWeek && !rightWeek) {
    return -1;
  } else if (!leftWeek && rightWeek) {
    return 1;
  }

  return (left.date || "").localeCompare(right.date || "");
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
  });

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

  const data = [...state.roughPlans].sort(roughPlansByWeekComparator);

  data.forEach((plan) => {
    const goal = plan.goalId ? state.goals.find((g) => g.id === plan.goalId) : null;
    const primaryText = goal
      ? `${plan.hours} h geplant für ${goal.title}`
      : `${plan.hours} h geplant`;
    const weekLabel = formatCalendarWeek(plan.week || plan.date);
    const secondaryText = `${weekLabel}${plan.note ? ` · ${plan.note}` : ""}`;

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
    renderEmptyList(list, "Keine Grobplanung vorhanden");
  }
}

export function renderDetailPlans({ state, dispatch, onRenderAll, selectedMonth, onActivity }) {
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

  const monthlyRoughPlans = [...state.roughPlans]
    .filter((plan) =>
      plan.week ? weekOverlapsMonth(plan.week, selectedMonth) : monthOf(plan.date) === selectedMonth
    )
    .sort((a, b) => roughPlansByGoalComparator(state, a, b));

  const monthlyDetailPlans = [...state.detailPlans]
    .filter((item) => monthOf(item.date) === selectedMonth)
    .sort((a, b) => a.date.localeCompare(b.date));

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

  if (monthlyRoughPlans.length) {
    const controlsRow = document.createElement("li");
    controlsRow.className = "list-group-item";

    const controlsWrap = document.createElement("div");
    controlsWrap.className = "d-flex gap-2 justify-content-end";

    const collapseAllButton = document.createElement("button");
    collapseAllButton.type = "button";
    collapseAllButton.className = "btn btn-outline-secondary btn-sm";
    collapseAllButton.textContent = "Alle einklappen";
    collapseAllButton.setAttribute("data-detail-collapse-all", "true");
    collapseAllButton.addEventListener("click", () => {
      collapsibleBlockControls.forEach(({ toggleButton, blockBody }) => {
        setBlockCollapsed(toggleButton, blockBody, true);
      });
    });

    const expandAllButton = document.createElement("button");
    expandAllButton.type = "button";
    expandAllButton.className = "btn btn-outline-secondary btn-sm";
    expandAllButton.textContent = "Alle ausklappen";
    expandAllButton.setAttribute("data-detail-expand-all", "true");
    expandAllButton.addEventListener("click", () => {
      collapsibleBlockControls.forEach(({ toggleButton, blockBody }) => {
        setBlockCollapsed(toggleButton, blockBody, false);
      });
    });

    controlsWrap.append(collapseAllButton, expandAllButton);
    controlsRow.appendChild(controlsWrap);
    list.appendChild(controlsRow);
  }

  const todayIso = nowIso().slice(0, 10);
  const defaultMonthDate = todayIso.startsWith(selectedMonth) ? todayIso : `${selectedMonth}-01`;

  function createDetailEntryRow(item, { onEdit } = {}) {
    const { goal, milestone } = resolveDetailPlanContext(state, item);
    const flag = document.createElement("input");
    flag.type = "checkbox";
    flag.checked = item.done;
    flag.title = "Zwischenziel erreicht";
    flag.addEventListener("change", () => {
      dispatch({ type: "DETAIL_SET_DONE", payload: { id: item.id, done: flag.checked } });
      onActivity?.();
      onRenderAll();
    });

    const focusTitle = milestone?.title || item.milestone || item.topic || "Detailplanung";
    const details = [formatDate(item.date)];
    if (item.startTime && item.endTime) details.push(`${item.startTime}-${item.endTime}`);
    if (goal?.title) details.push(`Hauptziel: ${goal.title}`);
    if (item.topic && item.topic !== focusTitle) details.push(item.topic);

    const editButton = document.createElement("button");
    editButton.className = "btn btn-outline-secondary btn-sm";
    editButton.type = "button";
    editButton.setAttribute("aria-label", "Detailplanung bearbeiten");
    editButton.innerHTML = '<i class="bi bi-pencil"></i>';
    editButton.addEventListener("click", () => onEdit?.(item));

    return buildRow(`${item.minutes} Min für ${focusTitle}`, details.join(" · "), {
      done: item.done,
      onDelete: () => {
        dispatch({ type: "DETAIL_DELETE", payload: { id: item.id } });
        onActivity?.();
        onRenderAll();
      },
      actions: [flag, editButton],
    });
  }

  function createDetailBlockForm({
    blockKey,
    defaultDate,
    goal,
    milestones,
    roughPlanId,
    onDone,
  }) {
    const form = document.createElement("form");
    form.className = "row g-2 mt-3";
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
      editIdInput.value = item.id;
      dateInput.value = item.date;
      milestoneSelect.value = item.milestoneId || "";
      const startMinutes = parseTimeToMinutes(item.startTime || "");
      const endMinutes = parseTimeToMinutes(item.endTime || "");
      if (Number.isFinite(startMinutes) && Number.isFinite(endMinutes) && endMinutes > startMinutes) {
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

    cancelButton.addEventListener("click", resetBlockForm);

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
      onDone?.();
    });

    return {
      form,
      startDetailEdit,
    };
  }

  monthlyRoughPlans.forEach((plan) => {
    const goal = plan.goalId ? state.goals.find((item) => item.id === plan.goalId) : null;
    const milestones = Array.isArray(goal?.milestones) ? goal.milestones : [];
    const entries = [...state.detailPlans]
      .filter((item) => item.roughPlanId === plan.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    const block = document.createElement("li");
    block.className = "list-group-item";

    const headerRow = document.createElement("div");
    headerRow.className = "d-flex align-items-start justify-content-between gap-2";

    const header = document.createElement("div");
    header.className = "d-flex flex-column gap-1";

    const title = document.createElement("strong");
    title.textContent = goal ? `${plan.hours} h geplant für ${goal.title}` : `${plan.hours} h geplant`;

    const subtitle = document.createElement("small");
    subtitle.className = "text-body-secondary";
    subtitle.textContent = [formatCalendarWeek(plan.week || plan.date), plan.note || "", goal ? "Zwischenziele auswählbar" : "Kein Hauptziel zugeordnet"]
      .filter(Boolean)
      .join(" · ");
    header.append(title, subtitle);

    const plannedMinutes = toMinutes(plan.hours);
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
    });

    headerRow.append(header, toggleButton);
    block.appendChild(headerRow);

    const hint = document.createElement("p");
    hint.className = "text-body-secondary small mb-0 mt-3";
    hint.textContent = milestones.length
      ? "Zwischenziel kann ausgewählt werden oder Freitext ohne Zwischenziel."
      : "Kein Zwischenziel erforderlich: Detailplanung per Freitext möglich.";
    blockBody.appendChild(hint);

    const { form, startDetailEdit } = createDetailBlockForm({
      blockKey: plan.id,
      defaultDate: plan.date,
      goal,
      milestones,
      roughPlanId: plan.id,
      onDone: onRenderAll,
    });
    blockBody.appendChild(form);

    const entryList = document.createElement("ul");
    entryList.className = "list-group mt-3";
    if (entries.length) {
      entries.forEach((item) => entryList.appendChild(createDetailEntryRow(item, { onEdit: startDetailEdit })));
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
  collapsibleBlockControls.push({ toggleButton: additionalToggleButton, blockBody: additionalBody });
  additionalToggleButton.addEventListener("click", () => {
    const isCollapsed = !additionalBody.classList.contains("d-none");
    setBlockCollapsed(additionalToggleButton, additionalBody, isCollapsed);
  });

  additionalHeaderRow.append(additionalHeader, additionalToggleButton);
  additionalBlock.appendChild(additionalHeaderRow);

  const additionalGoalMilestones = state.goals.flatMap((goal) =>
    (goal.milestones || []).map((milestone) => ({ ...milestone, goalId: goal.id, goal }))
  );

  const { form: additionalForm, startDetailEdit: startAdditionalEdit } = createDetailBlockForm({
    blockKey: "additional",
    defaultDate: defaultMonthDate,
    goal: null,
    milestones: additionalGoalMilestones,
    roughPlanId: null,
    onDone: onRenderAll,
  });
  additionalBody.appendChild(additionalForm);

  const additionalList = document.createElement("ul");
  additionalList.className = "list-group mt-3";
  if (additionalEntries.length) {
    additionalEntries.forEach((item) => additionalList.appendChild(createDetailEntryRow(item, { onEdit: startAdditionalEdit })));
  } else {
    renderEmptyList(additionalList, "Noch keine weitere Detailplanung");
  }
  additionalBody.appendChild(additionalList);

  additionalBlock.appendChild(additionalBody);

  list.appendChild(additionalBlock);
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
  const plannedTotalMin =
    sum(state.roughPlans.map((item) => toMinutes(item.hours))) +
    sum(state.detailPlans.map((item) => Number(item.minutes)));

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
          <small class="d-block text-body-secondary">Geplant gesamt</small>
          <b class="fs-5">${plannedTotalMin} Min</b>
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
    plannedTotalMin === 0
      ? 0
      : Math.min(100, Math.round((trackedMin / plannedTotalMin) * 100));
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
