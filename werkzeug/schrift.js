/* ============================================================
   Prüfskript Systemschrift (Stufe 7) — iPhone SE (320x568), Grundschrift
   um zwei Stufen vergrößert. Dauerhaft, Exit 1 bei Fehlern.

   Der eigentliche Risikopunkt von Stufe 7: alle font-size-Werte laufen
   jetzt über rem-Tokens OHNE html{font-size}-Override — 1rem folgt also
   direkt der Systemschriftgröße. Wählt der Nutzer eine größere
   Grundschrift (iOS "Größerer Text", Chrome "Schriftgröße"), skaliert die
   ganze Oberfläche mit. Dieses Skript simuliert genau das, statt es nur zu
   behaupten.

   "Zwei Stufen größer": Chromes eigener Schriftgrößen-Regler
   (chrome://settings/fonts) kennt die Stufen Sehr klein (9px) / Klein
   (12px) / Mittel (16px, Vorgabe) / Groß (20px) / Sehr groß (24px). Zwei
   Stufen über der Vorgabe = "Sehr groß" = 24px an <html> (Vorgabe 16px,
   +50 %). Per Stylesheet injiziert (kein html{font-size} in index.html
   selbst, siehe Bericht Stufe 7) — genau der Weg, den ein echter Nutzer
   über die Systemeinstellung auch nimmt.

   Prüft für jede der vier mobilen Ansichten (plan/ziele/aufgaben/heute):
     - kein waagerechtes Scrollen der Seite
     - kein abgeschnittener Text (gleiche Erkennung wie audit.js)
     - alle Tabbar-Beschriftungen vollständig lesbar (keine der vier
       gehört zu den erwarteten Falschmeldungen aus dem Häkchen-/
       Farbfeld-::before — die Tabbar hat keins)
   und einmal zusätzlich (Ansicht "heute"):
     - gestaffelter Falz-Vertrag statt der vollen Falz aus agenda.js, siehe
       unten am Prüfpunkt

   Stil wie agenda.js/haken.js: eine Chromium-Seite, deutsche Ausgabe,
   Exit 1 bei Fehlern, gemessene Werte werden ausgegeben.
   Uhrzeit UND Datum sind über page.clock.setFixedTime() auf Mittwoch, 10 Uhr
   genagelt (wie in agenda.js) — sonst hängt der Vergleichswert weiter unten
   ("bei normaler Schrift passt die Agenda über die Tabbar") davon ab, wann
   jemand das Skript zufällig startet, statt an einer echten Vertragslücke.

   Warum der Falz-Vertrag hier gestaffelt ist: die volle Falz aus Stufe 4
   (ganze Agenda ohne Scrollen über der Tabbar) galt immer implizit für die
   Standardschrift — agenda.js prüft genau die weiter, unverändert. Wer die
   Systemschrift vergrößert, will größere Schrift und nimmt dafür mehr
   Scrollen in Kauf; das zu verhindern wäre Bevormundung und würde die mit
   Stufe 7 gerade hergestellte Barrierefreiheit wieder zunichtemachen.
   Härter begründet, weil unabhängig von der gewählten Schriftgröße, ist nur
   die schwächere Forderung: die Antwort auf "was jetzt/als nächstes" muss
   auch bei großer Schrift ohne Scrollen sichtbar sein. Genau die prüft der
   Abschnitt weiter unten statt der vollen Falz.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');

const fehler = [];
const ok = (bed, txt) => { console.log((bed ? '   OK   ' : '   FEHLER ') + txt); if (!bed) fehler.push(txt); };

const messen = () => {
  const R = el => el.getBoundingClientRect();
  const clip = [];
  document.querySelectorAll('*').forEach(e => {
    if (e.children.length) return;
    // .sr (Sprunglink "Zum Inhalt") ist absichtlich auf 1x1px verklemmt —
    // dieselbe erwartete Falschmeldung wie in audit.js (Stufe 7 Bericht).
    if (e.closest('.sr')) return;
    if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible') {
      clip.push((e.textContent || '').trim().slice(0, 30));
    }
  });
  const tabs = [...document.querySelectorAll('.tabbar button')].map(b => {
    const label = b.querySelector('svg') ? [...b.childNodes].filter(n => n.nodeType === 3 || n.tagName !== 'svg').map(n => n.textContent).join('').trim() : b.textContent.trim();
    return { text: label, w: Math.round(R(b).width), h: Math.round(R(b).height), abgeschnitten: b.scrollWidth > b.clientWidth + 1 };
  });
  return {
    querScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
    fensterBreite: window.innerWidth,
    abgeschnitten: [...new Set(clip)].slice(0, 8),
    tabs
  };
};

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });
  const ctx = await br.newContext({ ...devices['iPhone SE'], timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  const konsolenfehler = [];
  p.on('pageerror', e => konsolenfehler.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') konsolenfehler.push('CONSOLE: ' + m.text()); });

  // Mittwoch, 10 Uhr — s. Kopfkommentar.
  await p.clock.setFixedTime(new Date('2026-08-05T10:00:00+02:00'));
  await p.goto(F); await p.waitForTimeout(500);

  // Erststart-Assistent wegklicken (wie agenda.js/audit.js) — noch bei
  // normaler Schriftgröße, damit der Assistent selbst nicht Teil dieser
  // Prüfung wird (er hat eigene Prüfungen in ob.js/audit.js).
  for (let i = 0; i < 3; i++) { await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(280); }
  await p.click('.sheet__foot .btn--primary'); await p.waitForTimeout(900);

  // Dieselbe realistische Agenda wie agenda.js Szenario 1 (langer,
  // laufender und "danach"-Eintrag plus ein grober Eintrag) — sonst wäre
  // eine Falz-Abweichung nicht der größeren Schrift zuzuordnen, sondern
  // einfach mehr oder weniger Testdaten als in der bekannten Baseline.
  const sc = await p.evaluate(() => {
    const cap = m => Math.max(0, Math.min(1439, m));
    state.settings.dayStart = 0; state.settings.dayEnd = 24;
    const dayKey = iso(addDays(mondayOf(anchor), selectedDayIdx));
    const jetzt = new Date().getHours() * 60 + new Date().getMinutes();
    const laufStart = cap(jetzt - 15), laufEnd = cap(laufStart + 60);
    const danachStart = cap(Math.max(17 * 60, laufEnd + 30)), danachEnd = cap(danachStart + 60);
    state.blocks = [
      { id: uid(), title: 'Vorlesung Statistik II', areaId: 'a2',
        day: selectedDayIdx, date: dayKey, repeat: 'none',
        start: laufStart, end: laufEnd, frog: false, grob: false },
      { id: uid(), title: 'Fitnessstudio Innenstadt', areaId: 'a3',
        day: selectedDayIdx, date: dayKey, repeat: 'none',
        start: danachStart, end: danachEnd, frog: false, grob: false },
      { id: uid(), title: 'Freunde', areaId: 'a6',
        day: selectedDayIdx, date: dayKey, repeat: 'none',
        grob: true, teil: 'ab', dauer: 90,
        start: abschnittVon('ab').von, end: abschnittVon('ab').von + 90, frog: false }
    ];
    state.tasks = [{ id: uid(), title: 'Hausarbeit Statistik fertig schreiben', areaId: 'a2', done: false, frog: true }];
    save(); setView('heute'); renderAll();
    return { dayKey, jetzt };
  });
  console.log('\n## Testdaten (identisch zu agenda.js Szenario 1): ' + JSON.stringify(sc));
  await p.waitForTimeout(200);

  // Falz bei normaler Schrift zuerst messen — als Vergleichswert, damit
  // eine etwaige Abweichung eindeutig der größeren Schrift zuzuordnen ist
  // und nicht nur den Testdaten.
  const falzMessen = async () => p.evaluate(() => {
    const R = el => el.getBoundingClientRect();
    const agenda = document.querySelector('#agenda');
    const tabbar = document.querySelector('.tabbar');
    return {
      agendaUnten: Math.round(R(agenda).bottom),
      tabbarOben: Math.round(R(tabbar).top),
      fensterHoehe: window.innerHeight
    };
  });
  const falzVorher = await falzMessen();
  console.log('\n## Falz bei normaler Schrift (Vergleichswert, wie agenda.js)');
  console.log('   ' + JSON.stringify(falzVorher));
  ok(falzVorher.agendaUnten <= falzVorher.tabbarOben, 'Vergleichswert: bei normaler Schrift passt die Agenda über die Tabbar (' + falzVorher.agendaUnten + ' <= ' + falzVorher.tabbarOben + ')');

  // Grundschrift um zwei Stufen anheben — siehe Kopfkommentar. Injiziert
  // statt in index.html geändert, damit dieselbe Datei ohne Modifikation
  // sowohl normal als auch vergrößert geprüft wird.
  await p.addStyleTag({ content: 'html { font-size: 24px; }' });
  await p.waitForTimeout(200);

  const wurzel = await p.evaluate(() => ({
    htmlFontSize: getComputedStyle(document.documentElement).fontSize,
    bodyFontSize: getComputedStyle(document.body).fontSize
  }));
  console.log('\n## Grundschrift');
  console.log('   ' + JSON.stringify(wurzel));
  ok(wurzel.htmlFontSize === '24px', '<html> misst wie injiziert 24px (Vorgabe 16px, zwei Stufen größer)');
  ok(parseFloat(wurzel.bodyFontSize) > 15, 'body-Schrift ist mit der Grundschrift mitgewachsen (' + wurzel.bodyFontSize + ', vorher 15px)');

  for (const v of ['plan', 'ziele', 'aufgaben', 'heute']) {
    await p.evaluate(x => setView(x), v);
    await p.waitForTimeout(250);
    const m = await p.evaluate(messen);
    console.log('\n## Ansicht ' + v);
    console.log('   Fenster ' + m.fensterBreite + 'px, Dokumentbreite ' + m.scrollWidth + 'px');
    ok(!m.querScroll, 'kein waagerechtes Scrollen (' + m.scrollWidth + ' <= ' + m.fensterBreite + ')');
    ok(m.abgeschnitten.length === 0, 'kein abgeschnittener Text' + (m.abgeschnitten.length ? ': ' + JSON.stringify(m.abgeschnitten) : ''));
    console.log('   Tabbar: ' + JSON.stringify(m.tabs));
    ok(m.tabs.length === 4, 'alle vier Tabbar-Knöpfe vorhanden (' + m.tabs.length + ')');
    m.tabs.forEach(t => ok(!t.abgeschnitten, 'Tabbar-Beschriftung "' + t.text + '" vollständig lesbar, nicht abgeschnitten'));
    m.tabs.forEach(t => ok(t.text.length > 0, 'Tabbar-Knopf hat sichtbaren Text (nicht durch die font-size:0-Ausnahme unter (max-height:500px) verschluckt)'));
  }

  /* ---- Gestaffelter Falz-Vertrag: die Antwort muss sichtbar bleiben ----
     Nicht mehr die ganze Agenda muss ohne Scrollen über die Tabbar passen
     (das prüft weiter agenda.js, für Standardschrift) — aber "Heute zählt"
     samt Tagesschwerpunkt, der laufende/nächste Eintrag mit Titel und
     mindestens eine Zeile aus "Danach" müssen es, siehe Kopfkommentar. */
  console.log('\n## Antwort-Sichtbarkeit mit vergrößerter Schrift (Ansicht heute, gestaffelter Vertrag)');
  await p.evaluate(() => setView('heute'));
  await p.waitForTimeout(250);
  const antwort = await p.evaluate(() => {
    const R = el => el ? el.getBoundingClientRect() : null;
    const sichtbar = el => {
      const r = R(el);
      return !!r && r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
    };
    const panel = document.querySelector('.panel');
    const label = document.querySelector('#agenda .agenda__label'); // "Heute zählt"
    const frog = document.querySelector('#agendaFrog'); // Tagesschwerpunkt
    // agenda__hero-title = laufender Eintrag; ohne laufenden Eintrag ist der
    // erste Danach-Eintrag zugleich der "nächste" — dieselbe Logik wie in
    // renderAgenda() selbst (danach = eintraege ohne den laufenden).
    const heroTitle = document.querySelector('#agenda .agenda__hero-title');
    const ersteDanachZeile = document.querySelector('#agenda .agenda__list .agenda__row');
    const naechsterTitel = heroTitle || (ersteDanachZeile && ersteDanachZeile.querySelector('.agenda__title'));
    return {
      heuteZaehltSichtbar: sichtbar(label),
      schwerpunktSichtbar: sichtbar(frog),
      naechsterEintragSichtbar: sichtbar(naechsterTitel),
      naechsterEintragTitel: naechsterTitel ? naechsterTitel.textContent.trim() : null,
      danachZeileSichtbar: sichtbar(ersteDanachZeile),
      panelOverflowY: panel ? getComputedStyle(panel).overflowY : null
    };
  });
  console.log('   ' + JSON.stringify(antwort) + '  (Vergleich Falz bei normaler Schrift: ' + JSON.stringify(falzVorher) + ')');
  ok(antwort.heuteZaehltSichtbar, '"Heute zählt" ohne Scrollen sichtbar');
  ok(antwort.schwerpunktSichtbar, 'Tagesschwerpunkt (#agendaFrog) ohne Scrollen sichtbar');
  ok(antwort.naechsterEintragSichtbar, 'laufender/nächster Eintrag mit Titel ohne Scrollen sichtbar (' + antwort.naechsterEintragTitel + ')');
  ok(antwort.danachZeileSichtbar, 'mindestens eine Zeile aus "Danach" ohne Scrollen sichtbar');
  // Der eigentliche Fehlerfall wäre hier: .panel NICHT scrollbar — dann wäre
  // der Rest der Agenda (mehr "Danach", Tagesform etc.) unerreichbar statt
  // nur außerhalb des ersten Blicks.
  ok(antwort.panelOverflowY === 'auto' || antwort.panelOverflowY === 'scroll',
    '.panel ist scrollbar (overflow-y: ' + antwort.panelOverflowY + ') — sonst wäre weiterer Inhalt unerreichbar, nicht nur außerhalb des ersten Blicks');

  console.log('\n=== Konsolenfehler: ' + (konsolenfehler.length ? konsolenfehler.join(' | ') : 'keine'));
  if (konsolenfehler.length) fehler.push('Konsolenfehler aufgetreten');

  await br.close();
  if (fehler.length) { console.log('\n=== FEHLER (' + fehler.length + '):'); fehler.forEach(f => console.log(' - ' + f)); process.exit(1); }
  console.log('\nAlle Prüfungen bestanden.');
})();
