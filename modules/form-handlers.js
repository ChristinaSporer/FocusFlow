import { byId } from "./dom.js";
import { monthOf } from "./date-utils.js";
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
  importIcsFile,
  exportIcsFile,
}) {
  byId("goal-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = byId("goal-title").value.trim();
    const targetDate = byId("goal-date").value;
    if (!title || !targetDate) return;

    dispatch({
      type: "GOAL_ADD",
      payload: {
        goal: { id: uid(), title, targetDate, completed: false, completedAt: null },
      },
    });
    event.target.reset();
    touchActivity();
    renderAll();
  });

  byId("rough-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const date = byId("rough-date").value;
    const hours = Number(byId("rough-hours").value);
    const note = byId("rough-note").value.trim();
    if (!date || !hours) return;

    dispatch({ type: "ROUGH_ADD", payload: { plan: { id: uid(), date, hours, note } } });
    event.target.reset();
    touchActivity();
    renderAll();
  });

  byId("detail-form").addEventListener("submit", (event) => {
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

  byId("month-select").addEventListener("change", renderAll);

  [byId("tab-list"), byId("tab-calendar")].forEach((btn) => {
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

  byId("theme-mode").addEventListener("change", (event) => {
    dispatch({
      type: "SET_THEME_MODE",
      payload: { themeMode: normalizeThemeMode(event.target.value) },
    });
    applyTheme();
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

  byId("reset-data").addEventListener("click", () => {
    const ok = confirm("Alle Daten wirklich löschen?");
    if (!ok) return;
    dispatch({ type: "REPLACE_STATE", payload: { state: defaultData() } });
    setInitialValues();
    renderAll();
  });
}
