---
name: verify
description: Prüft eine Änderung am Wochenplaner vor dem Commit – Schnellprüfung, volle Kette node alles.js, Screenshots ansehen. Vor jedem Commit in diesem Repo ausführen.
---

# verify – Wochenplaner vor dem Commit prüfen

Setzt den Vertrag „Commit und Push nur bei grüner `node alles.js`“ aus `CLAUDE.md` als festen Ablauf um.
Dieser Skill prüft nur; er committet und pusht nicht.

1. **Schnellprüfung** nach jeder UI-Änderung, aus `werkzeug/` heraus (rund eine Minute):
   `node check.js && node audit.js && node dev.js`
2. **Volle Kette** vor dem Commit, aus `werkzeug/` heraus: `node alles.js`.
   Grün heißt: die Endtabelle zeigt 0 rot **und** 0 übersprungen (Exit-Code 0). Während `alles.js` läuft,
   `index.html` nicht bearbeiten; bricht der Lauf ab, zuerst `git status` ansehen.
3. **Sichtprüfung:** Screenshots der geänderten Ansichten ansehen, nicht nur messen. Verdeckung nie an einem
   unscrollten Screenshot beurteilen.
4. **Impeccable-Detektor** nur, wenn das Plugin installiert ist (Ordner
   `~/.claude/plugins/cache/impeccable/impeccable/` vorhanden): genau drei `side-tab`-Treffer sind erlaubt, siehe
   `CLAUDE.md`. Fehlt das Plugin, den Schritt im Bericht als übersprungen nennen.
5. **Bericht:** ausgeführte Befehle, Endtabelle (rot / übersprungen), angesehene Screenshots. Bei Rot nicht
   committen, sondern Ursache beheben und ab Schritt 2 wiederholen.
