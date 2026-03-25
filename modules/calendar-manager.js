import { byId } from "./dom.js";
import { addDays, formatYmd, monthOf } from "./date-utils.js";
import { resolveDetailPlanContext } from "./detail-plan-utils.js";

const SOURCE_META = {
  detail: { label: "Detailplanung", className: "lz-source-detail" },
  import: { label: "ICS-Import", className: "lz-source-import" },
  goal: { label: "Ziel", className: "lz-source-goal" },
};

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function createCalendarManager({ getState, dispatch }) {
  function getCalendarMonth() {
    const state = getState();
    return state.settings.calendarMonth || monthOf(new Date());
  }

  function setCalendarMonth(month) {
    dispatch({ type: "SET_CALENDAR_MONTH", payload: { month } });
  }

  function getCalendarEvents() {
    const state = getState();

    const goalEvents = (state.goals || [])
      .filter((goal) => goal.targetDate)
      .map((goal) => ({
        id: `goal-${goal.id}`,
        source: "goal",
        date: goal.targetDate,
        title: goal.title,
        hint: goal.completed ? "Ziel (erledigt)" : "Ziel",
      }));

    const detailEvents = state.detailPlans.map((item) => {
      const { goal, milestone } = resolveDetailPlanContext(state, item);
      const focusTitle = milestone?.title || item.milestone || item.topic || "Detailplanung";
      const hintParts = [];
      if (goal?.title) hintParts.push(`Hauptziel: ${goal.title}`);
      if (item.topic && item.topic !== focusTitle) hintParts.push(item.topic);

      return {
        id: item.id,
        source: "detail",
        date: item.date,
        title: `${focusTitle} (${item.minutes} Min)`,
        hint: hintParts.join(" · "),
      };
    });

    const importedEvents = state.importedEvents.map((event) => ({
      id: event.id,
      source: "import",
      date: event.date,
      title: event.summary || "Importierter Termin",
      hint: event.sourceName ? `Quelle: ${event.sourceName}` : "",
    }));

    return [...goalEvents, ...detailEvents, ...importedEvents].sort((a, b) => {
      if (a.date === b.date) return a.title.localeCompare(b.title, "de", { sensitivity: "base" });
      return a.date.localeCompare(b.date);
    });
  }

  function renderViewState() {
    const state = getState();
    const listView = byId("list-view");
    const calendarView = byId("calendar-view");
    const backupView = byId("backup-view");
    const listTab = byId("tab-list");
    const calendarTab = byId("tab-calendar");
    const backupTab = byId("tab-backup");

    const active = ["list", "calendar", "backup"].includes(state.settings.activeView)
      ? state.settings.activeView
      : "list";
    if (listView) {
      listView.classList.toggle("d-none", active !== "list");
    }
    if (calendarView) {
      calendarView.classList.toggle("d-none", active !== "calendar");
    }
    if (backupView) {
      backupView.classList.toggle("d-none", active !== "backup");
    }

    if (listTab) {
      listTab.classList.toggle("active", active === "list");
      listTab.setAttribute("aria-selected", String(active === "list"));
    }
    if (calendarTab) {
      calendarTab.classList.toggle("active", active === "calendar");
      calendarTab.setAttribute("aria-selected", String(active === "calendar"));
    }
    if (backupTab) {
      backupTab.classList.toggle("active", active === "backup");
      backupTab.setAttribute("aria-selected", String(active === "backup"));
    }
  }

  function renderCalendarLegend() {
    const legend = byId("calendar-legend");
    legend.innerHTML = "";

    Object.values(SOURCE_META).forEach((meta) => {
      const item = document.createElement("div");
      item.className = "d-inline-flex align-items-center gap-2 small text-body-secondary";

      const dot = document.createElement("span");
      dot.className = `lz-legend-dot ${meta.className}`;

      const label = document.createElement("span");
      label.textContent = meta.label;

      item.append(dot, label);
      legend.appendChild(item);
    });
  }

  function renderCalendar() {
    const grid = byId("calendar-grid");
    const label = byId("calendar-month-label");
    if (!grid || !label) return;

    const month = getCalendarMonth();
    const [year, mon] = month.split("-").map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd = new Date(year, mon, 0);
    const jsDay = monthStart.getDay();
    const mondayStartIndex = jsDay === 0 ? 6 : jsDay - 1;
    const firstCellDate = addDays(monthStart, -mondayStartIndex);

    label.textContent = monthStart.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

    const grouped = new Map();
    getCalendarEvents().forEach((event) => {
      if (!grouped.has(event.date)) grouped.set(event.date, []);
      grouped.get(event.date).push(event);
    });

    const weekdays = document.createElement("div");
    weekdays.className = "lz-calendar-weekdays";
    WEEKDAYS.forEach((day) => {
      const cell = document.createElement("div");
      cell.className = "lz-calendar-weekday";
      cell.textContent = day;
      weekdays.appendChild(cell);
    });

    const days = document.createElement("div");
    days.className = "lz-calendar-days";
    for (let index = 0; index < 42; index += 1) {
      const current = addDays(firstCellDate, index);
      const currentYmd = formatYmd(current);
      const inActiveMonth = current >= monthStart && current <= monthEnd;

      const cell = document.createElement("div");
      cell.className = `lz-calendar-day${inActiveMonth ? "" : " lz-outside"}`;

      const dayNo = document.createElement("div");
      dayNo.className = "lz-calendar-day-number";
      dayNo.textContent = String(current.getDate());
      cell.appendChild(dayNo);

      const events = grouped.get(currentYmd) || [];
      events.forEach((event) => {
        const entry = document.createElement("div");
        const source = SOURCE_META[event.source] || SOURCE_META.detail;
        entry.className = `lz-calendar-event ${source.className}`;
        entry.title = event.hint || source.label;
        entry.textContent = event.title;
        cell.appendChild(entry);
      });

      days.appendChild(cell);
    }

    grid.innerHTML = "";
    grid.append(weekdays, days);
    renderCalendarLegend();
  }

  return {
    getCalendarMonth,
    setCalendarMonth,
    renderViewState,
    renderCalendar,
  };
}
