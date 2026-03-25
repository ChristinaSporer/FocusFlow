import { nowIso, weekValueFromDate } from "./date-utils.js";
import { uid } from "./app-utils.js";

export function buildDemoState({ themeMode }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${year}-${String(today.getMonth() + 1).padStart(2, "0")}`;
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
  const roughPlanFourId = uid();

  const in5 = new Date(today);
  in5.setDate(today.getDate() + 5);
  const in10 = new Date(today);
  in10.setDate(today.getDate() + 10);
  const in15 = new Date(today);
  in15.setDate(today.getDate() + 15);
  const in20 = new Date(today);
  in20.setDate(today.getDate() + 20);
  const in25 = new Date(today);
  in25.setDate(today.getDate() + 25);

  return {
    goals: [
      {
        id: goalOneId,
        title: "Modul Software Engineering abschließen",
        targetDate: in20.toISOString().slice(0, 10),
        description: "Abgabe, Abschlusspräsentation und Nachbereitung erledigen.",
        milestones: [
          { id: milestoneOneId, title: "Kapitel 6 wiederholen", done: true },
          { id: milestoneTwoId, title: "Präsentation fertigstellen", done: false },
        ],
        completed: false,
        completedAt: null,
      },
      {
        id: goalTwoId,
        title: "Klausurvorbereitung Mathematik",
        targetDate: in10.toISOString().slice(0, 10),
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
        targetDate: in25.toISOString().slice(0, 10),
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
        targetDate: in15.toISOString().slice(0, 10),
        description: "Vokabeln lernen, Hörverstehen üben, Probetest machen.",
        milestones: [],
        completed: false,
        completedAt: null,
      },
    ],
    roughPlans: [
      {
        id: roughPlanOneId,
        date: in5.toISOString().slice(0, 10),
        week: weekValueFromDate(in5),
        hours: 3,
        note: "Wiederholung UML",
        goalId: goalOneId,
      },
      {
        id: roughPlanTwoId,
        date: in10.toISOString().slice(0, 10),
        week: weekValueFromDate(in10),
        hours: 4,
        note: "Altklausuren",
        goalId: goalTwoId,
      },
      {
        id: roughPlanThreeId,
        date: in15.toISOString().slice(0, 10),
        week: weekValueFromDate(in15),
        hours: 2,
        note: "Datenaufbereitung",
        goalId: goalThreeId,
      },
      {
        id: roughPlanFourId,
        date: in25.toISOString().slice(0, 10),
        week: weekValueFromDate(in25),
        hours: 5,
        note: "Englisch Hörverstehen",
        goalId: goalFourId,
      },
    ],
    detailPlans: [
      {
        id: uid(),
        date: in5.toISOString().slice(0, 10),
        minutes: 90,
        topic: "User Stories",
        milestone: "Kapitel 4 durcharbeiten",
        milestoneId: milestoneTwoId,
        goalId: goalOneId,
        roughPlanId: roughPlanOneId,
        done: false,
      },
      {
        id: uid(),
        date: in10.toISOString().slice(0, 10),
        minutes: 120,
        topic: "Testmethoden",
        milestone: "10 Übungsaufgaben",
        milestoneId: milestoneThreeId,
        goalId: goalTwoId,
        roughPlanId: roughPlanTwoId,
        done: true,
      },
      {
        id: uid(),
        date: in15.toISOString().slice(0, 10),
        minutes: 60,
        topic: "Daten bereinigen",
        milestone: "Datensatz bereinigen",
        milestoneId: milestoneFiveId,
        goalId: goalThreeId,
        roughPlanId: roughPlanThreeId,
        done: false,
      },
      {
        id: uid(),
        date: in25.toISOString().slice(0, 10),
        minutes: 75,
        topic: "Listening Comprehension",
        milestone: "Probetest Hörverstehen",
        milestoneId: null,
        goalId: goalFourId,
        roughPlanId: roughPlanFourId,
        done: false,
      },
    ],
    trackedSessions: [
      {
        id: uid(),
        start: new Date().toISOString(),
        end: new Date(Date.now() + 45 * 60000).toISOString(),
        minutes: 45,
        note: "Fokusblock am Morgen",
      },
      {
        id: uid(),
        start: new Date().toISOString(),
        end: new Date(Date.now() + 60 * 60000).toISOString(),
        minutes: 60,
        note: "Abend-Review",
      },
      {
        id: uid(),
        start: new Date().toISOString(),
        end: new Date(Date.now() + 30 * 60000).toISOString(),
        minutes: 30,
        note: "Vokabeltraining",
      },
      {
        id: uid(),
        start: new Date().toISOString(),
        end: new Date(Date.now() + 90 * 60000).toISOString(),
        minutes: 90,
        note: "Projektarbeit Data Science",
      },
    ],
    settings: {
      inactivityDays: 3,
      lastReminderRun: nowIso(),
      notificationEnabled: false,
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
