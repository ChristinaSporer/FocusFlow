import { describe, expect, it } from "vitest";

import {
  buildAvailablePlanningSlots,
  defaultStandardLearningTimes,
  distributeGoalWorkload,
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
});
