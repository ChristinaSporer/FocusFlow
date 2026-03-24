import { nowIso, weekValueFromDate } from "./date-utils.js";
import { uid } from "./app-utils.js";

export function buildDemoState({ themeMode }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${year}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const goalOneId = uid();
  const goalTwoId = uid();
  const milestoneOneId = uid();
  const milestoneTwoId = uid();
  const milestoneThreeId = uid();
  const milestoneFourId = uid();
  const roughPlanOneId = uid();
  const roughPlanTwoId = uid();

  const in5 = new Date(today);
  in5.setDate(today.getDate() + 5);
  const in10 = new Date(today);
  in10.setDate(today.getDate() + 10);
  const in20 = new Date(today);
  in20.setDate(today.getDate() + 20);

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
