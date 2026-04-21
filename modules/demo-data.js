import { nowIso } from "./date-utils.js";
import { uid } from "./app-utils.js";
import { defaultStandardLearningTimes, distributeGoalWorkload } from "./planning-utils.js";

function addMinutesToTime(timeStr, minutes) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function buildDemoState({ themeMode }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${year}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const slt = defaultStandardLearningTimes();

  const goalOneId = uid();
  const goalTwoId = uid();
  const goalThreeId = uid();
  const goalFourId = uid();
  const milestoneOneId = uid();
  const milestoneTwoId = uid();
  const milestoneThreeId = uid();
  const milestoneFourId = uid();
  const milestoneFiveId = uid();
  const milestoneSixId = uid();
  const roughPlanOneId = uid();
  const roughPlanTwoId = uid();
  const roughPlanThreeId = uid();

  const in5 = new Date(today);
  in5.setDate(today.getDate() + 5);
  const in10 = new Date(today);
  in10.setDate(today.getDate() + 10);
  const in20 = new Date(today);
  in20.setDate(today.getDate() + 20);
  const before10 = new Date(today);
  before10.setDate(today.getDate() - 10);

  const startOneStr = in5.toISOString().slice(0, 10);
  const startTwoStr = before10.toISOString().slice(0, 10);
  const startThreeStr = in20.toISOString().slice(0, 10);
  const startFourStr = in10.toISOString().slice(0, 10);

  const distOne = distributeGoalWorkload({
    startDate: startOneStr,
    workloadHours: 50,
    standardLearningTimes: slt,
    detailPlans: [],
    horizonDays: 365,
  });

  const distTwo = distributeGoalWorkload({
    startDate: startTwoStr,
    workloadHours: 40,
    standardLearningTimes: slt,
    detailPlans: [],
    horizonDays: 365,
  });

  const distThree = distributeGoalWorkload({
    startDate: startThreeStr,
    workloadHours: 35,
    standardLearningTimes: slt,
    detailPlans: [],
    horizonDays: 365,
  });

  const distFour = distributeGoalWorkload({
    startDate: startFourStr,
    workloadHours: 60,
    standardLearningTimes: slt,
    detailPlans: [],
    horizonDays: 365,
  });

  const targetDateOne = distOne.days.length
    ? distOne.days[distOne.days.length - 1].date
    : startOneStr;
  const targetDateTwo = distTwo.days.length
    ? distTwo.days[distTwo.days.length - 1].date
    : startTwoStr;
  const targetDateThree = distThree.days.length
    ? distThree.days[distThree.days.length - 1].date
    : startThreeStr;
  const targetDateFour = distFour.days.length
    ? distFour.days[distFour.days.length - 1].date
    : startFourStr;

  const makeAutoDetails = ({
    days,
    goalTitle,
    goalId,
    roughPlanId,
    milestonePairs = [],
    assignMilestones = true,
  }) =>
    days.map((day, index) => {
      const milestone =
        assignMilestones && milestonePairs.length
          ? milestonePairs[index % milestonePairs.length]
          : null;
      return {
        id: uid(),
        date: day.date,
        minutes: day.minutes,
        startTime: day.startTime,
        endTime: day.endTime || addMinutesToTime(day.startTime, day.minutes),
        topic: `${goalTitle} (automatisch geplant)`,
        milestone: milestone?.title || "",
        milestoneId: milestone?.id || null,
        goalId,
        roughPlanId,
        done: false,
      };
    });

  const seDetails = makeAutoDetails({
    days: distOne.days,
    goalTitle: "Modul Software Engineering abschlie\u00dfen",
    goalId: goalOneId,
    roughPlanId: roughPlanOneId,
    milestonePairs: [
      { id: milestoneOneId, title: "Kapitel 6 wiederholen" },
      { id: milestoneTwoId, title: "Pr\u00e4sentation fertigstellen" },
    ],
  });

  const mathDetails = makeAutoDetails({
    days: distTwo.days,
    goalTitle: "Klausurvorbereitung Mathematik",
    goalId: goalTwoId,
    roughPlanId: roughPlanTwoId,
    milestonePairs: [
      { id: milestoneThreeId, title: "Altklausur 1 rechnen" },
      { id: milestoneFourId, title: "Formelblatt zusammenfassen" },
    ],
  });

  const dataScienceDetails = makeAutoDetails({
    days: distThree.days,
    goalTitle: "Projektarbeit Data Science",
    goalId: goalThreeId,
    roughPlanId: roughPlanThreeId,
    assignMilestones: false,
  });

  const detailPlans = [...mathDetails, ...seDetails, ...dataScienceDetails];

  function toUtcDate(daysOffset, hour, minute = 0) {
    return new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() + daysOffset,
        hour,
        minute,
        0,
        0
      )
    );
  }

  function buildTrackedSession({
    daysOffset,
    hour,
    minute = 0,
    durationMinutes,
    note,
    detailPlanId,
  }) {
    const startDate = toUtcDate(daysOffset, hour, minute);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    return {
      id: uid(),
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      minutes: durationMinutes,
      note,
      detailPlanId,
    };
  }

  const mathDetailIds = mathDetails.map((item) => item.id);
  const firstSeDetailId = seDetails[0]?.id || null;

  return {
    goals: [
      {
        id: goalOneId,
        title: "Modul Software Engineering abschlie\u00dfen",
        startDate: startOneStr,
        targetDate: targetDateOne,
        workloadHours: 50,
        colorKey: "dark-blue",
        description: "Abgabe, Abschlusspr\u00e4sentation und Nachbereitung erledigen.",
        milestones: [
          { id: milestoneOneId, title: "Kapitel 6 wiederholen", done: false },
          { id: milestoneTwoId, title: "Pr\u00e4sentation fertigstellen", done: false },
        ],
        completed: false,
        completedAt: null,
      },
      {
        id: goalTwoId,
        title: "Klausurvorbereitung Mathematik",
        startDate: startTwoStr,
        targetDate: targetDateTwo,
        workloadHours: 40,
        colorKey: "dark-green",
        description: "Altklausuren durcharbeiten und Formelsammlung wiederholen.",
        milestones: [
          { id: milestoneThreeId, title: "Altklausur 1 rechnen", done: true },
          { id: milestoneFourId, title: "Formelblatt zusammenfassen", done: true },
        ],
        completed: true,
        completedAt: nowIso(),
      },
      {
        id: goalThreeId,
        title: "Projektarbeit Data Science",
        startDate: startThreeStr,
        targetDate: targetDateThree,
        workloadHours: 35,
        colorKey: "turquoise",
        description: "Daten aufbereiten, Modell trainieren, Bericht schreiben.",
        milestones: [
          { id: milestoneFiveId, title: "Datensatz bereinigen", done: false },
          { id: milestoneSixId, title: "Modell validieren", done: false },
        ],
        completed: false,
        completedAt: null,
      },
      {
        id: goalFourId,
        title: "Englisch Zertifikat B2",
        startDate: startFourStr,
        targetDate: targetDateFour,
        workloadHours: 60,
        colorKey: "pink",
        description: "Vokabeln lernen, H\u00f6rverstehen \u00fcben, Probetest machen.",
        milestones: [],
        completed: false,
        completedAt: null,
      },
    ],
    roughPlans: [
      {
        id: roughPlanOneId,
        startDate: startOneStr,
        totalWorkloadHours: 50,
        plannedDays: distOne.days,
        goalId: goalOneId,
      },
      {
        id: roughPlanTwoId,
        startDate: startTwoStr,
        totalWorkloadHours: 40,
        plannedDays: distTwo.days,
        goalId: goalTwoId,
      },
      {
        id: roughPlanThreeId,
        startDate: startThreeStr,
        totalWorkloadHours: 35,
        plannedDays: distThree.days,
        goalId: goalThreeId,
      },
    ],
    detailPlans,
    trackedSessions: [
      {
        id: uid(),
        start: nowIso(),
        end: new Date(Date.now() + 45 * 60000).toISOString(),
        minutes: 45,
        note: "Webinar KI-Nutzung angesehen",
        detailPlanId: null,
      },
      buildTrackedSession({
        daysOffset: -4,
        hour: 7,
        minute: 44,
        durationMinutes: 90,
        note: "Projektarbeit Data Science \u2013 Recherche",
      }),
      buildTrackedSession({
        daysOffset: -8,
        hour: 10,
        durationMinutes: 480,
        note: "",
        detailPlanId: mathDetailIds[0] || null,
      }),
      buildTrackedSession({
        daysOffset: -7,
        hour: 10,
        durationMinutes: 480,
        note: "",
        detailPlanId: mathDetailIds[1] || null,
      }),
      buildTrackedSession({
        daysOffset: -6,
        hour: 10,
        durationMinutes: 480,
        note: "",
        detailPlanId: mathDetailIds[2] || null,
      }),
      buildTrackedSession({
        daysOffset: -5,
        hour: 10,
        durationMinutes: 480,
        note: "",
        detailPlanId: mathDetailIds[3] || null,
      }),
      buildTrackedSession({
        daysOffset: -4,
        hour: 10,
        durationMinutes: 60,
        note: "",
        detailPlanId: mathDetailIds[4] || null,
      }),
      buildTrackedSession({
        daysOffset: 6,
        hour: 10,
        durationMinutes: 480,
        note: "",
        detailPlanId: firstSeDetailId,
      }),
    ],
    settings: {
      inactivityDays: 3,
      lastReminderRun: nowIso(),
      notificationEnabled: false,
      inactivityNotificationEnabled: false,
      lastInactivityNotificationAt: null,
      confirmDialogsEnabled: true,
      notificationLeadMinutes: 15,
      activeView: "list",
      calendarMonth: month,
      themeMode,
      standardLearningTimes: slt,
    },
    importedEvents: [],
    timer: {
      start: null,
      selectedDetailPlanId: firstSeDetailId,
    },
  };
}
