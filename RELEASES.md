# Release-Log (aus CLAUDE.md ausgelagert am 2026-10-04)

Wörtlich übernommen aus `CLAUDE.md` (dort Zeilen 14–213, Stand v1.41). Neuere Einträge stehen
oben und gehen älteren vor — z. B. ist `.kopf` am Telefon seit v1.35 `position: fixed`, nicht mehr
absolut (v1.32). Zeilen-, Größen- und Skriptzahlen gelten für den damaligen Stand. Die bleibenden
Regeln daraus stehen in `CLAUDE.md` unter „Kopplungen & Fallen", „Verträge" und „Produktentscheidungen".

---

### Release v1.42 vom 2026-10-07

PWA-Cache `wp-v1.42`, Datenschema 10, Kette 63 Skripte (neu: `steine.js`, `kontrastlauf.js`).
Notizen für Nutzer: `release/v1.42.md`.

- **Look „Stundensteine"** (Entwurf B, von Sunny gewählt): Stilschicht am Ende des `<style>`-Blocks
  (Banner `v1.42 „Stundensteine"`) über Bestand und v1.36. Steingrund, Jade für Aktionen, Bereiche
  als Steine gleicher Helligkeit (nur `--h` je Bereich). Schrift Gabarito (Base64) statt Rundschrift.
  Kein Glas: Kopf, Tabbar, Leiste deckend; `--kopf-flach` = `--bg` als Hex (theme-color).
- Haken = runde Mulde; `jubel()` = Stein-Klack + Splitter, `jubelSchweben()` „+1 h Bereich",
  nur bei echtem Wechsel auf erledigt. Aufgaben-Haken in Bereichsfarbe, ohne Bereich Jade.
- **Ziele als Steine:** `steinReihe()`/`steinHtml()`, `areaGrobOffen()` (reine Anzeige-Summe),
  `steineFallen()` nur über `ansichtWechseln()`. Ziele-Blatt: Steine tippen, ±½. „Passt das noch?"
  als Steinzeile mit verdrängten Steinen. Seitenkante an Hero/Zeile/Block entfällt.
- Blätter federn herein; Abgang über eine Kopie im geschlossenen Shadow-Root (`blattAbgang()`), das
  echte Blatt ist sofort weg. `blockZeilenEinpassen()`: ganze Zeilen statt halb abgeschnittener.
- `kontrastlauf.js` misst Kontraste an der laufenden App; nachgeschärft: Uhrzeit/Begründung in
  vorgeschlagenen und erledigten Rasterblöcken, Mulden im Ziele-Blatt (Ring `--rand`), Rand der
  Konto-Pille, Schlaf-Hinweis bei abgeschalteter Schlafenszeit nicht mehr mitgedimmt.
- Falz-Verträge gehalten: „Heute zählt" am Telefon kompakt (ohne Wochenziel-Satz), am Desktop reicher.

### Release v1.41 vom 2026-09-27

PWA-Cache `wp-v1.41`, Datenschema 10, Kette 61 Skripte.

- **Tagesband statt Tagesstreifen-Wisch.** `renderDaySwitch()` baut `.dayswitch__band` über
  `BAND_ZURUECK`/`BAND_VOR` Wochen um heute (plus die gezeigte Woche, falls weiter weg);
  natives waagerechtes Scrollen mit `scroll-snap` je Tag, `bandEinrasten()` als Rückfall.
  **Ziehen bewegt `anchor` nie** — erst ein Tipp (andere Woche → `anchor = Tag`, `renderAll()`).
  Die sieben Tage der gezeigten Woche tragen `.is-woche` (Tests zählen nur diese).
  `bandAusrichten()` hält die Scrollposition, solange der gewählte Tag sichtbar ist
  (auch aus `setView()`); `.dayswitch__heute` erscheint, wenn heute außer Sicht ist.
  Tastatur: ein Tab-Stopp (Roving tabindex), Pfeile wandern. `streifenwischenEinrichten()` ist entfallen;
  `tagWechseln()` bleibt fürs Inhalts-Wischen. Die Leiste `.dayswitch` läuft nie über (diag7/sicht).
- Tab „Plan" heißt „Woche" (neues Symbol); `data-view` bleibt `plan`.

### Release v1.40 vom 2026-09-27

PWA-Cache `wp-v1.40`, Datenschema 10, Kette 61 Skripte.

- `gruss()`: 5–11 „Einen wunderschönen guten Morgen, Name ☀️", 14–18 „Hallihallöchen",
  ab 22 Uhr „Schlaf was Schönes, Name ✨" (Nutzerwunsch, wörtlich). Grüße > 22 Zeichen setzen
  `.agenda__kopfzeile.is-lang`: Gruß in eigener Zeile, Ring bleibt oben. Nur am Telefon rücken
  dann Schwerpunkt/Schritt/Hero/„Danach"/`#restTagBtn` enger — sonst reißt der Falz (agenda.js).
- Agenda-Zeile nach links wischen (≥ `WISCH_AB`) öffnet `moveSheet()` — dieselbe Tür wie
  langes Drücken, speichert nichts (Prüfung: freude.js f).
- Toasts = dunkle Pille (`--pille`) mit Limetten-Aktion; Tagesform-Kacheln flächig; Desktop-Tageskopf
  gewählt = `--selected`, heute = Limette.

### Release v1.36/v1.37 vom 2026-09-27

PWA-Cache `wp-v1.39` (v1.39: hell ein Moosgruen fuer --ink/--tief, Tabbar-Pille ueber --pille/--pille-an; v1.38: Farbabgleich, Dunkel-Aktion = Limette, Glas im Papierton, Einstellungen als gruppierte Liste), Datenschema 10, Kette 61 Skripte. Look „Moos & Papier": eigene
Stilschicht am Ende des `<style>`-Blocks (Banner „v1.36"), Tokens `--lime`/`--on-lime`/`--tief`.

- Tabbar (Hochformat, `min-height: 501px`) ist eine schwebende dunkle Pille (`::before`) mit
  `#tabAdd` („+") in der Mitte; es ruft `#fabAdd.onclick` auf, der Plankopf-FAB ist dort
  ausgeblendet. Tab-Schleifen nutzen `#tabbar button[data-view]`. Innerhalb von 450 ms nach
  `closeModal()` (`zuletztGeschlossen`) ignoriert `#tabAdd` Tipps (Doppeltipp-Schutz).
- Blätter sind am Telefon (≤ 640px, coarse) Bottom Sheets mit Griff; `blattZiehenEinrichten()`
  in `modal()` schließt beim Herunterziehen > 110 px.
- Agenda-Kopfzeile: Fortschrittsring `.agenda__fort` (x/y über `istErledigt()`).
- Falz-Vertrag hält knapp (~2 px): Agenda-Abstände und Tabbar-Höhe nicht vergrößern.

### Release v1.35 vom 2026-09-26

Aktuelle Änderungen: `release/v1.35.md`. PWA-Cache `wp-v1.35`, Datenschema 10, Kette 61 Skripte.

- `.kopf` ist am Telefon `position: fixed` (nicht absolute) — WebKits Randabtaster zählt nur
  feste/klebende Elemente; installiert trägt auch `html` die Farbe `--kopf-flach`.
- Agenda-Zeilen: Wischen nach rechts (`WISCH_AB` = 72 px, nur Touch) schaltet den Haken über
  ein synthetisches `change` am `.agenda__check` — dieselbe Kette wie ein Tipp (`abhaken()`).
  Die Klick-Sperre nach Wischen/langem Drücken teilt sich eine Stelle.
- `ansichtWechseln(v)` = `setView(v)` + Überblendung (`#main.is-wechsel`, nur opacity); nur die
  Nutzerwege (Tabbar, `#panelNav`) nutzen es. Tests und Code rufen weiter `setView()`.
- `wochenBilanz()`, `bilanzSatz()`, `oklchRgb()`, `wochenkarteZeichnen()`, `wochenkarteSheet()`
  (vor `renderGoals()`): Canvas-Bild der angezeigten Woche, Knopf `#wochenkarteBtn` in der
  Ziele-Karte; `navigator.share` mit Datei, sonst Download. Nur lesen.

### Release v1.34 vom 2026-09-26

Aktuelle Änderungen: `release/v1.34.md`. PWA-Cache `wp-v1.34`, Datenschema 10, Kette 61 Skripte.

- `.block__done` ist ein sichtbarer Ring (Touch immer, Maus bei Hover/Fokus); Blöcke unter
  52 px tragen `.is-knapp` und halten rechts Platz frei; in der Sieben-Tage-Ansicht auf
  `pointer: coarse` fehlt der Ring an knappen/kurzen Blöcken.
- Am Anfang des `<style>`-Blocks steht ein `@font-face` „Wochenplaner Rund" (Nunito, OFL,
  Base64, ~52 KB) — deshalb ist `index.html` jetzt ~575 KB. `--font-display` nennt es nach
  `ui-rounded`; Apple-Geräte dekodieren es nie. Nicht durch eine externe Webfont ersetzen
  (Offline-/Einzeldatei-Vertrag).

### Release v1.33 vom 2026-09-26

Aktuelle Änderungen: `release/v1.33.md`. Prüfung: `werkzeug/freude.js`; Kette 61 Skripte.
PWA-Cache `wp-v1.33`, Datenschema weiterhin 10.

- **Installiert kein Glas oben.** iOS 26/27 legt in Home-Bildschirm-Web-Apps einen
  Liquid-Glass-Effekt über jeden nicht flachen oberen Rand. `applyTheme()` setzt
  `html[data-app]` (über `laeuftAlsApp()`) und meldet `--kopf-flach` als `theme-color`;
  `html[data-app="1"] .kopf` ist deckend in genau dieser Farbe. Beide Werte nur gemeinsam
  ändern. Kein `black-translucent`. Nach Änderungen an diesen Angaben muss das
  Home-Bildschirm-Symbol neu angelegt werden (iOS speichert sie mit dem Symbol).
- **Gestaltung „Frisch & verspielt"** (vom Nutzer gewählt, Zielgruppe 20–30): `--font-display`
  (`ui-rounded`) für Zahlen/Titel; keine `text-transform: uppercase`-Etiketten außer
  Wochentags-Kürzeln; Agenda-Kopf ist `.agenda__kopfzeile` mit `gruss()` rechts — das erste
  `.agenda__label` bleibt wörtlich „Heute zählt" (Tests); Welle `kringel(hue)` unter dem
  Schwerpunkt; runde Haken.
- **Freude beim Abhaken:** UI-Haken laufen über `abhaken(b, dayKey, on, el)` statt direkt
  `setzeErledigt()` — Konfetti `jubel()`, einmalige Ziel- und Tagesmeldung (`gefeiert`,
  nur Sitzung, nie in `state`). Nie beim Aufheben, nie bei reduzierter Bewegung.
- **Lehre aus dieser Runde:** während `alles.js` läuft, `index.html` nicht bearbeiten —
  `pwaupd.js` stellt die Datei auf den Stand bei seinem Start zurück und verschluckt
  Zwischenänderungen still.

### Release v1.32 vom 2026-09-26

Aktuelle Änderungen: `release/v1.32.md`. Prüfung: `werkzeug/iphone.js`; Kette 60 Skripte.
PWA-Cache `wp-v1.32`, Datenschema weiterhin 10, keine neuen Felder.

- **Glas-Kopf.** `#banner`, `.topbar` und `#daySwitch` stecken in `<div class="kopf" id="kopf">`.
  Am Telefon (≤ 1100px) liegt `.kopf` absolut über dem Inhalt; `.panel` und `.planwrap`
  beginnen per `padding-top: var(--kopf-h)` darunter. `--kopf-h` setzt `kopfhoeheMessen()`
  (ResizeObserver auf `#kopf`). Wer dort eine eigene `.panel`-Polsterung setzt (Tablet-Regel!),
  muss `--kopf-h` einrechnen, sonst liegt der Karteninhalt unter dem Kopf.
  Glas = Tokens `--glas*` in beiden Themes, `@supports (backdrop-filter)` und
  `prefers-reduced-transparency` fallen auf `--surface` zurück.
- **Querformat** (`QUER_Q` in JS und gleichlautendes CSS `max-height:500px and max-width:1000px`):
  Tabbar = senkrechte Leiste (`--rail`, volle Höhe), `.kopf` beginnt rechts davon, `.fab`
  unten in der Leiste. `fussbereichMessen()` setzt dort `--fussleiste` = Safe-Area unten
  (`sicherUnten()`), nicht die Tabbar-Höhe. Ab 700px Breite (`SUG_OBEN_Q`) hängt
  `sugbarPlatzieren()` `#sugBar` in die `.topbar` (`body[data-sugoben="1"]`) und beim Drehen
  zurück; die Pille zählt dann nicht zu `--fuss-oben`.
- **Passt das noch?** `zusageDurchspielen(minuten, areaId, montag)` rechnet über `inWoche()`
  (anchor nur für die Rechnung umgestellt) mit `wochenKapazitaet()` und `freeGaps()`;
  `zusageSheet()` zeigt Varianten und öffnet nur `blockSheet()` vorausgefüllt — nie still
  speichern. Keine Rangfolge der Ziele erfinden (s. `IDEEN.md`).
- Entfernt: `#weekOverviewBtn` („Freie Zeit", doppelt zu `#weekLabel`/`W`), `.planhead__hint`,
  „Das Wichtigste" in `renderEnergy()` (steht schon in der Agenda).

### Release v1.31 vom 2026-09-26

Aktuelle Änderungen: `release/v1.31.md`. Prüfung: `werkzeug/uebersicht.js`; die Kette
hat damit 59 Skripte. PWA-Cache `wp-v1.31`, Datenschema weiterhin 10, keine neuen Felder.

- Der Desktop-/Tablet-Wochenkopf (`.dayhead` in `renderGrid()`) zeigt je Tag die Stunden
  aus `tagesAuslastung()` — dieselbe Rechnung wie der Tagesstreifen-Balken, nicht
  auseinanderlaufen lassen. Die Köpfe sind Knöpfe mit `aria-pressed` für `selectedDayIdx`.
- Klebende Blocktitel stehen bei `top: var(--kopf)`. `renderGrid()` misst die Kopfhöhe
  (Modul-`ResizeObserver` `kopfBeobachter`, 0 ohne Kopf). Kein fester Pixelwert mehr,
  auch nicht in der `max-width: 1100px`-Regel — Tablets zeigen dort sieben Tage MIT Kopf.
- `kalenderIcs()`/`kalenderExport()` (hinter `exportData()`): nur Blöcke mit Uhrzeit, ohne
  `sug`; Serien als RRULE, erster Termin über `onDay()`, `b.ausnahmen` als EXDATE,
  schwebende Ortszeit. Liest nur, kein `save()`. Einstellungsseite `kalender`.
- Tastenkürzel stehen einmal in `TASTENKUERZEL` (`kuerzelSheet()`), neu `?`, `W`, `M`.

### Release v1.30 vom 2026-09-25

Aktuelle Änderungen und visuelle Prüfbeschränkungen: `release/v1.30.md`.
Am Telefon steht der Tagesstreifen nun vor dem Inhalt. Die Eintragsaktion
gehört zum Plankopf statt zum schwebenden Fußbereich; `fussbereichMessen()`
zählt nur noch Tabbar und Vorschlagsleiste. Der Termin-Dialog priorisiert Tag
und Uhrzeit. PWA-Cache: `wp-v1.30`; Datenschema weiterhin 10.

### Release v1.28 vom 2026-09-10

Aktuelle Änderungen: `release/v1.28.md`. Der lokale Abnahmebericht liegt in
`release/abschluss-2026-09-10/ABNAHME.md` (gitignored).

- `MOBILE_Q` und das CSS wechseln gemeinsam bei **1100px** zu eigenständigen
  Arbeitsflächen mit unterer Navigation. `EINTAG_Q` bleibt bei 640px: ein
  Tablet zeigt weiterhin sieben Kalendertage. In der Tablet-Heute-Ansicht bleibt
  die Tagesauswahl erreichbar.
- Am Desktop zeigt `body.dataset.panel` den gewählten Arbeitsbereich neben
  dem Raster. `setView()` setzt nur Ansichtsstatus; keine neuen Datenfelder.
  Vor echten Klicks/Ziehen auf Aufgaben muss auch ein Test den Aufgabenbereich öffnen.
- Die Breite der Desktop-Arbeitsfläche liegt zwischen 352 und 440px. Alle
  Kalenderspalten passen in die verbleibende Fläche; kurze Titel werden gekürzt.
- `--safe-top/right/bottom/left` übernehmen die Plattform-Inset-Werte.
  App, schwebende Leiste und Dialoge beachten seitliche Ränder. `#banner` ist
  ein Flex-Kind der App, damit Speicherwarnungen die Navigation nicht verdrängen.
- `werkzeug/abschluss.js` ergänzt 17 Regressionen zu Navigation, Tablet-Drehung,
  Datenerhalt und Speicherwarnung. Die vollständige Kette umfasst 57 Skripte.
- Interner Worker-Stand: `wp-v1.28`. Datenschema weiterhin 10. Keine sichtbaren
  Versionsnummern im Produkt; keine Umsetzung der geparkten Idee in `IDEEN.md`.

### Release v1.27 vom 2026-09-06

Änderungen und Prüfungsumfang stehen in `release/v1.27.md`. Der ausführliche
lokale Produktreview liegt zusätzlich in `release/PROJEKTBERICHT.md` (gitignored).
Der Nutzer hat grüne Akzente ausdrücklich beauftragt; ältere Hinweise auf rein
achromatischen Chrome sind damit überholt. Waldgrün steht für Aktionen, dezente
Salbeiflächen für Auswahl. Bereichsfarben behalten ihre inhaltliche Bedeutung.

- Migration endet jetzt bei **version 10**. `task.schritt` ist optionaler Text
  bis 240 Zeichen, wertbasiert abgesichert; es gibt kein neues Wurzelfeld.
- `aufgabeAbhaken()` schreibt Aufgabe und zugehörigen Termin gemeinsam. Ein
  ausdrücklich abgehakter Vorschlag wird dabei als durchgeführt bestätigt.
- `planTask()` öffnet bei vorhandener Verknüpfung den bestehenden Termin in
  seiner tatsächlichen Woche. Dasselbe gilt für einen erneuten Drop. Alte
  doppelte Termine bleiben erhalten; `migrate()` entfernt nur nichtkanonische
  Aufgabenverweise (maßgeblich ist `task.geplant`).
- Aufgaben unterscheiden „Ohne Platz“, „Vorgeschlagen“, „Eingeplant“, „Andere
  Wochen“ und „Erledigt“. Nur bestätigte Termine in der gezeigten Woche zählen
  im Fuß. Datumsangaben nennen Tag und Monat, grobe Termine ihren Abschnitt.
- `#panelNav` scrollt am Desktop direkt zum jeweiligen Abschnitt; der Kalender
  bleibt daneben. `setView()` bringt dort jetzt auch programmgesteuert Aufgaben
  und Ziele ins Bild. Mobile Ansichten und Navigation bleiben erhalten.
- `fussbereichMessen()` setzt die beiden bestehenden CSS-Fußvariablen aus
  tatsächlichen Höhen (`ResizeObserver`). Die festen CSS-Werte bleiben Fallback.
  Den sichtbaren Dialogbereich liefert `visualViewport` bei unvergrößerter Seite.
- `werkzeug/release.js` prüft diese Abläufe einschließlich Datenerhalt,
  Titelsynchronisierung, Migration, Tastaturweg und großer Schrift. Die vollständige
  Kette hat damit 56 Skripte. Ein übersprungener Server-Test lässt `alles.js`
  ebenfalls fehlschlagen, statt eine unvollständige Kette als grün auszugeben.
- Lokale Vorschau: `node release/preview.cjs`, Port 8902, nur `127.0.0.1`.
  `/` liefert die echte App, `/beispiel` eine flüchtige Beispielwoche mit fixierter
  Uhr, isoliertem Speicherdummy, deaktiviertem Cloudabgleich und ohne SW-Registrierung.
  Die Vorschau wird durch `release/vorschau-pruefen.cjs` geprüft.

Die Worker-Version für diesen Release lautet `wp-v1.27`.
Die darunterstehenden Zeilennummern beschreiben teilweise den vorherigen Stand;
für aktuelle Stellen die Abschnittsbanner oder Funktionsnamen suchen.
