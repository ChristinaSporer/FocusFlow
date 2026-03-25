import { addDays, formatYmd } from "./date-utils.js";

export function normalizeIcs(text) {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

export function getIcsProp(lines, key) {
  const found = lines.find((line) => line.startsWith(`${key}:`) || line.startsWith(`${key};`));
  if (!found) return "";
  const index = found.indexOf(":");
  return index >= 0 ? found.slice(index + 1).trim() : "";
}

export function parseIcsDate(raw) {
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

export function hashText(text) {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33) ^ text.charCodeAt(index);
  }
  return String(hash >>> 0);
}

export function parseIcsEvents(icsText) {
  const normalized = normalizeIcs(icsText);
  const blocks = normalized.split("BEGIN:VEVENT").slice(1);

  const events = blocks
    .map((block) => block.split("END:VEVENT")[0])
    .map((rawBlock) =>
      rawBlock
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    )
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

export function escapeIcsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function toIcsDate(dateLike) {
  const date = new Date(dateLike);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function toIcsDateTimeUtc(dateLike) {
  const date = new Date(dateLike);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hh}${mm}${ss}Z`;
}

export function serializeEventsToIcs(events) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FocusFlow//DE",
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
