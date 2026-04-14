function canUseNotifications() {
  return typeof Notification !== "undefined";
}

function getNotificationPermission() {
  if (!canUseNotifications()) return "unsupported";
  return Notification.permission;
}

function buildNotificationKey(plan, leadMinutes) {
  return [plan.id, plan.date, plan.startTime, leadMinutes].join("|");
}

function parsePlanStart(plan) {
  if (!plan?.date || !plan?.startTime) return null;
  const value = new Date(`${plan.date}T${plan.startTime}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function createNotificationManager({ getState }) {
  let intervalId = null;
  const sentNotificationKeys = new Set();

  function cleanupSentKeys(detailPlans, leadMinutes) {
    const validKeys = new Set(
      (detailPlans || [])
        .filter((plan) => plan?.id && plan?.date && plan?.startTime)
        .map((plan) => buildNotificationKey(plan, leadMinutes))
    );

    Array.from(sentNotificationKeys).forEach((key) => {
      if (!validKeys.has(key)) sentNotificationKeys.delete(key);
    });
  }

  async function requestPermission() {
    if (!canUseNotifications()) return "unsupported";
    if (Notification.permission === "default") {
      return Notification.requestPermission();
    }
    return Notification.permission;
  }

  function sync() {
    const state = getState();
    const enabled = Boolean(state.settings?.notificationEnabled);
    const leadMinutes = Math.min(
      90,
      Math.max(0, Math.round(Number(state.settings?.notificationLeadMinutes ?? 15)))
    );
    const detailPlans = state.detailPlans || [];

    cleanupSentKeys(detailPlans, leadMinutes);

    if (!enabled || getNotificationPermission() !== "granted") return;

    const now = Date.now();
    detailPlans.forEach((plan) => {
      if (plan?.done) return;
      const startDate = parsePlanStart(plan);
      if (!startDate) return;

      const startTime = startDate.getTime();
      const triggerAt = startTime - leadMinutes * 60 * 1000;
      const key = buildNotificationKey(plan, leadMinutes);

      if (now < triggerAt || now >= startTime) return;
      if (sentNotificationKeys.has(key)) return;

      const sessionTitle = plan.topic || plan.milestone || "Geplante Lernzeit";
      const title =
        leadMinutes === 0
          ? "FocusFlow: Zeit zu lernen"
          : `FocusFlow: In ${leadMinutes} Minuten beginnt deine Lernsession`;
      const body =
        leadMinutes === 0
          ? `${sessionTitle} · ${plan.startTime}${plan.endTime ? `-${plan.endTime}` : ""}`
          : `${sessionTitle} · Start um ${plan.startTime}${plan.endTime ? `-${plan.endTime}` : ""}`;

      new Notification(title, { body });
      sentNotificationKeys.add(key);
    });
  }

  function ensurePolling() {
    if (intervalId !== null) return;
    intervalId = window.setInterval(sync, 30000);
  }

  function dispose() {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  }

  ensurePolling();

  return {
    requestPermission,
    sync,
    getPermission: getNotificationPermission,
    dispose,
  };
}
