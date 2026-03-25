# FocusFlow

Ein einfacher Frontend-Prototyp (ohne Backend) für Lernzeitplanung und Lernzeit-Tracking.
Alle Daten werden im Browser über `localStorage` gespeichert.

## Enthaltene Funktionen

- Lernziele (Hauptziele) erfassen, als erreicht markieren
- Meilensteine/Detailplanung zu Zielen anlegen
- Kalenderansicht für Ziele, Detailplanung und ICS-Importe
- Übersicht aller kommenden Ziele und Detailplanungspunkte (scrollbar)
- Pomodoro-Technik mit Timer und Benachrichtigungen
- Stoppuhr für Lernzeit-Tracking 
- Umfangreiche Demo-Daten per Button laden

## Lokaler Start

Da es statisches HTML/CSS/JS ist, kann `index.html` direkt im Browser geöffnet werden.
Für Browser-Benachrichtigungen bitte über `localhost` starten.

1. Abhängigkeiten installieren:

- `npm install`

2. Lokalen Server starten (öffnet automatisch im Standardbrowser):

- `npm start`

Standard-URL: `http://localhost:8080/index.html`

### One-Click Start (Windows)

Im Projekt liegt die Datei `start-localhost.bat`.
Diese Datei kann per Doppelklick gestartet werden und:

1. wechselt automatisch in den Projektordner,
2. führt bei Bedarf `npm install` aus,
3. startet die Anwendung mit `npm start` auf `localhost`.

## Code-Qualität (Lint/Format)

1. Abhängigkeiten installieren:
   - `npm install`
2. Linting ausführen:
   - `npm run lint`
   - `npm run lint:fix` (mit Auto-Fixes)
3. Formatting prüfen/anwenden:
   - `npm run format`
   - `npm run format:write`

## Automatische Tests

1. Test-Dependencies installieren:
   - `npm install`
2. Unit-/DOM-Tests (Vitest):
   - `npm run test`
   - `npm run test:watch`
3. End-to-End-Test (Playwright):
   - `npm run test:e2e`
4. Alles zusammen:
   - `npm run test:all`
5. Coverage Test:
   - `npm run test:coverage`

## GitHub Pages Deployment

1. Repository auf GitHub erstellen und Dateien pushen.
2. In GitHub: `Settings > Pages` öffnen.
3. Source: `Deploy from a branch`.
4. Branch: `main` (oder `master`), Folder: `/ (root)`.
5. Speichern, dann wird eine Pages-URL bereitgestellt.

## Hinweise

- Browser-Benachrichtigungen für Pomodoro müssen einmal erlaubt werden.
- Für einen echten Produktivbetrieb wären Benutzerkonten, serverseitige Persistenz und Synchronisation sinnvoll.

## Komponentendiagramm

```mermaid
flowchart LR
  U[Nutzer]
  UI[index.html + styles.css]
  APP[app.js: Controller + Fachlogik]
  ST[(In-Memory State)]
  LS[(localStorage)]
  NTF[Notification API]
  ICS[ICS Import/Export]
  FILE[File/Blob API]

  U --> UI
  UI --> APP
  APP <--> ST
  APP <--> LS
  APP --> NTF
  APP <--> ICS
  APP --> FILE
```

## Sequenzdiagramm: Ziel anlegen

```mermaid
  sequenceDiagram
  actor Nutzer
  participant Form as goal-form
  participant App as app.js Handler
  participant State as state.goals
  participant Store as localStorage
  participant UI as renderAll()

  Nutzer->>Form: Titel + Datum eingeben, Submit
  Form->>App: submit event
  App->>State: push(goal)
  App->>Store: saveState()
  App->>UI: renderAll()
  UI-->>Nutzer: aktualisierte Ziel-Liste
```

## Klassendiagramm: Datenmodell

```mermaid
  classDiagram
  class AppState {
    +goals: Goal[]
    +roughPlans: RoughPlan[]
    +detailPlans: DetailPlan[]
    +trackedSessions: TrackedSession[]
    +importedEvents: ImportedEvent[]
    +settings: Settings
    +timer: TimerState
    +pomodoro: PomodoroState
  }
  class PomodoroState {
    +active: boolean
    +phase: string
    +pomodorosCompleted: number
    +secondsLeft: number
    +phaseStartedAt: string|null
  }

  class Goal {
    +id: string
    +title: string
    +targetDate: string
    +completed: boolean
    +completedAt: string|null
  }

  class RoughPlan {
    +id: string
    +date: string
    +hours: number
    +note: string
  }

  class DetailPlan {
    +id: string
    +date: string
    +minutes: number
    +topic: string
    +milestone: string
    +done: boolean
  }

  class TrackedSession {
    +id: string
    +start: string
    +end: string
    +minutes: number
    +note: string
  }

  class ImportedEvent {
    +id: string
    +sourceKey: string
    +sourceName: string
    +sourceHash: string
    +externalUid: string
    +date: string
    +summary: string
    +createdAt: string
  }

  class Settings {
    +inactivityDays: number
    +lastReminderRun: string|null
    +notificationEnabled: boolean
    +activeView: string
    +calendarMonth: string|null
  }

  class TimerState {
    +start: string|null
  }

  AppState --> Goal
  AppState --> RoughPlan
  AppState --> DetailPlan
  AppState --> TrackedSession
  AppState --> ImportedEvent
  AppState --> Settings
  AppState --> TimerState
```
