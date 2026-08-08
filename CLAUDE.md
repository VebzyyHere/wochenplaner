# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

Wochenplaner — die Woche in **Stunden** statt nur in Terminen: feste Termine, Wochenziele
je Bereich, ein Verteil-Vorschlag, Schlaf- und Ruhezeit. Deutsch ist die Sprache von allem:
Oberfläche, Bezeichner, Kommentare, Commits. Live auf GitHub Pages:
`https://vebzyyhere.github.io/wochenplaner/` (Repo `VebzyyHere/wochenplaner`, Branch `main`).

## Die eine Datei

`index.html` **ist** das Produkt — 8484 Zeilen, ~396 KB, Vanilla JS, kein Build, kein npm,
kein Framework, kein Bundler. Sie läuft auch als heruntergeladene Einzeldatei über `file://`.
Die Zahlen und alle Zeilenangaben in diesem Dokument gelten für den Stand, an dem sie gemessen
wurden — die Datei wächst laufend. Immer per `grep -nE "^\s*/\* ={3,}" index.html` gegenprüfen,
das gibt die aktuelle Landkarte der Abschnittsbanner.

| Zeilen | Inhalt |
|---|---|
| 21–31 | Kopf-Skript: hängt Manifest und Icons **nur bei `http(s)`** ein — sonst drei vergebliche Abrufe in der Einzeldatei-Fassung |
| 32–1473 | `<style>`: Design-Tokens (OKLCH), Chrome bleibt achromatisch, die Farbe gehört den Bereichen |
| 1475–1601 | Markup: Topbar, Tagwechsler, Karten-Spalte, Raster, Tabbar, FAB |
| 1602–8482 | Hauptskript unter `"use strict"` |

`Read` deckt nur 2000 Zeilen ab — mit `offset`/`limit` arbeiten. Schnellster Einstieg sind die
Abschnittsbanner `/* ===== Titel */`: `grep -nE "^\s*/\* ={3,}" index.html` gibt die Landkarte.
Viele davon erklären in mehreren Sätzen, *warum* etwas so ist — vor dem Ändern lesen.

Daneben: `sw.js`, `manifest.json`, vier Icon-PNGs, `werkzeug/` (Prüfskripte).
`.gitattributes` ist eine Zeile: `*.png binary`.

## Befehle

Es gibt nichts zu bauen. Entwickeln heißt: Datei im Browser öffnen. Geprüft wird mit Playwright
in `werkzeug/` — Details und die Bedeutung jedes Skripts stehen in `werkzeug/README.md`.

Einrichten (einmal je Klon — `package.json` und `node_modules` sind dort **gitignored**):

```bash
cd werkzeug && npm init -y && npm install --save-dev playwright && npx playwright install chromium
```

Liegt schon ein Chromium bereit: `$env:WP_CHROMIUM = "..."` setzen.

Nach **jeder** Änderung an der Oberfläche, dauert zusammen etwa eine Minute:

```bash
node check.js && node audit.js && node dev.js
```

- `check.js` — Syntax beider Script-Blöcke, zwei Sekunden, fängt Tippfehler vor dem Browserstart.
- `audit.js` — **der wichtigste**: iPhone SE (320×568) durch alle vier Ansichten und siebzehn
  Dialoge; meldet Trefferflächen unter 44 px, waagerechtes Scrollen, abgeschnittenen Text,
  Dialogfüße außerhalb des Bildes. Vier von fünf Layoutfehlern in v1.12 kamen von hier.
- `dev.js` — Gerätematrix (iPhone SE/13/14 Pro Max, iPad, iPad Pro).
- `kontrast.js` — Design-Tokens im `<style>`-Block (fehlende Fallbacks, Hex-Werte außerhalb
  `:root`) und WCAG-Kontrast der Text/Hintergrund-Paare in Hell und Dunkel.

Als Git-Hook (Einrichtung: `werkzeug/hook-einrichten.md`) läuft vor jedem Commit `vorcommit.js`:
führt `check.js` und `kontrast.js` aus, bricht bei Rot ab. Das ersetzt nicht die volle Kette —
Pflicht vor dem eigentlichen Commit ist `node alles.js` aus `werkzeug/` heraus (siehe Verträge
unten); es sucht jedes `*.js` im Ordner neu, statt eine Liste zu pflegen, und startet die Server,
die einzelne Skripte brauchen, selbst.

Logik und Inhalt: `realtest.js` (Verteiler-Kennzahlen), `rt.js` (Wochenritual, Migration v7→v8),
`rt2.js` (Zusammenführen beim Abgleich), `frei.js` (freigehaltene Tage), `ob.js` (Erststart),
`tk.js` (Aufgabenblatt), `regeln.js` (kontextbewusster Verteiler: Fenster/Anker in
`area.regeln`), `erklaer.js` (Begründungszeile jedes Vorschlags), `stabil.js` (Verteiler bleibt
bei erneutem Lauf ruhig), `wunsch.js` (Startzeiten je Art gegen ihren Wunschpunkt), `serie.js`
(zweiwöchentliche Termine, Parität über die Sommerzeit), `aufgabenverteiler.js`/`aufgaben.js`
(Aufgaben werden ohne Datenkorruption verplant), `netz.js` (Sicherheitsnetz vor der
v9-Migration, `Store.backupVorV9()`), `rueckblick.js` (Wochenrückblick: geplant gegen
tatsächlich), `schleife.js` ("die Schleife schließt sich": Grund/Ort in der Agenda, Anker-Chips,
Tagesabschluss), `stufe5.js` (Einwegskript, nicht Teil der Standardsuite), `restdestag.js`
(Rest-des-Tages-Knopf in „Heute": Sichtbarkeit nur unter allen Bedingungen zugleich, Vorschläge
erst ab fester Uhrzeit, ein bereits vergangener eigener Vorschlag von heute bleibt unangetastet,
ohne Antippen passiert nichts), `importfuzz.js` (Fuzzing des einzigen Imports über den echten Weg
Dateiauswahl → `FileReader` → `JSON.parse()` → `migrate()`: Bedienbarkeit, Konsolenfehler,
unveränderter Bestand außer bei „Ersetzen"), `zeitrand.js` (die Zeitrechnung an ihren Rändern:
Sommerzeitwechsel, zweiwöchentliche Parität über mehrere Jahre, Jahresgrenze und
53-Wochen-Jahre, die doppelt vorkommende Stunde beim Herbstwechsel).

Bedienung: `sicht.js`, `diag7.js`, `woche.js`, `tap2.js`, `wisch.js`, `drag.js`, `grob3.js`,
`funktion.js`, `scroll.js` (Rasterposition je Tag), `agenda.js` (gestaffelter Falz-Vertrag,
Standardschrift, plus eigener Abschnitt für den Abend mit Tagesabschluss), `schrift.js`
(derselbe Vertrag bei vergrößerter Systemschrift, dort nur noch: Antwort bleibt sichtbar),
`fuss.js` (Stapelung von Tabbar, Vorschlagsleiste, FAB, Toast), `leiste.js` (Vorschlagsleiste
darf Karten-/Rasterinhalt nicht verdecken, und umgekehrt: ihr Polster darf die sichtbare
Rasterhöhe nicht schrumpfen), `dialog.js` (Barrierefreiheit der Dialoge), `haken.js` (Abhaken
hängt am Paar Eintrag+Datum), `abbrechen.js` (Ziele-Editor stellt bei Abbrechen, Escape oder
Klick auf den Hintergrund nicht nur Chips zurück, sondern jedes getippte Feld — über eine
Sicherung von `a.plan`/`a.regeln` beim Öffnen).

Abgleich und PWA brauchen einen Server:

```bash
node mockserver.js &   # Port 8899, tauscht die Supabase-Werte gegen den Nachbau
node test3.js          # zwei Geräte, ein Konto — fasst die echte DB nie an
```

```bash
node serve.js &        # Port 8901; ein Service Worker läuft nicht über file://
node pwatest.js        # Manifest, Worker, Zwischenspeicher, Offline-Start
node pwaupd.js         # Ablauf beim Erscheinen einer neuen Fassung
```

`pwaupd.js` schreibt dabei kurz `sw.js` und `index.html` um und stellt sie wieder her — bricht es
ab, zuerst `git status` ansehen. Symbole neu zeichnen: `python3 icon.py` (braucht Pillow).

Erwartete Falschmeldungen: `audit.js` sieht die unsichtbaren `::before`-Trefferflächen von Häkchen
und Farbfeldern nicht. `test3.js` gibt drei Konsolenfehler aus (fehlendes Favicon, abgelehnte
Anmeldung, abgeschalteter Netzzugang im Offline-Test).

## Veröffentlichen

1. `V` in `sw.js` hochzählen (aktuell `wp-v1.17` — die nächste Veröffentlichung zählt von dort
   aus hoch, nicht von dieser Zahl). Ohne das bleibt der Hinweis „Eine neue Fassung
   ist da" aus — die Seite selbst kommt zwar trotzdem frisch, weil der Worker network-first ist.
2. Commit im Repo-Stil: `vX.Y: Beschreibung`, **ohne Umlaute** („Pruefskripte", „ueberarbeitet").
3. Push auf `main`. Kein Workflow, kein Build — Pages liefert den Ordner direkt aus.

`werkzeug/README.md` verweist am Ende auf ein Projektdokument `sync-einrichten.md`. Das liegt
nicht im Repo — nicht danach suchen.

## Architektur

**Zustand.** Ein einziges `state`-Objekt. `freshState()` (1894) legt es bei `version: 8` an,
`migrate()` (1918) läuft danach sofort und zieht jeden Stand — auch einen frischen — kumulativ auf
`version: 9`. Felder: `areas` (seit v9 zusätzlich optional `area.regeln`, s. Verteiler), `blocks`,
`tasks`, `days`, `orte`/`wege`, `tombs`, `erledigt`, `rituale`. `Store` (1629) schreibt nach
`localStorage["wochenplaner.<scope>"]` — **ein Speicherplatz je Konto**, damit sich zwei Leute an
einem Rechner nicht überschreiben; Legacy-Schlüssel `wochenplaner.v1` wird einmal übernommen; ohne
`localStorage` (Vorschau-Frames) fällt er auf Arbeitsspeicher zurück und blendet ein Banner ein.
`Store.backupVorV9()` (1691) sichert **einmalig** den unveränderten Stand, bevor `migrate()` ihn
zum ersten Mal auf `version: 9` zieht — eigener Schlüssel neben dem Zustand, deshalb außerhalb von
`snapshot()`/`mergeStates()` und nie mitsynchronisiert (Prüfung: `netz.js`).

**Speichern.** `save()` (2196) → `stampChanges()` → `Store.save()` → `syncPush()`.
`snapshot()`/`recHash()` (2156/2150) vergleichen den neuen Stand mit dem letzten: was sich geändert
hat, bekommt `at`, was verschwunden ist, landet als Grabstein in `state.tombs`. Deshalb wird
nirgends von Hand gestempelt. `undoLast()` hält den Stand vor der letzten Änderung.

**Rendern.** Kein Framework, kein virtuelles DOM. `renderAll()` (8339) ruft zehn
`render*`-Funktionen, darunter `renderAgenda()` (5900, trägt seit Stufe 13 auch den
Tagesabschluss ab Feierabend) und `renderRitual()` (6426, Zugang zum Wochenritual). `setView()`
(8027) schaltet am Handy zwischen den vier Ansichten `plan` / `ziele` / `aufgaben` / `heute`
(Tabbar, Markup 1575) — am Desktop stehen sie nebeneinander.

**Verteiler.** `buildSuggestions()` (3547) → `placeArea()` / `placeGrob()` / `growSuggestions()`.
Vorschläge sind normale Blöcke mit `sug: true` — dadurch lassen sie sich ziehen wie alles andere.
Seit v9 kann ein Bereich zusätzlich `area.regeln` tragen (Fenster: erlaubte Wochentage/Uhrzeit;
Anker: Mindestabstand zu einem anderen Bereich) — der Verteiler prüft beides *vor* der
Platzierung, most-constrained-first (Prüfung: `regeln.js`). `wochenKapazitaet()` (2865) fragt
*vor* dem Verteilen, ob die Woche das überhaupt hergibt; `VERPLANT_GRENZE = 0.65` (2864), Ampel
grün ≤ 60 %, gelb ≤ 70 %, darüber rot (`ampelFarbe()` 2913). `istSerie()` (2528, `repeat ===
"weekly" || "2wochen"`) vereinheitlicht wöchentliche und zweiwöchentliche Termine für Anzeige und
Abhaken.

**Rest des Tages.** `restDesTagesBauen()` (3709), aufrufbar über den Knopf in „Heute"
(Sichtbarkeit über `restDesTagesMoeglich()` 3771), wendet denselben Verteiler wie das
Wochenziel-Verteilen an, nur auf den laufenden Tag beschränkt. Zwei rote Linien, teuer erarbeitet,
nicht versehentlich wieder aufweichen: auf einem freigehaltenen Tag schlägt auch dieser Weg nichts
vor (`istFrei()`); und ein bereits vergangener eigener Vorschlag von heute wird nicht mehr
angefasst — `growSuggestions()` kennt kein „jetzt" und würde ihn beim Auffüllen des
Feierabend-Rests sonst verlängern, darum sichert der Weg die vergangenen Blöcke vorher lokal
(`vergangeneSnapshot`) und schreibt sie danach Feld für Feld zurück.

**Wochenritual.** `ritualSheet()` (6453) führt am Montag durch drei Schritte —
`schrittRueckblick()` (6479, geplant gegen tatsächlich je Bereich mit Wochenziel, Angebot zur
Zielanpassung über `rueckblickMuster()` 6820), Ziele, Verteilen. `renderRitual()` (6426) zeigt die
Fälligkeit über `ritualFaellig()`/`ritualErledigt()` an.

**Abgleich.** `Sync` (7641) spricht Supabase direkt per `fetch`, **kein SDK**. Zugangsdaten stehen
bewusst im Klartext in `SUPABASE` (1620) — der anon key darf öffentlich sein, geschützt wird über
Row Level Security. `GET`/`POST /rest/v1/plans` (Spalte `data`, Header
`Prefer: resolution=merge-duplicates,return=minimal`), Session unter `wochenplaner.session`,
Push um 1,5 s entprellt, Status `off|signedout|syncing|ok|offline|error`.
`mergeStates()` (7559): pro Eintrag gewinnt die neuere Änderung, ein Grabstein zählt als Änderung.

**Service Worker.** `sw.js` ist bewusst **network-first** für eigene Adressen. Cache-first wäre
schneller, hat hier aber nach Veröffentlichungen tagelang die alte Fassung gezeigt. Fremde Adressen
(Supabase) werden nie angefasst — ein zwischengespeicherter Plan wäre schlimmer als kein Plan.

**Manifest-Identität.** `manifest.json`s `id` steht bewusst als **absoluter Pfad**
(`/wochenplaner/`), während `start_url` und `scope` `"./"` bleiben — das ist kein Schlamperei-Rest,
sondern Absicht. Grund: ein relatives `id` wird laut Spec nicht gegen die Manifest-URL oder gegen
`start_url` aufgelöst, sondern gegen die bloße **Origin** von `start_url` — deren Pfad fällt weg.
Live läuft die App unter einem Unterpfad (`https://vebzyyhere.github.io/wochenplaner/`, nicht an
der Domain-Wurzel): ein relatives `id` wie `"./"` würde zu `https://vebzyyhere.github.io/`
aufgelöst — einer anderen Identität als der heutigen (ohne `id` gilt implizit der aufgelöste
`start_url`, also der Unterpfad) — und hätte die schon installierte App zur Karteileiche gemacht.
Nur der absolute Pfad `/wochenplaner/` trifft, gegen die Origin aufgelöst, wieder den Unterpfad.
Geprüft in `werkzeug/pwatest.js`.

## Invarianten

- **`migrate()` ist die einzige Schema-Stelle.** Kumulativ und idempotent, läuft beim Laden, beim
  Import, nach dem Zusammenführen und beim Rückgängigmachen. Neues Feld → dort absichern,
  `s.version` am Ende mitziehen.
- **Nie `at` von Hand setzen, nie Grabsteine löschen.** Sonst kehren gelöschte Einträge beim
  nächsten Abgleich vom anderen Gerät zurück.
- **„Ersetzen" beim Import ist nicht harmlos** (`importData()` 7485): alles, was hier existiert und
  in der Sicherung fehlt, bekommt einen Grabstein — und den schiebt der Abgleich auf alle Geräte.
  Eine drei Monate alte Sicherung vom Handy hat so schon den Plan am PC gelöscht. Der Dialog mit
  „Zusammenführen" als Vorgabe bleibt — diese Semantik ist unverändert. Was sich geändert hat: eine
  kaputte Datei kommt gar nicht mehr bis zu diesem Dialog. Kein Objekt oder ein blankes Array
  (bestünde sonst still `typeof === "object"` und würde `state` selbst zum Array machen, siehe
  Kommentar an `importData()`) endet in einem erklärenden Toast statt in `migrate()`, ein
  JSON-Parse-Fehler ebenso — geprüft in `werkzeug/importfuzz.js` über den echten Weg
  Dateiauswahl → `FileReader` → `JSON.parse()` → `migrate()`.
- **Grobe Blöcke** (`b.grob`, mit `teil` + `dauer` statt Uhrzeit) dürfen in den Kennzahlen von
  `realtest.js` nicht mitzählen. Sie haben keine echte Uhrzeit und erscheinen sonst als „Übergang
  ohne Lücke" — dieser Messfehler hat einmal eine Verschlechterung vorgetäuscht, die es nicht gab.
- **Abhaken hängt am Paar Eintrag + Datum** (`hakenKey()` 2674, nutzt `istSerie()` 2528), nicht an
  der Serie — sonst gilt ein wöchentlicher oder zweiwöchentlicher Eintrag in allen Wochen als
  erledigt.
- **Neue Felder gehören auf `area`, `task` oder `block` — nie an die `state`-Wurzel und nie in
  `area.plan`.**
- **Nutzertext geht über `innerHTML` in den DOM** → durch `escapeHtml()` (6370) schicken.
- **`renderEnergy()` (6150) schreibt ungeschützt in statisches Markup** (`#energyDay`, `#energyHint`,
  `#dayFrei`, `#dayFreiLab`). Wer die Karte `data-card="heute"` ersetzt statt ergänzt, lässt
  `renderAll()` mit einem `TypeError` abbrechen.
- **`growSuggestions()` kennt generell kein „jetzt".** Bekannt, bewusst nicht behoben, außerhalb
  des Auftrags, der `restDesTagesBauen()` brachte: auch der wöchentliche Verteiler kann daher
  theoretisch einen längst vergangenen eigenen Vorschlag von heute verlängern, weil
  `clearSuggestions(warm)` (3612) den laufenden Tag bewusst unberührt lässt.

## Verträge

Diese Verträge stehen nirgends sonst im Repo — bisher musste sie jeder Agent einzeln mitgeteilt
bekommen. Sie gelten unabhängig davon, wie sich Zeilenzahlen oben verschieben.

- **Impeccable-Deckel bei genau drei `side-tab`-Treffern.** Der Detektor meldet die drei
  bewussten Ausnahmen `.agenda__hero`, `.agenda__row`, `.block` (Kante kodiert die Bereichsfarbe,
  also Information). Ein vierter Treffer wird nicht akzeptiert. `npm` liefert nur die Fassung
  3.5.0 des Plugins, installiert ist 4.0.4 — deshalb aus dem Plugin-Cache aufrufen:
  ```
  node "C:/Users/aless/.claude/plugins/cache/impeccable/impeccable/4.0.4/skills/impeccable/scripts/detector/detect-antipatterns.mjs" index.html --no-config
  ```
  Aus der Repo-Wurzel ausführen. Die Ausgabe kommt auf stderr, Exit-Code 2 bei Treffern.
- **Die gestaffelte Falz — drei Situationen, drei Verträge, keinen aufweichen.** Bei
  Standardschrift muss die Agenda ohne Scrollen über die Tabbar passen (`agenda.js`); bei
  vergrößerter Systemschrift gilt nur noch, dass die Antwort ohne Scrollen sichtbar ist
  (`schrift.js`); für den Abend mit Tagesabschluss gilt ein eigener Vertrag mit eigener,
  festgenagelter 23-Uhr-Uhr (`agenda.js`, Abschnitt h).
- **Alle zeitkritischen Prüfskripte nageln Uhrzeit, Datum und Zeitzone fest**
  (`page.clock.setFixedTime`, `timezoneId: 'Europe/Berlin'`). Diese Fehlerklasse — ein Skript, das
  je nach Startzeitpunkt grün oder rot wird und dadurch falsches Vertrauen erzeugt — hat in diesem
  Projekt schon **viermal** zugeschlagen. Ein neues zeitkritisches Prüfskript ohne feste Uhr wird
  nicht abgenommen. Das Zeit-Literal in `setFixedTime` muss dabei **zoniert** angegeben werden
  (z. B. `'2026-08-05T10:00:00+02:00'`) — eine Uhrzeit ohne Zonen-Endung nimmt die Prozesszone der
  jeweils ausführenden Maschine an und wird dadurch selbst wieder zu einer ungenagelten Uhr.
- **Commit nur bei grüner Kette:** vorher `node alles.js` aus `werkzeug/` heraus laufen lassen.
- **Screenshots werden angesehen, nicht nur gemessen.** Fünf echte Befunde dieses Projekts hat
  keine einzige Messung gefunden, nur der Blick aufs Bild.
