import { byId } from "./dom.js";
import { formatYmd, monthOf, nowIso } from "./date-utils.js";
import { resolveDetailPlanContext } from "./detail-plan-utils.js";
import { uid } from "./app-utils.js";
import { hashText, parseIcsEvents, serializeEventsToIcs } from "./ics-utils.js";

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function createIcsManager({ getState, dispatch }) {
  function setStatus(message) {
    byId("ics-status").textContent = message;
  }

  function replaceImportedEvents(sourceKey, sourceName, sourceHash, events) {
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

    dispatch({ type: "REPLACE_IMPORTED_EVENTS", payload: { sourceKey, events: mapped } });
    return mapped;
  }

  async function importFromFile(file) {
    if (!file) {
      return { ok: false, status: "Bitte zuerst eine .ics-Datei auswählen." };
    }

    try {
      const text = await file.text();
      const events = parseIcsEvents(text);
      if (!events.length) {
        return { ok: false, status: "Keine importierbaren Termine in der Datei gefunden." };
      }

      const mapped = replaceImportedEvents(
        `file:${file.name.toLowerCase()}`,
        file.name,
        hashText(text),
        events
      );

      const firstDate = events[0].date;
      const status = `${mapped.length} Termin(e) aus ${file.name} importiert.`;
      setStatus(status);

      return {
        ok: true,
        status,
        calendarMonth: monthOf(firstDate),
      };
    } catch {
      const status = "Import fehlgeschlagen. Bitte gültige .ics-Datei prüfen.";
      setStatus(status);
      return { ok: false, status };
    }
  }

  function buildExportEvents() {
    const state = getState();

    const detail = state.detailPlans.map((item) => {
      const { goal, milestone } = resolveDetailPlanContext(state, item);
      const focusTitle = milestone?.title || item.milestone || item.topic || "Detailplanung";
      const descriptionParts = [`${item.minutes} Minuten`];
      if (goal?.title) descriptionParts.push(`Hauptziel: ${goal.title}`);
      if (item.topic && item.topic !== focusTitle)
        descriptionParts.push(`Lerninhalt: ${item.topic}`);

      return {
        uid: item.id || uid(),
        date: item.date,
        summary: `Detailplanung: ${focusTitle}`,
        description: descriptionParts.join("; "),
      };
    });

    const rough = state.roughPlans
      .filter(
        (item) =>
          (Array.isArray(item.plannedDays) && item.plannedDays.length) ||
          (item.date && Number(item.hours || 0) > 0)
      )
      .map((item) => {
        const hasPlannedDays = Array.isArray(item.plannedDays) && item.plannedDays.length > 0;
        const hours = hasPlannedDays
          ? Number(item.totalWorkloadHours || 0)
          : Number(item.hours || 0);

        return {
          uid: item.id || uid(),
          date: hasPlannedDays ? item.plannedDays[item.plannedDays.length - 1].date : item.date,
          summary: `Grobplanung: ${hours} h`,
          description: hasPlannedDays
            ? `Verteilte Lerntage: ${item.plannedDays.length}`
            : item.note || "",
        };
      });

    return [...detail, ...rough].sort((a, b) => a.date.localeCompare(b.date));
  }

  function exportToFile() {
    const events = buildExportEvents();
    if (!events.length) {
      const status = "Keine App-Termine für den Export vorhanden.";
      setStatus(status);
      return { ok: false, status };
    }

    const fileName = `lernzeitplaner-export-${formatYmd(new Date())}.ics`;
    const ics = serializeEventsToIcs(events);
    downloadFile(fileName, ics, "text/calendar;charset=utf-8");

    const status = `${events.length} App-Termin(e) als ${fileName} exportiert.`;
    setStatus(status);

    return {
      ok: true,
      status,
    };
  }

  return {
    importFromFile,
    exportToFile,
    setStatus,
  };
}
