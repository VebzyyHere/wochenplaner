/* ============================================================
   Pruefskript Vorschlagsleiste vs. Karten-/Rasterinhalt (Stufe 1) —
   iPhone SE (320x568) und iPhone 13 (390x844)

   Prueft den Befund: die Vorschlagsleiste (.sugbar, position:fixed
   ueber der Tabbar, s. ~1228) schwebt in "Heute" und "Plan" ueber dem
   Karten- bzw. Rasterinhalt, ohne dass diese dafuer Bodenabstand
   reservieren. FAB und Toasts rechnen die Leiste laengst korrekt ueber
   --fuss-oben ein (s. fuss.js) — die Karte in "Heute" (.panel > .card,
   ~1264) und das Raster in "Plan" bisher nicht. Ganz nach unten
   gescrollt bleibt ein Streifen Inhalt dauerhaft hinter der Leiste,
   kein Scrollen holt ihn hervor.

   Ergaenzt um die Gegenrichtung (s. gridwrapHoeheOhneBand): das Polster
   fuer die Leiste darf die sichtbare Hoehe des Rasters (.gridwrap) nicht
   schrumpfen lassen. Ein erster Anlauf hatte das Polster auf .planwrap
   gesetzt (Flex-Container von .gridwrap und .loose) statt auf den
   gescrollten Inhalt — das loeste "verdeckter Inhalt", kostete aber eine
   Stunde sichtbare Rasterhoehe, weil ein Polster am Container die
   verfuegbare Flaeche fuer .gridwrap verkuerzt statt nur dessen Scrollweg
   zu verlaengern. Beide Richtungen stehen jetzt in einem Skript, damit
   sie sich nicht mehr gegenseitig aushebeln koennen.

   Stil wie fuss.js/agenda.js: eine Chromium-Seite je Geraet, deutsche
   Ausgabe, Exit 1 bei Fehlern. Uhrzeit UND Datum sind ueber
   page.clock.setFixedTime() auf Mittwoch, 2026-08-05, 10 Uhr,
   Europe/Berlin genagelt (Vertrag dieses Projekts) — sonst haengt der
   Befund am Zufallszeitpunkt des Laufs statt an einer echten Luecke.
   Screenshots landen daneben in werkzeug/ zur Sichtpruefung von Hand.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK   ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

// Skippt den Erststart-Assistenten wie audit.js/agenda.js.
async function onboardingWeg(p) {
  await p.goto(F); await p.waitForTimeout(500);
  for (let i = 0; i < 3; i++) { await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(280); }
  await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(900);
}

// Der Erststart-Assistent legt mit seinen Vorgaben (START_ZIELE, alle > 0)
// normalerweise selbst Vorschlaege an. Klappt das aus irgendeinem Grund
// nicht, wird NICHT body.dataset.sugbar von Hand gesetzt, sondern echt
// nachgeholfen: ein Wochenziel setzen, dann der echte Verteiler.
async function sugbarSicherstellen(p) {
  let aktiv = await p.evaluate(() => document.body.dataset.sugbar === '1');
  if (aktiv) return true;
  await p.evaluate(() => {
    state.areas.find(a => a.id === 'a3').plan.goal = 6;
    buildSuggestions(); save(); renderAll();
  });
  await p.waitForTimeout(200);
  return p.evaluate(() => document.body.dataset.sugbar === '1');
}

// Ansicht wechseln, den zustaendigen Container ganz nach unten scrollen
// (.panel fuer "heute", .gridwrap/.loose fuer "plan" — dieselben, die auch
// ohne Leiste schon overflow-y:auto/scroll sind) und danach messen.
async function messenView(p, view) {
  await p.evaluate((v) => setView(v), view);
  await p.waitForTimeout(200);

  await p.evaluate(() => {
    const panel = document.querySelector('.panel');
    if (panel) panel.scrollTop = panel.scrollHeight;
    const gridwrap = document.querySelector('.gridwrap');
    if (gridwrap) gridwrap.scrollTop = gridwrap.scrollHeight;
    const loose = document.querySelector('.loose');
    if (loose && loose.offsetParent) loose.scrollTop = loose.scrollHeight;
  });
  await p.waitForTimeout(120);

  return p.evaluate((v) => {
    const rectOrNull = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      return { top: r.top, bottom: r.bottom };
    };
    const sugbar = rectOrNull(document.querySelector('#sugBar'));
    const tabbar = rectOrNull(document.querySelector('.tabbar'));

    // "Kind der sichtbaren Karte" (Auftragswortlaut) fuer "heute" — fuer
    // "plan" gibt es keine Karte, dort zaehlt der tatsaechliche Inhalt
    // (Bloecke im Raster, Chips im Grobband), nicht die leere Rasterflaeche
    // darunter, die niemand vermisst.
    let kinder;
    if (v === 'heute') {
      const card = document.querySelector('.card[data-card="heute"]');
      kinder = card ? [...card.children] : [];
    } else {
      kinder = [...document.querySelectorAll('.grid .block'), ...document.querySelectorAll('.loosechip')];
    }
    const rects = kinder.map(rectOrNull).filter(Boolean);
    const maxBottom = rects.length ? Math.max(...rects.map(r => r.bottom)) : null;

    return {
      sugbarFlag: document.body.dataset.sugbar,
      innerHeight: window.innerHeight,
      sugbar, tabbar, maxBottom,
      anzahlKinder: rects.length
    };
  }, view);
}

// "Plan" zeigt Vorschlaege mit Uhrzeit im Raster (.grid), aber Vorschlaege
// ohne Uhrzeit (grob, z.B. ein Serienabend) im Grobband (.loose) darunter —
// dasselbe Beispiel wie in agenda.js Szenario 1. Das Band sitzt am Ende von
// .planwrap, direkt ueber der Tabbar, genau wie die Tagesform-Kacheln am
// Ende der Karte in "Heute" — ohne einen solchen Abendtermin waere der
// Rasterinhalt an diesem Tag zufaellig zu kurz, um den Fall ueberhaupt zu
// pruefen (s. erster, noch red-freier Lauf dieses Skripts).
async function abendGrobSicherstellen(p) {
  await p.evaluate(() => {
    const dayKey = iso(addDays(mondayOf(anchor), selectedDayIdx));
    const hatSchon = state.blocks.some(b => b.grob && b.teil === 'ab' && b.date === dayKey);
    if (!hatSchon) {
      const area = state.areas.find(a => a.id === 'a6') || state.areas[0];
      state.blocks.push({
        id: uid(), title: 'Serienabend', areaId: area.id,
        day: selectedDayIdx, date: dayKey, repeat: 'none',
        grob: true, teil: 'ab', dauer: 90,
        start: abschnittVon('ab').von, end: abschnittVon('ab').von + 90,
        frog: false, sug: true
      });
      save(); renderAll();
    }
  });
  await p.waitForTimeout(150);
}

// Sichtbare Hoehe von .gridwrap in der Ansicht "Plan" — bewusst mit
// leerem Grobband (.loose), sonst wuerde dessen eigener Platzbedarf die
// Zahl verfaelschen statt allein den Effekt der Leiste zu zeigen. Entfernt
// dafuer jeden .grob-Block der laufenden Woche, genau wie clearSuggestions
// die Vorschlaege entfernt (~3605), nur eben unabhaengig vom sug-Flag.
async function gridwrapHoeheOhneBand(p) {
  await p.evaluate(() => {
    const wochenKeys = new Set(weekDays().map(d => d.key));
    const vorher = state.blocks.length;
    state.blocks = state.blocks.filter(b => !(b.grob && wochenKeys.has(b.date)));
    if (state.blocks.length !== vorher) { save(); renderAll(); }
  });
  await p.evaluate(() => setView('plan'));
  await p.waitForTimeout(200);
  return p.evaluate(() => {
    const gw = document.querySelector('.gridwrap');
    if (!gw) return null;
    const cs = getComputedStyle(gw);
    if (cs.display === 'none') return null;
    return Math.round(gw.getBoundingClientRect().height * 10) / 10;
  });
}

async function pruefeGeraet(p, tag) {
  await onboardingWeg(p);
  const sugOk = await sugbarSicherstellen(p);
  ok(sugOk, tag + ': Vorschlagsleiste steht (body[data-sugbar="1"]) vor der eigentlichen Pruefung');

  // Gegenrichtung, Teil 1: Rasterhoehe MIT Leiste, noch vor dem gleich
  // folgenden Abendtermin (der fuellt nur .loose, s.u.).
  const rasterMit = sugOk ? await gridwrapHoeheOhneBand(p) : null;

  await abendGrobSicherstellen(p);

  /* ---- Fall 1: mit offener Vorschlagsleiste ---------------------------- */
  for (const view of ['heute', 'plan']) {
    console.log(`\n## ${tag} / ${view} — mit Vorschlagsleiste`);
    if (!sugOk) { console.log('   uebersprungen (keine Vorschlaege zustande gekommen)'); continue; }
    const m = await messenView(p, view);
    console.log('   ' + JSON.stringify(m));
    ok(m.sugbarFlag === '1', 'data-sugbar=1 in dieser Ansicht');
    ok(!!m.sugbar, '.sugbar ist sichtbar');
    ok(m.anzahlKinder > 0, 'mindestens ein Inhalt zum Pruefen gefunden (sonst ist der Fall gegenstandslos)');
    if (m.sugbar && m.maxBottom !== null) {
      ok(m.maxBottom <= m.sugbar.top + 0.5,
        `kein Inhalt reicht unter die Vorschlagsleiste (Inhalt endet bei ${m.maxBottom.toFixed(1)}, Leiste beginnt bei ${m.sugbar.top.toFixed(1)})`);
    }
    await p.screenshot({ path: path.join(__dirname, `leiste-${tag}-${view}-mit.png`) });
  }

  /* ---- Gegenfall: ohne Vorschlagsleiste muss weiterhin alles erreichbar
     sein — sonst waere zu viel Polsterung eingebaut und Bildflaeche
     verschenkt worden. ---------------------------------------------------- */
  await p.evaluate(() => { clearSuggestions(); save(); renderAll(); });
  await p.waitForTimeout(200);
  const sugAusOk = await p.evaluate(() => document.body.dataset.sugbar === '0');
  ok(sugAusOk, tag + ': Vorschlagsleiste ist weg (data-sugbar=0) fuer den Gegenfall');

  // Gegenrichtung, Teil 2: dieselbe Messung ohne Leiste, dann Vergleich.
  // Toleranz 0.5px wie beim Bottom-Vergleich oben — dieselbe Sub-Pixel-
  // Rundung, kein grosszuegiger Spielraum fuer echtes Schrumpfen.
  const rasterOhne = await gridwrapHoeheOhneBand(p);
  if (rasterMit !== null && rasterOhne !== null) {
    console.log(`\n## ${tag} — Rasterhoehe (.gridwrap, ohne Band): mit Leiste ${rasterMit}px, ohne Leiste ${rasterOhne}px`);
    ok(rasterMit + 0.5 >= rasterOhne,
      `sichtbare Rasterhoehe schrumpft nicht durch die Leiste (mit Leiste ${rasterMit}px, ohne Leiste ${rasterOhne}px)`);
  }

  for (const view of ['heute', 'plan']) {
    console.log(`\n## ${tag} / ${view} — ohne Vorschlagsleiste`);
    const m = await messenView(p, view);
    console.log('   ' + JSON.stringify(m));
    ok(!m.sugbar, '.sugbar ist nicht mehr im Bild');
    if (m.tabbar && m.maxBottom !== null) {
      ok(m.maxBottom <= m.tabbar.top + 0.5,
        `Inhalt bleibt erreichbar (endet bei ${m.maxBottom.toFixed(1)}, Tabbar beginnt bei ${m.tabbar.top.toFixed(1)})`);
    }
    await p.screenshot({ path: path.join(__dirname, `leiste-${tag}-${view}-ohne.png`) });
  }
}

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });

  for (const [tag, geraet] of [['se', 'iPhone SE'], ['13', 'iPhone 13']]) {
    const ctx = await br.newContext({ ...devices[geraet], timezoneId: 'Europe/Berlin' });
    const p = await ctx.newPage();
    const konsolenfehler = [];
    p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

    // Mittwoch, 2026-08-05, 10 Uhr — s. Kopfkommentar.
    await p.clock.setFixedTime(new Date('2026-08-05T10:00:00+02:00'));

    console.log(`\n=== ${geraet} ===`);
    await pruefeGeraet(p, tag);

    console.log(`\n=== Konsolenfehler (${geraet}):`, konsolenfehler.length ? konsolenfehler : 'keine');
    if (konsolenfehler.length) fehler.push(`Konsolenfehler aufgetreten (${geraet})`);
    await ctx.close();
  }

  await br.close();

  console.log('\n' + (fehler.length ? `${fehler.length} FEHLER:` : 'Alle Pruefungen bestanden.'));
  fehler.forEach(f => console.log('  - ' + f));
  process.exit(fehler.length ? 1 : 0);
})();
