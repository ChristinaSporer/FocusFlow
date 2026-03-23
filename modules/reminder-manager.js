import { byId } from "./dom.js";
import { dateOnly, formatDate } from "./date-utils.js";

export function createReminderManager({ getState, dispatch, onRenderAll }) {
  let reminderInterval = null;

  function setNotificationStatus(message) {
    const statusEl = byId("notification-status");
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  function upcomingItems() {
    const state = getState();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const nextDayStart = new Date(dayStart);
    nextDayStart.setDate(nextDayStart.getDate() + 1);

    const upcomingRough = state.roughPlans
      .filter((item) => {
        const date = dateOnly(item.date);
        return date >= dayStart && date <= nextDayStart;
      })
      .map(
        (item) => `Geplante Lernzeit in den nächsten 24h: ${item.hours}h am ${formatDate(item.date)}`
      );

    const upcomingGoals = state.goals
      .filter((goal) => {
        const date = dateOnly(goal.targetDate);
        return !goal.completed && date >= dayStart && date <= nextDayStart;
      })
      .map((goal) => `Ziel bald fällig: ${goal.title} (${formatDate(goal.targetDate)})`);

    return [...upcomingRough, ...upcomingGoals];
  }

  function inactivityMessage() {
    const state = getState();
    const days = Number(state.settings.inactivityDays) || 3;
    if (!state.trackedSessions.length) {
      return "Noch keine Lernzeit erfasst. Starte deine erste Session.";
    }

    const last = state.trackedSessions.reduce((acc, item) => {
      const timestamp = new Date(item.end).getTime();
      return Math.max(acc, timestamp);
    }, 0);

    const diffDays = Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000));
    if (diffDays >= days) {
      return `Seit ${diffDays} Tagen keine Lernsession. Plane oder starte heute eine kurze Einheit.`;
    }
    return null;
  }

  function maybeNotify(message) {
    const state = getState();
    if (!state.settings.notificationEnabled) return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification("Lernzeitplaner", { body: message });
    }
  }

  async function activateNotifications() {
    const hint = byId("reminder-hint");

    if (!window.isSecureContext) {
      hint.textContent = "Benachrichtigungen benötigen eine sichere Umgebung (https oder localhost).";
      setNotificationStatus("Aktivierung fehlgeschlagen: nur über https oder localhost möglich.");
      alert("Benachrichtigungen funktionieren nur über https oder localhost.");
      return;
    }

    if (!("Notification" in window)) {
      hint.textContent = "Browser unterstützt keine Benachrichtigungen.";
      setNotificationStatus("Dieser Browser unterstützt keine Benachrichtigungen.");
      alert("Browser unterstützt keine Notifications.");
      return;
    }

    try {
      if (Notification.permission === "denied") {
        dispatch({ type: "SET_NOTIFICATION_ENABLED", payload: { enabled: false } });
        setNotificationStatus(
          "Benachrichtigungen sind im Browser blockiert. Bitte in den Seiteneinstellungen erlauben."
        );
        return;
      }

      const permission = await Notification.requestPermission();
      const enabled = permission === "granted";
      dispatch({ type: "SET_NOTIFICATION_ENABLED", payload: { enabled } });

      if (enabled) {
        setNotificationStatus("Benachrichtigungen wurden aktiviert.");
        try {
          new Notification("Lernzeitplaner", {
            body: "Benachrichtigungen sind jetzt aktiv.",
          });
        } catch {
          // Some browsers can still reject immediate notifications despite granted permission.
        }
      } else {
        setNotificationStatus("Benachrichtigungen wurden nicht erlaubt.");
      }

      onRenderAll();
    } catch {
      setNotificationStatus("Benachrichtigungserlaubnis konnte nicht angefragt werden.");
    }
  }

  function runReminders() {
    const list = byId("reminder-list");
    list.innerHTML = "";

    const reminders = [...upcomingItems()];
    const inactivity = inactivityMessage();
    if (inactivity) reminders.push(inactivity);

    if (!reminders.length) {
      list.innerHTML = "<li><div class='item-main'><span>Keine aktuellen Erinnerungen</span></div></li>";
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

  function startLoop() {
    clearInterval(reminderInterval);
    reminderInterval = setInterval(runReminders, 60000);
  }

  function stopLoop() {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }

  return {
    activateNotifications,
    runReminders,
    startLoop,
    stopLoop,
    setNotificationStatus,
  };
}
