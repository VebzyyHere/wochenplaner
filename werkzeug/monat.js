/* ============================================================
   Prüfskript Monatsübersicht (Stufe M1) — monatSheet() (Auslöser
   #monthBtn in der Topbar) beantwortet "wann ist noch Luft" als Karte
   der Wochen: ein 6×7-Raster (KW-Rinne + Mo-So), Zellen zeigen NUR
   Auslastung/"freigehalten"/"heute" — kein Informationskalender.

   Feste Uhr, zoniert: Mittwoch 2026-08-05T10:00:00+02:00, Europe/Berlin
   (Hausvertrag — ungenagelte Zeit hat in diesem Projekt schon sechsmal
   falsches Vertrauen erzeugt).

   a) Raster August 2026: welche KW-Zeilen tatsächlich erscheinen (siehe
      Kasten unten — der Auftragstext nannte "32–36", die nachgerechnete
      und hier geprüfte Wahrheit ist 31–36), Tagesnummern an beiden
      Monatsrändern, heute-Kreis auf dem 5.8., 3.–4.8. gedimmt (vergangen),
      6.8.+ nicht.
   b) Serienprojektion: die wöchentliche Arbeit trägt in KW 34/35 einen
      Auslastungsstrich (beweist onDay() in die Zukunft); der zweiwöchent-
      liche Termin erscheint in KW 32/34/36, nicht in KW 33/35 (Paritäts-
      probe über Zellstriche UND KW-Rinnen-Prozente).
   c) Freigehaltener Tag zeigt einen Ring statt eines Strichs; ein Tag mit
      grobem Block zählt trotzdem im Strich mit (dauerVon()).
   d) Tages-Tipp: anchor auf die Woche des Tages, selectedDayIdx, Ansicht
      "plan" (body[data-mview]), Blatt zu.
   e) KW-"+" auf einer leeren Zukunftswoche: bei knapper Kapazität "Das
      wird eng" statt still zu verteilen, sonst entstehen Vorschläge genau
      in dieser Woche. planeNaechsteWoche()-Regression: ein direkter
      Aufruf verhält sich wie vor der Stufe (Vorschläge/Toast), jetzt
      zusätzlich durchs Gate — beide Zweige (offen/eng) laufen je einmal,
      über zwei verschiedene Zielwochen derselben festen Uhr statt über
      eine zweite Uhrzeit (das Kapazitäts-Gate unterscheidet ohnehin nicht
      nach Uhrzeit, sobald die Zielwoche in der Zukunft liegt — s.
      wochenKapazitaet()/kapazitaet.js Abschnitt c).
   f) Monatsblättern ‹ › über die Jahresgrenze (Dez 2026 → Jan 2027) und
      zurück; "Heute"-Knopf springt zurück; bloßes Blättern lässt den
      globalen anchor und das Topbar-Label unangetastet.
   g) Trefferflächen: Zellen und KW-Knöpfe effektiv ≥ 44×44 px (Messmuster
      aus haken.js: Box + berechnetes ::before).
   h) Maskierung: keiner der Fixture-Titel (Bereichs-/Blocknamen) landet
      irgendwo im gerenderten Monatsblatt — M1 zeigt sie gar nicht erst,
      also auch nichts zu escapen.

   Ab hier Stufe M3 ("Der Zoom schließt sich") — dieselbe feste Uhr:
   i) Monatstitel bei 320px einzeilig in allen zwölf Monatsnamen (Stufe
      M3.4), jeweils MIT sichtbarem "Heute"-Knopf (der Bug trat nur dann
      auf — er nimmt der Titelzeile die Breite); Titelhöhe ≤ 1,5
      Zeilenhöhen. Bei 375px ist die Jahreszahl (.monat__jahr) wieder
      sichtbar — die 320px-Lösung blendet sie nicht generell aus.
   j) KW-Tipp auf die aktuelle Woche (Stufe M3.2): öffnet jetzt das
      Wochen-Blatt (freizeitSheet()) in genau dieser Woche statt in den
      Plan zu springen; #freizeitTitel nennt die richtige Woche, der
      globale anchor bleibt unbewegt — auch wenn er beim Öffnen auf einer
      anderen Woche stand (Kerninvariante dieser Stufe).
   k) KW-Tipp auf eine vergangene Woche (Stufe M3.2): dieselbe Umzielung;
      zusätzlich der frühere disabled-Zustand weg (Rückblick möglich),
      aria-label "KW 31 ansehen", weiterhin optisch gedimmt (is-past).
   l) "+" auf eine künftige Woche bleibt wie bisher (Regression) — und der
      Erfolgs-Toast unterscheidet jetzt nach Distanz zur echten Heute-Woche
      (Stufe M3.3): KW33 (+1 Woche) bleibt wörtlich "…nächste Woche…",
      KW34 (+2 Wochen, dieselbe Zielwoche wie in e1 oben) heißt "…KW 34…".

   ACHTUNG KW-ZEILEN — Abweichung vom Auftragstext, hier bewusst:
   Der Auftrag nannte "KW-Zeilen 32–36" für August 2026. Nachgerechnet
   (isoWeek() direkt im Browser ausgeführt, nicht nur von Hand) gilt:
   Jul27–Aug2 IST die Woche, die den 1.8. enthält, und ISO-Woche 31 (Do
   30.7. ist Tag 211, (211-1)/7=30, Woche 31) — nicht 32. Aug31–Sep6 ist
   Woche 36. Ein Raster "32–36" ließe den 1./2.8. komplett aus dem
   Kalender fallen — im Widerspruch zum selben Auftragssatz "Tagesnummern
   stimmen an beiden Monatsrändern", der gerade Randüberstand an BEIDEN
   Enden voraussetzt. monatMontage() (index.html) baut darum nach dem
   Standard-Kalenderraster: jede Woche, die mindestens einen Tag des
   Monats trägt — das ergibt 31–36 (sechs Zeilen), und genau das prüft
   Abschnitt a) unten. Siehe Bericht für die Herleitung.

   Rot-Beweis: `git stash push -- index.html` gegen HEAD (vor Stufe M1),
   Skript erneut laufen lassen — d) und e) schlagen fehl, weil es weder
   #monthBtn noch monatSheet() gibt (kein Klickziel, kein Blatt, keine
   Selektoren treffen). a)/b)/c)/f)/g) fallen ebenfalls, weil das Raster
   selbst fehlt. h) bleibt grün (nichts zu prüfen, wenn nichts da ist) —
   deshalb hängt der Rot-Beweis an d)/e), wie im Auftrag verlangt.
   `git stash pop` stellt den Stand danach wieder her.

   Stufe M3 (i–l): eigener Rot-Beweis gegen den NEUEN HEAD (68b0541 — M1/M2
   sind darin schon enthalten, nur M3 fehlt noch). `git stash push --
   index.html`, Skript erneut laufen lassen:
     i) der Titel bricht bei vier der zwölf Monate weiterhin um (kein
        .monat__jahr zum Ausblenden vorhanden); der 375px-Zusatzcheck
        findet .monat__jahr gar nicht erst.
     j) die aktuelle Woche springt weiterhin in den Plan statt ins
        Wochen-Blatt (#freizeitTitel bleibt weg, anchor bewegt sich doch).
     k) KW31 ist weiterhin disabled — die aria-/is-past-Zusicherungen
        schlagen fehl, der Klick selbst bleibt darum aus (kein Hänger an
        einem nicht-anklickbaren Knopf; s. "Defensiv" unten).
     l) der Toast heißt für KW34 (+2 Wochen) weiterhin wörtlich "…nächste
        Woche…", nicht "…KW 34…" (KW33/+1 bleibt ohnehin unverändert grün).
   `git stash pop` stellt den Stand danach wieder her.

   Stil wie freiwoche.js/serie.js: eine Chromium-Seite (iPhone SE),
   deutsche Ausgabe, Exit 1 bei Fehlern. Defensiv gegen den Rot-Fall
   gebaut (Abschnitte prüfen Existenz vor Klick/Zugriff, damit das
   Skript beim alten Stand nicht mit einer nicht abgefangenen Exception
   abbricht, sondern FEHLER-Zeilen schreibt).
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');
const UHR = '2026-08-05T10:00:00+02:00'; // Mittwoch

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

// Baut die im Kopfkommentar beschriebene Fixture auf: Arbeit Mo-Fr
// (langjährig etabliert), ein zweiwöchentlicher Termin, ein Wochenziel,
// ein freigehaltener Tag, ein Tag mit grobem Block, plus zwei Bloecke NUR
// in KW35, damit genau diese Zukunftswoche eng wird (KW34 bleibt mit
// demselben Wochenziel im Grünen — Zahlen vorab gegen wochenKapazitaet()
// verifiziert, s. Bericht).
async function fixtureAufbauen(p) {
  return p.evaluate(() => {
    if (typeof closeModal === 'function') closeModal();
    state = freshState(); migrate(state);

    for (let d = 0; d < 5; d++) {
      state.blocks.push({
        id: 'arbeit-' + d, title: 'Arbeit', areaId: 'a1', day: d,
        date: iso(addDays(new Date(2026, 0, 5), d)), repeat: 'weekly', since: '2026-01-05',
        start: 9 * 60, end: 17 * 60, frog: false, grob: false
      });
    }
    // Donnerstags, since = Montag KW32 (3.8.) -> Parität KW32/34/36 ja,
    // KW33/35 nein.
    state.blocks.push({
      id: 'termin2w', title: 'Zahnarzt Kontrolle', areaId: 'a7', day: 3,
      date: '2026-08-06', repeat: '2wochen', since: '2026-08-03',
      start: 18 * 60, end: 19 * 60 + 30, frog: false, grob: false
    });
    // Sonntag 9.8. (KW32), grob -> zaehlt im Strich trotz fehlender Uhrzeit.
    state.blocks.push({
      id: 'grob1', title: 'Lesen', areaId: 'a5', date: '2026-08-09',
      grob: true, teil: 'ab', dauer: 90, frog: false
    });
    // Samstag 15.8. (KW33), freigehalten -> Ring statt Strich.
    dayMeta('2026-08-15').frei = true;
    // Wochenziel a2 = 20h, in jeder leeren Zukunftswoche gleich offen.
    state.areas.find(a => a.id === 'a2').plan.goal = 20;
    // Nur in KW35 (24.-30.8.): zwei zusaetzliche Bloecke, die genau diese
    // Woche ueber die 65%-Grenze drueben (KW34 bleibt unberuehrt).
    state.blocks.push({
      id: 'extra1', title: 'Umzug vorbereiten', areaId: 'a7', date: '2026-08-29',
      repeat: 'none', start: 9 * 60, end: 15 * 60, frog: false, grob: false
    });
    state.blocks.push({
      id: 'extra2', title: 'Umzug vorbereiten 2', areaId: 'a7', date: '2026-08-30',
      repeat: 'none', start: 9 * 60, end: 13 * 60, frog: false, grob: false
    });

    anchor = new Date(2026, 7, 5); // Mittwoch 5.8. -- dieselbe Woche wie die feste Uhr
    selectedDayIdx = 2;
    save(); setView('heute'); renderAll();
  });
}

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone SE'], timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  await p.clock.setFixedTime(new Date(UHR));
  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(150);

  await fixtureAufbauen(p);
  await p.waitForTimeout(200);

  /* ---- Öffnen über den echten Weg (#monthBtn) -------------------------- */
  console.log('\n=== Öffnen: #monthBtn ===');
  const monthBtnDa = await p.locator('#monthBtn').count() > 0;
  ok(monthBtnDa, '#monthBtn existiert in der Topbar');
  if (monthBtnDa) {
    const label = await p.evaluate(() => document.getElementById('monthBtn').getAttribute('aria-label'));
    ok(!!label, '#monthBtn hat ein aria-label (' + JSON.stringify(label) + ')');
    await p.click('#monthBtn');
    await p.waitForTimeout(300);
  }
  const offenNachKlick = await p.evaluate(() => !!document.querySelector('.sheet'));
  ok(offenNachKlick, 'ein Blatt ist nach dem Klick offen');
  const titelNachOeffnen = offenNachKlick
    ? await p.evaluate(() => (document.querySelector('.sheet__title') || {}).textContent)
    : null;
  ok(titelNachOeffnen === 'August 2026', 'Titel "August 2026" beim Öffnen (war: ' + JSON.stringify(titelNachOeffnen) + ')');

  /* ---- a) Raster August 2026 -------------------------------------------- */
  console.log('\n=== a) Raster August 2026 ===');
  const a1 = offenNachKlick ? await p.evaluate(() => {
    const wochenZeilen = [...document.querySelectorAll('.monatweek b')].map(b => +b.textContent);
    const heuteZellen = [...document.querySelectorAll('.monatcell.is-today')].map(c => c.dataset.date);
    const bereich = (von, bis) => { const o = {}; for (const s of [von, bis]) o[s] = null; return o; };
    const zelle = key => document.querySelector('.monatcell[data-date="' + key + '"]:not(.monatcell--leer)');
    const leer = key => !!document.querySelector('.monatcell--leer[data-date="' + key + '"]');
    return {
      wochenZeilen,
      heuteZellen,
      // Linker Rand (Woche 31: Jul27-31 leer, 1./2.8. real).
      jul27leer: leer('2026-07-27'), jul31leer: leer('2026-07-31'),
      aug1: (zelle('2026-08-01') || {}).textContent || null,
      aug2: (zelle('2026-08-02') || {}).textContent || null,
      // Rechter Rand (Woche 36: 31.8. real, Sep1-6 leer).
      aug31: (zelle('2026-08-31') || {}).textContent || null,
      sep1leer: leer('2026-09-01'), sep6leer: leer('2026-09-06'),
      // Vergangenheit/Zukunft relativ zur festen Uhr (Mi 5.8.).
      aug3cls: (document.querySelector('.monatcell[data-date="2026-08-03"]') || {}).className || null,
      aug4cls: (document.querySelector('.monatcell[data-date="2026-08-04"]') || {}).className || null,
      aug6cls: (document.querySelector('.monatcell[data-date="2026-08-06"]') || {}).className || null,
      aug5cls: (document.querySelector('.monatcell[data-date="2026-08-05"]') || {}).className || null
    };
  }) : null;

  if (!a1) {
    ok(false, 'a) kein Raster gefunden — Abschnitt a) komplett fehlgeschlagen');
  } else {
    console.log('   KW-Zeilen: ' + JSON.stringify(a1.wochenZeilen));
    ok(JSON.stringify(a1.wochenZeilen) === JSON.stringify([31, 32, 33, 34, 35, 36]),
      'a) sechs KW-Zeilen 31-36 (nachgerechnet, s. Kopfkommentar) — war ' + JSON.stringify(a1.wochenZeilen));
    ok(a1.jul27leer && a1.jul31leer, 'a) linker Rand: 27.-31.7. sind leere Füllzellen (außerhalb August)');
    ok(a1.aug1 === '1' && a1.aug2 === '2', 'a) linker Rand: 1./2.8. zeigen ihre echten Tagesnummern (' + a1.aug1 + '/' + a1.aug2 + ')');
    ok(a1.aug31 === '31', 'a) rechter Rand: 31.8. zeigt seine echte Tagesnummer (' + a1.aug31 + ')');
    ok(a1.sep1leer && a1.sep6leer, 'a) rechter Rand: 1.-6.9. sind leere Füllzellen (außerhalb August)');
    ok(a1.heuteZellen.length === 1 && a1.heuteZellen[0] === '2026-08-05',
      'a) genau ein heute-Kreis, auf dem 5.8. (' + JSON.stringify(a1.heuteZellen) + ')');
    ok(a1.aug3cls.includes('is-vergangen') && a1.aug4cls.includes('is-vergangen'),
      'a) 3./4.8. sind gedimmt (vergangen)');
    ok(!a1.aug6cls.includes('is-vergangen'), 'a) 6.8. ist NICHT gedimmt (noch nicht vergangen)');
    ok(!a1.aug5cls.includes('is-vergangen'), 'a) der heutige Tag selbst gilt nicht als "vergangen"');
  }

  /* ---- b) Serienprojektion + Paritätsprobe ------------------------------ */
  console.log('\n=== b) Serienprojektion (Arbeit in KW 34/35) + Paritätsprobe (2-Wochen-Termin) ===');
  const b1 = offenNachKlick ? await p.evaluate(() => {
    const strich = key => {
      const el = document.querySelector('.monatcell[data-date="' + key + '"]:not(.monatcell--leer)');
      return el ? { last: el.style.getPropertyValue('--last'), cls: el.className } : null;
    };
    const kwPct = monday => {
      const el = document.querySelector('.monatweek[data-monday="' + monday + '"] .monatweek__pct');
      return el ? el.textContent : null;
    };
    return {
      // KW34 Montag (17.8.) und KW35 Montag (24.8.) -- beide Arbeitstage.
      arbeit34: strich('2026-08-17'), arbeit35: strich('2026-08-24'),
      // 2-Wochen-Termin: Donnerstage in KW32 (6.8., da), KW33 (13.8., nicht),
      // KW34 (20.8., da).
      do_kw32: strich('2026-08-06'), do_kw33: strich('2026-08-13'), do_kw34: strich('2026-08-20'),
      pctKw32: kwPct('2026-08-03'), pctKw33: kwPct('2026-08-10')
    };
  }) : null;

  if (!b1) {
    ok(false, 'b) kein Raster gefunden — Abschnitt b) komplett fehlgeschlagen');
  } else {
    ok(!!b1.arbeit34 && b1.arbeit34.last !== '0%', 'b) 17.8. (KW34, Mo) trägt einen Auslastungsstrich (' + JSON.stringify(b1.arbeit34) + ')');
    ok(!!b1.arbeit35 && b1.arbeit35.last !== '0%', 'b) 24.8. (KW35, Mo) trägt ebenfalls einen Auslastungsstrich (' + JSON.stringify(b1.arbeit35) + ') — Serie projiziert zwei Wochen in die Zukunft');
    console.log('   2-Wochen-Termin: Do KW32=' + JSON.stringify(b1.do_kw32) + ' KW33=' + JSON.stringify(b1.do_kw33) + ' KW34=' + JSON.stringify(b1.do_kw34));
    ok(!!b1.do_kw32 && !!b1.do_kw33 && b1.do_kw32.last !== b1.do_kw33.last,
      'b) Paritätsprobe (Zellstriche): Donnerstag KW32 und KW33 unterscheiden sich messbar (' + b1.do_kw32.last + ' vs ' + b1.do_kw33.last + ')');
    ok(!!b1.do_kw34 && b1.do_kw34.last === b1.do_kw32.last,
      'b) KW34 (Termin da, wie KW32) hat denselben Strich wie KW32 (' + b1.do_kw34.last + ' === ' + b1.do_kw32.last + ')');
    ok(b1.pctKw32 !== null && b1.pctKw33 !== null && b1.pctKw32 !== b1.pctKw33,
      'b) Paritätsprobe (KW-Rinne): Prozent von KW32 und KW33 unterscheiden sich ebenfalls (' + b1.pctKw32 + ' vs ' + b1.pctKw33 + ')');
  }

  /* ---- c) Freigehalten (Ring) + grober Block (zählt im Strich) --------- */
  console.log('\n=== c) Freigehaltener Tag (Ring) + grober Block (zählt im Strich) ===');
  const c1 = offenNachKlick ? await p.evaluate(() => {
    const frei = document.querySelector('.monatcell[data-date="2026-08-15"]');
    const grob = document.querySelector('.monatcell[data-date="2026-08-09"]');
    return {
      freiCls: frei ? frei.className : null,
      freiHatRing: !!(frei && getComputedStyle(frei.querySelector('.monatcell__bar'), null).boxShadow !== 'none'),
      grobCls: grob ? grob.className : null,
      grobLast: grob ? grob.style.getPropertyValue('--last') : null,
      grobLabel: grob ? grob.getAttribute('aria-label') : null
    };
  }) : null;

  if (!c1) {
    ok(false, 'c) kein Raster gefunden — Abschnitt c) komplett fehlgeschlagen');
  } else {
    ok(!!c1.freiCls && c1.freiCls.includes('is-frei'), 'c) 15.8. trägt die Klasse is-frei (' + c1.freiCls + ')');
    ok(c1.freiHatRing, 'c) 15.8. zeigt einen Ring (box-shadow) statt eines Balkens');
    ok(!!c1.grobCls && !c1.grobCls.includes('is-frei'), 'c) 9.8. (grober Block) ist NICHT freigehalten (' + c1.grobCls + ')');
    ok(c1.grobLast !== '0%', 'c) 9.8. trägt trotz grobem Block (keine Uhrzeit) einen Strich > 0 % (' + c1.grobLast + ')');
    ok(!!c1.grobLabel && c1.grobLabel.includes('1,5 h'), 'c) aria-label von 9.8. nennt die Dauer des groben Blocks (90 min = 1,5 h): ' + JSON.stringify(c1.grobLabel));
  }

  /* ---- d) Tages-Tipp ----------------------------------------------------- */
  console.log('\n=== d) Tages-Tipp (20.8., Donnerstag KW34) ===');
  let sheetOffenVorD = offenNachKlick;
  if (!sheetOffenVorD) {
    // Rot-Fall: ohne Blatt gibt es nichts zu tippen -- Existenzprüfung
    // erzeugt hier gezielt die FEHLER-Zeile, statt an einem Playwright-
    // Timeout beim Klick auf ein nicht vorhandenes Element zu zerschellen.
    ok(false, 'd) kein offenes Blatt -- Tages-Tipp kann nicht geprüft werden');
  } else {
    const zelleDa = await p.locator('.monatcell[data-date="2026-08-20"]').count() > 0;
    ok(zelleDa, 'd) Zelle für den 20.8. existiert im Raster');
    if (zelleDa) await p.click('.monatcell[data-date="2026-08-20"]');
    await p.waitForTimeout(250);
    const d1 = await p.evaluate(() => ({
      sheetWeg: !document.querySelector('.sheet'),
      anchorMon: iso(mondayOf(anchor)),
      selectedDayIdx,
      mview: document.body.dataset.mview
    }));
    console.log('   ' + JSON.stringify(d1));
    ok(d1.sheetWeg, 'd) das Blatt ist nach dem Tages-Tipp zu');
    ok(d1.anchorMon === '2026-08-17', 'd) anchor steht auf dem Montag der Woche des Tages (17.8., war ' + d1.anchorMon + ')');
    ok(d1.selectedDayIdx === 3, 'd) selectedDayIdx zeigt auf Donnerstag (3), war ' + d1.selectedDayIdx);
    ok(d1.mview === 'plan', 'd) body[data-mview] ist "plan" (war ' + JSON.stringify(d1.mview) + ')');
  }

  /* ---- e) KW-"+" (Vorausplanen aus dem Monatsblatt) + Gate-Regression --- */
  console.log('\n=== e) KW-"+": KW34 (offen) und KW35 (eng) ===');

  // e1) KW34 -- Kapazität reicht, Vorschläge entstehen still, kein Gate.
  await fixtureAufbauen(p);
  await p.evaluate(() => { if (typeof monatSheet === 'function') monatSheet(); });
  await p.waitForTimeout(250);
  const kw34Vorhanden = await p.locator('.monatweek[data-monday="2026-08-17"]').count() > 0;
  ok(kw34Vorhanden, 'e) KW34-Knopf existiert im Raster');
  if (kw34Vorhanden) {
    const hatPlus = await p.evaluate(() =>
      !!document.querySelector('.monatweek[data-monday="2026-08-17"] .monatweek__plus'));
    ok(hatPlus, 'e) KW34 trägt das "+"-Zeichen (künftige Woche)');
    await p.click('.monatweek[data-monday="2026-08-17"]');
  }
  await p.waitForTimeout(300);
  const e1 = await p.evaluate(() => ({
    modalTitel: (document.querySelector('.sheet .sheet__title') || {}).textContent || null,
    anchorMon: iso(mondayOf(anchor)),
    sugKw34: state.blocks.filter(b => b.sug && b.date >= '2026-08-17' && b.date <= '2026-08-23').length,
    toast: (document.querySelector('#toasts .toast span') || {}).textContent || null
  }));
  console.log('   KW34: ' + JSON.stringify(e1));
  ok(e1.modalTitel !== 'Das wird eng', 'e) KW34 hat genug Luft -- kein "Das wird eng" (Titel: ' + JSON.stringify(e1.modalTitel) + ')');
  ok(e1.anchorMon === '2026-08-17', 'e) anchor steht auf KW34 (17.8., war ' + e1.anchorMon + ')');
  ok(e1.sugKw34 > 0, 'e) es sind Vorschläge genau in KW34 entstanden (' + e1.sugKw34 + ')');
  // Stufe M3.3 (Vertragspräzisierung): KW34 (17.8.) liegt von der echten
  // aktuellen Woche (KW32, 3.8.) ZWEI Wochen entfernt, nicht eine — der
  // Toast sagte hier vor dieser Stufe trotzdem wörtlich "nächste Woche"
  // (dokumentierte, bewusst in Kauf genommene Ungenauigkeit, s.
  // planeWoche()-Kopfkommentar vor der Stufe). Ab +2 Wochen nennt er jetzt
  // die Kalenderwoche statt zu lügen; Block l) unten deckt den echten
  // +1-Fall ("nächste Woche" bleibt wortgleich) frisch ab.
  ok(e1.toast === 'Vorschlag für KW 34 steht', 'e) Toast meldet das Ergebnis, jetzt in KW-Form (' + JSON.stringify(e1.toast) + ')');

  // e2) KW35 -- zusätzliche Bloecke machen die Woche eng, "Das wird eng"
  //     statt still zu verteilen; kein "Nächste Woche planen" (KW35 ist
  //     nicht die laufende Woche).
  await fixtureAufbauen(p);
  await p.evaluate(() => { if (typeof monatSheet === 'function') monatSheet(); });
  await p.waitForTimeout(250);
  const kw35Vorhanden = await p.locator('.monatweek[data-monday="2026-08-24"]').count() > 0;
  ok(kw35Vorhanden, 'e) KW35-Knopf existiert im Raster');
  if (kw35Vorhanden) await p.click('.monatweek[data-monday="2026-08-24"]');
  await p.waitForTimeout(300);
  const e2 = await p.evaluate(() => ({
    modalTitel: (document.querySelector('.sheet .sheet__title') || {}).textContent || null,
    anchorMon: iso(mondayOf(anchor)),
    sugKw35VorGate: state.blocks.filter(b => b.sug && b.date >= '2026-08-24' && b.date <= '2026-08-30').length,
    hatNaechsteWocheKnopf: [...document.querySelectorAll('.sheet .sheet__foot button')]
      .some(b => b.textContent.includes('Nächste Woche planen'))
  }));
  console.log('   KW35: ' + JSON.stringify(e2));
  ok(e2.modalTitel === 'Das wird eng', 'e) KW35 ist eng -- "Das wird eng" statt still zu verteilen (Titel: ' + JSON.stringify(e2.modalTitel) + ')');
  ok(e2.sugKw35VorGate === 0, 'e) solange das Gate offen ist, sind noch KEINE Vorschläge in KW35 entstanden (' + e2.sugKw35VorGate + ')');
  ok(!e2.hatNaechsteWocheKnopf, 'e) "Nächste Woche planen" erscheint NICHT (KW35 ist nicht die laufende Woche)');
  // Trotzdem verteilen -- Gegenprobe, dass der Weg nicht tot ist.
  const trotzdemBtn = p.locator('.sheet button:has-text("Trotzdem verteilen")');
  const trotzdemDa = await trotzdemBtn.count() > 0;
  ok(trotzdemDa, 'e) "Trotzdem verteilen" ist als Ausweg vorhanden');
  if (trotzdemDa) await trotzdemBtn.click();
  await p.waitForTimeout(300);
  const e3 = await p.evaluate(() => ({
    modalWeg: !document.querySelector('.scrim'),
    sugKw35: state.blocks.filter(b => b.sug && b.date >= '2026-08-24' && b.date <= '2026-08-30').length
  }));
  ok(!trotzdemDa || e3.modalWeg, 'e) nach "Trotzdem verteilen" ist kein Blatt mehr offen (' + JSON.stringify(e3.modalWeg) + ')');
  ok(!trotzdemDa || e3.sugKw35 > 0, 'e) "Trotzdem verteilen" erzeugt anschließend doch Vorschläge in KW35 (' + e3.sugKw35 + ')');

  // e4) Regression planeNaechsteWoche(): direkter Aufruf, einmal auf eine
  //     offene Zielwoche (anchor=KW33 -> Ziel KW34, offen), einmal auf eine
  //     enge (anchor=KW34 -> Ziel KW35, eng) -- beide Zweige des Gates
  //     einmal durchlaufen, wie im Auftrag verlangt.
  console.log('\n=== e) Regression: planeNaechsteWoche() direkt aufgerufen ===');
  await fixtureAufbauen(p);
  const reg1 = await p.evaluate(() => {
    if (typeof closeModal === 'function') closeModal();
    anchor = new Date(2026, 7, 10); // Montag KW33 -> Ziel KW34 (offen)
    document.querySelectorAll('#toasts .toast').forEach(t => t.remove());
    planeNaechsteWoche();
    return {
      modalOffen: !!document.querySelector('.scrim'),
      anchorMon: iso(mondayOf(anchor)),
      sugVorhanden: state.blocks.some(b => b.sug && b.date >= '2026-08-17' && b.date <= '2026-08-23'),
      toast: (document.querySelector('#toasts .toast span') || {}).textContent || null
    };
  });
  console.log('   Ziel KW34 (offen): ' + JSON.stringify(reg1));
  ok(!reg1.modalOffen, 'e) planeNaechsteWoche() Richtung offener Woche: kein Gate-Blatt offen');
  ok(reg1.anchorMon === '2026-08-17', 'e) anchor ist auf die Zielwoche gewandert (' + reg1.anchorMon + ')');
  ok(reg1.sugVorhanden, 'e) Vorschläge sind wie vor der Stufe direkt entstanden');
  // Stufe M3.3: derselbe Präzisions-Fix wie bei e1 oben -- anchor=KW33
  // (10.8.) + 7 Tage = Ziel KW34 (17.8.), von der echten aktuellen Woche
  // (KW32) ebenfalls zwei Wochen entfernt, also KW-Form statt "nächste Woche".
  ok(reg1.toast === 'Vorschlag für KW 34 steht', 'e) dieselbe KW-Form wie beim regulären "+"-Weg (' + JSON.stringify(reg1.toast) + ')');

  await fixtureAufbauen(p);
  const reg2 = await p.evaluate(() => {
    if (typeof closeModal === 'function') closeModal();
    anchor = new Date(2026, 7, 17); // Montag KW34 -> Ziel KW35 (eng)
    document.querySelectorAll('#toasts .toast').forEach(t => t.remove());
    planeNaechsteWoche();
    return {
      modalTitel: (document.querySelector('.sheet .sheet__title') || {}).textContent || null,
      sugVorhanden: state.blocks.some(b => b.sug && b.date >= '2026-08-24' && b.date <= '2026-08-30')
    };
  });
  console.log('   Ziel KW35 (eng): ' + JSON.stringify(reg2));
  ok(reg2.modalTitel === 'Das wird eng', 'e) planeNaechsteWoche() Richtung enger Woche: Gate greift jetzt auch hier (Titel ' + JSON.stringify(reg2.modalTitel) + ')');
  ok(!reg2.sugVorhanden, 'e) solange das Gate offen ist, sind noch keine Vorschläge in der engen Zielwoche entstanden');

  /* ---- f) Monatsblättern über die Jahresgrenze -------------------------- */
  console.log('\n=== f) Monatsblättern ‹ › über die Jahresgrenze + "Heute" + anchor/Label unangetastet ===');
  await fixtureAufbauen(p);
  const weekLabelVorher = await p.evaluate(() => document.getElementById('weekLabel').textContent);
  const anchorVorher = await p.evaluate(() => iso(mondayOf(anchor)));
  await p.evaluate(() => { if (typeof monatSheet === 'function') monatSheet(); });
  await p.waitForTimeout(250);

  const prevDa = await p.locator('#monatPrev').count() > 0;
  const nextDa = await p.locator('#monatNext').count() > 0;
  ok(prevDa && nextDa, 'f) ‹/›-Knöpfe (#monatPrev/#monatNext) existieren');

  if (nextDa) {
    for (let i = 0; i < 4; i++) { await p.click('#monatNext'); await p.waitForTimeout(80); } // Aug -> Dez 2026
    const dez = await p.evaluate(() => document.getElementById('monatTitel').textContent);
    ok(dez === 'Dezember 2026', 'f) vier Klicks ‹next› von August: Dezember 2026 (war ' + JSON.stringify(dez) + ')');
    await p.click('#monatNext'); await p.waitForTimeout(80); // Dez 2026 -> Jan 2027
    const jan = await p.evaluate(() => document.getElementById('monatTitel').textContent);
    ok(jan === 'Januar 2027', 'f) über die Jahresgrenze: Januar 2027 (war ' + JSON.stringify(jan) + ')');
    if (prevDa) {
      await p.click('#monatPrev'); await p.waitForTimeout(80); // zurück -> Dez 2026
      const zurueck = await p.evaluate(() => document.getElementById('monatTitel').textContent);
      ok(zurueck === 'Dezember 2026', 'f) zurück über die Jahresgrenze: wieder Dezember 2026 (war ' + JSON.stringify(zurueck) + ')');
    }
    const heuteSichtbar = await p.evaluate(() => !document.getElementById('monatHeute').hidden);
    ok(heuteSichtbar, 'f) "Heute"-Knopf ist sichtbar, solange man nicht im echten aktuellen Monat steht');
    const heuteDa = await p.locator('#monatHeute').count() > 0;
    if (heuteDa) await p.click('#monatHeute');
    await p.waitForTimeout(150);
    const nachHeute = await p.evaluate(() => document.getElementById('monatTitel').textContent);
    ok(nachHeute === 'August 2026', 'f) "Heute"-Knopf springt zurück zu August 2026 (war ' + JSON.stringify(nachHeute) + ')');
    const heuteVerstecktJetzt = await p.evaluate(() => document.getElementById('monatHeute').hidden);
    ok(heuteVerstecktJetzt, 'f) "Heute"-Knopf ist wieder versteckt, sobald man dort steht');
  }

  const nachBlaettern = await p.evaluate(() => ({
    anchorMon: iso(mondayOf(anchor)),
    weekLabel: document.getElementById('weekLabel').textContent
  }));
  ok(nachBlaettern.anchorMon === anchorVorher,
    'f) bloßes Blättern lässt den globalen anchor unangetastet (' + anchorVorher + ' === ' + nachBlaettern.anchorMon + ')');
  ok(nachBlaettern.weekLabel === weekLabelVorher,
    'f) das Topbar-Wochenlabel ändert sich nicht mit (' + JSON.stringify(weekLabelVorher) + ' === ' + JSON.stringify(nachBlaettern.weekLabel) + ')');

  /* ---- g) Trefferflächen ≥ 44×44 ----------------------------------------- */
  console.log('\n=== g) Trefferflächen (Zellen + KW-Knöpfe) ≥ 44×44 ===');
  const g1 = await p.evaluate(() => {
    const messen = sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el, '::before');
      const parse = v => (v === 'auto' || !v) ? 0 : parseFloat(v);
      return { box: { w: r.width, h: r.height }, before: { w: parse(cs.width), h: parse(cs.height) } };
    };
    return {
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      tagZelle: messen('.monatcell[data-date="2026-08-20"]'),
      kwKnopf: messen('.monatweek[data-monday="2026-08-17"]')
    };
  });
  console.log('   ' + JSON.stringify(g1));
  ok(g1.coarsePointer, 'g) iPhone SE meldet pointer:coarse (die ::before-Erweiterung greift)');
  ok(!!g1.tagZelle && g1.tagZelle.before.w >= 44 && g1.tagZelle.before.h >= 44,
    'g) Tageszelle erreicht über ::before mindestens 44×44 (' + JSON.stringify(g1.tagZelle) + ')');
  ok(!!g1.kwKnopf && g1.kwKnopf.before.w >= 44 && g1.kwKnopf.before.h >= 44,
    'g) KW-Knopf erreicht über ::before mindestens 44×44 (' + JSON.stringify(g1.kwKnopf) + ')');

  /* ---- h) Maskierung: keine Fixture-Titel im Monatsblatt ---------------- */
  console.log('\n=== h) Maskierung: Bereichs-/Blocknamen kommen im Monatsblatt nicht vor ===');
  await fixtureAufbauen(p);
  await p.evaluate(() => { if (typeof monatSheet === 'function') monatSheet(); });
  await p.waitForTimeout(200);
  const h1 = await p.evaluate(() => {
    const sheetHtml = (document.querySelector('.sheet') || {}).innerHTML || '';
    const titel = ['Arbeit', 'Zahnarzt Kontrolle', 'Lesen', 'Umzug vorbereiten'];
    return { sheetDa: !!document.querySelector('.sheet'), treffer: titel.filter(t => sheetHtml.includes(t)) };
  });
  ok(h1.sheetDa, 'h) Blatt ist offen (Voraussetzung für die Prüfung)');
  ok(h1.treffer.length === 0, 'h) keiner der Fixture-Titel taucht im Monatsblatt auf (' + JSON.stringify(h1.treffer) + ') — M1 zeigt sie gar nicht erst');

  /* ---- i) Titel-Einzeiligkeit bei 320px, alle zwölf Monate (Stufe M3.4) - */
  console.log('\n=== i) Monatstitel bei 320px einzeilig in allen zwölf Monatsnamen, "Heute"-Knopf sichtbar ===');
  await fixtureAufbauen(p);
  await p.evaluate(() => { if (typeof monatSheet === 'function') monatSheet(); });
  await p.waitForTimeout(250);
  // Zwölf Klicks ‹next› von August 2026 aus: September 2026 .. August 2027
  // -- jeder der zwölf Monatsnamen genau einmal, und (wichtig für den Bug)
  // nie der echte aktuelle Monat selbst, also bleibt "Heute" die ganze
  // Schleife über sichtbar.
  const i1 = [];
  for (let m = 0; m < 12; m++) {
    await p.click('#monatNext'); await p.waitForTimeout(70);
    const r = await p.evaluate(() => {
      const el = document.getElementById('monatTitel');
      const heuteBtn = document.getElementById('monatHeute');
      const rect = el.getBoundingClientRect();
      return {
        titel: el.textContent, hoehe: rect.height,
        lineHeight: parseFloat(getComputedStyle(el).lineHeight),
        heuteSichtbar: !heuteBtn.hidden
      };
    });
    i1.push(r);
  }
  console.log('   ' + JSON.stringify(i1));
  const zwoelfNamen = new Set(i1.map(r => r.titel.replace(/\s*\d{4}$/, '')));
  ok(zwoelfNamen.size === 12, 'i) alle zwölf Monatsnamen durchlaufen (' + JSON.stringify([...zwoelfNamen]) + ')');
  ok(i1.every(r => r.heuteSichtbar), 'i) "Heute"-Knopf ist bei jedem der zwölf Monate sichtbar (Voraussetzung des Bugs)');
  const zuHoch = i1.filter(r => r.hoehe > r.lineHeight * 1.5);
  ok(zuHoch.length === 0,
    'i) Titel bleibt bei 320px in allen zwölf Monaten einzeilig, Höhe ≤ 1,5 Zeilenhöhen (Ausreißer: ' + JSON.stringify(zuHoch) + ')');

  // Zusatzcheck bei 375px: die Jahreszahl darf dort nicht verschwinden --
  // die 320px-Lösung ist eine punktuelle Ausblendung, keine generelle.
  const ctx375 = await br.newContext({ viewport: { width: 375, height: 812 }, timezoneId: 'Europe/Berlin' });
  const p375 = await ctx375.newPage();
  await p375.clock.setFixedTime(new Date(UHR));
  await p375.goto(F);
  await p375.waitForTimeout(500);
  await fixtureAufbauen(p375);
  await p375.evaluate(() => { if (typeof monatSheet === 'function') monatSheet(); });
  await p375.waitForTimeout(250);
  const jahrSichtbar375 = await p375.evaluate(() => {
    const jahrEl = document.querySelector('#monatTitel .monat__jahr');
    return !!jahrEl && getComputedStyle(jahrEl).display !== 'none' && jahrEl.getBoundingClientRect().width > 0;
  });
  ok(jahrSichtbar375, 'i) bei 375px ist die Jahreszahl (.monat__jahr) sichtbar (' + jahrSichtbar375 + ')');
  await p375.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await ctx375.close();

  /* ---- j) KW-Tipp auf die aktuelle Woche -> Wochen-Blatt (Stufe M3.2) --- */
  console.log('\n=== j) KW-Tipp auf die aktuelle Woche (KW32) öffnet das Wochen-Blatt, anchor bleibt stehen ===');
  await fixtureAufbauen(p);
  const j0 = await p.evaluate(() => {
    // anchor bewusst auf eine ANDERE Woche als KW32 setzen (noch im
    // August-Raster, kein Monatswechsel nötig) -- macht "anchor unbewegt"
    // zu einer echten Probe statt einer zufälligen Übereinstimmung.
    anchor = new Date(2026, 7, 26); // Mittwoch 26.8., KW35
    return iso(anchor);
  });
  await p.evaluate(() => { if (typeof monatSheet === 'function') monatSheet(); });
  await p.waitForTimeout(250);
  const kw32Da = await p.locator('.monatweek[data-monday="2026-08-03"]').count() > 0;
  ok(kw32Da, 'j) KW32-Knopf (echte aktuelle Woche) existiert im Raster');
  if (kw32Da) {
    const ariaKw32 = await p.evaluate(() =>
      document.querySelector('.monatweek[data-monday="2026-08-03"]').getAttribute('aria-label'));
    ok(ariaKw32 === 'KW 32 ansehen', 'j) aria-label "KW 32 ansehen" (war ' + JSON.stringify(ariaKw32) + ')');
    await p.click('.monatweek[data-monday="2026-08-03"]');
    await p.waitForTimeout(300);
  }
  const j1 = await p.evaluate(() => ({
    monatBlattWeg: !document.getElementById('monatTitel'),
    freizeitTitelDa: !!document.getElementById('freizeitTitel'),
    freizeitTitelText: (document.getElementById('freizeitTitel') || {}).textContent || null,
    anchorIso: iso(anchor)
  }));
  console.log('   ' + JSON.stringify(j1));
  ok(j1.monatBlattWeg, 'j) das Monatsblatt ist zu (modal() ersetzt es)');
  ok(j1.freizeitTitelDa, 'j) stattdessen ist das Wochen-Blatt offen (#freizeitTitel existiert)');
  ok(j1.freizeitTitelText === 'Frei diese Woche',
    'j) #freizeitTitel nennt die richtige Woche: "Frei diese Woche" (war ' + JSON.stringify(j1.freizeitTitelText) + ')');
  ok(j1.anchorIso === j0, 'j) der globale anchor bleibt unbewegt, obwohl er auf einer anderen Woche stand (' + j0 + ' === ' + j1.anchorIso + ')');

  /* ---- k) KW-Tipp auf eine vergangene Woche (Stufe M3.2) ---------------- */
  console.log('\n=== k) KW-Tipp auf eine vergangene Woche (KW31) öffnet ebenfalls das Wochen-Blatt ===');
  await fixtureAufbauen(p);
  const k0 = await p.evaluate(() => iso(anchor)); // anchor = Mi 5.8. (aus fixtureAufbauen, KW32)
  await p.evaluate(() => { if (typeof monatSheet === 'function') monatSheet(); });
  await p.waitForTimeout(250);
  const kw31Da = await p.locator('.monatweek[data-monday="2026-07-27"]').count() > 0;
  ok(kw31Da, 'k) KW31-Knopf (vergangene Woche, Randüberstand im August-Raster) existiert');
  if (kw31Da) {
    const info = await p.evaluate(() => {
      const btn = document.querySelector('.monatweek[data-monday="2026-07-27"]');
      return { aria: btn.getAttribute('aria-label'), disabled: btn.disabled, klasse: btn.className };
    });
    ok(info.aria === 'KW 31 ansehen', 'k) aria-label "KW 31 ansehen" (war ' + JSON.stringify(info.aria) + ')');
    ok(!info.disabled, 'k) KW31-Knopf ist NICHT mehr disabled (Rückblick jetzt möglich)');
    ok(info.klasse.includes('is-past'), 'k) KW31 trägt weiterhin is-past -- optisch zurückhaltend (' + info.klasse + ')');
    // Klick nur, wenn wirklich nicht disabled -- sonst wartet Playwright auf
    // Actionability, die ein disabled-Knopf nie erreicht (Hänger statt
    // FEHLER-Zeile). Auf altem Stand (Rot-Beweis) bleibt der Klick darum
    // aus; die beiden Zusicherungen oben tragen den Rot-Beweis für k) allein.
    if (!info.disabled) {
      await p.click('.monatweek[data-monday="2026-07-27"]');
      await p.waitForTimeout(300);
    }
  }
  const k1 = await p.evaluate(() => ({
    freizeitTitelText: (document.getElementById('freizeitTitel') || {}).textContent || null,
    anchorIso: iso(anchor)
  }));
  console.log('   ' + JSON.stringify(k1));
  ok(k1.freizeitTitelText === 'Frei letzte Woche', 'k) #freizeitTitel nennt "Frei letzte Woche" (war ' + JSON.stringify(k1.freizeitTitelText) + ')');
  ok(k1.anchorIso === k0, 'k) der globale anchor bleibt unbewegt (' + k0 + ' === ' + k1.anchorIso + ')');

  /* ---- l) "+" künftige Woche: Regression + Toast beider Distanz-Zweige - */
  console.log('\n=== l) "+" auf eine künftige Woche bleibt wie bisher; Toast je nach Distanz (Stufe M3.3) ===');
  // l1) KW33 (10.8.) -- genau EINE Woche von der echten aktuellen Woche
  //     (KW32) entfernt -> Toast bleibt wörtlich "nächste Woche".
  await fixtureAufbauen(p);
  await p.evaluate(() => { if (typeof monatSheet === 'function') monatSheet(); document.querySelectorAll('#toasts .toast').forEach(t => t.remove()); });
  await p.waitForTimeout(250);
  const kw33Da = await p.locator('.monatweek[data-monday="2026-08-10"]').count() > 0;
  ok(kw33Da, 'l) KW33-Knopf existiert');
  if (kw33Da) {
    const hatPlus33 = await p.evaluate(() => !!document.querySelector('.monatweek[data-monday="2026-08-10"] .monatweek__plus'));
    ok(hatPlus33, 'l) KW33 trägt das "+"-Zeichen (künftige Woche, Regression)');
    const aria33 = await p.evaluate(() => document.querySelector('.monatweek[data-monday="2026-08-10"]').getAttribute('aria-label'));
    ok(aria33 === 'KW 33 planen', 'l) aria-label "KW 33 planen" (war ' + JSON.stringify(aria33) + ')');
    await p.click('.monatweek[data-monday="2026-08-10"]');
  }
  await p.waitForTimeout(300);
  const l1 = await p.evaluate(() => ({
    modalTitel: (document.querySelector('.sheet .sheet__title') || {}).textContent || null,
    anchorMon: iso(mondayOf(anchor)),
    toast: (document.querySelector('#toasts .toast span') || {}).textContent || null
  }));
  console.log('   KW33 (+1): ' + JSON.stringify(l1));
  ok(l1.modalTitel !== 'Das wird eng', 'l) KW33 hat genug Luft -- kein Gate (Titel: ' + JSON.stringify(l1.modalTitel) + ')');
  ok(l1.anchorMon === '2026-08-10', 'l) anchor auf KW33 (war ' + l1.anchorMon + ')');
  ok(l1.toast === 'Vorschlag für die nächste Woche steht',
    'l) +1 Woche entfernt: Toast bleibt wörtlich "nächste Woche" (' + JSON.stringify(l1.toast) + ')');

  // l2) KW34 (17.8.) -- ZWEI Wochen entfernt -> Toast nennt die KW (dieselbe
  //     Zielwoche wie e1 oben, hier isoliert nur auf den Wortlaut fokussiert).
  await fixtureAufbauen(p);
  await p.evaluate(() => { if (typeof monatSheet === 'function') monatSheet(); document.querySelectorAll('#toasts .toast').forEach(t => t.remove()); });
  await p.waitForTimeout(250);
  const kw34DaL = await p.locator('.monatweek[data-monday="2026-08-17"]').count() > 0;
  if (kw34DaL) await p.click('.monatweek[data-monday="2026-08-17"]');
  await p.waitForTimeout(300);
  const l2 = await p.evaluate(() => ({
    toast: (document.querySelector('#toasts .toast span') || {}).textContent || null
  }));
  console.log('   KW34 (+2): ' + JSON.stringify(l2));
  ok(l2.toast === 'Vorschlag für KW 34 steht',
    'l) +2 Wochen entfernt: Toast nennt die Kalenderwoche statt "nächste Woche" zu sagen (' + JSON.stringify(l2.toast) + ')');

  /* ---- Screenshots: SE 320×568 + iPhone 13 375×812, je hell/dunkel ------ */
  console.log('\n--- Screenshots ---');
  // Block l) davor lässt keine Zwischenablage/kein Blatt mehr offen (planeWoche()
  // ohne Gate schließt still durch) -- die SE-Sichtprobe soll aber gezielt
  // einen der vier Problem-Monate aus i) mit sichtbarem "Heute"-Knopf zeigen
  // (Stufe M3.4), nicht einen beliebigen Zustand. Frisch aufbauen und auf
  // September 2026 stellen.
  await fixtureAufbauen(p);
  await p.evaluate(() => {
    document.querySelectorAll('#toasts .toast').forEach(t => t.remove()); // Rest von Block l) nicht mit ins Bild
    if (typeof monatSheet === 'function') monatSheet();
  });
  await p.waitForTimeout(200);
  await p.click('#monatNext'); await p.waitForTimeout(80); // August -> September 2026
  await p.evaluate(() => { state.settings.theme = 'light'; applyTheme(); });
  await p.waitForTimeout(120);
  await p.screenshot({ path: path.join(__dirname, 'monat-se-hell.png') });
  await p.evaluate(() => { state.settings.theme = 'dark'; applyTheme(); });
  await p.waitForTimeout(120);
  await p.screenshot({ path: path.join(__dirname, 'monat-se-dunkel.png') });
  await p.evaluate(() => { state.settings.theme = 'light'; applyTheme(); closeModal(); });

  const ctx13 = await br.newContext({ ...devices['iPhone 13'], timezoneId: 'Europe/Berlin' });
  const p13 = await ctx13.newPage();
  await p13.clock.setFixedTime(new Date(UHR));
  await p13.goto(F);
  await p13.waitForTimeout(500);
  await fixtureAufbauen(p13);
  await p13.evaluate(() => { if (typeof monatSheet === 'function') monatSheet(); });
  await p13.waitForTimeout(250);
  await p13.screenshot({ path: path.join(__dirname, 'monat-13-hell.png') });
  await p13.evaluate(() => { state.settings.theme = 'dark'; applyTheme(); });
  await p13.waitForTimeout(120);
  await p13.screenshot({ path: path.join(__dirname, 'monat-13-dunkel.png') });
  await ctx13.close();

  console.log('\nKonsolenfehler: ' + (konsolenfehler.length ? konsolenfehler.join(' | ') : 'keine'));
  if (konsolenfehler.length) fehler.push('Konsolenfehler aufgetreten');

  await br.close();
  console.log('\n' + (fehler.length ? fehler.length + ' FEHLER:' : 'Alle Prüfungen bestanden.'));
  fehler.forEach(f => console.log(' - ' + f));
  process.exit(fehler.length ? 1 : 0);
})();
