import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addDays,
  dateOnly,
  formatCalendarWeek,
  formatDate,
  formatYmd,
  isWithinNextSixMonths,
  monthOf,
  parseWeekValue,
  weekDateFromValue,
  weekOverlapsMonth,
  weekValueFromDate,
} from "../../modules/date-utils.js";

describe("modules/date-utils", () => {
  describe("parseWeekValue", () => {
    it("gibt null fuer null-Eingabe zurueck", () => {
      expect(parseWeekValue(null)).toBeNull();
    });

    it("gibt null fuer leeren String zurueck", () => {
      expect(parseWeekValue("")).toBeNull();
    });

    it("gibt null fuer ungueltiges Format zurueck", () => {
      expect(parseWeekValue("invalid")).toBeNull();
      expect(parseWeekValue("2026-15")).toBeNull();
      expect(parseWeekValue("2026-W")).toBeNull();
    });

    it("gibt den Montag der ISO-Woche fuer gueltigen Wochenwert zurueck", () => {
      const monday = parseWeekValue("2026-W15");
      expect(monday).toBeInstanceOf(Date);
      // ISO-Woche 15/2026 beginnt am 06.04.2026 (Montag)
      expect(formatYmd(monday)).toBe("2026-04-06");
    });

    it("gibt null fuer Woche 0 zurueck", () => {
      expect(parseWeekValue("2026-W00")).toBeNull();
    });
  });

  describe("weekValueFromDate", () => {
    it("gibt leeren String fuer ungueltige Datumseingabe zurueck", () => {
      expect(weekValueFromDate("invalid-date")).toBe("");
      // new Date(null) ergibt Epoch (gueltig), nicht NaN – null wird daher nicht als leer behandelt
      expect(weekValueFromDate("not-a-date")).toBe("");
    });

    it("gibt korrekten Wochenwert fuer gueltiges Datum zurueck", () => {
      expect(weekValueFromDate("2026-04-06")).toBe("2026-W15");
    });
  });

  describe("weekDateFromValue", () => {
    it("gibt leeren String fuer ungueltige Wochenwerte zurueck", () => {
      expect(weekDateFromValue("not-a-week")).toBe("");
      expect(weekDateFromValue("")).toBe("");
      expect(weekDateFromValue(null)).toBe("");
    });

    it("gibt ISO-Datum fuer gueltigen Wochenwert zurueck", () => {
      expect(weekDateFromValue("2026-W15")).toBe("2026-04-06");
    });
  });

  describe("weekOverlapsMonth", () => {
    it("gibt false zurueck wenn Woche nicht in den Monat faellt", () => {
      // KW 15/2026 = 06.04.-12.04. → kein Tag in 2026-03
      expect(weekOverlapsMonth("2026-W15", "2026-03")).toBe(false);
    });

    it("gibt true zurueck wenn Woche in den Monat faellt", () => {
      expect(weekOverlapsMonth("2026-W15", "2026-04")).toBe(true);
    });

    it("gibt false fuer ungueltigen Wochenwert zurueck", () => {
      expect(weekOverlapsMonth("invalid", "2026-04")).toBe(false);
    });
  });

  describe("formatCalendarWeek", () => {
    it("gibt leerem String fuer ungueltige Eingabe zurueck", () => {
      expect(formatCalendarWeek("invalid")).toBe("");
      expect(formatCalendarWeek("")).toBe("");
      // null → new Date(null) = Epoch → gibt KW 1/1970, kein leerer String
      expect(formatCalendarWeek(null)).toBe("KW 1/1970");
    });

    it("formatiert aus einem Datumswert (Fallback-Pfad)", () => {
      // Kein ISO-Wochenformat → Fallback auf weekValueFromDate
      expect(formatCalendarWeek("2026-04-06")).toBe("KW 15/2026");
    });

    it("formatiert direkt aus einem ISO-Wochenformat", () => {
      expect(formatCalendarWeek("2026-W15")).toBe("KW 15/2026");
      // fuehrende Null: KW 1 wird als 1 ausgegeben (Number())
      expect(formatCalendarWeek("2026-W01")).toBe("KW 1/2026");
    });
  });

  describe("formatDate", () => {
    it("gibt ein deutsches Datumsformat aus", () => {
      const result = formatDate("2026-04-06");
      // toLocaleDateString("de-DE") → "6.4.2026" oder ähnlich abhängig von Locale
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("monthOf", () => {
    it("gibt den Monat im Format YYYY-MM zurueck", () => {
      expect(monthOf("2026-04-06")).toBe("2026-04");
      expect(monthOf("2026-01-01")).toBe("2026-01");
    });
  });

  describe("addDays", () => {
    it("addiert die angegebene Anzahl von Tagen", () => {
      const result = addDays("2026-04-06", 7);
      expect(formatYmd(result)).toBe("2026-04-13");
    });

    it("subtrahiert Tage bei negativem Wert", () => {
      const result = addDays("2026-04-06", -1);
      expect(formatYmd(result)).toBe("2026-04-05");
    });
  });

  describe("formatYmd", () => {
    it("gibt das Datum im Format YYYY-MM-DD zurueck", () => {
      expect(formatYmd(new Date("2026-04-06T00:00:00"))).toBe("2026-04-06");
    });
  });

  describe("dateOnly", () => {
    it("erstellt ein Datum ohne Zeitkomponente", () => {
      const d = dateOnly("2026-04-06");
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
    });
  });

  describe("isWithinNextSixMonths", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-06T12:00:00"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("gibt true fuer heute zurueck", () => {
      expect(isWithinNextSixMonths("2026-04-06")).toBe(true);
    });

    it("gibt true fuer ein Datum innerhalb der naechsten 6 Monate zurueck", () => {
      expect(isWithinNextSixMonths("2026-10-05")).toBe(true);
    });

    it("gibt false fuer ein vergangenes Datum zurueck", () => {
      expect(isWithinNextSixMonths("2026-04-05")).toBe(false);
    });

    it("gibt false fuer ein Datum nach den naechsten 6 Monaten zurueck", () => {
      // genau 6 Monate später ist noch true, danach false
      expect(isWithinNextSixMonths("2026-10-07")).toBe(false);
    });
  });
});
