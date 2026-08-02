/* ============================================================
   Prüfskript Haken (Stufe 5) — iPhone SE (320x568)

   Prüft, was der Bericht zu Stufe 5 über das Abhaken behauptet:
     a) Agenda   — ein einmaliger Eintrag, über die Agenda abgehakt, erzeugt
                   genau EINEN Schlüssel in state.erledigt.
     b) Blatt    — derselbe Eintrag, danach über den Blockeditor (#bDone)
                   wieder abgehakt/entgehakt, erzeugt KEINEN zweiten
                   Schlüssel (hakenKey hängt am Paar Eintrag+Datum, nicht am
                   Weg, über den abgehakt wurde).
     c) Woche    — ein wöchentlicher Eintrag, an zwei verschiedenen Wochen
                   (gleicher Wochentag, verschiedenes Datum) abgehakt, erzeugt
                   ZWEI Schlüssel — und das Abhaken der einen Woche lässt die
                   andere unberührt.
     d) 44x44    — die Trefferfläche des Agenda-Häkchens ist mindestens
                   44 x 44 (echte Box + unsichtbares ::before unter
                   pointer:coarse, siehe index.html ~1215).

   Stil wie agenda.js: eine Chromium-Seite, deutsche Ausgabe, Exit 1 bei
   Fehlern.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK   ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone SE'] });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  await p.goto(F); await p.waitForTimeout(500);

  // Erststart-Assistent wegklicken (wie agenda.js/audit.js).
  for (let i = 0; i < 3; i++) { await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(280); }
  await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(900);

  // Testdaten: ein einmaliger Eintrag und ein wöchentlicher, beide heute in
  // der Zukunft (relativ zu "jetzt"), damit beide sicher in "Danach" der
  // Agenda auftauchen, unabhängig von der Uhrzeit des Skriptlaufs.
  await p.evaluate(() => {
    state.settings.dayStart = 0; state.settings.dayEnd = 24;
    const dayIdx = (new Date().getDay() + 6) % 7;
    const dayKey = iso(addDays(mondayOf(anchor), dayIdx));
    const cap = m => Math.max(0, Math.min(1439, m));
    const jetzt = new Date().getHours() * 60 + new Date().getMinutes();
    const s1 = cap(jetzt + 60), e1 = cap(s1 + 30);
    const s2 = cap(jetzt + 180), e2 = cap(s2 + 30);
    state.blocks.push({
      id: 'blk-einmal', title: 'Einmalig Test', areaId: state.areas[0].id,
      day: dayIdx, date: dayKey, repeat: 'none', since: dayKey,
      start: s1, end: e1, frog: false
    });
    state.blocks.push({
      id: 'blk-woche', title: 'Wöchentlich Test', areaId: state.areas[0].id,
      day: dayIdx, date: dayKey, repeat: 'weekly', since: dayKey,
      start: s2, end: e2, frog: false
    });
    save(); setView('heute'); renderAll();
  });
  await p.waitForTimeout(200);

  /* ---- a) Agenda-Haken: einmaliger Eintrag ---------------------------- */
  console.log('\n## a) Agenda-Haken (einmaliger Eintrag)');
  const vorA = await p.evaluate(() => Object.keys(state.erledigt).length);
  ok(vorA === 0, 'vor dem Klick: state.erledigt ist leer (' + vorA + ')');

  await p.click(".agenda__check[data-id='blk-einmal']");
  await p.waitForTimeout(150);

  const nachA = await p.evaluate(() => {
    const dayKey = iso(addDays(mondayOf(anchor), (new Date().getDay() + 6) % 7));
    const b = state.blocks.find(x => x.id === 'blk-einmal');
    return {
      keys: Object.keys(state.erledigt),
      erwarteterKey: hakenKey(b, dayKey),
      erledigt: istErledigt(b, dayKey)
    };
  });
  ok(nachA.keys.length === 1, 'genau EIN Schlüssel in state.erledigt nach dem Agenda-Klick (' + nachA.keys.length + ')');
  ok(nachA.keys[0] === nachA.erwarteterKey, 'der Schlüssel ist genau hakenKey(Eintrag, Tag) (' + nachA.keys[0] + ')');
  ok(nachA.erledigt === true, 'istErledigt() meldet den Eintrag als erledigt');

  /* ---- b) Dasselbe über das Blatt: kein zweiter Schlüssel -------------- */
  console.log('\n## b) Blockeditor (#bDone) auf demselben Eintrag');
  await p.evaluate(() => editBlock('blk-einmal', iso(addDays(mondayOf(anchor), (new Date().getDay() + 6) % 7))));
  await p.waitForTimeout(150);
  const bDoneVor = await p.evaluate(() => document.querySelector('#bDone').checked);
  ok(bDoneVor === true, '#bDone zeigt beim Öffnen denselben Haken wie die Agenda');

  // Entghaken über das Blatt und speichern.
  await p.click('#bDone');
  await p.click(".sheet__foot .btn--primary"); // Speichern
  await p.waitForTimeout(150);
  const nachEntghaken = await p.evaluate(() => {
    const dayKey = iso(addDays(mondayOf(anchor), (new Date().getDay() + 6) % 7));
    const b = state.blocks.find(x => x.id === 'blk-einmal');
    return { keys: Object.keys(state.erledigt).length, erledigt: istErledigt(b, dayKey) };
  });
  ok(nachEntghaken.erledigt === false, 'nach dem Entghaken über das Blatt: nicht mehr erledigt');
  ok(nachEntghaken.keys === 1, 'weiterhin genau EIN Schlüssel — kein zweiter entstanden (' + nachEntghaken.keys + ')');

  // Wieder abhaken über das Blatt.
  await p.evaluate(() => editBlock('blk-einmal', iso(addDays(mondayOf(anchor), (new Date().getDay() + 6) % 7))));
  await p.waitForTimeout(150);
  await p.click('#bDone');
  await p.click(".sheet__foot .btn--primary"); // Speichern
  await p.waitForTimeout(150);
  const nachWiederhaken = await p.evaluate(() => {
    const dayKey = iso(addDays(mondayOf(anchor), (new Date().getDay() + 6) % 7));
    const b = state.blocks.find(x => x.id === 'blk-einmal');
    return { keys: Object.keys(state.erledigt).length, erledigt: istErledigt(b, dayKey) };
  });
  ok(nachWiederhaken.erledigt === true, 'nach dem erneuten Abhaken über das Blatt: wieder erledigt');
  ok(nachWiederhaken.keys === 1, 'weiterhin genau EIN Schlüssel, auch nach dem zweiten Wechsel über das Blatt (' + nachWiederhaken.keys + ')');

  /* ---- c) Wöchentlicher Eintrag über zwei Wochen ----------------------- */
  console.log('\n## c) Wöchentlicher Eintrag, zwei Wochen abgehakt');
  const woche1 = await p.evaluate(() => iso(addDays(mondayOf(anchor), (new Date().getDay() + 6) % 7)));

  await p.click(".agenda__check[data-id='blk-woche']");
  await p.waitForTimeout(150);
  const nachWoche1 = await p.evaluate(w1 => {
    const b = state.blocks.find(x => x.id === 'blk-woche');
    return { erledigt: istErledigt(b, w1), keys: Object.keys(state.erledigt) };
  }, woche1);
  ok(nachWoche1.erledigt === true, 'Woche 1 (' + woche1 + ') ist abgehakt');
  ok(nachWoche1.keys.length === 2, 'zwei Schlüssel insgesamt (einmaliger Eintrag + wöchentlicher, Woche 1) — (' + nachWoche1.keys.length + ')');

  // Eine Woche vorblättern — derselbe Eintrag erscheint am selben
  // Wochentag, aber mit anderem Datum.
  await p.click('#nextWeek');
  await p.waitForTimeout(200);
  const woche2 = await p.evaluate(() => iso(addDays(mondayOf(anchor), (new Date().getDay() + 6) % 7)));
  ok(woche2 !== woche1, 'Woche 2 hat ein anderes Datum als Woche 1 (' + woche1 + ' / ' + woche2 + ')');

  const vorWoche2 = await p.evaluate(({ w1, w2 }) => {
    const b = state.blocks.find(x => x.id === 'blk-woche');
    return { woche1: istErledigt(b, w1), woche2: istErledigt(b, w2) };
  }, { w1: woche1, w2: woche2 });
  ok(vorWoche2.woche1 === true, 'vor dem Abhaken von Woche 2: Woche 1 bleibt weiterhin erledigt');
  ok(vorWoche2.woche2 === false, 'vor dem Abhaken von Woche 2: Woche 2 ist noch NICHT erledigt (kein Serien-Effekt)');

  await p.click(".agenda__check[data-id='blk-woche']");
  await p.waitForTimeout(150);
  const nachWoche2 = await p.evaluate(({ w1, w2 }) => {
    const b = state.blocks.find(x => x.id === 'blk-woche');
    return {
      woche1: istErledigt(b, w1), woche2: istErledigt(b, w2),
      key1: hakenKey(b, w1), key2: hakenKey(b, w2),
      keys: Object.keys(state.erledigt)
    };
  }, { w1: woche1, w2: woche2 });
  ok(nachWoche2.woche2 === true, 'nach dem Abhaken von Woche 2: Woche 2 ist erledigt');
  ok(nachWoche2.woche1 === true, 'Woche 1 bleibt unverändert erledigt — das Abhaken von Woche 2 hat sie nicht angerührt');
  ok(nachWoche2.key1 !== nachWoche2.key2, 'die beiden Schlüssel unterscheiden sich (Datum ist Teil des Schlüssels): ' + nachWoche2.key1 + ' / ' + nachWoche2.key2);
  ok(nachWoche2.keys.includes(nachWoche2.key1) && nachWoche2.keys.includes(nachWoche2.key2),
    'beide Schlüssel stehen in state.erledigt');
  ok(nachWoche2.keys.length === 3, 'insgesamt drei Schlüssel (einmalig + zwei Wochen des wöchentlichen Eintrags) — (' + nachWoche2.keys.length + ')');

  // Woche zurücksetzen für den Rest des Laufs.
  await p.evaluate(() => { anchor = new Date(); selectedDayIdx = (new Date().getDay() + 6) % 7; renderAll(); });
  await p.waitForTimeout(150);

  /* ---- d) Trefferfläche des Agenda-Häkchens ---------------------------- */
  console.log('\n## d) Trefferfläche des Agenda-Häkchens (>= 44 x 44)');
  const treffer = await p.evaluate(() => {
    const cb = document.querySelector('.agenda__check');
    if (!cb) return null;
    const r = cb.getBoundingClientRect();
    const cs = getComputedStyle(cb, '::before');
    // ::before ist per "position:absolute; inset: -14px" unter pointer:coarse
    // rundum ausgeweitet — kein eigenes Rechteck über getBoundingClientRect
    // messbar (Pseudo-Element), deshalb aus der Box + dem berechneten Inset.
    const hatBefore = cs.content !== 'none' && cs.content !== '""' ? true : cs.content === '""';
    const parse = v => v === 'auto' || !v ? 0 : parseFloat(v);
    // inset ist ein Kurzform-Property; manche Engines liefern es zusammen,
    // manche über die vier Einzelwerte — beide abdecken.
    let li = parse(cs.left), ri = parse(cs.right), ti = parse(cs.top), bi = parse(cs.bottom);
    if (cs.inset && cs.inset !== 'auto') {
      const teile = cs.inset.trim().split(/\s+/).map(parseFloat);
      const [t, rr, b2, l2] = teile.length === 1 ? [teile[0], teile[0], teile[0], teile[0]]
        : teile.length === 2 ? [teile[0], teile[1], teile[0], teile[1]]
        : teile.length === 3 ? [teile[0], teile[1], teile[2], teile[1]]
        : teile;
      ti = t; ri = rr; bi = b2; li = l2;
    }
    return {
      hatBefore, box: { w: r.width, h: r.height },
      erweitert: { w: r.width + Math.abs(li) + Math.abs(ri), h: r.height + Math.abs(ti) + Math.abs(bi) }
    };
  });
  if (!treffer) {
    ok(false, 'kein .agenda__check im DOM gefunden — Testdaten prüfen');
  } else {
    console.log('   Box: ' + JSON.stringify(treffer.box) + ', mit ::before erweitert: ' + JSON.stringify(treffer.erweitert));
    ok(treffer.hatBefore, 'das Häkchen hat ein ::before (pointer:coarse-Erweiterung greift)');
    ok(treffer.erweitert.w >= 44 && treffer.erweitert.h >= 44,
      'erweiterte Trefferfläche ist mindestens 44 x 44 (' + treffer.erweitert.w + ' x ' + treffer.erweitert.h + ')');
  }

  console.log('\n=== Konsolenfehler: ' + (konsolenfehler.length ? konsolenfehler.join(' | ') : 'keine'));
  if (konsolenfehler.length) fehler.push('Konsolenfehler aufgetreten');

  await br.close();
  if (fehler.length) { console.log('\n=== FEHLER (' + fehler.length + '):'); fehler.forEach(f => console.log(' - ' + f)); process.exit(1); }
  console.log('\nAlle Prüfungen bestanden.');
})();
