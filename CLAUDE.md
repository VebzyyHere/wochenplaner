# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

Wochenplaner — die Woche in **Stunden** statt nur in Terminen: feste Termine, Wochenziele
je Bereich, ein Verteil-Vorschlag, Schlaf- und Ruhezeit. Deutsch ist die Sprache von allem:
Oberfläche, Bezeichner, Kommentare, Commits. Live auf GitHub Pages:
`https://vebzyyhere.github.io/wochenplaner/` (Repo `VebzyyHere/wochenplaner`, Branch `main`).

## Die eine Datei

`index.html` **ist** das Produkt — 6046 Zeilen, ~261 KB, Vanilla JS, kein Build, kein npm,
kein Framework, kein Bundler. Sie läuft auch als heruntergeladene Einzeldatei über `file://`.

| Zeilen | Inhalt |
|---|---|
| 21–31 | Kopf-Skript: hängt Manifest und Icons **nur bei `http(s)`** ein — sonst drei vergebliche Abrufe in der Einzeldatei-Fassung |
| 32–1129 | `<style>`: Design-Tokens (OKLCH), Chrome bleibt achromatisch, die Farbe gehört den Bereichen |
| 1131–1250 | Markup: Topbar, Tagwechsler, Karten-Spalte, Raster, Tabbar, FAB |
| 1251–6044 | Hauptskript unter `"use strict"` |

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

Logik und Inhalt: `realtest.js` (Verteiler-Kennzahlen), `rt.js` (Wochenritual, Migration v7→v8),
`rt2.js` (Zusammenführen beim Abgleich), `frei.js` (freigehaltene Tage), `ob.js` (Erststart),
`tk.js` (Aufgabenblatt). Bedienung: `sicht.js`, `diag7.js`, `woche.js`, `tap2.js`, `wisch.js`,
`drag.js`, `grob3.js`, `funktion.js`.

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

1. `V` in `sw.js` hochzählen (aktuell `wp-v1.13`). Ohne das bleibt der Hinweis „Eine neue Fassung
   ist da" aus — die Seite selbst kommt zwar trotzdem frisch, weil der Worker network-first ist.
2. Commit im Repo-Stil: `vX.Y: Beschreibung`, **ohne Umlaute** („Pruefskripte", „ueberarbeitet").
3. Push auf `main`. Kein Workflow, kein Build — Pages liefert den Ordner direkt aus.

`werkzeug/README.md` verweist am Ende auf ein Projektdokument `sync-einrichten.md`. Das liegt
nicht im Repo — nicht danach suchen.

## Architektur

**Zustand.** Ein einziges `state`-Objekt, `version: 8`. `freshState()` (1498) legt es an,
`migrate()` (1522) bringt jeden fremden Stand darauf. Felder: `areas`, `blocks`, `tasks`, `days`,
`orte`/`wege`, `tombs`, `erledigt`, `rituale`. `Store` (1278) schreibt nach
`localStorage["wochenplaner.<scope>"]` — **ein Speicherplatz je Konto**, damit sich zwei Leute an
einem Rechner nicht überschreiben; Legacy-Schlüssel `wochenplaner.v1` wird einmal übernommen; ohne
`localStorage` (Vorschau-Frames) fällt er auf Arbeitsspeicher zurück und blendet ein Banner ein.

**Speichern.** `save()` (1739) → `stampChanges()` → `Store.save()` → `syncPush()`.
`snapshot()`/`recHash()` (1693 ff.) vergleichen den neuen Stand mit dem letzten: was sich geändert
hat, bekommt `at`, was verschwunden ist, landet als Grabstein in `state.tombs`. Deshalb wird
nirgends von Hand gestempelt. `undoLast()` hält den Stand vor der letzten Änderung.

**Rendern.** Kein Framework, kein virtuelles DOM. `renderAll()` (5927) ruft acht
`render*`-Funktionen. `setView()` (5638) schaltet am Handy zwischen den vier Ansichten
`plan` / `ziele` / `aufgaben` / `heute` (Tabbar, Markup 1224) — am Desktop stehen sie nebeneinander.

**Verteiler.** `buildSuggestions()` (2600) → `placeArea()` / `placeGrob()` / `growSuggestions()`.
Vorschläge sind normale Blöcke mit `sug: true` — dadurch lassen sie sich ziehen wie alles andere.
`wochenKapazitaet()` (2203) fragt *vor* dem Verteilen, ob die Woche das überhaupt hergibt;
`VERPLANT_GRENZE = 0.65`, Ampel grün ≤ 60 %, gelb ≤ 70 %, darüber rot (`ampelFarbe()` 2239).

**Abgleich.** `Sync` (5288) spricht Supabase direkt per `fetch`, **kein SDK**. Zugangsdaten stehen
bewusst im Klartext in `SUPABASE` (1269) — der anon key darf öffentlich sein, geschützt wird über
Row Level Security. `GET`/`POST /rest/v1/plans` (Spalte `data`, Header
`Prefer: resolution=merge-duplicates,return=minimal`), Session unter `wochenplaner.session`,
Push um 1,5 s entprellt, Status `off|signedout|syncing|ok|offline|error`.
`mergeStates()` (5213): pro Eintrag gewinnt die neuere Änderung, ein Grabstein zählt als Änderung.

**Service Worker.** `sw.js` ist bewusst **network-first** für eigene Adressen. Cache-first wäre
schneller, hat hier aber nach Veröffentlichungen tagelang die alte Fassung gezeigt. Fremde Adressen
(Supabase) werden nie angefasst — ein zwischengespeicherter Plan wäre schlimmer als kein Plan.

## Invarianten

- **`migrate()` ist die einzige Schema-Stelle.** Kumulativ und idempotent, läuft beim Laden, beim
  Import, nach dem Zusammenführen und beim Rückgängigmachen. Neues Feld → dort absichern,
  `s.version` am Ende mitziehen.
- **Nie `at` von Hand setzen, nie Grabsteine löschen.** Sonst kehren gelöschte Einträge beim
  nächsten Abgleich vom anderen Gerät zurück.
- **„Ersetzen" beim Import ist nicht harmlos** (`importData()` 5148): alles, was hier existiert und
  in der Sicherung fehlt, bekommt einen Grabstein — und den schiebt der Abgleich auf alle Geräte.
  Eine drei Monate alte Sicherung vom Handy hat so schon den Plan am PC gelöscht. Der Dialog mit
  „Zusammenführen" als Vorgabe bleibt.
- **Grobe Blöcke** (`b.grob`, mit `teil` + `dauer` statt Uhrzeit) dürfen in den Kennzahlen von
  `realtest.js` nicht mitzählen. Sie haben keine echte Uhrzeit und erscheinen sonst als „Übergang
  ohne Lücke" — dieser Messfehler hat einmal eine Verschlechterung vorgetäuscht, die es nicht gab.
- **Abhaken hängt am Paar Eintrag + Datum** (`hakenKey()` 2019), nicht an der Serie — sonst gilt ein
  wöchentlicher Eintrag in allen Wochen als erledigt.
- **Nutzertext geht über `innerHTML` in den DOM** → durch `escapeHtml()` (4204) schicken.
