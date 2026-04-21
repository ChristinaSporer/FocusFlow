import { byId } from "./dom.js";
import { formatYmd, monthOf, weekDateFromValue } from "./date-utils.js";
import { uid } from "./app-utils.js";
import { DEFAULT_GOAL_COLOR_KEY, normalizeGoalColorKey } from "./goal-utils.js";
import {
  WEEKDAY_ORDER,
  defaultStandardLearningTimes,
  distributeGoalWorkload,
  normalizeStandardLearningTimes,
} from "./planning-utils.js";

export function initFormHandlers({
  dispatch,
  renderAll,
  getState = () => ({
    settings: { standardLearningTimes: defaultStandardLearningTimes() },
    goals: [],
  }),
  touchActivity,
  defaultData,
  setInitialValues,
  loadDemoData,
  normalizeThemeMode,
  applyTheme,
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
  notificationPermission,
  getNotificationPermission,
  syncNotifications,
}) {
  const planningDraft = {
    goalId: "",
    selectedSlotKeys: new Set(),
    distributedDays: [],
    remainingMinutes: 0,
    extraSlotsVisible: 3,
  };

  function shouldShowConfirmDialogs() {
    return getState().settings?.confirmDialogsEnabled !== false;
  }

  function askConfirmation(message) {
    if (!shouldShowConfirmDialogs()) return true;
    return confirm(message);
  }

  function syncTrackedEditHighlight(activeId = "") {
    document.querySelectorAll("[data-tracked-edit]").forEach((button) => {
      const isActive = String(button.getAttribute("data-tracked-edit") || "") === String(activeId);
      button.classList.toggle("btn-secondary", isActive);
      button.classList.toggle("text-white", isActive);
      button.classList.toggle("btn-outline-secondary", !isActive);
      const row = button.closest("li");
      if (row) row.classList.toggle("lz-tracked-editing", isActive);
    });
  }

  function prefillManualTrackingFromDetail(detailPlanId) {
    if (!detailPlanId) return;
    const detailPlan = (getState().detailPlans || []).find((item) => item.id === detailPlanId);
    if (!detailPlan) return;
    const dateInput = byId("track-manual-date");
    const minutesInput = byId("track-manual-minutes");
    const hoursInput = byId("track-manual-hours");
    const extraMinutesInput = byId("track-manual-extra-minutes");
    const safeMinutes = Math.max(0, Number(detailPlan.minutes || 0));
    if (dateInput) dateInput.value = detailPlan.date || dateInput.value;
    if (minutesInput) minutesInput.value = safeMinutes > 0 ? String(safeMinutes) : "";
    if (hoursInput) hoursInput.value = String(Math.floor(safeMinutes / 60));
    if (extraMinutesInput) extraMinutesInput.value = String(safeMinutes % 60);
  }

  function setGoalTargetDateDisplay(value) {
    const safeValue = String(value || "").trim();
    const textNode = byId("goal-date-text");
    if (textNode) {
      textNode.textContent = safeValue || "Enddatum wird automatisch berechnet";
    }
  }

  function resetGoalForm() {
    if (byId("goal-edit-id")) byId("goal-edit-id").value = "";
    if (byId("goal-title")) byId("goal-title").value = "";
    if (byId("goal-start-date")) byId("goal-start-date").value = "";
    if (byId("goal-date")) byId("goal-date").value = "";
    setGoalTargetDateDisplay("");
    if (byId("goal-workload-hours")) byId("goal-workload-hours").value = "";
    if (byId("goal-description")) byId("goal-description").value = "";
    const defaultColorInput = byId(`goal-color-${DEFAULT_GOAL_COLOR_KEY}`);
    if (defaultColorInput) defaultColorInput.checked = true;
    if (byId("goal-submit")) byId("goal-submit").textContent = "Hinzufügen";
    if (byId("goal-cancel-edit")) byId("goal-cancel-edit").classList.add("d-none");
  }

  function populateGoalDropdown(state) {
    const dropdown = byId("rough-goal");
    if (!dropdown) return;

    const plannedGoalIds = new Set(
      (state.roughPlans || [])
        .filter((plan) => plan.goalId && Array.isArray(plan.plannedDays) && plan.plannedDays.length)
        .map((plan) => plan.goalId)
    );
    const openGoals = state.goals.filter((goal) => !goal.completed && !plannedGoalIds.has(goal.id));
    const currentOptions = Array.from(dropdown.options).slice(1);

    currentOptions.forEach((option) => option.remove());

    openGoals
      .sort((a, b) => {
        const byDate = String(a.startDate || a.targetDate || "").localeCompare(
          String(b.startDate || b.targetDate || "")
        );
        if (byDate !== 0) return byDate;
        return (a.title || "").localeCompare(b.title || "", "de");
      })
      .forEach((goal) => {
        const option = document.createElement("option");
        option.value = goal.id;
        option.textContent = goal.title;
        dropdown.appendChild(option);
      });
  }

  function resetRoughForm() {
    const roughEditId = byId("rough-edit-id");
    const goal = byId("rough-goal");
    const week = byId("rough-week");
    const hours = byId("rough-hours");
    const note = byId("rough-note");
    const submit = byId("rough-submit");
    const cancel = byId("rough-cancel-edit");
    if (roughEditId) roughEditId.value = "";
    if (goal) goal.value = "";
    if (week) week.value = "";
    if (hours) hours.value = "";
    if (note) note.value = "";
    if (submit) submit.textContent = "Planen";
    if (cancel) cancel.classList.add("d-none");
    planningDraft.goalId = "";
    planningDraft.selectedSlotKeys = new Set();
    planningDraft.distributedDays = [];
    planningDraft.remainingMinutes = 0;
    planningDraft.extraSlotsVisible = 3;
    renderPlanningPreview();
  }

  function startRoughEdit(plan) {
    const roughEditId = byId("rough-edit-id");
    const goal = byId("rough-goal");
    const week = byId("rough-week");
    const hours = byId("rough-hours");
    const note = byId("rough-note");
    const submit = byId("rough-submit");
    const cancel = byId("rough-cancel-edit");

    if (roughEditId) roughEditId.value = plan.id || "";
    if (goal) goal.value = plan.goalId || "";
    if (week) week.value = plan.week || "";
    if (hours) hours.value = plan.hours ? String(plan.hours) : "";
    if (note) note.value = plan.note || "";
    if (submit) submit.textContent = "Änderungen speichern";
    if (cancel) cancel.classList.remove("d-none");
  }

  function startGoalEdit(goal) {
    if (byId("goal-edit-id")) byId("goal-edit-id").value = goal.id;
    if (byId("goal-title")) byId("goal-title").value = goal.title;
    if (byId("goal-start-date")) byId("goal-start-date").value = goal.startDate || "";
    if (byId("goal-date")) byId("goal-date").value = goal.targetDate || "";
    setGoalTargetDateDisplay(goal.targetDate || "");
    if (byId("goal-workload-hours")) {
      byId("goal-workload-hours").value =
        Number.isFinite(Number(goal.workloadHours)) && Number(goal.workloadHours) > 0
          ? String(goal.workloadHours)
          : "";
    }
    if (byId("goal-description")) byId("goal-description").value = goal.description || "";
    const colorKey = normalizeGoalColorKey(goal.colorKey);
    const colorInput = byId(`goal-color-${colorKey}`);
    if (colorInput) colorInput.checked = true;
    if (byId("goal-submit")) byId("goal-submit").textContent = "Änderungen speichern";
    if (byId("goal-cancel-edit")) byId("goal-cancel-edit").classList.remove("d-none");
    byId("goal-title")?.focus();
  }

  function getCurrentLearningTimes() {
    return normalizeStandardLearningTimes(getState().settings?.standardLearningTimes);
  }

  function readLearningTimesFromInputs() {
    const next = defaultStandardLearningTimes();
    WEEKDAY_ORDER.forEach((weekday) => {
      const startTime = byId(`slt-${weekday}-start`)?.value || "";
      const endTime = byId(`slt-${weekday}-end`)?.value || "";
      next[weekday] = {
        startTime,
        endTime,
      };
    });
    return normalizeStandardLearningTimes(next);
  }

  function syncLearningTimeInputs() {
    const learningTimes = getCurrentLearningTimes();
    WEEKDAY_ORDER.forEach((weekday) => {
      const row = learningTimes[weekday] || {};
      const start = byId(`slt-${weekday}-start`);
      const end = byId(`slt-${weekday}-end`);
      if (start) start.value = row.startTime || "";
      if (end) end.value = row.endTime || "";
    });
  }

  function renderPlanningPreview() {
    const grid = byId("rough-plan-grid");
    const summary = byId("rough-plan-summary");
    const loadMoreButton = byId("rough-load-more");
    if (!grid || !summary) return;

    grid.innerHTML = "";
    const goal = (getState().goals || []).find((item) => item.id === planningDraft.goalId);
    if (!goal) {
      summary.textContent = "Wähle ein Ziel, um die automatische Workload-Verteilung zu sehen.";
      if (loadMoreButton) loadMoreButton.classList.add("d-none");
      return;
    }

    const selectedSlotKeys = planningDraft.selectedSlotKeys.size
      ? Array.from(planningDraft.selectedSlotKeys)
      : null;
    const distribution = distributeGoalWorkload({
      startDate: goal.startDate,
      workloadHours: goal.workloadHours,
      standardLearningTimes: getCurrentLearningTimes(),
      selectedSlotKeys,
      detailPlans: getState().detailPlans,
      goals: getState().goals,
    });

    planningDraft.distributedDays = distribution.days;
    planningDraft.remainingMinutes = distribution.remainingMinutes;

    const autoSelectedKeys = new Set(distribution.days.map((day) => day.key));
    const visibleDefaultCount = autoSelectedKeys.size + planningDraft.extraSlotsVisible;
    const visibleCandidates = distribution.candidateSlots.filter((slot, index) => {
      if (autoSelectedKeys.has(slot.key)) return true;
      if (planningDraft.selectedSlotKeys.has(slot.key)) return true;
      return index < visibleDefaultCount;
    });

    if (loadMoreButton) {
      loadMoreButton.classList.toggle(
        "d-none",
        distribution.candidateSlots.length <= visibleCandidates.length
      );
    }

    summary.textContent = [
      `Start: ${goal.startDate || "-"}`,
      `Ende: ${distribution.projectedEndDate || "-"}`,
      `Workload: ${Number(goal.workloadHours || 0).toFixed(1)} h`,
      distribution.remainingMinutes > 0
        ? `Rest: ${(distribution.remainingMinutes / 60).toFixed(1)} h`
        : "voll verteilt",
    ].join(" · ");

    visibleCandidates.forEach((day) => {
      const card = document.createElement("label");
      card.className = "lz-planning-day";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !planningDraft.selectedSlotKeys.size
        ? autoSelectedKeys.has(day.key)
        : planningDraft.selectedSlotKeys.has(day.key);
      checkbox.setAttribute("data-rough-day", day.date);
      checkbox.setAttribute("data-rough-slot-key", day.key);
      checkbox.addEventListener("change", () => {
        if (!planningDraft.selectedSlotKeys.size) {
          distribution.days.forEach((item) => planningDraft.selectedSlotKeys.add(item.key));
        }
        if (checkbox.checked) planningDraft.selectedSlotKeys.add(day.key);
        else planningDraft.selectedSlotKeys.delete(day.key);
        renderPlanningPreview();
      });

      const text = document.createElement("span");
      text.textContent = `${day.date} · ${day.startTime}-${day.endTime} · ${day.minutes || day.availableMinutes} Min`;
      card.append(checkbox, text);
      grid.appendChild(card);
    });
  }

  function resetTrackedForm() {
    const editId = byId("track-edit-id");
    const date = byId("track-manual-date");
    const minutes = byId("track-manual-minutes");
    const hours = byId("track-manual-hours");
    const extraMinutes = byId("track-manual-extra-minutes");
    const note = byId("track-note");
    const submit = byId("track-manual-submit");
    const cancel = byId("track-cancel-edit");

    if (editId) editId.value = "";
    if (date) date.value = formatYmd(new Date());
    if (minutes) minutes.value = "";
    if (hours) hours.value = "";
    if (extraMinutes) extraMinutes.value = "";
    if (note) note.value = "";
    if (submit) submit.textContent = "Zeit nachtragen";
    if (cancel) cancel.classList.add("d-none");
    syncTrackedEditHighlight("");
  }

  function syncLegacyManualMinutesFromSplitInputs() {
    const legacy = byId("track-manual-minutes");
    if (!legacy) return;

    const rawHours = String(byId("track-manual-hours")?.value || "").trim();
    const rawExtraMinutes = String(byId("track-manual-extra-minutes")?.value || "").trim();
    if (rawHours === "" && rawExtraMinutes === "") return;

    const parsedHours = Number(rawHours.replace(",", ".") || 0);
    const parsedExtraMinutes = Number(rawExtraMinutes || 0);
    legacy.value = String(
      Math.round(Math.max(0, parsedHours) * 60 + Math.max(0, parsedExtraMinutes))
    );
  }

  function startTrackedEdit(session) {
    const editId = byId("track-edit-id");
    const date = byId("track-manual-date");
    const minutes = byId("track-manual-minutes");
    const hours = byId("track-manual-hours");
    const extraMinutes = byId("track-manual-extra-minutes");
    const note = byId("track-note");
    const detail = byId("track-detail-select");
    const submit = byId("track-manual-submit");
    const cancel = byId("track-cancel-edit");

    if (editId) editId.value = session.id;
    if (date) date.value = formatYmd(session.start);
    if (minutes) minutes.value = String(session.minutes || "");
    if (hours) hours.value = String(Math.floor(Number(session.minutes || 0) / 60));
    if (extraMinutes) extraMinutes.value = String(Number(session.minutes || 0) % 60);
    if (note) note.value = session.note || "";
    if (detail) detail.value = session.detailPlanId || "";
    if (submit) submit.textContent = "Änderungen speichern";
    if (cancel) cancel.classList.remove("d-none");
    syncTrackedEditHighlight(session.id);
    const manualTab = byId("manual-tab");
    if (manualTab) {
      if (typeof window.bootstrap?.Tab === "function") {
        window.bootstrap.Tab.getOrCreateInstance(manualTab).show();
      } else {
        manualTab.click();
      }
    }
    if (minutes) minutes.focus();
  }

  resetGoalForm();
  resetTrackedForm();

  byId("goal-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const editId = byId("goal-edit-id")?.value || "";
    const title = byId("goal-title").value.trim();
    const targetDate = byId("goal-date")?.value || "";
    const startDate = byId("goal-start-date")?.value || targetDate || formatYmd(new Date());
    const workloadInput = byId("goal-workload-hours");
    const workloadRaw = String(workloadInput?.value || "")
      .trim()
      .replace(",", ".");
    const parsedWorkload = Number(workloadRaw || 0);
    const workloadHours = Math.max(0, Number.isFinite(parsedWorkload) ? parsedWorkload : 0);
    const description = byId("goal-description").value.trim();
    const selectedColor = document.querySelector('input[name="goal-color"]:checked');
    const colorKey = normalizeGoalColorKey(selectedColor?.value || DEFAULT_GOAL_COLOR_KEY);
    if (!title || !startDate) return;
    if (!editId && workloadHours <= 0 && event.isTrusted) {
      workloadInput?.focus();
      return;
    }

    if (editId) {
      dispatch({
        type: "GOAL_UPDATE",
        payload: {
          goal: { id: editId, title, startDate, targetDate, workloadHours, description, colorKey },
        },
      });
    } else {
      dispatch({
        type: "GOAL_ADD",
        payload: {
          goal: {
            id: uid(),
            title,
            startDate,
            targetDate,
            workloadHours,
            description,
            colorKey,
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

  byId("goal-cancel-edit")?.addEventListener("click", resetGoalForm);

  resetRoughForm();

  byId("rough-goal")?.addEventListener("change", (event) => {
    planningDraft.goalId = event.target.value || "";
    planningDraft.selectedSlotKeys = new Set();
    planningDraft.extraSlotsVisible = 3;
    renderPlanningPreview();
  });

  byId("rough-load-more")?.addEventListener("click", () => {
    planningDraft.extraSlotsVisible += 3;
    renderPlanningPreview();
  });

  byId("rough-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const editId = byId("rough-edit-id")?.value || "";
    const goalId = byId("rough-goal")?.value || null;
    const legacyWeek = byId("rough-week")?.value || "";
    const legacyHours = Number(byId("rough-hours")?.value || 0);
    const legacyNote = byId("rough-note")?.value?.trim() || "";

    if (legacyWeek && legacyHours > 0) {
      if (editId) {
        dispatch({
          type: "ROUGH_UPDATE",
          payload: {
            id: editId,
            update: {
              week: legacyWeek,
              date: weekDateFromValue(legacyWeek),
              hours: legacyHours,
              note: legacyNote,
              goalId,
            },
          },
        });
      } else {
        dispatch({
          type: "ROUGH_ADD",
          payload: {
            plan: {
              id: uid(),
              week: legacyWeek,
              date: weekDateFromValue(legacyWeek),
              hours: legacyHours,
              note: legacyNote,
              goalId,
            },
          },
        });
      }
      resetRoughForm();
      touchActivity();
      renderAll();
      return;
    }

    const goal = (getState().goals || []).find((item) => item.id === goalId);
    if (!goal) return;

    renderPlanningPreview();
    if (!planningDraft.distributedDays.length) {
      alert("Keine planbaren Lerntage für dieses Ziel verfügbar.");
      return;
    }

    const roughPlanId = uid();
    dispatch({
      type: "ROUGH_ADD",
      payload: {
        plan: {
          id: roughPlanId,
          goalId,
          startDate: goal.startDate,
          plannedDays: planningDraft.distributedDays,
          totalWorkloadHours: Number(goal.workloadHours || 0),
        },
      },
    });

    planningDraft.distributedDays.forEach((item) => {
      dispatch({
        type: "DETAIL_ADD",
        payload: {
          plan: {
            id: uid(),
            date: item.date,
            minutes: item.minutes,
            startTime: item.startTime,
            endTime: item.endTime,
            topic: `${goal.title} (automatisch geplant)`,
            milestone: "",
            milestoneId: null,
            goalId,
            roughPlanId,
            done: false,
          },
        },
      });
    });

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

  const monthSelectInput = byId("month-select");
  if (monthSelectInput) {
    monthSelectInput.readOnly = false;
    monthSelectInput.disabled = false;
    monthSelectInput.addEventListener("change", renderAll);
  }

  [byId("tab-list"), byId("tab-calendar")].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      dispatch({ type: "SET_ACTIVE_VIEW", payload: { view: btn.dataset.view } });
      renderAll();
    });
  });

  byId("calendar-prev")?.addEventListener("click", () => {
    const [year, month] = getCalendarMonth().split("-").map(Number);
    const prev = new Date(year, month - 2, 1);
    setCalendarMonth(monthOf(prev));
    renderCalendar();
  });

  byId("calendar-next")?.addEventListener("click", () => {
    const [year, month] = getCalendarMonth().split("-").map(Number);
    const next = new Date(year, month, 1);
    setCalendarMonth(monthOf(next));
    renderCalendar();
  });

  const timerStartBtn = byId("timer-start");
  const timerPauseBtn = byId("timer-pause");
  const timerStopBtn = byId("timer-stop");

  let isPaused = false;
  let pausedAt = null;
  let pausedElapsed = 0;

  function updateTimerButtons(running, paused) {
    if (timerStartBtn) timerStartBtn.classList.toggle("d-none", running && !paused);
    if (timerPauseBtn) timerPauseBtn.classList.toggle("d-none", !running || paused);
    if (timerStopBtn) timerStopBtn.classList.toggle("d-none", !running);
  }

  if (timerStartBtn) {
    timerStartBtn.addEventListener("click", () => {
      if (isPaused) {
        // Resume
        startTimer({ resume: true, pausedElapsed });
        isPaused = false;
        pausedAt = null;
        pausedElapsed = 0;
      } else {
        startTimer();
      }
      updateTimerButtons(true, false);
    });
  }
  if (timerPauseBtn) {
    timerPauseBtn.addEventListener("click", () => {
      isPaused = true;
      pausedAt = Date.now();
      window.__timerPausedAt = pausedAt;
      // Optionally: store elapsed time
      pausedElapsed = window.timerManagerGetElapsed?.() || 0;
      // Stop the timer interval so the timer display freezes
      if (window.timerManagerStopInterval) window.timerManagerStopInterval();
      updateTimerButtons(true, true);
    });
  }
  if (timerStopBtn) {
    timerStopBtn.addEventListener("click", () => {
      stopTimer();
      isPaused = false;
      pausedAt = null;
      pausedElapsed = 0;
      updateTimerButtons(false, false);
    });
  }
  // Initial state
  updateTimerButtons(false, false);
  byId("track-detail-select")?.addEventListener("change", (event) => {
    const selectedDetailPlanId = event.target.value || null;
    setSelectedTimerDetailPlan?.(selectedDetailPlanId);
    prefillManualTrackingFromDetail(selectedDetailPlanId);
  });

  byId("track-manual-hours")?.addEventListener("input", syncLegacyManualMinutesFromSplitInputs);
  byId("track-manual-extra-minutes")?.addEventListener(
    "input",
    syncLegacyManualMinutesFromSplitInputs
  );

  // Pomodoro-Panel ist jetzt ein Tab, keine Umschaltung mehr nötig
  byId("pomodoro-start")?.addEventListener("click", () => startPomodoro?.());
  byId("pomodoro-pause")?.addEventListener("click", () => pausePomodoro?.());
  byId("pomodoro-save-next")?.addEventListener("click", () => skipPomodoroPhase?.());
  byId("pomodoro-reset")?.addEventListener("click", () => resetPomodoro?.());
  byId("pomodoro-save-cancel")?.addEventListener("click", () => {
    if (typeof window.pomodoroManagerSaveAndReset === "function")
      window.pomodoroManagerSaveAndReset();
  });

  byId("track-manual-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const editId = byId("track-edit-id")?.value;
    const date = byId("track-manual-date")?.value;
    const legacyMinutes = Number(byId("track-manual-minutes")?.value || 0);
    const rawHours = String(byId("track-manual-hours")?.value || "").trim();
    const rawExtraMinutes = String(byId("track-manual-extra-minutes")?.value || "").trim();
    const parsedHours = Number(rawHours.replace(",", ".") || 0);
    const parsedExtraMinutes = Number(rawExtraMinutes || 0);
    const usesSplitInput = rawHours !== "" || rawExtraMinutes !== "";
    const splitMinutes = Math.round(
      Math.max(0, parsedHours) * 60 + Math.max(0, parsedExtraMinutes)
    );
    const minutes = usesSplitInput
      ? legacyMinutes > 0 && legacyMinutes !== splitMinutes
        ? Math.max(0, legacyMinutes)
        : splitMinutes
      : Math.max(0, legacyMinutes);
    if (byId("track-manual-minutes")) {
      byId("track-manual-minutes").value = String(minutes || "");
    }
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

  function syncThemeMenuButtons() {
    const activeThemeMode = normalizeThemeMode(getState().settings?.themeMode);
    document.querySelectorAll("[data-menu-theme-mode]").forEach((button) => {
      const isActive = button.getAttribute("data-menu-theme-mode") === activeThemeMode;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function applyThemeModeSelection(rawValue) {
    dispatch({
      type: "SET_THEME_MODE",
      payload: { themeMode: normalizeThemeMode(rawValue) },
    });
    applyTheme();
    syncThemeMenuButtons();
  }

  byId("menu-demo")?.addEventListener("click", () => {
    loadDemoData();
    syncLearningTimeInputs();
    syncNotificationInputs();
    renderAll();
  });

  byId("menu-reset")?.addEventListener("click", () => {
    const ok = askConfirmation("Alle Daten wirklich löschen?");
    if (!ok) return;
    dispatch({ type: "REPLACE_STATE", payload: { state: defaultData() } });
    resetGoalForm();
    resetRoughForm();
    resetTrackedForm();
    setInitialValues();
    syncLearningTimeInputs();
    syncNotificationInputs();
    renderAll();
  });

  document.querySelectorAll("[data-menu-theme-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      applyThemeModeSelection(button.getAttribute("data-menu-theme-mode"));
    });
  });

  byId("menu-save-learning-times")?.addEventListener("click", () => {
    const standardLearningTimes = readLearningTimesFromInputs();
    dispatch({ type: "SET_STANDARD_LEARNING_TIMES", payload: { standardLearningTimes } });
    renderPlanningPreview();
    alert("Standard-Lernzeiten gespeichert.");
  });

  const notificationToggle = byId("menu-notification-enabled");
  const inactivityNotificationToggle = byId("menu-inactivity-notification-enabled");
  const confirmDialogsToggle = byId("menu-confirm-dialogs-enabled");
  const notificationLeadRange = byId("menu-notification-lead-range");
  const notificationLeadInput = byId("menu-notification-lead");
  const inactivityNotificationDaysRange = byId("menu-inactivity-notification-days-range");
  const inactivityNotificationDaysInput = byId("menu-inactivity-notification-days");
  const notificationStatus = byId("menu-notification-status");
  const confirmDialogsHint = byId("menu-confirm-dialogs-hint");

  function clampInactivityDays(value) {
    return Math.min(60, Math.max(1, Math.round(Number(value || 3))));
  }

  function syncNotificationInputs() {
    const settings = getState().settings || {};
    if (notificationToggle) notificationToggle.checked = Boolean(settings.notificationEnabled);
    if (inactivityNotificationToggle) {
      inactivityNotificationToggle.checked = Boolean(settings.inactivityNotificationEnabled);
    }
    if (confirmDialogsToggle) {
      confirmDialogsToggle.checked = settings.confirmDialogsEnabled !== false;
    }
    if (confirmDialogsHint) {
      const confirmationsEnabled = settings.confirmDialogsEnabled !== false;
      confirmDialogsHint.classList.toggle("d-none", confirmationsEnabled);
    }
    const leadMinutes = Math.min(90, Math.max(0, Number(settings.notificationLeadMinutes ?? 15)));
    if (notificationLeadRange) {
      notificationLeadRange.value = String(leadMinutes);
    }
    if (notificationLeadInput) {
      notificationLeadInput.value = String(leadMinutes);
    }
    const inactivityDays = clampInactivityDays(settings.inactivityDays ?? 3);
    if (inactivityNotificationDaysRange) {
      inactivityNotificationDaysRange.value = String(inactivityDays);
    }
    if (inactivityNotificationDaysInput) {
      inactivityNotificationDaysInput.value = String(inactivityDays);
    }
    if (notificationStatus) {
      const permission = getNotificationPermission?.() || "default";
      notificationStatus.textContent =
        permission === "granted"
          ? "Browser-Benachrichtigungen erlaubt."
          : permission === "denied"
            ? "Browser-Benachrichtigungen blockiert."
            : permission === "unsupported"
              ? "Browser unterstützt keine Benachrichtigungen."
              : "Browser-Berechtigung noch nicht bestätigt.";
    }
  }

  notificationToggle?.addEventListener("change", async (event) => {
    const enabled = event.target.checked;
    if (enabled) {
      const permission = await notificationPermission?.();
      if (permission !== "granted") {
        dispatch({ type: "SET_NOTIFICATION_ENABLED", payload: { enabled: false } });
        event.target.checked = false;
        syncNotificationInputs();
        alert("Benachrichtigungen konnten nicht aktiviert werden.");
        return;
      }
    }

    dispatch({ type: "SET_NOTIFICATION_ENABLED", payload: { enabled } });
    syncNotificationInputs();
    syncNotifications?.();
  });

  function updateLeadMinutes(value) {
    const minutes = Math.min(90, Math.max(0, Math.round(Number(value || 0) / 5) * 5));
    dispatch({ type: "SET_NOTIFICATION_LEAD_MINUTES", payload: { minutes } });
    syncNotificationInputs();
    syncNotifications?.();
  }

  notificationLeadRange?.addEventListener("input", () => {
    updateLeadMinutes(notificationLeadRange.value);
  });

  notificationLeadInput?.addEventListener("change", () => {
    updateLeadMinutes(notificationLeadInput.value);
  });

  inactivityNotificationToggle?.addEventListener("change", async (event) => {
    const enabled = event.target.checked;
    if (enabled) {
      const permission = await notificationPermission?.();
      if (permission !== "granted") {
        dispatch({ type: "SET_INACTIVITY_NOTIFICATION_ENABLED", payload: { enabled: false } });
        event.target.checked = false;
        syncNotificationInputs();
        alert("Benachrichtigungen konnten nicht aktiviert werden.");
        return;
      }
    }

    dispatch({ type: "SET_INACTIVITY_NOTIFICATION_ENABLED", payload: { enabled } });
    syncNotificationInputs();
    syncNotifications?.();
  });

  function updateInactivityDays(value) {
    const days = clampInactivityDays(value);
    dispatch({ type: "SET_INACTIVITY_DAYS", payload: { days } });
    syncNotificationInputs();
    syncNotifications?.();
  }

  inactivityNotificationDaysRange?.addEventListener("input", () => {
    updateInactivityDays(inactivityNotificationDaysRange.value);
  });

  inactivityNotificationDaysInput?.addEventListener("change", () => {
    updateInactivityDays(inactivityNotificationDaysInput.value);
  });

  confirmDialogsToggle?.addEventListener("change", (event) => {
    dispatch({ type: "SET_CONFIRM_DIALOGS_ENABLED", payload: { enabled: event.target.checked } });
    syncNotificationInputs();
  });

  byId("menu-ics-import")?.addEventListener("click", async () => {
    const input = byId("menu-ics-file");
    const file = input?.files && input.files[0];
    const result = await importIcsFile(file);
    if (!result.ok) {
      alert(result.status || "ICS-Import fehlgeschlagen.");
      return;
    }

    if (result.calendarMonth) {
      setCalendarMonth(result.calendarMonth);
    }

    alert(result.status || "ICS-Import erfolgreich.");
    renderAll();
  });

  byId("menu-ics-export")?.addEventListener("click", () => {
    exportIcsFile();
  });

  byId("menu-json-import")?.addEventListener("click", async () => {
    const input = byId("menu-json-file");
    const file = input?.files && input.files[0];
    const result = await importJsonFile?.(file);
    if (!result?.ok) {
      alert(result?.status || "JSON-Import fehlgeschlagen.");
      return;
    }

    dispatch({ type: "REPLACE_STATE", payload: { state: result.state } });
    setInitialValues();
    syncLearningTimeInputs();
    syncNotificationInputs();
    alert(result.status || "JSON-Import erfolgreich.");
    renderAll();
  });

  byId("menu-json-export")?.addEventListener("click", () => {
    exportJsonFile?.();
  });

  syncLearningTimeInputs();
  syncNotificationInputs();
  syncThemeMenuButtons();
  renderPlanningPreview();

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
