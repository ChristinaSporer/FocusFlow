import { byId } from "./dom.js";
import { formatYmd, monthOf, weekDateFromValue, weekValueFromDate } from "./date-utils.js";
import { uid } from "./app-utils.js";

export function initFormHandlers({
  dispatch,
  renderAll,
  touchActivity,
  defaultData,
  setInitialValues,
  loadDemoData,
  normalizeThemeMode,
  applyTheme,
  activateNotifications,
  getCalendarMonth,
  setCalendarMonth,
  renderCalendar,
  startTimer,
  stopTimer,
  setSelectedTimerDetailPlan,
  addManualTrackedSession,
  updateTrackedSession,
  importIcsFile,
  exportIcsFile,
  importJsonFile,
  exportJsonFile,
  startPomodoro,
  pausePomodoro,
  skipPomodoroPhase,
  resetPomodoro,
}) {
  function resetGoalForm() {
    byId("goal-edit-id").value = "";
    byId("goal-title").value = "";
    byId("goal-date").value = "";
    byId("goal-description").value = "";
    byId("goal-submit").textContent = "Hinzufügen";
    byId("goal-cancel-edit").classList.add("d-none");
  }

  function populateGoalDropdown(state) {
    const dropdown = byId("rough-goal");
    if (!dropdown) return;

    const openGoals = state.goals.filter((goal) => !goal.completed);
    const currentOptions = Array.from(dropdown.options).slice(1);

    currentOptions.forEach((option) => option.remove());

    openGoals
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
      .forEach((goal) => {
        const option = document.createElement("option");
        option.value = goal.id;
        option.textContent = goal.title;
        dropdown.appendChild(option);
      });
  }

  function resetRoughForm() {
    const editId = byId("rough-edit-id");
    const week = byId("rough-week");
    const hours = byId("rough-hours");
    const note = byId("rough-note");
    const goal = byId("rough-goal");
    const submit = byId("rough-submit");
    const cancel = byId("rough-cancel-edit");

    if (editId) editId.value = "";
    if (week) week.value = "";
    if (hours) hours.value = "";
    if (note) note.value = "";
    if (goal) goal.value = "";
    if (submit) submit.textContent = "Planen";
    if (cancel) cancel.classList.add("d-none");
  }

  function startRoughEdit(plan) {
    const editId = byId("rough-edit-id");
    const week = byId("rough-week");
    const hours = byId("rough-hours");
    const note = byId("rough-note");
    const goal = byId("rough-goal");
    const submit = byId("rough-submit");
    const cancel = byId("rough-cancel-edit");

    if (editId) editId.value = plan.id;
    if (week) week.value = plan.week || weekValueFromDate(plan.date);
    if (hours) hours.value = plan.hours;
    if (note) note.value = plan.note || "";
    if (goal) goal.value = plan.goalId || "";
    if (submit) submit.textContent = "Änderungen speichern";
    if (cancel) cancel.classList.remove("d-none");
    if (week) week.focus();
  }

  function startGoalEdit(goal) {
    byId("goal-edit-id").value = goal.id;
    byId("goal-title").value = goal.title;
    byId("goal-date").value = goal.targetDate;
    byId("goal-description").value = goal.description || "";
    byId("goal-submit").textContent = "Änderungen speichern";
    byId("goal-cancel-edit").classList.remove("d-none");
    byId("goal-title").focus();
  }

  function resetTrackedForm() {
    const editId = byId("track-edit-id");
    const date = byId("track-manual-date");
    const minutes = byId("track-manual-minutes");
    const note = byId("track-note");
    const submit = byId("track-manual-submit");
    const cancel = byId("track-cancel-edit");

    if (editId) editId.value = "";
    if (date) date.value = formatYmd(new Date());
    if (minutes) minutes.value = "";
    if (note) note.value = "";
    if (submit) submit.textContent = "Zeit nachtragen";
    if (cancel) cancel.classList.add("d-none");
  }

  function startTrackedEdit(session) {
    const editId = byId("track-edit-id");
    const date = byId("track-manual-date");
    const minutes = byId("track-manual-minutes");
    const note = byId("track-note");
    const detail = byId("track-detail-select");
    const submit = byId("track-manual-submit");
    const cancel = byId("track-cancel-edit");

    if (editId) editId.value = session.id;
    if (date) date.value = formatYmd(session.start);
    if (minutes) minutes.value = String(session.minutes || "");
    if (note) note.value = session.note || "";
    if (detail) detail.value = session.detailPlanId || "";
    if (submit) submit.textContent = "Änderungen speichern";
    if (cancel) cancel.classList.remove("d-none");
    if (minutes) minutes.focus();
  }

  resetGoalForm();
  resetTrackedForm();

  byId("goal-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const editId = byId("goal-edit-id").value;
    const title = byId("goal-title").value.trim();
    const targetDate = byId("goal-date").value;
    const description = byId("goal-description").value.trim();
    if (!title || !targetDate) return;

    if (editId) {
      dispatch({
        type: "GOAL_UPDATE",
        payload: {
          goal: { id: editId, title, targetDate, description },
        },
      });
    } else {
      dispatch({
        type: "GOAL_ADD",
        payload: {
          goal: {
            id: uid(),
            title,
            targetDate,
            description,
            completed: false,
            completedAt: null,
          },
        },
      });
    }

    resetGoalForm();
    touchActivity();
    renderAll();
  });

  byId("goal-cancel-edit").addEventListener("click", resetGoalForm);

  resetRoughForm();

  byId("rough-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const editId = byId("rough-edit-id").value;
    const week = byId("rough-week").value;
    const date = weekDateFromValue(week);
    const hours = Number(byId("rough-hours").value);
    const note = byId("rough-note").value.trim();
    const goalId = byId("rough-goal").value || null;
    if (!week || !date || !hours) return;

    if (editId) {
      dispatch({
        type: "ROUGH_UPDATE",
        payload: {
          id: editId,
          update: { week, date, hours, note, goalId },
        },
      });
    } else {
      dispatch({
        type: "ROUGH_ADD",
        payload: { plan: { id: uid(), week, date, hours, note, goalId } },
      });
    }

    resetRoughForm();
    touchActivity();
    renderAll();
  });

  byId("rough-cancel-edit")?.addEventListener("click", resetRoughForm);

  const detailForm = byId("detail-form");
  if (detailForm) {
    detailForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const date = byId("detail-date").value;
      const minutes = Number(byId("detail-minutes").value);
      const topic = byId("detail-topic").value.trim();
      const milestone = byId("detail-milestone").value.trim();
      if (!date || !minutes || !topic) return;

      dispatch({
        type: "DETAIL_ADD",
        payload: {
          plan: { id: uid(), date, minutes, topic, milestone, done: false },
        },
      });
      event.target.reset();
      touchActivity();
      renderAll();
    });
  }

  byId("month-select").addEventListener("change", renderAll);

  [byId("tab-list"), byId("tab-calendar"), byId("tab-backup")].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      dispatch({ type: "SET_ACTIVE_VIEW", payload: { view: btn.dataset.view } });
      renderAll();
    });
  });

  byId("calendar-prev").addEventListener("click", () => {
    const [year, month] = getCalendarMonth().split("-").map(Number);
    const prev = new Date(year, month - 2, 1);
    setCalendarMonth(monthOf(prev));
    renderCalendar();
  });

  byId("calendar-next").addEventListener("click", () => {
    const [year, month] = getCalendarMonth().split("-").map(Number);
    const next = new Date(year, month, 1);
    setCalendarMonth(monthOf(next));
    renderCalendar();
  });

  byId("timer-start").addEventListener("click", startTimer);
  byId("timer-stop").addEventListener("click", stopTimer);
  byId("track-detail-select")?.addEventListener("change", (event) => {
    setSelectedTimerDetailPlan?.(event.target.value || null);
  });

  byId("pomodoro-toggle")?.addEventListener("change", (event) => {
    const panel = byId("pomodoro-panel");
    if (panel) panel.classList.toggle("d-none", !event.target.checked);
  });
  byId("pomodoro-start")?.addEventListener("click", () => startPomodoro?.());
  byId("pomodoro-pause")?.addEventListener("click", () => pausePomodoro?.());
  byId("pomodoro-skip")?.addEventListener("click", () => skipPomodoroPhase?.());
  byId("pomodoro-reset")?.addEventListener("click", () => resetPomodoro?.());

  byId("track-manual-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const editId = byId("track-edit-id")?.value;
    const date = byId("track-manual-date")?.value;
    const minutes = Number(byId("track-manual-minutes")?.value);
    const note = byId("track-note")?.value || "";
    const detailPlanId = byId("track-detail-select")?.value || null;

    const ok = editId
      ? updateTrackedSession?.({
          id: editId,
          date,
          minutes,
          note,
          detailPlanId,
        })
      : addManualTrackedSession?.({
          date,
          minutes,
          note,
          detailPlanId,
        });

    if (!ok) return;
    resetTrackedForm();
  });

  byId("track-cancel-edit")?.addEventListener("click", resetTrackedForm);

  byId("settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const days = Number(byId("inactivity-days").value);
    if (days > 0) {
      dispatch({ type: "SET_INACTIVITY_DAYS", payload: { days } });
      renderAll();
    }
  });

  byId("enable-notifications").addEventListener("click", activateNotifications);

  byId("load-demo").addEventListener("click", () => {
    loadDemoData();
    renderAll();
  });

  function applyThemeModeSelection(rawValue) {
    dispatch({
      type: "SET_THEME_MODE",
      payload: { themeMode: normalizeThemeMode(rawValue) },
    });
    applyTheme();
  }

  const themeModeSelect = byId("theme-mode");
  if (themeModeSelect) {
    themeModeSelect.addEventListener("change", (event) => {
      applyThemeModeSelection(event.target.value);
    });
  }

  document.querySelectorAll('input[name="theme-mode"]').forEach((input) => {
    input.addEventListener("change", (event) => {
      if (!event.target.checked) return;
      applyThemeModeSelection(event.target.value);
    });
  });

  byId("ics-import").addEventListener("click", async () => {
    const input = byId("ics-file");
    const file = input.files && input.files[0];
    const result = await importIcsFile(file);
    if (!result.ok) return;

    if (result.calendarMonth) {
      setCalendarMonth(result.calendarMonth);
    }

    renderAll();
  });

  byId("ics-export").addEventListener("click", () => {
    exportIcsFile();
  });

  byId("json-import")?.addEventListener("click", async () => {
    const input = byId("json-file");
    const file = input?.files && input.files[0];
    const result = await importJsonFile?.(file);
    if (!result?.ok) return;

    dispatch({ type: "REPLACE_STATE", payload: { state: result.state } });
    setInitialValues();
    renderAll();
  });

  byId("json-export")?.addEventListener("click", () => {
    exportJsonFile?.();
  });

  byId("reset-data").addEventListener("click", () => {
    const ok = confirm("Alle Daten wirklich löschen?");
    if (!ok) return;
    dispatch({ type: "REPLACE_STATE", payload: { state: defaultData() } });
    resetGoalForm();
    resetRoughForm();
    resetTrackedForm();
    setInitialValues();
    renderAll();
  });

  return {
    resetGoalForm,
    startGoalEdit,
    resetTrackedForm,
    startTrackedEdit,
    populateGoalDropdown,
    startRoughEdit,
    resetRoughForm,
  };
}
