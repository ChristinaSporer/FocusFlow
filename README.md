# Projekt: Lernzeit-Manager (FocusFlow)

Dieses Projekt entstand im Modul „Projekt Software Engineering (ISEF01)“ an der
IU Internationale Hochschule.

Der Lernzeit-Manager ist eine browserbasierte Webanwendung zur Planung, Organisation
und Nachverfolgung von Lernzeiten. Ziel ist es, Lernziele strukturiert zu planen,
Lernzeiten zu verteilen und den tatsächlichen Lernaufwand zu erfassen.<br>
Die Anwendung ist als Frontend-only-Prototyp umgesetzt und verzichtet bewusst auf
ein Backend oder eine Benutzerverwaltung.

## Features

- Lernziele mit Startdatum, abgeleitetem Enddatum, Workload, Farbe und Zwischenzielen
- Grobplanung auf Basis konfigurierbarer Standard-Lernzeiten
- Detailplanung aus Grobplanung sowie freie Zusatz-Detailplanung
- Lernzeit-Tracking per Stoppuhr, manueller Eintragung und Pomodoro
- Kalenderansicht fuer Ziele, Detailplanung und importierte ICS-Termine
- JSON- und ICS-Import/Export ueber das Menue
- Browser-Benachrichtigungen fuer geplante Lernzeiten
- Demo-Daten und Reset fuer schnelle Tests

## Systemüberblick

Anwendungstyp: Browserbasierte Web-App (Frontend-only)<br>
Persistenz: localStorage im Browser<br>
Deployment: GitHub Pages<br>
Zugriff: Direkt über Browser, keine Installation erforderlich<br>
Login: Nicht vorhanden

Die Anwendung wurde bis zur Abgabe iterativ weiterentwickelt und um
UI-/UX-Verbesserungen sowie zusätzliche Komfortfunktionen ergänzt,
ohne die fachlichen Zielsetzungen oder die Systemarchitektur zu verändern.

## Dokumentationen

MS4_Benutzerhandbuch_v1.0.pdf<br>
Beschreibung der Bedienung, Navigation und Kernfunktionen

MS4_Fachliche_Dokumentation_v1.0.pdf<br>
Funktionale Anforderungen, Use Cases, fachliche Regeln und Prozesse

MS4_TechnischeDokumentation_v1.0.pdf<br>
Architektur, Module, Datenhaltung, Berechnungslogik, Import/Export, CI/CD

MS4_Betriebsdokumentation_v1.0.pdf<br>
Systemzugriff, lokaler Start, Deployment, Betrieb, Konfiguration

MS4_Testabschlussbericht_v1.0.pdf<br>
Struktur, Teststrategie und Übersicht geplanter Tests (noch einzupflegen)

## Prozess- und Statusdokumente

Sprint0_Statusblatt.docx
Statusbericht zur Vorbereitung und technischen Initialisierung (Sprint 0)

Sprint1_Statusblatt.docx
Statusbericht zur Umsetzung der Kernfunktionen und Dokumentation (Sprint 1)

Zusätzlich liegt eine Sprint‑Planung zur Koordination der Testphase sowie ein Trello‑Board
zur operativen Aufgaben‑ und Fortschrittsverfolgung vor.

## GitHub

Repository-Link: `https://github.com/ChristinaSporer/FocusFlow`<br>
GitHub-Repository mit vollständiger Versionshistorie

## GitHub Pages

Bei erfolgreichem Default-Branch-Push werden App und Coverage bereitgestellt:

- App: `https://christinasporer.github.io/FocusFlow/`
- Coverage: `https://christinasporer.github.io/FocusFlow/coverage/`

Voraussetzung in GitHub:

- `Settings -> Pages -> Source: GitHub Actions`

## Lokaler Start

### Variante 1: npm

1. Abhaengigkeiten installieren:
   - `npm install`
2. App starten:
   - `npm start`
3. Aufrufen unter:
   - `http://localhost:8080/index.html`

### Variante 2: Windows One-Click

- `start-localhost.bat` per Doppelklick ausfuehren.
- Das Skript installiert bei Bedarf Abhaengigkeiten und startet den lokalen Server.

## Scripts

- `npm start`: Lokaler Server mit Auto-Open
- `npm run serve`: Lokaler Server ohne Auto-Open
- `npm run lint`: ESLint + Stylelint
- `npm run lint:fix`: Linting mit Auto-Fixes
- `npm run format`: Prettier Check
- `npm run format:write`: Prettier Write
- `npm run test`: Unit-/DOM-Tests (Vitest)
- `npm run test:coverage`: Unit-Tests mit Coverage
- `npm run test:watch`: Vitest Watch Mode
- `npm run test:e2e`: Playwright E2E
- `npm run test:all`: Unit + E2E

## Tests

- Unit-/DOM-Tests liegen unter `tests/unit`.
- E2E-Tests liegen unter `tests/e2e`.
- Die E2E-Testspezifikation liegt unter:
  - `tests/e2e/TESTSPEZIFIKATION.md`

## CI/CD (GitHub Actions)

Workflow: `.github/workflows/ci.yml`

Enthaelt folgende Jobs:

1. `lint`
   - ESLint, Stylelint, Prettier-Check
   - Hinweis: Job ist aktuell mit `continue-on-error: true` konfiguriert
2. `unit-tests`
   - Vitest mit Coverage
   - Artefakte: `coverage-report`, `unit-test-results`
3. `e2e-tests`
   - Playwright (Chromium)
   - Artefakte: `e2e-test-results`, bei Fehlern `playwright-traces`
4. `test-report`
   - Kombinierter Report aus Unit- und E2E-Ergebnissen
   - Artefakt: `ci-test-report`
5. `coverage-pages`
   - Deploy von App + Coverage auf GitHub Pages (nur Push auf Default-Branch)

## BESONDERE HINWEISE

Keine Test-Accounts erforderlich<br>
Die Anwendung besitzt keinen Login und keine Benutzerverwaltung.

Frontend-only-Architektur<br>
Es existiert keine serverseitige Persistenz oder Synchronisation.

### Datensicherung

Alle Daten werden lokal gespeichert.<br>
Für die Sicherung stehen JSON- und ICS-Exporte zur Verfügung.

## Architektur

<details>
<summary>Übersicht und Diagramme zur Architektur des Systems</summary>

### Kontextdiagramm (Systemgrenze und externe Schnittstellen)

```mermaid
graph TB
    User["👤 <b>Nutzer</b>"]
    Browser["🌐 <b>Web Browser</b><br/>(HTML5 / JavaScript)"]

    subgraph System ["📦 FocusFlow System"]
        App["FocusFlow Frontend<br/>(app.js + Module)"]
    end

    LocalStorage["💾 <b>localStorage</b><br/>(focusflow-v1)"]
    NotificationAPI["🔔 <b>Notification API</b><br/>(Browser-Benachrichtigungen)"]
    FileAPI["📁 <b>File API</b><br/>(JSON/ICS Import-Export)"]

    User -->|Interaktion| Browser
    Browser -->|rendert| System
    App -->|persistiert / liest| LocalStorage
    App -->|sendet Benachrichtigungen| NotificationAPI
    NotificationAPI -->|zeigt an| Browser
    App -->|importiert / exportiert| FileAPI
    FileAPI -->|Download-Dialog / Dateiauswahl| Browser

    style System fill:#4EBE9B
    style LocalStorage fill:#D6A4E0
    style NotificationAPI fill:#A6B7DE
    style FileAPI fill:#F8D096
```

### Kurzueberblick

- `app.js` initialisiert die Anwendung und orchestriert Rendering, Handler und Manager.
- Zustandsaenderungen laufen zentral ueber `form-handlers.js` -> `app-reducer.js` -> `state-store.js`.
- Der komplette App-Status wird nach jeder Aktion in `localStorage` persistiert.
- Fachmodule (`calendar-manager`, `timer-manager`, `pomodoro-manager`, `ics-manager`, `json-manager`, `notification-manager`) kapseln klar getrennte Verantwortlichkeiten.
- Die UI wird ueber `render-main-view.js` aus dem aktuellen Zustand neu aufgebaut.
- Import/Export und Benachrichtigungen nutzen Browser-APIs (File/Blob/Notification).
- Tests sind zweistufig aufgebaut: Vitest fuer Unit/DOM, Playwright fuer E2E.

### Komponentenuebersicht

```mermaid
flowchart LR
  U[Nutzer]
  UI[index.html / styles.css]
  APP[app.js Bootstrap + Orchestrierung]

  FH[form-handlers.js]
  RED[app-reducer.js]
  STORE[state-store.js]
  RENDER[render-main-view.js]

  CAL[calendar-manager.js]
  TIM[timer-manager.js]
  POM[pomodoro-manager.js]
  THEME[theme-manager.js]
  ICS[ics-manager.js]
  JSON[json-manager.js]
  NOTIF[notification-manager.js]

  LS[(localStorage)]
  BROWSER[Browser APIs\nNotification / File / Blob]

  U --> UI
  UI --> APP

  APP --> FH
  FH --> RED
  RED --> STORE
  STORE --> LS

  APP --> RENDER
  APP --> CAL
  APP --> TIM
  APP --> POM
  APP --> THEME
  APP --> ICS
  APP --> JSON
  APP --> NOTIF

  CAL --> STORE
  TIM --> STORE
  POM --> STORE
  ICS --> STORE

  ICS --> BROWSER
  JSON --> BROWSER
  NOTIF --> BROWSER
```

### Datenmodell

```mermaid
classDiagram
  class AppState {
    goals: Goal[]
    roughPlans: RoughPlan[]
    detailPlans: DetailPlan[]
    trackedSessions: TrackedSession[]
    importedEvents: ImportedEvent[]
    settings: Settings
    timer: TimerState
    pomodoro: PomodoroState
  }

  class Goal {
    id: string
    title: string
    targetDate: string
    completed: boolean
    completedAt: string|null
    milestones: Milestone[]
    colorKey: string
  }

  class Milestone {
    id: string
    title: string
    done: boolean
  }

  class RoughPlan {
    id: string
    goalId: string|null
    date: string
    hours: number
    note: string
    plannedDays: object[]
  }

  class DetailPlan {
    id: string
    goalId: string|null
    milestoneId: string|null
    date: string
    startTime: string
    endTime: string
    topic: string
    done: boolean
  }

  class TrackedSession {
    id: string
    date: string
    minutes: number
    note: string
    detailPlanId: string|null
  }

  class ImportedEvent {
    id: string
    sourceKey: string
    sourceName: string
    date: string
    summary: string
  }

  class Settings {
    inactivityDays: number
    lastReminderRun: string|null
    notificationEnabled: boolean
    notificationLeadMinutes: number
    activeView: string
    calendarMonth: string|null
    themeMode: string
    standardLearningTimes: object
  }

  class TimerState {
    start: string|null
    selectedDetailPlanId: string|null
  }

  class PomodoroState {
    active: boolean
    phase: string
    pomodorosCompleted: number
    secondsLeft: number
    phaseStartedAt: string|null
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

</details>
