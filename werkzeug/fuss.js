/* ============================================================
   Pruefskript Fussbereich (Stufe 6, erweitert in Stufe 8) — iPhone SE
   (320x568) und Querformat

   Prueft, was der Bericht zu Stufe 6 ueber die Stapelung von Tabbar,
   Vorschlagsleiste, FAB und Toasts behauptet:
     a) Ueberlappung — mit offenen Vorschlaegen ueberlappen sich Tabbar,
        Tagesstreifen (.dayswitch, seit Stufe 8), Vorschlagsleiste, FAB
        und ein sichtbarer Toast PAARWEISE NICHT (Rechteck-Schnittflaeche
        = 0)
     b) Ohne Vorschlaege — die Leiste ist nicht im Bild, FAB und Toast
        ruecken nach unten (ihr bottom-Wert wird kleiner)
     c) Sicherheitszone — kein Element ragt unter die Tabbar-Unterkante
     d) Querformat — die Leiste erscheint auch dort

   Stil wie audit.js/agenda.js: eine Chromium-Seite, deutsche Ausgabe,
   Exit 1 bei Fehlern. Screenshots landen daneben in werkzeug/ zur
   Sichtpruefung von Hand.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK   ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

// Rechteck-Schnittflaeche zweier DOMRects, 0 wenn sie sich nicht beruehren.
function schnittflaeche(a, b) {
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return w * h;
}

// Skippt den Erststart-Assistenten wie audit.js/agenda.js.
async function onboardingWeg(p) {
  await p.goto(F); await p.waitForTimeout(500);
  for (let i = 0; i < 3; i++) { await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(280); }
  await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(900);
}

// Liest die Geometrie der vier unteren Flaechen aus. Nur vorhandene,
// tatsaechlich sichtbare Elemente bekommen ein Rechteck.
async function messen(p) {
  return p.evaluate(() => {
    const rectOrNull = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    return {
      innerHeight: window.innerHeight,
      sugbarFlag: document.body.dataset.sugbar,
      tabbar: rectOrNull('.tabbar'),
      dayswitch: rectOrNull('.dayswitch'),
      sugbar: rectOrNull('#sugBar'),
      fab: rectOrNull('.fab'),
      toast: rectOrNull('.toasts .toast:last-child'),
    };
  });
}

async function pruefeFall(p, tag, quer) {
  console.log(`\n## ${tag} (${quer ? 'Querformat' : 'Hochformat'})`);

  /* ---- Ausgangslage: Woche leeren, damit "leerer Tag" echt leer ist ---- */
  await p.evaluate(() => { state.blocks = []; state.tasks = []; save(); renderAll(); });
  await p.evaluate(() => setView('plan'));
  await p.waitForTimeout(150);

  /* ---- Fall 1: mit offenen Vorschlaegen -------------------------------- */
  await p.evaluate(() => {
    const mon = mondayOf(anchor);
    const heute = iso(mon), morgen = iso(addDays(mon, 1));
    state.blocks.push(
      { id: uid(), title: "Uni & Lernen", areaId: "a2", day: 0, date: heute, repeat: "none",
        start: 10 * 60, end: 11 * 60 + 30, frog: false, sug: true },
      { id: uid(), title: "Sport", areaId: "a3", day: 1, date: morgen, repeat: "none",
        start: 17 * 60, end: 18 * 60, frog: false, sug: true }
    );
    save(); renderAll(); setView('plan');
    // Der Erststart-Assistent hinterlaesst selbst einen Toast ("Deine Woche
    // steht.", 6s Laufzeit wegen Aktionsknopf). Vor der Messung wegraeumen,
    // sonst waere der zuletzt hinzugefuegte, nicht der aeltere Rest-Toast
    // Gegenstand der Pruefung.
    document.querySelectorAll('.toasts .toast').forEach(t => t.remove());
    toast("Testmeldung mit Vorschlaegen");
  });
  await p.waitForTimeout(200);

  const mit = await messen(p);
  await p.screenshot({ path: path.join(__dirname, `fuss-${tag}-mit-vorschlaegen.png`) });

  ok(mit.sugbarFlag === '1', 'data-sugbar=1, solange Vorschlaege offen sind');
  ok(!!mit.sugbar, 'Vorschlagsleiste ist sichtbar');
  ok(!!mit.fab || quer, 'FAB ist sichtbar (nur Hochformat erwartet)');
  ok(!!mit.toast, 'Toast ist sichtbar');
  // Ansicht 'plan' bei 320px Breite/Hoehe (hoch wie quer) liegt unter der
  // (max-width:640px)-Schwelle fuer einTag — der Tagesstreifen muss also da sein.
  ok(!!mit.dayswitch, 'Tagesstreifen (.dayswitch) ist sichtbar');

  const flaechen = { tabbar: mit.tabbar, dayswitch: mit.dayswitch, sugbar: mit.sugbar, fab: mit.fab, toast: mit.toast };
  const namen = Object.keys(flaechen).filter(k => flaechen[k]);
  for (let i = 0; i < namen.length; i++) {
    for (let j = i + 1; j < namen.length; j++) {
      const a = namen[i], b = namen[j];
      const s = schnittflaeche(flaechen[a], flaechen[b]);
      ok(s === 0, `${a} und ${b} ueberlappen sich nicht (Schnittflaeche ${s}px²)`);
    }
  }

  // Sicherheitszone: keine der schwebenden Flaechen ragt unter die
  // Tabbar-Unterkante (== Fensterunterkante bei safe-area-inset 0).
  ['tabbar', 'dayswitch', 'sugbar', 'fab', 'toast'].forEach(k => {
    const r = flaechen[k];
    if (!r) return;
    ok(r.bottom <= mit.innerHeight + 0.5, `${k} ragt nicht unter die Tabbar-Unterkante (${Math.round(r.bottom)} <= ${mit.innerHeight})`);
  });

  if (quer) {
    ok(!!mit.sugbar, 'Vorschlagsleiste erscheint auch im Querformat');
  }

  /* ---- Fall 2: ohne Vorschlaege ---------------------------------------- */
  await p.evaluate(() => {
    clearSuggestions(); save(); renderAll(); setView('plan');
    document.querySelectorAll('.toasts .toast').forEach(t => t.remove());
    toast("Testmeldung ohne Vorschlaege");
  });
  await p.waitForTimeout(200);

  const ohne = await messen(p);
  await p.screenshot({ path: path.join(__dirname, `fuss-${tag}-ohne-vorschlaege.png`) });

  ok(ohne.sugbarFlag === '0', 'data-sugbar=0, wenn keine Vorschlaege mehr offen sind');
  ok(!ohne.sugbar, 'Vorschlagsleiste ist nicht mehr im Bild');
  ok(!!ohne.dayswitch, 'Tagesstreifen bleibt sichtbar, auch ohne Vorschlaege');
  if (ohne.dayswitch && ohne.tabbar) {
    const s = schnittflaeche(ohne.dayswitch, ohne.tabbar);
    ok(s === 0, `dayswitch und tabbar ueberlappen sich nicht (Schnittflaeche ${s}px²)`);
  }

  if (mit.fab && ohne.fab) {
    // bottom-css-Wert = Abstand von der Fensterunterkante zur Unterkante des Elements
    const cssBottomMit = mit.innerHeight - mit.fab.bottom;
    const cssBottomOhne = ohne.innerHeight - ohne.fab.bottom;
    ok(cssBottomOhne < cssBottomMit, `FAB rueckt nach unten, wenn die Leiste weg ist (bottom ${cssBottomMit}px -> ${cssBottomOhne}px)`);
  }
  if (mit.toast && ohne.toast) {
    const cssBottomMit = mit.innerHeight - mit.toast.bottom;
    const cssBottomOhne = ohne.innerHeight - ohne.toast.bottom;
    ok(cssBottomOhne < cssBottomMit, `Toast rueckt nach unten, wenn die Leiste weg ist (bottom ${cssBottomMit}px -> ${cssBottomOhne}px)`);
  }

  ['tabbar', 'dayswitch', 'fab', 'toast'].forEach(k => {
    const r = ohne[k];
    if (!r) return;
    ok(r.bottom <= ohne.innerHeight + 0.5, `${k} ragt nicht unter die Tabbar-Unterkante (${Math.round(r.bottom)} <= ${ohne.innerHeight})`);
  });

  /* ---- Screenshot fuer die Sichtpruefung: leerer Tag, Toast ------------ */
  await p.evaluate(() => {
    state.blocks = []; state.tasks = []; save(); renderAll();
    setView('heute');
    document.querySelectorAll('.toasts .toast').forEach(t => t.remove());
    toast("Eintrag gespeichert");
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(__dirname, `fuss-${tag}-leerer-tag.png`) });
}

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });

  const ctxHoch = await br.newContext({ ...devices['iPhone SE'] });
  const pHoch = await ctxHoch.newPage();
  await onboardingWeg(pHoch);
  await pruefeFall(pHoch, 'hoch', false);
  await ctxHoch.close();

  const ctxQuer = await br.newContext({ ...devices['iPhone SE landscape'] });
  const pQuer = await ctxQuer.newPage();
  await onboardingWeg(pQuer);
  await pruefeFall(pQuer, 'quer', true);
  await ctxQuer.close();

  await br.close();

  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  process.exit(fehler.length ? 1 : 0);
})();
