# Testspezifikation E2E

Stand: 2026-04-15
Umfang: Playwright-End-to-End-Tests in `tests/e2e`

## 1. JSON Backup und Restore

### TC-E2E-JSON-01
Titel: JSON-Import lädt einen gültigen App-Stand
Kurzbeschreibung: Prüft, dass ein valides JSON mit Zielobjekt korrekt importiert und in der Liste sichtbar wird.
Grobe Testschritte:
1. App öffnen und Menübereich JSON aufklappen.
2. Gültige JSON-Datei mit einem Ziel hochladen.
3. Import auslösen und Dialog bestätigen.
4. Erfolgsstatus und sichtbares Ziel in der Ziel-Liste prüfen.

### TC-E2E-JSON-02
Titel: JSON-Export erzeugt eine herunterladbare Sicherung
Kurzbeschreibung: Prüft, dass ein vorhandener App-Stand als JSON exportiert und die Datei inhaltlich korrekt erzeugt wird.
Grobe Testschritte:
1. App öffnen und ein Ziel anlegen.
2. Menübereich JSON öffnen und Export starten.
3. Download abwarten und Dateiinhalt einlesen.
4. Prüfen, dass `goals` vorhanden ist und das angelegte Ziel enthalten ist.
5. Export-Statusmeldung prüfen.

### TC-E2E-JSON-03
Titel: JSON-Import zeigt Fehler bei ungültigem JSON
Kurzbeschreibung: Stellt sicher, dass syntaktisch defektes JSON mit Fehlermeldung abgefangen wird.
Grobe Testschritte:
1. App öffnen und JSON-Bereich öffnen.
2. Ungültige JSON-Datei hochladen.
3. Import auslösen und Dialog bestätigen.
4. Fehlerstatus für fehlgeschlagenen Import prüfen.

### TC-E2E-JSON-04
Titel: JSON-Import zeigt Fehler bei falschem Dateiformat
Kurzbeschreibung: Prüft Fehlerbehandlung bei nicht passendem Dateiformat (z. B. Textdatei statt JSON).
Grobe Testschritte:
1. App öffnen und JSON-Bereich öffnen.
2. Datei mit falschem MIME/Format hochladen.
3. Import auslösen und Dialog bestätigen.
4. Fehlerstatus für fehlgeschlagenen Import prüfen.

## 2. Smoke-Tests

### TC-E2E-SMOKE-01
Titel: Smoke: Lernziel kann angelegt werden
Kurzbeschreibung: Basisfunktion zur Zielerstellung inklusive Sichtbarkeit im UI.
Grobe Testschritte:
1. App öffnen.
2. Seitentitel/Headliner prüfen.
3. Zieldaten eingeben und Ziel anlegen.
4. Sichtbarkeit des neuen Ziels in der Ziel-Liste prüfen.

### TC-E2E-SMOKE-02
Titel: Smoke: Kalenderansicht zeigt angelegte Detailplanung
Kurzbeschreibung: Verifiziert, dass eine zusätzliche Detailplanung in der Kalenderansicht erscheint.
Grobe Testschritte:
1. App öffnen und zusätzliche Detailplanung erfassen.
2. In Kalenderansicht wechseln.
3. Kalendercontainer und den Termintext prüfen.

## 3. Ziele und Sichtbarkeit

### TC-E2E-GOAL-01
Titel: Lernziel mit Zwischenziel kann angelegt werden
Kurzbeschreibung: Prüft Anlage eines Hauptziels mit Zwischenziel.
Grobe Testschritte:
1. App öffnen.
2. Lernziel erstellen.
3. Zwischenziel am Lernziel hinzufügen.
4. Ziel und Zwischenziel in der Ziel-Liste prüfen.

### TC-E2E-GOAL-02
Titel: Erledigtes Zwischenziel blendet verknüpfte Detailplanung aus
Kurzbeschreibung: Verifiziert, dass verknüpfte Detailplanung bei abgeschlossenem Zwischenziel nicht mehr angezeigt wird.
Grobe Testschritte:
1. App öffnen, Monat setzen, Ziel mit Zwischenziel anlegen.
2. Zusätzliche Detailplanung mit Zwischenziel-Verknüpfung erstellen.
3. Sichtbarkeit der Detailplanung prüfen.
4. Zwischenziel als erledigt markieren.
5. Prüfen, dass die verknüpfte Detailplanung nicht mehr in der Liste erscheint.

### TC-E2E-GOAL-03
Titel: Erledigtes Ziel wandert zu erreichten Zielen und kann wieder aktiviert werden
Kurzbeschreibung: Deckt den vollständigen Lebenszyklus eines Ziels inklusive Reaktivierung, Folgeobjekten und Kalenderdarstellung ab.
Grobe Testschritte:
1. App öffnen, Monat setzen, Ziel mit Zwischenziel anlegen.
2. Grobplanung und zugehörige Detailplanung erstellen.
3. Manuelles Tracking mit Detailbezug durchführen.
4. Ziel als erledigt markieren.
5. Prüfen, dass Ziel in „Erreichte Ziele“ erscheint und aus aktiven Listen verschwindet.
6. Kalenderansicht prüfen (Detaileintrag für aktives Ziel nicht sichtbar).
7. Ziel in Listenansicht reaktivieren.
8. Prüfen, dass Ziel, Grobplanung und Detailplanung wieder sichtbar sind.
9. Kalenderansicht erneut prüfen.

## 4. ICS Import und Export

### TC-E2E-ICS-01
Titel: ICS-Export erstellt eine Datei mit App-Terminen
Kurzbeschreibung: Prüft, dass aus App-Terminobjekten eine gültige ICS-Datei erzeugt wird.
Grobe Testschritte:
1. App öffnen, Ziel und zusätzliche Detailplanung anlegen.
2. Menübereich ICS öffnen und Export starten.
3. Download-Datei einlesen.
4. ICS-Struktur (`BEGIN:VCALENDAR`, `BEGIN:VEVENT`) und inhaltliche Felder prüfen.
5. Export-Statusmeldung prüfen.

### TC-E2E-ICS-02
Titel: ICS-Import übernimmt gültige Termine in Kalender und Status
Kurzbeschreibung: Verifiziert den erfolgreichen Import einer gültigen ICS-Datei und Sichtbarkeit im Kalender.
Grobe Testschritte:
1. App öffnen und ICS-Bereich öffnen.
2. Gültige ICS-Datei mit Termin hochladen.
3. Import auslösen (optional erscheinenden Dialog akzeptieren).
4. Erfolgsstatus prüfen.
5. Zielmonat setzen und Kalenderansicht öffnen.
6. Sichtbarkeit des importierten Termins prüfen.

### TC-E2E-ICS-03
Titel: ICS-Import zeigt Fehler bei kaputter ICS-Datei
Kurzbeschreibung: Prüft Fehlerdialog bei strukturell fehlerhafter ICS-Datei.
Grobe Testschritte:
1. App öffnen und ICS-Bereich öffnen.
2. Defekte ICS-Datei hochladen.
3. Import auslösen.
4. Fehlermeldungsdialog inhaltlich prüfen und schließen.

### TC-E2E-ICS-04
Titel: ICS-Import zeigt Fehler bei falschem Dateiformat
Kurzbeschreibung: Prüft Fehlerdialog bei nicht-ICS-Datei.
Grobe Testschritte:
1. App öffnen und ICS-Bereich öffnen.
2. Datei mit falschem Typ hochladen.
3. Import auslösen.
4. Fehlermeldungsdialog inhaltlich prüfen und schließen.

## 5. Planung CRUD und Kalender

### TC-E2E-PLAN-01
Titel: Grobplanung: Ziel mit Farbe, Slot-Auswahl, Detailerzeugung und erneute Planbarkeit
Kurzbeschreibung: Deckt Zielattribute, Standard-Lernzeiten, Slot-Logik, automatische Detailerzeugung und Re-Planbarkeit ab.
Grobe Testschritte:
1. App öffnen, Monat setzen, zwei Ziele anlegen (eins mit Farbe und Workload).
2. Zusätzlichen Detailtermin als belegten Slot anlegen.
3. Standard-Lernzeiten im Menü setzen und speichern.
4. Ziel für Grobplanung auswählen und Vorschlagsgrid prüfen.
5. Slot-Auswahl gezielt ändern und Grobplanung auslösen.
6. Automatisch erzeugte Detailplanung und Target-Date-Invariante prüfen.
7. Prüfen, dass bereits geplantes Ziel aus Auswahl fällt, anderes Ziel aber verfügbar bleibt.
8. Grobplanung löschen und Ziel erneut auswählbar prüfen.

### TC-E2E-PLAN-02
Titel: Detailplanung: Bearbeiten, Kalender-Drag&Drop, mit und ohne Hauptziel planen
Kurzbeschreibung: Validiert Bearbeitung und Verschiebung von Detailterminen sowie Konsistenz des Ziel-Enddatums.
Grobe Testschritte:
1. App öffnen, Monat setzen, Ziel, Zwischenziel und Grobplanung anlegen.
2. Detailtermin aus Grobplan erstellen und Zwischenziel zuordnen.
3. Termin bearbeiten und neues Datum speichern.
4. Ziel-Target-Date gegen letztes Detaildatum prüfen.
5. In Kalender wechseln und Termin per Drag&Drop auf neuen Tag verschieben.
6. In Listenansicht wechseln und verschobenes Datum/Target-Date prüfen.
7. Zusätzliche Details mit und ohne Zielbezug anlegen.
8. Zielbezogenen Zusatztermin löschen und Ziel-Target-Date erneut konsistent prüfen.

## 6. Einstellungen und Menü

### TC-E2E-SET-01
Titel: Menü: Demo-Daten laden, Übersicht prüfen und anschließend Alles löschen
Kurzbeschreibung: Prüft Schnellaktionen im Menü inklusive Demo-Seed und Reset in den leeren Zustand.
Grobe Testschritte:
1. App öffnen und Menü öffnen.
2. Demo-Daten laden.
3. Ziel-/Übersichtsinhalte prüfen.
4. Alles löschen ausführen und Dialog (falls vorhanden) bestätigen.
5. Leere Zustände in Ziel-, Grob- und Detailliste prüfen.

### TC-E2E-SET-02
Titel: Darstellung kann auf Hell, Dunkel und zurück auf Auto gewechselt werden
Kurzbeschreibung: Verifiziert Theme-Umschaltung im UI und Persistenz im State.
Grobe Testschritte:
1. App öffnen und Menü öffnen.
2. Theme auf Hell schalten und HTML-Attribut prüfen.
3. Persistierten Theme-Mode im LocalStorage prüfen.
4. Theme auf Dunkel und danach Auto stellen.
5. Persistierten Zustand jeweils prüfen.

### TC-E2E-SET-03
Titel: Erinnerung kann ein- und ausgeschaltet werden; ausgeschaltet kommt keine Benachrichtigung
Kurzbeschreibung: Prüft Notification-Schalter gegen Mock-Notification-API.
Grobe Testschritte:
1. Notification-Mock installieren, App öffnen, Menü öffnen.
2. Erinnerung konfigurieren, einschalten und wieder ausschalten.
3. Ziel und Detailtermin anlegen.
4. Prüfen, dass keine Notification ausgelöst wurde.

### TC-E2E-SET-04
Titel: Standard-Lernzeiten beeinflussen die Vorschläge in der Grobplanung
Kurzbeschreibung: Verifiziert, dass gespeicherte Standard-Lernzeiten in die Slot-Vorschläge einfließen.
Grobe Testschritte:
1. App öffnen, Monat setzen, Ziel mit Workload anlegen.
2. Standard-Lernzeiten im Menü setzen und speichern.
3. Ziel in Grobplanung auswählen.
4. Vorschlagsgrid auf erwartete Slot-Länge und Zusammenfassung prüfen.

## 7. Tracking und Pomodoro

### TC-E2E-TRACK-01
Titel: Lernzeit-Tracking: Zeit nachtragen mit und ohne Detailbezug
Kurzbeschreibung: Prüft Erfassen, Bearbeiten, Löschen und erneutes Erfassen manueller Tracking-Einträge.
Grobe Testschritte:
1. App öffnen und auf manuellen Tracking-Tab wechseln.
2. Eintrag ohne Detailbezug anlegen.
3. Eintrag bearbeiten (Dauer/Notiz) und Speicherung prüfen.
4. Bearbeiteten Eintrag löschen.
5. Neuen Eintrag ohne Detailbezug erstellen und Sichtbarkeit prüfen.

### TC-E2E-TRACK-02
Titel: Stoppuhr startet über Detailplanungspunkt und wechselt auf den Stoppuhr-Tab
Kurzbeschreibung: Verifiziert Start aus Detailplanung, Timer-Steuerung und Rückschreiben in Tracking-/Planungsstatus.
Grobe Testschritte:
1. App öffnen, Monat setzen, Ziel und Grobplanung anlegen.
2. Detailplanungspunkt erzeugen.
3. Aus Detailplanung Tracking starten.
4. Sichtbarkeit von Timer-Elementen prüfen.
5. Kurz laufen lassen, stoppen.
6. Tracking-Liste und Getrackt-Indikatoren in Detail- und Zielbereich prüfen.

### TC-E2E-TRACK-03
Titel: Stoppuhr unterstützt Start-Pause-Start-Pause-Stop
Kurzbeschreibung: Prüft den Standardzustandsautomat der Stoppuhr inkl. finalem Eintrag.
Grobe Testschritte:
1. App öffnen und Stoppuhr-Tab öffnen.
2. Starten, pausieren, erneut starten, erneut pausieren, stoppen.
3. Timeranzeige und Anzahl der Tracking-Einträge prüfen.

### TC-E2E-TRACK-04
Titel: Pomodoro stellt gespeicherte lange Pause dar
Kurzbeschreibung: Prüft Rendering eines vorbefüllten Pomodoro-Zustands aus Persistenz.
Grobe Testschritte:
1. State mit Phase `long-break` und 15 Minuten Restzeit vorinitialisieren.
2. App öffnen und Pomodoro-Tab öffnen.
3. Phase und Zeitanzeige prüfen.

### TC-E2E-TRACK-05
Titel: Pomodoro wechselt nach der vierten Arbeitsphase in die lange Pause
Kurzbeschreibung: Verifiziert Übergangslogik und Persistenz von `work` zu `long-break` nach vierter Runde.
Grobe Testschritte:
1. State mit drei abgeschlossenen Pomodoros und Arbeitsphase vorinitialisieren.
2. App öffnen und Pomodoro-Tab öffnen.
3. „Speichern & Nächste Phase“ auslösen.
4. Lange Pause und 15:00 Anzeige prüfen.
5. Persistierten Pomodoro-State prüfen.

### TC-E2E-TRACK-06
Titel: Pomodoro-Reset setzt den Ablauf wieder auf Arbeitsphase
Kurzbeschreibung: Prüft Reset auf Ausgangszustand nach Phasenwechsel.
Grobe Testschritte:
1. App öffnen, Pomodoro-Tab öffnen.
2. In nächste Phase wechseln.
3. Reset auslösen.
4. Arbeitsphase und 25:00 Anzeige prüfen.

## 8. Hinweise zur Ausführung

1. Tests laufen mit Playwright gegen die lokale App-URL (`/`).
2. Viele Testfälle erzeugen eindeutige Titel mit Zeitstempel, um Kollisionen zu vermeiden.
3. Mehrere Fälle greifen auf Dialoge (Import/Reset) zu; bei einzelnen Aktionen ist Dialogbehandlung optional implementiert.
4. Monatliche Filterung (`#month-select`) ist zentral für planungs- und kalenderbezogene Testfälle.
