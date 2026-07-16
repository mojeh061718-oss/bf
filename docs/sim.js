/* ============================================================
   PROVING GROUNDS v2 — sim.js
   Headless, deterministic assembly-state → outcome resolver.
   ALL SCIENCE HEREIN IS INVENTED. Compounds, shells, constants
   and scaling laws are fictional (Halloran crater scaling,
   Brandt yield units). What is real is *consequence*: the
   outcome is computed from what the player physically did.
   DOM-free. Importable in node:  const PG2 = require('./sim.js')
   ============================================================ */
'use strict';

var PG2 = (function () {

  /* ---------- THE CONTRACTS (three numbers, one joke, each) ---------- */
  var CONTRACTS = [
    {
      idx: 0,
      id: 'RFP-041',
      title: 'QUARRY BREACH CHARGE',
      form: 'FORM RD-1147-A',
      craterMin: 20, craterMax: 24,     // metres — Halloran scaling (invented)
      budget: 2400,
      tSpec: 5.0, tTol: 0.4,
      payout: 6000, bonusClean: 500,
      meterMax: 30,
      timeOfDay: 'dawn',                // range-day palette (presentation only)
      clause: 'The device shall be assembled BY HAND, by the contractor, who shall afterwards sign something.',
      needsRefinery: false
    },
    {
      idx: 1,
      id: 'RFP-048',
      title: 'DOUBLE-WIDE QUARRY GATE',
      form: 'FORM RD-1147-B',
      craterMin: 34, craterMax: 42,
      budget: 3000,
      tSpec: 5.0, tTol: 0.4,
      payout: 12000, bonusClean: 1000,
      meterMax: 50,
      timeOfDay: 'noon',                // range-day palette (presentation only)
      clause: 'Raw EMBER will not do. The Authority suggests, without legally suggesting anything, that the contractor owns a refinery.',
      needsRefinery: true
    }
  ];
  var CAMERA = { id: 'STATION 7', km: 1.6, secPerKm: 3.0 };   // fictional sound speed
  var SOUND_DELAY = Math.round(CAMERA.km * CAMERA.secPerKm * 10) / 10; // 4.8 s

  /* ---------- PARTS CATALOG (friendly names) ---------- */
  var SHELLS = {
    compact:  { id: 'compact',  name: 'SMALL SHELL',    slots: 2, cost: 300, w: 12,
                stab: 0.55, blurb: 'Two canister bays. Cheap, cosy, easily overwhelmed.' },
    standard: { id: 'standard', name: 'STANDARD SHELL', slots: 4, cost: 450, w: 20,
                stab: 0.80, blurb: 'Four bays. The sensible one.' },
    heavy:    { id: 'heavy',    name: 'BIG SHELL',      slots: 6, cost: 650, w: 30,
                stab: 1.01, blurb: 'Six bays and the patience of a bank vault.' }
  };
  var COMPOUNDS = {
    ember:   { id: 'ember',   name: 'EMBER',    energy: 10,  cost: 180, w: 6, heat: 1.0,  hue: 'amber',
               blurb: 'More bang, less patience. Wants room.' },
    frost:   { id: 'frost',   name: 'FROST',    energy: 3.5, cost: 120, w: 6, heat: 0,    hue: 'blue',
               blurb: 'Calm, steady, quietly judging the EMBER.' },
    emberx:  { id: 'emberx',  name: 'EMBER-X',  energy: 26,  cost: 0,   w: 6, heat: 1.25, hue: 'hot',
               blurb: 'Refined in your own still. Brighter, bigger, twitchier.' },
    emberxs: { id: 'emberxs', name: 'SCORCHED X', energy: 20, cost: 0,  w: 6, heat: 1.35, hue: 'scorched',
               blurb: 'A refinery batch that got away from you. Weaker AND angrier.' }
  };
  var PARTS = {
    timer:   { id: 'timer',   name: 'TIMER',       cost: 260, w: 2,  blurb: 'Counts to five. The whole job, really.' },
    battery: { id: 'battery', name: 'BATTERY',     cost: 140, w: 4,  blurb: 'Angry electrons, boxed.' },
    cap:     { id: 'cap',     name: 'WELL CAP',    cost: 90,  w: 1,  blurb: 'Keeps the desert out of the important hole.' },
    fins:    { id: 'fins',    name: 'FINS',        cost: 60,  w: 2,  blurb: 'Pure style. The device never flies.' },
    panel:   { id: 'panel',   name: 'ARM SWITCH',  cost: 110, w: 1,  blurb: 'One switch, one guard cover, zero excuses.' }
  };

  /* ---------- REFINERY ---------- */
  var REFINERY = {
    batchCost: 300,       // $ per run of the still
    batchYield: 2,        // canisters per run
    holdSeconds: 8,       // time-in-band required
    scorchLimit: 2.0      // seconds spent too hot before the batch scorches
  };

  /* Halloran's crater-scaling law (invented): D = K * Y^P */
  var CR_K = 6.2, CR_P = 0.36;
  var CRATER_NOISE = 0.05;          // relative sigma, clean build
  var SLAM_THRESHOLD = 0.55;        // detonator handling shock, normalized
  var WIRES = ['red', 'yellow', 'green'];
  var WIRE_ROLE = { red: 'bat', yellow: 'tmr', green: 'gnd' };
  var ROLE_LABEL = { bat: 'BATTERY', tmr: 'TIMER', gnd: 'GROUND' };
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
    return { T1: roles[0], T2: roles[1], T3: roles[2] };
  }
  function roleOf(seed, term) { return term ? panelLayout(seed)[term] : null; }

  /* ---------- ASSEMBLY STATE (what the player physically did) ---------- */
  function makeAssembly() {
    return {
      shell: null,                       // 'compact' | 'standard' | 'heavy'
      canisters: [],                     // per bay: compound id | null
      timer: false, battery: false, cap: false, fins: false, panel: false,
      refine: { spend: 0, stock: { emberx: 0, emberxs: 0 } },
      wires: { red: null, yellow: null, green: null },   // → 'T1'|'T2'|'T3'|null
      torques: { red: false, yellow: false, green: false },
      det: { seated: false, slam: 0 },   // slam: normalized worst handling jolt 0..1
      armed: false
    };
  }

  /* ---------- DERIVE (live HUD: crater band, weight, cost) ---------- */
  function derive(a, rfp) {
    rfp = rfp || CONTRACTS[0];
    var sh = a.shell ? SHELLS[a.shell] : null;
    var cost = 0, weight = 0, Y = 0, heat = 0, filled = 0;
    if (sh) { cost += sh.cost; weight += sh.w; }
    (a.canisters || []).forEach(function (c) {
      if (!c) return;
      filled++;
      cost += COMPOUNDS[c].cost; weight += COMPOUNDS[c].w;
      Y += COMPOUNDS[c].energy;
      heat += COMPOUNDS[c].heat;
    });
    if (a.refine) cost += a.refine.spend;
    ['timer', 'battery', 'cap', 'fins', 'panel'].forEach(function (k) {
      if (a[k]) { cost += PARTS[k].cost; weight += PARTS[k].w; }
    });
    var craterMean = filled > 0 ? CR_K * Math.pow(Y, CR_P) : 0;
    // instability: hot compounds loaded past the shell's calm allowance
    var hotFrac = sh ? heat / sh.slots : 0;
    var severity = sh ? clamp((hotFrac - sh.stab) * 2.2, 0, 1) : 0;
    // HUD estimate is deliberately rough — the range decides
    var spread = 0.13 + severity * 0.15;
    var missing = [];
    if (!a.shell) missing.push('shell');
    if (filled === 0) missing.push('canisters');
    if (!a.timer) missing.push('timer');
    if (!a.battery) missing.push('battery');
    if (!a.cap) missing.push('well cap');
    if (!a.panel) missing.push('arm switch');
    return {
      cost: cost, weight: weight, yieldBd: Y,
      slots: sh ? sh.slots : 0, filled: filled, hotFrac: hotFrac,
      craterMean: craterMean,
      bandLo: craterMean * (1 - spread),
      bandHi: craterMean * (1 + spread),
      severity: severity,
      missing: missing,
      complete: missing.length === 0,
      overBudget: cost > rfp.budget
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

  function describeLoad(a) {
    var counts = {};
    (a.canisters || []).forEach(function (c) { if (c) counts[c] = (counts[c] || 0) + 1; });
    var parts = Object.keys(counts).map(function (k) { return counts[k] + '× ' + COMPOUNDS[k].name; });
    if (!parts.length) parts.push('an empty rack');
    return parts.join(' + ') + ' in a ' + (a.shell ? SHELLS[a.shell].name.toLowerCase() : 'missing shell');
  }

  /* ---------- RESOLVE: assembly + seed (+ contract) → outcome ---------- */
  function resolve(a, seed, rfp) {
    rfp = rfp || CONTRACTS[0];
    var d = derive(a, rfp);
    var o = {
      type: 'clean', fired: false,
      detT: null,               // seconds relative to T-0 (0 = on cue)
      craterActual: null,
      quality: null,            // 'clean' | 'ragged' | 'low-order' | 'partial'
      pEarly: a.det.slam > SLAM_THRESHOLD ? clamp((a.det.slam - SLAM_THRESHOLD) * 1.3, 0, 0.65) : 0,
      slammed: a.det.slam > SLAM_THRESHOLD,
      rootCause: null, hint: null, d: d, seed: seed, rfp: rfp
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
      o.hint = 'It never went off — the arm switch was still on SAFE. Flip it before you truck out.';
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
      o.hint = 'It went off early. Seat the detonator slowly and gently — it remembers.';
      return o;
    }

    /* 3 — Wiring faults, checked in circuit order: power, then command, then return. */
    var faults = wireFaults(a, seed);
    var f = faults.filter(function (x) { return x.wire === 'red'; })[0] ||
            faults.filter(function (x) { return x.wire === 'yellow'; })[0];
    if (f) {
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
      o.hint = 'It never went off. Check the ' + f.wire + ' wire.';
      return o;
    }
    var g = faults.filter(function (x) { return x.wire === 'green'; })[0];
    if (g) {
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
      o.hint = 'It fired off-cue and weak. Check the green wire.';
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
        cause: 'Intermittent contact at Terminal ' + a.wires[w0].slice(1) + ' starved the firing train. The fill deflagrated — a long, smoky sigh where a bang was contracted.',
        receipt: 'Root cause: ' + WIRE_NAME[w0] + ' landed on Terminal ' + a.wires[w0].slice(1) +
          ' but never torqued — terminal close-out, Assembly Bay. The ratchet was right there.',
        where: 'CLOSE-OUT'
      };
      o.hint = 'A smoky fizzle — a terminal was left loose. Twist every terminal down tight.';
      return o;
    }

    /* 5 — Clean circuit. Chemistry decides the character of the blast. */
    o.fired = true;
    o.detT = timerNoise * 0.06;
    var spread = CRATER_NOISE + d.severity * 0.16;
    o.craterActual = d.craterMean * (1 + craterNoise * spread);
    var inBand = o.craterActual >= rfp.craterMin && o.craterActual <= rfp.craterMax;
    if (d.severity > 0.15) {
      o.type = 'ragged';
      o.quality = 'ragged';
      o.rootCause = {
        title: 'RAGGED DETONATION',
        cause: 'Hot fill loaded past the ' + SHELLS[a.shell].name.toLowerCase() +
          '’s calm allowance (' + Math.round(d.hotFrac * 100) + '% hot vs ' +
          Math.round(SHELLS[a.shell].stab * 100) + '% rated). The blast came out sideways, in installments.',
        receipt: 'Root cause: fill loadout — canister bays, Assembly Bay. EMBER wants room.',
        where: 'LOADOUT'
      };
      o.hint = 'It blew ugly and lopsided. Hot canisters want room — a bigger shell, or swap some for FROST.';
    } else {
      o.type = 'clean';
      o.quality = 'clean';
      if (!inBand) {
        var small = o.craterActual < rfp.craterMin;
        var moreName = rfp.needsRefinery ? 'EMBER-X' : 'EMBER';
        o.rootCause = {
          title: small ? 'EFFECT BELOW SPECIFICATION' : 'EFFECT ABOVE SPECIFICATION',
          cause: 'Textbook detonation, wrong size: ' + o.craterActual.toFixed(1) + ' m against the ' +
            rfp.craterMin + '–' + rfp.craterMax + ' m band. ' +
            (small ? 'The quarry face barely noticed.' : 'The quarry wanted a door, not a lake.'),
          receipt: 'Root cause: fill loadout — ' + describeLoad(a) + ' predicted ' +
            d.craterMean.toFixed(1) + ' m — canister bays, Assembly Bay.',
          where: 'LOADOUT'
        };
        o.hint = small
          ? 'Crater ' + o.craterActual.toFixed(1) + ' m — too small. More ' + moreName + ', or a bigger shell?'
          : 'Crater ' + o.craterActual.toFixed(1) + ' m — too big. Ease off: swap some hot canisters for FROST.';
      } else {
        o.hint = 'Textbook. The graph agrees with you.';
      }
    }
    return o;
  }

  /* ---------- VISUAL PARAMETERS (drives Station 7 footage) ---------- */
  function visualFor(o) {
    var d = o.d;
    var yield01 = clamp(d.yieldBd / 150, 0, 1);
    return {
      fired: o.fired,
      detT: o.detT,
      yield01: yield01,
      bright: o.fired ? (o.type === 'fizzle' ? 0.3 : 0.55 + yield01 * 0.45) : 0,
      ragged: o.quality === 'ragged' ? clamp(0.35 + d.severity * 0.65, 0, 1) : (o.type === 'misfire' ? 0.5 : 0),
      fizzle: o.type === 'fizzle',
      dud: !o.fired,
      dust: o.fired ? clamp((o.craterActual || 8) / ((o.rfp && o.rfp.craterMax) || 24), 0.15, 1.25) : 0.05,
      crater: o.craterActual || 0,
      soundDelay: SOUND_DELAY
    };
  }

  /* ---------- VANTAGE DYNAMICS (one-line trade-paper clipping) ---------- */
  var VANTAGE_FAILS = [
    { h: 'VANTAGE TEST ARTICLE DEPARTS CRANE, BEGINS NEW CAREER AS PLOW', s: 'Handling procedures “under review”; sand “mostly recovered”.' },
    { h: 'VANTAGE “SMARTFUZE” COUNTS DOWN, RECONSIDERS', s: 'Device reportedly “needs space”. Board waits 40 minutes in the sun.' },
    { h: 'VANTAGE DEMONSTRATION SCATTERS OWN LUNCH TENT', s: 'Caterer demands danger pay; potato salad declared total loss.' },
    { h: 'VANTAGE CHARGE FIRES 6.2 SECONDS EARLY; BOARD’S COFFEE UNRECOVERABLE', s: 'Company statement blames “an ambitious capacitor”.' }
  ];
  function simVantage(seed, rfp) {
    rfp = rfp || CONTRACTS[0];
    var r = stream(seed, 'vantage');
    var fail = r() < 0.45;
    if (fail) {
      var pick = VANTAGE_FAILS[Math.floor(r() * VANTAGE_FAILS.length) % VANTAGE_FAILS.length];
      return { ok: false, headline: pick.h, sub: pick.s };
    }
    var mid = (rfp.craterMin + rfp.craterMax) / 2;
    var crater = mid * (0.94 + gauss(r) * 0.1);
    var inBand = crater >= rfp.craterMin && crater <= rfp.craterMax;
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
  function adjudicate(a, seed, rfp) {
    rfp = rfp || CONTRACTS[0];
    var o = resolve(a, seed, rfp);
    var d = o.d;
    var v = simVantage(seed, rfp);
    var vis = visualFor(o);

    var sizeOk = o.fired && o.craterActual != null &&
                 o.craterActual >= rfp.craterMin && o.craterActual <= rfp.craterMax;
    var timingOk = o.fired && o.detT != null && Math.abs(o.detT) <= rfp.tTol;
    var cleanOk = o.fired && o.quality === 'clean';

    var stamps = {
      size:   { ok: sizeOk,   value: o.craterActual != null ? o.craterActual.toFixed(1) + ' m' : 'NO CRATER',
                spec: rfp.craterMin + '–' + rfp.craterMax + ' m' },
      timing: { ok: timingOk, value: o.fired && o.detT != null
                  ? 'T+' + (rfp.tSpec + o.detT).toFixed(2) + ' s' : 'NO EVENT',
                spec: 'T+' + rfp.tSpec.toFixed(1) + ' s ±' + rfp.tTol },
      clean:  { ok: cleanOk,  value: !o.fired ? '—'
                  : o.quality === 'clean' ? 'TEXTBOOK'
                  : o.quality === 'ragged' ? 'RAGGED'
                  : o.quality === 'low-order' ? 'LOW-ORDER' : 'PARTIAL',
                spec: 'ONE BANG, ROUND CRATER' }
    };

    var win = sizeOk && timingOk;
    var award = win ? rfp.payout : 0;
    var bonus = (win && cleanOk) ? rfp.bonusClean : 0;
    var net = award + bonus - d.cost;
    var stars = (sizeOk ? 1 : 0) + (timingOk ? 1 : 0) + (cleanOk ? 1 : 0);

    var hint = o.hint;
    if (win && !cleanOk) hint = 'Contract won — but it blew ugly. ' + (o.hint || '');

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
      win: win, stars: stars, hint: hint,
      payout: { award: award, bonus: bonus, cost: d.cost, net: net },
      vantage: v, incident: incident, seed: seed, rfp: rfp
    };
  }

  /* ---------- canned assemblies (harness + tests) ---------- */
  function wireCorrect(a, seed) {
    var lay = panelLayout(seed);
    var byRole = {};
    Object.keys(lay).forEach(function (t) { byRole[lay[t]] = t; });
    a.wires = { red: byRole.bat, yellow: byRole.tmr, green: byRole.gnd };
    a.torques = { red: true, yellow: true, green: true };
    return a;
  }
  function cannedClean(seed) {
    var a = makeAssembly();
    a.shell = 'standard';
    a.canisters = ['ember', 'ember', 'ember', 'frost'];
    a.timer = a.battery = a.cap = a.panel = a.fins = true;
    wireCorrect(a, seed);
    a.det = { seated: true, slam: 0.1 };
    a.armed = true;
    return a;
  }
  function cannedClean2(seed) {
    // Contract 2 answer: big shell, five refined canisters + one FROST
    var a = makeAssembly();
    a.shell = 'heavy';
    a.canisters = ['emberx', 'emberx', 'emberx', 'emberx', 'emberx', 'frost'];
    a.refine = { spend: REFINERY.batchCost * 3, stock: { emberx: 1, emberxs: 0 } };
    a.timer = a.battery = a.cap = a.panel = a.fins = true;
    wireCorrect(a, seed);
    a.det = { seated: true, slam: 0.1 };
    a.armed = true;
    return a;
  }

  return {
    CONTRACTS: CONTRACTS, RFP: CONTRACTS[0], CAMERA: CAMERA, SOUND_DELAY: SOUND_DELAY,
    SHELLS: SHELLS, COMPOUNDS: COMPOUNDS, PARTS: PARTS, REFINERY: REFINERY,
    WIRES: WIRES, WIRE_ROLE: WIRE_ROLE, ROLE_LABEL: ROLE_LABEL, WIRE_NAME: WIRE_NAME,
    SLAM_THRESHOLD: SLAM_THRESHOLD,
    stream: stream, gauss: gauss, clamp: clamp, makeSeed: makeSeed,
    panelLayout: panelLayout, roleOf: roleOf,
    makeAssembly: makeAssembly, derive: derive, describeLoad: describeLoad,
    wireFaults: wireFaults, looseTerminals: looseTerminals,
    resolve: resolve, visualFor: visualFor, simVantage: simVantage, adjudicate: adjudicate,
    wireCorrect: wireCorrect, cannedClean: cannedClean, cannedClean2: cannedClean2
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PG2;
