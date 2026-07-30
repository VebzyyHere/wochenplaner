const { chromium } = require('playwright');

const U = 'http://localhost:8899/';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const errors = [];

  // Zwei getrennte Kontexte = zwei Geräte (eigener Speicher je Kontext)
  const handy = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pc    = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const h = await handy.newPage(), p = await pc.newPage();
  [h, p].forEach((pg, i) => {
    pg.on('pageerror', e => errors.push((i ? 'PC' : 'HANDY') + ' PAGEERROR: ' + e.message));
    pg.on('console', m => { if (m.type() === 'error') errors.push((i ? 'PC' : 'HANDY') + ' CONSOLE: ' + m.text()); });
  });

  // Der Erststart ist ein Assistent — fuer diesen Test wegklicken
  const dismiss = async pg => {
    await pg.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
    await pg.waitForTimeout(200);
  };

  // ---------- Handy: Plan anlegen, dann Konto ----------
  await h.goto(U); await h.waitForTimeout(500); await dismiss(h);
  await h.evaluate(() => {
    const mon = mondayOf(anchor);
    state.blocks.push({ id: "fix1", title: "Arbeit", areaId: "a1", day: 0,
      date: iso(addDays(mon, 0)), repeat: "weekly", start: 360, end: 810, frog: false });
    state.tasks.push({ id: "t1", title: "Hausarbeit", areaId: "a2", done: false, frog: false });
    state.areas.find(a => a.id === "a2").plan.goal = 8;
    save(); renderAll();
  });
  await h.waitForTimeout(300);

  const badgeVorher = await h.evaluate(() => document.getElementById('syncBadge').textContent);

  await h.click('#syncBadge');
  await h.waitForTimeout(400);
  await h.click('#inSwap');                       // auf "Konto anlegen"
  await h.waitForTimeout(200);
  await h.fill('#inEmail', 'sunny@test.de');
  await h.fill('#inPass', 'geheim123');
  await h.screenshot({ path: 's1-anmelden-handy.png', fullPage: false });
  await h.click('.sheet__foot button:has-text("Konto anlegen")');
  await h.waitForTimeout(1200);

  const nachLogin = await h.evaluate(() => ({
    aktiv: Sync.active(), status: Sync.status, email: Sync.email,
    blocks: state.blocks.length, tasks: state.tasks.length,
    ziel: state.areas.find(a => a.id === "a2").plan.goal,
    speicherplatz: Store.scope
  }));
  console.log('1) Handy angemeldet, lokaler Plan übernommen:', nachLogin);
  await h.screenshot({ path: 's2-handy-angemeldet.png', fullPage: true });

  // ---------- PC: dasselbe Konto, Plan muss ankommen ----------
  await p.goto(U); await p.waitForTimeout(500); await dismiss(p);
  await p.click('#syncBadge');
  await p.waitForTimeout(300);
  await p.fill('#inEmail', 'sunny@test.de');
  await p.fill('#inPass', 'geheim123');
  await p.click('.sheet__foot button:has-text("Anmelden")');
  await p.waitForTimeout(1500);

  const amPc = await p.evaluate(() => ({
    aktiv: Sync.active(),
    blocks: state.blocks.map(b => b.title),
    tasks: state.tasks.map(t => t.title),
    ziel: state.areas.find(a => a.id === "a2").plan.goal
  }));
  console.log('2) PC sieht den Plan vom Handy:', amPc);
  await p.screenshot({ path: 's3-pc-uebernommen.png' });

  // ---------- PC ändert, Handy holt ab ----------
  await p.evaluate(() => {
    const mon = mondayOf(anchor);
    state.blocks.push({ id: "vom-pc", title: "Vorlesung", areaId: "a2", day: 2,
      date: iso(addDays(mon, 2)), repeat: "none", start: 600, end: 720, frog: false });
    save(); renderAll();
  });
  await p.waitForTimeout(2200);   // debounce abwarten

  await h.evaluate(() => Sync.pull());
  await h.waitForTimeout(1200);
  const handyNachPull = await h.evaluate(() => state.blocks.map(b => b.title).sort());
  console.log('3) Handy holt die PC-Änderung:', handyNachPull);

  // ---------- Handy löscht, PC darf ihn nicht zurückbringen ----------
  await h.evaluate(() => {
    state.blocks = state.blocks.filter(b => b.id !== "vom-pc");
    save();
  });
  await h.waitForTimeout(2200);
  await p.evaluate(() => Sync.pull());
  await p.waitForTimeout(1200);
  const pcNachLoeschen = await p.evaluate(() => ({
    titel: state.blocks.map(b => b.title).sort(),
    grabstein: !!state.tombs["vom-pc"]
  }));
  console.log('4) Gelöschtes bleibt gelöscht:', pcNachLoeschen);

  // ---------- Gleichzeitige Änderung: neuere gewinnt ----------
  await p.evaluate(() => {
    state.blocks.find(b => b.id === "fix1").title = "Arbeit (PC)";
    save();
  });
  await p.waitForTimeout(2200);
  await h.evaluate(() => {
    state.blocks.find(b => b.id === "fix1").title = "Arbeit (Handy, später)";
    save();
  });
  await h.waitForTimeout(2200);
  await p.evaluate(() => Sync.pull());
  await p.waitForTimeout(1200);
  const konflikt = await p.evaluate(() => state.blocks.find(b => b.id === "fix1").title);
  console.log('5) Bei Konflikt gewinnt die spätere Änderung:', konflikt);

  // ---------- Abmelden: lokaler Plan kommt zurück ----------
  await p.evaluate(() => Sync.signOut());
  await p.waitForTimeout(800);
  const nachAbmelden = await p.evaluate(() => ({
    aktiv: Sync.active(), speicherplatz: Store.scope, blocks: state.blocks.length
  }));
  console.log('6) Nach dem Abmelden:', nachAbmelden);

  // ---------- Wieder anmelden: Serverstand ist da ----------
  await p.click('#syncBadge');
  await p.waitForTimeout(300);
  await p.fill('#inEmail', 'sunny@test.de');
  await p.fill('#inPass', 'geheim123');
  await p.click('.sheet__foot button:has-text("Anmelden")');
  await p.waitForTimeout(1500);
  const wieder = await p.evaluate(() => ({
    aktiv: Sync.active(), titel: state.blocks.map(b => b.title).sort()
  }));
  console.log('7) Wieder angemeldet:', wieder);

  // ---------- Falsches Passwort ----------
  await p.evaluate(() => Sync.signOut());
  await p.waitForTimeout(600);
  await p.click('#syncBadge');
  await p.waitForTimeout(300);
  await p.fill('#inEmail', 'sunny@test.de');
  await p.fill('#inPass', 'falschesding');
  await p.click('.sheet__foot button:has-text("Anmelden")');
  await p.waitForTimeout(900);
  const fehler = await p.evaluate(() => {
    const m = document.getElementById('inMsg');
    return m ? m.textContent : '(kein Dialog)';
  });
  console.log('8) Falsches Passwort:', fehler);
  await p.screenshot({ path: 's4-falsches-passwort.png' });

  // ---------- Zweiter Nutzer bekommt nichts vom ersten ----------
  await p.click('.sheet__foot button:has-text("Abbrechen")');
  await p.waitForTimeout(200);
  await p.click('#syncBadge'); await p.waitForTimeout(300);
  await p.click('#inSwap'); await p.waitForTimeout(200);
  await p.fill('#inEmail', 'freundin@test.de');
  await p.fill('#inPass', 'anderes123');
  await p.click('.sheet__foot button:has-text("Konto anlegen")');
  await p.waitForTimeout(1500);
  const zweiter = await p.evaluate(() => ({
    email: Sync.email,
    fremdeBloecke: state.blocks.filter(b => b.title.indexOf("Handy") >= 0 || b.title.indexOf("PC") >= 0).length,
    speicherplatz: Store.scope
  }));
  console.log('9) Zweiter Nutzer getrennt:', zweiter);

  // ---------- Offline: Änderung geht nicht verloren ----------
  await pc.setOffline(true);
  await p.evaluate(() => {
    const mon = mondayOf(anchor);
    state.blocks.push({ id: "offline1", title: "Ohne Netz", areaId: "a1", day: 3,
      date: iso(addDays(mon, 3)), repeat: "none", start: 900, end: 960, frog: false });
    save();
  });
  await p.waitForTimeout(2200);
  const imOffline = await p.evaluate(() => ({ status: Sync.status, drin: state.blocks.some(b => b.id === "offline1") }));
  await pc.setOffline(false);
  await p.evaluate(() => Sync.retryPending());
  await p.waitForTimeout(1500);
  const nachOffline = await p.evaluate(() => Sync.status);
  console.log('10) Offline und zurück:', { imOffline, danach: nachOffline });

  console.log('\n=== Fehler ==='); console.log(errors.length ? errors : 'keine');
  await browser.close();
  process.exit(0);
})();
