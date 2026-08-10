# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

Wochenplaner — die Woche in **Stunden** statt nur in Terminen: feste Termine, Wochenziele
je Bereich, ein Verteil-Vorschlag, Schlaf- und Ruhezeit. Deutsch ist die Sprache von allem:
Oberfläche, Bezeichner, Kommentare, Commits. Live auf GitHub Pages:
`https://vebzyyhere.github.io/wochenplaner/` (Repo `VebzyyHere/wochenplaner`, Branch `main`).

## Die eine Datei

`index.html` **ist** das Produkt — 9886 Zeilen, ~476 KB, Vanilla JS, kein Build, kein npm,
kein Framework, kein Bundler. Sie läuft auch als heruntergeladene Einzeldatei über `file://`.
Die Zahlen und alle Zeilenangaben in diesem Dokument gelten für den Stand, an dem sie gemessen
wurden — die Datei wächst laufend. Immer per `grep -nE "^\s*/\* ={3,}" index.html` gegenprüfen,
das gibt die aktuelle Landkarte der Abschnittsbanner.

| Zeilen | Inhalt |
|---|---|
| 21–31 | Kopf-Skript: hängt Manifest und Icons **nur bei `http(s)`** ein — sonst drei vergebliche Abrufe in der Einzeldatei-Fassung |
| 32–1800 | `<style>`: Design-Tokens (OKLCH), Chrome bleibt achromatisch, die Farbe gehört den Bereichen |
| 1802–1930 | Markup: Topbar (inkl. `#monthBtn`), Tagwechsler, Karten-Spalte, Raster, Tabbar, FAB |
| 1932–9884 | Hauptskript unter `"use strict"` |

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
- `dev.js` — Gerätematrix (iPhone SE/13/14 Pro Max, iPad, iPad Pro); seit Stufe C zusätzlich: im
  Querformat bei geringer Höhe scrollt die Aufgabenliste als Ganzes, statt das Eingabefeld zu
  fixieren.
- `kontrast.js` — Design-Tokens im `<style>`-Block (fehlende Fallbacks, Hex-Werte außerhalb
  `:root`) und WCAG-Kontrast der Text/Hintergrund-Paare in Hell und Dunkel.
- `hover.js` — der Primärknopf im `:hover`-Zustand unter echtem Zeiger: die Kaskade muss
  wirklich die Primär-Hover-Regel liefern, nicht die gleich spezifische generische
  `.btn:hover`-Fläche; WCAG-Kontrast in Hell und Dunkel.

Als Git-Hook (Einrichtung: `werkzeug/hook-einrichten.md`) läuft vor jedem Commit `vorcommit.js`:
führt `check.js` und `kontrast.js` aus, bricht bei Rot ab. Das ersetzt nicht die volle Kette —
Pflicht vor dem eigentlichen Commit ist `node alles.js` aus `werkzeug/` heraus (siehe Verträge
unten); es sucht jedes `*.js` im Ordner neu, statt eine Liste zu pflegen, und startet die Server,
die einzelne Skripte brauchen, selbst.

Logik und Inhalt: `realtest.js` (Verteiler-Kennzahlen), `rt.js` (Wochenritual, Migration v7→v8),
`rt2.js` (Zusammenführen beim Abgleich), `frei.js` (freigehaltene Tage: Heute und Plan zeigen
„Bewusst frei" statt „Noch nichts geplant", kein „Vorschlagen"-Knopf dort), `ob.js` (Erststart),
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
53-Wochen-Jahre, die doppelt vorkommende Stunde beim Herbstwechsel), `freiwoche.js`
(das Frei-Gesicht des Wochen-Blatts: `#weekLabel` öffnet es, `freeGaps()` in sieben
aussprechbaren Zeilen statt eines Rasters; lokaler Wochen-Umschalter, Titel relativ zu heute —
seit der M-Runde ist es die Voreinstellung des zweigesichtigen Blatts, s. `wochenzeilen.js`),
`kapazitaet.js` (die Kapazität rechnet in der laufenden Woche ab jetzt; „Das wird eng"-Gate
an den drei klassischen Verteil-Einstiegen — Ziele, Heute-Leerzustand, Erststart — samt
„Nächste Woche planen"-Ausweg; den vierten Einstieg, das Monats-„+", prüft `monat.js`),
`grobstandard.js` (die Erholungs-Startbereiche a4–a6 planen ab Werk grob;
neue, selbst angelegte Bereiche weiterhin exakt), `zielfrage.js` (die verschmolzene
Wann-Frage der Ziele-Karte: Schnittmengen-Saat, kanonisches Trio beim Speichern samt
Fenster-Räumung, ehrlicher Konfliktfall, Chip-Fortbestand, Einmal-Umlegung als Summe+
Fenstertreue gemessen, Aufgaben-Fenster unberührt).

Bedienung: `sicht.js`, `diag7.js`, `woche.js`, `tap2.js`, `wisch.js`, `drag.js`, `grob3.js`,
`funktion.js`, `scroll.js` (Rasterposition je Tag), `agenda.js` (gestaffelter Falz-Vertrag,
Standardschrift, plus eigener Abschnitt für den Abend mit Tagesabschluss), `schrift.js`
(derselbe Vertrag bei vergrößerter Systemschrift, dort nur noch: Antwort bleibt sichtbar),
`fuss.js` (Stapelung von Tabbar, Vorschlagsleiste, FAB, Toast), `leiste.js` (Vorschlagsleiste
darf Karten-/Rasterinhalt nicht verdecken, und umgekehrt: ihr Polster darf die sichtbare
Rasterhöhe nicht schrumpfen; stehen Vorschläge an, behält nur „Übernehmen" den Akzent,
„Vorschlagen" weicht zurück; ihr Label bricht bei wenig Platz um, statt sich zu quetschen),
`dialog.js` (Barrierefreiheit der Dialoge), `doppeltipp.js` (der hastige Doppeltipp auf
„Woche anlegen": „Das wird eng" öffnet sich unter dem Finger — die Schonfrist in
`verteilenMitGate()` muss den zweiten Tipp folgenlos machen, statt ihn „Ziele anpassen"
oder den Scrim treffen zu lassen), `haken.js` (Abhaken
hängt am Paar Eintrag+Datum), `abbrechen.js` (Ziele-Editor stellt bei Abbrechen, Escape oder
Klick auf den Hintergrund nicht nur Chips zurück, sondern jedes getippte Feld — über eine
Sicherung von `a.plan`/`a.regeln` beim Öffnen), `vorschlagzeilen.js` (Vorschläge stehen als
Geisterzeilen in der Heute-Agenda: Einzel-Übernehmen/-Verwerfen über dieselben
`acceptOne()`/`dropOne()` wie im Raster, AA-Kontrast der gedämpften Zeile in Hell und Dunkel,
Tastaturweg, und das Leisten-Label springt zum frühesten Vorschlag), `blattzu.js` (die
Scrim-Schließwege verschlucken den Folge-Klick: erneuter Tipp auf den Auslöser toggelt sauber
zu, Tipp daneben öffnet nichts Fremdes, Escape bleibt schluckerfrei — echte Touch-Events,
15-Pro-Profil), `streifenwisch.js` (der wischbare Tagesstreifen: Tag vor/zurück mit nahtlosem
Wochenübergang über echte CDP-Touch-Gesten, Tap bleibt Tap, Formatwerte 393 px vs. byte-
identisches 320-px-SE), `monat.js` (die
Monatsübersicht: Kalenderraster mit KW-Rinne, Serienprojektion, Tages-/KW-Tipp,
„+"-Vorausplanen durchs Gate, Titel-Einzeiligkeit bei 320 px, Jahresgrenzen),
`wochenzeilen.js` (das zweigesichtige Wochen-Blatt: Frei/Belegt-Umschalter, Segmentleisten
mit exakt/grob/Vorschlag, Zeilen-Tipp in den Tag, Titel-Zoom in den Monat, Gesicht überlebt
den Zoom-Rundweg).

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

1. `V` in `sw.js` hochzählen (aktuell `wp-v1.24` — die nächste Veröffentlichung zählt von dort
   aus hoch, nicht von dieser Zahl). Ohne das bleibt der Hinweis „Eine neue Fassung
   ist da" aus — die Seite selbst kommt zwar trotzdem frisch, weil der Worker network-first ist.
2. Commit im Repo-Stil: `vX.Y: Beschreibung`, **ohne Umlaute** („Pruefskripte", „ueberarbeitet").
3. Push auf `main`. Kein Workflow, kein Build — Pages liefert den Ordner direkt aus.

`werkzeug/README.md` verweist am Ende auf ein Projektdokument `sync-einrichten.md`. Das liegt
nicht im Repo — nicht danach suchen.

## Architektur

**Zustand.** Ein einziges `state`-Objekt. `freshState()` (2227) legt es bei `version: 8` an,
`migrate()` (2258) läuft danach sofort und zieht jeden Stand — auch einen frischen — kumulativ auf
`version: 9`. Felder: `areas` (seit v9 zusätzlich optional `area.regeln`, s. Verteiler), `blocks`,
`tasks`, `days`, `orte`/`wege`, `tombs`, `erledigt`, `rituale`. Die Erholungs-Startbereiche
a4–a6 (Hobby, Freizeit & Pausen, Menschen) bekommen in `freshState()` `plan.grob = true` —
`defaultPlan()` selbst bleibt bei `false`, damit selbst angelegte Bereiche exakt starten
(Prüfung: `grobstandard.js`). `Store` (1959) schreibt nach
`localStorage["wochenplaner.<scope>"]` — **ein Speicherplatz je Konto**, damit sich zwei Leute an
einem Rechner nicht überschreiben; Legacy-Schlüssel `wochenplaner.v1` wird einmal übernommen; ohne
`localStorage` (Vorschau-Frames) fällt er auf Arbeitsspeicher zurück und blendet ein Banner ein.
`Store.backupVorV9()` (2021) sichert **einmalig** den unveränderten Stand, bevor `migrate()` ihn
zum ersten Mal auf `version: 9` zieht — eigener Schlüssel neben dem Zustand, deshalb außerhalb von
`snapshot()`/`mergeStates()` und nie mitsynchronisiert (Prüfung: `netz.js`).

**Speichern.** `save()` (2536) → `stampChanges()` → `Store.save()` → `syncPush()`.
`snapshot()`/`recHash()` (2496/2490) vergleichen den neuen Stand mit dem letzten: was sich geändert
hat, bekommt `at`, was verschwunden ist, landet als Grabstein in `state.tombs`. Deshalb wird
nirgends von Hand gestempelt. `undoLast()` hält den Stand vor der letzten Änderung.

**Rendern.** Kein Framework, kein virtuelles DOM. `renderAll()` (9740) ruft zehn
`render*`-Funktionen, darunter `renderAgenda()` (7104, trägt seit Stufe 13 auch den
Tagesabschluss ab Feierabend; seit der v1.22-Runde zusätzlich die Vorschläge des angezeigten
Tages als eigene „Vorschläge"-Sektion — Geisterzeilen mit Einzel-✓/× über dieselben
`acceptOne()`/`dropOne()` wie im Raster, `tagesAgenda()` bleibt davon unberührt; Hero-Label
und Listen-Label sind tagesabhängig: „Heute zählt"/„Danach" nur am heutigen Tag, sonst
„<Wochentag> zählt"/„Geplant") und `renderRitual()` (7721, Zugang zum Wochenritual). `setView()`
(9416) schaltet am Handy zwischen den vier Ansichten `plan` / `ziele` / `aufgaben` / `heute`
(Tabbar, Markup 1905) — am Desktop stehen sie nebeneinander. Der Tagesstreifen wischt seit der
15-Pro-Runde (`streifenwischenEinrichten()`, dieselben Schwellen wie das Inhalts-Wischen,
Wochenübergang über `tagWechseln()`; Prüfung: `streifenwisch.js`), und die Scrim-Schließwege
verschlucken den Folge-Klick des schließenden Tipps (`schluckeNaechstenClick()`; Prüfung:
`blattzu.js` — beide Fehlerklassen reproduzieren NUR unter echten Touch-Events).

**Das Wochen-Blatt.** `freizeitSheet(startMontag)` (2918), hinter `#weekLabel` im Kopf, hat
seit der M-Runde **zwei Gesichter** über einen Frei/Belegt-Umschalter (Modulvariable, kein
`state`-Feld): **„Frei"** (Voreinstellung) beantwortet „hast du diese Woche Zeit" in
aussprechbaren Zeitfenstern — gespeist aus `freeGaps()` (3946), derselben Lückenberechnung wie
beim Verteiler; `FREIZEIT_MIN = 30` (2832) blendet Kurzlücken aus. **„Belegt"** zeigt dieselbe
Woche als sieben Zeilen mit Segmentleiste (exakt gefüllt, grob gestrichelt, Vorschläge
gestrichelt-gedämpft) plus Klartextzeile; ein Zeilen-Tipp setzt `anchor`/`selectedDayIdx` und
springt in den Tag. Das Blatt hat einen lokalen ‹ ›-Wochen-Umschalter und einen Titel relativ
zu heute; der Titel ist ein Knopf und öffnet die Monatsübersicht im Monat der gezeigten Woche.
„vorbei"-Grau und „· heute" nur in der echten aktuellen Woche (Prüfung: `freiwoche.js` fürs
Frei-Gesicht, `wochenzeilen.js` für Belegt und den Zoom). Zum Widerspruch mit
`tagesAuslastung()` bei groben Blöcken siehe Invarianten.

**Monatsübersicht.** `monatSheet(startDatum)` (3256, mit `monatMontage()` 3222 und
`wochenBelegung()` 3241), hinter `#monthBtn` in der Topbar: Kalenderraster mit **KW-Rinne** —
Zellen tragen bewusst nur Tagesnummer, Auslastungsstrich, „freigehalten"-Ring und
„heute"-Kreis (eine ~40-px-Zelle kann keine Uhrzeit tragen, gemessen am verworfenen Prototyp
vom 2026-08-08). Tages-Tipp springt in den Tag; KW-Tipp öffnet für aktuelle/vergangene Wochen
das Wochen-Blatt, künftige Wochen tragen „+" und planen über `planeWoche(montag)` (4883, durchs
Gate — schloss die letzte Gate-Lücke von `planeNaechsteWoche()` 4898, heute ein Einzeiler).
**Zoom-Invariante: bloßes Zoomen/Blättern (Monat wie Wochen-Blatt) bewegt `anchor` nie** — nur
Tages-Tipp und „+"-Planen setzen ihn. (Prüfung: `monat.js`.)

**Verteiler.** `buildSuggestions()` (4540) → `placeArea()` / `placeGrob()` / `growSuggestions()`.
Vorschläge sind normale Blöcke mit `sug: true` — dadurch lassen sie sich ziehen wie alles andere.
Seit v9 kann ein Bereich zusätzlich `area.regeln` tragen (Fenster: erlaubte Wochentage/Uhrzeit;
Anker: Mindestabstand zu einem anderen Bereich) — der Verteiler prüft beides *vor* der
Platzierung, most-constrained-first (Prüfung: `regeln.js`). Seit der Editor-Verschmelzung
stellt die Ziele-Karte die Wann-Frage nur noch **einmal**: Saat = Schnittmenge aus
`plan.days`/`from`/`to` und einem etwaigen Alt-`fenster`; Speichern schreibt kanonisch ins
Trio und räumt `area.regeln.fenster` (Anker bleibt; ein zeitlich unvereinbares Alt-Fenster
wird als Konfliktzeile benannt statt gefaltet — Prinzip: Speichern schreibt exakt, was die
Karte zeigt). Aufgaben behalten ihr eigenes `task.regeln.fenster` (sie haben kein
`plan.days`). Prüfung: `zielfrage.js`. `wochenKapazitaet()` (3797) fragt
*vor* dem Verteilen, ob die Woche das überhaupt hergibt — und rechnet in der **laufenden**
Woche seit der v1.22-Runde **ab jetzt** (vergangene Tage zählen weder in `wach` noch in
`fest`, der laufende Block nur mit Restanteil; zukünftige und vergangene Wochen fallen im
selben Codepfad auf die Vollwochen-Rechnung zurück; Ampeltext dann „Rest der Woche zu X %").
Alle **vier** Verteil-Einstiege — Ziele-„Vorschlagen", Heute-Leerzustand, Erststart-Assistent,
Monats-„+" — laufen durch `verteilenMitGate()` (4908): bei `ok: false` erscheint „Das wird eng"
mit dem Ausweg „Nächste Woche planen" (`planeNaechsteWoche()` 4898, seit der M-Runde ein
Einzeiler über `planeWoche()` 4883; Prüfung: `kapazitaet.js`, für den Monats-Weg `monat.js`).
Das Gate-Blatt trägt eine 300-ms-Schonfrist (`pointer-events` am Scrim aus, echtes
`setTimeout`, bewusst ohne `Date.now()`): es öffnet sich synchron unter dem Finger,
und der zweite Tipp eines hastigen Doppeltipps traf sonst sofort „Ziele anpassen" oder
wischte das Blatt über den Scrim ungelesen weg. Klicks mit Trefferprüfung (Playwright)
warten die Frist von selbst ab — Bestandsskripte bleiben unverändert grün (Prüfung:
`doppeltipp.js`).
`VERPLANT_GRENZE = 0.65` (3796), Ampel
grün ≤ 60 %, gelb ≤ 70 %, darüber rot (`ampelFarbe()` 3863). Begründungen: der generische
Fallback (`GRUND_GENERISCH` 4234) erscheint auf Blöcken und Agenda-Zeilen **nicht** mehr
(`grundZumZeigen()` 4260) — nur die Blätter (`sugSheet`/`blockSheet`) zeigen ihn weiterhin;
das Datenfeld `b.grund` bleibt immer gesetzt (Prüfung: `erklaer.js`). `istSerie()` (3448,
`repeat === "weekly" || "2wochen"`) vereinheitlicht wöchentliche und zweiwöchentliche Termine
für Anzeige und Abhaken.

**Rest des Tages.** `restDesTagesBauen()` (4726), aufrufbar über den Knopf in „Heute"
(Sichtbarkeit über `restDesTagesMoeglich()` 4772), wendet denselben Verteiler wie das
Wochenziel-Verteilen an, nur auf den laufenden Tag beschränkt. Zwei rote Linien, teuer erarbeitet,
nicht versehentlich wieder aufweichen: auf einem freigehaltenen Tag schlägt auch dieser Weg nichts
vor (`istFrei()`); und ein bereits vergangener eigener Vorschlag von heute wird nicht mehr
angefasst — seit Stufe 16 sorgt dafür `growSuggestions()` selbst (kennt „jetzt", verlängert kein
Ende, das schon erreicht oder überschritten ist), die frühere lokale Sicherung/Rückschreibung
(`vergangeneSnapshot`) ist damit entfallen.

**Wochenritual.** `ritualSheet()` (7748) führt am Montag durch drei Schritte —
`schrittRueckblick()` (7774, geplant gegen tatsächlich je Bereich mit Wochenziel, Angebot zur
Zielanpassung über `rueckblickMuster()` 8138), Ziele, Verteilen. Schritt 3 nennt bei
`wochenKapazitaet().ok === false` den wahren Grund („Der Rest passt nicht mehr in diese
Woche.") und bietet „Nächste Woche planen" an — das Blatt schließt vor dem Wochenwechsel, weil
seine Schritte 1/2 an beim Öffnen eingefrorenen Wochenwerten hängen. `renderRitual()` (7721)
zeigt die Fälligkeit über `ritualFaellig()`/`ritualErledigt()` an.

**Abgleich.** `Sync` (8973) spricht Supabase direkt per `fetch`, **kein SDK**. Zugangsdaten stehen
bewusst im Klartext in `SUPABASE` (1950) — der anon key darf öffentlich sein, geschützt wird über
Row Level Security. `GET`/`POST /rest/v1/plans` (Spalte `data`, Header
`Prefer: resolution=merge-duplicates,return=minimal`), Session unter `wochenplaner.session`,
Push um 1,5 s entprellt, Status `off|signedout|syncing|ok|offline|error`.
`mergeStates()` (8891): pro Eintrag gewinnt die neuere Änderung, ein Grabstein zählt als Änderung.

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
- **„Ersetzen" beim Import ist nicht harmlos** (`importData()` 8803): alles, was hier existiert und
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
- **`freeGaps()` und `tagesAuslastung()` widersprechen sich bei groben Blöcken — beide zu Recht,
  nicht anfassen.** `freeGaps()` (3946) blendet grobe Blöcke aus, weil sie keine Uhrzeit haben, die
  es aussparen könnte; `tagesAuslastung()` (3141) zählt dieselben Blöcke trotzdem mit, weil ihre
  Dauer real verplante Zeit ist, nur ihre Uhrzeit nicht. Das Frei-Gesicht des Wochen-Blatts
  (`freizeitSheet()`, 2918) macht diesen Unterschied absichtlich sichtbar, statt ihn aufzulösen: hinter den echten
  Zeitfenstern nennt sie zusätzlich, was an groben Blöcken an dem Tag noch offen liegt, ohne ihm
  eine erfundene Uhrzeit anzudichten. Wer hier „aufräumt" und eine der beiden Funktionen an die
  andere anpasst, macht die jeweils andere falsch.
- **Abhaken hängt am Paar Eintrag + Datum** (`hakenKey()` 3594, nutzt `istSerie()` 3448), nicht an
  der Serie — sonst gilt ein wöchentlicher oder zweiwöchentlicher Eintrag in allen Wochen als
  erledigt.
- **Neue Felder gehören auf `area`, `task` oder `block` — nie an die `state`-Wurzel und nie in
  `area.plan`.**
- **Nutzertext geht über `innerHTML` in den DOM** → durch `escapeHtml()` (7665) schicken.
- **`renderEnergy()` (7445) schreibt ungeschützt in statisches Markup** (`#energyDay`, `#energyHint`,
  `#dayFrei`, `#dayFreiLab`). Wer die Karte `data-card="heute"` ersetzt statt ergänzt, lässt
  `renderAll()` mit einem `TypeError` abbrechen.
- **`growSuggestions()` kennt seit Stufe 16 „jetzt".** War bekannt, bewusst nicht behoben, solange
  nur `restDesTagesBauen()` betroffen war (dort lokal umgangen über `vergangeneSnapshot`) — betraf
  aber auch den wöchentlichen Verteiler, weil `clearSuggestions(warm)` (4605) den laufenden Tag
  bewusst unberührt lässt. Jetzt verlängert `growSuggestions()` an keinem eigenen Vorschlag von
  heute mehr ein Ende, das schon erreicht oder überschritten ist; ein gerade laufender Block
  (start ≤ jetzt < end) wächst unverändert weiter.
- **Bloßes Zoomen und Blättern bewegt `anchor` nie.** Monatsblatt und Wochen-Blatt arbeiten auf
  lokalem Zustand; nur ein Tages-Tipp (Monat oder Belegt-Zeile) und das „+"-Planen setzen
  `anchor`/`selectedDayIdx`. Wer einem Blatt einen Weg hinzufügt, der `anchor` nebenbei
  verschiebt, bricht die Rückkehr-Erwartung des Zooms (Prüfung: `monat.js`, `wochenzeilen.js`).

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
- **Verdeckung nie an einem unscrollten Screenshot beurteilen.** Der Vertrag ist, dass Inhalt nach
  dem Scrollen *erreichbar* sein muss — nicht, dass er ohne Scrollen sichtbar ist. In dieser
  Sitzung haben deshalb zweimal Agenten einen Fehler gemeldet, den es nicht gab.
- **Eine Messung von Bounding-Boxen zeigt kein Überlappen, wenn Text über seinen eigenen Rand
  hinausläuft und von einem später gezeichneten Element verdeckt wird.** Genau dieser Fall ist bei
  der Vorschlagsleiste aufgetreten (150 % Systemschrift, iPhone SE, `leiste.js`) und hat eine
  vorschnelle Widerlegung erzeugt.
- **Alle zeitkritischen Prüfskripte nageln Uhrzeit, Datum und Zeitzone fest**
  (`page.clock.setFixedTime`, `timezoneId: 'Europe/Berlin'`). Diese Fehlerklasse — ein Skript, das
  je nach Startzeitpunkt grün oder rot wird und dadurch falsches Vertrauen erzeugt — hat in diesem
  Projekt schon **sechsmal** zugeschlagen. Ein neues zeitkritisches Prüfskript ohne feste Uhr wird
  nicht abgenommen. Das Zeit-Literal in `setFixedTime` muss dabei **zoniert** angegeben werden
  (z. B. `'2026-08-05T10:00:00+02:00'`) — eine Uhrzeit ohne Zonen-Endung nimmt die Prozesszone der
  jeweils ausführenden Maschine an und wird dadurch selbst wieder zu einer ungenagelten Uhr.
  Die sechste Ausprägung kam von der anderen Seite: **eine Produktänderung kann Bestandsskripte
  rückwirkend zeitkritisch machen.** Als der Erststart das Kapazitäts-Gate bekam (v1.22-Runde),
  wurden acht Skripte rot bzw. kalendertagabhängig, die bis dahin gefahrlos ohne Uhr durch den
  Assistenten klickten. Wer einen neuen zeit- oder zustandsabhängigen Dialog in einen Weg
  einbaut, den Prüfskripte betreten, prüft danach alle Skripte auf diesem Weg — nicht nur die
  neuen.
- **Commit nur bei grüner Kette:** vorher `node alles.js` aus `werkzeug/` heraus laufen lassen.
- **Screenshots werden angesehen, nicht nur gemessen.** Fünf echte Befunde dieses Projekts hat
  keine einzige Messung gefunden, nur der Blick aufs Bild.
