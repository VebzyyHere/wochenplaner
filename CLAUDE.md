# CLAUDE.md

## Projekt

Wochenplaner — die Woche in **Stunden** statt nur in Terminen: feste Termine, Wochenziele je
Bereich, ein Verteil-Vorschlag, Schlaf- und Ruhezeit. Owner: Sunny. Live auf GitHub Pages:
`https://vebzyyhere.github.io/wochenplaner/` (Repo `VebzyyHere/wochenplaner`, Branch `main`).
UI-Texte, Kommentare und Commits auf Deutsch; Bezeichner folgen dem Umfeld.

## Die eine Datei

`index.html` **ist** das Produkt: Stil, Markup und Hauptskript in einer Datei. Default: eine
HTML-Datei ohne Build, weil sie offline und per `file://` laufen soll (Sunnys README seit v1.4).
Build, Framework oder externe Assets (z. B. Webfont) sind eine bewusste Entscheidung mit Sunny —
deshalb steckt die runde Schrift als Base64-`@font-face` am Anfang des `<style>`-Blocks.

- Landkarte: `grep -nE "^\s*/\* ={3,}" index.html`. Die Datei ist groß — nur mit `offset`/`limit`
  lesen. Viele Abschnittsbanner erklären, *warum* etwas so ist — vor dem Ändern lesen.
- Daneben: `sw.js`, `manifest.json`, vier Icon-PNGs (`werkzeug/icon.py`, Python + Pillow, hier
  nicht installiert), `werkzeug/` (Prüfskripte), `release/` (Notizen je Fassung, lokale Vorschau
  `node release/preview.cjs`). Release-Verlauf v1.27–v1.41: `RELEASES.md`.

## Befehle und Prüfkette

Nichts zu bauen — entwickeln heißt Datei im Browser öffnen. Geprüft wird mit Playwright in
`werkzeug/`; was jedes Skript prüft, steht in `werkzeug/README.md`. Einrichten einmal je Klon
(`package.json`/`node_modules` sind gitignored; vorhandenes Chrome: `$env:WP_CHROMIUM = "..."`):
`cd werkzeug && npm init -y && npm install --save-dev playwright && npx playwright install chromium`

- Schnellprüfung bei UI-Änderungen (Default, ~1 min): `node check.js && node audit.js && node dev.js`.
- Volle Kette: `node alles.js` aus `werkzeug/` (`--nur <name>` filtert). Findet jedes `*.js` und
  startet `mockserver.js`/`serve.js` selbst; rot **oder** übersprungen ergibt Exit 1.
- `werkzeug/README.md` ist beim Exit-Code veraltet: `alles.js` endet auch bei übersprungenen Server-Tests mit 1.
- **Commit und Push nur bei grüner `node alles.js`.** Optionaler Hook: `werkzeug/hook-einrichten.md`.
- `test3.js` läuft gegen `mockserver.js` (Supabase-Nachbau) — die echte DB wird nie angefasst. Ein
  Service Worker läuft nicht über `file://`, deshalb laufen `pwatest.js`/`pwaupd.js` über `serve.js`.
- `pwaupd.js` schreibt `sw.js`/`index.html` kurz um (`V` mit `-test`, Titel „Wochenplaner NEU") und
  am Ende den Stand von **seinem Start** zurück: während `alles.js` läuft, `index.html` nicht
  bearbeiten (Zwischenänderungen gehen still verloren); bricht es ab, zuerst `git status` ansehen.
- Erwartete Falschmeldungen: `audit.js` sieht die `::before`-Trefferflächen von Häkchen und
  Farbfeldern nicht; `test3.js` zeigt drei Konsolenfehler (Favicon, falsches Passwort, Offline-Test).
- Safe-Areas in Tests nie nachträglich per Inline-Stil setzen — die App misst ihren Fuß beim Laden,
  spätere Werte erzeugen Scheinfehler (verdeckte Tab-Symbole).
- Test-Anker: das erste `.agenda__label` heißt am heutigen Tag wörtlich „Heute zählt"; im Tagesband
  zählen Tests nur die sieben `.is-woche`-Tage; Tab-Schleifen nutzen `#tabbar button[data-view]`
  (`#tabAdd` ist kein Tab); Desktop-Tests öffnen vor Klicks/Ziehen auf Aufgaben den Aufgabenbereich.

## Architektur

**Zustand.** Ein `state`-Objekt; `freshState()` legt es bei `version: 8` an, `migrate()` zieht jeden
Stand kumulativ auf `version: 10`. `save()` → `stampChanges()` (vergleicht per `snapshot()`/`recHash()`:
Geändertes bekommt `at`, Verschwundenes wird Grabstein in `state.tombs`) → `Store.save()` →
`syncPush()`; `undoLast()` hält den Stand davor. Startbereiche a4–a6 bekommen in `freshState()`
`plan.grob = true`, `defaultPlan()` bleibt `false` — selbst angelegte Bereiche starten exakt.
`Store` schreibt je Konto nach `localStorage["wochenplaner.<scope>"]` (zwei Leute an einem Rechner
überschreiben sich nicht), übernimmt den Altschlüssel `wochenplaner.v1` einmal und hält ohne
`localStorage` nur im Arbeitsspeicher (Banner „Speichern nicht möglich"). `Store.backupVorV9()`
sichert einmalig den Stand vor der v9-Migration — eigener Schlüssel, außerhalb von
`snapshot()`/`mergeStates()`, nie synchronisiert (`netz.js`).

**Rendern.** Geisterzeilen (Vorschläge) in `renderAgenda()` nutzen dieselben `acceptOne()`/`dropOne()`
wie das Raster; `tagesAgenda()` bleibt davon unberührt. „Heute zählt"/„Danach" nur am heutigen Tag,
sonst „<Wochentag> zählt"/„Geplant". `renderTasks()` gliedert in „Ohne Platz", „Vorgeschlagen",
„Eingeplant", „Andere Wochen" und „Erledigt"; im Fuß zählen nur bestätigte Termine der gezeigten
Woche. `setView()` setzt nur Ansichtsstatus: am Handy `plan`/`ziele`/`aufgaben`/`heute` (Tab „Woche"
ist `data-view="plan"`), am Desktop den Arbeitsbereich neben dem Raster (`body.dataset.panel`).
`ansichtWechseln(v)` ist `setView(v)` plus Überblendung, nur für Nutzerwege; Tests und Code rufen
`setView()`. Tagesband `renderDaySwitch()`: natives Scrollen; Ziehen bewegt `anchor` nie.
Scrim-Schließwege verschlucken den Folge-Klick (`schluckeNaechstenClick()`); diese Fehlerklasse
reproduziert nur unter echten Touch-Events (`blattzu.js`).

**Blätter.** Das Wochen-Blatt `freizeitSheet()` (`#weekLabel`) hält seinen Frei/Belegt-Umschalter in
einer Modulvariable, nicht in `state`; „Frei" nennt Zeitfenster aus `freeGaps()`, derselben
Lückenrechnung wie der Verteiler. Monatszellen (`monatSheet()`) tragen bewusst nur Tagesnummer,
Auslastungsstrich, „freigehalten"-Ring und „heute"-Kreis — eine ~40-px-Zelle trägt keine Uhrzeit.

**Verteiler.** `buildSuggestions()` → `placeArea()`/`placeGrob()`/`growSuggestions()`; Vorschläge
sind normale Blöcke mit `sug: true`. `area.regeln` (Fenster: Tage/Uhrzeit; Anker: Abstand zu einem
anderen Bereich) wird *vor* der Platzierung geprüft, most-constrained-first (`regeln.js`).
- Wann-Frage der Ziele-Karte: Saat = Schnittmenge aus `plan.days`/`from`/`to` und Alt-`fenster`.
  Speichern schreibt exakt, was die Karte zeigt (Trio; räumt `area.regeln.fenster`, Anker bleibt);
  ein unvereinbares Alt-Fenster wird als Konfliktzeile benannt, nie still aufgeweitet (`zielfrage.js`).
- `wochenKapazitaet()` rechnet in der laufenden Woche **ab jetzt** (vergangene Tage zählen weder in
  `wach` noch in `fest`, der laufende Block nur mit Rest). `VERPLANT_GRENZE = 0.65`; Ampel
  `ampelFarbe()`: grün ≤ 60 %, gelb ≤ 70 %, sonst rot.
- Alle vier Verteil-Einstiege (Ziele, Heute-Leerzustand, Erststart, Monats-„+") laufen durch
  `verteilenMitGate()` („Das wird eng", Ausweg „Nächste Woche planen"); dessen Blatt hat 300 ms
  Schonfrist gegen den Doppeltipp (Scrim ohne `pointer-events`, echtes `setTimeout`, kein `Date.now()`).
- `b.grund` ist immer gesetzt; den generischen Fallback `GRUND_GENERISCH` zeigen nur die Blätter,
  nicht Blöcke und Agenda-Zeilen (`grundZumZeigen()`).
- Serien (`istSerie()`): `b.ausnahmen` wird nur in `onDay()` geprüft und wirkt so überall; der
  `erledigt`-Schlüssel eines ausgelassenen Datums bleibt bewusst verwaist (Löschen ohne Grabstein
  käme per Sync zurück).

**Rest des Tages** (`restDesTagesBauen()`, derselbe Verteiler nur für heute) — zwei rote Linien: auf
einem freigehaltenen Tag (`istFrei()`) kein Vorschlag; ein vergangener eigener Vorschlag von heute
bleibt unangetastet — `growSuggestions()` verlängert kein schon erreichtes Ende (ein laufender Block
wächst weiter); nötig, weil `clearSuggestions(warm)` den laufenden Tag nie umplant (`restdestag.js`).

**Wochenritual.** `ritualSheet()` (Rückblick, Ziele, Verteilen) schließt vor einem Wochenwechsel
(„Nächste Woche planen"), weil seine ersten Schritte an beim Öffnen eingefrorenen Werten hängen.

**Abgleich.** `Sync` spricht Supabase direkt per `fetch` (kein SDK): `GET`/`POST /rest/v1/plans`
(Spalte `data`, Header `Prefer: resolution=merge-duplicates,return=minimal`), Session unter
`wochenplaner.session`, Push um 1,5 s entprellt, Status `off|signedout|syncing|ok|offline|error`.
Die Zugangsdaten in `SUPABASE` stehen bewusst im Klartext: der anon key darf öffentlich sein,
geschützt wird über Row Level Security. `mergeStates()`: pro Eintrag gewinnt die neuere Änderung,
ein Grabstein zählt als Änderung.

**Service Worker.** `sw.js` ist bewusst **network-first** für eigene Adressen — cache-first zeigte
nach Veröffentlichungen tagelang die alte Fassung. Fremde Adressen (Supabase) nie anfassen: ein
zwischengespeicherter Plan wäre schlimmer als keiner. `manifest.json`: `id` bleibt absolut
(`/wochenplaner/`) — relativ löst es gegen die Origin auf, die installierte App wäre verwaist.

## Invarianten

- **`migrate()` ist die einzige Schema-Stelle** — kumulativ, idempotent; läuft bei Laden, Import,
  Zusammenführen und Rückgängigmachen. Neues Feld → dort absichern, `s.version` am Ende mitziehen.
- **Nie `at` von Hand setzen, nie Grabsteine löschen** — sonst kehren gelöschte Einträge beim
  nächsten Abgleich vom anderen Gerät zurück.
- **Neue Felder gehören auf `area`, `task` oder `block`** — nie an die `state`-Wurzel, nie in
  `area.plan`: `mergeStates()` gleicht nur benannte Sammlungen ab, und `migrate()` baut `a.plan`
  Feld für Feld neu auf (so ging `plan.grob` einmal bei jedem Laden verloren).
- **„Ersetzen" beim Import ist nicht harmlos** (`importData()`, einziger Weg für fremde Daten): was
  hier existiert und in der Sicherung fehlt, bekommt einen Grabstein, den der Abgleich auf alle
  Geräte schiebt (so löschte eine alte Handy-Sicherung den Plan am PC). „Zusammenführen" bleibt
  Vorgabe; kaputte Dateien (auch ein blankes Array) enden vor `migrate()` als Toast (`importfuzz.js`).
- **Nutzertext über `innerHTML`** → durch `escapeHtml()` schicken.
- **`renderEnergy()` schreibt ungeschützt in statisches Markup** (`#energyDay`, `#energyHint`,
  `#dayFrei`, `#dayFreiLab`): wer die Karte `data-card="heute"` ersetzt statt ergänzt, lässt
  `renderAll()` mit einem `TypeError` abbrechen.
- **Abhaken hängt am Paar Eintrag + Datum** (`hakenKey()`), nicht an der Serie — sonst gilt ein
  wöchentlicher oder zweiwöchentlicher Eintrag in allen Wochen als erledigt.
- **`freeGaps()` und `tagesAuslastung()` widersprechen sich bei groben Blöcken — beide zu Recht,
  nicht anfassen.** `freeGaps()` blendet sie aus (keine Uhrzeit zum Aussparen), `tagesAuslastung()`
  zählt ihre Dauer (real verplante Zeit); das Frei-Gesicht zeigt den Unterschied absichtlich.
- **Grobe Blöcke** (`b.grob`: `teil` + `dauer` statt Uhrzeit) zählen in den `realtest.js`-Kennzahlen
  nicht mit — sonst erscheinen sie als „Übergang ohne Lücke" und täuschen eine Verschlechterung vor.
- **Bloßes Zoomen und Blättern bewegt `anchor` nie.** Monat und Wochen-Blatt arbeiten auf lokalem
  Zustand; nur ein Tages-Tipp (Monat, Belegt-Zeile, Tagesband) und das „+"-Planen setzen
  `anchor`/`selectedDayIdx` — sonst bricht die Rückkehr des Zooms (`monat.js`, `wochenzeilen.js`).

## Kopplungen & Fallen

- `MOBILE_Q` (JS) und das CSS wechseln gemeinsam bei **1100px**, `EINTAG_Q` bleibt bei 640px
  (Tablets zeigen sieben Tage); `QUER_Q` und das gleichlautende CSS nur gemeinsam ändern.
- Quer (`QUER_Q`): `fussbereichMessen()` setzt `--fussleiste` = Safe-Area unten (`sicherUnten()`),
  nicht die Tabbar-Höhe (die Tabbar ist dort eine senkrechte Leiste). Ab 700px Breite (`SUG_OBEN_Q`)
  hängt `sugbarPlatzieren()` `#sugBar` in die `.topbar` und beim Drehen zurück; dann zählt sie
  nicht zu `--fuss-oben`.
- Telefon (≤ 1100px): `.kopf` ist `position: fixed` — WebKits Randabtaster zählt nur feste oder
  klebende Elemente. `.panel`/`.planwrap` beginnen per `--kopf-h` darunter; jede eigene
  `.panel`-Polsterung (Tablet-Regel!) muss `--kopf-h` einrechnen. Klebende Blocktitel stehen bei
  `top: var(--kopf)` (gemessen in `renderGrid()`), auch in der 1100px-Regel nie ein fester Pixelwert.
- `--safe-top/right/bottom/left` übernehmen die Plattform-Insets; App, schwebende Leiste und Dialoge
  beachten auch die seitlichen. Speicherwarnungen (`#banner`) stehen im `.kopf` und zählen in
  `--kopf-h` mit, damit sie die Navigation nicht verdrängen.
- iOS installiert: `applyTheme()` meldet `--kopf-flach` als `theme-color`, `html[data-app="1"] .kopf`
  ist deckend in genau dieser Farbe — beide nur gemeinsam ändern, kein `black-translucent`. Danach
  das Home-Bildschirm-Symbol neu anlegen (iOS speichert die Werte mit dem Symbol).
- Glas (`--glas*`, beide Themes) nur unter `@supports (backdrop-filter)`; ohne Unterstützung und bei
  `prefers-reduced-transparency` fallen `.kopf`/`.tabbar`/`.sugbar` auf `--surface` zurück.
- Desktop (ab 1101px): Arbeitsfläche `.main > .panel` = `clamp(352px, 29vw, 440px)`; alle
  Kalenderspalten passen daneben, Titel werden gekürzt.
- Eine `tagesAuslastung()` speist Tagesband-Balken, Monat und Desktop-Wochenkopf (`.dayhead`).
- UI-Haken laufen über `abhaken(b, dayKey, on, el)`, nicht direkt über `setzeErledigt()`; Wischen
  nach rechts (nur Touch) hakt per synthetischem `change` am `.agenda__check` ab — dieselbe Kette
  wie ein Tipp. Nach links öffnet es `moveSheet()` und speichert nichts. Nach langem Drücken oder
  Wischen verschluckt ein gemeinsamer Klick-Handler den Folge-Klick (sonst schaltete er den Haken um).
- `#tabAdd` („+" der Tabbar) ruft `#fabAdd.onclick` und ignoriert Tipps 450 ms nach `closeModal()`
  (`zuletztGeschlossen`) — Schutz gegen den hastigen Doppeltipp auf Fußknöpfe eines Blatts.
- Aufgabe ↔ Termin: maßgeblich ist `task.geplant`. `aufgabeAbhaken()` schreibt beide gemeinsam;
  alte Doppel-Termine bleiben erhalten, `migrate()` entfernt nur nichtkanonische Verweise.
- Tastenkürzel stehen genau einmal in `TASTENKUERZEL` (Hilfe `kuerzelSheet()`), direkt nach dem keydown-Handler.
- Nur lesend, nie `save()`: Kalender-Export `kalenderIcs()` (nur Blöcke mit Uhrzeit, ohne `sug`;
  Serien als RRULE, `b.ausnahmen` als EXDATE, schwebende Ortszeit) und die Wochenkarte
  `wochenkarteZeichnen()`/`wochenkarteSheet()` (`navigator.share` mit Datei, sonst Download).

## Verträge

- **Gestaffelte Falz — drei Situationen, drei Verträge, nur bewusst mit Sunny ändern.**
  Standardschrift: die Agenda passt ohne Scrollen über die Tabbar (`agenda.js`); vergrößerte
  Systemschrift: nur die Antwort bleibt ohne Scrollen sichtbar (`schrift.js`); Abend mit
  Tagesabschluss: eigener Vertrag mit festgenagelter 23-Uhr-Uhr (`agenda.js`, Abschnitt h). Die Falz
  hält knapp (~2 px): Agenda-Abstände und Tabbar-Höhe nicht vergrößern; ein Gruß über 22 Zeichen
  setzt `.agenda__kopfzeile.is-lang` und rückt die Agenda am Telefon enger.
- **Feste Uhr.** Zeitkritische Prüfskripte nageln Uhrzeit, Datum und Zeitzone fest
  (`page.clock.setFixedTime` mit zoniertem Literal wie `'2026-08-05T10:00:00+02:00'`,
  `timezoneId: 'Europe/Berlin'`; ohne Zonen-Endung gilt die Prozesszone der Maschine). Ein neues
  zeitkritisches Skript ohne feste Uhr wird nicht abgenommen. Wer einen zeit- oder zustandsabhängigen
  Dialog in einen Weg einbaut, den Prüfskripte betreten, prüft danach alle Skripte auf diesem Weg.
- **Visuelle Prüfung.** Screenshots ansehen, nicht nur messen. Verdeckung nie am unscrollten Bild
  beurteilen (Vertrag: nach Scrollen erreichbar). Bounding-Boxen zeigen kein Überlappen, wenn Text
  über seinen Rand läuft und von einem später gezeichneten Element verdeckt wird.
- Optional: Impeccable-Detektor (Plugin `impeccable`, falls installiert); side-tab an
  `.agenda__hero`/`.agenda__row`/`.block` ist gewollt (Kante = Bereichsfarbe).

## Produktentscheidungen (Sunny)

- „Frisch & verspielt" (2026-09-26, Zielgruppe 20–30): `--font-display` (`ui-rounded`) für Zahlen
  und Titel, keine `text-transform: uppercase`-Etiketten außer Wochentags-Kürzeln, runde Haken.
- Look „Moos & Papier" (seit v1.36): Stilschicht am Ende des `<style>`-Blocks (Banner „v1.36"),
  Tokens `--lime`/`--on-lime`/`--tief`. Bereichsfarben behalten ihre inhaltliche Bedeutung.
- `gruss()`-Texte sind Sunnys Wortlaut — nicht umformulieren. Keine sichtbaren Versionsnummern im Produkt.
- „Passt das noch?" (`zusageDurchspielen()`/`zusageSheet()`) rechnet nur durch und öffnet höchstens
  `blockSheet()` vorausgefüllt — nie still speichern. Keine Rangfolge der Ziele erfinden.
- Feiern beim Abhaken (`jubel()`): `gefeiert` gilt nur für die Sitzung, nie in `state`; kein
  Konfetti beim Aufheben und bei reduzierter Bewegung.

## Veröffentlichen

Push auf `main` ist der Deploy (Pages liefert den Ordner direkt aus, kein Workflow). Veröffentlicht
wird nur auf Sunnys Wort oder wenn sein Auftrag ausdrücklich selbständiges Deployen erlaubt
(„deploye selbständig"). Neue sichtbare Texte vorher im Chat zeigen.

1. `V` in `sw.js` hochzählen (aktueller Wert: `sw.js`). Ohne das bleibt „Eine neue Fassung ist da"
   aus; die Seite selbst kommt trotzdem frisch, weil der Worker network-first ist.
2. Commit im Repo-Stil `vX.Y: Beschreibung`, **ohne Umlaute** („Pruefskripte", „ueberarbeitet").
3. Push auf `main`.
