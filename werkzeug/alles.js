// Kettenläufer: führt alle Prüfskripte in diesem Ordner nacheinander aus.
//
// Ersetzt das bisherige run_all.sh (Bash, schrieb nach /tmp, passte weder
// zum Projekt noch zu Windows). Die Liste der Skripte wird bei jedem Lauf
// neu im Ordner gesucht statt gepflegt — eine feste Liste wäre nach dem
// nächsten neuen Prüfskript schon wieder veraltet.
//
// test3.js braucht mockserver.js (Port 8899), pwatest.js/pwaupd.js brauchen
// serve.js (Port 8901) — beide werden hier selbst gestartet. Früher stand
// hier, man solle sie "von Hand vorher" starten: wer das vergaß, bekam die
// drei abhängigen Skripte trotzdem zum Laufen — gegen tote Ports, fälschlich
// rot statt übersprungen gemeldet. Gestartet wird nur, was der aktuelle Lauf
// (bzw. --nur) tatsächlich braucht; auf Bereitschaft wird der Port abgefragt,
// nicht blind gewartet, und beide Server werden danach in jedem Fall wieder
// beendet — auch bei Strg-C oder wenn ein Skript dazwischen abbricht.
const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawnSync, spawn } = require('child_process');

const SELBST = path.basename(__filename);
const AUSGENOMMEN = new Set([SELBST, 'mockserver.js', 'serve.js']);

// Welches abhängige Skript braucht welchen Server, auf welchem Port.
const SERVER_FUER = {
  'test3.js':   { datei: 'mockserver.js', port: 8899 },
  'pwatest.js': { datei: 'serve.js',      port: 8901 },
  'pwaupd.js':  { datei: 'serve.js',      port: 8901 }
};

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

// Port abfragen statt blind zu schlafen: ein bereiter Server nimmt eine
// TCP-Verbindung an, ein toter/langsamer lässt sie ablehnen oder hängen.
// Belegt bereits ein FREMDER Prozess denselben Port (z.B. ein liegen-
// gebliebener Server aus einem abgebrochenen Lauf), würde eine reine
// Verbindungsprobe das fälschlich als "bereit" lesen, während unser eigener
// mockserver.js/serve.js an genau dieser Stelle mit EADDRINUSE abstürzt —
// deshalb zählt zusätzlich, ob der selbst gestartete Prozess währenddessen
// beendet wurde (proc "exit"), nicht nur, ob irgendetwas auf dem Port lauscht.
function wartenAufPort(proc, port, timeoutMs) {
  const start = Date.now();
  let beendet = false;
  proc.once('exit', () => { beendet = true; });
  return new Promise(resolve => {
    (function versuch() {
      if (beendet) return resolve(false);
      // Erste Probe bewusst nicht sofort bei t=0: ein Absturz durch
      // EADDRINUSE passiert praktisch augenblicklich, soll aber Zeit haben,
      // das "exit" oben auszulösen, bevor wir den fremden Listener für
      // unseren eigenen halten.
      setTimeout(() => {
        if (beendet) return resolve(false);
        const sock = net.connect({ port, host: '127.0.0.1' });
        sock.once('connect', () => { sock.destroy(); resolve(!beendet); });
        sock.once('error', () => {
          sock.destroy();
          if (beendet || Date.now() - start >= timeoutMs) return resolve(false);
          versuch();
        });
      }, 100);
    })();
  });
}

const serverProzesse = [];

async function serverStarten(datei, port) {
  console.log('\n--- starte ' + datei + ' (Port ' + port + ') ---');
  // cwd hierher, wie bei den Prüfskripten unten — sonst landen etwaige
  // Nebenprodukte im Aufrufverzeichnis von alles.js statt in werkzeug/.
  const proc = spawn(process.execPath, [path.join(__dirname, datei)], { cwd: __dirname, stdio: 'ignore' });
  proc.on('error', () => {}); // sonst wirft ein unbeobachtetes "error" den ganzen Kettenläufer um
  serverProzesse.push(proc);
  const bereit = await wartenAufPort(proc, port, 5000);
  console.log(bereit ? '    bereit' : '    NICHT bereit — abhängige Skripte werden übersprungen');
  return bereit;
}

function alleServerBeenden() {
  serverProzesse.forEach(proc => { if (!proc.killed) proc.kill(); });
}

// Kein Server bleibt als Waise auf dem Port sitzen und blockiert den
// nächsten Lauf — auch nicht bei Strg-C oder einem Absturz mittendrin.
process.on('SIGINT', () => { alleServerBeenden(); process.exit(130); });
process.on('exit', alleServerBeenden);

(async () => {
  const bereitschaft = {}; // port -> bool
  const gebrauchtePorts = new Set(skripte.filter(s => SERVER_FUER[s]).map(s => SERVER_FUER[s].port));
  for (const port of gebrauchtePorts) {
    const eintrag = Object.values(SERVER_FUER).find(e => e.port === port);
    bereitschaft[port] = await serverStarten(eintrag.datei, port);
  }

  const ergebnisse = [];

  for (const skript of skripte) {
    const braucht = SERVER_FUER[skript];
    if (braucht && !bereitschaft[braucht.port]) {
      console.log('\n=== ' + skript + ' === übersprungen (Server ' + braucht.datei + ' auf Port ' + braucht.port + ' nicht bereit)');
      ergebnisse.push({ skript, status: 'uebersprungen', dauer: 0, letzte: braucht.datei + ' nicht bereit' });
      continue;
    }

    console.log('\n=== ' + skript + ' ===');
    const start = Date.now();
    const r = spawnSync(process.execPath, [path.join(__dirname, skript)], { encoding: 'utf8', cwd: __dirname });
    const dauer = Date.now() - start;
    const stdout = r.stdout || '';
    const stderr = r.stderr || '';
    const gruen = r.status === 0;

    // Bei rot sofort die volle Ausgabe zeigen — sonst muss man das Skript
    // gleich nochmal einzeln starten, nur um den Fehler zu lesen.
    if (!gruen) {
      process.stdout.write(stdout);
      process.stderr.write(stderr);
    }

    const zeilen = (stdout + stderr).split('\n').map(z => z.trim()).filter(Boolean);
    const letzte = zeilen.length ? zeilen[zeilen.length - 1] : '(keine Ausgabe)';
    ergebnisse.push({ skript, status: gruen ? 'gruen' : 'rot', dauer, letzte });
    console.log((gruen ? 'grün' : 'rot ') + '  ' + (dauer / 1000).toFixed(1) + 's');
  }

  alleServerBeenden();

  console.log('\n' + '='.repeat(60));
  console.log('ERGEBNIS');
  console.log('='.repeat(60));

  const BEZ = { gruen: 'grün', rot: 'rot ', uebersprungen: 'übersprungen' };
  const breite = Math.max('Skript'.length, ...ergebnisse.map(e => e.skript.length));
  ergebnisse.forEach(e => {
    console.log(
      e.skript.padEnd(breite) + '  ' +
      BEZ[e.status].padEnd(13) + '  ' +
      ((e.dauer / 1000).toFixed(1) + 's').padStart(6) + '  ' +
      e.letzte
    );
  });

  const rot = ergebnisse.filter(e => e.status === 'rot');
  const uebersprungen = ergebnisse.filter(e => e.status === 'uebersprungen');
  console.log('\n' + ergebnisse.length + ' Skripte, ' + rot.length + ' rot'
    + (uebersprungen.length ? ', ' + uebersprungen.length + ' übersprungen' : ''));
  process.exit(rot.length ? 1 : 0);
})();
