# Pre-Commit-Hook einrichten

`vorcommit.js` prüft vor einem Commit `check.js` und `kontrast.js` (wenige
Sekunden). Der Hook selbst wird **nicht** automatisch eingerichtet — `.git/hooks`
wird nicht versioniert, jeder Klon braucht diesen Handgriff einmal selbst.

## Einrichten (einmal je Klon)

Datei `.git/hooks/pre-commit` anlegen mit folgendem Inhalt:

```bash
#!/bin/sh
node werkzeug/vorcommit.js
```

Unter Linux/Mac zusätzlich ausführbar machen:

```bash
chmod +x .git/hooks/pre-commit
```

Ab jetzt läuft `vorcommit.js` automatisch vor jedem `git commit` und verhindert
den Commit bei Exit-Code 1.

## Warum nicht versioniert

`.git/hooks` liegt außerhalb des von Git verfolgten Baums — eine Datei dort
landet nie in einem Commit und kommt bei einem `git clone` nicht mit. Der
Hook muss also nach jedem Klon neu angelegt werden.

## Einmalig umgehen

Bei Bedarf lässt sich der Hook für einen einzelnen Commit überspringen:

```bash
git commit --no-verify
```
