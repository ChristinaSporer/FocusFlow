export function dateOnly(dateLike) {
  return new Date(`${dateLike}T00:00:00`);
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
