import { describe, expect, it } from "vitest";

import {
  buildAvailablePlanningSlots,
  defaultStandardLearningTimes,
  distributeGoalWorkload,
  normalizeStandardLearningTimes,
} from "../../modules/planning-utils.js";

describe("modules/planning-utils", () => {
  it("zieht belegte Zeitfenster von verfuegbaren Lernzeiten ab", () => {
    const learningTimes = defaultStandardLearningTimes();
    learningTimes.mon = { startTime: "08:00", endTime: "12:00" };

    const slots = buildAvailablePlanningSlots({
      startDate: "2026-04-06",
      standardLearningTimes: learningTimes,
      detailPlans: [
        {
          id: "d1",
          date: "2026-04-06",
          startTime: "09:00",
          endTime: "10:30",
          minutes: 90,
        },
      ],
      horizonDays: 1,
    });

    expect(slots).toEqual([
      expect.objectContaining({
        date: "2026-04-06",
        startTime: "08:00",
        endTime: "09:00",
        availableMinutes: 60,
      }),
      expect.objectContaining({
        date: "2026-04-06",
        startTime: "10:30",
        endTime: "12:00",
        availableMinutes: 90,
      }),
    ]);
  });

  it("verteilt Workload ueber freie und zusaetzliche Slots", () => {
    const learningTimes = defaultStandardLearningTimes();
    learningTimes.mon = { startTime: "08:00", endTime: "10:00" };
    learningTimes.tue = { startTime: "08:00", endTime: "10:00" };
    learningTimes.wed = { startTime: "08:00", endTime: "10:00" };

    const distribution = distributeGoalWorkload({
      startDate: "2026-04-06",
      workloadHours: 3,
      standardLearningTimes: learningTimes,
      detailPlans: [
        {
          id: "d1",
          date: "2026-04-06",
          startTime: "08:00",
          endTime: "09:00",
          minutes: 60,
        },
      ],
      horizonDays: 3,
    });

    expect(distribution.days).toEqual([
      expect.objectContaining({
        date: "2026-04-06",
        startTime: "09:00",
        endTime: "10:00",
        minutes: 60,
      }),
      expect.objectContaining({
        date: "2026-04-07",
        startTime: "08:00",
        endTime: "10:00",
        minutes: 120,
      }),
    ]);
    expect(distribution.candidateSlots).toHaveLength(3);
    expect(distribution.projectedEndDate).toBe("2026-04-07");
  });

  it("gibt leeres Ergebnis zurueck wenn workloadHours 0 ist", () => {
    const result = distributeGoalWorkload({
      startDate: "2026-04-06",
      workloadHours: 0,
      standardLearningTimes: defaultStandardLearningTimes(),
      detailPlans: [],
      horizonDays: 3,
    });

    expect(result.days).toEqual([]);
    expect(result.remainingMinutes).toBe(0);
    expect(result.projectedEndDate).toBe("");
  });

  it("gibt leeres Ergebnis zurueck wenn kein startDate angegeben ist", () => {
    const result = distributeGoalWorkload({
      startDate: "",
      workloadHours: 10,
      standardLearningTimes: defaultStandardLearningTimes(),
      detailPlans: [],
      horizonDays: 3,
    });

    expect(result.days).toEqual([]);
    expect(result.projectedEndDate).toBe("");
  });

  it("gibt leere Slots zurueck wenn kein startDate fuer buildAvailablePlanningSlots angegeben", () => {
    const slots = buildAvailablePlanningSlots({
      startDate: "",
      standardLearningTimes: defaultStandardLearningTimes(),
      detailPlans: [],
      horizonDays: 1,
    });

    expect(slots).toEqual([]);
  });

  it("blockiert den ganzen Tag wenn Plan nur minutes ohne Zeiten hat", () => {
    const learningTimes = defaultStandardLearningTimes();
    learningTimes.mon = { startTime: "08:00", endTime: "12:00" };

    const slots = buildAvailablePlanningSlots({
      startDate: "2026-04-06",
      standardLearningTimes: learningTimes,
      detailPlans: [
        {
          id: "d1",
          date: "2026-04-06",
          // kein startTime/endTime, nur minutes gesetzt → blockiert ganzen Tag
          minutes: 60,
        },
      ],
      horizonDays: 1,
    });

    // Ganzer Tag blockiert → keine freien Slots
    expect(slots).toEqual([]);
  });

  it("filtert auf ausgewaehlte Slots wenn selectedSlotKeys angegeben ist", () => {
    const learningTimes = defaultStandardLearningTimes();
    learningTimes.mon = { startTime: "08:00", endTime: "10:00" };
    learningTimes.tue = { startTime: "08:00", endTime: "10:00" };

    const allSlots = buildAvailablePlanningSlots({
      startDate: "2026-04-06",
      standardLearningTimes: learningTimes,
      detailPlans: [],
      horizonDays: 2,
    });

    // Nur ersten Slot auswählen
    const firstSlotKey = allSlots[0].key;
    const result = distributeGoalWorkload({
      startDate: "2026-04-06",
      workloadHours: 5,
      standardLearningTimes: learningTimes,
      selectedSlotKeys: [firstSlotKey],
      detailPlans: [],
      horizonDays: 2,
    });

    // Nur der ausgewählte Slot wird genutzt
    expect(result.days.length).toBeLessThanOrEqual(1);
  });

  it("normalizeStandardLearningTimes gibt Standardwerte fuer null zurueck", () => {
    const result = normalizeStandardLearningTimes(null);
    const defaults = defaultStandardLearningTimes();
    expect(result).toEqual(defaults);
  });

  it("normalizeStandardLearningTimes gibt Standardwerte fuer nicht-Objekt zurueck", () => {
    expect(normalizeStandardLearningTimes("string")).toEqual(defaultStandardLearningTimes());
    expect(normalizeStandardLearningTimes(42)).toEqual(defaultStandardLearningTimes());
  });

  it("normalizeStandardLearningTimes konvertiert Legacy-Stunden-Format fuer Tage ohne Standardzeiten", () => {
    // Legacy: hours auf sat gesetzt (sat hat leere Standardzeiten)
    // mon hat Standardzeiten ('08:00'-'16:00'), daher greift Legacy dort nicht
    const result = normalizeStandardLearningTimes({
      sat: { hours: 2 },
    });

    // sat hat keine Standardzeiten → Legacy-Pfad wird ausgeloest → 08:00–10:00
    expect(result.sat.startTime).toBe("08:00");
    expect(result.sat.endTime).toBe("10:00");
  });
});
