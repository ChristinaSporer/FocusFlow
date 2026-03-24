export function dateOnly(dateLike) {
  return new Date(`${dateLike}T00:00:00`);
}

function isoWeekParts(date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7);

  return {
    year: utcDate.getUTCFullYear(),
    week,
  };
}

function mondayOfIsoWeek(year, week) {
  const simple = new Date(Date.UTC(year, 0, 4 + (week - 1) * 7));
  const day = simple.getUTCDay() || 7;
  simple.setUTCDate(simple.getUTCDate() - day + 1);
  return new Date(simple.getUTCFullYear(), simple.getUTCMonth(), simple.getUTCDate());
}

export function parseWeekValue(weekValue) {
  const match = /^([0-9]{4})-W([0-9]{2})$/.exec(String(weekValue || ""));
  if (!match) return null;

  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!year || !week) return null;

  return mondayOfIsoWeek(year, week);
}

export function weekValueFromDate(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";

  const { year, week } = isoWeekParts(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function weekDateFromValue(weekValue) {
  const date = parseWeekValue(weekValue);
  return date ? formatYmd(date) : "";
}

export function weekOverlapsMonth(weekValue, monthValue) {
  const monday = parseWeekValue(weekValue);
  if (!monday) return false;

  for (let index = 0; index < 7; index += 1) {
    if (monthOf(addDays(monday, index)) === monthValue) {
      return true;
    }
  }

  return false;
}

export function formatCalendarWeek(value) {
  const weekValue = /^\d{4}-W\d{2}$/.test(String(value || "")) ? value : weekValueFromDate(value);
  const match = /^([0-9]{4})-W([0-9]{2})$/.exec(weekValue);
  if (!match) return "";
  return `KW ${Number(match[2])}/${match[1]}`;
}

export function formatDate(dateLike) {
  const date = new Date(dateLike);
  return date.toLocaleDateString("de-DE");
}

export function monthOf(dateLike) {
  const d = new Date(dateLike);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function addDays(dateLike, days) {
  const d = new Date(dateLike);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatYmd(dateLike) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isWithinNextSixMonths(dateLike) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const six = new Date(today);
  six.setMonth(six.getMonth() + 6);
  const value = dateOnly(dateLike);
  return value >= today && value <= six;
}
