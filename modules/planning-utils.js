import { addDays, formatYmd } from "./date-utils.js";

export const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const WEEKDAY_LABELS = {
  mon: "Mo",
  tue: "Di",
  wed: "Mi",
  thu: "Do",
  fri: "Fr",
  sat: "Sa",
  sun: "So",
};

export function defaultStandardLearningTimes() {
  return {
    mon: { startTime: "08:00", endTime: "16:00" },
    tue: { startTime: "08:00", endTime: "16:00" },
    wed: { startTime: "08:00", endTime: "16:00" },
    thu: { startTime: "08:00", endTime: "16:00" },
    fri: { startTime: "08:00", endTime: "12:00" },
    sat: { startTime: "", endTime: "" },
    sun: { startTime: "", endTime: "" },
  };
}

export function normalizeStandardLearningTimes(rawValue) {
  const fallback = defaultStandardLearningTimes();
  if (!rawValue || typeof rawValue !== "object") return fallback;

  const normalized = { ...fallback };
  WEEKDAY_ORDER.forEach((weekday) => {
    const value = rawValue[weekday] || {};
    normalized[weekday] = {
      startTime:
        typeof value.startTime === "string" ? value.startTime : fallback[weekday].startTime,
      endTime: typeof value.endTime === "string" ? value.endTime : fallback[weekday].endTime,
    };

    const legacyHours = Number(value.hours);
    if (
      !normalized[weekday].startTime &&
      !normalized[weekday].endTime &&
      Number.isFinite(legacyHours) &&
      legacyHours > 0
    ) {
      normalized[weekday] = {
        startTime: "08:00",
        endTime: formatMinutesToTime(8 * 60 + Math.round(legacyHours * 60)),
      };
    }
  });

  return normalized;
}

function parseTimeToMinutes(value) {
  if (typeof value !== "string") return NaN;
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return NaN;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
  return hours * 60 + minutes;
}

function normalizeInterval(startMinutes, endMinutes) {
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return null;
  if (endMinutes <= startMinutes) return null;
  return { startMinutes, endMinutes };
}

function formatMinutesToTime(value) {
  const safe = Math.max(0, Math.round(value));
  const hours = String(Math.floor(safe / 60)).padStart(2, "0");
  const minutes = String(safe % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function getWeekdayKey(dateLike) {
  const date = new Date(dateLike);
  const day = date.getDay();
  if (day === 0) return "sun";
  return WEEKDAY_ORDER[day - 1];
}

export function resolveDayAvailability(dayConfig) {
  const entry = dayConfig || {};
  const startMinutes = parseTimeToMinutes(entry.startTime);
  const endMinutes = parseTimeToMinutes(entry.endTime);

  if (Number.isFinite(startMinutes) && Number.isFinite(endMinutes) && endMinutes > startMinutes) {
    return {
      minutes: endMinutes - startMinutes,
      startTime: formatMinutesToTime(startMinutes),
      endTime: formatMinutesToTime(endMinutes),
    };
  }

  return {
    minutes: 0,
    startTime: "",
    endTime: "",
  };
}

function subtractIntervals(baseInterval, occupiedIntervals) {
  let freeIntervals = [baseInterval];

  occupiedIntervals.forEach((occupied) => {
    freeIntervals = freeIntervals.flatMap((free) => {
      if (occupied.endMinutes <= free.startMinutes || occupied.startMinutes >= free.endMinutes) {
        return [free];
      }

      const next = [];
      if (occupied.startMinutes > free.startMinutes) {
        next.push({
          startMinutes: free.startMinutes,
          endMinutes: occupied.startMinutes,
        });
      }
      if (occupied.endMinutes < free.endMinutes) {
        next.push({
          startMinutes: occupied.endMinutes,
          endMinutes: free.endMinutes,
        });
      }
      return next;
    });
  });

  return freeIntervals.filter((interval) => interval.endMinutes > interval.startMinutes);
}

function buildOccupiedIntervals(detailPlans, date) {
  return (detailPlans || [])
    .filter((plan) => plan?.date === date)
    .map((plan) => {
      const timedInterval = normalizeInterval(
        parseTimeToMinutes(plan.startTime),
        parseTimeToMinutes(plan.endTime)
      );
      if (timedInterval) return timedInterval;
      if (Number(plan.minutes || 0) > 0) {
        return { startMinutes: 0, endMinutes: 24 * 60 };
      }
      return null;
    })
    .filter(Boolean)
    .sort((left, right) => left.startMinutes - right.startMinutes);
}

function buildSlotKey(date, startTime, endTime) {
  return `${date}|${startTime}|${endTime}`;
}

export function buildAvailablePlanningSlots({
  startDate,
  standardLearningTimes,
  detailPlans,
  horizonDays = 730,
}) {
  if (!startDate) return [];

  const normalizedTimes = normalizeStandardLearningTimes(standardLearningTimes);
  const slots = [];
  let cursor = new Date(`${startDate}T00:00:00`);

  for (let i = 0; i < horizonDays; i += 1) {
    const date = formatYmd(cursor);
    const weekdayKey = getWeekdayKey(date);
    const availability = resolveDayAvailability(normalizedTimes[weekdayKey]);
    if (availability.minutes > 0) {
      const baseInterval = normalizeInterval(
        parseTimeToMinutes(availability.startTime),
        parseTimeToMinutes(availability.endTime)
      );
      const freeIntervals = baseInterval
        ? subtractIntervals(baseInterval, buildOccupiedIntervals(detailPlans, date))
        : [];

      freeIntervals.forEach((interval) => {
        const startTime = formatMinutesToTime(interval.startMinutes);
        const endTime = formatMinutesToTime(interval.endMinutes);
        slots.push({
          key: buildSlotKey(date, startTime, endTime),
          date,
          weekdayKey,
          startTime,
          endTime,
          availableMinutes: interval.endMinutes - interval.startMinutes,
        });
      });
    }

    cursor = addDays(cursor, 1);
  }

  return slots;
}

export function distributeGoalWorkload({
  startDate,
  workloadHours,
  standardLearningTimes,
  selectedSlotKeys,
  detailPlans,
  horizonDays,
}) {
  const remainingInitial = Math.max(0, Math.round(Number(workloadHours || 0) * 60));

  if (!startDate || remainingInitial <= 0) {
    return { days: [], candidateSlots: [], remainingMinutes: 0, projectedEndDate: "" };
  }

  const candidateSlots = buildAvailablePlanningSlots({
    startDate,
    standardLearningTimes,
    detailPlans,
    horizonDays,
  });

  const selectedSet = selectedSlotKeys ? new Set(selectedSlotKeys) : null;
  const usableSlots = selectedSet
    ? candidateSlots.filter((slot) => selectedSet.has(slot.key))
    : candidateSlots;

  let remainingMinutes = remainingInitial;
  const days = [];

  for (const slot of usableSlots) {
    if (remainingMinutes <= 0) break;
    const allocatedMinutes = Math.min(slot.availableMinutes, remainingMinutes);
    days.push({
      key: slot.key,
      date: slot.date,
      weekdayKey: slot.weekdayKey,
      minutes: allocatedMinutes,
      startTime: slot.startTime,
      endTime: formatMinutesToTime(parseTimeToMinutes(slot.startTime) + allocatedMinutes),
    });
    remainingMinutes -= allocatedMinutes;
  }

  return {
    days,
    candidateSlots,
    remainingMinutes,
    projectedEndDate: days.length ? days[days.length - 1].date : "",
  };
}
