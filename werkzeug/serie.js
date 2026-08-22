/* ============================================================
   Prüfskript Serie — zweiwöchentliche Termine (dauerhaft, Exit 1).

   Deckt den Auftrag "Zweiwöchentliche Termine" ab:
     a)+b) Parität — ein 2-Wochen-Termin trifft die Woche von "since" und
           jede zweite danach, keine dazwischen, keine davor.
     c)    Sommerzeit — dieselbe Parität über die Umstellung im März und im
           Oktober hinweg (der Fall, an dem eine naive Wochenrechnung ohne
           Math.round kippt).
     d)    Der Haken — zwei verschiedene Wochen desselben 2-Wochen-Termins
           erzeugen zwei Schlüssel in state.erledigt; Abhaken der einen
           lässt die andere unberührt.
     e)    Löschen und Verschieben stellen die Serien-Rückfrage.
     f)    Verschieben — was danach mit dem Rhythmus passiert.
     g)    Regressionsschutz — jeder Punkt läuft zusätzlich für "weekly",
           unverändert gegenüber vor der istSerie()-Vereinheitlichung.

   Zu f): moveSheet() bricht eine Serie beim Verschieben bisher IMMER
   vollständig auf (repeat: "none", since gelöscht) — das ist dokumentiertes,
   von dieser Änderung unangetastetes Verhalten (Kommentar in moveSheet()),
   nicht neu für "2wochen". Es gibt also keinen Weg, bei dem der Rhythmus
   automatisch weiterläuft. Was stimmt: aktiviert man ihn danach im Editor
   erneut, verankert sich "since" korrekt am NEUEN (verschobenen) Datum,
   nicht am alten — der Rhythmus läuft dann ab dort weiter. Genau das prüft
   dieser Abschnitt, plus die Gegenprobe, dass das Verschieben selbst auch
   bei "weekly" unverändert alles aufbricht.

   Stil wie haken.js/dialog.js: eine Chromium-Seite (iPhone SE), deutsche
   Ausgabe, Exit 1 bei Fehlern. timezoneId fest auf Europe/Berlin, sonst
   testet c) die Sommerzeitumstellung nur, wenn die Maschine zufällig in
   dieser Zeitzone läuft.

   Nachbesserung: ein einzelner page.clock.setFixedTime()-Aufruf vor dem
   allerersten goto() nagelt jetzt zusätzlich den Erststart-Assistenten fest
   (Montagmorgen, 2026-08-03T08:00:00+02:00) — seit Stufe D kann der dort ein
   Kapazitäts-Gate öffnen, ein ungenagelter Lauf wäre kalendertagabhängig
   grün oder rot. Alles andere in diesem Skript bleibt bewusst unangetastet:
   a)/b)/c) und der DST-Abschnitt rechnen ausschließlich mit expliziten
   Datums-Literalen (new Date(since + 'T12:00:00')), nie mit new Date() ohne
   Argument — von setFixedTime() unberührt. d)/e)/f) lesen dagegen bewusst
   "jetzt" (anchor = new Date() bzw. addDays(mondayOf(new Date()), 7)) als
   relative Basis für ihr eigenes Szenario, kein Test einer bestimmten
   Zeitreise — sie werden durch die eine feste Uhr oben nur deterministisch
   (immer dieselbe Woche), nicht falsch.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone SE'], timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  // Montagmorgen, s. Kopfkommentar — nagelt nur den Erststart fest, der Rest
  // des Skripts rechnet entweder mit expliziten Datums-Literalen (unberührt)
  // oder bewusst relativ zu "jetzt" (wird dadurch nur deterministisch).
  await p.clock.setFixedTime(new Date('2026-08-03T08:00:00+02:00'));
  await p.goto(F); await p.waitForTimeout(500);
  // Erststart-Assistent wegklicken (wie haken.js/dialog.js/audit.js).
  for (let i = 0; i < 3; i++) { await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(280); }
  await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(900);

  /* ---- a)+b)+g) Parität über mindestens sechs Wochen, vor und nach since */
  console.log('\n## a)+b) Parität: since-Woche + jede zweite danach trifft, davor nie (2wochen und weekly)');
  for (const rhythmus of ['2wochen', 'weekly']) {
    const r = await p.evaluate((rhythmus) => {
      const since = '2026-01-05';   // ein gewöhnlicher Montag, keine Zeitumstellung in der Nähe
      const dayIdx = 2;             // Mittwoch — since selbst ist ein Montag, der Termin liegt zwei Tage später
      const b = { day: dayIdx, repeat: rhythmus, since };
      const ergebnisse = [];
      for (let off = -3; off <= 8; off++) {   // elf Wochen, drei davor, acht danach
        const dayKey = iso(addDays(new Date(since + 'T12:00:00'), off * 7 + dayIdx));
        ergebnisse.push({ off, dayKey, treffer: onDay(b, dayKey, dayIdx) });
      }
      return ergebnisse;
    }, rhythmus);
    console.log('   ' + rhythmus + ': ' + r.map(e => e.off + ':' + (e.treffer ? '1' : '0')).join('  '));
    r.forEach(e => {
      const erwartet = e.off < 0 ? false : (rhythmus === '2wochen' ? e.off % 2 === 0 : true);
      ok(e.treffer === erwartet, rhythmus + ' Woche ' + e.off + ' (' + e.dayKey + '): erwartet ' + erwartet + ', erhalten ' + e.treffer);
    });
  }

  /* ---- c)+g) Sommerzeit: Parität bleibt über die Umstellung korrekt ---- */
  console.log('\n## c) Sommerzeit: Parität bleibt über die Umstellung im März und Oktober korrekt (2wochen und weekly)');
  const umstellungen = [
    ['März (Umstellung 29.3.2026)', '2026-03-02'],       // Montag drei Wochen vor der Umstellung
    ['Oktober (Umstellung 25.10.2026)', '2026-09-28']    // Montag vier Wochen vor der Umstellung
  ];
  for (const [name, since] of umstellungen) {
    for (const rhythmus of ['2wochen', 'weekly']) {
      const r = await p.evaluate(({ since, rhythmus }) => {
        const dayIdx = 0;   // since ist selbst ein Montag — der Termin liegt am since-Wochentag
        const b = { day: dayIdx, repeat: rhythmus, since };
        const ergebnisse = [];
        for (let off = 0; off <= 7; off++) {
          const dayKey = iso(addDays(new Date(since + 'T12:00:00'), off * 7));
          ergebnisse.push({ off, dayKey, treffer: onDay(b, dayKey, dayIdx) });
        }
        return ergebnisse;
      }, { since, rhythmus });
      console.log('   ' + name + ' / ' + rhythmus + ': ' + r.map(e => e.off + ':' + (e.treffer ? '1' : '0') + '@' + e.dayKey).join('  '));
      r.forEach(e => {
        const erwartet = rhythmus === '2wochen' ? e.off % 2 === 0 : true;
        ok(e.treffer === erwartet, name + ' ' + rhythmus + ' Woche ' + e.off + ' (' + e.dayKey + '): erwartet ' + erwartet + ', erhalten ' + e.treffer);
      });
    }
  }

  /* ---- d)+g) Der Haken: zwei Wochen, zwei Schlüssel, gegenseitig unberührt */
  async function pruefeHaken(rhythmus) {
    console.log('\n## d) Haken: ' + rhythmus + ' in zwei Wochen abgehakt erzeugt zwei Schlüssel, unabhängig voneinander');
    await p.evaluate((rhythmus) => {
      anchor = new Date(); selectedDayIdx = (new Date().getDay() + 6) % 7;
      state.erledigt = {};
      state.blocks = state.blocks.filter(b => b.id !== 'blk-serie-haken');
      const dayIdx = selectedDayIdx;
      const dayKey = iso(addDays(mondayOf(anchor), dayIdx));
      const cap = m => Math.max(0, Math.min(1439, m));
      const jetzt = new Date().getHours() * 60 + new Date().getMinutes();
      const st = cap(jetzt + 60), en = cap(st + 30);
      state.blocks.push({
        id: 'blk-serie-haken', title: 'Serie Haken Test', areaId: state.areas[0].id,
        day: dayIdx, date: dayKey, repeat: rhythmus, since: dayKey, start: st, end: en, frog: false
      });
      save(); setView('heute'); renderAll();
    }, rhythmus);
    await p.waitForTimeout(200);

    const woche1 = await p.evaluate(() => iso(addDays(mondayOf(anchor), selectedDayIdx)));
    await p.click(".agenda__check[data-id='blk-serie-haken']");
    await p.waitForTimeout(150);
    const nachWoche1 = await p.evaluate(w1 => {
      const b = state.blocks.find(x => x.id === 'blk-serie-haken');
      return { erledigt: istErledigt(b, w1), keys: Object.keys(state.erledigt).length };
    }, woche1);
    ok(nachWoche1.erledigt === true, rhythmus + ': Woche 1 (' + woche1 + ') ist abgehakt');
    ok(nachWoche1.keys === 1, rhythmus + ': genau EIN Schlüssel nach dem ersten Abhaken (' + nachWoche1.keys + ')');

    // Bei 2wochen liegt dazwischen eine "aus"-Woche — der Termin darf dort
    // in der Agenda gar nicht erst auftauchen.
    await p.click('#nextWeek'); await p.waitForTimeout(200);
    if (rhythmus === '2wochen') {
      const vorhanden = await p.evaluate(() => !!document.querySelector(".agenda__check[data-id='blk-serie-haken']"));
      ok(!vorhanden, '2wochen: in der Zwischenwoche taucht der Termin in der Agenda gar nicht auf');
      await p.click('#nextWeek'); await p.waitForTimeout(200);
    }

    const woche2 = await p.evaluate(() => iso(addDays(mondayOf(anchor), selectedDayIdx)));
    ok(woche2 !== woche1, rhythmus + ': Woche 2 hat ein anderes Datum als Woche 1 (' + woche1 + ' / ' + woche2 + ')');

    const vorWoche2 = await p.evaluate(({ w1, w2 }) => {
      const b = state.blocks.find(x => x.id === 'blk-serie-haken');
      return { w1: istErledigt(b, w1), w2: istErledigt(b, w2) };
    }, { w1: woche1, w2: woche2 });
    ok(vorWoche2.w1 === true, rhythmus + ': Woche 1 bleibt erledigt, bevor Woche 2 angefasst wird');
    ok(vorWoche2.w2 === false, rhythmus + ': Woche 2 ist vor dem Klick noch NICHT erledigt (kein Serien-Effekt)');

    await p.click(".agenda__check[data-id='blk-serie-haken']");
    await p.waitForTimeout(150);
    const nachWoche2 = await p.evaluate(({ w1, w2 }) => {
      const b = state.blocks.find(x => x.id === 'blk-serie-haken');
      return {
        w1: istErledigt(b, w1), w2: istErledigt(b, w2),
        k1: hakenKey(b, w1), k2: hakenKey(b, w2), keys: Object.keys(state.erledigt)
      };
    }, { w1: woche1, w2: woche2 });
    ok(nachWoche2.w2 === true, rhythmus + ': Woche 2 ist jetzt erledigt');
    ok(nachWoche2.w1 === true, rhythmus + ': Woche 1 bleibt unverändert erledigt — Abhaken von Woche 2 hat sie nicht angerührt');
    ok(nachWoche2.k1 !== nachWoche2.k2, rhythmus + ': die beiden Schlüssel unterscheiden sich (' + nachWoche2.k1 + ' / ' + nachWoche2.k2 + ')');
    ok(nachWoche2.keys.length === 2, rhythmus + ': genau ZWEI Schlüssel insgesamt (' + nachWoche2.keys.length + ')');

    await p.evaluate(() => {
      anchor = new Date(); selectedDayIdx = (new Date().getDay() + 6) % 7;
      state.blocks = state.blocks.filter(b => b.id !== 'blk-serie-haken');
      state.erledigt = {};
      save(); renderAll();
    });
    await p.waitForTimeout(150);
  }
  await pruefeHaken('2wochen');
  await pruefeHaken('weekly');

  /* ---- e)+g) Löschen und Verschieben stellen die Serien-Rückfrage ------ */
  async function pruefeRueckfragen(rhythmus) {
    console.log('\n## e) Serien-Rückfrage bei Löschen und Verschieben: ' + rhythmus);
    const titel = rhythmus === '2wochen' ? 'Zweiwöchentlicher Eintrag' : 'Wöchentlicher Eintrag';
    const loeschText = rhythmus === '2wochen' ? 'alle 2 Wochen' : 'jeder Woche';
    const verschiebText = rhythmus === '2wochen' ? 'bisher alle 2 Wochen' : 'bisher in jeder Woche';

    // -- Löschen --
    await p.evaluate((rhythmus) => {
      state = freshState(); migrate(state);
      anchor = addDays(mondayOf(new Date()), 7);
      state.blocks = [];
      const day = weekDays()[2];
      state.blocks.push({
        id: 'blk-serie-frage', title: 'Rückfrage Test', areaId: state.areas[0].id,
        day: day.i, date: day.key, repeat: rhythmus, since: day.key, start: 600, end: 630, frog: false
      });
      save(); renderAll();
      editBlock('blk-serie-frage', day.key);
    }, rhythmus);
    await p.waitForTimeout(300);

    await p.click(".sheet__foot button:has-text('Löschen')");
    await p.waitForTimeout(300);
    const delDialog = await p.evaluate(() => ({
      titel: document.querySelector('.sheet h2') ? document.querySelector('.sheet h2').textContent : null,
      text: document.querySelector('.sheet p') ? document.querySelector('.sheet p').textContent : null
    }));
    ok(delDialog.titel === titel, rhythmus + ' Löschen: Dialogtitel "' + titel + '" (erhalten "' + delDialog.titel + '")');
    ok(!!delDialog.text && delDialog.text.includes(loeschText), rhythmus + ' Löschen: Text nennt "' + loeschText + '" (' + delDialog.text + ')');

    await p.click(".sheet__foot button:has-text('Abbrechen')");   // Rückfrage weg, Editor bleibt
    await p.waitForTimeout(200);
    await p.keyboard.press('Escape');   // Editor auch schließen, ohne zu löschen
    await p.waitForTimeout(200);

    // -- Verschieben --
    await p.evaluate(() => { moveSheet('blk-serie-frage'); });
    await p.waitForTimeout(300);
    const zielKurz = await p.evaluate(() => {
      const blk = state.blocks.find(x => x.id === 'blk-serie-frage');
      const ziel = weekDays().find(d => d.i !== blk.day);
      return DAY_SHORT[ziel.i];
    });
    await p.click("#mvDays button:has-text('" + zielKurz + "')");
    await p.waitForTimeout(300);
    const moveDialog = await p.evaluate(() => ({
      titel: document.querySelector('.sheet h2') ? document.querySelector('.sheet h2').textContent : null,
      text: document.querySelector('.sheet p') ? document.querySelector('.sheet p').textContent : null
    }));
    ok(moveDialog.titel === titel, rhythmus + ' Verschieben: Dialogtitel "' + titel + '" (erhalten "' + moveDialog.titel + '")');
    ok(!!moveDialog.text && moveDialog.text.includes(verschiebText), rhythmus + ' Verschieben: Text nennt "' + verschiebText + '" (' + moveDialog.text + ')');

    await p.click(".sheet__foot button:has-text('Abbrechen')");
    await p.waitForTimeout(200);
  }
  await pruefeRueckfragen('2wochen');
  await pruefeRueckfragen('weekly');

  /* ---- f)+g) Nach dem Verschieben: Serie bricht auf; reaktiviert läuft
     der Rhythmus ab dem NEUEN Datum weiter (siehe Kommentarblock oben) --- */
  console.log('\n## f) Verschieben bricht die Serie auf; erneutes Aktivieren verankert since am neuen Datum');
  await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    const day = weekDays()[1];   // Dienstag
    state.blocks.push({
      id: 'blk-f', title: 'Verschiebe-Rhythmus-Test', areaId: state.areas[0].id,
      day: day.i, date: day.key, repeat: '2wochen', since: day.key, start: 600, end: 630, frog: false
    });
    save(); renderAll();
    moveSheet('blk-f');
  });
  await p.waitForTimeout(300);
  const zielF = await p.evaluate(() => {
    const blk = state.blocks.find(x => x.id === 'blk-f');
    const ziel = weekDays().find(d => d.i !== blk.day);
    return { kurz: DAY_SHORT[ziel.i], key: ziel.key };
  });
  await p.click("#mvDays button:has-text('" + zielF.kurz + "')");
  await p.waitForTimeout(300);
  await p.click(".sheet__foot button:has-text('Trotzdem verschieben')");
  await p.waitForTimeout(300);

  const nachVerschieben = await p.evaluate(() => {
    const b = state.blocks.find(x => x.id === 'blk-f');
    return { repeat: b.repeat, since: b.since, date: b.date };
  });
  ok(nachVerschieben.repeat === 'none', 'f) Verschieben bricht die Serie vollständig auf (repeat "none", erhalten "' + nachVerschieben.repeat + '")');
  ok(nachVerschieben.since === undefined, 'f) since ist nach dem Verschieben gelöscht (' + JSON.stringify(nachVerschieben.since) + ')');
  ok(nachVerschieben.date === zielF.key, 'f) der Eintrag steht jetzt auf dem gewählten Tag (' + nachVerschieben.date + ')');

  await p.evaluate(() => editBlock('blk-f', state.blocks.find(x => x.id === 'blk-f').date));
  await p.waitForTimeout(300);
  await p.click("#bRepeat button:has-text('Alle 2 Wochen')");
  await p.click(".sheet__foot .btn--primary");   // Speichern
  await p.waitForTimeout(200);

  const neuerAnker = await p.evaluate(() => {
    const b = state.blocks.find(x => x.id === 'blk-f');
    return { repeat: b.repeat, since: b.since, date: b.date };
  });
  ok(neuerAnker.repeat === '2wochen', 'f) nach dem erneuten Aktivieren ist der Eintrag wieder eine 2-Wochen-Serie');
  ok(neuerAnker.since === neuerAnker.date, 'f) since verankert sich am neuen (verschobenen) Datum, nicht am alten (' + neuerAnker.since + ' vs. Landedatum ' + neuerAnker.date + ')');

  const weiterlauf = await p.evaluate(() => {
    const b = state.blocks.find(x => x.id === 'blk-f');
    return [0, 1, 2].map(off => {
      const dayKey = iso(addDays(new Date(b.since + 'T12:00:00'), off * 7));
      return { off, dayKey, treffer: onDay(b, dayKey, b.day) };
    });
  });
  console.log('   Rhythmus ab dem neuen Datum: ' + weiterlauf.map(e => e.off + ':' + (e.treffer ? '1' : '0')).join('  '));
  weiterlauf.forEach(e => {
    ok(e.treffer === (e.off % 2 === 0), 'f) Rhythmus ab dem neuen Datum: Woche ' + e.off + ' (' + e.dayKey + ') erwartet ' + (e.off % 2 === 0) + ', erhalten ' + e.treffer);
  });

  // Gegenprobe: dasselbe Verschieben bricht einen wöchentlichen Eintrag
  // ebenso vollständig auf — unverändert gegenüber vor der Vereinheitlichung.
  console.log('\n## f-Regression) Verschieben bricht auch einen wöchentlichen Eintrag vollständig auf');
  await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    const day = weekDays()[1];
    state.blocks.push({
      id: 'blk-fw', title: 'Verschiebe-Rhythmus-Test wöchentlich', areaId: state.areas[0].id,
      day: day.i, date: day.key, repeat: 'weekly', since: day.key, start: 600, end: 630, frog: false
    });
    save(); renderAll();
    moveSheet('blk-fw');
  });
  await p.waitForTimeout(300);
  const zielFw = await p.evaluate(() => {
    const blk = state.blocks.find(x => x.id === 'blk-fw');
    const ziel = weekDays().find(d => d.i !== blk.day);
    return DAY_SHORT[ziel.i];
  });
  await p.click("#mvDays button:has-text('" + zielFw + "')");
  await p.waitForTimeout(300);
  await p.click(".sheet__foot button:has-text('Trotzdem verschieben')");
  await p.waitForTimeout(300);
  const nachVerschiebenW = await p.evaluate(() => {
    const b = state.blocks.find(x => x.id === 'blk-fw');
    return { repeat: b.repeat, since: b.since };
  });
  ok(nachVerschiebenW.repeat === 'none', 'f-Regression) weekly: Verschieben bricht die Serie ebenso auf (' + nachVerschiebenW.repeat + ')');
  ok(nachVerschiebenW.since === undefined, 'f-Regression) weekly: since ist gelöscht (' + JSON.stringify(nachVerschiebenW.since) + ')');

  /* ---- h) Nur diesen Termin — b.ausnahmen ------------------------------ */
  console.log('\n## h) "Nur diesen Termin": UI-Weg, Persistenz, Sync, erledigt-Rest, freeGaps, "Ganze Serie" weiterhin komplett');

  // h-i) UI-Weg: Serie anlegen, in Woche N+1 die Instanz löschen.
  await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);   // Woche N+1
    state.blocks = [];
    const day = weekDays()[3];   // Donnerstag
    state.blocks.push({
      id: 'blk-h', title: 'Ausnahme Test', areaId: state.areas[0].id,
      day: day.i, date: day.key, repeat: '2wochen', since: day.key, start: 600, end: 630, frog: false
    });
    save(); renderAll();
    editBlock('blk-h', day.key);
  });
  await p.waitForTimeout(300);
  await p.click(".sheet__foot button:has-text('Löschen')");
  await p.waitForTimeout(300);
  const dreiWege = await p.evaluate(() => [...document.querySelectorAll('.sheet__foot button')].map(b => b.textContent.trim()));
  ok(dreiWege.includes('Nur diesen Termin'), 'h-i) Rückfrage zeigt "Nur diesen Termin" (erhalten: ' + dreiWege.join(', ') + ')');
  ok(dreiWege.includes('Aus allen Wochen löschen'), 'h-i) Rückfrage zeigt weiterhin "Aus allen Wochen löschen" (erhalten: ' + dreiWege.join(', ') + ')');
  ok(dreiWege.includes('Abbrechen'), 'h-i) Rückfrage zeigt weiterhin "Abbrechen" (erhalten: ' + dreiWege.join(', ') + ')');

  await p.click(".sheet__foot button:has-text('Nur diesen Termin')");
  await p.waitForTimeout(300);
  const nachAusnahme = await p.evaluate(() => {
    const b = state.blocks.find(x => x.id === 'blk-h');
    const vorWoche = iso(addDays(mondayOf(anchor), -7 + 3));
    const dieseWoche = iso(addDays(mondayOf(anchor), 3));
    const folgeWoche = iso(addDays(mondayOf(anchor), 14 + 3));   // +2 Wochen: nächste passende Parität
    return {
      existiertNoch: !!b, ausnahmen: b ? b.ausnahmen : null,
      dieseWoche: b ? onDay(b, dieseWoche, 3) : null,
      vorWoche: b ? onDay(b, vorWoche, 3) : null,
      folgeWoche: b ? onDay(b, folgeWoche, 3) : null,
      dieseWocheKey: dieseWoche
    };
  });
  ok(nachAusnahme.existiertNoch === true, 'h-i) der Block lebt weiter (kein Grabstein)');
  ok(Array.isArray(nachAusnahme.ausnahmen) && nachAusnahme.ausnahmen.includes(nachAusnahme.dieseWocheKey),
    'h-i) b.ausnahmen enthält das gelöschte Datum (' + JSON.stringify(nachAusnahme.ausnahmen) + ')');
  ok(nachAusnahme.dieseWoche === false, 'h-i) onDay() liefert für die ausgenommene Woche false');
  // 2wochen-Parität: Vorwoche (ungerade Woche) traf ohnehin nicht, prüfen wir
  // trotzdem als Referenz — die eigentliche Zusicherung ist die Folgewoche.
  ok(nachAusnahme.folgeWoche === true, 'h-i) die Folgewoche (übernächste, wieder gerade Parität) zeigt die Serie weiter');

  const toastText = await p.evaluate(() => {
    const all = document.querySelectorAll('.toast');
    const t = all[all.length - 1];
    return t ? t.textContent : null;
  });
  ok(!!toastText && toastText.includes('übersprungen'), 'h-i) Toast nennt "übersprungen" (' + toastText + ')');

  // h-ii) Persistenz: 10x migrate() ändert nichts, ungültige Werte verworfen.
  const persistenz = await p.evaluate(() => {
    const vorher = JSON.stringify(state.blocks.find(x => x.id === 'blk-h').ausnahmen);
    for (let i = 0; i < 10; i++) migrate(state);
    const nachher = JSON.stringify(state.blocks.find(x => x.id === 'blk-h').ausnahmen);

    const b2 = { id: 'blk-h-invalid', repeat: 'weekly', day: 0, since: '2026-01-05', ausnahmen: ['nicht-iso', 42, null, '2026-02-02'] };
    const s = { areas: [], blocks: [b2], tasks: [] };
    migrate(s);
    const b3 = { id: 'blk-h-leer', repeat: 'weekly', day: 0, since: '2026-01-05', ausnahmen: [] };
    const s2 = { areas: [], blocks: [b3], tasks: [] };
    migrate(s2);
    return { idempotent: vorher === nachher, gefiltert: s.blocks[0].ausnahmen, leerWeg: 'ausnahmen' in s2.blocks[0] };
  });
  ok(persistenz.idempotent, 'h-ii) 10x migrate() ändert b.ausnahmen nicht (' + persistenz.idempotent + ')');
  ok(JSON.stringify(persistenz.gefiltert) === JSON.stringify(['2026-02-02']),
    'h-ii) ungültige Werte (nicht-ISO, Zahl, null) werden verworfen, gültige bleiben (' + JSON.stringify(persistenz.gefiltert) + ')');
  ok(persistenz.leerWeg === false, 'h-ii) ein leeres ausnahmen-Array wird beim migrate() entfernt');

  // h-iii) Sync-Rundlauf-Miniatur: mergeStates() direkt.
  const syncTest = await p.evaluate(() => {
    const basis = { id: 'blk-sync', title: 'Sync Test', areaId: 'a1', day: 2, repeat: 'weekly', since: '2026-01-05', start: 600, end: 630 };
    // Fall 1: Gerät B ohne Ausnahme (älter), Gerät A mit Ausnahme (neuer) — Ausnahme gewinnt.
    const mineOhne = { ...basis, at: 100 };
    const theirsMit = { ...basis, ausnahmen: ['2026-01-19'], at: 200 };
    const s1 = mergeStates(
      { areas: [], tasks: [], orte: [], wege: {}, tombs: {}, erledigt: {}, rituale: {}, days: {}, profile: {}, blocks: [mineOhne] },
      { areas: [], tasks: [], orte: [], wege: {}, tombs: {}, erledigt: {}, rituale: {}, days: {}, profile: {}, blocks: [theirsMit] }
    );
    // Fall 2: umgekehrt — die ältere Ausnahme verliert gegen den neueren Stand ohne.
    const mineMitAelter = { ...basis, ausnahmen: ['2026-01-19'], at: 100 };
    const theirsOhneNeuer = { ...basis, at: 200 };
    const s2 = mergeStates(
      { areas: [], tasks: [], orte: [], wege: {}, tombs: {}, erledigt: {}, rituale: {}, days: {}, profile: {}, blocks: [mineMitAelter] },
      { areas: [], tasks: [], orte: [], wege: {}, tombs: {}, erledigt: {}, rituale: {}, days: {}, profile: {}, blocks: [theirsOhneNeuer] }
    );
    return {
      fall1: s1.blocks[0].ausnahmen,
      fall2: s2.blocks[0].ausnahmen
    };
  });
  ok(Array.isArray(syncTest.fall1) && syncTest.fall1.includes('2026-01-19'),
    'h-iii) Sync Fall 1: neuere Ausnahme gewinnt über älteren Stand ohne (' + JSON.stringify(syncTest.fall1) + ')');
  ok(!syncTest.fall2 || !syncTest.fall2.includes('2026-01-19'),
    'h-iii) Sync Fall 2: ältere Ausnahme verliert gegen neueren Stand ohne (' + JSON.stringify(syncTest.fall2) + ')');

  // h-iv) erledigt-Eintrag des ausgenommenen Datums bleibt liegen.
  const erledigtRest = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    const day = weekDays()[4];
    const b = {
      id: 'blk-h-erledigt', title: 'Erledigt-Rest Test', areaId: state.areas[0].id,
      day: day.i, date: day.key, repeat: 'weekly', since: day.key, start: 600, end: 630, frog: false
    };
    state.blocks.push(b);
    save();
    setzeErledigt(b, day.key, true);
    const schluesselVorher = Object.keys(state.erledigt).length;
    b.ausnahmen = [day.key];
    save();
    return {
      schluesselVorher, schluesselNachher: Object.keys(state.erledigt).length,
      key: hakenKey(b, day.key), nochDa: hakenKey(b, day.key) in state.erledigt
    };
  });
  ok(erledigtRest.schluesselVorher === 1 && erledigtRest.schluesselNachher === 1,
    'h-iv) der erledigt-Schlüssel bleibt bestehen, wird nicht entfernt (' + erledigtRest.schluesselVorher + ' → ' + erledigtRest.schluesselNachher + ')');
  ok(erledigtRest.nochDa, 'h-iv) der konkrete Schlüssel ' + erledigtRest.key + ' existiert noch');

  // h-v) freeGaps() bietet den freigewordenen Slot wieder an.
  const freeSlot = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    const day = weekDays()[5];
    const b = {
      id: 'blk-h-gap', title: 'Gap Test', areaId: state.areas[0].id,
      day: day.i, date: day.key, repeat: 'weekly', since: day.key, start: 600, end: 630, frog: false
    };
    state.blocks.push(b);
    save(); renderAll();
    const area = areaById(b.areaId);
    const vorAusnahme = freeGaps(day, { from: null, to: null, days: [day.i] }, area);
    const belegtVorher = vorAusnahme.some(g => g.start <= 600 && g.end >= 630);
    b.ausnahmen = [day.key];
    save(); renderAll();
    const nachAusnahmeGaps = freeGaps(day, { from: null, to: null, days: [day.i] }, area);
    const frei = nachAusnahmeGaps.some(g => g.start <= 600 && g.end >= 630);
    return { belegtVorher, frei };
  });
  ok(freeSlot.belegtVorher === false, 'h-v) vor der Ausnahme ist der Slot 10:00–10:30 nicht frei (vom Block belegt)');
  ok(freeSlot.frei === true, 'h-v) nach der Ausnahme bietet freeGaps() denselben Slot wieder an');

  // h-vi) "Ganze Serie" löscht weiterhin komplett mit Grabstein.
  const ganzeSerie = await p.evaluate(() => {
    state = freshState(); migrate(state);
    anchor = addDays(mondayOf(new Date()), 7);
    state.blocks = [];
    const day = weekDays()[2];
    state.blocks.push({
      id: 'blk-h-ganz', title: 'Ganze Serie Test', areaId: state.areas[0].id,
      day: day.i, date: day.key, repeat: 'weekly', since: day.key, start: 600, end: 630, frog: false
    });
    save(); renderAll();
    editBlock('blk-h-ganz', day.key);
  });
  await p.waitForTimeout(300);
  await p.click(".sheet__foot button:has-text('Löschen')");
  await p.waitForTimeout(300);
  await p.click(".sheet__foot button:has-text('Aus allen Wochen löschen')");
  await p.waitForTimeout(300);
  const nachGanzerSerie = await p.evaluate(() => ({
    existiert: !!state.blocks.find(x => x.id === 'blk-h-ganz'),
    grabstein: typeof state.tombs['blk-h-ganz'] === 'number'
  }));
  ok(nachGanzerSerie.existiert === false, 'h-vi) "Ganze Serie" entfernt den Block weiterhin komplett');
  ok(nachGanzerSerie.grabstein === true, 'h-vi) "Ganze Serie" hinterlässt weiterhin einen Grabstein');

  /* ---- h-Rot-Beweis: jede neue Zusicherung schlägt am unveränderten Stand
     fehl. Verfahren laut Auftrag: Sicherungskopie der geänderten index.html,
     Fix (onDay-Ausnahmeprüfung) zurücknehmen, isoliert prüfen, wiederherstellen. */
  console.log('\n## h) Rot-Beweis: onDay() ohne Ausnahmeprüfung liefert bei einer Ausnahme fälschlich true');
  const rotBeweis = await p.evaluate(() => {
    // onDay() ohne die "b.ausnahmen"-Zeile nachgebaut — exakt der Stand vor dem Fix.
    function onDayAlt(b, dayKey, dayIdx) {
      if (!istSerie(b)) return b.date === dayKey;
      if (b.day !== dayIdx) return false;
      if (b.since && dayKey < b.since) return false;
      if (b.repeat === '2wochen' && b.since) {
        const a = mondayOf(new Date(b.since + 'T12:00:00'));
        const z = mondayOf(new Date(dayKey + 'T12:00:00'));
        if (Math.round((z - a) / 604800000) % 2 !== 0) return false;
      }
      return true;
    }
    const b = { day: 2, repeat: 'weekly', since: '2026-01-05', ausnahmen: ['2026-01-19'] };
    return { alt: onDayAlt(b, '2026-01-19', 2), neu: onDay(b, '2026-01-19', 2) };
  });
  ok(rotBeweis.alt === true, 'Rot-Beweis: der unveränderte Stand (onDay ohne Ausnahmeprüfung) zeigt den ausgenommenen Termin fälschlich weiter (erwartetes Rot)');
  ok(rotBeweis.neu === false, 'Grün-Gegenprobe: der aktuelle Stand blendet ihn korrekt aus');

  console.log('\n=== Konsolenfehler: ' + (konsolenfehler.length ? konsolenfehler.join(' | ') : 'keine'));
  if (konsolenfehler.length) fehler.push('Konsolenfehler aufgetreten');

  await br.close();
  if (fehler.length) { console.log('\n=== FEHLER (' + fehler.length + '):'); fehler.forEach(f => console.log(' - ' + f)); process.exit(1); }
  console.log('\nAlle Prüfungen bestanden.');
})();
