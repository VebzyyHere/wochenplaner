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
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const SELBST = path.basename(__filename);
const AUSGENOMMEN = new Set([SELBST, 'mockserver.js', 'serve.js']);
// Diese Skripte fassen index.html/sw.js vorübergehend an oder testen den
// laufenden Service Worker — sie laufen ganz zum Schluss nacheinander.
const EXKLUSIV = new Set(['pwatest.js', 'pwaupd.js']);
// Längere Läufe zuerst einreihen, damit kein Nachzügler den Pool aufhält.
const SCHWER = [
  'test3.js', 'kontrastlauf.js', 'szenarien.js', 'audit.js',
  'wochenzeilen.js', 'freiwoche.js', 'frei.js', 'kontrast.js',
  'plaene.js', 'release.js'
];

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

function parallelAnzahl() {
  const cpus = (os.cpus() || []).length || 4;
  const standard = Math.min(Math.max(cpus - 1, 2), 6);
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    let roh = null;
    if (arg === '--parallel' || arg === '-j') roh = process.argv[i + 1];
    else if (arg.startsWith('--parallel=')) roh = arg.slice('--parallel='.length);
    else if (/^-j\d+$/.test(arg)) roh = arg.slice(2);
    else continue;
    const n = parseInt(roh, 10);
    if (!Number.isFinite(n) || n < 1) {
      console.log(arg + ' braucht eine Zahl >= 1, z.B. --parallel 4');
      process.exit(1);
    }
    return n;
  }
  return standard;
}

const nur = nurFilter();
const maxParallel = parallelAnzahl();

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
const laufendeSkripte = new Set();

async function serverStarten(datei, port) {
  console.log('\n--- starte ' + datei + ' (Port ' + port + ') ---');
  // cwd hierher, wie bei den Prüfskripten unten — sonst landen etwaige
  // Nebenprodukte im Aufrufverzeichnis von alles.js statt in werkzeug/.
  const proc = spawn(process.execPath, [path.join(__dirname, datei)], { cwd: __dirname, stdio: 'ignore' });
  proc.on('error', () => {}); // sonst wirft ein unbeobachtetes "error" den ganzen Kettenläufer um
  serverProzesse.push(proc);
  // 15 s statt 5 s: auf Sunnys Windows-Rechner waren beide Server beim
  // Kettenstart zweimal nicht rechtzeitig da, im Einzellauf sofort (2026-11-23).
  // Die Meldung nennt den Grund, damit „zu langsam" und „Port schon belegt"
  // (unser Prozess endet sofort mit EADDRINUSE) nicht mehr gleich aussehen.
  const t0 = Date.now();
  const bereit = await wartenAufPort(proc, port, 15000);
  const grund = proc.exitCode !== null ? 'Prozess beendet (Exit ' + proc.exitCode + '), Port ' + port + ' vermutlich schon belegt'
                                       : 'nach ' + Math.round((Date.now() - t0) / 1000) + ' s keine Verbindung';
  console.log(bereit ? '    bereit' : '    NICHT bereit (' + grund + ') — abhängige Skripte werden übersprungen');
  return bereit;
}

function alleProzesseBeenden() {
  laufendeSkripte.forEach(proc => { if (!proc.killed) proc.kill(); });
  serverProzesse.forEach(proc => { if (!proc.killed) proc.kill(); });
}

// Kein Server oder Worker bleibt als Waise zurück — auch nicht bei Strg-C.
process.on('SIGINT', () => { alleProzesseBeenden(); process.exit(130); });
process.on('exit', alleProzesseBeenden);

function skriptAusfuehren(skript, bereitschaft) {
  const braucht = SERVER_FUER[skript];
  if (braucht && !bereitschaft[braucht.port]) {
    console.log('=== ' + skript + ' === übersprungen (Server ' + braucht.datei + ' auf Port ' + braucht.port + ' nicht bereit)');
    return Promise.resolve({ skript, status: 'uebersprungen', dauer: 0, letzte: braucht.datei + ' nicht bereit' });
  }

  return new Promise(resolve => {
    const start = Date.now();
    const proc = spawn(process.execPath, [path.join(__dirname, skript)], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    laufendeSkripte.add(proc);
    const outChunks = [];
    const errChunks = [];
    let fertig = false;

    proc.stdout.on('data', d => outChunks.push(d));
    proc.stderr.on('data', d => errChunks.push(d));

    const abschliessen = (code, err) => {
      if (fertig) return;
      fertig = true;
      laufendeSkripte.delete(proc);
      const dauer = Date.now() - start;
      const stdout = Buffer.concat(outChunks).toString('utf8');
      const stderr = Buffer.concat(errChunks).toString('utf8') + (err ? '\n' + err.message : '');
      const gruen = !err && code === 0;

      // Bei rot sofort die volle Ausgabe zeigen — bei parallel laufenden
      // Skripten gebündelt pro Skript, damit sich Zeilen nicht mischen.
      if (!gruen) {
        console.log('\n=== ' + skript + ' (ROT) ===');
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
      } else {
        console.log('grün  ' + ((dauer / 1000).toFixed(1) + 's').padStart(5) + '  ' + skript);
      }

      const zeilen = (stdout + '\n' + stderr).split('\n').map(z => z.trim()).filter(Boolean);
      const letzte = zeilen.length ? zeilen[zeilen.length - 1] : '(keine Ausgabe)';
      resolve({ skript, status: gruen ? 'gruen' : 'rot', dauer, letzte });
    };

    proc.on('error', err => abschliessen(1, err));
    proc.on('close', code => abschliessen(code, null));
  });
}

(async () => {
  const gesamtStart = Date.now();
  const bereitschaft = {}; // port -> bool
  const gebrauchtePorts = new Set(skripte.filter(s => SERVER_FUER[s]).map(s => SERVER_FUER[s].port));
  for (const port of gebrauchtePorts) {
    const eintrag = Object.values(SERVER_FUER).find(e => e.port === port);
    bereitschaft[port] = await serverStarten(eintrag.datei, port);
  }

  const gewicht = s => {
    const idx = SCHWER.indexOf(s);
    return idx === -1 ? SCHWER.length : idx;
  };
  const parallelListe = skripte
    .filter(s => !EXKLUSIV.has(s))
    .sort((a, b) => gewicht(a) - gewicht(b) || a.localeCompare(b));
  const exklusivListe = skripte.filter(s => EXKLUSIV.has(s));

  const ergebnisse = [];
  if (parallelListe.length) {
    const workerZahl = Math.min(maxParallel, parallelListe.length);
    console.log('\n--- Starte ' + parallelListe.length + ' Skripte (' + workerZahl + ' parallel) ---');
    let naechster = 0;
    const worker = async () => {
      while (naechster < parallelListe.length) {
        const s = parallelListe[naechster++];
        ergebnisse.push(await skriptAusfuehren(s, bereitschaft));
      }
    };
    await Promise.all(Array.from({ length: workerZahl }, worker));
  }

  for (const s of exklusivListe) {
    console.log('\n=== ' + s + ' (exklusiv) ===');
    ergebnisse.push(await skriptAusfuehren(s, bereitschaft));
  }

  alleProzesseBeenden();

  ergebnisse.sort((a, b) => a.skript.localeCompare(b.skript));

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
  const gesamtSek = ((Date.now() - gesamtStart) / 1000).toFixed(1);
  console.log('\n' + ergebnisse.length + ' Skripte, ' + rot.length + ' rot'
    + (uebersprungen.length ? ', ' + uebersprungen.length + ' übersprungen' : '')
    + ' — Gesamtdauer: ' + gesamtSek + 's (' + maxParallel + ' parallel)');
  process.exit(rot.length || uebersprungen.length ? 1 : 0);
})();
