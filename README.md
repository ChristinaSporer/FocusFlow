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

## Continuous Integration (CI)

Bei jedem Commit / Push wird automatisch eine GitHub Actions Workflow ausgeführt, die:

- **Lint & Format**: ESLint, Stylelint und Prettier-Check
- **Unit Tests**: Vitest mit Coverage-Bericht
- **E2E Tests**: Playwright-Tests

**Coverage-Report ansehen (GitHub Pages):**

Der Coverage-Report wird nach jedem erfolgreichen Run auf der `main`-Branch automatisch zu GitHub Pages deployed:

1. Gehe zu deinem **GitHub Pages** (z.B. `https://ChristinaSporer.github.io/FocusFlow/`)
2. Öffne den **Coverage-Report** unter: `/coverage/index.html`
3. Oder direkt:
   ```
   https://<dein-username>.github.io/FocusFlow/coverage/index.html
   ```

**Einmalige Aktivierung (falls noch nicht geschehen):**
- Gehe in GitHub → **Settings → Pages**
- Source: **Deploy from a branch**
- Branch: `gh-pages`, Folder: `/ (root)`
- Der Workflow erstellt die `gh-pages` Branch automatisch beim ersten erfolgreichen Push auf `main`

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
  RENDER[Render Main View]
  ST[(In-Memory State)]
  MS[Milestones/Detailplanung]
  LS[(localStorage)]
  NTF[Notification API]
  ICS[ICS Import/Export]
  JSON[JSON Import/Export]
  FILE[File/Blob API]
  CAL[Calendar Manager]
  POM[Pomodoro Manager]
  TIM[Timer Manager]
  THEME[Theme Manager]
  FORM[Form Handlers]

  U --> UI
  UI --> RENDER
  RENDER <--> APP
  APP <--> ST
  APP <--> MS
  MS <--> ST
  APP <--> LS
  APP --> NTF
  APP <--> ICS
  APP <--> JSON
  APP --> FILE
  APP --> CAL
  APP --> POM
  APP --> TIM
  APP --> THEME
  APP --> FORM
```

## Klassendiagramm

```mermaid
classDiagram
  class AppState {
    goals[]
    roughPlans[]
    detailPlans[]
    trackedSessions[]
    importedEvents[]
    settings
    timer
    pomodoro
  }

  class Goal
  class Milestone
  class RoughPlan
  class DetailPlan
  class TrackedSession
  class ImportedEvent
  class Settings
  class TimerState
  class PomodoroState

  AppState --> Goal
  Goal --> Milestone
  AppState --> RoughPlan
  AppState --> DetailPlan
  AppState --> TrackedSession
  AppState --> ImportedEvent
  AppState --> Settings
  AppState --> TimerState
  AppState --> PomodoroState
```

## Sequenzdiagramme

### Ziel anlegen

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

### Zwischenziel (Milestone) anlegen

```mermaid
sequenceDiagram
  actor Nutzer
  participant Form as milestone-form
  participant App as app.js Handler
  participant State as state.goals.milestones
  participant Store as localStorage
  participant UI as renderAll()

  Nutzer->>Form: Titel + Ziel wählen, Submit
  Form->>App: submit event
  App->>State: push(milestone)
  App->>Store: saveState()
  App->>UI: renderAll()
  UI-->>Nutzer: aktualisierte Milestone-Liste
```

### Grobplanung erstellen

```mermaid
sequenceDiagram
  actor Nutzer
  participant Form as roughplan-form
  participant App as app.js Handler
  participant State as state.roughPlans
  participant Store as localStorage
  participant UI as renderAll()

  Nutzer->>Form: Datum + Stunden + Notiz, Submit
  Form->>App: submit event
  App->>State: push(roughPlan)
  App->>Store: saveState()
  App->>UI: renderAll()
  UI-->>Nutzer: aktualisierte Grobplanung
```

### Detailplanung erstellen

```mermaid
sequenceDiagram
  actor Nutzer
  participant Form as detailplan-form
  participant App as app.js Handler
  participant State as state.detailPlans
  participant Store as localStorage
  participant UI as renderAll()

  Nutzer->>Form: Datum + Minuten + Thema, Submit
  Form->>App: submit event
  App->>State: push(detailPlan)
  App->>Store: saveState()
  App->>UI: renderAll()
  UI-->>Nutzer: aktualisierte Detailplanung
```

### Stoppuhr starten und speichern

```mermaid
sequenceDiagram
  actor Nutzer
  participant UI as Timer-UI
  participant App as app.js Handler
  participant State as state.trackedSessions
  participant Store as localStorage

  Nutzer->>UI: Start-Button drücken
  UI->>App: startTimer event
  App->>State: timer.start setzen
  Nutzer->>UI: Stop-Button drücken
  UI->>App: stopTimer event
  App->>State: push(trackedSession)
  App->>Store: saveState()
  UI-->>Nutzer: neue Session gespeichert
```

### Pomodoro starten und abschließen

```mermaid
sequenceDiagram
  actor Nutzer
  participant UI as Pomodoro-UI
  participant App as app.js Handler
  participant State as state.pomodoro
  participant Store as localStorage
  participant NOTIF as Notification API

  Nutzer->>UI: Pomodoro starten
  UI->>App: startPomodoro event
  App->>State: pomodoro.active = true
  App->>Store: saveState()
  App->>NOTIF: Benachrichtigung bei Ende
  Nutzer->>UI: Pomodoro beenden
  UI->>App: stopPomodoro event
  App->>State: pomodoro.active = false
  App->>Store: saveState()
  UI-->>Nutzer: Pomodoro abgeschlossen
```

### Zeit manuell eintragen

```mermaid
sequenceDiagram
  actor Nutzer
  participant Form as tracked-form
  participant App as app.js Handler
  participant State as state.trackedSessions
  participant Store as localStorage
  participant UI as renderAll()

  Nutzer->>Form: Start/Ende + Notiz, Submit
  Form->>App: submit event
  App->>State: push(trackedSession)
  App->>Store: saveState()
  App->>UI: renderAll()
  UI-->>Nutzer: neue Session sichtbar
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
    +milestones: Milestone[]
  }

  class Milestone {
    +id: string
    +title: string
    +done: boolean
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
  Goal --> Milestone
  AppState --> RoughPlan
  AppState --> DetailPlan
  AppState --> TrackedSession
  AppState --> ImportedEvent
  AppState --> Settings
  AppState --> TimerState
  AppState --> PomodoroState
```

## Use-Case Diagramm

```mermaid
flowchart LR
  Nutzer((Nutzer))
  UC1([Ziel anlegen])
  UC2([Meilenstein anlegen])
  UC3([Lernzeit tracken])
  UC4([Pomodoro nutzen])
  UC5([Kalender anzeigen])
  UC6([Daten importieren])
  UC7([Daten exportieren])
  UC8([Demo-Daten laden])

  PC([Lokaler PC Dateisystem])
  NOTIF([Browser Notification API])
  STORAGE([localStorage])
  FILEAPI([File/Blob API])

  Nutzer --> UC1
  Nutzer --> UC2
  Nutzer --> UC3
  Nutzer --> UC4
  Nutzer --> UC5
  Nutzer --> UC6
  Nutzer --> UC7
  Nutzer --> UC8

  UC6 -- "Import" --> PC
  UC7 -- "Export" --> PC
  UC6 -- "File lesen" --> FILEAPI
  UC7 -- "File schreiben" --> FILEAPI
  UC4 -- "Benachrichtigung" --> NOTIF
  UC1 -- "Speichern" --> STORAGE
  UC2 -- "Speichern" --> STORAGE
  UC3 -- "Speichern" --> STORAGE
  UC4 -- "Speichern" --> STORAGE
  UC5 -- "Speichern" --> STORAGE
  UC8 -- "Speichern" --> STORAGE
```

## Zustandsdiagramm Pomodoro Technik

```mermaid
stateDiagram-v2
  [*] --> Idle

  Idle --> Work: Start
  Work --> Paused: Pause
  Paused --> Work: Fortsetzen
  Work --> ShortBreak: Phase beendet
  ShortBreak --> Paused: Pause
  Paused --> ShortBreak: Fortsetzen
  ShortBreak --> Work: Nächste Arbeitsphase

  Work --> LongBreak: Nach mehreren Pomodoros
  LongBreak --> Paused: Pause
  Paused --> LongBreak: Fortsetzen
  LongBreak --> Work: Nächste Arbeitsphase

  Work --> Idle: Reset / Stop
  ShortBreak --> Idle: Reset / Stop
  LongBreak --> Idle: Reset / Stop
  Paused --> Idle: Reset / Stop
```

## Kontextdiagramm

```mermaid
flowchart LR
  U[Nutzer]
  APP[FocusFlow Browser App]
  LS[(localStorage)]
  NOTIF[Notification API]
  FILE[Datei Import und Export]
  ICS[ICS Datei]
  JSON[JSON Backup]

  U --> APP
  APP --> LS
  APP --> NOTIF
  APP --> FILE
  FILE --> ICS
  FILE --> JSON
  ICS --> APP
  JSON --> APP
```

## Komponentendiagramm

```mermaid
flowchart LR
  UI[Benutzeroberflaeche]
  APP[App Orchestrator]
  STORE[State Store]
  REDUCER[Reducer]
  FORM[Form Handler]
  RENDER[Render Module]

  CAL[Calendar Manager]
  TIMER[Timer Manager]
  POMO[Pomodoro Manager]
  ICS[ICS Manager]
  JSON[JSON Manager]
  THEME[Theme Manager]

  LS[(localStorage)]
  NOTIF[Notification API]
  FILE[File API]

  UI --> FORM
  FORM --> APP
  APP --> REDUCER
  REDUCER --> STORE
  STORE --> LS
  STORE --> APP
  APP --> RENDER
  RENDER --> UI

  APP --> CAL
  APP --> TIMER
  APP --> POMO
  APP --> ICS
  APP --> JSON
  APP --> THEME

  POMO --> NOTIF
  ICS --> FILE
  JSON --> FILE
```

## Datenmodell

```mermaid
classDiagram
  class AppState {
    goals
    roughPlans
    detailPlans
    trackedSessions
    importedEvents
    settings
    timer
    pomodoro
  }

  class Goal {
    id
    title
    targetDate
    description
    completed
    completedAt
  }

  class Milestone {
    id
    title
    done
  }

  class RoughPlan {
    id
    week
    date
    hours
    note
    goalId
  }

  class DetailPlan {
    id
    date
    minutes
    topic
    milestone
    goalId
    milestoneId
    roughPlanId
    done
  }

  class TrackedSession {
    id
    start
    end
    minutes
    note
    detailPlanId
  }

  class ImportedEvent {
    id
    sourceKey
    sourceName
    sourceHash
    externalUid
    date
    summary
    createdAt
  }

  class Settings {
    inactivityDays
    lastReminderRun
    notificationEnabled
    activeView
    calendarMonth
    themeMode
  }

  class TimerState {
    start
    selectedDetailPlanId
  }

  class PomodoroState {
    active
    phase
    pomodorosCompleted
    secondsLeft
    phaseStartedAt
  }

  AppState --> Goal
  Goal --> Milestone
  AppState --> RoughPlan
  AppState --> DetailPlan
  AppState --> TrackedSession
  AppState --> ImportedEvent
  AppState --> Settings
  AppState --> TimerState
  AppState --> PomodoroState
```

## Sequenzdiagramm Standard Use-Case

```mermaid
sequenceDiagram
  actor Nutzer
  participant UI as Formular
  participant Handler
  participant App
  participant Reducer
  participant Store
  participant LocalStorage
  participant View

  Nutzer->>UI: Eingabe und Submit
  UI->>Handler: submit event
  Handler->>App: dispatch action
  App->>Reducer: state update
  Reducer->>Store: neuer state
  Store->>LocalStorage: speichern
  Store->>View: render
  View-->>Nutzer: aktualisierte Ansicht
```

## Sequenzdiagramm Import-Flow

```mermaid
sequenceDiagram
  actor Nutzer
  participant UI as Import UI
  participant Handler
  participant Manager
  participant Parser
  participant Store
  participant LocalStorage
  participant View

  Nutzer->>UI: Datei auswaehlen
  Nutzer->>UI: Import starten
  UI->>Handler: click event
  Handler->>Manager: import file
  Manager->>Parser: lesen und validieren

  alt gueltige Datei
    Parser-->>Manager: Daten ok
    Manager->>Store: merge oder replace
    Store->>LocalStorage: speichern
    Store->>View: render
    View-->>Nutzer: Status und neue Ansicht
  else ungueltige Datei
    Parser-->>Manager: Fehler
    Manager-->>UI: Fehlermeldung
    UI-->>Nutzer: Import fehlgeschlagen
  end
```
