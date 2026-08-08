const { chromium, devices } = require('playwright');
const path = require('path');
const LIST = ['iPhone SE','iPhone 13','iPhone 14 Pro Max','iPad (gen 7)','iPad Pro 11'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  for (const name of LIST) {
    const d = devices[name];
    if (!d) { console.log('unbekannt:', name); continue; }
    const c = await b.newContext({ ...d });
    const p = await c.newPage();
    await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await p.waitForTimeout(450);
    const go = p.locator('button:has-text("Los geht\'s")');
    if (await go.count()) { await go.click({ timeout: 5000 }).catch(()=>{}); await p.waitForTimeout(200); }
    // Seit Stufe 3 ist "heute" die Startansicht, nicht mehr "plan" — ohne das
    // hier ist .gridwrap am Handy unsichtbar (display:none) und raster misst 0.
    await p.evaluate(() => setView('plan'));
    const m = await p.evaluate(() => {
      const small = [];
      document.querySelectorAll('button, .chip, .task__check').forEach(el => {
        const q = el.getBoundingClientRect();
        if (q.width > 0 && (q.height < 40 || q.width < 36)) {
          small.push((el.id || el.className.toString().split(' ')[0] || el.textContent.trim()).slice(0,20) + ` ${Math.round(q.width)}x${Math.round(q.height)}`);
        }
      });
      return { vp: window.innerWidth + 'x' + window.innerHeight,
               coarse: matchMedia('(pointer: coarse)').matches,
               raster: Math.round((document.querySelector('.gridwrap')||{getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height),
               klein: [...new Set(small)] };
    });
    console.log(`\n### ${name}  ${m.vp}  coarse=${m.coarse}  raster=${m.raster}`);
    console.log('  zu klein:', m.klein.length ? m.klein.join(' | ') : 'keine');
    await c.close();
  }

  // ---- Aufgaben bei knapper Fensterhoehe: eine Platzklemme, kein Geraet
  // aus LIST oben trifft sie -- "viel Breite, wenig Hoehe" ist eine
  // Fenstergroesse, kein Geraeteprofil, deshalb ein eigener Viewport statt
  // eines verbogenen devices[...]-Eintrags.
  const fehler = [];
  const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

  async function aufgabenMessung(label, width, height) {
    const c = await b.newContext({ viewport: { width, height }, timezoneId: 'Europe/Berlin' });
    const p = await c.newPage();
    // Sichtbarkeit haengt an keiner Uhrzeit -- trotzdem genagelt, der
    // Hausvertrag gilt fuer jedes Pruefskript ausnahmslos.
    await p.clock.setFixedTime(new Date('2026-08-08T10:00:00+02:00'));
    await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await p.waitForTimeout(450);
    await p.evaluate(() => closeModal());
    await p.evaluate(() => {
      const areaId = state.areas[0].id;
      state.tasks.push({ id: 'q1', title: 'Waesche', areaId, done: false, frog: false });
      state.tasks.push({ id: 'q2', title: 'Einkaufen', areaId, done: false, frog: false });
      state.tasks.push({ id: 'q3', title: 'Anrufen', areaId, done: false, frog: false });
      save(); renderAll(); setView('aufgaben');
    });
    await p.waitForTimeout(250);

    // Ungescrollter Grundzustand: steht das Eingabefeld ohne jedes Zutun im Bild?
    const basis = await p.evaluate(() => {
      const panel = document.querySelector('.panel').getBoundingClientRect();
      const input = document.getElementById('taskInput').getBoundingClientRect();
      return { panelHoehe: Math.round(panel.height),
               inputSichtbar: input.width > 0 && input.top >= panel.top && input.bottom <= panel.bottom };
    });

    // Ans Ende scrollen -- sowohl am Panel als auch an der Liste selbst, je
    // nachdem, welches Element gerade das scrollende ist (vorher .tasks
    // allein, nachher .panel als Ganzes). Das misst die groesstmoegliche
    // Zahl gleichzeitig sichtbarer Zeilen: vorher blieb .tasks bei 144px
    // eigener Hoehe gedeckelt (gemessen: maximal 2 von 3 Zeilen, egal wie
    // weit man dort hineinscrollte, weil der Deckel an der Liste selbst
    // haengt, nicht am verfuegbaren Platz) -- danach ist die Liste kein
    // eigener Scrollrahmen mehr, alle 3 werden ueber den einen gemeinsamen
    // Scrollweg erreichbar.
    const maxSichtbar = await p.evaluate(() => {
      const panelEl = document.querySelector('.panel');
      const listEl = document.getElementById('taskList');
      panelEl.scrollTop = panelEl.scrollHeight;
      listEl.scrollTop = listEl.scrollHeight;
      function sichtbarAnteil(el) {
        const rect = el.getBoundingClientRect();
        let clipTop = 0, clipBottom = window.innerHeight;
        let node = el.parentElement;
        while (node) {
          const cs = getComputedStyle(node);
          if (/(auto|hidden|scroll|clip)/.test(cs.overflowY)) {
            const nr = node.getBoundingClientRect();
            clipTop = Math.max(clipTop, nr.top);
            clipBottom = Math.min(clipBottom, nr.bottom);
          }
          node = node.parentElement;
        }
        const overlap = Math.min(rect.bottom, clipBottom) - Math.max(rect.top, clipTop);
        return Math.max(0, overlap) / rect.height;
      }
      return [...document.querySelectorAll('.task')].filter(r => sichtbarAnteil(r) > 0.5).length;
    });

    console.log(`  ${label}: panel=${basis.panelHoehe}px  Eingabefeld ohne Scrollen sichtbar=${basis.inputSichtbar}  gleichzeitig sichtbare Zeilen (max.)=${maxSichtbar}`);
    await c.close();
    return { ...basis, maxSichtbar };
  }

  console.log('\n### Aufgaben, knappe Hoehe (die Falzhoehe selbst, kein Geraeteprofil)');
  const quer = await aufgabenMessung('Querformat 844x390', 844, 390);
  // "Deutlich mehr" heisst hier konkret: alle drei statt hoechstens zwei --
  // die Liste hat keinen eigenen Deckel mehr, das war der ganze Fehler.
  ok(quer.maxSichtbar === 3, 'Querformat zeigt gleichzeitig alle Zeilen (kein eigener Deckel an der Liste mehr): ' + quer.maxSichtbar + ' von 3');
  ok(quer.inputSichtbar, 'Eingabefeld im Querformat ohne Scrollen sichtbar');

  const hoch = await aufgabenMessung('Hochformat 390x844', 390, 844);
  // Gegenprobe: das Hochformat war nie betroffen und darf sich nicht aendern.
  ok(hoch.maxSichtbar === 3, 'Hochformat zeigt weiterhin alle Zeilen gleichzeitig: ' + hoch.maxSichtbar + ' von 3');
  ok(hoch.inputSichtbar, 'Eingabefeld im Hochformat ohne Scrollen sichtbar (steht oben fest)');

  console.log('\n' + (fehler.length ? fehler.length + ' FEHLER:' : 'Alle Pruefungen bestanden.'));
  fehler.forEach(f => console.log(' - ' + f));

  await b.close();
  process.exit(fehler.length ? 1 : 0);
})();
