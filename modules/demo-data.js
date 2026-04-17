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

  const detailOneAId = uid();
  const detailOneBId = uid();
  const detailTwoAId = uid();
  const detailTwoBId = uid();
  const detailThreeAId = uid();
  const detailThreeBId = uid();

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
    workloadHours: 90,
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

  const d1a = distOne.days[0] || { date: startOneStr, startTime: "08:00", minutes: 120 };
  const d1b = distOne.days[1] || { date: startOneStr, startTime: "08:00", minutes: 90 };
  const d2a = distTwo.days[0] || { date: startTwoStr, startTime: "08:00", minutes: 180 };
  const d2b = distTwo.days[1] || { date: startTwoStr, startTime: "08:00", minutes: 120 };
  const d3a = distThree.days[0] || { date: startThreeStr, startTime: "08:00", minutes: 240 };
  const d3b = distThree.days[1] || { date: startThreeStr, startTime: "08:00", minutes: 180 };

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
          { id: milestoneOneId, title: "Kapitel 6 wiederholen", done: true },
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
        workloadHours: 90,
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
        totalWorkloadHours: 90,
        plannedDays: distThree.days,
        goalId: goalThreeId,
      },
      /*      {
        id: roughPlanFourId,
        startDate: startFourStr,
        totalWorkloadHours: 60,
        plannedDays: distFour.days,
        goalId: goalFourId,
      },*/
    ],
    detailPlans: [
      {
        id: detailOneAId,
        date: d1a.date,
        minutes: 120,
        startTime: d1a.startTime,
        endTime: addMinutesToTime(d1a.startTime, 120),
        topic: "Anforderungsanalyse durcharbeiten",
        milestone: "Pr\u00e4sentation fertigstellen",
        milestoneId: milestoneTwoId,
        goalId: goalOneId,
        roughPlanId: roughPlanOneId,
        done: false,
      },
      {
        id: detailOneBId,
        date: d1b.date,
        minutes: 90,
        startTime: d1b.startTime,
        endTime: addMinutesToTime(d1b.startTime, 90),
        topic: "User Stories und Akzeptanzkriterien",
        milestone: "Pr\u00e4sentation fertigstellen",
        milestoneId: milestoneTwoId,
        goalId: goalOneId,
        roughPlanId: roughPlanOneId,
        done: false,
      },
      {
        id: detailTwoAId,
        date: d2a.date,
        minutes: 180,
        startTime: d2a.startTime,
        endTime: addMinutesToTime(d2a.startTime, 180),
        topic: "Altklausur 2019 \u2013 Analysis",
        milestone: "Altklausur 1 rechnen",
        milestoneId: milestoneThreeId,
        goalId: goalTwoId,
        roughPlanId: roughPlanTwoId,
        done: true,
      },
      {
        id: detailTwoBId,
        date: d2b.date,
        minutes: 120,
        startTime: d2b.startTime,
        endTime: addMinutesToTime(d2b.startTime, 120),
        topic: "Lineare Algebra Formeln zusammenfassen",
        milestone: "Formelblatt zusammenfassen",
        milestoneId: milestoneFourId,
        goalId: goalTwoId,
        roughPlanId: roughPlanTwoId,
        done: true,
      },
      {
        id: detailThreeAId,
        date: d3a.date,
        minutes: 240,
        startTime: d3a.startTime,
        endTime: addMinutesToTime(d3a.startTime, 240),
        topic: "Datensatz explorieren und bereinigen",
        milestone: "Datensatz bereinigen",
        milestoneId: milestoneFiveId,
        goalId: goalThreeId,
        roughPlanId: roughPlanThreeId,
        done: false,
      },
      {
        id: detailThreeBId,
        date: d3b.date,
        minutes: 180,
        startTime: d3b.startTime,
        endTime: addMinutesToTime(d3b.startTime, 180),
        topic: "Feature Engineering und Modellauswahl",
        milestone: "Modell validieren",
        milestoneId: milestoneSixId,
        goalId: goalThreeId,
        roughPlanId: roughPlanThreeId,
        done: false,
      },
      /*    {
        id: detailFourAId,
        date: d4a.date,
        minutes: 90,
        startTime: d4a.startTime,
        endTime: addMinutesToTime(d4a.startTime, 90),
        topic: "Listening Comprehension \u00dcbungen",
        milestone: "",
        milestoneId: null,
        goalId: goalFourId,
        roughPlanId: roughPlanFourId,
        done: false,
      },
      {
        id: detailFourBId,
        date: d4b.date,
        minutes: 120,
        startTime: d4b.startTime,
        endTime: addMinutesToTime(d4b.startTime, 120),
        topic: "Vokabeltraining B2-Wortschatz",
        milestone: "",
        milestoneId: null,
        goalId: goalFourId,
        roughPlanId: roughPlanFourId,
        done: false,
      },*/
    ],
    trackedSessions: [
      {
        id: uid(),
        start: new Date(today.getTime() - 2 * 24 * 60 * 60000).toISOString(),
        end: new Date(today.getTime() - 2 * 24 * 60 * 60000 + 120 * 60000).toISOString(),
        minutes: 120,
        note: "Anforderungsanalyse \u2013 Block 1",
        detailPlanId: detailOneAId,
      },
      {
        id: uid(),
        start: new Date(today.getTime() - 24 * 60 * 60000).toISOString(),
        end: new Date(today.getTime() - 24 * 60 * 60000 + 180 * 60000).toISOString(),
        minutes: 180,
        note: "Altklausur Analysis \u2013 vollst\u00e4ndig",
        detailPlanId: detailTwoAId,
      },
      {
        id: uid(),
        start: new Date(today.getTime() - 24 * 60 * 60000 + 4 * 60 * 60000).toISOString(),
        end: new Date(
          today.getTime() - 24 * 60 * 60000 + 4 * 60 * 60000 + 100 * 60000
        ).toISOString(),
        minutes: 100,
        note: "Lineare Algebra \u2013 Formelblatt",
        detailPlanId: detailTwoBId,
      },
      {
        id: uid(),
        start: new Date().toISOString(),
        end: new Date(Date.now() + 45 * 60000).toISOString(),
        minutes: 45,
        note: "Fokusblock am Morgen",
      },
      {
        id: uid(),
        start: new Date(today.getTime() - 3 * 24 * 60 * 60000).toISOString(),
        end: new Date(today.getTime() - 3 * 24 * 60 * 60000 + 60 * 60000).toISOString(),
        minutes: 60,
        note: "Abend-Review Mathematik",
      },
      {
        id: uid(),
        start: new Date(today.getTime() - 4 * 24 * 60 * 60000).toISOString(),
        end: new Date(today.getTime() - 4 * 24 * 60 * 60000 + 90 * 60000).toISOString(),
        minutes: 90,
        note: "Projektarbeit Data Science \u2013 Recherche",
      },
    ],
    settings: {
      inactivityDays: 3,
      lastReminderRun: nowIso(),
      notificationEnabled: false,
      confirmDialogsEnabled: true,
      activeView: "list",
      calendarMonth: month,
      themeMode,
    },
    importedEvents: [],
    timer: {
      start: null,
    },
  };
}
