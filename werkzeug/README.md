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

Falsch-positive Meldungen in `audit.js`: Häkchen und Farbfelder sind bewusst
klein und haben ihre Trefferfläche über ein unsichtbares `::before`. Das Skript
sieht Pseudo-Elemente nicht. Alles andere ist echt.

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

## Inhalt und Logik

| Skript | prüft |
|---|---|
| `node realtest.js` | **Verteiler-Kennzahlen** mit der Eingabe aus der Produktanalyse: Übergänge ohne Lücke, längste Strecke ohne Pause, Spanne zwischen vollstem und leerstem Tag. Die Zielwerte stehen am Ende der Ausgabe |
| `node rt.js` | Wochenritual: Rückblick, Abhaken einzeln und in einem Rutsch, Ziele, Verteilen, Migration v7 → v8 |
| `node rt2.js` | Zusammenführen beim Abgleich (wer gewinnt bei gleichzeitiger Änderung) und das Ritual am iPhone SE |
| `node frei.js` | Freigehaltene Tage: Vorschläge werden zurückgenommen, Neuverteilung lässt den Tag aus, von Hand eintragen bleibt erlaubt |
| `node ob.js` | Erststart-Assistent auf Rechner und iPhone SE bis zum fertigen Plan |
| `node tk.js` | Aufgabenblatt: Titel, Bereich, Dauer, Stern, in den Plan legen, löschen |

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
