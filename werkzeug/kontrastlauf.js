/* ============================================================
   Prüfskript Kontrastlauf (v1.42) — Kontraste an der laufenden App

   kontrast.js prüft Token-Paare im Quelltext; dieses Skript misst, was
   wirklich auf dem Bildschirm steht: für jedes sichtbare Element mit
   eigenem Textknoten die berechnete Textfarbe gegen den effektiv dahinter
   liegenden Grund. Der Grund entsteht aus allen Vorfahren — Hintergrund,
   flächige ::before/::after (z. B. die Pille der Vorschlagsleiste) und
   Deckkraft je Ebene (opacity wirkt auf Text UND Grund der Gruppe).
   Farben (oklch, color-mix …) rechnet ein 1×1-Canvas nach sRGB um,
   Kontrast nach der WCAG-2-Formel.

     Text           ≥ 4.5:1, große Schrift (≥ 24 px, ≥ 18,66 px fett) ≥ 3:1
     Bedienelemente ≥ 3:1: Rand bzw. Ring ungefüllter Knöpfe, Chips und
                    Felder gegen den Grund (gefüllte zählen über ihre
                    Fläche; reine Textknöpfe ohne Rand brauchen keinen),
                    Haken-Mulden (Ring) und abgehakte Haken (Stein),
                    Schalter, Symbole in Knöpfen, die Steine der Ziele
                    (massiv, Ring, gestrichelt, blass) und die tippbaren
                    Mulden im Ziele-Blatt, der Heute-Ring im Tagesband.

   Abgedeckt: Handy 390×844 und Desktop 1440×900, je hell und dunkel;
   Ansichten heute/plan/ziele/aufgaben (Desktop: die drei Arbeitsbereiche
   neben dem Raster), Blätter Eintrag (blockSheet), Ziele bearbeiten,
   Passt das noch? (mit Ergebnis), Einstellungen (Menü und jede Seite),
   Monat, Wochen-Blatt, ein Toast und die Vorschlagsleiste.

   Ausnahmen — jede einzeln benannt, jede greift nur unter Soll und wird
   mit Wert ausgegeben:
     A1 deaktiviert   WCAG 1.4.3/1.4.11 nehmen inaktive Bedienelemente
                      aus: :disabled / aria-disabled und die Beschriftung
                      (label for=…) eines deaktivierten Feldes.
     A2 vergangen     Vergangene Tage und Wochen im Monat
                      (.monatcell.is-vergangen, .monatweek.is-past) sind
                      bewusst zurückgenommen (opacity .45): sie sind
                      Kontext, nicht Inhalt; heute und die Zukunft tragen
                      die Information.
     A3 Vorschlag     Der blasse Stein „vorgeschlagen" in den Wochenzielen
                      (.stein--sug): ein Vorschlag ist noch keine Zusage und
                      ist überall in der App blass (Geisterzeilen, Raster).
                      Die Steinreihe ist aria-hidden; dieselbe Menge steht
                      als Text darunter („… vorgeschlagen"), die Grafik ist
                      damit nicht zum Verständnis nötig (WCAG 1.4.11).
                      Massive, Ring- und gestrichelte Steine bleiben ≥ 3:1.

   Feste Uhr und Zone: Mittwoch, 7.10.2026, 14:40 Europe/Berlin.
   Exit 1 bei jedem Fall unter Soll.
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');
const F = 'file://' + path.resolve(__dirname, '..', 'index.html');
const UHR = '2026-10-07T14:40:00+02:00';

const fehler = [];
const ausnahmen = [];
const minima = {};   // "hell Text" → { r, wo }
const konsolenfehler = [];

/* ---------------------------------------------------------------- Messung
   Läuft im Browser. root: null = ganze Seite ohne Blätter/Toasts,
   sonst ein Selektor (Blatt, Toast). */
function MESSEN(root) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  const rgba = c => {
    if (cache.has(c)) return cache.get(c);
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    const v = [d[0], d[1], d[2], d[3] / 255];
    cache.set(c, v); return v;
  };
  const misch = (o, u) => [0, 1, 2].map(i => o[i] * o[3] + u[i] * (1 - o[3])).concat(1);
  const lum = c => { const f = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const rund = r => Math.round(r * 100) / 100;

  // Eine flächige Pseudo-Ebene (absolut, mit Farbe, deckt ≥ 60 % des Elements)
  const deckendePseudos = e => {
    const out = [];
    const r = e.getBoundingClientRect();
    for (const ps of ['::before', '::after']) {
      const p = getComputedStyle(e, ps);
      if (!p.content || p.content === 'none' || p.content === 'normal' || p.display === 'none') continue;
      if (p.position !== 'absolute' && p.position !== 'fixed') continue;
      const bg = rgba(p.backgroundColor);
      if (bg[3] === 0) continue;
      const w = parseFloat(p.width), h = parseFloat(p.height);
      if (!(w * h >= 0.6 * r.width * r.height)) continue;
      out.push(bg);
    }
    return out;
  };
  // Der zusammengesetzte Pixel an el: alle Vorfahren von oben nach unten,
  // optional el ohne eigenen Grund, oben drauf eine Farbe (Text, Ring).
  const zusammen = (el, oben, mitEigenem = true) => {
    const kette = []; for (let e = el; e; e = e.parentElement) kette.unshift(e);
    const lauf = (i, unten) => {
      const e = kette[i], cs = getComputedStyle(e), letzte = i === kette.length - 1;
      let c = unten;
      if (!letzte || mitEigenem) {
        const bg = rgba(cs.backgroundColor); if (bg[3] > 0) c = misch(bg, c);
        deckendePseudos(e).forEach(p => { c = misch(p, c); });
      }
      const innen = letzte ? (oben ? misch(oben, c) : c) : lauf(i + 1, c);
      const op = +cs.opacity;
      return op < 1 ? misch([innen[0], innen[1], innen[2], op], unten) : innen;
    };
    return lauf(0, [255, 255, 255, 1]);
  };
  const sichtbar = el => {
    if (!el.checkVisibility || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (el.closest('.sr, .jubel')) return false;
    if (!root && el.closest('#modalRoot, #toasts')) return false;
    return true;
  };
  const name = el => {
    const t = (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) || el.textContent || '';
    const k = (el.getAttribute('class') || '').trim().split(/\s+/).slice(0, 2).join('.');
    return (el.id ? '#' + el.id : el.tagName.toLowerCase() + (k ? '.' + k : '')) + ' „' + t.trim().replace(/\s+/g, ' ').slice(0, 34) + '"';
  };
  const ausnahme = el => {
    if (el.closest(':disabled, [aria-disabled="true"]')) return 'A1 deaktiviert';
    const lab = el.closest('label');
    if (lab) {
      const ctl = lab.htmlFor ? document.getElementById(lab.htmlFor) : lab.querySelector('input, select, textarea');
      if (ctl && ctl.disabled) return 'A1 deaktiviert';
    }
    if (el.closest('.monatcell.is-vergangen, .monatweek.is-past')) return 'A2 vergangen';
    // Durchgestrichene erledigte Einträge brauchen keine Ausnahme: sie
    // erreichen 4.5:1 (gemessen mit aufgeklapptem „Erledigt").
    if (el.matches('.steinreihe .stein--sug, .goals__legende .stein--sug')) return 'A3 Vorschlag-Stein';
    return null;
  };
  // Ring aus box-shadow: Versatz 0, Unschärfe 0, Ausdehnung > 0
  const ring = cs => {
    const s = cs.boxShadow; if (!s || s === 'none') return null;
    const teile = []; let tiefe = 0, akt = '';
    for (const ch of s) { if (ch === '(') tiefe++; if (ch === ')') tiefe--; if (ch === ',' && !tiefe) { teile.push(akt); akt = ''; } else akt += ch; }
    teile.push(akt);
    let best = null;
    for (const t of teile) {
      const farbe = (t.match(/[a-z-]+\([^()]*(?:\([^()]*\)[^()]*)*\)|#[0-9a-f]+/i) || [])[0];
      if (!farbe) continue;
      const zahlen = t.replace(farbe, '').match(/-?[\d.]+px/g) || [];
      const [x, y, b, sp] = zahlen.map(parseFloat);
      if (x === 0 && y === 0 && (b || 0) === 0 && (sp || 0) >= 1) { if (!best || sp > best.sp) best = { farbe, sp }; }
    }
    return best ? rgba(best.farbe) : null;
  };
  const rand = cs => {
    const w = parseFloat(cs.borderTopWidth) || 0;
    if (w < 1 || cs.borderTopStyle === 'none' || cs.borderTopStyle === 'hidden') return null;
    const c = rgba(cs.borderTopColor); return c[3] > 0 ? c : null;
  };

  const res = [];
  const basis = root ? document.querySelector(root) : document.body;
  if (!basis) return { fehlt: root };

  // ---- Text
  const gesehen = new Set();
  const walker = document.createTreeWalker(basis, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode; if (!t.textContent.trim()) continue;
    const el = t.parentElement; if (!el || gesehen.has(el)) continue; gesehen.add(el);
    if (!sichtbar(el)) continue;
    const cs = getComputedStyle(el);
    const svg = el instanceof SVGElement;
    const fgS = svg ? cs.fill : cs.color;
    if (!fgS || /url|none/.test(fgS)) continue;
    const fg = rgba(fgS);
    const r = ratio(zusammen(el, fg), zusammen(el, null));
    const px = parseFloat(cs.fontSize), fett = +cs.fontWeight >= 700;
    const soll = px >= 24 || (px >= 18.66 && fett) ? 3 : 4.5;
    res.push({ typ: 'Text', was: name(el), r: rund(r), soll, aus: r < soll ? ausnahme(el) : null });
  }
  // Eingetippte Werte in Feldern sind auch Text
  basis.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea').forEach(el => {
    if (!sichtbar(el) || !(el.value || '').trim()) return;
    const cs = getComputedStyle(el);
    const r = ratio(zusammen(el, rgba(cs.color)), zusammen(el, null));
    res.push({ typ: 'Text', was: name(el) + ' Wert', r: rund(r), soll: 4.5, aus: r < 4.5 ? ausnahme(el) : null });
  });

  // ---- Bedienelemente: Rand/Ring bzw. Fläche gegen den Grund, Soll 3
  const ui = (el, was, r) => res.push({ typ: 'Rand', was: was + ' ' + name(el), r: rund(r), soll: 3, aus: r < 3 ? ausnahme(el) : null });
  const grund = el => zusammen(el, null, false);
  const KNOEPFE = 'button, .btn, .chip, .field, input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea, [role=button], .taskadd, .zusage__einstieg';
  basis.querySelectorAll(KNOEPFE).forEach(el => {
    if (!sichtbar(el) || el.closest('.steinreihe, .zsteine, .zsteinzeile')) return;
    const cs = getComputedStyle(el);
    const kante = rand(cs) || ring(cs);
    if (!kante) return;                       // reiner Textknopf: Text trägt ihn
    const g = grund(el);
    const flaeche = ratio(zusammen(el, null, true), g);
    const r = Math.max(flaeche, ratio(misch(kante, g), g));
    ui(el, 'Rand', r);
  });
  // Haken und Schalter (appearance: none — die nativen zeichnet der Browser)
  basis.querySelectorAll('input[type=checkbox]').forEach(el => {
    if (!sichtbar(el)) return;
    const cs = getComputedStyle(el);
    if (cs.appearance !== 'none' && cs.webkitAppearance !== 'none') return;
    const g = grund(el);
    const kante = rand(cs) || ring(cs);
    const flaeche = ratio(zusammen(el, null, true), g);
    const r = Math.max(flaeche, kante ? ratio(misch(kante, g), g) : 0);
    ui(el, el.checked ? 'Haken an' : 'Haken/Mulde', r);
  });
  // Symbole in Knöpfen (Strich = currentColor)
  basis.querySelectorAll('button svg, .btn svg').forEach(el => {
    if (!sichtbar(el) || el.closest('.steinreihe, .zsteine, .zsteinzeile')) return;
    const cs = getComputedStyle(el);
    const strich = cs.stroke && !/none|url/.test(cs.stroke) ? cs.stroke : cs.color;
    const knopf = el.closest('button, .btn');
    const g = zusammen(knopf, null, true);
    ui(knopf, 'Symbol', ratio(misch(rgba(strich), g), g));
  });
  // Steine der Ziele (Ansicht, Blatt, Zusage) und die Legende
  basis.querySelectorAll('.steinreihe .stein, .zsteine .stein, .zsteinzeile .stein, .goals__legende .stein').forEach(el => {
    if (!sichtbar(el) || el instanceof SVGElement) return;   // angebrochene (SVG) zeigen nur einen Sektor
    const cs = getComputedStyle(el);
    // Der Stein füllt seine Mulde ganz aus — sein Nachbar ist die Schiene
    // bzw. das Blatt neben dem Slot, nicht die Mulde darunter.
    const slot = el.closest('.slot');
    const g = slot ? zusammen(slot.parentElement, null, true) : grund(el);
    let farbe;
    if (el.classList.contains('stein--plan')) farbe = ring(cs);
    else if (el.classList.contains('stein--grob')) farbe = rand(cs);
    else farbe = null;
    const r = farbe ? ratio(misch(farbe, g), g) : ratio(zusammen(el, null, true), g);
    const art = (el.className.match(/stein--\w+/) || ['massiv'])[0];
    ui(el, 'Stein ' + art, r);
  });
  // Tippbare Mulden im Ziele-Blatt (die Mulde ist das ::before des Slots)
  basis.querySelectorAll('.zsteine .slot').forEach(el => {
    if (!sichtbar(el) || el.querySelector('.stein')) return;
    const p = getComputedStyle(el, '::before');
    const g = zusammen(el, null, true);
    const fl = misch(rgba(p.backgroundColor), g);
    const kante = ring(p);
    const r = Math.max(ratio(fl, g), kante ? ratio(misch(kante, fl), g) : 0);
    ui(el, 'Mulde (Ziele-Blatt)', r);
  });
  // Heute-Ring im Tagesband
  basis.querySelectorAll('.dayswitch__btn.is-today:not([aria-pressed="true"])').forEach(el => {
    if (!sichtbar(el)) return;
    const k = ring(getComputedStyle(el)); if (!k) return;
    const g = zusammen(el, null, true);
    ui(el, 'Heute-Ring', ratio(misch(k, g), g));
  });
  return { res };
}

/* ---------------------------------------------------------------- Daten
   Eine echte Mittwochswoche: erledigte und offene Termine, Vorschläge
   (Leiste sichtbar), grobe Termine, Ziele aller Steinarten, Aufgaben mit
   und ohne Bereich, eine erledigt. */
function befuellen(theme) {
  closeModal();
  state = freshState(); migrate(state);
  state.settings.theme = theme;
  state.settings.dayStart = 7; state.settings.dayEnd = 22;
  state.profile.name = 'Sunny';
  anchor = new Date(); selectedDayIdx = (new Date().getDay() + 6) % 7;
  const mo = mondayOf(anchor);
  state.rituale[iso(mo)] = Date.now();
  const k = i => iso(addDays(mo, i));
  const t = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const fertig = [];
  const B = (day, von, bis, areaId, title, done, extra) => {
    const b = Object.assign({ id: uid(), title, areaId, day, date: k(day), repeat: 'none', start: t(von), end: t(bis), frog: false, grob: false }, extra || {});
    if (done) fertig.push(b); return b;
  };
  state.blocks = [
    B(0, '09:00', '17:00', 'a1', 'Büro', 1), B(0, '18:00', '19:00', 'a3', 'Bouldern', 1),
    B(1, '10:00', '12:00', 'a2', 'Vorlesung Statistik', 1), B(1, '13:00', '17:00', 'a1', 'Werkstudent', 1),
    B(1, '19:30', '21:00', 'a6', 'Spieleabend'),
    B(2, '08:30', '12:00', 'a1', 'Sprint-Review vorbereiten', 1),
    B(2, '12:30', '13:15', 'a6', 'Mittagessen mit Lea', 1),
    B(2, '14:00', '16:00', 'a2', 'Statistik: Übungsblatt 3'),
    B(2, '17:30', '18:30', 'a3', 'Laufen am Fluss'),
    B(2, '00:00', '00:00', 'a5', 'Lesen', 0, { grob: true, teil: 'ab', dauer: 60 }),
    B(3, '09:00', '13:00', 'a1', 'Werkstudent'), B(3, '15:00', '17:00', 'a2', 'Lerngruppe'),
    B(4, '09:00', '12:00', 'a1', 'Büro'), B(4, '16:00', '17:00', 'a3', 'Schwimmen'), B(4, '20:00', '23:00', 'a6', 'Geburtstag Jonas'),
    B(5, '10:00', '11:00', 'a7', 'Fahrradkeller aufräumen'), B(5, '14:00', '16:00', 'a4', 'Fotospaziergang'),
    B(5, '00:00', '00:00', 'a6', 'Oma anrufen', 0, { grob: true, teil: 'nm', dauer: 60 })
  ];
  fertig.forEach(b => setzeErledigt(b, b.date, true));
  state.tasks = [
    { id: uid(), title: 'Steuererklärung: Belege sortieren', areaId: 'a7', done: false, frog: true, dauer: 60 },
    { id: uid(), title: 'Zahnarzttermin ausmachen', areaId: 'a7', done: false, frog: false },
    { id: uid(), title: 'Bewerbung Werkstudent abschicken', areaId: 'a1', done: true, frog: false }
  ];
  state.days[k(6)] = { frei: true };
  const ziel = (id, g, grob) => { const a = state.areas.find(x => x.id === id); a.plan.goal = g; a.plan.grob = !!grob; };
  state.areas.forEach(a => { a.plan.goal = 0; });
  ziel('a2', 10); ziel('a3', 4); ziel('a4', 3); ziel('a6', 5, true); ziel('a5', 6);
  const hob = state.areas.find(x => x.id === 'a4'); hob.plan.days = [2]; hob.plan.from = 19 * 60; hob.plan.to = 21 * 60;
  const fr = state.areas.find(x => x.id === 'a5'); fr.plan.days = [2]; fr.plan.from = 20 * 60 + 30; fr.plan.to = 22 * 60;
  state.areas.forEach(a => { if (!['a4', 'a5'].includes(a.id)) a.plan.days = [3, 4, 5]; });
  buildSuggestions();
  save(); applyTheme(); renderAll();
}

(async () => {
  const br = await chromium.launch({ executablePath: process.env.WP_CHROMIUM });

  const auswerten = (lauf, wo, erg, mindestens) => {
    if (erg.fehlt) { fehler.push(`${lauf} ${wo}: ${erg.fehlt} nicht gefunden`); console.log(`   FEHLER ${wo}: ${erg.fehlt} nicht gefunden`); return; }
    const thema = lauf.split(' ')[1];
    let n = 0, schlecht = 0;
    for (const x of erg.res) {
      n++;
      if (x.r < x.soll) {
        if (x.aus) { ausnahmen.push(`${lauf} ${wo}: ${x.aus} — ${x.typ} ${x.was} ${x.r}:1`); continue; }
        schlecht++;
        fehler.push(`${lauf} ${wo}: ${x.typ} ${x.was} ${x.r}:1 (Soll ${x.soll})`);
      }
      const key = thema + ' ' + x.typ;
      if (!x.aus && (!minima[key] || x.r < minima[key].r)) minima[key] = { r: x.r, wo: `${lauf} ${wo}: ${x.was}` };
    }
    console.log((schlecht ? '   FEHLER ' : '   OK     ') + `${lauf} ${wo}: ${n} Messungen` + (schlecht ? `, ${schlecht} unter Soll` : ''));
    if (n < mindestens) { fehler.push(`${lauf} ${wo}: nur ${n} Messungen — leer?`); }
  };

  const laeufe = [
    { name: 'Handy', ctx: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }, handy: true },
    { name: 'Desktop', ctx: { viewport: { width: 1440, height: 900 } }, handy: false }
  ];
  for (const g of laeufe) for (const thema of ['light', 'dark']) {
    const lauf = `${g.name} ${thema === 'light' ? 'hell' : 'dunkel'}`;
    console.log(lauf);
    const ctx = await br.newContext({ ...g.ctx, timezoneId: 'Europe/Berlin', locale: 'de-DE', colorScheme: thema, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.on('pageerror', e => konsolenfehler.push(lauf + ' PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) konsolenfehler.push(lauf + ' CONSOLE: ' + m.text()); });
    await p.clock.setFixedTime(new Date(UHR));
    await p.goto(F);
    await p.waitForFunction(() => typeof syncSettled !== 'undefined' && syncSettled);
    await p.evaluate(befuellen, thema);
    await p.evaluate(() => document.fonts.ready);
    const dunkel = await p.evaluate(() => document.documentElement.dataset.theme);
    if (dunkel !== (thema === 'light' ? 'light' : 'dark')) fehler.push(`${lauf}: data-theme ist ${dunkel}`);

    // Ganze Ansichten und Blätter tragen Dutzende Messungen, Leiste und Toast
    // nur eine Handvoll — eine Untergrenze fängt eine leer gebliebene Stelle.
    const messe = async (wo, root, mindestens) => auswerten(lauf, wo, await p.evaluate(MESSEN, root || null), mindestens || 8);
    const blatt = async (wo, oeffnen, danach) => {
      await p.evaluate(oeffnen); await p.waitForTimeout(250);
      if (danach) { await danach(); await p.waitForTimeout(150); }
      await messe(wo, '#modalRoot .scrim:last-child .sheet');
      await p.evaluate(() => closeModal()); await p.waitForTimeout(150);
    };

    // Ansichten
    const ansichten = g.handy ? ['heute', 'plan', 'ziele', 'aufgaben'] : ['heute', 'ziele', 'aufgaben'];
    for (const v of ansichten) {
      await p.evaluate(v => { setView(v); renderAll(); }, v); await p.waitForTimeout(200);
      await messe('Ansicht ' + v);
    }
    // Aufgaben mit aufgeklapptem „Erledigt" (abgehakter Haken, erledigte Aufgabe)
    await p.evaluate(() => { setView('aufgaben'); renderAll(); const t = document.querySelector('.tasks__toggle'); if (t) t.click(); });
    await p.waitForTimeout(150);
    const offen = await p.evaluate(() => !!document.querySelector('.task.is-done .task__check:checked'));
    if (!offen) fehler.push(`${lauf}: erledigte Aufgabe nicht sichtbar — Lauf deckt sie nicht ab`);
    await messe('Ansicht aufgaben, Erledigt offen');
    // Vorschlagsleiste wirklich da?
    await p.evaluate(() => { setView('heute'); renderAll(); }); await p.waitForTimeout(150);
    const leiste = await p.evaluate(() => { const s = document.querySelector('#sugBar'); return !!s && s.checkVisibility() && !!s.textContent.trim(); });
    if (g.handy && !leiste) fehler.push(`${lauf}: Vorschlagsleiste nicht sichtbar — Lauf deckt sie nicht ab`);
    if (leiste) await messe('Vorschlagsleiste', '#sugBar', 3);

    // Blätter
    await blatt('Blatt Eintrag', () => { const b = state.blocks.find(x => x.title === 'Laufen am Fluss'); blockSheet(b, b.date); });
    await blatt('Blatt Eintrag erledigt', () => { const b = state.blocks.find(x => x.title === 'Sprint-Review vorbereiten'); blockSheet(b, b.date); });
    await blatt('Blatt Ziele bearbeiten', () => goalsSheet());
    await blatt('Blatt Passt das noch?', () => zusageSheet(),
      () => p.evaluate(() => { const c = document.querySelector('#zDauer .chip:nth-child(6)'); if (c) c.click(); }));
    await blatt('Blatt Monat', () => document.querySelector('#monthBtn').click());
    await blatt('Blatt Woche', () => document.querySelector('#weekLabel').click());
    // Einstellungen: Menü und jede Seite
    await p.evaluate(() => document.querySelector('#settingsBtn').click()); await p.waitForTimeout(250);
    await messe('Einstellungen Menü', '#modalRoot .scrim:last-child .sheet');
    const seiten = await p.evaluate(() => document.querySelectorAll('.setmenu__item').length);
    for (let i = 0; i < seiten; i++) {
      const titel = await p.evaluate(i => { const b = document.querySelectorAll('.setmenu__item')[i]; const n = b.querySelector('.setmenu__name').textContent; b.click(); return n; }, i);
      await p.waitForTimeout(120);
      await messe('Einstellungen ' + titel, '#modalRoot .scrim:last-child .sheet');
      await p.evaluate(() => document.querySelector('.setback').click()); await p.waitForTimeout(80);
    }
    await p.evaluate(() => closeModal()); await p.waitForTimeout(150);
    // Toast
    await p.evaluate(() => toast('Eintrag gespeichert', { label: 'Rückgängig', run: () => {} })); await p.waitForTimeout(200);
    await messe('Toast', '#toasts .toast:last-child', 2);
    await ctx.close();
  }
  await br.close();

  console.log('\nMinimum je Thema:');
  Object.keys(minima).sort().forEach(k => console.log(`   ${k.padEnd(13)} ${minima[k].r.toFixed(2)}:1  (${minima[k].wo})`));
  if (ausnahmen.length) {
    const zaehl = {}; ausnahmen.forEach(a => { const k = a.match(/A\d [^ ]+/)[0]; zaehl[k] = (zaehl[k] || 0) + 1; });
    console.log('\nAusnahmen (unter Soll, bewusst):', JSON.stringify(zaehl));
    [...new Set(ausnahmen)].slice(0, 12).forEach(a => console.log('   ' + a));
  }
  if (konsolenfehler.length) { console.log('\nKonsolenfehler:'); konsolenfehler.forEach(k => console.log('   ' + k)); fehler.push(...konsolenfehler); }
  if (fehler.length) {
    console.log('\nUnter Soll:');
    [...new Set(fehler)].forEach(f => console.log('   FEHLER ' + f));
  }
  console.log(fehler.length ? '\n' + fehler.length + ' FEHLER' : '\nAlle Prüfungen bestanden.');
  process.exit(fehler.length ? 1 : 0);
})();
