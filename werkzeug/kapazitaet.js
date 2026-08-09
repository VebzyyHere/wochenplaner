/* ============================================================
   Pruefskript Kapazitaet (Stufe A) — wochenKapazitaet() rechnet in der
   LAUFENDEN Woche seit Stufe A nur noch ab jetzt, nicht mehr die ganze
   Woche. Reproduktion des Auftrags: Erststart Samstagabend, 16h offene
   Wochenziele -> alte Rechnung zeigt "57% verplant, gruen", obwohl nur
   noch der Sonntag zur Verfuegung steht.

   a) Samstagabend (20 Uhr): Arbeit Mo-Fr 09-17 liegt komplett hinter
      einem, ein Wochenziel steht mit 16h offen -> wach nur noch im
      Bereich des Sonntags-Restfensters (nicht die ganze Woche), fest
      praktisch 0, wochenKapazitaet().ok === false.
   b) Montagmorgen (8 Uhr), dieselben Daten: die Arbeitswoche liegt noch
      komplett vor einem -> wach/fest nahe der Vollwoche, ok bleibt wie
      unter der alten Rechnung (kein kuenstlicher Rotausschlag am
      Wochenanfang).
   c) Zukunftswoche (anchor eine Woche voraus): Rechnung entspricht exakt
      der alten, ungeklemmten Vollwoche — unabhaengig davon, welche Uhr
      gerade gilt (Samstagabend- und Montagmorgen-Uhr liefern hier
      dasselbe Ergebnis).
   d) Gate im Heute-Leerzustand: im Samstag-Szenario oeffnet der
      "Vorschlagen"-Knopf der leeren Heute-Karte (#agendaVorschlag) "Das
      wird eng" statt still zu verteilen; "Naechste Woche planen"
      schliesst den Dialog, blaettert die Woche weiter und erzeugt dort
      Vorschlaege.
   e) Anzeige: "Rest der Woche" statt "Woche" in der laufenden Woche,
      weiterhin "Woche" in einer Zukunftswoche; im wach===0-Randfall
      (Sonntagnacht, alles vorbei) keine NaN-/Infinity-Anzeige und die
      Prozentanzeige bleibt bei "ueber 200 %" gedeckelt.
   f) Ritual Schritt 3 (A5) mit fester Uhr: Samstagabend zeigt in
      schrittVerteilen() die Zusatzzeile "Der Rest passt nicht mehr in
      diese Woche" plus einen Knopf "Naechste Woche planen", der das
      Blatt schliesst, die Woche weiterblaettert (KW-Label/anchor) und
      dort Vorschlaege erzeugt; Montagmorgen (dieselben Daten, Woche
      passt) zeigt weder Zeile noch Knopf.
   g) Mini-Stufe D: der Erststart-Assistent (maybeWelcome()/anlegen())
      laeuft seit Stufe D ebenfalls durch verteilenMitGate() — dritter
      Verteil-Einstieg neben Ziele und Heute-Leerzustand (d). Frischer
      Zustand, echte Klicks durch alle vier Schritte mit den
      Assistenten-Standardwerten (Arbeit Mo-Fr 09-17, Wochenziele
      START_ZIELE = 16h), Samstagabend: "Woche anlegen" oeffnet "Das wird
      eng" statt still zu verteilen; die eingegebenen Daten (Ziele,
      Arbeit-Bloecke) stehen trotzdem schon, nur noch keine sug-Bloecke;
      "Naechste Woche planen" blaettert weiter und verteilt dort.
      Gegenprobe Montagmorgen: kein Gate, sug-Bloecke entstehen sofort —
      unveraendert gegenueber vor Stufe D.

   Mindestens eine Zusicherung ist bewusst so gebaut, dass sie unter der
   ALTEN Vollwochen-Rechnung nachweislich fehlschlaegt (siehe a): dort
   waere wach 7*(22-7)*60 = 6300 Minuten gewesen, weit ueber der hier
   geprueften Grenze von 40*60.

   Stil wie restdestag.js/serie.js: eine Chromium-Seite, deutsche
   Ausgabe, Exit 1 bei Fehlern. Uhrzeit, Datum UND Zeitzone werden ueber
   page.clock.setFixedTime() (zoniertes Literal) und timezoneId
   festgenagelt, NICHT ueber die echte Systemuhr — sonst haengt jedes
   Ergebnis hier davon ab, wann das Skript zufaellig laeuft.

   Rot-Beweis fuer g): `git stash push -- index.html` gegen HEAD (vor
   Stufe D), Skript erneut laufen lassen — g1) faellt, weil anlegen() dort
   buildSuggestions() noch direkt aufruft, ohne verteilenMitGate() zu
   fragen: "Das wird eng" erscheint nie. a)-f) bleiben gruen, die pruefen
   ausschliesslich wochenKapazitaet()/verteilenMitGate() selbst (Stufe A,
   von Stufe D unangetastet). `git stash pop` stellt den Stand danach
   wieder her.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK    ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ viewport: { width: 1400, height: 950 }, timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  // Feste Uhr fuer den ersten Teil: Samstag, 20 Uhr — das Erststart-Szenario
  // aus dem Auftrag.
  await p.clock.setFixedTime(new Date('2026-08-08T20:00:00+02:00'));
  await p.goto(F);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await p.waitForTimeout(250);

  // Gemeinsames Grundszenario fuer a), b), d), e): Arbeit Mo-Fr 09-17 als
  // Serie (a1), ein Wochenziel von 16h (a2, "Uni & Lernen"), noch nichts
  // davon geplant. Baut relativ zur jeweils GUELTIGEN Uhr, darum vor jedem
  // Szenario neu aufgerufen, nie einmalig wiederverwendet.
  async function basisSetup() {
    return p.evaluate(() => {
      if (typeof closeModal === 'function') closeModal();
      state = freshState(); migrate(state);
      state.settings.dayStart = 7; state.settings.dayEnd = 22;
      state.settings.sleep = { on: false };
      anchor = new Date();
      selectedDayIdx = (new Date().getDay() + 6) % 7;
      const mon = mondayOf(anchor);

      state.blocks = [];
      for (let d = 0; d < 5; d++) {
        state.blocks.push({ id: uid(), title: 'Arbeit', areaId: 'a1', day: d, date: iso(addDays(mon, d)),
          repeat: 'weekly', start: 9 * 60, end: 17 * 60, frog: false });
      }
      state.areas.find(x => x.id === 'a2').plan.goal = 16;
      state.tasks = [];
      save(); setView('heute'); renderAll();
      return { heuteKey: iso(new Date()), montag: iso(mon) };
    });
  }

  // ==============================================================
  // a) Samstagabend, 20 Uhr — die Arbeitswoche ist komplett vorbei.
  // ==============================================================
  console.log('=== a) Samstagabend, 20 Uhr ===');
  await basisSetup();
  const resA = await p.evaluate(() => wochenKapazitaet());
  console.log('wochenKapazitaet():', JSON.stringify(resA));
  ok(resA.wach === 1020,
    'a) wach = Rest von Samstag (120 min) + ganzer Sonntag (900 min) = 1020 Minuten (' + resA.wach + ')');
  ok(resA.wach < 40 * 60,
    'a) wach liegt weit unter einer Vollwoche — unter der ALTEN Rechnung waeren es 7*(22-7)*60 = 6300 ' +
    'Minuten gewesen, diese Zusicherung waere dort nachweislich fehlgeschlagen (' + resA.wach + ' min)');
  ok(resA.fest === 0, 'a) fest = 0 — die Arbeitswoche Mo-Fr liegt komplett in der Vergangenheit (' + resA.fest + ')');
  ok(resA.ok === false,
    'a) wochenKapazitaet().ok ist false — die Woche passt nicht mehr (Quote ' + Math.round(resA.quote * 100) + ' %)');

  // ==============================================================
  // b) Montagmorgen, 8 Uhr — dieselben Daten, aber die Woche liegt noch
  //    komplett vor einem.
  // ==============================================================
  console.log('\n=== b) Montagmorgen, 8 Uhr ===');
  await p.clock.setFixedTime(new Date('2026-08-03T08:00:00+02:00'));
  await basisSetup();
  const resB = await p.evaluate(() => wochenKapazitaet());
  console.log('wochenKapazitaet():', JSON.stringify(resB));
  ok(resB.fest === 2400, 'b) fest = 2400 (5 x 8h) — die Arbeitswoche hat noch gar nicht begonnen (' + resB.fest + ')');
  ok(resB.wach === 6240,
    'b) wach = 6240 — Vollwoche (6300) minus die schon verstrichene Stunde 7-8 Uhr am Montag (' + resB.wach + ')');
  ok(Math.abs(resB.wach - 6300) <= 60, 'b) wach liegt nahe der Vollwoche (Differenz ' + Math.abs(resB.wach - 6300) + ' min)');
  ok(resB.ok === true,
    'b) wochenKapazitaet().ok ist true — kein kuenstlicher Rotausschlag am Wochenanfang (Quote ' +
    Math.round(resB.quote * 100) + ' %, wie unter der alten Rechnung)');

  // ==============================================================
  // c) Zukunftswoche: anchor eine Woche voraus — Rechnung entspricht der
  //    alten, ungeklemmten Vollwoche, unabhaengig von der Uhrzeit.
  // ==============================================================
  console.log('\n=== c) Zukunftswoche, unabhaengig von der Uhr ===');
  async function zukunftKapazitaet() {
    return p.evaluate(() => {
      anchor = addDays(mondayOf(anchor), 7);
      renderAll();
      return wochenKapazitaet();
    });
  }
  await basisSetup();                 // Uhr steht noch auf Montag, 8 Uhr (aus b)
  const resC_montag = await zukunftKapazitaet();

  await p.clock.setFixedTime(new Date('2026-08-08T20:00:00+02:00'));
  await basisSetup();                 // frisches Setup, jetzt mit Samstagabend-Uhr
  const resC_samstag = await zukunftKapazitaet();

  console.log('Zukunftswoche unter Montag-Uhr:', JSON.stringify(resC_montag));
  console.log('Zukunftswoche unter Samstag-Uhr:', JSON.stringify(resC_samstag));
  ok(resC_montag.wach === 6300 && resC_montag.fest === 2400,
    'c) Zukunftswoche = volle, ungeklemmte Woche (wach 6300, fest 2400) unter Montag-Uhr (' + JSON.stringify(resC_montag) + ')');
  ok(resC_samstag.wach === 6300 && resC_samstag.fest === 2400,
    'c) Zukunftswoche = volle, ungeklemmte Woche (wach 6300, fest 2400) unter Samstag-Uhr (' + JSON.stringify(resC_samstag) + ')');
  ok(resC_montag.wach === resC_samstag.wach && resC_montag.fest === resC_samstag.fest,
    'c) dasselbe Ergebnis unabhaengig davon, welche Uhrzeit gerade gilt');

  // ==============================================================
  // d) Gate im Heute-Leerzustand (Samstag-Szenario).
  // ==============================================================
  console.log('\n=== d) Gate im Heute-Leerzustand ===');
  await p.clock.setFixedTime(new Date('2026-08-08T20:00:00+02:00'));
  const d0 = await basisSetup();

  const d1 = await p.evaluate(() => ({
    knopf: !!document.getElementById('agendaVorschlag'),
    kapaOk: wochenKapazitaet().ok
  }));
  ok(d1.knopf, 'd) Voraussetzung: die leere Heute-Karte (Samstag) zeigt "Vorschlagen"');
  ok(d1.kapaOk === false, 'd) Voraussetzung: wochenKapazitaet().ok ist in diesem Szenario false');

  await p.click('#agendaVorschlag');
  await p.waitForTimeout(300);
  const d2 = await p.evaluate(() => {
    const t = document.querySelector('.sheet .sheet__title');
    return { titel: t ? t.textContent : null, neueVorschlaege: state.blocks.filter(b => b.sug).length };
  });
  console.log('Nach Klick auf "Vorschlagen":', JSON.stringify(d2));
  ok(d2.titel === 'Das wird eng', 'd) der Klick oeffnet "Das wird eng" statt still zu verteilen (Titel: ' + JSON.stringify(d2.titel) + ')');
  ok(d2.neueVorschlaege === 0, 'd) solange der Dialog offen ist, sind noch KEINE Vorschlaege entstanden (' + d2.neueVorschlaege + ')');

  const naechsteBtn = p.locator('.sheet button:has-text("Nächste Woche planen")');
  const naechsteDa = await naechsteBtn.count() > 0;
  ok(naechsteDa, 'd) der Dialog bietet in der laufenden Woche "Naechste Woche planen" an');

  // .count() statt direkt .click(): bleibt der Knopf aus (Regression), soll
  // das hier als FEHLER-Zeile stehen bleiben, nicht 30s auf ihn warten und
  // das ganze Skript per Timeout abreissen — d3 faellt dann konsequent auf
  // "nicht erreicht" zurueck, statt den Rest des Laufs (Abschnitt e) mitzureissen.
  if (naechsteDa) await naechsteBtn.click();
  await p.waitForTimeout(300);
  const d3 = naechsteDa ? await p.evaluate((vorherMontag) => ({
    modalOffen: !!document.querySelector('.scrim'),
    montagNeu: iso(mondayOf(anchor)),
    vorschlaegeVorhanden: state.blocks.some(b => b.sug),
    toast: (document.querySelector('#toasts .toast span') || {}).textContent || null
  }), d0.montag) : { modalOffen: true, montagNeu: d0.montag, vorschlaegeVorhanden: false, toast: null };
  console.log('Nach "Naechste Woche planen":', JSON.stringify(d3));
  ok(!d3.modalOffen, 'd) der Dialog ist zu, nachdem "Naechste Woche planen" geklickt wurde');
  ok(d3.montagNeu !== d0.montag, 'd) die angezeigte Woche ist weitergeblaettert (' + d0.montag + ' -> ' + d3.montagNeu + ')');
  ok(d3.vorschlaegeVorhanden, 'd) in der neuen Woche sind Vorschlaege entstanden');
  ok(d3.toast === 'Vorschlag für die nächste Woche steht',
    'd) derselbe Toast wie beim normalen "Naechste Woche"-Weg meldet das Ergebnis (' + JSON.stringify(d3.toast) + ')');

  // ==============================================================
  // e) Anzeige: "Rest der Woche" + kein NaN/Infinity im Randfall.
  // ==============================================================
  console.log('\n=== e) Anzeige ===');
  await p.clock.setFixedTime(new Date('2026-08-08T20:00:00+02:00'));
  await basisSetup();
  const e1 = await p.evaluate(() => {
    const el = document.createElement('div');
    ampelZeichnen(el);
    return el.textContent;
  });
  console.log('Ampeltext (laufende Woche):', JSON.stringify(e1));
  ok(/^Rest der Woche zu \d+ % verplant/.test(e1),
    'e) in der laufenden Woche beginnt der Ampeltext mit "Rest der Woche zu X % verplant" (' + JSON.stringify(e1) + ')');

  const e2 = await p.evaluate(() => {
    const mon = mondayOf(anchor);
    anchor = addDays(mon, 7);
    const el = document.createElement('div');
    ampelZeichnen(el);
    const text = el.textContent;
    anchor = mon;
    return text;
  });
  console.log('Ampeltext (Zukunftswoche):', JSON.stringify(e2));
  ok(/^Woche zu \d+ % verplant/.test(e2),
    'e) in einer Zukunftswoche bleibt es unveraendert bei "Woche zu X % verplant" (' + JSON.stringify(e2) + ')');

  // Randfall wach===0: Sonntag 23 Uhr, dayEnd 22 Uhr — die Woche ist komplett
  // vorbei, das Wochenziel aber noch offen (bedarf > 0).
  await p.clock.setFixedTime(new Date('2026-08-09T23:00:00+02:00'));
  await basisSetup();
  const e3 = await p.evaluate(() => {
    const k = wochenKapazitaet();
    const el = document.createElement('div');
    ampelZeichnen(el);
    return { k, html: el.innerHTML, text: el.textContent };
  });
  console.log('Randfall wach=0:', JSON.stringify({ wach: e3.k.wach, grenze: e3.k.grenze, ok: e3.k.ok, quote: e3.k.quote }));
  ok(e3.k.wach === 0, 'e) wach ist exakt 0 — Sonntag 23 Uhr liegt nach dayEnd (22 Uhr), kein Tag der Woche mehr uebrig (' + e3.k.wach + ')');
  ok(e3.k.grenze === 0, 'e) grenze = wach * 0,65 = 0 (' + e3.k.grenze + ')');
  ok(Number.isFinite(e3.k.quote), 'e) quote bleibt eine endliche Zahl, kein Infinity (' + e3.k.quote + ')');
  ok(e3.k.quote > 0.70, 'e) quote liegt sicher ueber der Rot-Schwelle (' + e3.k.quote + ')');
  ok(e3.k.ok === false, 'e) ok ist false — in dieser Woche geht nichts mehr (bedarf > 0, grenze 0)');
  ok(!/NaN/.test(e3.html) && !/Infinity/.test(e3.html), 'e) die Ampel zeigt weder NaN noch Infinity (' + JSON.stringify(e3.html) + ')');
  ok(e3.text.includes('über 200 %'),
    'e) die Prozentanzeige ist bei "ueber 200 %" gedeckelt statt eine absurde Zahl zu zeigen (' + JSON.stringify(e3.text) + ')');

  // ==============================================================
  // f) A5: der Ritual-Pfad (Schritt 3) mit fester Uhr — vom Erbauer selbst
  //    als ungeprueft gemeldete Luecke. Zwei Szenarien mit denselben Daten
  //    wie a)/b): Samstagabend (Woche passt nicht mehr -> Zusatzzeile und
  //    Ausweg) und Montagmorgen (Woche passt -> weder Zeile noch Knopf).
  // ==============================================================
  console.log('\n=== f) Ritual Schritt 3 (A5) mit fester Uhr ===');

  // Von Schritt 1 ("Was ist gelaufen?") zu Schritt 3 ("Und wann?" =
  // schrittVerteilen): "Weiter" ist im Fuss immer der einzige btn--primary,
  // zweimal klicken reicht (schritt 0 -> 1 -> 2), unabhaengig vom Inhalt der
  // Schritte dazwischen.
  async function ritualBisSchritt3() {
    await p.evaluate(() => ritualSheet());
    await p.waitForTimeout(150);
    const weiter = p.locator('.sheet .sheet__foot button:has-text("Weiter")');
    await weiter.click();
    await p.waitForTimeout(120);
    await weiter.click();
    await p.waitForTimeout(150);
  }

  // --- f1) Samstagabend: dieselbe Woche wie in a), passt nicht mehr ----
  await p.clock.setFixedTime(new Date('2026-08-08T20:00:00+02:00'));
  const f0 = await basisSetup();
  await ritualBisSchritt3();

  const f1 = await p.evaluate(() => {
    const t = document.querySelector('.sheet .sheet__title');
    const warnzeile = [...document.querySelectorAll('.sheet .goalrow__sub')]
      .some(el => el.textContent.includes('Der Rest passt nicht mehr in diese Woche'));
    return {
      titel: t ? t.textContent : null,
      warnzeile,
      weekLabel: document.getElementById('weekLabel').textContent
    };
  });
  console.log('Ritual Schritt 3 (Samstag):', JSON.stringify(f1));
  ok(f1.titel === 'Und wann?', 'f) Schritt 3 ist erreicht (Titel "Und wann?"), war ' + JSON.stringify(f1.titel));
  ok(f1.warnzeile, 'f) die Zusatzzeile "Der Rest passt nicht mehr in diese Woche." erscheint in Schritt 3 (Samstag)');

  const ritualNaechsteBtn = p.locator('.sheet button:has-text("Nächste Woche planen")');
  const ritualNaechsteDa = await ritualNaechsteBtn.count() > 0;
  ok(ritualNaechsteDa, 'f) der Knopf "Naechste Woche planen" existiert in Schritt 3 (Samstag)');

  // .count() statt direkt .click(): bleibt der Knopf aus (Regression), soll
  // das als FEHLER-Zeile stehen bleiben statt das Skript per Timeout
  // abzureissen — derselbe Kniff wie in Abschnitt d) oben.
  if (ritualNaechsteDa) await ritualNaechsteBtn.click();
  await p.waitForTimeout(300);
  const f2 = ritualNaechsteDa ? await p.evaluate((vorherMontag) => ({
    modalOffen: !!document.querySelector('.scrim'),
    weekLabel: document.getElementById('weekLabel').textContent,
    montagNeu: iso(mondayOf(anchor)),
    vorschlaegeVorhanden: state.blocks.some(b => b.sug),
    toast: (document.querySelector('#toasts .toast span') || {}).textContent || null
  }), f0.montag) : { modalOffen: true, weekLabel: f1.weekLabel, montagNeu: f0.montag, vorschlaegeVorhanden: false, toast: null };
  console.log('Nach "Naechste Woche planen" aus dem Ritual:', JSON.stringify(f2));
  ok(!f2.modalOffen, 'f) das Blatt ist zu, nachdem "Naechste Woche planen" im Ritual geklickt wurde');
  ok(f2.montagNeu !== f0.montag, 'f) die angezeigte Woche hat gewechselt (' + f0.montag + ' -> ' + f2.montagNeu + ')');
  ok(f2.weekLabel !== f1.weekLabel, 'f) das KW-Label im Kopf hat sich geaendert (' + JSON.stringify(f1.weekLabel) + ' -> ' + JSON.stringify(f2.weekLabel) + ')');
  ok(f2.vorschlaegeVorhanden, 'f) in der neuen Woche sind Vorschlaege entstanden');
  ok(f2.toast === 'Vorschlag für die nächste Woche steht',
    'f) derselbe Toast wie beim normalen "Naechste Woche"-Weg meldet das Ergebnis (' + JSON.stringify(f2.toast) + ')');

  // --- f2) Montagmorgen: dieselben Daten wie b), die Woche passt noch --
  await p.clock.setFixedTime(new Date('2026-08-03T08:00:00+02:00'));
  await basisSetup();
  await ritualBisSchritt3();

  const f3 = await p.evaluate(() => {
    const t = document.querySelector('.sheet .sheet__title');
    const warnzeile = [...document.querySelectorAll('.sheet .goalrow__sub')]
      .some(el => el.textContent.includes('Der Rest passt nicht mehr in diese Woche'));
    const knopf = [...document.querySelectorAll('.sheet button')]
      .some(b => b.textContent.trim() === 'Nächste Woche planen');
    return { titel: t ? t.textContent : null, warnzeile, knopf };
  });
  console.log('Ritual Schritt 3 (Montag):', JSON.stringify(f3));
  ok(f3.titel === 'Und wann?', 'f) Schritt 3 ist erreicht (Titel "Und wann?"), war ' + JSON.stringify(f3.titel));
  ok(!f3.warnzeile, 'f) im Montag-Szenario erscheint KEINE Zusatzzeile (die Woche passt noch)');
  ok(!f3.knopf, 'f) im Montag-Szenario erscheint der Knopf "Naechste Woche planen" NICHT');

  // ==============================================================
  // g) Mini-Stufe D: der Erststart-Assistent laeuft durch verteilenMitGate().
  //    Anders als basisSetup() oben: WIRKLICH frischer Zustand (keine
  //    Bloecke/Aufgaben/Profilname), damit maybeWelcome() ueberhaupt
  //    ansteht, und WIRKLICH echte Klicks durch den Assistenten statt
  //    direkter state-Manipulation — das ist der Pfad, den Stufe D aendert.
  // ==============================================================
  console.log('\n=== g) Erststart-Assistent durchs Gate (Mini-Stufe D) ===');

  async function frischerZustand() {
    return p.evaluate(() => {
      if (typeof closeModal === 'function') closeModal();
      // Toasts laufen ueber echte setTimeout()s (Realzeit, von setFixedTime()
      // unberuehrt) — ohne Aufraeumen koennte hier ein Toast aus dem VORIGEN
      // Szenario (z.B. g2s "Naechste Woche planen") noch stehen, wenn g3
      // seinen eigenen Toast kurz danach abfragt.
      document.querySelectorAll('#toasts .toast').forEach(t => t.remove());
      state = freshState(); migrate(state);
      anchor = new Date();
      selectedDayIdx = (new Date().getDay() + 6) % 7;
      save(); setView('heute'); renderAll();
      return { heuteKey: iso(new Date()), montag: iso(mondayOf(anchor)) };
    });
  }

  // Alle vier Schritte mit "Weiter"/"Los geht's"/"Woche anlegen" durchklicken,
  // ohne ein einziges Feld anzufassen (Muster ob.js) — .btn--primary ist an
  // jedem Schritt der einzige Treffer im Fuss.
  async function assistentDurchklicken() {
    await p.evaluate(() => maybeWelcome());
    await p.waitForTimeout(250);
    for (let i = 0; i < 3; i++) {
      await p.click('.sheet__foot .btn--primary');
      await p.waitForTimeout(200);
    }
    await p.click('.sheet__foot .btn--primary');   // schritt 3: "Woche anlegen"
    await p.waitForTimeout(400);
  }

  // --- g1)+g2) Samstagabend: dieselbe Uhr wie a), aber ueber den echten
  //     Erststart-Weg statt basisSetup(). ---------------------------------
  await p.clock.setFixedTime(new Date('2026-08-08T20:00:00+02:00'));
  const g0 = await frischerZustand();
  await assistentDurchklicken();

  const g1 = await p.evaluate(() => {
    const t = document.querySelector('.sheet .sheet__title');
    return {
      titel: t ? t.textContent : null,
      ziele: state.areas.filter(a => a.plan.goal > 0).map(a => a.id + ':' + a.plan.goal).sort(),
      arbeitBloecke: state.blocks.filter(b => !b.sug && b.title === 'Arbeit').length,
      sugBloecke: state.blocks.filter(b => b.sug).length,
      kapaOk: wochenKapazitaet().ok
    };
  });
  console.log('Nach "Woche anlegen" (Samstagabend):', JSON.stringify(g1));
  ok(g1.kapaOk === false, 'g1) Voraussetzung: wochenKapazitaet().ok ist in diesem Szenario false');
  ok(g1.titel === 'Das wird eng',
    'g1) "Woche anlegen" oeffnet am Samstagabend "Das wird eng" statt still zu verteilen (Titel: ' + JSON.stringify(g1.titel) + ')');
  ok(g1.ziele.length === 5 && g1.ziele.join(',') === 'a3:3,a4:2,a5:6,a6:3,a7:2',
    'g1) alle Wochenziele aus dem Assistenten (START_ZIELE) sind trotz Gate schon gesetzt (' + JSON.stringify(g1.ziele) + ')');
  ok(g1.arbeitBloecke === 5, 'g1) die fuenf Arbeit-Bloecke Mo-Fr sind trotz Gate schon angelegt (' + g1.arbeitBloecke + ')');
  ok(g1.sugBloecke === 0, 'g1) solange das Gate offen ist, sind noch KEINE sug-Bloecke entstanden (' + g1.sugBloecke + ')');

  const g2Btn = p.locator('.sheet button:has-text("Nächste Woche planen")');
  const g2Da = await g2Btn.count() > 0;
  ok(g2Da, 'g2) der Dialog bietet in der laufenden Woche "Naechste Woche planen" an');

  // .count() statt direkt .click(): bleibt der Knopf aus (Regression), soll
  // das als FEHLER-Zeile stehen bleiben statt das Skript per Timeout
  // abzureissen — derselbe Kniff wie in Abschnitt d)/f) oben.
  if (g2Da) await g2Btn.click();
  await p.waitForTimeout(300);
  const g2 = g2Da ? await p.evaluate((vorherMontag) => ({
    modalOffen: !!document.querySelector('.scrim'),
    montagNeu: iso(mondayOf(anchor)),
    vorschlaegeVorhanden: state.blocks.some(b => b.sug),
    toast: (document.querySelector('#toasts .toast span') || {}).textContent || null
  }), g0.montag) : { modalOffen: true, montagNeu: g0.montag, vorschlaegeVorhanden: false, toast: null };
  console.log('Nach "Naechste Woche planen" (Erststart):', JSON.stringify(g2));
  ok(!g2.modalOffen, 'g2) der Dialog ist zu, nachdem "Naechste Woche planen" geklickt wurde');
  ok(g2.montagNeu !== g0.montag, 'g2) die angezeigte Woche ist weitergeblaettert (' + g0.montag + ' -> ' + g2.montagNeu + ')');
  ok(g2.vorschlaegeVorhanden, 'g2) in der neuen Woche sind Vorschlaege entstanden');
  ok(g2.toast === 'Vorschlag für die nächste Woche steht',
    'g2) derselbe Toast wie beim normalen "Naechste Woche"-Weg meldet das Ergebnis (' + JSON.stringify(g2.toast) + ')');

  // --- g3) Gegenprobe Montagmorgen: derselbe Erststart-Ablauf, dieselben
  //     Vorgaben — die Woche passt, kein Gate, sofort verteilt. -----------
  console.log('\n--- g3) Gegenprobe: derselbe Erststart-Ablauf am Montagmorgen ---');
  await p.clock.setFixedTime(new Date('2026-08-03T08:00:00+02:00'));
  await frischerZustand();
  await assistentDurchklicken();

  const g3 = await p.evaluate(() => {
    const t = document.querySelector('.sheet .sheet__title');
    return {
      dialogWeg: !document.querySelector('.sheet'),
      titelFalls: t ? t.textContent : null,
      sugBloecke: state.blocks.filter(b => b.sug).length,
      kapaOk: wochenKapazitaet().ok,
      toast: (document.querySelector('#toasts .toast span') || {}).textContent || null
    };
  });
  console.log('Gegenprobe Montagmorgen:', JSON.stringify(g3));
  ok(g3.kapaOk === true, 'g3) Voraussetzung: wochenKapazitaet().ok ist am Montagmorgen true');
  ok(g3.dialogWeg,
    'g3) kein Gate am Montagmorgen — der Assistent schliesst direkt, kein "Das wird eng" (stattdessen: ' + JSON.stringify(g3.titelFalls) + ')');
  ok(g3.sugBloecke > 0, 'g3) sug-Bloecke entstehen sofort, ohne Umweg ueber ein Gate-Blatt (' + g3.sugBloecke + ')');
  ok(g3.toast === 'Deine Woche steht.' || g3.toast === "Los geht's — trag ein, was fest ist",
    'g3) einer der beiden Erststart-Toasts von vor Stufe D meldet das Ergebnis, kein Gate-Toast (' + JSON.stringify(g3.toast) + ')');

  console.log('\nKonsolenfehler:', konsolenfehler.length ? konsolenfehler : 'keine');
  console.log('\nFehler:', fehler.length ? fehler : 'keine');
  await br.close();
  if (fehler.length || konsolenfehler.length) process.exit(1);
})();
