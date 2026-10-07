/* ============================================================
   Prüfskript iPhone, Glas und „Passt das noch?" (v1.32)

   Die Safe-Area-Abstände werden wie auf einem echten Gerät schon beim
   Laden gesetzt (Stilblock in einer Temp-Kopie der index.html) — nicht
   nachträglich, sonst misst die App ihren Fuß mit den falschen Werten.
   iPhone 15 Pro: hoch 393×852 mit 59/34 (Dynamic Island, Home-Indikator),
   quer 852×393 mit 59 links/rechts und 21 unten.

     a) Hoch      — der Glaskopf reicht bis unter die Dynamic Island, sein
                    Inhalt beginnt darunter; die Karten beginnen unter dem
                    Kopf und scrollen hinter ihn; Tabbar hält den
                    Home-Indikator frei; Kopf/Tabbar/Leiste sind Glas.
     b) Quer      — Navigation als senkrechte Leiste neben der Aussparung,
                    Kopf rechts daneben, „Eintrag" unten in der Leiste ohne
                    Tab zu verdecken, Vorschläge als Pille IN der Kopfzeile,
                    Raster mindestens 200 px hoch (vorher 35 px), nichts im
                    Bereich des Home-Indikators.
     c) Drehen    — zurück ins Hochformat: die Vorschlagsleiste steht
                    wieder unten direkt über der Tabbar.
     d) Desktop   — Plankopf einzeilig (≤ 60 px), „Freie Zeit" entfallen,
                    Tagesform ohne doppeltes „Das Wichtigste".
     e) Zusage    — „Passt das noch?": lockere Woche → unter der Marke,
                    drei freie Fenster an verschiedenen Tagen auf der
                    Viertelstunde, ohne Überschneidung; volle Woche → über
                    der Marke, nennt die offenen Ziele, bietet einen
                    kleineren Teil an. Öffnen/Umschalten verändert state
                    nicht; „Eintragen" öffnet das Eintragsblatt vorausgefüllt
                    und speichert erst beim Bestätigen. Taste „z" öffnet es.

   Feste Uhr (Mittwoch, 2026-09-09T10:15:00+02:00) und feste Zone.
   ============================================================ */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const QUELLE = path.resolve(__dirname, '..', 'index.html');
const UHR = new Date('2026-09-09T10:15:00+02:00');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK   ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-iphone-'));
function mitSafeArea(safe) {
  const ziel = path.join(tmp, 'safe-' + Object.values(safe).join('-') + '.html');
  const css = ':root{' + Object.entries(safe).map(([k, v]) => '--safe-' + k + ':' + v + 'px !important;').join('') + '}';
  fs.writeFileSync(ziel, fs.readFileSync(QUELLE, 'utf8').replace('</head>', '<style>' + css + '</style></head>'));
  return pathToFileURL(ziel).href;
}

const beispiel = () => {
  closeModal(); state = freshState(); migrate(state);
  state.settings.sleep = { on: true, from: 1380, to: 420, wind: 30 };
  const mon = mondayOf(new Date()); anchor = new Date(); selectedDayIdx = 2;
  state.rituale[iso(mon)] = Date.now();
  state.areas.forEach(a => { a.plan.goal = ({ a2: 5, a3: 3, a4: 2, a6: 3 })[a.id] || 0; });
  const block = (id, title, areaId, day, start, end, extra = {}) => ({
    id, title, areaId, day, date: iso(addDays(mon, day)), start, end, repeat: 'none', ...extra
  });
  state.blocks = [
    block('mo1', 'Arbeit', 'a1', 0, 540, 720), block('mo2', 'Projektzeit', 'a1', 0, 780, 960),
    block('di1', 'Arbeit', 'a1', 1, 540, 720), block('di2', 'Lernzeit', 'a2', 1, 840, 930),
    block('mi1', 'Projektbesprechung', 'a1', 2, 600, 660),
    block('mi2', 'Kapitel 3', 'a2', 2, 840, 930, { taskId: 't1' }),
    block('mi3', 'Eine Runde laufen', 'a3', 2, 1050, 1095),
    block('do1', 'Arbeit', 'a1', 3, 540, 720),
    block('do2', 'Rezept abholen', 'a7', 3, 780, 795, { sug: true, grund: 'Platz vor dem Termin.' }),
    block('fr1', 'Arbeit', 'a1', 4, 540, 720), block('sa1', 'Frühstück', 'a6', 5, 600, 720),
    block('hobby', 'Zeit für Musik', 'a4', 1, 1080, 1200, { grob: true, teil: 'ab', dauer: 120 })
  ];
  state.tasks = [{ id: 't1', title: 'Kapitel 3 fertig schreiben', areaId: 'a2', done: false, frog: true, dauer: 90, geplant: 'mi2' }];
  dayMeta(iso(addDays(mon, 6))).frei = true;
  save(); renderAll();
};

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const konsolenfehler = [];
  const seite = async (url, opts) => {
    const ctx = await br.newContext({ deviceScaleFactor: 1, timezoneId: 'Europe/Berlin', ...opts });
    const p = await ctx.newPage();
    p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) konsolenfehler.push('CONSOLE: ' + m.text()); });
    await p.clock.setFixedTime(UHR);
    await p.goto(url);
    await p.waitForFunction(() => typeof syncSettled !== 'undefined' && syncSettled);
    await p.evaluate(beispiel);
    await p.waitForTimeout(300);
    return { ctx, p };
  };
  const rect = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null;
    const cs = getComputedStyle(e); if (cs.display === 'none') return null;
    const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; }, sel);
  const schnitt = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

  /* ---------------- a) iPhone 15 Pro hoch ---------------- */
  {
    console.log('a) iPhone 15 Pro hoch');
    const { ctx, p } = await seite(mitSafeArea({ top: 59, bottom: 34 }), { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
    await p.evaluate(() => { setView('heute'); renderAll(); });
    await p.waitForTimeout(200);
    const kopf = await rect(p, '#kopf'), knopf = await rect(p, '#prevWeek'), tab = await rect(p, '#tabbar');
    const karte = await rect(p, '.card[data-card="heute"]'), panel = await rect(p, '.panel');
    ok(kopf.top === 0 && kopf.bottom > 59, 'Glaskopf beginnt ganz oben und reicht über die Dynamic Island (' + Math.round(kopf.bottom) + ' px)');
    ok(knopf.top >= 59, 'Bedienelemente im Kopf liegen unter der Dynamic Island (' + Math.round(knopf.top) + ' ≥ 59)');
    ok(karte.top >= kopf.bottom - 0.5, 'die Heute-Karte beginnt unter dem Kopf (' + Math.round(karte.top) + ' ≥ ' + Math.round(kopf.bottom) + ')');
    ok(panel.top < kopf.bottom, 'der scrollende Bereich reicht hinter den Kopf (Inhalt läuft unter das Glas)');
    const tabKnopf = await rect(p, '#tabbar button');
    ok(tab.bottom === 852 && tabKnopf.bottom <= 852 - 34 + 0.5, 'Tabbar hält den Home-Indikator frei (Knopf endet bei ' + Math.round(tabKnopf.bottom) + ')');
    // v1.42 „Stundensteine": kein Glas mehr — Kopf, Tabbar und Vorschlagsleiste
    // sind deckend; Kopf und Tabbar tragen eine volle Fläche, die Leiste eine
    // deckende Pille (::before) über der Tabbar.
    const deckend = await p.evaluate(() => {
      const voll = c => c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c) && !/\/\s*0(\.\d+)?\)$/.test(c);
      const cs = s => getComputedStyle(document.querySelector(s));
      return { filter: ['#kopf', '#tabbar', '#sugBar'].map(s => cs(s).backdropFilter),
        kopf: voll(cs('#kopf').backgroundColor), tabbar: voll(cs('#tabbar').backgroundColor),
        pille: voll(getComputedStyle(document.querySelector('#sugBar'), '::before').backgroundColor) };
    });
    ok(deckend.filter.every(f => f === 'none'), 'Kopf, Tabbar und Vorschlagsleiste ohne Glas (' + deckend.filter.join(' | ') + ')');
    ok(deckend.kopf && deckend.tabbar && deckend.pille, 'Kopf, Tabbar und Leisten-Pille haben eine deckende Fläche (' + JSON.stringify(deckend) + ')');
    const sug = await rect(p, '#sugBar');
    ok(sug && Math.abs(sug.bottom - tab.top) < 1, 'Vorschlagsleiste steht direkt über der Tabbar');
    await p.evaluate(() => { document.querySelector('.panel').scrollTop = 150; });
    await p.waitForTimeout(100);
    const karte2 = await rect(p, '.card[data-card="heute"]');
    ok(karte2.top < kopf.bottom, 'nach dem Scrollen liegt Karteninhalt unter dem Glaskopf');

    // v1.33: vom Home-Bildschirm gestartet legt iOS 26/27 seinen
    // Scroll-Edge-Effekt über jeden nicht flachen oberen Rand — dort ist der
    // Kopf deckend und hat exakt die theme-color, in Hell und Dunkel.
    for (const th of ['light', 'dark']) {
      const app = await p.evaluate(t => {
        window.laeuftAlsApp = () => true;
        state.settings.theme = t; applyTheme();
        const k = getComputedStyle(document.getElementById('kopf'));
        const farbe = c => { const e = document.createElement('i'); e.style.color = c; document.body.appendChild(e);
          const w = getComputedStyle(e).color; e.remove(); return w; };
        return { app: document.documentElement.dataset.app, bg: k.backgroundColor, filter: k.backdropFilter,
          meta: farbe(document.getElementById('themeColor').content), kopf: farbe(k.backgroundColor) };
      }, th);
      ok(app.app === '1' && app.filter === 'none' && !/\/|rgba/.test(app.bg), th + ': installiert ist der Kopf flach und deckend (' + app.bg + ')');
      ok(app.meta === app.kopf, th + ': theme-color entspricht der Kopffarbe (' + app.meta + ' = ' + app.kopf + ')');
      // v1.35: WebKits Randabtaster zählt nur feste/klebende Elemente — und
      // auch die Leinwand darunter trägt dieselbe Farbe.
      const rand = await p.evaluate(() => ({ pos: getComputedStyle(document.getElementById('kopf')).position,
        html: getComputedStyle(document.documentElement).backgroundColor, kopf: getComputedStyle(document.getElementById('kopf')).backgroundColor }));
      ok(rand.pos === 'fixed' && rand.html === rand.kopf, th + ': Kopf ist fest (fixed), die Seite darunter hat dieselbe Farbe');
    }
    await p.evaluate(() => { window.laeuftAlsApp = () => false; state.settings.theme = 'light'; applyTheme(); });
    // v1.42: auch im Browser ist der Kopf deckend (vorher: Glas).
    ok(await p.evaluate(() => getComputedStyle(document.getElementById('kopf')).backdropFilter === 'none'), 'im Browser ist der Kopf deckend, ohne Glas');
    await ctx.close();
  }

  /* ---------------- b) + c) quer, dann drehen ---------------- */
  {
    console.log('b) iPhone 15 Pro quer');
    const { ctx, p } = await seite(mitSafeArea({ left: 59, right: 59, bottom: 21 }), { viewport: { width: 852, height: 393 }, isMobile: true, hasTouch: true });
    await p.evaluate(() => { setView('plan'); renderAll(); });
    await p.waitForTimeout(250);
    const leiste = await rect(p, '#tabbar'), kopf = await rect(p, '#kopf'), grid = await rect(p, '#gridWrap');
    const tabs = await p.evaluate(() => [...document.querySelectorAll('#tabbar button[data-view]')].map(b => { const r = b.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }));
    const fab = await rect(p, '#fabAdd');
    ok(leiste.height > leiste.width && leiste.top === 0 && leiste.bottom === 393, 'Navigation ist eine senkrechte Leiste über die volle Höhe');
    ok(tabs.every(t => t.left >= 59), 'Tabs liegen neben der Kamera-Aussparung (links ≥ 59)');
    ok(kopf.left >= leiste.right - 0.5, 'der Kopf beginnt rechts neben der Leiste');
    ok(fab && tabs.every(t => schnitt(t, fab) === 0) && fab.top > Math.max(...tabs.map(t => t.bottom)), '„Eintrag" steht unten in der Leiste und verdeckt keinen Tab');
    ok(fab && fab.bottom <= 393 - 8, '„Eintrag" bleibt über der Unterkante');
    ok(grid.height >= 200, 'Raster ist mindestens 200 px hoch (' + Math.round(grid.height) + ' px, vorher 35 px)');
    const inKopf = await p.evaluate(() => document.getElementById('sugBar').parentElement.classList.contains('topbar') && document.body.dataset.sugoben === '1');
    ok(inKopf, 'Vorschläge stehen als Pille in der Kopfzeile');
    const sug = await rect(p, '#sugBar'), nav = await rect(p, '.weeknav'), monat = await rect(p, '#monthBtn');
    ok(sug && schnitt(sug, nav) === 0 && schnitt(sug, monat) === 0 && sug.bottom <= kopf.bottom, 'die Pille überdeckt weder Wochennavigation noch Monatssymbol');
    const band = await rect(p, '#looseBand');
    ok(!band || band.bottom <= 393 - 21 + 0.5, 'Abendband endet über dem Home-Indikator');
    const fuss = await p.evaluate(() => [getComputedStyle(document.body).getPropertyValue('--fussleiste'), getComputedStyle(document.body).getPropertyValue('--fuss-oben')]);
    ok(fuss[0].trim() === '21px' && fuss[1].trim() === '21px', 'Fußmaß quer = Home-Indikator, Pille zählt nicht mit (' + fuss.join(' / ') + ')');
    await p.click('#sugBar .sugbar__accept');
    await p.waitForTimeout(200);
    ok(await p.evaluate(() => !state.blocks.some(b => b.sug)), '„Übernehmen" in der Pille übernimmt die Vorschläge');

    console.log('c) Drehen ins Hochformat');
    await p.evaluate(() => { const mon = mondayOf(anchor); state.blocks.push({ id: 'neu', title: 'Vorschlag', areaId: 'a3', day: 4, date: iso(addDays(mon, 4)), start: 1020, end: 1080, repeat: 'none', sug: true }); save(); renderAll(); });
    await p.setViewportSize({ width: 393, height: 852 });
    await p.waitForTimeout(350);
    const zurueck = await p.evaluate(() => ({ eltern: document.getElementById('sugBar').parentElement.className, oben: document.body.dataset.sugoben }));
    ok(zurueck.eltern === 'app' && zurueck.oben === '0', 'Vorschlagsleiste wandert zurück an den unteren Rand');
    const sug2 = await rect(p, '#sugBar'), tab2 = await rect(p, '#tabbar');
    ok(sug2 && tab2 && Math.abs(sug2.bottom - tab2.top) < 1 && tab2.width > tab2.height, 'unten: Leiste direkt über der waagerechten Tabbar');
    await ctx.close();
  }

  /* ---------------- d) Desktop ---------------- */
  {
    console.log('d) Desktop aufgeräumt');
    const { ctx, p } = await seite(pathToFileURL(QUELLE).href, { viewport: { width: 1440, height: 1000 } });
    const kopf = await rect(p, '.planhead');
    ok(kopf.height <= 60, 'Plankopf ist einzeilig (' + Math.round(kopf.height) + ' px)');
    ok(await p.evaluate(() => !document.getElementById('weekOverviewBtn') && !document.querySelector('.planhead__hint')), '„Freie Zeit" und der Werbesatz sind entfallen');
    ok(await p.evaluate(() => !/Das Wichtigste:/.test(document.getElementById('energyHint').textContent)
      && /Kapitel 3/.test(document.getElementById('agenda').textContent)), 'Tagesform wiederholt den Schwerpunkt nicht, die Agenda nennt ihn');
    await p.click('#weekLabel');
    ok(await p.evaluate(() => !!openModal), 'die KW-Anzeige öffnet weiterhin die Wochenübersicht');
    await p.keyboard.press('Escape');

    console.log('e) Passt das noch?');
    const vorher = await p.evaluate(() => JSON.stringify({ b: state.blocks, a: iso(anchor) }));
    await p.keyboard.press('z');
    await p.waitForTimeout(150);
    ok(await p.evaluate(() => /Passt das noch/.test(openModal && openModal.textContent)), '„z" öffnet „Passt das noch?"');
    await p.click('#zDauer .chip:has-text("3 h")');
    const r = await p.evaluate(() => {
      const r = zusageDurchspielen(180, 'a7', mondayOf(new Date()));
      return { okNach: r.okNach, vor: r.quoteVor, nach: r.quoteNach,
        slots: r.passend.map(l => ({ tag: l.day.i, key: l.day.key, start: l.start, end: l.end })),
        text: document.getElementById('zErgebnis').innerText };
    });
    ok(r.okNach && r.nach > r.vor, 'lockere Woche: 3 h bleiben unter der Marke (' + Math.round(r.vor * 100) + ' → ' + Math.round(r.nach * 100) + ' %)');
    ok(r.slots.length === 3 && new Set(r.slots.map(s => s.tag)).size === 3, 'drei freie Fenster an verschiedenen Tagen');
    ok(r.slots.every(s => s.start % 15 === 0 && s.end - s.start >= 180), 'Fenster beginnen auf der Viertelstunde und fassen 3 h');
    const kollision = await p.evaluate(slots => slots.some(s => state.blocks.some(b => !b.grob && onDay(b, s.key, s.tag) && b.start < s.start + 180 && b.end > s.start)), r.slots);
    ok(!kollision, 'kein Fenster überschneidet einen bestehenden Termin');
    ok(r.slots.every(s => s.key >= '2026-09-09') && !r.slots.some(s => s.tag === 6), 'nur ab heute, der freigehaltene Sonntag bleibt tabu');
    ok(/Eine Woche später · KW 38/.test(r.text) && /Absagen/.test(r.text), 'Varianten „eine Woche später" und „Absagen" stehen da');
    await p.click('#zWoche .chip:has-text("Nächste Woche")');
    await p.fill('#zTitel', 'Umzug helfen');
    ok(await p.evaluate(v => JSON.stringify({ b: state.blocks, a: iso(anchor) }) === v, vorher), 'Durchspielen verändert weder Plan noch angezeigte Woche');
    await p.click('#zWoche .chip:has-text("Diese Woche")');
    await p.click('#zErgebnis .zusage__var button >> nth=0');
    await p.waitForTimeout(250);
    const blatt = await p.evaluate(() => ({ titel: openModal.querySelector('.sheet__title').textContent, was: $('#bTitle').value,
      von: $('#bFrom').value, bis: $('#bTo').value, n: state.blocks.length }));
    ok(blatt.titel === 'Neuer Eintrag' && blatt.was === 'Umzug helfen', '„Eintragen" öffnet das Eintragsblatt mit dem Titel');
    ok(blatt.von === '18:30' && blatt.bis === '21:30', 'vorausgefüllt mit dem ersten freien Fenster (' + blatt.von + '–' + blatt.bis + ')');
    ok(blatt.n === 12, 'noch nichts gespeichert, solange das Blatt offen ist');
    await p.click('.sheet__foot .btn--primary');
    await p.waitForTimeout(200);
    ok(await p.evaluate(() => state.blocks.some(b => b.title === 'Umzug helfen' && b.start === 1110 && b.end === 1290 && b.areaId === 'a7')), 'erst „Speichern" legt den Termin an');

    // Volle Woche: große offene Ziele, 6 h Zusage.
    const voll = await p.evaluate(() => {
      state.areas.forEach(a => { a.plan.goal = ({ a2: 20, a3: 10, a6: 8 })[a.id] || 0; });
      save(); renderAll();
      const r = zusageDurchspielen(360, 'a7', mondayOf(new Date()));
      closeModal(); zusageSheet();
      document.querySelector('#zDauer .chip:nth-child(6)').click();
      return { okNach: r.okNach, ueber: r.ueber, luft: r.luft, text: document.getElementById('zErgebnis').innerText };
    });
    ok(!voll.okNach && voll.ueber > 0, 'volle Woche: 6 h liegen über der Marke (' + voll.ueber + ' min)');
    ok(/Uni & Lernen/.test(voll.text) && /Sport/.test(voll.text) && /konkurrieren/.test(voll.text), 'nennt die offenen Ziele, die dann um Platz konkurrieren');
    const kleiner = voll.text.match(/Kleiner zusagen · ([^\n]+)/);
    ok(voll.luft < 30 ? !kleiner : !!kleiner, 'ein kleinerer Teil wird genau dann angeboten, wenn noch mindestens 30 min Luft sind (Luft ' + voll.luft + ' min)');

    // Knappe Woche: das Uni-Ziel so wählen, dass 1–4 h Luft bleiben — dann
    // passt die 6-h-Zusage nicht, ein kleinerer Teil aber schon.
    const knapp = await p.evaluate(() => {
      closeModal();
      state.areas.forEach(a => { a.plan.goal = 0; });
      const uni = state.areas.find(a => a.id === 'a2');
      let r = null;
      for (let h = 1; h <= 40; h++) {
        uni.plan.goal = h;
        r = zusageDurchspielen(360, 'a7', mondayOf(new Date()));
        if (r.luft >= 60 && r.luft <= 240) break;
      }
      save(); renderAll(); zusageSheet();
      document.querySelector('#zDauer .chip:nth-child(6)').click();
      const t = document.getElementById('zErgebnis').innerText;
      const m = t.match(/Kleiner zusagen · (?:(\d+) h)? ?(?:(\d+) min)?/);
      const min = m ? (+(m[1] || 0)) * 60 + (+(m[2] || 0)) : 0;
      return { luft: r.luft, okNach: r.okNach, groesste: r.groesste && r.groesste.laenge, min };
    });
    ok(!knapp.okNach && knapp.luft >= 60, 'knappe Woche: 6 h passen nicht, ' + knapp.luft + ' min Luft bleiben');
    ok(knapp.min >= 30 && knapp.min <= knapp.luft && knapp.min <= knapp.groesste, 'kleinerer Teil: ' + knapp.min + ' min — höchstens die Luft und höchstens die größte Lücke');
    await ctx.close();
  }

  await br.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  ok(konsolenfehler.length === 0, 'keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nalles grün');
  process.exit(fehler.length ? 1 : 0);
})();
