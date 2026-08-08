/* ============================================================
   Pruefskript Vorschlagsleiste vs. Karten-/Rasterinhalt (Stufe 1,
   erweitert um Auftrag B: zwei Befunde an derselben Stelle)
   iPhone SE (320x568) und iPhone 13 (390x844)

   Prueft den Befund: die Vorschlagsleiste (.sugbar, position:fixed
   ueber der Tabbar, s. ~1236) schwebt in "Heute" und "Plan" ueber dem
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

   Auftrag B, Befund 1 (pruefeDoppelknopf): stehen Vorschlaege an, sind
   gleichzeitig "Vorschlagen" (leere Heute-Karte, #agendaVorschlag) und
   "Uebernehmen" (.sugbar__accept) volltonig betont sichtbar — zwei
   gleich starke Knoepfe im selben Blickfeld. Eigenes, von Hand gebautes
   Szenario je Geraet (nicht der echte Verteiler): der heutige Tag bleibt
   leer, ein einzelner Vorschlag liegt auf einem anderen Wochentag —
   genau die berichtete Abendsituation ("stehen noch Vorschlaege, aber
   fuer heute ist nichts mehr offen").

   Auftrag B, Befund 2 (pruefeGrosseSchrift): iPhone SE, Grundschrift auf
   150 % (wie schrift.js) — bei nur noch 320px Breite und vergroesserter
   Schrift reichte der Platz neben "Uebernehmen"+"×" nicht mehr fuer die
   Zahl in der Leiste; "Vorschlaege" lief ueber den eigenen Rand hinaus
   und wurde vom spaeter gezeichneten Knopf verdeckt (kein Ueberlappen im
   Bild, aber auch kein vollstaendiger Text).

   Stil wie fuss.js/agenda.js: eine Chromium-Seite je Geraet, deutsche
   Ausgabe, Exit 1 bei Fehlern. Uhrzeit UND Datum sind ueber
   page.clock.setFixedTime() auf Mittwoch, 2026-08-05, Europe/Berlin
   genagelt (Vertrag dieses Projekts) — sonst haengt der Befund am
   Zufallszeitpunkt des Laufs statt an einer echten Luecke. Befund 1
   nutzt bewusst 20 Uhr (die tatsaechlich berichtete Abendsituation),
   der Rest des Skripts bleibt bei den bestehenden 10 Uhr.
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

// Befund 1: welche der beiden Kandidaten (Vorschlagen/Uebernehmen) tragen
// GERADE volltonigen Akzent? Ueber eine Sonde statt eine Klassenliste zu
// pruefen — die CSS-Regel fuer Befund 1 ueberschreibt nur die berechnete
// Farbe von #agendaVorschlag, die Klasse "btn--primary" bleibt im Markup
// stehen. Ein echter Vergleich der berechneten Hintergrundfarbe gegen
// eine frisch erzeugte .btn.btn--primary-Sonde erkennt das zuverlaessig,
// unabhaengig davon, in welcher Farbnotation --ink im Stylesheet steht.
async function betonteKnoepfe(p) {
  return p.evaluate(() => {
    const probe = document.createElement('button');
    probe.className = 'btn btn--primary';
    probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(probe);
    const inkBg = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const sichtbar = el => {
      if (!el) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const kandidaten = {
      vorschlagen: document.querySelector('#agendaVorschlag'),
      uebernehmen: document.querySelector('.sugbar__accept')
    };
    const ergebnis = {};
    for (const [name, el] of Object.entries(kandidaten)) {
      ergebnis[name] = { sichtbar: sichtbar(el), betont: sichtbar(el) && getComputedStyle(el).backgroundColor === inkBg };
    }
    return ergebnis;
  });
}

// Von Hand gebautes Szenario statt des echten Verteilers: der heutige Tag
// bleibt komplett leer (loest "Vorschlagen" aus), ein einzelner Vorschlag
// liegt auf einem anderen Tag derselben Woche (loest die Leiste aus). Setzt
// state.blocks komplett neu, damit kein Default-Eintrag aus dem
// Erststart-Assistenten dazwischenfunkt.
async function doppelknopfSzenario(p) {
  await p.evaluate(() => {
    const montag = mondayOf(anchor);
    const andererIdx = (selectedDayIdx + 1) % 7;
    state.blocks = [{
      id: uid(), title: 'Sport', areaId: state.areas[0].id,
      day: andererIdx, date: iso(addDays(montag, andererIdx)), repeat: 'none',
      start: 600, end: 660, frog: false, grob: false, sug: true
    }];
    state.tasks = [];
    setView('heute');
    save(); renderAll();
  });
  await p.waitForTimeout(200);
}

// Auftrag B, Befund 1 komplett: mit offener Leiste genau ein betonter
// Knopf, ohne Vorschlaege behaelt "Vorschlagen" seinen Akzent. Eigener,
// frischer Kontext (s. Aufrufer) — 20 Uhr, die tatsaechlich berichtete
// Abendsituation.
async function pruefeDoppelknopf(p, tag) {
  await onboardingWeg(p);
  await p.clock.setFixedTime(new Date('2026-08-05T20:00:00+02:00'));
  await doppelknopfSzenario(p);

  const bK = await betonteKnoepfe(p);
  console.log(`\n## ${tag} — Befund 1: betonte Knoepfe, Vorschlaege stehen, heute leer`);
  console.log('   ' + JSON.stringify(bK));
  ok(bK.vorschlagen.sichtbar && bK.uebernehmen.sichtbar,
    tag + ': beide Kandidaten ("Vorschlagen" und "Uebernehmen") sind gleichzeitig sichtbar (sonst waere der Fall gegenstandslos)');
  const anzahl = Number(bK.vorschlagen.betont) + Number(bK.uebernehmen.betont);
  ok(anzahl === 1, tag + `: genau EIN volltonig betonter Knopf im Blickfeld (gezaehlt: ${anzahl})`);
  ok(bK.uebernehmen.betont && !bK.vorschlagen.betont,
    tag + ': "Uebernehmen" traegt den Akzent, "Vorschlagen" weicht zurueck (Vorschlaege liegen schon vor)');
  await p.screenshot({ path: path.join(__dirname, `leiste-${tag}-doppelknopf-mit.png`) });

  // Gegenprobe: keine Vorschlaege mehr irgendwo in der Woche -> "Vorschlagen"
  // ist wieder die einzige anstehende Entscheidung und muss seinen Akzent
  // zurueckbekommen — sonst waere die Regel dauerhaft zurueckgewichen statt
  // bedingt zu sein.
  await p.evaluate(() => { state.blocks = []; save(); renderAll(); });
  await p.waitForTimeout(150);
  const bOhne = await betonteKnoepfe(p);
  console.log(`\n## ${tag} — Befund 1 Gegenprobe: keine Vorschlaege`);
  console.log('   ' + JSON.stringify(bOhne));
  ok(!bOhne.uebernehmen.sichtbar, tag + ': keine Vorschlaege -> Leiste ist weg');
  ok(bOhne.vorschlagen.sichtbar && bOhne.vorschlagen.betont,
    tag + ': ohne Vorschlaege behaelt "Vorschlagen" seinen Akzent (es ist wieder die Primaeraktion)');
  await p.screenshot({ path: path.join(__dirname, `leiste-${tag}-doppelknopf-ohne.png`) });
}

// Auftrag B, Befund 2: iPhone SE, Grundschrift auf 150% (wie schrift.js).
// Neun Vorschlaege auf einem anderen Tag (der Auftragswortlaut nennt genau
// "9 Vorschlaege" als reproduzierten Fall), heutiger Tag leer, damit die
// Leiste steht. Eigener, frischer Kontext.
async function pruefeGrosseSchrift(br) {
  const ctx = await br.newContext({ ...devices['iPhone SE'], timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  await onboardingWeg(p);
  await p.clock.setFixedTime(new Date('2026-08-05T10:00:00+02:00'));
  await p.evaluate(() => {
    const montag = mondayOf(anchor);
    const andererIdx = (selectedDayIdx + 1) % 7;
    const andererTag = iso(addDays(montag, andererIdx));
    state.blocks = Array.from({ length: 9 }, (_, i) => ({
      id: uid(), title: 'Sport ' + i, areaId: state.areas[0].id,
      day: andererIdx, date: andererTag, repeat: 'none',
      start: 480 + i * 60, end: 480 + i * 60 + 45, frog: false, grob: false, sug: true
    }));
    state.tasks = [];
    setView('heute');
    save(); renderAll();
  });
  await p.waitForTimeout(200);

  const vorher = await p.evaluate(() => ({
    sugbar: document.body.dataset.sugbar,
    text: document.querySelector('.sugbar__text') ? document.querySelector('.sugbar__text').textContent : null
  }));
  ok(vorher.sugbar === '1', 'iPhone SE: Vorschlagsleiste steht vor der Schrift-Pruefung (' + vorher.text + ')');

  // Grundschrift um zwei Stufen anheben — exakt wie schrift.js (dortiger
  // Kopfkommentar erklaert die Begruendung fuer "24px").
  await p.addStyleTag({ content: 'html { font-size: 24px; }' });
  await p.waitForTimeout(200);

  const m = await p.evaluate(() => {
    const R = el => el ? el.getBoundingClientRect() : null;
    const text = document.querySelector('.sugbar__text');
    const accept = document.querySelector('.sugbar__accept');
    const close = document.querySelector('.sugbar__close');
    const tr = R(text), ar = R(accept), cr = R(close);
    const overlap = (a, b) => !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    return {
      inhalt: text ? text.textContent : null,
      scrollWidth: text ? text.scrollWidth : null,
      clientWidth: text ? text.clientWidth : null,
      textRect: tr, acceptRect: ar, closeRect: cr,
      ueberlapptTextAccept: overlap(tr, ar),
      ueberlapptAcceptClose: overlap(ar, cr),
      ueberlapptTextClose: overlap(tr, cr),
      querScroll: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });
  console.log('\n## iPhone SE — Befund 2: Leiste bei 150% Schrift');
  console.log('   ' + JSON.stringify(m));
  ok(m.scrollWidth !== null && m.scrollWidth <= m.clientWidth + 2,
    `Label vollstaendig lesbar, nicht abgeschnitten (Inhalt "${m.inhalt}", scrollWidth ${m.scrollWidth} <= clientWidth ${m.clientWidth})`);
  ok(!m.ueberlapptTextAccept && !m.ueberlapptAcceptClose && !m.ueberlapptTextClose,
    'Text, "Uebernehmen" und "×" ueberlappen sich nicht');
  ok(!m.querScroll, 'kein waagerechtes Scrollen durch die breitere/hoehere Leiste');
  await p.screenshot({ path: path.join(__dirname, 'leiste-se-grossschrift-mit.png') });

  console.log('\n=== Konsolenfehler (Befund 2, iPhone SE 150%):', konsolenfehler.length ? konsolenfehler : 'keine');
  if (konsolenfehler.length) fehler.push('Konsolenfehler aufgetreten (Befund 2, iPhone SE 150%)');

  await ctx.close();
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

    // Auftrag B, Befund 1: eigener frischer Kontext (leeres localStorage),
    // sonst zeigt der Erststart-Assistent von onboardingWeg() sich nicht
    // mehr, weil schon ein Stand aus der Pruefung oben gespeichert waere.
    const ctx2 = await br.newContext({ ...devices[geraet], timezoneId: 'Europe/Berlin' });
    const p2 = await ctx2.newPage();
    const konsolenfehler2 = [];
    p2.on('pageerror', e => konsolenfehler2.push('PAGEERROR: ' + e.message));
    p2.on('console', m => { if (m.type() === 'error') konsolenfehler2.push('CONSOLE: ' + m.text()); });
    await pruefeDoppelknopf(p2, tag);
    console.log(`\n=== Konsolenfehler (Befund 1, ${geraet}):`, konsolenfehler2.length ? konsolenfehler2 : 'keine');
    if (konsolenfehler2.length) fehler.push(`Konsolenfehler aufgetreten (Befund 1, ${geraet})`);
    await ctx2.close();
  }

  // Auftrag B, Befund 2: iPhone SE, Grundschrift 150% (Auftragswortlaut
  // nennt ausdruecklich dieses Geraet als schmalsten Fall).
  await pruefeGrosseSchrift(br);

  await br.close();

  console.log('\n' + (fehler.length ? `${fehler.length} FEHLER:` : 'Alle Pruefungen bestanden.'));
  fehler.forEach(f => console.log('  - ' + f));
  process.exit(fehler.length ? 1 : 0);
})();
