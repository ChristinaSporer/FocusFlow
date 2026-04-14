import { byId } from "./dom.js";
import { formatYmd } from "./date-utils.js";
import { normalizeGoals } from "./goal-utils.js";
import { defaultData } from "./state-store.js";
import { normalizeThemeMode } from "./theme-manager.js";

const ARRAY_KEYS = ["goals", "roughPlans", "detailPlans", "trackedSessions", "importedEvents"];
const ALLOWED_VIEWS = new Set(["list", "calendar"]);

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

function mergeById(existing = [], incoming = []) {
  const merged = new Map();

  existing.forEach((item) => {
    if (item && typeof item.id === "string" && item.id.trim()) {
      merged.set(item.id, item);
    }
  });

  incoming.forEach((item) => {
    if (item && typeof item.id === "string" && item.id.trim()) {
      merged.set(item.id, item);
    }
  });

  return Array.from(merged.values());
}

function collectValidArray(rawItems, key) {
  if (!Array.isArray(rawItems)) {
    return {
      valid: [],
      dropped: 0,
      warning: `Feld "${key}" hat kein Array-Format und wurde ignoriert.`,
    };
  }

  const valid = rawItems.filter(
    (item) => item && typeof item === "object" && typeof item.id === "string"
  );
  return {
    valid,
    dropped: rawItems.length - valid.length,
    warning: null,
  };
}

function normalizeSettings(importedSettings, fallbackSettings, warnings) {
  const nextSettings = { ...fallbackSettings };
  if (!importedSettings || typeof importedSettings !== "object") {
    return nextSettings;
  }

  if (typeof importedSettings.inactivityDays === "number" && importedSettings.inactivityDays > 0) {
    nextSettings.inactivityDays = importedSettings.inactivityDays;
  }

  if (
    typeof importedSettings.lastReminderRun === "string" ||
    importedSettings.lastReminderRun === null
  ) {
    nextSettings.lastReminderRun = importedSettings.lastReminderRun;
  }

  if (typeof importedSettings.notificationEnabled === "boolean") {
    nextSettings.notificationEnabled = importedSettings.notificationEnabled;
  }

  if (Number.isFinite(Number(importedSettings.notificationLeadMinutes))) {
    nextSettings.notificationLeadMinutes = Math.min(
      90,
      Math.max(0, Math.round(Number(importedSettings.notificationLeadMinutes)))
    );
  }

  if (typeof importedSettings.activeView === "string") {
    if (ALLOWED_VIEWS.has(importedSettings.activeView)) {
      nextSettings.activeView = importedSettings.activeView;
    } else {
      warnings.push("Unbekannter activeView-Wert wurde verworfen.");
    }
  }

  if (
    typeof importedSettings.calendarMonth === "string" ||
    importedSettings.calendarMonth === null
  ) {
    nextSettings.calendarMonth = importedSettings.calendarMonth;
  }

  if (typeof importedSettings.themeMode === "string") {
    nextSettings.themeMode = normalizeThemeMode(importedSettings.themeMode);
  }

  if (
    importedSettings.standardLearningTimes &&
    typeof importedSettings.standardLearningTimes === "object"
  ) {
    nextSettings.standardLearningTimes = importedSettings.standardLearningTimes;
  }

  return nextSettings;
}

function normalizeTimer(importedTimer, fallbackTimer) {
  const nextTimer = { ...fallbackTimer };
  if (!importedTimer || typeof importedTimer !== "object") {
    return nextTimer;
  }

  if (typeof importedTimer.start === "string" || importedTimer.start === null) {
    nextTimer.start = importedTimer.start;
  }

  return nextTimer;
}

function buildMergedState(currentState, importedState) {
  const defaults = defaultData();
  const warnings = [];
  const importedCounts = {};

  const merged = {
    ...defaults,
    ...currentState,
    settings: { ...defaults.settings, ...(currentState.settings || {}) },
    timer: { ...defaults.timer, ...(currentState.timer || {}) },
  };

  ARRAY_KEYS.forEach((key) => {
    const collection = collectValidArray(importedState?.[key], key);
    if (collection.warning) {
      warnings.push(collection.warning);
    }
    if (collection.dropped > 0) {
      warnings.push(
        `${collection.dropped} Eintrag(e) aus "${key}" wurden wegen fehlender ID verworfen.`
      );
    }

    merged[key] = mergeById(merged[key], collection.valid);
    if (key === "goals") {
      merged[key] = normalizeGoals(merged[key]);
    }
    importedCounts[key] = collection.valid.length;
  });

  merged.settings = normalizeSettings(importedState?.settings, merged.settings, warnings);
  merged.timer = normalizeTimer(importedState?.timer, merged.timer);

  return { merged, warnings, importedCounts };
}

export function createJsonManager({ getState }) {
  function setStatus(message) {
    const statusElement = byId("json-status");
    if (!statusElement) return;
    statusElement.textContent = message;
  }

  function exportToFile() {
    const state = getState();
    const fileName = `focusflow-export-${formatYmd(new Date())}.json`;
    const content = JSON.stringify(state, null, 2);

    downloadFile(fileName, content, "application/json;charset=utf-8");

    const status = `JSON-App-Stand als ${fileName} exportiert.`;
    setStatus(status);

    return {
      ok: true,
      status,
      fileName,
    };
  }

  async function importFromFile(file) {
    if (!file) {
      return { ok: false, status: "Bitte zuerst eine JSON-Datei auswählen." };
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        const status = "Import fehlgeschlagen. Das JSON-Format ist ungültig.";
        setStatus(status);
        return { ok: false, status };
      }

      const { merged, warnings, importedCounts } = buildMergedState(getState(), parsed);

      const importedTotal = Object.values(importedCounts).reduce((sum, count) => sum + count, 0);
      const status = warnings.length
        ? `Import teilweise erfolgreich: ${importedTotal} Datensätze übernommen, ${warnings.length} Hinweis(e).`
        : `Import erfolgreich: ${importedTotal} Datensätze übernommen.`;
      setStatus(status);

      return {
        ok: true,
        status,
        state: merged,
        warnings,
        importedCounts,
      };
    } catch {
      const status = "Import fehlgeschlagen. Bitte gültige JSON-Datei prüfen.";
      setStatus(status);
      return { ok: false, status };
    }
  }

  return {
    setStatus,
    exportToFile,
    importFromFile,
  };
}
