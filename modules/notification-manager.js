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

function parseTrackedTimestamp(session) {
  const value = session?.end || session?.start || null;
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getLatestTrackedAt(trackedSessions) {
  let latest = null;
  (trackedSessions || []).forEach((session) => {
    const candidate = parseTrackedTimestamp(session);
    if (!candidate) return;
    if (!latest || candidate.getTime() > latest.getTime()) {
      latest = candidate;
    }
  });
  return latest;
}

export function createNotificationManager({ getState, dispatch }) {
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

  function syncUpcomingPlanNotifications(state) {
    const enabled = Boolean(state.settings?.notificationEnabled);
    const leadMinutes = Math.min(
      90,
      Math.max(0, Math.round(Number(state.settings?.notificationLeadMinutes ?? 15)))
    );
    const detailPlans = state.detailPlans || [];

    cleanupSentKeys(detailPlans, leadMinutes);

    if (!enabled) return;

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

  function syncInactivityNotification(state) {
    const settings = state.settings || {};
    if (!settings.inactivityNotificationEnabled) return;

    const latestTrackedAt = getLatestTrackedAt(state.trackedSessions || []);
    if (!latestTrackedAt) return;

    const inactivityDays = Math.min(
      60,
      Math.max(1, Math.round(Number(settings.inactivityDays ?? 3)))
    );
    const thresholdMs = inactivityDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const latestTrackedAtMs = latestTrackedAt.getTime();

    if (now - latestTrackedAtMs < thresholdMs) return;

    const lastNotificationAt = settings.lastInactivityNotificationAt
      ? new Date(settings.lastInactivityNotificationAt)
      : null;
    if (lastNotificationAt && !Number.isNaN(lastNotificationAt.getTime())) {
      if (lastNotificationAt.getTime() >= latestTrackedAtMs) return;
    }

    const inactiveForDays = Math.floor((now - latestTrackedAtMs) / (24 * 60 * 60 * 1000));
    new Notification(`FocusFlow: Seit ${inactiveForDays} Tagen keine Lernzeit erfasst`, {
      body: `Du hast seit ${inactiveForDays} Tagen keine Lernzeit getrackt. Zeit für den nächsten Fokusblock?`,
    });

    dispatch?.({
      type: "SET_LAST_INACTIVITY_NOTIFICATION_AT",
      payload: { timestamp: new Date(now).toISOString() },
    });
  }

  function sync() {
    const state = getState();
    if (getNotificationPermission() !== "granted") return;
    syncUpcomingPlanNotifications(state);
    syncInactivityNotification(state);
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
