/* ============================================================
   PROVING GROUNDS v2 — sim.js
   Headless, deterministic assembly-state → outcome resolver.
   ALL SCIENCE HEREIN IS INVENTED. Compounds, casings, constants
   and scaling laws are fictional (Halloran crater scaling,
   Brandt yield units). What is real is *consequence*: the
   outcome is computed from what the player physically did.
   DOM-free. Importable in node:  const PG2 = require('./sim.js')
   ============================================================ */
'use strict';

var PG2 = (function () {

  /* ---------- THE CONTRACT (three numbers, one joke) ---------- */
  var RFP = {
    id: 'RFP-047',
    title: 'QUARRY BREACH CHARGE',
    form: 'FORM RD-1147-A',
    craterMin: 18,          // metres — Halloran scaling (invented)
    craterMax: 24,
    budget: 2400,           // $ parts budget, hard cap
    tSpec: 5.0,             // detonate at T+5.0 s
    tTol: 0.4,              // ± allowed
    payout: 6000,
    bonusClean: 500,
    camera: { id: 'STATION 7', km: 1.6, secPerKm: 3.0 }   // fictional sound speed
  };
  RFP.soundDelay = Math.round(RFP.camera.km * RFP.camera.secPerKm * 10) / 10; // 4.8 s

  /* ---------- PARTS CATALOG ---------- */
  var CASINGS = {
    compact:  { id: 'compact',  name: 'COMPACT CASING',  slots: 2, cost: 300, w: 12,
                stab: 0.55, blurb: 'Two canister bays. Travels light, complains under load.' },
    standard: { id: 'standard', name: 'STANDARD CASING', slots: 4, cost: 450, w: 20,
                stab: 0.80, blurb: 'Four bays. The sensible one. Nobody was ever fired for it.' },
    heavy:    { id: 'heavy',    name: 'HEAVY CASING',    slots: 6, cost: 650, w: 30,
                stab: 1.01, blurb: 'Six bays and the patience of a bank vault.' }
  };
  var COMPOUNDS = {
    am4: { id: 'am4', name: 'AMMONITE-4', energy: 9, cost: 180, w: 6, hue: 'amber',
           blurb: 'More bang, less patience. Dislikes cramped housing.' },
    crx: { id: 'crx', name: 'CERULEX',    energy: 5, cost: 120, w: 6, hue: 'blue',
           blurb: 'Calm as a filing cabinet, and nearly as energetic.' }
  };
  var PARTS = {
    timer:   { id: 'timer',   name: 'CHRONEX TIMER',    cost: 260, w: 2,   blurb: 'Counts to five. The whole job, really.' },
    battery: { id: 'battery', name: 'BATTERY PACK',     cost: 140, w: 4,   blurb: 'Angry electrons, boxed.' },
    cap:     { id: 'cap',     name: 'DETONATOR WELL CAP', cost: 90, w: 1,  blurb: 'Keeps the desert out of the important hole.' },
    fins:    { id: 'fins',    name: 'STABILIZER FINS',  cost: 60,  w: 2,   blurb: 'Aerodynamically decorative. The device never flies.' },
    panel:   { id: 'panel',   name: 'ARMING SWITCH PANEL', cost: 110, w: 1, blurb: 'One switch, one guard cover, zero excuses.' }
  };

  /* Halloran's crater-scaling law (invented): D = K * Y^P */
  var CR_K = 6.2, CR_P = 0.36;
  var CRATER_NOISE = 0.05;          // relative sigma, clean build
  var SLAM_THRESHOLD = 0.55;        // detonator handling shock, normalized
  var WIRES = ['red', 'yellow', 'green'];
  var WIRE_ROLE = { red: 'bat', yellow: 'tmr', green: 'gnd' };
  var ROLE_LABEL = { bat: 'BAT +', tmr: 'TMR', gnd: 'GND' };
  var WIRE_NAME = { red: 'red battery wire', yellow: 'yellow timer wire', green: 'green ground wire' };

  /* ---------- SEEDED RNG (kept from v1) ---------- */
  function xmur3(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function stream(seed, name) {
    return mulberry32(xmur3(String(seed) + '::' + name)());
  }
  function gauss(rng) {
    var u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function makeSeed(rng) {
    var A = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
    var r = rng || Math.random, s = '';
    for (var i = 0; i < 5; i++) s += A[Math.floor(r() * A.length)];
    return s;
  }

  /* ---------- PANEL LAYOUT (terminal roles shuffled per seed) ---------- */
  function panelLayout(seed) {
    var roles = ['bat', 'tmr', 'gnd'];
    var r = stream(seed, 'panel');
    for (var i = roles.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = roles[i]; roles[i] = roles[j]; roles[j] = t;
    }
    // terminals T1,T2,T3 top→bottom; each carries a role label
    return { T1: roles[0], T2: roles[1], T3: roles[2] };
  }
  function roleOf(seed, term) { return term ? panelLayout(seed)[term] : null; }
  function termLabel(seed, term) { return term + ' · ' + ROLE_LABEL[panelLayout(seed)[term]]; }

  /* ---------- ASSEMBLY STATE (what the player physically did) ---------- */
  function makeAssembly() {
    return {
      casing: null,                      // 'compact' | 'standard' | 'heavy'
      canisters: [],                     // per slot: 'am4' | 'crx' | null
      timer: false, battery: false, cap: false, fins: false, panel: false,
      wires: { red: null, yellow: null, green: null },   // → 'T1'|'T2'|'T3'|null
      torques: { red: false, yellow: false, green: false },
      det: { seated: false, slam: 0 },   // slam: normalized worst handling jolt 0..1
      armed: false
    };
  }

  /* ---------- DERIVE (live HUD: crater band, weight, cost) ---------- */
  function derive(a) {
    var cas = a.casing ? CASINGS[a.casing] : null;
    var cost = 0, weight = 0, Y = 0, amCount = 0, filled = 0;
    if (cas) { cost += cas.cost; weight += cas.w; }
    (a.canisters || []).forEach(function (c) {
      if (!c) return;
      filled++;
      cost += COMPOUNDS[c].cost; weight += COMPOUNDS[c].w;
      Y += COMPOUNDS[c].energy;
      if (c === 'am4') amCount++;
    });
    ['timer', 'battery', 'cap', 'fins', 'panel'].forEach(function (k) {
      if (a[k]) { cost += PARTS[k].cost; weight += PARTS[k].w; }
    });
    var craterMean = filled > 0 ? CR_K * Math.pow(Y, CR_P) : 0;
    var amFrac = filled > 0 ? amCount / filled : 0;
    // instability: Ammonite loaded past the casing's stability allowance
    var severity = cas ? clamp((amFrac - cas.stab) * 2.2, 0, 1) : 0;
    var spread = CRATER_NOISE * 1.28 + severity * 0.16;
    var missing = [];
    if (!a.casing) missing.push('casing');
    if (filled === 0) missing.push('fill');
    if (!a.timer) missing.push('timer');
    if (!a.battery) missing.push('battery');
    if (!a.cap) missing.push('cap');
    if (!a.panel) missing.push('panel');
    return {
      cost: cost, weight: weight, yieldBd: Y,
      slots: cas ? cas.slots : 0, filled: filled, amFrac: amFrac,
      craterMean: craterMean,
      bandLo: craterMean * (1 - spread),
      bandHi: craterMean * (1 + spread),
      severity: severity,
      missing: missing,
      complete: missing.length === 0,
      overBudget: cost > RFP.budget
    };
  }

  /* ---------- WIRING ANALYSIS ---------- */
  function wireFaults(a, seed) {
    var faults = [];
    WIRES.forEach(function (w) {
      var term = a.wires[w];
      if (!term) faults.push({ wire: w, kind: 'unattached' });
      else if (roleOf(seed, term) !== WIRE_ROLE[w]) faults.push({ wire: w, kind: 'crossed', term: term });
    });
    return faults;
  }
  function looseTerminals(a) {
    return WIRES.filter(function (w) { return a.wires[w] && !a.torques[w]; });
  }

  /* ---------- RESOLVE: assembly + seed → outcome ---------- */
  function resolve(a, seed) {
    var d = derive(a);
    var o = {
      type: 'clean', fired: false,
      detT: null,               // seconds relative to T-0 (0 = on cue)
      craterActual: null,
      quality: null,            // 'clean' | 'ragged' | 'low-order' | 'partial'
      pEarly: a.det.slam > SLAM_THRESHOLD ? clamp((a.det.slam - SLAM_THRESHOLD) * 1.3, 0, 0.65) : 0,
      slammed: a.det.slam > SLAM_THRESHOLD,
      rootCause: null, d: d, seed: seed
    };
    var craterNoise = gauss(stream(seed, 'crater'));
    var timerNoise = gauss(stream(seed, 'timer'));

    /* 1 — Never armed: the funniest dud. Nothing else can happen without power. */
    if (!a.armed) {
      o.type = 'unarmed';
      o.rootCause = {
        title: 'DUD — DEVICE NEVER ARMED',
        cause: 'T+5.0 came and went. The device listened politely to the entire countdown and did nothing. Post-test inspection found the arming switch in the position marked SAFE, which is, to its credit, exactly what the placard promises.',
        receipt: 'Root cause: arming switch never thrown — arming station, Assembly Bay.',
        where: 'ARMING STATION'
      };
      return o;
    }

    /* 2 — Shock-sensitized detonator: chance of an off-cue pop once energized. */
    if (o.pEarly > 0 && stream(seed, 'early')() < o.pEarly) {
      o.type = 'early';
      o.fired = true;
      o.detT = -(0.6 + stream(seed, 'earlyT')() * 3.0);            // T−0.6 … T−3.6
      o.craterActual = d.craterMean * (1 + craterNoise * (CRATER_NOISE + d.severity * 0.16)) * 0.96;
      o.quality = d.severity > 0.15 ? 'ragged' : 'clean';
      o.rootCause = {
        title: 'OFF-CUE DETONATION — T−' + Math.abs(o.detT).toFixed(1) + ' s',
        cause: 'The detonator functioned before it was told to. The handling log shows a shock impulse of ' +
          (a.det.slam * 9.8).toFixed(1) + ' brandt recorded at seating — a detonator remembers being slammed the way a cat remembers a bath.',
        receipt: 'Root cause: detonator seated with a recorded shock impulse — detonator insertion, Assembly Bay. Slow is smooth.',
        where: 'DETONATOR INSERTION'
      };
      return o;
    }

    /* 3 — Wiring faults, checked in circuit order: power, then command, then return. */
    var faults = wireFaults(a, seed);
    var f = faults.filter(function (x) { return x.wire === 'red'; })[0] ||
            faults.filter(function (x) { return x.wire === 'yellow'; })[0];
    if (f) {
      // power or fire-command never completes: NO-FIRE at T+5
      o.type = 'nofire';
      var what = f.wire === 'red' ? 'Battery power never reached the firing circuit.'
                                  : 'The fire command left the timer and arrived nowhere in particular.';
      var landed = f.kind === 'unattached'
        ? WIRE_NAME[f.wire] + ' was never landed on a terminal'
        : WIRE_NAME[f.wire] + ' landed on Terminal ' + f.term.slice(1) + ' (' + ROLE_LABEL[roleOf(seed, f.term)] + ')';
      o.rootCause = {
        title: 'NO-FIRE AT T+5.0',
        cause: what + ' The device held its charge and its opinion.',
        receipt: 'Root cause: ' + landed + ' — wiring, Assembly Bay.',
        where: 'WIRING'
      };
      return o;
    }
    var g = faults.filter(function (x) { return x.wire === 'green'; })[0];
    if (g) {
      // floating ground return: MISFIRE — fires off-time and starved
      o.type = 'misfire';
      o.fired = true;
      var sign = stream(seed, 'misfireSign')() < 0.5 ? -1 : 1;
      o.detT = sign * (1.2 + stream(seed, 'misfireT')() * 1.8);    // ±1.2 … ±3.0 s off cue
      o.craterActual = d.craterMean * 0.55 * (1 + craterNoise * CRATER_NOISE);
      o.quality = 'partial';
      var landedG = g.kind === 'unattached'
        ? WIRE_NAME.green + ' was never landed on a terminal'
        : WIRE_NAME.green + ' landed on Terminal ' + g.term.slice(1) + ' (' + ROLE_LABEL[roleOf(seed, g.term)] + ')';
      o.rootCause = {
        title: 'MISFIRE — DETONATION OFF-CUE',
        cause: 'With no ground return, the firing circuit found its own way home — ' +
          (o.detT < 0 ? Math.abs(o.detT).toFixed(1) + ' seconds early' : o.detT.toFixed(1) + ' seconds late') +
          ' and at a fraction of its manners.',
        receipt: 'Root cause: ' + landedG + ' — wiring, Assembly Bay.',
        where: 'WIRING'
      };
      return o;
    }

    /* 4 — Loose terminal: intermittent contact starves the train. FIZZLE. */
    var loose = looseTerminals(a);
    if (loose.length > 0) {
      o.type = 'fizzle';
      o.fired = true;
      o.detT = timerNoise * 0.12;
      o.craterActual = d.craterMean * 0.30 * (1 + craterNoise * CRATER_NOISE);
      o.quality = 'low-order';
      var w0 = loose[0];
      o.rootCause = {
        title: 'LOW-ORDER DETONATION (FIZZLE)',
        cause: 'Intermittent contact at Terminal ' + a.wires[w0].slice(1) + ' starved the detonation train. The fill deflagrated — a long, smoky sigh where a bang was contracted.',
        receipt: 'Root cause: ' + WIRE_NAME[w0] + ' landed on Terminal ' + a.wires[w0].slice(1) +
          ' but never torqued — terminal close-out, Assembly Bay. The ratchet was right there.',
        where: 'CLOSE-OUT'
      };
      return o;
    }

    /* 5 — Clean circuit. Chemistry decides the character of the blast. */
    o.fired = true;
    o.detT = timerNoise * 0.06;
    var spread = CRATER_NOISE + d.severity * 0.16;
    o.craterActual = d.craterMean * (1 + craterNoise * spread);
    if (d.severity > 0.15) {
      o.type = 'ragged';
      o.quality = 'ragged';
      o.rootCause = {
        title: 'RAGGED DETONATION',
        cause: 'Ammonite-4 loaded past the ' + CASINGS[a.casing].name.toLowerCase() +
          '’s stability allowance (' + Math.round(d.amFrac * 100) + '% hot fill vs ' +
          Math.round(CASINGS[a.casing].stab * 100) + '% rated). The blast came out sideways, in installments.',
        receipt: 'Root cause: fill loadout — canister bays, Assembly Bay. Ammonite-4 wants room.',
        where: 'LOADOUT'
      };
    } else {
      o.type = 'clean';
      o.quality = 'clean';
      var inBand = o.craterActual >= RFP.craterMin && o.craterActual <= RFP.craterMax;
      if (!inBand) {
        var small = o.craterActual < RFP.craterMin;
        o.rootCause = {
          title: small ? 'EFFECT BELOW SPECIFICATION' : 'EFFECT ABOVE SPECIFICATION',
          cause: 'Textbook detonation, wrong size: ' + o.craterActual.toFixed(1) + ' m against the ' +
            RFP.craterMin + '–' + RFP.craterMax + ' m band. ' +
            (small ? 'The quarry face barely noticed.' : 'The quarry wanted a door, not a lake.'),
          receipt: 'Root cause: fill loadout — ' + describeLoad(a) + ' predicted ' +
            d.craterMean.toFixed(1) + ' m — canister bays, Assembly Bay.',
          where: 'LOADOUT'
        };
      }
    }
    return o;
  }

  function describeLoad(a) {
    var am = 0, cx = 0;
    (a.canisters || []).forEach(function (c) { if (c === 'am4') am++; else if (c === 'crx') cx++; });
    var parts = [];
    if (am) parts.push(am + '× Ammonite-4');
    if (cx) parts.push(cx + '× Cerulex');
    if (!parts.length) parts.push('an empty rack');
    return parts.join(' + ') + ' in a ' + (a.casing ? CASINGS[a.casing].name.toLowerCase() : 'missing casing');
  }

  /* ---------- VISUAL PARAMETERS (drives Station 7 footage) ---------- */
  function visualFor(o) {
    var d = o.d;
    var yield01 = clamp(d.yieldBd / 54, 0, 1);
    return {
      fired: o.fired,
      detT: o.detT,
      yield01: yield01,
      bright: o.fired ? (o.type === 'fizzle' ? 0.3 : 0.55 + yield01 * 0.45) : 0,
      ragged: o.quality === 'ragged' ? clamp(0.35 + d.severity * 0.65, 0, 1) : (o.type === 'misfire' ? 0.5 : 0),
      fizzle: o.type === 'fizzle',
      dud: !o.fired,
      dust: o.fired ? clamp((o.craterActual || 8) / 24, 0.15, 1.25) : 0.05,
      crater: o.craterActual || 0,
      soundDelay: RFP.soundDelay
    };
  }

  /* ---------- VANTAGE DYNAMICS (one-line trade-paper clipping) ---------- */
  var VANTAGE_FAILS = [
    { h: 'VANTAGE TEST ARTICLE DEPARTS CRANE, BEGINS NEW CAREER AS PLOW', s: 'Handling procedures “under review”; sand “mostly recovered”.' },
    { h: 'VANTAGE “SMARTFUZE” COUNTS DOWN, RECONSIDERS', s: 'Device reportedly “needs space”. Board waits 40 minutes in the sun.' },
    { h: 'VANTAGE DEMONSTRATION SCATTERS OWN LUNCH TENT', s: 'Caterer demands danger pay; potato salad declared total loss.' },
    { h: 'VANTAGE CHARGE FIRES 6.2 SECONDS EARLY; BOARD’S COFFEE UNRECOVERABLE', s: 'Company statement blames “an ambitious capacitor”.' }
  ];
  function simVantage(seed) {
    var r = stream(seed, 'vantage');
    var fail = r() < 0.45;
    if (fail) {
      var pick = VANTAGE_FAILS[Math.floor(r() * VANTAGE_FAILS.length) % VANTAGE_FAILS.length];
      return { ok: false, headline: pick.h, sub: pick.s };
    }
    var crater = 19.5 + gauss(r) * 2.2;
    var inBand = crater >= RFP.craterMin && crater <= RFP.craterMax;
    return {
      ok: inBand,
      crater: crater,
      headline: inBand
        ? 'VANTAGE POSTS ' + crater.toFixed(1) + ' m, ON CUE; VP CALLS RESULT “FRANKLY INEVITABLE”'
        : 'VANTAGE CRATER MEASURES ' + crater.toFixed(1) + ' m; SPEC BAND UNMOVED BY BROCHURE',
      sub: inBand
        ? '“We consider this procurement a formality.” — R. Cavendish Vane, VP of Client Triumph'
        : 'Vantage attributes variance to “atmospheric conditions of a proprietary nature”.'
    };
  }

  /* ---------- ADJUDICATE: outcome → scorecard ---------- */
  function adjudicate(a, seed) {
    var o = resolve(a, seed);
    var d = o.d;
    var v = simVantage(seed);
    var vis = visualFor(o);

    var sizeOk = o.fired && o.craterActual != null &&
                 o.craterActual >= RFP.craterMin && o.craterActual <= RFP.craterMax;
    var timingOk = o.fired && o.detT != null && Math.abs(o.detT) <= RFP.tTol;
    var cleanOk = o.fired && o.quality === 'clean';

    var stamps = {
      size:   { ok: sizeOk,   value: o.craterActual != null ? o.craterActual.toFixed(1) + ' m' : 'NO CRATER',
                spec: RFP.craterMin + '–' + RFP.craterMax + ' m' },
      timing: { ok: timingOk, value: o.fired && o.detT != null
                  ? (o.detT < 0 ? 'T+' + (RFP.tSpec + o.detT).toFixed(2) + ' s' : 'T+' + (RFP.tSpec + o.detT).toFixed(2) + ' s')
                  : 'NO EVENT',
                spec: 'T+' + RFP.tSpec.toFixed(1) + ' s ±' + RFP.tTol },
      clean:  { ok: cleanOk,  value: !o.fired ? '—'
                  : o.quality === 'clean' ? 'TEXTBOOK'
                  : o.quality === 'ragged' ? 'RAGGED'
                  : o.quality === 'low-order' ? 'LOW-ORDER' : 'PARTIAL',
                spec: 'HIGH-ORDER, SYMMETRIC' }
    };

    var win = sizeOk && timingOk;
    var award = win ? RFP.payout : 0;
    var bonus = (win && cleanOk) ? RFP.bonusClean : 0;
    var net = award + bonus - d.cost;
    var stars = (sizeOk ? 1 : 0) + (timingOk ? 1 : 0) + (cleanOk ? 1 : 0);

    var incident = null;
    if (!win) {
      var rc = o.rootCause || {
        title: 'RESULT OUTSIDE SPECIFICATION',
        cause: 'The graph and the contract disagreed.',
        receipt: 'Root cause: see attached telemetry — Assembly Bay.',
        where: 'ASSEMBLY BAY'
      };
      incident = {
        form: 'FORM IR-3 (REV. 12)',
        series: 'TEST SERIES ' + seed,
        outcome: rc.title,
        cause: rc.cause,
        receipt: rc.receipt,
        where: rc.where,
        disposition: v.ok
          ? 'Contract awarded to Vantage Dynamics. Contractor invited to resubmit next cycle. Catering invoice enclosed.'
          : 'Contract WITHDRAWN pending review of, frankly, everybody. Range remains closed for sweeping.'
      };
    }

    return {
      outcome: o, visual: vis, stamps: stamps,
      win: win, stars: stars,
      payout: { award: award, bonus: bonus, cost: d.cost, net: net },
      vantage: v, incident: incident, seed: seed
    };
  }

  /* ---------- canned assemblies (harness + tests) ---------- */
  function cannedClean(seed) {
    var a = makeAssembly();
    a.casing = 'standard';
    a.canisters = ['am4', 'am4', 'am4', 'crx'];
    a.timer = a.battery = a.cap = a.panel = true;
    a.fins = true;
    var lay = panelLayout(seed);
    var byRole = {};
    Object.keys(lay).forEach(function (t) { byRole[lay[t]] = t; });
    a.wires = { red: byRole.bat, yellow: byRole.tmr, green: byRole.gnd };
    a.torques = { red: true, yellow: true, green: true };
    a.det = { seated: true, slam: 0.1 };
    a.armed = true;
    return a;
  }

  return {
    RFP: RFP, CASINGS: CASINGS, COMPOUNDS: COMPOUNDS, PARTS: PARTS,
    WIRES: WIRES, WIRE_ROLE: WIRE_ROLE, ROLE_LABEL: ROLE_LABEL, WIRE_NAME: WIRE_NAME,
    SLAM_THRESHOLD: SLAM_THRESHOLD,
    stream: stream, gauss: gauss, clamp: clamp, makeSeed: makeSeed,
    panelLayout: panelLayout, roleOf: roleOf, termLabel: termLabel,
    makeAssembly: makeAssembly, derive: derive, describeLoad: describeLoad,
    wireFaults: wireFaults, looseTerminals: looseTerminals,
    resolve: resolve, visualFor: visualFor, simVantage: simVantage, adjudicate: adjudicate,
    cannedClean: cannedClean
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PG2;
