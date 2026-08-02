// Dauerhaftes Pruefskript (Stufe 10): misst je Art (kopf, koerper, erholung, orga) den
// MEDIAN der Startzeiten aller Vorschlaege und vergleicht ihn mit dem "Wunschpunkt" der
// Art — dem Punkt, den ARTEN[art].zeit() bevorzugt. Fuer koerper (16:00) und erholung
// (18:30) ist das ein festes Ziel (Math.abs(start - X)); fuer kopf und orga gibt es keinen
// festen Punkt, sondern "so frueh wie moeglich" (monoton fallend) — dort dient der
// Tagesanfang (state.settings.dayStart) als Bezugspunkt.
//
// Vergleich: "vorher" = index.html vor Stufe 10 (git HEAD~1, koerper-Koeffizient 1.2),
// "nachher" = aktueller Arbeitsstand (Koeffizient 3). Beide werden aus echten Kopien
// geladen (siehe .wunsch-tmp/), NICHT aus dem Gedaechtnis nachgebaut.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const TMP = path.join(__dirname, '.wunsch-tmp');
fs.mkdirSync(TMP, { recursive: true });
const vorherPath = path.join(TMP, 'vorher.html');
const nachherPath = path.join(TMP, 'nachher.html');

// Frische Kopien ziehen statt alte Stände wiederzuverwenden.
const vorherInhalt = execFileSync('git', ['show', 'HEAD~1:index.html'], { cwd: path.resolve(__dirname, '..') });
fs.writeFileSync(vorherPath, vorherInhalt);
fs.copyFileSync(path.resolve(__dirname, '..', 'index.html'), nachherPath);

const WUNSCHPUNKT = { kopf: null, koerper: 16 * 60, erholung: 18.5 * 60, orga: null };

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function fmt(min) {
  if (min === null || min === undefined || Number.isNaN(min)) return "—";
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

async function messen(browser, filePath) {
  const c = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + filePath);
  await p.waitForTimeout(600);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  const r = await p.evaluate(() => {
    state.settings.dayStart = 7; state.settings.dayEnd = 22;
    state.settings.sleep = { on: true, from: 22 * 60 + 30, to: 6 * 60 + 30, wind: 30 };
    const set = (id, h, must, pad) => { const a = state.areas.find(x => x.id === id);
      a.plan.goal = h; a.plan.must = must; if (pad !== undefined) a.plan.pad = pad; };
    // Wie realtest.js, plus a7 (Alltag/orga), damit auch diese Art Vorschlaege bekommt —
    // im realtest.js-Szenario bleibt orga sonst bei goal 0 und liefert keine Blöcke.
    set("a1", 20, true, 60);   // Arbeit, Wegzeit 60 -> kopf
    set("a2", 12, true);       // Uni -> kopf
    set("a3", 4, true);        // Sport -> koerper
    set("a6", 4, true);        // Menschen -> erholung
    set("a5", 8, false);       // Freizeit als Kür -> erholung
    set("a7", 5, false);       // Alltag als Kür -> orga
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    save(); renderAll();
    clearSuggestions();
    buildSuggestions();

    const sug = state.blocks.filter(x => x.sug && !x.grob);
    const proArt = { kopf: [], koerper: [], erholung: [], orga: [] };
    sug.forEach(b => {
      const area = state.areas.find(a => a.id === b.areaId);
      const art = (area && area.plan && ARTEN[area.plan.art]) ? area.plan.art : "orga";
      if (proArt[art]) proArt[art].push(b.start);
    });
    return { proArt, dayStart: state.settings.dayStart * 60, anzahl: sug.length };
  });
  return { starts: r.proArt, dayStart: r.dayStart, anzahl: r.anzahl, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const vorher = await messen(b, vorherPath);
  const nachher = await messen(b, nachherPath);
  await b.close();

  console.log('=== wunsch.js: Median-Startzeit je Art vs. Wunschpunkt ===');
  console.log('vorher = git HEAD~1 (Koeffizient 1.2), nachher = aktueller Stand (Koeffizient 3)\n');

  let fehler = [];
  if (vorher.errs.length) fehler.push('Konsolenfehler vorher: ' + vorher.errs.join(' | '));
  if (nachher.errs.length) fehler.push('Konsolenfehler nachher: ' + nachher.errs.join(' | '));

  const arten = ["kopf", "koerper", "erholung", "orga"];
  const zeilen = [];
  for (const art of arten) {
    const wv = vorher.starts[art] || [];
    const wn = nachher.starts[art] || [];
    const mv = median(wv);
    const mn = median(wn);
    const ziel = WUNSCHPUNKT[art] !== null ? WUNSCHPUNKT[art] : vorher.dayStart;
    const dv = mv === null ? null : Math.abs(mv - ziel);
    const dn = mn === null ? null : Math.abs(mn - ziel);
    const naeher = (dv !== null && dn !== null) ? (dn <= dv) : null;
    zeilen.push({
      art, wunschpunkt: fmt(ziel),
      medianVorher: fmt(mv), medianNachher: fmt(mn),
      anzahlVorher: wv.length, anzahlNachher: wn.length,
      abstandVorherMin: dv, abstandNachherMin: dn,
      naeherAmWunschpunkt: naeher
    });
    if (naeher === false) fehler.push(`${art}: Abstand zum Wunschpunkt wurde SCHLECHTER (${dv} -> ${dn} Min)`);
  }
  console.log(JSON.stringify(zeilen, null, 1));
  console.log('\nGesamt-Vorschlaege vorher/nachher:', vorher.anzahl, '/', nachher.anzahl);
  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  process.exitCode = fehler.length ? 1 : 0;
})();
