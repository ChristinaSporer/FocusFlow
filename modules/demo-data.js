import { nowIso } from "./date-utils.js";
import { uid } from "./app-utils.js";

export function buildDemoState({ themeMode }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${year}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const in5 = new Date(today);
  in5.setDate(today.getDate() + 5);
  const in10 = new Date(today);
  in10.setDate(today.getDate() + 10);
  const in20 = new Date(today);
  in20.setDate(today.getDate() + 20);

  return {
    goals: [
      {
        id: uid(),
        title: "Modul Software Engineering abschließen",
        targetDate: in20.toISOString().slice(0, 10),
        completed: false,
        completedAt: null,
      },
      {
        id: uid(),
        title: "Klausurvorbereitung Mathematik",
        targetDate: in10.toISOString().slice(0, 10),
        completed: true,
        completedAt: nowIso(),
      },
    ],
    roughPlans: [
      { id: uid(), date: in5.toISOString().slice(0, 10), hours: 3, note: "Wiederholung UML" },
      { id: uid(), date: in10.toISOString().slice(0, 10), hours: 4, note: "Altklausuren" },
    ],
    detailPlans: [
      {
        id: uid(),
        date: in5.toISOString().slice(0, 10),
        minutes: 90,
        topic: "User Stories",
        milestone: "Kapitel 4 durcharbeiten",
        done: false,
      },
      {
        id: uid(),
        date: in10.toISOString().slice(0, 10),
        minutes: 120,
        topic: "Testmethoden",
        milestone: "10 Übungsaufgaben",
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
