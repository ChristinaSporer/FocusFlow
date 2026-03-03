const STORAGE_KEY = "lernzeitplaner-poc-v1";

const defaultData = () => ({
  goals: [],
  roughPlans: [],
  detailPlans: [],
  trackedSessions: [],
  settings: {
    inactivityDays: 3,
    lastReminderRun: null,
    notificationEnabled: false,
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
    return {
      ...defaultData(),
      ...parsed,
      settings: { ...defaultData().settings, ...(parsed.settings || {}) },
      timer: { ...defaultData().timer, ...(parsed.timer || {}) },
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

function renderAll() {
  renderGoals();
  renderRoughPlans();
  renderDetailPlans();
  renderTrackedSessions();
  renderStats();
  renderTimer();
  runReminders();
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
    },
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
