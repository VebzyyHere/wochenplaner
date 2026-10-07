/* ============================================================
   Prüfskript Stundensteine (v1.42) — Ziele als Steinreihe

     a) Anzeige    — jedes Wochenziel als Steinreihe aus den vorhandenen
                     Werten: abgehakt = massiver Stein, eingeplant = Ring,
                     vorgeschlagen = blasser Stein, offen = leere Mulde;
                     gestrichelt nur, was wirklich ohne Uhrzeit verplant ist
                     (ein Termin mit Uhrzeit in einem grob planenden Bereich
                     bleibt Ring, ein gemischter Stein zeigt beides); Überplanung liegt außerhalb
                     der Schiene mit „+x"; ein 80-h-Ziel bricht um, ohne über
                     die Karte hinauszuragen. Die Zahl daneben bleibt der alte
                     Wortlaut.
     b) Fallen     — einmal je Öffnen über die Navigation; nicht nach einem
                     bloßen Neuzeichnen, nicht bei „Bewegung reduzieren".
     c) Bearbeiten — Tippen auf den n-ten Stein setzt n h, erneut auf den
                     letzten nimmt eine Stunde weg, ±½ rastet auf halbe
                     Stunden; Zahlenfeld und Steine bleiben synchron;
                     Abbrechen stellt zurück, Speichern übernimmt.
     e) Raster     — kurze Vorschläge (Desktop) schneiden keine Unterzeile
                     mitten durch; was wegfällt, steht im title.
     d) Zusage     — „Passt das noch?" zeigt die vorhandene Rechnung als
                     Steinzeile (Mulden = Luft, Steine = Zusage mit Pausen,
                     Rest verdrängt — massiv, gekippt, mit „!", nie bloß
                     gestrichelt) und verändert nichts.
     f) Aufgaben   — der abgehakte Haken einer Aufgabe hat dieselbe Farbe
                     wie der fallende Stein: Bereichsfarbe, ohne (noch
                     vorhandenen) Bereich beide Jade.

   Feste Uhr und Zone: Mittwoch, 7.10.2026, 10:00 Europe/Berlin.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');
const UHR = '2026-10-07T10:00:00+02:00';

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK   ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

const aufbau = () => {
  closeModal(); state = freshState(); migrate(state);
  const mon = mondayOf(new Date()); anchor = new Date(); selectedDayIdx = (new Date().getDay() + 6) % 7;
  state.rituale[iso(mon)] = Date.now();
  state.areas.forEach(a => { a.plan.goal = 0; a.plan.grob = false; });
  const ziel = (id, h, grob) => { const a = state.areas.find(x => x.id === id); a.plan.goal = h; a.plan.grob = !!grob; };
  ziel('a3', 4);          // Sport: 1 h abgehakt, 2 h eingeplant, 1 h vorgeschlagen, 0 offen
  ziel('a2', 1);          // Uni: 2,5 h eingeplant → 1,5 h über dem Ziel
  ziel('a6', 2, true);    // Menschen, grob: 1 h ohne Uhrzeit eingeplant
  ziel('a4', 3, true);    // Hobby, grob: 1 h MIT Uhrzeit + 1 h ohne Uhrzeit
  ziel('a5', 2, true);    // Freizeit, grob: 30 min mit + 1 h ohne Uhrzeit → ein gemischter Stein
  ziel('a7', 80);         // Alltag: Obergrenze des Eingabefelds
  const d = i => iso(addDays(mon, i));
  const B = (id, areaId, i, s, e, extra) => Object.assign({ id, title: id, areaId, day: i, date: d(i), start: s, end: e, repeat: 'none' }, extra || {});
  state.blocks = [
    B('s1', 'a3', 0, 600, 660), B('s2', 'a3', 3, 600, 720), B('s3', 'a3', 4, 600, 660, { sug: true, grund: 'x' }),
    B('u1', 'a2', 3, 840, 990),
    B('m1', 'a6', 5, 900, 960, { grob: true, teil: 'nm', dauer: 60 }),
    B('h1', 'a4', 1, 600, 660), B('h2', 'a4', 2, 0, 0, { grob: true, teil: 'ab', dauer: 60 }),
    B('f1', 'a5', 1, 720, 750), B('f2', 'a5', 2, 0, 0, { grob: true, teil: 'vm', dauer: 60 })
  ];
  setzeErledigt(state.blocks[0], d(0), true);
  save(); renderAll(); setView('ziele');
};

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const konsolenfehler = [];
  const seite = async (opts = {}) => {
    const ctx = await br.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Berlin', ...opts });
    const p = await ctx.newPage();
    p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) konsolenfehler.push('CONSOLE: ' + m.text()); });
    await p.clock.setFixedTime(new Date(UHR));
    await p.goto(F);
    await p.waitForFunction(() => typeof syncSettled !== 'undefined' && syncSettled);
    await p.evaluate(aufbau);
    await p.waitForTimeout(150);
    return { ctx, p };
  };

  // ---------------------------------------------------------------- a)
  console.log('a) Anzeige');
  {
    const { ctx, p } = await seite();
    const r = await p.evaluate(() => {
      const zeile = name => [...document.querySelectorAll('#goalsList .goal')].find(g => g.querySelector('.goal__name').textContent === name);
      const zaehle = (g, sel) => g.querySelectorAll(sel).length;
      const massiv = '.stein:not(.stein--plan):not(.stein--sug):not(.stein--grob):not(.stein--teil)';
      const sport = zeile('Sport'), uni = zeile('Uni & Lernen'), menschen = zeile('Menschen'), alltag = zeile('Alltag');
      const hobby = zeile('Hobby'), freizeit = zeile('Freizeit & Pausen');
      const karte = document.querySelector('#goalsList').getBoundingClientRect();
      const reihe = alltag.querySelector('.steinreihe').getBoundingClientRect();
      return {
        sport: { mulden: zaehle(sport, '.mulden .slot'), massiv: zaehle(sport, massiv), ring: zaehle(sport, '.stein--plan'),
          sug: zaehle(sport, '.stein--sug'), draussen: zaehle(sport, '.slot--ueber'), ueber: zaehle(sport, '.steinreihe__ueber'),
          num: sport.querySelector('.goal__num').textContent,
          numSoll: '✓ ' + fmtDur(60) + ' · ' + fmtDur(180) + ' / ' + fmtDur(240) },
        uni: { mulden: zaehle(uni, '.mulden .slot'), draussen: zaehle(uni, '.slot--ueber'), teil: zaehle(uni, '.slot--ueber svg.stein--teil'),
          ueber: (uni.querySelector('.steinreihe__ueber') || {}).textContent, ueberSoll: '+' + fmtDur(90) },
        menschen: { grob: zaehle(menschen, '.stein--grob'), ring: zaehle(menschen, '.stein--plan') },
        hobby: { grob: zaehle(hobby, '.stein--grob'), ring: zaehle(hobby, '.stein--plan'), teil: zaehle(hobby, '.stein--teil') },
        freizeit: { teil: zaehle(freizeit, '.stein--teil'), gemischt: zaehle(freizeit, 'svg.stein--teil:has(.teil__plan.is-grob):has(.teil__plan:not(.is-grob))'),
          grob: zaehle(freizeit, '.stein--grob'), ring: zaehle(freizeit, '.stein--plan') },
        legendeGrob: [...document.querySelectorAll('.goals__legende span')].some(s => s.textContent === 'ohne Uhrzeit'),
        alltag: { slots: zaehle(alltag, '.slot'), mulden: zaehle(alltag, '.mulden .slot'), eng: alltag.querySelector('.steinreihe').classList.contains('is-eng'),
          rechts: reihe.right <= karte.right + 0.5, hoehe: Math.round(reihe.height) },
        verstecktFuerSR: [...document.querySelectorAll('#goalsList .steinreihe')].every(x => x.getAttribute('aria-hidden') === 'true'),
        alterBalken: document.querySelectorAll('#goalsList .goal__track').length
      };
    });
    ok(r.sport.mulden === 4 && r.sport.massiv === 1 && r.sport.ring === 2 && r.sport.sug === 1,
      'Sport 4 h: 4 Mulden, 1 massiver Stein (abgehakt), 2 Ringe (eingeplant), 1 blasser (vorgeschlagen) — ' + JSON.stringify(r.sport));
    ok(r.sport.draussen === 0 && r.sport.ueber === 0, 'Sport: nichts über der Schiene, kein „+"');
    ok(r.sport.num === r.sport.numSoll, 'Zahl daneben im alten Wortlaut: "' + r.sport.num + '"');
    ok(r.uni.mulden === 1 && r.uni.draussen === 2 && r.uni.teil === 1 && r.uni.ueber === r.uni.ueberSoll,
      'Uni 1 h, 2,5 h eingeplant: 1 Mulde, 2 Steine draußen (einer angebrochen), Text "' + r.uni.ueber + '"');
    ok(r.menschen.grob === 1 && r.menschen.ring === 0, 'Termin ohne Uhrzeit: eingeplanter Stein gestrichelt statt Ring');
    ok(r.hobby.ring === 1 && r.hobby.grob === 1 && r.hobby.teil === 0,
      'grober Bereich mit einem Termin MIT Uhrzeit: dieser Stein bleibt Ring, nur die Stunde ohne Uhrzeit ist gestrichelt — ' + JSON.stringify(r.hobby));
    ok(r.freizeit.gemischt === 1 && r.freizeit.grob === 0 && r.freizeit.ring === 0,
      '30 min mit + 1 h ohne Uhrzeit: ein Stein trägt beides (fester Sektor über gestricheltem Ring) — ' + JSON.stringify(r.freizeit));
    ok(r.legendeGrob, 'Legende nennt „ohne Uhrzeit", solange es gestrichelte Steine gibt');
    ok(r.alltag.slots === 80 && r.alltag.mulden === 80 && r.alltag.eng, '80-h-Ziel: 80 Mulden, kleine Steine (is-eng)');
    ok(r.alltag.rechts && r.alltag.hoehe < 140, '80-h-Ziel bricht um und bleibt in der Karte (Höhe ' + r.alltag.hoehe + ' px)');
    ok(r.verstecktFuerSR, 'Steinreihen sind aria-hidden (die Zahlen stehen als Text daneben)');
    ok(r.alterBalken === 0, 'kein alter Balken mehr');
    await ctx.close();
  }

  // ---------------------------------------------------------------- b)
  console.log('b) Fallen');
  {
    const { ctx, p } = await seite();
    const r = await p.evaluate(() => {
      const fallend = () => document.querySelectorAll('#goalsList .steinreihe .stein.is-fall').length;
      const alle = () => document.querySelectorAll('#goalsList .steinreihe .stein').length;
      ansichtWechseln('heute');
      ansichtWechseln('ziele');
      const nachOeffnen = fallend(), gesamt = alle();
      const verzoegerung = Math.max(0, ...[...document.querySelectorAll('#goalsList .stein.is-fall')].map(s => parseFloat(s.style.animationDelay)));
      const erster = document.querySelector('#goalsList .stein.is-fall');
      const animiert = erster ? getComputedStyle(erster).animationName : 'keine';
      renderAll();
      const nachNeuzeichnen = fallend();
      ansichtWechseln('ziele');   // schon offen: kein zweites Fallen
      return { nachOeffnen, gesamt, verzoegerung, animiert, nachNeuzeichnen, nochmal: fallend() };
    });
    ok(r.nachOeffnen === r.gesamt && r.gesamt > 0 && r.animiert === 'steinFall', 'Öffnen der Ziele: alle ' + r.gesamt + ' Steine fallen (' + r.animiert + ')');
    ok(r.verzoegerung <= 260, 'gestaffelt, letzte Verzögerung ' + r.verzoegerung + ' ms (+340 ms Fall ≈ 600 ms)');
    ok(r.nachNeuzeichnen === 0 && r.nochmal === 0, 'Neuzeichnen und erneutes Tippen auf den offenen Tab lassen die Steine liegen');
    await ctx.close();
    const ruhig = await seite({ reducedMotion: 'reduce' });
    const n = await ruhig.p.evaluate(() => { ansichtWechseln('heute'); ansichtWechseln('ziele');
      return document.querySelectorAll('#goalsList .stein.is-fall').length; });
    ok(n === 0, 'Bewegung reduzieren: kein Fallen');
    await ruhig.ctx.close();
  }

  // ---------------------------------------------------------------- c)
  console.log('c) Bearbeiten');
  {
    const { ctx, p } = await seite();
    await p.evaluate(() => goalsSheet());
    await p.waitForTimeout(300);
    const idx = await p.evaluate(() => state.areas.findIndex(a => a.id === 'a3'));
    const reihe = p.locator('#gList .goalrow').nth(idx);
    const stand = () => reihe.evaluate(r => ({ wert: r.querySelector('.goalrow__h').value,
      voll: r.querySelectorAll('.zsteine .stein:not(.stein--teil)').length, teil: r.querySelectorAll('.zsteine .stein--teil').length,
      plan: state.areas.find(a => a.id === 'a3').plan.goal }));
    let s = await stand();
    ok(s.wert === '4' && s.voll === 4, 'Start: Feld 4, vier Steine');
    await reihe.locator('.zsteine .slot').nth(2).click();
    s = await stand();
    ok(s.wert === '3' && s.voll === 3, 'dritten Stein tippen: 3 h (' + JSON.stringify(s) + ')');
    await reihe.locator('.zsteine .slot').nth(2).click();
    s = await stand();
    ok(s.wert === '2' && s.voll === 2, 'erneut auf den letzten: eine Stunde weg → 2 h');
    await reihe.locator('.goalrow__halb[data-d="1"]').click();
    s = await stand();
    ok(s.wert === '2.5' && s.voll === 2 && s.teil === 1, '+½: 2,5 h, ein halber Stein');
    await reihe.locator('.goalrow__h').fill('9.3');
    await reihe.locator('.goalrow__halb[data-d="-1"]').click();
    s = await stand();
    ok(s.wert === '9', '−½ rastet von 9,3 auf 9');
    await reihe.locator('.goalrow__h').fill('6');
    s = await stand();
    ok(s.voll === 6, 'Tippen ins Feld zieht die Steine mit (6)');
    const sr = await reihe.evaluate(r => ({ reihe: r.querySelector('.zsteine').getAttribute('aria-hidden'),
      knopf: r.querySelector('.goalrow__halb').getAttribute('aria-label') }));
    ok(sr.reihe === 'true' && /halbe Stunde weniger für Sport/.test(sr.knopf), 'Steine aria-hidden, ±½ beschriftet ("' + sr.knopf + '")');
    await p.click('.sheet__foot .btn:has-text("Abbrechen")');
    await p.waitForTimeout(200);
    s = await p.evaluate(() => state.areas.find(a => a.id === 'a3').plan.goal);
    ok(s === 4, 'Abbrechen stellt das Ziel zurück (4)');
    await p.evaluate(() => goalsSheet());
    await p.waitForTimeout(300);
    await p.locator('#gList .goalrow').nth(idx).locator('.zsteine .slot').nth(4).click();
    await p.click('.sheet__foot .btn--primary');
    await p.waitForTimeout(200);
    s = await p.evaluate(() => ({ ziel: state.areas.find(a => a.id === 'a3').plan.goal,
      mulden: [...document.querySelectorAll('#goalsList .goal')].find(g => /Sport/.test(g.textContent)).querySelectorAll('.mulden .slot').length }));
    ok(s.ziel === 5 && s.mulden === 5, 'fünften Stein + Speichern: Ziel 5 h, Anzeige 5 Mulden');
    await ctx.close();
  }

  // ---------------------------------------------------------------- d)
  console.log('d) Passt das noch?');
  {
    const { ctx, p } = await seite();
    const r = await p.evaluate(() => {
      // Knapp: Luft zwischen 1 und 4 h, dann passen 6 h nicht ganz.
      const uni = state.areas.find(a => a.id === 'a2');
      state.areas.forEach(a => { a.plan.goal = 0; });
      let k = null;
      for (let h = 1; h <= 70; h++) { uni.plan.goal = h; k = zusageDurchspielen(360, 'a7', mondayOf(new Date())); if (k.luft >= 60 && k.luft <= 240) break; }
      save(); renderAll();
      const vorher = JSON.stringify({ b: state.blocks, a: state.areas });
      zusageSheet();
      document.querySelector('#zDauer .chip:nth-child(6)').click();
      const z = document.querySelector('#zErgebnis .zsteinzeile');
      const braucht = 360 + k.pause;
      return {
        luft: k.luft, okNach: k.okNach, braucht,
        mulden: z.querySelectorAll('.mulden .slot').length,
        steine: z.querySelectorAll('.stein').length,
        verdraengt: z.querySelectorAll('.slot--verdraengt').length,
        // Jeder verdrängte Stein: eigene Form, angehoben/gekippt, nie gestrichelt;
        // die vollen tragen ein „!" (ein angebrochener nur seinen Sektor).
        verdraengtForm: [...z.querySelectorAll('.slot--verdraengt')].every(sl => {
          const st = sl.querySelector('.stein');
          return st && st.classList.contains('stein--verdraengt') && !st.classList.contains('stein--grob') && !sl.querySelector('.is-grob')
            && getComputedStyle(sl).transform !== 'none'
            && (st.style.getPropertyValue('--f') !== '' || getComputedStyle(st, '::after').content === '"!"');
        }) && [...z.querySelectorAll('.stein--verdraengt')].some(st => getComputedStyle(st, '::after').content === '"!"'),
        text: z.querySelector('p').textContent,
        luftText: genauTest(k.luft), brauchtText: genauTest(braucht),
        unveraendert: JSON.stringify({ b: state.blocks, a: state.areas }) === vorher,
        reihenfolge: [...document.querySelector('#zErgebnis').children].map(c => c.className).slice(0, 3).join(' | ')
      };
      function genauTest(m) { return m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min'; }
    });
    ok(!r.okNach && r.luft >= 60, 'knappe Woche: 6 h passen nicht, ' + r.luft + ' min Luft');
    ok(r.mulden === Math.ceil(r.luft / 60), 'Mulden = Luft bis zur Marke (' + r.mulden + ' für ' + r.luft + ' min)');
    ok(r.steine === Math.ceil(r.braucht / 60), 'Steine = Zusage mit den Pausen der App (' + r.steine + ' für ' + r.braucht + ' min)');
    ok(r.verdraengt === r.steine - r.mulden && r.verdraengt > 0, 'was übersteht, ist verdrängt (' + r.verdraengt + ')');
    ok(r.verdraengtForm, 'verdrängt ist nicht nur Farbe: eigener massiver Stein mit „!", angehoben und gekippt, nie gestrichelt');
    ok(r.text.includes(r.luftText) && r.text.includes(r.brauchtText), 'Satz nennt Luft und Bedarf: "' + r.text + '"');
    ok(r.reihenfolge === 'zusage__lage | zsteinzeile | zusage__var', 'Steinzeile steht zwischen Lage und Varianten (' + r.reihenfolge + ')');
    ok(r.unveraendert, 'Durchspielen speichert nichts');
    await ctx.close();
  }

  // ---------------------------------------------------------------- e)
  console.log('e) Raster: kurze Vorschläge');
  {
    const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Berlin' });
    const p = await ctx.newPage();
    p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
    await p.clock.setFixedTime(new Date(UHR));
    await p.goto(F);
    await p.waitForFunction(() => typeof syncSettled !== 'undefined' && syncSettled);
    await p.evaluate(aufbau);
    const r = await p.evaluate(async () => {
      const mon = mondayOf(new Date()), d = i => iso(addDays(mon, i));
      const S = (id, i, s, e, grund) => ({ id, title: id === 'k1' ? 'Statistik wiederholen' : 'Lesen im Park', areaId: 'a2', day: i, date: d(i),
        start: s, end: e, repeat: 'none', sug: true, grund });
      state.blocks.push(S('k1', 3, 540, 600, 'Vormittags, beste Zeit für Kopfarbeit'), S('k2', 6, 600, 690, 'Sonntag war am leersten'));
      save(); setView('heute'); renderAll();
      await document.fonts.ready; if (typeof blockZeilenEinpassen === 'function') blockZeilenEinpassen(document.querySelector('#grid'));
      return ['k1', 'k2'].map(id => {
        const b = document.querySelector('.block[data-id="' + id + '"]');
        const unten = b.clientHeight - parseFloat(getComputedStyle(b).paddingBottom) + 0.5;
        const zeilen = [...b.querySelectorAll('.block__time, .block__grund')].filter(x => getComputedStyle(x).display !== 'none');
        return { id, h: b.clientHeight, sichtbar: zeilen.map(x => x.className.split(' ')[0]),
          ueber: zeilen.filter(x => x.offsetTop + x.offsetHeight > unten).map(x => x.className.split(' ')[0]),
          title: b.title, grundWeg: !b.querySelector('.block__grund') || getComputedStyle(b.querySelector('.block__grund')).display === 'none'
            || !!b.querySelector('.block__grund.is-gekuerzt') };
      });
    });
    for (const x of r) {
      ok(x.ueber.length === 0, x.id + ' (' + x.h + ' px): keine Unterzeile halb abgeschnitten — sichtbar ' + JSON.stringify(x.sichtbar) + ', über dem Rand ' + JSON.stringify(x.ueber));
      if (x.grundWeg) ok(/Vormittags|Sonntag/.test(x.title), x.id + ': weggelassene Begründung bleibt im title erreichbar ("' + x.title.split(String.fromCharCode(10)).join(' | ') + '")');
    }
    await ctx.close();
  }

  // ---------------------------------------------------------------- f)
  console.log('f) Aufgaben-Haken: Stein und Haken in derselben Farbe');
  {
    const { ctx, p } = await seite();
    await p.evaluate(() => {
      state.tasks = [
        { id: 'tb', title: 'Mit Bereich', areaId: 'a3', done: false, frog: false },
        { id: 'to', title: 'Ohne Bereich', areaId: 'weg', done: false, frog: false }
      ];
      save(); setView('aufgaben'); renderAll();
    });
    const pruefe = async titel => {
      await p.click(`.task__check[aria-label="Erledigt: ${titel}"]`);
      const stein = await p.evaluate(() => { const s = document.querySelector('.jubel--stein'); return s ? getComputedStyle(s).backgroundColor : null; });
      await p.waitForTimeout(450);
      // Erledigte stehen im zugeklappten Abschnitt „Erledigt"
      await p.evaluate(t => { if (!document.querySelector(`.task__check[aria-label="Erledigt: ${t}"]`)) document.querySelector('.tasks__toggle').click(); }, titel);
      const haken = await p.evaluate(t => getComputedStyle(document.querySelector(`.task__check[aria-label="Erledigt: ${t}"]`)).backgroundColor, titel);
      const jade = await p.evaluate(() => { const d = document.createElement('i'); d.style.background = 'var(--jade)'; document.body.appendChild(d);
        const c = getComputedStyle(d).backgroundColor; d.remove(); return c; });
      return { stein, haken, jade };
    };
    const mit = await pruefe('Mit Bereich');
    ok(mit.stein && mit.stein === mit.haken && mit.haken !== mit.jade,
      'Aufgabe mit Bereich: fallender Stein = abgehakter Haken = Bereichsfarbe (' + mit.stein + ' / ' + mit.haken + ')');
    const ohne = await pruefe('Ohne Bereich');
    ok(ohne.stein && ohne.stein === ohne.haken && ohne.haken === ohne.jade,
      'Aufgabe ohne Bereich: Jade-Stein fällt in einen Jade-Haken (' + ohne.stein + ' / ' + ohne.haken + ')');
    await ctx.close();
  }

  await br.close();
  ok(konsolenfehler.length === 0, 'keine Konsolenfehler' + (konsolenfehler.length ? ': ' + konsolenfehler.join(' | ') : ''));
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nAlle Prüfungen bestanden.');
  process.exit(fehler.length ? 1 : 0);
})();
