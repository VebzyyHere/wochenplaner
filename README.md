# Wochenplaner

Einfacher Wochenplaner: feste Termine, Wochenziele in Stunden, Verteil-Vorschlag, Schlaf- und Ruhezeit.
Eine einzige HTML-Datei, laeuft auch offline.

Live: https://vebzyyhere.github.io/wochenplaner/

## Version 1.27 · September 2026

Grüne Gestaltung in Hell/Dunkel, direkte Desktop-Navigation, mobile Formulare
und eine konsistente Aufgabenplanung mit optionalem ersten Schritt.

Vorschau aus diesem Ordner starten:

```powershell
node release/preview.cjs
```

- `http://127.0.0.1:8902/beispiel`: interaktive Beispielwoche, Änderungen nur vorübergehend.
- `http://127.0.0.1:8902/`: eigener lokaler Plan, mit normaler Speicherung.
- [Release-Notizen](release/v1.27.md): Änderungen und Prüfungsumfang.

Die Vorschau ist nur auf diesem Rechner erreichbar. Der eigene Plan unter einer neuen
Vorschauadresse hat einen eigenen Browserspeicher; bestehende Daten der Live-App
werden dort nicht automatisch angezeigt. Bei Bedarf eine Sicherung exportieren
und im lokalen Plan über die vorhandene Importfunktion zusammenführen.

Prüfen (Chrome-Pfad bei Bedarf anpassen):

```powershell
$env:WP_CHROMIUM = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node werkzeug/alles.js
```
