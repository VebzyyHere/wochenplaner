# Werkzeug

Prüfskripte für den Wochenplaner. Sie starten einen echten Browser, laden
`../index.html` und messen nach — deshalb steht in den Projektnotizen „gemessen",
nicht „geschätzt".

Vier von fünf Layoutfehlern in v1.12 hat `audit.js` gefunden, nicht das Auge.
Wer an der Oberfläche etwas ändert, lässt danach `check.js`, `audit.js` und
`dev.js` laufen — das dauert eine Minute.

## Einrichten

```bash
cd werkzeug
npm init -y
npm install --save-dev playwright
npx playwright install chromium
```

Liegt ein Chromium schon woanders (z.B. in einer Cloud-Umgebung), kann man ihn
angeben, statt einen zweiten herunterzuladen:

```bash
export WP_CHROMIUM=/pfad/zu/chromium     # Windows: $env:WP_CHROMIUM = "..."
```

Ohne die Variable nimmt Playwright seinen eigenen.

## Nach jeder Änderung

| Skript | prüft |
|---|---|
| `node check.js` | JavaScript-Syntax beider Script-Blöcke. Zwei Sekunden, fängt Tippfehler ab, bevor der Browser startet |
| `node audit.js` | **Der wichtigste.** Geht auf einem iPhone SE (320 × 568) durch alle vier Ansichten und siebzehn Dialoge. Meldet: Trefferflächen unter 44 px, waagerechtes Scrollen, abgeschnittenen Text, Dialogfüße außerhalb des Bildes. Legt zu jedem Schritt ein Bild `au-*.png` ab |
| `node dev.js` | Gerätematrix (iPhone SE/13/14 Pro Max, iPad, iPad Pro): zu kleine Ziele, Rasterhöhe |
| `node kontrast.js` | Design-Tokens im `<style>`-Block: fehlende Fallbacks (`var(--x, ...)`), Hex-Werte außerhalb `:root`, WCAG-Kontrast der Text-auf-Hintergrund-Paare in Hell und Dunkel. Exit-Code 1 bei Fehlern |
| `node hover.js` | Der Primärknopf unter echtem Zeiger: die Kaskade muss im `:hover`-Zustand wirklich die Primär-Regel liefern, nicht die gleich spezifische generische `.btn:hover`-Fläche — WCAG-Kontrast von Schrift auf Hintergrund an einer Sonde `.btn.btn--primary`, Hell und Dunkel. Exit-Code 1 bei Fehlern |

Falsch-positive Meldungen in `audit.js`: Häkchen und Farbfelder sind bewusst
klein und haben ihre Trefferfläche über ein unsichtbares `::before`. Das Skript
sieht Pseudo-Elemente nicht. Alles andere ist echt.

Vor jedem Commit läuft `node vorcommit.js`: führt `check.js` und `kontrast.js`
aus, bricht bei Rot ab — bewusst nur diese zwei, die Playwright-Skripte
brauchen einen Browser und sind für einen Hook zu langsam. Einrichtung als
Git-Hook: `hook-einrichten.md`.

## Alles auf einmal

```bash
node alles.js              # jedes *.js in diesem Ordner, außer sich selbst,
                            # mockserver.js und serve.js (die laufen endlos)
node alles.js --nur audit  # nur Skripte, deren Name "audit" enthält
```

Sucht die Skripte bei jedem Lauf neu im Ordner, statt eine Liste zu pflegen,
die beim nächsten neuen Prüfskript sowieso veraltet wäre. Führt sie nacheinander
aus, zeigt bei Rot sofort die volle Ausgabe des betroffenen Skripts, und druckt
am Ende eine Tabelle mit Skript, Ampel (grün/rot/übersprungen) und Dauer.
Skripte, die einen eigenen Server brauchen (`test3.js` → `mockserver.js`,
`pwatest.js`/`pwaupd.js` → `serve.js`), startet `alles.js` diesen Server selbst
und wartet auf Bereitschaft — von Hand ist dafür nichts mehr nötig. Schlägt
der Start fehl (Port belegt), laufen die betroffenen Skripte nicht mit und
erscheinen als "übersprungen" statt rot; der Exit-Code bleibt dann trotzdem 0.

## Oberfläche und Bedienung

| Skript | prüft |
|---|---|
| `node sicht.js` | Bilder von allen vier Ansichten auf iPhone SE und 13, hell, dunkel und quer (`s-*.png`) |
| `node diag7.js` | Wie viele Stunden vom Tag sichtbar sind, je Gerät. Zeigt die Aufteilung Kopfzeile / Tagwechsler / Raster / Band / Leiste |
| `node woche.js` | Der Auslastungsbalken im Tagwechsler: Füllung je Tag, Warnfarbe über der Marke, bewegt sich beim Verteilen |
| `node tap2.js` | Tippen gegen Wischen mit echten Touch-Ereignissen, dazu (seit Stufe 8) langer Druck zum Verschieben um ein Raster und ein per CDP simulierter echter Scrollversuch auf `.block__resize` |
| `node wisch.js` | Tageswechsel per Wischen, auch über den Wochenrand. Seit Stufe 8 über echte ("trusted") Touch-Events per CDP statt `dispatchEvent` — die Achsen-/Geschwindigkeitsschwellen hängen an echtem Timing, das synthetische PointerEvents nicht zuverlässig nachbilden |
| `node scroll.js` | Rasterposition je Tag (`scrollMerk`, seit Stufe 8): übersteht Tabwechsel und einen simulierten Minutentakt-Durchlauf; „nie gescrollt" (Startposition) und „bewusst ganz oben" (0) bleiben unterscheidbar |
| `node drag.js` | Aufgabe ins Raster ziehen (Rechner) und dass ein Klick stattdessen das Aufgabenblatt öffnet |
| `node grob3.js` | Das Band für Einträge ohne feste Uhrzeit am Telefon |
| `node funktion.js` | Einstellungen mit Unterseiten: speichern, Dunkelmodus, Bereich anlegen |
| `node agenda.js` | iPhone SE, gestaffelter Falz-Vertrag bei Standardschrift (Agenda passt ohne Scrollen über die Tabbar), 44px-Trefferflächen, grobe Einträge, Maskierung über `escapeHtml()`; eigener Abschnitt h) für den Abend mit Tagesabschluss, eigene 23-Uhr-Uhr |
| `node schrift.js` | Derselbe Falz-Vertrag bei zwei Stufen größerer Systemschrift: kein waagerechtes Scrollen, kein abgeschnittener Text, nur noch die Antwort muss ohne Scrollen sichtbar bleiben |
| `node fuss.js` | Stapelung von Tabbar, Tagesstreifen, Vorschlagsleiste, FAB und Toast im Fußbereich, Hoch- und Querformat |
| `node leiste.js` | Die Vorschlagsleiste schwebt in „Heute" und „Plan" nicht mehr über Karten- bzw. Rasterinhalt, iPhone SE und iPhone 13 — und umgekehrt: ihr Polster darf die sichtbare Höhe von `.gridwrap` nicht schrumpfen |
| `node dialog.js` | Barrierefreiheit der Dialoge: Tab bleibt im offenen Blatt, Fokus kehrt beim Schließen zurück, `aria-labelledby`, `.app[inert]` |
| `node doppeltipp.js` | Der hastige Doppeltipp auf „Woche anlegen" (iPhone SE, Samstagabend-Uhr): „Das wird eng" öffnet sich unter dem Finger, sein Fuß liegt an derselben Stelle — die 300-ms-Schonfrist in `verteilenMitGate()` muss Tipp 2 folgenlos machen, egal ob er „Ziele anpassen" oder den Scrim träfe; danach bedient sich das Blatt normal (rohe `p.mouse`-Klicks für den Doppeltipp, Klicks mit Trefferprüfung warten die Frist von selbst ab) |
| `node haken.js` | Abhaken hängt am Paar Eintrag+Datum (`hakenKey`), nicht am Weg über den abgehakt wurde und nicht an der Serie; 44×44-Trefferfläche des Häkchens |
| `node abbrechen.js` | Ziele-Editor: Abbrechen, Escape oder Klick auf den Hintergrund stellen nicht nur Art-/Grob-/Ort-Chips zurück, sondern jedes getippte Feld (Zahl, Haken, Tage, Von/Bis) — über eine Sicherung von `a.plan`/`a.regeln` beim Öffnen; „Speichern" übernimmt weiterhin alles |
| `node vorschlagzeilen.js` | Vorschläge als Geisterzeilen in der Heute-Agenda: eigene Sektion unter „Danach", Einzel-Übernehmen/-Verwerfen über dieselben `acceptOne()`/`dropOne()` wie im Raster (Feldgleichheit beider Wege), Leerzustand „Noch nichts fest", das Leisten-Label springt zum frühesten Vorschlag, 44px-Trefferflächen, AA-Kontrast der gedämpften Zeile in Hell und Dunkel, Tastaturweg (Tab + Enter/Leertaste öffnet das Vorschlags-Blatt) |
| `node monat.js` | Die Monatsübersicht (`#monthBtn`): Kalenderraster mit KW-Rinne inkl. Monatsränder und 53-Wochen-Jahreswechsel, Serienprojektion (auch zweiwöchentliche Parität), „heute"-Kreis/„freigehalten"-Ring/Auslastungsstriche, Tages-Tipp in den Plan, KW-Tipp ins Wochen-Blatt, „+"-Vorausplanen durchs Gate mit distanzabhängigem Toast, Titel bei 320 px einzeilig (Jahr per `.sr`-Technik weiterhin im Dialognamen), `anchor` bleibt beim bloßen Blättern unberührt |
| `node wochenzeilen.js` | Das zweigesichtige Wochen-Blatt: Frei/Belegt-Umschalter (Frei = Voreinstellung, `freiwoche.js` prüft dieses Gesicht unverändert), Belegt = sieben Zeilen mit Segmentleiste (exakt gefüllt, grob gestrichelt, Vorschläge gedämpft), Klartext mit „+N"-Kappung und Maskierung, Zeilen-Tipp in den Tag (setzt `anchor` genau dort), Titel-Tipp öffnet den Monat der gezeigten Woche, Gesicht überlebt Wochenblättern und Zoom-Rundweg |

## Inhalt und Logik

| Skript | prüft |
|---|---|
| `node realtest.js` | **Verteiler-Kennzahlen** mit der Eingabe aus der Produktanalyse: Übergänge ohne Lücke, längste Strecke ohne Pause, Spanne zwischen vollstem und leerstem Tag. Die Zielwerte stehen am Ende der Ausgabe |
| `node rt.js` | Wochenritual: Rückblick, Abhaken einzeln und in einem Rutsch, Ziele, Verteilen, Migration v7 → v8 |
| `node rt2.js` | Zusammenführen beim Abgleich (wer gewinnt bei gleichzeitiger Änderung) und das Ritual am iPhone SE |
| `node frei.js` | Freigehaltene Tage: Vorschläge werden zurückgenommen, Neuverteilung lässt den Tag aus, von Hand eintragen bleibt erlaubt |
| `node ob.js` | Erststart-Assistent auf Rechner und iPhone SE bis zum fertigen Plan |
| `node tk.js` | Aufgabenblatt: Titel, Bereich, Dauer, Stern, in den Plan legen, löschen |
| `node regeln.js` | Der kontextbewusste Verteiler: Fenster (erlaubte Wochentage/Uhrzeit) und Anker (Mindestabstand zu einem anderen Bereich) in `area.regeln`, most-constrained-first |
| `node erklaer.js` | Die Begründungszeile jedes Vorschlags: nicht-leer, lesbarer deutscher Satz, Handlungsanweisung bei unlösbaren Fällen, Alternativen samt Abzugsgrund. Prüft die **Datenebene** — auf Blöcken und Agenda-Zeilen wird der generische Fallback seit der v1.22-Runde bewusst nicht mehr angezeigt (nur in den Blättern) |
| `node stabil.js` | Der Verteiler bleibt ruhig: zweimal verteilen ohne Änderung bewegt nichts, ein neuer Termin ändert nur seinen Tag, heute und von Hand gezogene Blöcke bleiben unberührt |
| `node wunsch.js` | Median der Vorschlag-Startzeiten je Art gegen den bevorzugten „Wunschpunkt" der Art, verglichen vorher/nachher aus echten Kopien von `index.html` |
| `node serie.js` | Zweiwöchentliche Termine: Parität zur `since`-Woche über die Sommerzeitumstellung hinweg, eigener Haken-Schlüssel je Woche, Serien-Rückfrage bei Löschen/Verschieben |
| `node aufgabenverteiler.js` | Aufgaben werden über `buildSuggestions()` verplant: echte `areaId` statt erfundener „task:..."-ID, `naechsteStelle()` findet die nächste freie Lücke |
| `node aufgaben.js` | Ergänzt `aufgabenverteiler.js` um Datenkorruption beim Verplanen: keine Duplikate beim Abhaken, kein verwaister Block nach dem Löschen einer Aufgabe |
| `node netz.js` | Das Sicherheitsnetz vor der v9-Migration: `Store.backupVorV9()`/`hasVorV9()`/`loadVorV9()` sichern den unveränderten v8-Stand genau einmal und lassen ihn sich wiederherstellen |
| `node rueckblick.js` | Wochenrückblick: geplant gegen tatsächlich je Bereich mit Wochenziel, Mehrwochen-Angebot zur Zielanpassung ab drei von vier Wochen unter der Marke |
| `node schleife.js` | „Die Schleife schließt sich": Grund/Ort in der Agenda, Anker-Chips im Wochenstart, Tagesabschluss ab Feierabend, abgeschaltete Vorschlagstypen überleben `migrate()` |
| `node stufe5.js` | Einwegskript zur Verifikation von Abhaken & Verschieben ohne Umweg, nicht Teil der Standardsuite |
| `node restdestag.js` | Der Rest-des-Tages-Knopf in „Heute": Sichtbarkeit nur unter allen Bedingungen zugleich (heutiger Tag, schon Belegtes, offene Minuten, vor Feierabend, `istFrei()`), Vorschläge erst ab der festgenagelten Uhrzeit, feste Termine und Serien bleiben unverändert, ein bereits vergangener eigener Vorschlag von heute bleibt Feld für Feld unangetastet, ohne Antippen passiert nichts |
| `node importfuzz.js` | Fuzzing des einzigen Wegs, auf dem fremde Daten in den Zustand kommen (`importData()`), über den echten Weg Dateiauswahl → `FileReader` → `JSON.parse()` → `migrate()`: Oberfläche bleibt bedienbar, keine Konsolenfehler, bestehender Zustand bleibt byte-identisch außer bei ausdrücklichem „Ersetzen" |
| `node zeitrand.js` | Die Zeitrechnung an ihren Rändern: Sommerzeitwechsel bleiben ein lückenloser Wochenanker (2026–2030), zweiwöchentliche Parität über mehrere Jahre, Jahresgrenze und echte 53-Wochen-Jahre, die beim Herbstwechsel doppelt vorkommende lokale Stunde verschiebt „Heute" nicht |
| `node freiwoche.js` | „Frei diese Woche": `#weekLabel` öffnet ein Blatt, das `freeGaps()` endlich zeigt — sieben Zeilen in Worten statt eines Rasters, aus dem man Lücken erst heraussuchen muss. Seit der v1.22-Runde zusätzlich: der lokale ‹ ›-Wochen-Umschalter im Blatt (der globale `anchor` bleibt unberührt), Titel relativ zu heute, „vorbei"/„· heute" nur in der echten aktuellen Woche |
| `node kapazitaet.js` | Die Kapazität rechnet in der laufenden Woche **ab jetzt**: vergangene Tage zählen weder in `wach` noch in `fest`, der laufende Block nur mit Restanteil; zukünftige/vergangene Wochen wie bisher. „Das wird eng"-Gate an allen drei Verteil-Einstiegen (Ziele, Heute-Leerzustand, Erststart-Assistent), „Nächste Woche planen" als Ausweg im Gate und in Ritual-Schritt 3, Anzeige ohne NaN im `wach = 0`-Randfall |
| `node grobstandard.js` | Die Erholungs-Startbereiche a4–a6 (Hobby, Freizeit & Pausen, Menschen) starten mit `plan.grob = true` und bekommen grobe Vorschläge (`teil` + `dauer` statt Uhrzeit); `migrate()` bleibt idempotent, ein selbst angelegter neuer Bereich startet weiterhin exakt |

Wichtig bei `realtest.js`: **grobe Blöcke dürfen in den Kennzahlen nicht
mitzählen.** Sie haben keine echte Uhrzeit und liegen im Band unter dem Raster —
zählt man sie mit, erscheinen sie als „Übergang ohne Lücke". Dieser Messfehler
ist beim Prüfen einmal passiert und hat eine Verschlechterung vorgetäuscht, die
es nicht gab.

## Abgleich mit dem Server

```bash
node mockserver.js &     # baut die Supabase-Endpunkte nach, Port 8899
node test3.js            # zwei Geräte, ein Konto
pkill -f mockserver.js
```

`mockserver.js` liefert `../index.html` aus und tauscht dabei die echten
Supabase-Werte gegen den Nachbau — es wird also **nie** die echte Datenbank
angefasst. Geprüft werden: Konto anlegen, Plan übernehmen, Änderung auf dem
zweiten Gerät, Gelöschtes bleibt gelöscht, Konflikt (spätere Änderung gewinnt),
Abmelden, falsches Passwort, Trennung zweier Nutzer, Offline und zurück.

Drei Konsolenfehler in der Ausgabe sind erwartet: ein fehlendes Favicon, die
abgelehnte Anmeldung mit falschem Passwort, und der abgeschaltete Netzzugang im
Offline-Test.

## App-Verpackung

```bash
node serve.js &          # liefert den Repo-Ordner über http aus, Port 8901
node pwatest.js          # Manifest, Service Worker, Zwischenspeicher, Offline-Start
node pwaupd.js           # Ablauf beim Erscheinen einer neuen Fassung
pkill -f serve.js
```

`pwaupd.js` schreibt währenddessen kurz `sw.js` und `index.html` um und stellt
sie danach wieder her. Wenn das Skript abbricht, vorher `git status` ansehen.

Ein Service Worker braucht http oder https — über `file://` läuft er nicht,
deshalb der kleine Server.

## Symbole

```bash
python3 icon.py          # braucht Pillow
```

Zeichnet `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` und
`apple-touch-icon.png` neu — vier Spalten, drei gefüllt, eine als Umriss.
Die Datei ist kurz und leicht zu ändern; das maskierbare Symbol braucht 28 %
Rand, sonst schneidet Android hinein.

## Wenn eine neue Fassung veröffentlicht wird

`V` in `../sw.js` hochzählen. Sonst merkt der Browser nicht, dass es etwas Neues
gibt — die Seite selbst kommt zwar trotzdem frisch (sie wird immer zuerst aus
dem Netz geholt), aber der Hinweis „Eine neue Fassung ist da" bleibt aus.

Der ganze Veröffentlichungsweg steht im Projektdokument `sync-einrichten.md`.
