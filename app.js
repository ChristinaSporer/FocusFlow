const STORAGE_KEY = "lernzeitplaner-poc-v1";

const SOURCE_META = {
  detail: { label: "Detailplanung", className: "source-detail" },
  rough: { label: "Grobplanung", className: "source-rough" },
  tracked: { label: "Tracking", className: "source-tracked" },
  import: { label: "ICS-Import", className: "source-import" },
};

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const defaultData = () => ({
  goals: [],
  roughPlans: [],
  detailPlans: [],
  trackedSessions: [],
  importedEvents: [],
  settings: {
    inactivityDays: 3,
    lastReminderRun: null,
    notificationEnabled: false,
    activeView: "list",
    calendarMonth: null,
  },
  timer: {
    start: null,
  },
});

let state = loadState();
let timerInterval = null;

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultData();
  try {
    const parsed = JSON.parse(raw);
    const defaults = defaultData();
    return {
      ...defaults,
      ...parsed,
      importedEvents: Array.isArray(parsed.importedEvents) ? parsed.importedEvents : [],
      settings: { ...defaults.settings, ...(parsed.settings || {}) },
      timer: { ...defaults.timer, ...(parsed.timer || {}) },
    };
  } catch {
    return defaultData();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function byId(id) {
  return document.getElementById(id);
}

function dateOnly(dateLike) {
  return new Date(`${dateLike}T00:00:00`);
}

function formatDate(dateLike) {
  const date = new Date(dateLike);
  return date.toLocaleDateString("de-DE");
}

function toMinutes(hours) {
  return Math.round(Number(hours) * 60);
}

function sum(array) {
  return array.reduce((acc, value) => acc + value, 0);
}

function monthOf(dateLike) {
  const d = new Date(dateLike);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

function nowIso() {
  return new Date().toISOString();
}

function addDays(dateLike, days) {
  const d = new Date(dateLike);
  d.setDate(d.getDate() + days);
  return d;
}

function formatYmd(dateLike) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isWithinNextSixMonths(dateLike) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const six = new Date(today);
  six.setMonth(six.getMonth() + 6);
  const value = dateOnly(dateLike);
  return value >= today && value <= six;
}

function buildRow(main, sub, { done = false, onDelete, actions = [] } = {}) {
  const li = document.createElement("li");
  if (done) li.classList.add("done");

  const info = document.createElement("div");
  info.className = "item-main";
  const title = document.createElement("span");
  title.textContent = main;
  const small = document.createElement("small");
  small.textContent = sub;
  info.append(title, small);

  const rowActions = document.createElement("div");
  rowActions.className = "row-actions";

  actions.forEach((action) => rowActions.appendChild(action));

  const del = document.createElement("button");
  del.className = "icon-btn";
  del.textContent = "Löschen";
  del.addEventListener("click", onDelete);
  rowActions.appendChild(del);

  li.append(info, rowActions);
  return li;
}

function renderGoals() {
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
      goal.completed = checkbox.checked;
      goal.completedAt = checkbox.checked ? nowIso() : null;
      touchActivity();
      saveState();
      renderAll();
    });

    const goalRow = buildRow(goal.title, `Bis ${formatDate(goal.targetDate)}`, {
      done: goal.completed,
      onDelete: () => {
        state.goals = state.goals.filter((item) => item.id !== goal.id);
        saveState();
        renderAll();
      },
      actions: [checkbox],
    });

    list.appendChild(goalRow);

    if (goal.completed) {
      const doneRow = document.createElement("li");
      doneRow.classList.add("done");
      doneRow.innerHTML = `<div class="item-main"><span>${goal.title}</span><small>Erreicht am ${formatDate(goal.completedAt)}</small></div>`;
      achieved.appendChild(doneRow);
    }
  });

  if (!sorted.length) {
    list.innerHTML = "<li><div class='item-main'><span>Keine Ziele vorhanden</span></div></li>";
  }
  if (!achieved.children.length) {
    achieved.innerHTML =
      "<li><div class='item-main'><span>Noch keine erreichten Ziele</span></div></li>";
  }
}

function renderRoughPlans() {
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
          state.roughPlans = state.roughPlans.filter((item) => item.id !== plan.id);
          saveState();
          renderAll();
        },
      }
    );
    list.appendChild(row);
  });

  if (!data.length) {
    list.innerHTML =
      "<li><div class='item-main'><span>Keine Grobplanung in den nächsten 6 Monaten</span></div></li>";
  }
}

function renderDetailPlans() {
  const month = byId("month-select").value;
  const list = byId("detail-list");
  list.innerHTML = "";

  const data = [...state.detailPlans]
    .filter((item) => monthOf(item.date) === month)
    .sort((a, b) => a.date.localeCompare(b.date));

  data.forEach((item) => {
    const flag = document.createElement("input");
    flag.type = "checkbox";
    flag.checked = item.done;
    flag.title = "Zwischenziel erreicht";
    flag.addEventListener("change", () => {
      item.done = flag.checked;
      saveState();
      renderAll();
    });

    const row = buildRow(
      `${item.minutes} Min · ${item.topic}`,
      `${formatDate(item.date)}${item.milestone ? ` · Zwischenziel: ${item.milestone}` : ""}`,
      {
        done: item.done,
        onDelete: () => {
          state.detailPlans = state.detailPlans.filter((p) => p.id !== item.id);
          saveState();
          renderAll();
        },
        actions: [flag],
      }
    );
    list.appendChild(row);
  });

  if (!data.length) {
    list.innerHTML =
      "<li><div class='item-main'><span>Keine Detailplanung für diesen Monat</span></div></li>";
  }
}

function renderTrackedSessions() {
  const list = byId("track-list");
  list.innerHTML = "";

  const data = [...state.trackedSessions].sort((a, b) => b.start.localeCompare(a.start));

  data.forEach((session) => {
    const row = buildRow(
      `${session.minutes} Min fokussierte Lernzeit`,
      `${formatDate(session.start)}${session.note ? ` · ${session.note}` : ""}`,
      {
        onDelete: () => {
          state.trackedSessions = state.trackedSessions.filter((s) => s.id !== session.id);
          saveState();
          renderAll();
        },
      }
    );
    list.appendChild(row);
  });

  if (!data.length) {
    list.innerHTML =
      "<li><div class='item-main'><span>Noch keine getrackte Lernzeit</span></div></li>";
  }
}

function renderStats() {
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

  const currentMonth = byId("month-select").value;
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
    <div class="stat"><small>Geplant (6M)</small><b>${plannedSixMonthsMin} Min</b></div>
    <div class="stat"><small>Getrackt gesamt</small><b>${trackedMin} Min</b></div>
    <div class="stat"><small>Aktueller Monat geplant</small><b>${monthlyPlanned} Min</b></div>
    <div class="stat"><small>Aktueller Monat getrackt</small><b>${monthlyTracked} Min</b></div>
  `;

  const timePercent =
    plannedSixMonthsMin === 0
      ? 0
      : Math.min(100, Math.round((trackedMin / plannedSixMonthsMin) * 100));
  const goalPercent = totalGoals === 0 ? 0 : Math.round((completedGoals / totalGoals) * 100);

  byId("time-progress").style.width = `${timePercent}%`;
  byId("goal-progress").style.width = `${goalPercent}%`;
}

function toClock(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function renderTimer() {
  const display = byId("timer-display");
  if (!state.timer.start) {
    display.textContent = "00:00:00";
    return;
  }
  const elapsed = Date.now() - new Date(state.timer.start).getTime();
  display.textContent = toClock(elapsed);
}

function startTimer() {
  if (state.timer.start) return;
  state.timer.start = nowIso();
  touchActivity();
  saveState();
  renderTimer();
  timerInterval = setInterval(renderTimer, 1000);
}

function stopTimer() {
  if (!state.timer.start) return;
  const note = byId("track-note").value.trim();
  const end = new Date();
  const start = new Date(state.timer.start);
  const minutes = Math.max(1, Math.round((end - start) / 60000));

  state.trackedSessions.push({
    id: uid(),
    start: start.toISOString(),
    end: end.toISOString(),
    minutes,
    note,
  });

  state.timer.start = null;
  byId("track-note").value = "";
  touchActivity();
  saveState();
  clearInterval(timerInterval);
  timerInterval = null;
  renderAll();
}

function touchActivity() {
  state.settings.lastReminderRun = nowIso();
}

function upcomingItems() {
  const now = new Date();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcomingRough = state.roughPlans
    .filter((item) => {
      const d = dateOnly(item.date);
      return d >= now && d <= next24h;
    })
    .map(
      (item) => `Geplante Lernzeit in den nächsten 24h: ${item.hours}h am ${formatDate(item.date)}`
    );

  const upcomingGoals = state.goals
    .filter((goal) => {
      const d = dateOnly(goal.targetDate);
      return !goal.completed && d >= now && d <= next24h;
    })
    .map((goal) => `Ziel bald fällig: ${goal.title} (${formatDate(goal.targetDate)})`);

  return [...upcomingRough, ...upcomingGoals];
}

function inactivityMessage() {
  const days = Number(state.settings.inactivityDays) || 3;
  if (!state.trackedSessions.length)
    return `Noch keine Lernzeit erfasst. Starte deine erste Session.`;

  const last = state.trackedSessions.reduce((acc, item) => {
    const t = new Date(item.end).getTime();
    return Math.max(acc, t);
  }, 0);

  const diffDays = Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000));
  if (diffDays >= days) {
    return `Seit ${diffDays} Tagen keine Lernsession. Plane oder starte heute eine kurze Einheit.`;
  }
  return null;
}

function maybeNotify(message) {
  if (!state.settings.notificationEnabled) return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification("Lernzeitplaner", { body: message });
  }
}

function runReminders() {
  const list = byId("reminder-list");
  list.innerHTML = "";

  const reminders = [...upcomingItems()];
  const inactivity = inactivityMessage();
  if (inactivity) reminders.push(inactivity);

  if (!reminders.length) {
    list.innerHTML =
      "<li><div class='item-main'><span>Keine aktuellen Erinnerungen</span></div></li>";
    byId("reminder-hint").textContent = "Erinnerungen geprüft: aktuell nichts offen.";
    return;
  }

  reminders.forEach((text) => {
    const li = document.createElement("li");
    li.innerHTML = `<div class='item-main'><span>${text}</span></div>`;
    list.appendChild(li);
    maybeNotify(text);
  });

  byId("reminder-hint").textContent = `Erinnerungen aktiv (${reminders.length} Hinweis(e)).`;
}

function getCalendarMonth() {
  return state.settings.calendarMonth || monthOf(new Date());
}

function setCalendarMonth(month) {
  state.settings.calendarMonth = month;
  saveState();
}

function getCalendarEvents() {
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

  const imported = state.importedEvents.map((event) => ({
    id: event.id,
    source: "import",
    date: event.date,
    title: event.summary || "Importierter Termin",
    hint: event.sourceName ? `Quelle: ${event.sourceName}` : "",
  }));

  return [...detailEvents, ...roughEvents, ...trackedEvents, ...imported].sort((a, b) => {
    if (a.date === b.date) return a.title.localeCompare(b.title);
    return a.date.localeCompare(b.date);
  });
}

function renderViewState() {
  const listView = byId("list-view");
  const calendarView = byId("calendar-view");
  const listTab = byId("tab-list");
  const calendarTab = byId("tab-calendar");

  const active = state.settings.activeView === "calendar" ? "calendar" : "list";
  listView.classList.toggle("hidden", active !== "list");
  calendarView.classList.toggle("hidden", active !== "calendar");

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
    item.className = "legend-item";

    const dot = document.createElement("span");
    dot.className = `legend-dot ${meta.className}`;

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
  weekdays.className = "calendar-weekdays";
  WEEKDAYS.forEach((day) => {
    const cell = document.createElement("div");
    cell.className = "calendar-weekday";
    cell.textContent = day;
    weekdays.appendChild(cell);
  });

  const days = document.createElement("div");
  days.className = "calendar-days";
  for (let i = 0; i < 42; i += 1) {
    const current = addDays(firstCellDate, i);
    const currentYmd = formatYmd(current);
    const inActiveMonth = current >= monthStart && current <= monthEnd;

    const cell = document.createElement("div");
    cell.className = `calendar-day${inActiveMonth ? "" : " outside"}`;

    const dayNo = document.createElement("div");
    dayNo.className = "calendar-day-number";
    dayNo.textContent = String(current.getDate());
    cell.appendChild(dayNo);

    const events = grouped.get(currentYmd) || [];
    events.forEach((event) => {
      const entry = document.createElement("div");
      const source = SOURCE_META[event.source] || SOURCE_META.detail;
      entry.className = `calendar-event ${source.className}`;
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

function normalizeIcs(text) {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function getIcsProp(lines, key) {
  const found = lines.find((line) => line.startsWith(`${key}:`) || line.startsWith(`${key};`));
  if (!found) return "";
  const index = found.indexOf(":");
  return index >= 0 ? found.slice(index + 1).trim() : "";
}

function parseIcsDate(raw) {
  if (!raw) return null;

  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }

  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!match) return null;

  const [, y, m, d, hh, mm, ss, z] = match;
  const date = z
    ? new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)))
    : new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));

  return formatYmd(date);
}

function hashText(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return String(hash >>> 0);
}

function parseIcsEvents(icsText) {
  const normalized = normalizeIcs(icsText);
  const blocks = normalized.split("BEGIN:VEVENT").slice(1);

  const events = blocks
    .map((block) => block.split("END:VEVENT")[0])
    .map((rawBlock) => rawBlock.split("\n").map((line) => line.trim()).filter(Boolean))
    .map((lines) => {
      const startRaw = getIcsProp(lines, "DTSTART");
      const date = parseIcsDate(startRaw);
      if (!date) return null;

      return {
        externalUid: getIcsProp(lines, "UID") || "",
        summary: getIcsProp(lines, "SUMMARY") || "Importierter Termin",
        date,
      };
    })
    .filter(Boolean);

  const seen = new Set();
  return events.filter((event) => {
    const key = `${event.externalUid}|${event.date}|${event.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function replaceImportedEvents(sourceKey, sourceName, sourceHash, events) {
  state.importedEvents = state.importedEvents.filter((item) => item.sourceKey !== sourceKey);

  const mapped = events.map((event) => ({
    id: uid(),
    sourceKey,
    sourceName,
    sourceHash,
    externalUid: event.externalUid,
    date: event.date,
    summary: event.summary,
    createdAt: nowIso(),
  }));

  state.importedEvents.push(...mapped);
  saveState();
  renderAll();
  byId("ics-status").textContent = `${mapped.length} Termin(e) aus ${sourceName} importiert.`;
}

function escapeIcsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcsDate(dateLike) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function toIcsDateTimeUtc(dateLike) {
  const d = new Date(dateLike);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${hh}${mm}${ss}Z`;
}

function buildExportEvents() {
  const detail = state.detailPlans.map((item) => ({
    uid: item.id || uid(),
    date: item.date,
    summary: `Detailplanung: ${item.topic}`,
    description: `${item.minutes} Minuten${item.milestone ? `; Zwischenziel: ${item.milestone}` : ""}`,
  }));

  const rough = state.roughPlans.map((item) => ({
    uid: item.id || uid(),
    date: item.date,
    summary: `Grobplanung: ${item.hours} h`,
    description: item.note || "",
  }));

  return [...detail, ...rough].sort((a, b) => a.date.localeCompare(b.date));
}

function serializeEventsToIcs(events) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lernzeitplaner POC//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  events.forEach((event) => {
    const start = toIcsDate(event.date);
    const end = toIcsDate(addDays(`${event.date}T00:00:00`, 1));

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcsText(event.uid)}`);
    lines.push(`DTSTAMP:${toIcsDateTimeUtc(new Date())}`);
    lines.push(`DTSTART;VALUE=DATE:${start}`);
    lines.push(`DTEND;VALUE=DATE:${end}`);
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderAll() {
  renderGoals();
  renderRoughPlans();
  renderDetailPlans();
  renderTrackedSessions();
  renderStats();
  renderTimer();
  runReminders();
  renderViewState();
  renderCalendar();
}

function initForms() {
  byId("goal-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = byId("goal-title").value.trim();
    const targetDate = byId("goal-date").value;
    if (!title || !targetDate) return;

    state.goals.push({ id: uid(), title, targetDate, completed: false, completedAt: null });
    event.target.reset();
    touchActivity();
    saveState();
    renderAll();
  });

  byId("rough-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const date = byId("rough-date").value;
    const hours = Number(byId("rough-hours").value);
    const note = byId("rough-note").value.trim();
    if (!date || !hours) return;

    state.roughPlans.push({ id: uid(), date, hours, note });
    event.target.reset();
    touchActivity();
    saveState();
    renderAll();
  });

  byId("detail-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const date = byId("detail-date").value;
    const minutes = Number(byId("detail-minutes").value);
    const topic = byId("detail-topic").value.trim();
    const milestone = byId("detail-milestone").value.trim();
    if (!date || !minutes || !topic) return;

    state.detailPlans.push({ id: uid(), date, minutes, topic, milestone, done: false });
    event.target.reset();
    touchActivity();
    saveState();
    renderAll();
  });

  byId("month-select").addEventListener("change", renderAll);

  [byId("tab-list"), byId("tab-calendar")].forEach((btn) => {
    btn.addEventListener("click", () => {
      state.settings.activeView = btn.dataset.view;
      saveState();
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
      state.settings.inactivityDays = days;
      saveState();
      renderAll();
    }
  });

  byId("enable-notifications").addEventListener("click", async () => {
    if (!("Notification" in window)) {
      alert("Browser unterstützt keine Notifications.");
      return;
    }

    const permission = await Notification.requestPermission();
    state.settings.notificationEnabled = permission === "granted";
    saveState();
    renderAll();
  });

  byId("load-demo").addEventListener("click", () => {
    loadDemoData();
    saveState();
    renderAll();
  });

  byId("ics-import").addEventListener("click", async () => {
    const input = byId("ics-file");
    const file = input.files && input.files[0];
    if (!file) {
      byId("ics-status").textContent = "Bitte zuerst eine .ics-Datei auswählen.";
      return;
    }

    try {
      const text = await file.text();
      const events = parseIcsEvents(text);
      if (!events.length) {
        byId("ics-status").textContent = "Keine importierbaren Termine in der Datei gefunden.";
        return;
      }

      replaceImportedEvents(
        `file:${file.name.toLowerCase()}`,
        file.name,
        hashText(text),
        events
      );

      const firstDate = events[0]?.date;
      if (firstDate) {
        setCalendarMonth(monthOf(firstDate));
        renderCalendar();
      }
    } catch {
      byId("ics-status").textContent = "Import fehlgeschlagen. Bitte gültige .ics-Datei prüfen.";
    }
  });

  byId("ics-export").addEventListener("click", () => {
    const events = buildExportEvents();
    if (!events.length) {
      byId("ics-status").textContent = "Keine App-Termine für den Export vorhanden.";
      return;
    }

    const fileName = `lernzeitplaner-export-${formatYmd(new Date())}.ics`;
    const ics = serializeEventsToIcs(events);
    downloadFile(fileName, ics, "text/calendar;charset=utf-8");
    byId("ics-status").textContent = `${events.length} App-Termin(e) als ${fileName} exportiert.`;
  });

  byId("reset-data").addEventListener("click", () => {
    const ok = confirm("Alle Daten wirklich löschen?");
    if (!ok) return;
    state = defaultData();
    saveState();
    setInitialValues();
    renderAll();
  });
}

function loadDemoData() {
  const today = new Date();
  const y = today.getFullYear();
  const m = `${today.getMonth() + 1}`.padStart(2, "0");
  const month = `${y}-${m}`;

  const in5 = new Date(today);
  in5.setDate(today.getDate() + 5);
  const in10 = new Date(today);
  in10.setDate(today.getDate() + 10);
  const in20 = new Date(today);
  in20.setDate(today.getDate() + 20);

  state = {
    ...defaultData(),
    goals: [
      {
        id: uid(),
        title: "Modul Software Engineering abschließen",
        targetDate: in20.toISOString().slice(0, 10),
        completed: false,
        completedAt: null,
      },
      {
        id: uid(),
        title: "Klausurvorbereitung Mathematik",
        targetDate: in10.toISOString().slice(0, 10),
        completed: true,
        completedAt: nowIso(),
      },
    ],
    roughPlans: [
      { id: uid(), date: in5.toISOString().slice(0, 10), hours: 3, note: "Wiederholung UML" },
      { id: uid(), date: in10.toISOString().slice(0, 10), hours: 4, note: "Altklausuren" },
    ],
    detailPlans: [
      {
        id: uid(),
        date: in5.toISOString().slice(0, 10),
        minutes: 90,
        topic: "User Stories",
        milestone: "Kapitel 4 durcharbeiten",
        done: false,
      },
      {
        id: uid(),
        date: in10.toISOString().slice(0, 10),
        minutes: 120,
        topic: "Testmethoden",
        milestone: "10 Übungsaufgaben",
        done: true,
      },
    ],
    trackedSessions: [
      {
        id: uid(),
        start: new Date().toISOString(),
        end: new Date(Date.now() + 45 * 60000).toISOString(),
        minutes: 45,
        note: "Fokusblock am Morgen",
      },
      {
        id: uid(),
        start: new Date().toISOString(),
        end: new Date(Date.now() + 60 * 60000).toISOString(),
        minutes: 60,
        note: "Abend-Review",
      },
    ],
    settings: {
      inactivityDays: 3,
      lastReminderRun: nowIso(),
      notificationEnabled: false,
      activeView: "list",
      calendarMonth: month,
    },
    importedEvents: [],
    timer: {
      start: null,
    },
  };

  byId("month-select").value = month;
}

function setInitialValues() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  byId("month-select").value = month;
  if (!state.settings.calendarMonth) {
    state.settings.calendarMonth = month;
  }
  byId("inactivity-days").value = state.settings.inactivityDays;

  if (state.timer.start) {
    clearInterval(timerInterval);
    timerInterval = setInterval(renderTimer, 1000);
  }
}

function init() {
  setInitialValues();
  initForms();
  renderAll();
  setInterval(runReminders, 60000);
}

init();
