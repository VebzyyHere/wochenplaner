// Kettenläufer: führt alle Prüfskripte in diesem Ordner nacheinander aus.
//
// Ersetzt das bisherige run_all.sh (Bash, schrieb nach /tmp, passte weder
// zum Projekt noch zu Windows). Die Liste der Skripte wird bei jedem Lauf
// neu im Ordner gesucht statt gepflegt — eine feste Liste wäre nach dem
// nächsten neuen Prüfskript schon wieder veraltet.
//
// mockserver.js und serve.js fehlen absichtlich: die laufen endlos (eigener
// Server), keine Prüfung. Wer test3.js, pwatest.js oder pwaupd.js braucht,
// startet den passenden Server vorher von Hand — siehe README.md.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SELBST = path.basename(__filename);
const AUSGENOMMEN = new Set([SELBST, 'mockserver.js', 'serve.js']);

function nurFilter() {
  const i = process.argv.indexOf('--nur');
  if (i === -1) return null;
  const wert = process.argv[i + 1];
  if (!wert) {
    console.log('--nur braucht einen Namen, z.B. --nur audit');
    process.exit(1);
  }
  return wert.toLowerCase().replace(/\.js$/, '');
}

const nur = nurFilter();

let skripte = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.js') && !AUSGENOMMEN.has(f))
  .sort();

if (nur) {
  skripte = skripte.filter(f => f.toLowerCase().includes(nur));
  if (!skripte.length) {
    console.log('Kein Skript passt zu --nur ' + nur);
    process.exit(1);
  }
}

const ergebnisse = [];

skripte.forEach(skript => {
  console.log('\n=== ' + skript + ' ===');
  const start = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, skript)], { encoding: 'utf8' });
  const dauer = Date.now() - start;
  const stdout = r.stdout || '';
  const stderr = r.stderr || '';
  const ok = r.status === 0;

  // Bei rot sofort die volle Ausgabe zeigen — sonst muss man das Skript
  // gleich nochmal einzeln starten, nur um den Fehler zu lesen.
  if (!ok) {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
  }

  const zeilen = (stdout + stderr).split('\n').map(z => z.trim()).filter(Boolean);
  const letzte = zeilen.length ? zeilen[zeilen.length - 1] : '(keine Ausgabe)';
  ergebnisse.push({ skript, ok, dauer, letzte });
  console.log((ok ? 'grün' : 'rot ') + '  ' + (dauer / 1000).toFixed(1) + 's');
});

console.log('\n' + '='.repeat(60));
console.log('ERGEBNIS');
console.log('='.repeat(60));

const breite = Math.max('Skript'.length, ...ergebnisse.map(e => e.skript.length));
ergebnisse.forEach(e => {
  console.log(
    e.skript.padEnd(breite) + '  ' +
    (e.ok ? 'grün' : 'rot ') + '  ' +
    ((e.dauer / 1000).toFixed(1) + 's').padStart(6) + '  ' +
    e.letzte
  );
});

const rot = ergebnisse.filter(e => !e.ok);
console.log('\n' + ergebnisse.length + ' Skripte, ' + rot.length + ' rot');
process.exit(rot.length ? 1 : 0);
