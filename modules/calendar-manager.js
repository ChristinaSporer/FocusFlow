import { byId } from "./dom.js";
import { addDays, formatYmd, monthOf } from "./date-utils.js";

const SOURCE_META = {
  detail: { label: "Detailplanung", className: "lz-source-detail" },
  rough: { label: "Grobplanung", className: "lz-source-rough" },
  tracked: { label: "Tracking", className: "lz-source-tracked" },
  import: { label: "ICS-Import", className: "lz-source-import" },
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

    const detailEvents = state.detailPlans.map((item) => ({
      id: item.id,
      source: "detail",
      date: item.date,
      title: `${item.topic} (${item.minutes} Min)`,
      hint: item.milestone ? `Zwischenziel: ${item.milestone}` : "",
    }));

    const roughEvents = state.roughPlans.map((plan) => ({
      id: plan.id,
      source: "rough",
      date: plan.date,
      title: `${plan.hours} h geplant`,
      hint: plan.note || "",
    }));

    const trackedEvents = state.trackedSessions.map((session) => ({
      id: session.id,
      source: "tracked",
      date: formatYmd(session.start),
      title: `${session.minutes} Min getrackt`,
      hint: session.note || "",
    }));

    const importedEvents = state.importedEvents.map((event) => ({
      id: event.id,
      source: "import",
      date: event.date,
      title: event.summary || "Importierter Termin",
      hint: event.sourceName ? `Quelle: ${event.sourceName}` : "",
    }));

    return [...detailEvents, ...roughEvents, ...trackedEvents, ...importedEvents].sort((a, b) => {
      if (a.date === b.date) return a.title.localeCompare(b.title);
      return a.date.localeCompare(b.date);
    });
  }

  function renderViewState() {
    const state = getState();
    const listView = byId("list-view");
    const calendarView = byId("calendar-view");
    const listTab = byId("tab-list");
    const calendarTab = byId("tab-calendar");

    const active = state.settings.activeView === "calendar" ? "calendar" : "list";
    listView.classList.toggle("d-none", active !== "list");
    calendarView.classList.toggle("d-none", active !== "calendar");

    listTab.classList.toggle("active", active === "list");
    calendarTab.classList.toggle("active", active === "calendar");
    listTab.setAttribute("aria-selected", String(active === "list"));
    calendarTab.setAttribute("aria-selected", String(active === "calendar"));
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
      cell.className = `lz-calendar-day${inActiveMonth ? "" : " outside"}`;

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
