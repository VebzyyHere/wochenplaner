// Pre-Commit-Guard: fuehrt check.js und kontrast.js nacheinander aus und
// bricht mit Exit-Code 1 ab, sobald eines der beiden fehlschlaegt. Bewusst nur
// diese zwei - sie brauchen zusammen wenige Sekunden. Die Playwright-Skripte
// (audit.js, dev.js, ...) starten einen Browser und sind fuer einen Hook zu
// langsam; die laufen weiterhin von Hand nach jeder Aenderung.
const { spawnSync } = require('child_process');
const path = require('path');

const skripte = ['check.js', 'kontrast.js'];

for (const skript of skripte) {
  console.log(`=== ${skript} ===`);
  const ergebnis = spawnSync(process.execPath, [path.join(__dirname, skript)], { stdio: 'inherit' });
  if (ergebnis.status !== 0) {
    console.log(`\nAbbruch: ${skript} ist fehlgeschlagen.`);
    process.exit(1);
  }
}

console.log('\nAlle Pruefungen bestanden.');
