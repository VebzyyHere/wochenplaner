/* ============================================================
   Pruefskript Doppeltipp — der hastige Doppeltipp auf einen
   Verteil-Einstieg, waehrend "Das wird eng" aufspringt.

   Der Fund (Playwright, iPhone SE, 5/5 deterministisch): das Gate-Blatt
   oeffnet sich synchron unter dem Finger, sein Fuss liegt fast genau
   dort, wo eben noch der Ausloeser sass ("Woche anlegen" im Assistenten).
   Der zweite Tipp eines Doppeltipps traf deshalb sofort "Ziele anpassen"
   — oder den Scrim, der schon auf pointerdown schliesst — und niemand
   hat "Das wird eng" je gelesen. Seit der Schonfrist in
   verteilenMitGate() (300 ms pointer-events aus) muss beides folgenlos
   bleiben.

   Die Doppeltipps hier laufen ueber p.mouse (ROHE Klicks ohne
   Playwrights Trefferpruefung) — ein p.click() wuerde die Schonfrist
   brav abwarten und den Fehler verstecken. Umgekehrt zeigt a1+, dass
   Klicks MIT Trefferpruefung von selbst warten: dieselbe Mechanik, die
   ob.js und kapazitaet.js ohne Anpassung gruen haelt.

   Feste Uhr, zoniert (Vertrag): Samstag 2026-08-08 20:00 Europe/Berlin —
   dieselbe Fixture wie kapazitaet.js g1, das Gate erscheint im Erststart.
   Gegenprobe Montag 2026-08-03 08:00 (ob.js-Fixture): kein Gate, der
   Doppeltipp bleibt wie bisher folgenlos. Beide Annahmen sichern sich
   unten selbst ab. Die Schonfrist selbst laeuft ueber echtes setTimeout
   und bewusst ohne Date.now() — setFixedTime() friert nur die Uhr ein,
   echte Timer laufen weiter (Muster kapazitaet.js, Toasts).
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

async function neueSeite(br, uhr) {
  // Frischer Kontext je Lauf = leerer localStorage = echter Erststart.
  const ctx = await br.newContext({ ...devices['iPhone SE'], timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.clock.setFixedTime(new Date(uhr));
  await p.goto(F);
  await p.waitForTimeout(500);
  return { ctx, p, errs };
}

// Assistent bis VOR den letzten Klick: drei Klicks mit Trefferpruefung
// (Muster kapazitaet.js assistentDurchklicken()), dann steht "Woche
// anlegen" — dessen Mitte ist der Tipp-Punkt des Funds.
async function bisWocheAnlegen(p, prefix) {
  for (let i = 0; i < 3; i++) {
    await p.click('.sheet__foot .btn--primary');
    await p.waitForTimeout(200);
  }
  const knopf = p.locator('.sheet__foot .btn--primary');
  const txt = await knopf.textContent();
  ok(txt === 'Woche anlegen', prefix + ') Assistent steht am letzten Schritt (Knopf: ' + JSON.stringify(txt) + ')');
  const box = await knopf.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Zwei rohe Klicks, ~5 ms Abstand — der Doppeltipp aus dem Fund.
async function doppeltipp(p, a, b) {
  await p.mouse.click(a.x, a.y);
  await p.waitForTimeout(5);
  await p.mouse.click(b.x, b.y);
  await p.waitForTimeout(120);
}

// Was gerade offen ist und ob die angelegten Daten unversehrt sind.
const blatt = p => p.evaluate(() => {
  const t = document.querySelector('.sheet .sheet__title');
  return {
    titel: t ? t.textContent : null,
    fest: state.blocks.filter(b => !b.sug).length,
    sugs: state.blocks.filter(b => b.sug).length,
    idsEindeutig: new Set(state.blocks.map(b => b.id)).size === state.blocks.length
  };
});

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });

  // --- a) Samstagabend, fuenf Wiederholungen (der Fund war 5/5
  //     deterministisch): Doppeltipp auf "Woche anlegen". Das Gate muss
  //     stehen bleiben; vorher traf Tipp 2 "Ziele anpassen" im frisch
  //     geoeffneten Fuss und der Editor sprang ungewollt auf. -----------
  for (let lauf = 1; lauf <= 5; lauf++) {
    const { ctx, p, errs } = await neueSeite(br, '2026-08-08T20:00:00+02:00');
    const punkt = await bisWocheAnlegen(p, 'a' + lauf);
    await doppeltipp(p, punkt, punkt);
    const d = await blatt(p);
    ok(d.titel === 'Das wird eng', 'a' + lauf + ') Gate steht nach dem Doppeltipp (Titel: ' + JSON.stringify(d.titel) + ')');
    ok(d.fest === 5 && d.sugs === 0 && d.idsEindeutig,
      'a' + lauf + ') Daten unversehrt: 5 feste Bloecke, keine Vorschlaege, ids eindeutig (ist: ' + d.fest + '/' + d.sugs + ')');
    if (lauf === 1) {
      await p.screenshot({ path: 'doppeltipp-gate.png' });
      // Nach der Schonfrist bedient sich das Blatt normal: der Klick mit
      // Trefferpruefung wartet sie ab und oeffnet dann den Ziele-Editor.
      await p.click('.sheet__foot .btn--primary');
      await p.waitForTimeout(150);
      const e = await blatt(p);
      ok(e.titel === 'Wochenziele', 'a1+) nach der Schonfrist oeffnet "Ziele anpassen" den Editor (Titel: ' + JSON.stringify(e.titel) + ')');
    }
    ok(!errs.length, 'a' + lauf + ') keine Konsolenfehler' + (errs.length ? ' — ' + errs.join(' | ') : ''));
    await ctx.close();
  }

  // --- b) Streutipp auf den Scrim: die unberichtete Schwester des Funds.
  //     Der Scrim schliesst auf pointerdown — ohne Schonfrist wischte ein
  //     Tipp 2 weiter oben das Gate still weg, bevor es je sichtbar war.
  //     Nach der Schonfrist schliesst der Scrim-Tipp wie gehabt. --------
  {
    const { ctx, p, errs } = await neueSeite(br, '2026-08-08T20:00:00+02:00');
    const punkt = await bisWocheAnlegen(p, 'b');
    await doppeltipp(p, punkt, { x: 160, y: 60 });
    const d = await blatt(p);
    ok(d.titel === 'Das wird eng', 'b) Streutipp auf den Scrim wischt das Gate nicht weg (Titel: ' + JSON.stringify(d.titel) + ')');
    await p.waitForTimeout(300);
    await p.mouse.click(160, 60);
    await p.waitForTimeout(150);
    const e = await blatt(p);
    ok(e.titel === null, 'b+) nach der Schonfrist schliesst der Scrim-Tipp das Gate wie immer (Titel: ' + JSON.stringify(e.titel) + ')');
    ok(!errs.length, 'b) keine Konsolenfehler' + (errs.length ? ' — ' + errs.join(' | ') : ''));
    await ctx.close();
  }

  // --- c) Gegenprobe Montagmorgen: kein Gate, verteilt wird sofort, der
  //     zweite Tipp faellt wie bisher folgenlos auf die App (Tabbar).
  //     Sichert zugleich die Uhr-Fixture ab: kippt wochenKapazitaet()
  //     hier auf false, prueft a) womoeglich das Falsche. ---------------
  {
    const { ctx, p, errs } = await neueSeite(br, '2026-08-03T08:00:00+02:00');
    const punkt = await bisWocheAnlegen(p, 'c');
    await doppeltipp(p, punkt, punkt);
    const d = await blatt(p);
    ok(d.titel === null, 'c) Montagmorgen: kein Blatt offen nach dem Doppeltipp (Titel: ' + JSON.stringify(d.titel) + ')');
    ok(d.fest === 5 && d.idsEindeutig, 'c) Daten unversehrt (5 feste Bloecke, ids eindeutig; ist: ' + d.fest + ')');
    const kapaOk = await p.evaluate(() => wochenKapazitaet().ok);
    ok(kapaOk === true, 'c) Fixture-Zusicherung: wochenKapazitaet().ok === true am Montagmorgen');
    ok(!errs.length, 'c) keine Konsolenfehler' + (errs.length ? ' — ' + errs.join(' | ') : ''));
    await ctx.close();
  }

  await br.close();
  console.log(fehler.length ? '\nROT: ' + fehler.length + ' Zusicherung(en) verletzt' : '\nGRUEN: der Doppeltipp-Vertrag haelt');
  if (fehler.length) process.exit(1);
})();
