# Lernzeitplaner (Proof of Concept)

Ein einfacher Frontend-Prototyp (ohne Backend) für Lernzeitplanung und Lernzeit-Tracking.
Alle Daten werden im Browser über `localStorage` gespeichert.

## Enthaltene Funktionen

- Lernziele für 6 Monate erfassen und als erreicht markieren
- Grobplanung von Lernzeiten für 6 Monate
- Detailplanung von Lernzeiten und Zwischenzielen für 1 Monat
- Stoppuhr für ungestörte Lernzeit (Tracking)
- Übersicht zur Zielerreichung und Zeitnutzung
- Erinnerungen für bald fällige Ziele/Planungen + Hinweis bei Inaktivität
- Demo-Daten per Button laden

## Lokaler Start

Da es statisches HTML/CSS/JS ist, einfach `index.html` im Browser öffnen.

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

## GitHub Pages Deployment

1. Repository auf GitHub erstellen und Dateien pushen.
2. In GitHub: `Settings > Pages` öffnen.
3. Source: `Deploy from a branch`.
4. Branch: `main` (oder `master`), Folder: `/ (root)`.
5. Speichern, dann wird eine Pages-URL bereitgestellt.

## Hinweise

- Browser-Benachrichtigungen müssen einmal erlaubt werden.
- Erinnerungen laufen nur, solange die Seite geöffnet ist (kein Backend/kein Service Worker).
- Für einen echten Produktivbetrieb wären Benutzerkonten, serverseitige Persistenz und Synchronisation sinnvoll.
