/* ============================================================
   PROVING GROUNDS v2 — sim.js
   Headless, deterministic assembly-state → outcome resolver.
   ALL SCIENCE HEREIN IS INVENTED. Compounds, shells, constants
   and scaling laws are fictional (Halloran crater scaling,
   Brandt yield units). What is real is *consequence*: the
   outcome is computed from what the player physically did.
   DOM-free. Importable in node:  const PG2 = require('./sim.js')

   M2 — Act I complete: eight contracts, the TIMER DIAL
   (a.timerSet), PAYLOAD ARRANGEMENT (energy centre-of-mass →
   crater offset/ellipse), GLAZE (FROST-derivative stabilizer:
   calms hot loads, forgives rough seating, resists cook-off),
   contract heat waves (thermal cook-off), and the Act I boss —
   a seeded side-by-side FLY-OFF against Vantage Dynamics.
   ============================================================ */
'use strict';

var PG2 = (function () {

  /* ---------- THE CONTRACTS (three headline numbers, one joke, each) ----------
     Teaching ladder: loop → restraint → the Still → the dial →
     thermal thinking → arrangement → weight → the fly-off. */
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
      wind: { dir: 110, speed: 0.35 },  // presentation only
      clause: 'The device shall be assembled BY HAND, by the contractor, who shall afterwards sign something.',
      needsRefinery: false
    },
    {
      idx: 1,
      id: 'RFP-044',
      title: 'FIRECRACKER',
      form: 'FORM RD-1147-F',
      craterMin: 8, craterMax: 11,
      budget: 1150,
      tSpec: 5.0, tTol: 0.4,
      payout: 3600, bonusClean: 400,
      meterMax: 16,
      timeOfDay: 'noon',
      wind: { dir: 70, speed: 0.5 },
      clause: 'Sub-clause 3.1(f): the budget office has been sighted weeping. Bids exceeding the cap will be composted, respectfully.',
      clause2: '3.1(g): the Authority requires a SMALL hole. Enthusiasm shall be stored off-site.',
      needsRefinery: false
    },
    {
      idx: 2,
      id: 'RFP-048',
      title: 'DOUBLE-WIDE QUARRY GATE',
      form: 'FORM RD-1147-B',
      craterMin: 34, craterMax: 42,
      budget: 3000,
      tSpec: 5.0, tTol: 0.4,
      payout: 12000, bonusClean: 1000,
      meterMax: 50,
      timeOfDay: 'noon',
      wind: { dir: 200, speed: 0.7 },
      clause: 'Raw EMBER will not do. The Authority suggests, without legally suggesting anything, that the contractor owns a refinery.',
      needsRefinery: true
    },
    {
      idx: 3,
      id: 'RFP-052',
      title: 'EGG TIMER',
      form: 'FORM RD-1147-K',
      craterMin: 16, craterMax: 24,
      budget: 2600,
      tSpec: 7.5, tTol: 0.15,
      dial: true,                       // the player sets the timer BY HAND
      payout: 7000, bonusClean: 600,
      meterMax: 30,
      timeOfDay: 'dawn',
      wind: { dir: 330, speed: 0.3 },
      clause: 'The newsreel crew bills by the second and the second is T+7.50. "Thereabouts" is not a number, per Legal.',
      clause2: '9.2(a): factory timers arrive set to five seconds. The dial is on the timer. The vernier is on the dial. Good luck is not provided.',
      needsRefinery: false
    },
    {
      idx: 4,
      id: 'RFP-055',
      title: 'HOT PLATE',
      form: 'FORM RD-1147-H',
      craterMin: 20, craterMax: 26,
      budget: 2000,
      tSpec: 5.0, tTol: 0.4,
      heatMult: 1.6,                    // forecast: brutal. hot fill cooks off.
      payout: 8000, bonusClean: 700,
      meterMax: 30,
      timeOfDay: 'noon',
      wind: { dir: 150, speed: 0.12 },
      clause: 'Forecast for the pan: 47° in the shade, of which there is none. The Authority accepts no liability for what EMBER thinks about that.',
      clause2: '11.3(d): devices that fire without being asked will be billed as "unscheduled demonstrations".',
      needsRefinery: true
    },
    {
      idx: 5,
      id: 'RFP-057',
      title: 'SHAPED — WEST FACE ONLY',
      form: 'FORM RD-1147-S',
      craterMin: 15, craterMax: 22,
      budget: 2600,
      tSpec: 5.0, tTol: 0.4,
      offsetSpec: { min: 3, max: 7, dir: 'W' },   // crater centre must land west
      payout: 9000, bonusClean: 700,
      meterMax: 26,
      timeOfDay: 'dawn',
      wind: { dir: 90, speed: 0.5 },
      clause: 'Breach the WEST face only. The east face is load-bearing, historically significant, and owed money by the surveyor.',
      clause2: '6.7(b): the blast goes where the load sits. The Authority read that in a book and now so have you.',
      needsRefinery: false
    },
    {
      idx: 6,
      id: 'RFP-060',
      title: 'FEATHERWEIGHT',
      form: 'FORM RD-1147-W',
      craterMin: 28, craterMax: 36,
      budget: 3000,
      weightCap: 60,                    // kg, hard — the crane is on loan
      tSpec: 5.0, tTol: 0.4,
      payout: 11000, bonusClean: 900,
      meterMax: 42,
      timeOfDay: 'noon',
      wind: { dir: 250, speed: 0.8 },
      clause: 'The lifting crane is borrowed from the harbour board, who want it back UNBENT. Sixty kilograms. The scale does not negotiate.',
      needsRefinery: true
    },
    {
      idx: 7,
      id: 'RFP-063',
      title: 'THE FLY-OFF',
      form: 'FORM RD-1147-X',
      craterMin: 24, craterMax: 30,
      budget: 3200,
      tSpec: 6.0, tTol: 0.25,
      dial: true,
      flyoff: true,                     // side-by-side vs Vantage Dynamics
      payout: 15000, bonusClean: 1500,
      meterMax: 36,
      timeOfDay: 'dusk',
      wind: { dir: 20, speed: 0.45 },
      clause: 'SIDE-BY-SIDE DEMONSTRATION. Two pads, one contract, one column in the trade paper. Vantage Dynamics has filed, catered, and printed the commemorative pens.',
      clause2: '14.1(a): adjudication is line by line against the competing article. Ties go to the closer crater. Weeping is permitted after the board departs.',
      needsRefinery: true
    }
  ];
  var CONTRACT_BY_ID = {};
  CONTRACTS.forEach(function (c) { CONTRACT_BY_ID[c.id] = c; });

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
               blurb: 'A refinery batch that got away from you. Weaker AND angrier.' },
    glaze:   { id: 'glaze',   name: 'GLAZE',    energy: 2,   cost: 0,   w: 6, heat: -0.9, hue: 'glaze',
               blurb: 'FROST, poured slow over a line. Calms the load, forgives your hands, shrugs at the sun.' }
  };
  var PARTS = {
    timer:   { id: 'timer',   name: 'TIMER',       cost: 260, w: 2,  blurb: 'Counts to five. Unless you set the dial.' },
    battery: { id: 'battery', name: 'BATTERY',     cost: 140, w: 4,  blurb: 'Angry electrons, boxed.' },
    cap:     { id: 'cap',     name: 'WELL CAP',    cost: 90,  w: 1,  blurb: 'Keeps the desert out of the important hole.' },
    fins:    { id: 'fins',    name: 'FINS',        cost: 60,  w: 2,  blurb: 'Pure style. The device never flies.' },
    panel:   { id: 'panel',   name: 'ARM SWITCH',  cost: 110, w: 1,  blurb: 'One switch, one guard cover, zero excuses.' }
  };

  /* ---------- REFINERY ---------- */
  var REFINERY = {
    batchCost: 300,       // $ per run of the still (EMBER → EMBER-X)
    batchYield: 2,        // canisters per run
    holdSeconds: 8,       // time-in-band required
    scorchLimit: 2.0,     // seconds spent too hot before the batch scorches
    glazeCost: 220,       // $ per blend (FROST → GLAZE)
    glazeYield: 2,        // canisters per clean pour
    pourLo: 0.60,         // beaker target band (fraction of the line)
    pourHi: 0.72          // pour past this and the batch degrades
  };

  /* GLAZE effects (per canister aboard) */
  var GLAZE_SLAM_FORGIVE = 0.10;   // shaves recorded seating shock
  var GLAZE_COOK_SHIELD  = 0.10;   // extra cook-off resistance

  /* Halloran's crater-scaling law (invented): D = K * Y^P */
  var CR_K = 6.2, CR_P = 0.36;
  var CRATER_NOISE = 0.05;          // relative sigma, clean build
  var OFFSET_GAIN = 0.55;           // CoM lean → crater centre displacement
  var ELLIPSE_GAIN = 0.85;          // CoM lean → long-axis stretch
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
      timerSet: null,                    // seconds set on the dial; null = factory 5.0
      refine: { spend: 0, stock: { emberx: 0, emberxs: 0, glaze: 0 } },
      wires: { red: null, yellow: null, green: null },   // → 'T1'|'T2'|'T3'|null
      torques: { red: false, yellow: false, green: false },
      det: { seated: false, slam: 0 },   // slam: normalized worst handling jolt 0..1
      armed: false
    };
  }
  function timerSetOf(a) { return typeof a.timerSet === 'number' ? a.timerSet : 5.0; }
  function glazeCount(a) {
    var n = 0;
    (a.canisters || []).forEach(function (c) { if (c === 'glaze') n++; });
    return n;
  }

  /* ---------- CENTRE OF MASS (payload arrangement) ----------
     Bays sit along the shell axis; the blast centre follows the
     energy-weighted lean of the load. comX ∈ [-1, 1]; negative = WEST. */
  function comOf(a) {
    var cans = a.canisters || [];
    var n = cans.length;
    if (!n) return 0;
    var sumE = 0, mom = 0;
    for (var i = 0; i < n; i++) {
      var c = cans[i];
      if (!c) continue;
      var e = Math.max(COMPOUNDS[c].energy, 1);   // even GLAZE weighs on the lean
      var x = n === 1 ? 0 : -1 + 2 * i / (n - 1);
      sumE += e;
      mom += e * x;
    }
    return sumE > 0 ? mom / sumE : 0;
  }

  /* ---------- DERIVE (live HUD: crater band, weight, cost, lean) ---------- */
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
    // instability: hot compounds loaded past the shell's calm allowance.
    // GLAZE runs cold (negative heat); a contract heat wave multiplies the rest.
    var heatMult = rfp.heatMult || 1;
    var hotFrac = sh ? Math.max(heat, 0) / sh.slots : 0;
    var effHot = hotFrac * heatMult;
    var severity = sh ? clamp((effHot - sh.stab) * 2.2, 0, 1) : 0;
    var glazeN = glazeCount(a);
    var cookRisk = 0;
    if (sh && heatMult > 1) {
      cookRisk = clamp((effHot - sh.stab - 0.08 - GLAZE_COOK_SHIELD * glazeN) * 1.5, 0, 0.9);
    }
    var comX = comOf(a);
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
      effHot: effHot, cookRisk: cookRisk, glazeN: glazeN,
      comX: comX,
      offsetMean: comX * craterMean * OFFSET_GAIN,   // metres, negative = WEST
      craterMean: craterMean,
      bandLo: craterMean * (1 - spread),
      bandHi: craterMean * (1 + spread),
      severity: severity,
      missing: missing,
      complete: missing.length === 0,
      overBudget: cost > rfp.budget,
      overWeight: !!(rfp.weightCap && weight > rfp.weightCap)
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

  /* dispersion is a property of the ARTICLE as well as the day: a different
     build tumbles differently. Same build + same series = same result, but a
     tweak re-rolls the dispersion — convergence is always physically available. */
  function loadKey(a) {
    return (a.shell || '-') + '|' + (a.canisters || []).join(',');
  }

  /* crater geometry from a resolved lean */
  function applyLean(o, seed, d, a) {
    var r = gauss(stream(seed, 'lean:' + loadKey(a)));
    var comXa = clamp(d.comX + r * 0.03, -1, 1);
    o.comX = comXa;
    o.offsetM = o.craterActual != null ? comXa * o.craterActual * OFFSET_GAIN : 0;   // negative = WEST
    o.ellipse = 1 + Math.abs(comXa) * ELLIPSE_GAIN;
  }

  /* ---------- RESOLVE: assembly + seed (+ contract) → outcome ---------- */
  function resolve(a, seed, rfp) {
    rfp = rfp || CONTRACTS[0];
    var d = derive(a, rfp);
    var glazeN = d.glazeN;
    var effSlam = Math.max(0, a.det.slam - GLAZE_SLAM_FORGIVE * glazeN);
    var tSet = timerSetOf(a);
    var dialErr = tSet - rfp.tSpec;
    var o = {
      type: 'clean', fired: false,
      detT: null,               // seconds relative to the contract cue (0 = on cue)
      craterActual: null,
      quality: null,            // 'clean' | 'ragged' | 'low-order' | 'partial'
      pEarly: effSlam > SLAM_THRESHOLD ? clamp((effSlam - SLAM_THRESHOLD) * 1.3, 0, 0.65) : 0,
      slammed: a.det.slam > SLAM_THRESHOLD,
      timerSet: tSet, dialErr: dialErr,
      comX: 0, offsetM: 0, ellipse: 1,
      rootCause: null, hint: null, d: d, seed: seed, rfp: rfp
    };
    var craterNoise = gauss(stream(seed, 'crater:' + loadKey(a)));
    var timerNoise = gauss(stream(seed, 'timer'));

    /* 0 — Thermal cook-off: the sun does not read the paperwork. Hot-forecast
       contracts only; hot fill past the shell's rating can fire itself. */
    if (d.cookRisk > 0 && stream(seed, 'cookoff')() < d.cookRisk) {
      o.type = 'cookoff';
      o.fired = true;
      o.detT = -(1.2 + stream(seed, 'cookoffT')() * 2.6);
      o.craterActual = d.craterMean * 0.85 * (1 + craterNoise * (CRATER_NOISE + d.severity * 0.16));
      o.quality = 'ragged';
      applyLean(o, seed, d, a);
      o.rootCause = {
        title: 'THERMAL COOK-OFF — THE SUN FIRED FIRST',
        cause: 'At pan temperature the fill reached its own conclusion ' + Math.abs(o.detT).toFixed(1) +
          ' seconds before the cue. The load ran ' + Math.round(d.effHot * 100) +
          '% hot against the ' + SHELLS[a.shell].name.toLowerCase() + '’s ' +
          Math.round(SHELLS[a.shell].stab * 100) + '% rating under the forecast. Nobody threw a switch. Nobody had to.',
        receipt: 'Root cause: hot fill under a ' + Math.round((rfp.heatMult || 1) * 100) +
          '% heat forecast — canister bays, Assembly Bay. FROST or GLAZE buys shade.',
        where: 'LOADOUT'
      };
      o.hint = 'The heat cooked it off before the cue. Balance the load — swap EMBER for FROST or GLAZE from the still.';
      return o;
    }

    /* 1 — Never armed: the funniest dud. Nothing else can happen without power. */
    if (!a.armed) {
      o.type = 'unarmed';
      o.rootCause = {
        title: 'DUD — DEVICE NEVER ARMED',
        cause: 'T+' + rfp.tSpec.toFixed(1) + ' came and went. The device listened politely to the entire countdown and did nothing. Post-test inspection found the arming switch in the position marked SAFE, which is, to its credit, exactly what the placard promises.',
        receipt: 'Root cause: arming switch never thrown — arming station, Assembly Bay.',
        where: 'ARMING STATION'
      };
      o.hint = 'It never went off — the arm switch was still on SAFE. Flip it before you truck out.';
      return o;
    }

    /* 2 — Shock-sensitized detonator: chance of an off-cue pop once energized.
       GLAZE aboard pads the shock — the stabilizer forgives a firm hand. */
    if (o.pEarly > 0 && stream(seed, 'early')() < o.pEarly) {
      o.type = 'early';
      o.fired = true;
      o.detT = -(0.6 + stream(seed, 'earlyT')() * 3.0);            // cue−0.6 … cue−3.6
      o.craterActual = d.craterMean * (1 + craterNoise * (CRATER_NOISE + d.severity * 0.16)) * 0.96;
      o.quality = d.severity > 0.15 ? 'ragged' : 'clean';
      applyLean(o, seed, d, a);
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
        title: 'NO-FIRE AT T+' + rfp.tSpec.toFixed(1),
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
      applyLean(o, seed, d, a);
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
      o.detT = dialErr + timerNoise * 0.12;
      o.craterActual = d.craterMean * 0.30 * (1 + craterNoise * CRATER_NOISE);
      o.quality = 'low-order';
      applyLean(o, seed, d, a);
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

    /* 5 — Clean circuit. Chemistry (and the dial, and the lean) decide. */
    o.fired = true;
    o.detT = dialErr + timerNoise * 0.06;
    var spread = CRATER_NOISE + d.severity * 0.16;
    o.craterActual = d.craterMean * (1 + craterNoise * spread);
    applyLean(o, seed, d, a);
    var inBand = o.craterActual >= rfp.craterMin && o.craterActual <= rfp.craterMax;
    var timingOk = Math.abs(o.detT) <= rfp.tTol;
    var offOk = true, westOff = -o.offsetM;
    if (rfp.offsetSpec) {
      offOk = westOff >= rfp.offsetSpec.min && westOff <= rfp.offsetSpec.max;
    }
    if (d.severity > 0.15) {
      o.type = 'ragged';
      o.quality = 'ragged';
      o.rootCause = {
        title: 'RAGGED DETONATION',
        cause: 'Hot fill loaded past the ' + SHELLS[a.shell].name.toLowerCase() +
          '’s calm allowance (' + Math.round(d.effHot * 100) + '% hot vs ' +
          Math.round(SHELLS[a.shell].stab * 100) + '% rated' +
          ((rfp.heatMult || 1) > 1 ? ', heat forecast included' : '') + '). The blast came out sideways, in installments.',
        receipt: 'Root cause: fill loadout — canister bays, Assembly Bay. EMBER wants room' +
          (rfp.needsRefinery ? ', or a GLAZE canister to hold its hand.' : '.'),
        where: 'LOADOUT'
      };
      o.hint = 'It blew ugly and lopsided. Hot canisters want room — a bigger shell, or swap some for FROST' +
        (rfp.needsRefinery ? ' or GLAZE.' : '.');
    } else {
      o.type = 'clean';
      o.quality = 'clean';
      if (!inBand) {
        var small = o.craterActual < rfp.craterMin;
        var moreName = rfp.needsRefinery ? 'EMBER-X' : 'EMBER';
        var anyHot = (a.canisters || []).some(function (c) { return c && COMPOUNDS[c].heat > 0; });
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
          : 'Crater ' + o.craterActual.toFixed(1) + ' m — too big. ' +
            (anyHot ? 'Ease off: swap some hot canisters for FROST.' : 'Ease off: take a canister out.');
      } else if (!offOk && rfp.offsetSpec) {
        var wantDir = rfp.offsetSpec.dir === 'W' ? 'west' : 'east';
        o.rootCause = {
          title: 'CRATER IN THE WRONG PLACE',
          cause: 'Right size, wrong address: crater centre landed ' +
            (Math.abs(westOff) < 0.8 ? 'dead centre' : Math.abs(westOff).toFixed(1) + ' m ' + (westOff > 0 ? 'west' : 'east')) +
            ' against a contracted ' + rfp.offsetSpec.min + '–' + rfp.offsetSpec.max + ' m ' + wantDir +
            '. The blast goes where the load sits, and the load sat ' +
            (Math.abs(o.comX) < 0.1 ? 'politely in the middle.' : 'on the wrong side of the argument.'),
          receipt: 'Root cause: load arrangement — ' + describeLoad(a) +
            ', energy centre at ' + (o.comX >= 0 ? '+' : '') + o.comX.toFixed(2) + ' — canister bays, Assembly Bay.',
          where: 'LOADOUT'
        };
        o.hint = westOff < rfp.offsetSpec.min
          ? 'Crater centred ' + (westOff < 0 ? Math.abs(westOff).toFixed(1) + ' m EAST' : westOff.toFixed(1) + ' m west') +
            ' — the contract wants ' + rfp.offsetSpec.min + '–' + rfp.offsetSpec.max + ' m WEST. Stack the hot canisters in the west bays.'
          : 'Crater ' + westOff.toFixed(1) + ' m west — past the band. Ease the lean: move a canister back east.';
      } else if (!timingOk && rfp.dial) {
        o.rootCause = {
          title: 'DETONATION OFF THE CONTRACT CUE',
          cause: 'The device fired precisely when its dial told it to — T+' + tSet.toFixed(2) +
            ' against a contracted T+' + rfp.tSpec.toFixed(2) + ' ±' + rfp.tTol +
            '. The dial was set by hand. The hand is on file.',
          receipt: 'Root cause: timer dial set to T+' + tSet.toFixed(2) + ' — timer dial, close-out, Assembly Bay. Read the vernier twice.',
          where: 'TIMER DIAL'
        };
        o.hint = 'On cue for the wrong cue — the dial reads T+' + tSet.toFixed(2) + ', the contract wants T+' +
          rfp.tSpec.toFixed(2) + ' ±' + rfp.tTol + '. Set it finer.';
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
      offsetM: o.offsetM || 0,
      ellipse: o.ellipse || 1,
      comX: o.comX || 0,
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

  /* ---------- THE FLY-OFF: Vantage's article, resolved for real ----------
     Seeded, deterministic, adjudicated line by line against yours. */
  var FLYOFF_FAILS = [
    { h: 'VANTAGE ARTICLE DECLINES TO PARTICIPATE', s: 'Forty minutes of silence, one long stick, no crater. VP cites “stage fright of a proprietary nature”.', mode: 'dud' },
    { h: 'VANTAGE ARTICLE FIRES DURING SPEECH', s: 'Detonation at T−41 s, mid-way through “a new era of punctuality”. Lectern total loss.', mode: 'early' },
    { h: 'VANTAGE CRATER ARRIVES IN INSTALLMENTS', s: 'Three distinct bangs, one apology. Board asks which crater is the official one.', mode: 'ragged' }
  ];
  function simVantageFlyoff(seed, rfp) {
    rfp = rfp || CONTRACTS[7];
    var r = stream(seed, 'vantage-flyoff');
    var mid = (rfp.craterMin + rfp.craterMax) / 2;
    var out = { fail: false, crater: null, detT: null, clean: false };
    if (r() < 0.25) {
      var pick = FLYOFF_FAILS[Math.floor(r() * FLYOFF_FAILS.length) % FLYOFF_FAILS.length];
      out.fail = true;
      out.mode = pick.mode;
      out.headline = pick.h;
      out.sub = pick.s;
      if (pick.mode !== 'dud') {
        out.crater = mid * (0.45 + r() * 0.3);
        out.detT = pick.mode === 'early' ? -(2 + r() * 4) : gauss(r) * 0.4;
      }
    } else {
      out.crater = mid * (0.97 + gauss(r) * 0.07);
      out.detT = gauss(r) * 0.11;
      out.clean = r() < 0.72;
      out.headline = 'VANTAGE POSTS ' + out.crater.toFixed(1) + ' m AT PAD B';
      out.sub = out.clean ? 'One bang, round crater, insufferable smile.' : 'On the number, if you squint past the second lobe.';
    }
    var sizeOk = out.crater != null && out.crater >= rfp.craterMin && out.crater <= rfp.craterMax;
    var timingOk = out.detT != null && Math.abs(out.detT) <= rfp.tTol;
    var cleanOk = !out.fail && out.clean;
    out.stamps = {
      size: { ok: sizeOk, value: out.crater != null ? out.crater.toFixed(1) + ' m' : 'NO CRATER' },
      timing: { ok: timingOk, value: out.detT != null ? 'T+' + (rfp.tSpec + out.detT).toFixed(2) + ' s' : 'NO EVENT' },
      clean: { ok: cleanOk, value: out.fail ? (out.mode === 'dud' ? '—' : 'RAGGED') : (out.clean ? 'TEXTBOOK' : 'RAGGED') }
    };
    out.score = (sizeOk ? 1 : 0) + (timingOk ? 1 : 0) + (cleanOk ? 1 : 0);
    return out;
  }

  /* ---------- ADJUDICATE: outcome → scorecard ---------- */
  function adjudicate(a, seed, rfp) {
    rfp = rfp || CONTRACTS[0];
    var o = resolve(a, seed, rfp);
    var d = o.d;
    var vis = visualFor(o);
    var shaped = !!rfp.offsetSpec;

    var sizeOk = o.fired && o.craterActual != null &&
                 o.craterActual >= rfp.craterMin && o.craterActual <= rfp.craterMax;
    var timingOk = o.fired && o.detT != null && Math.abs(o.detT) <= rfp.tTol;
    var cleanOk = o.fired && o.quality === 'clean';
    var westOff = -(o.offsetM || 0);
    var offsetOk = shaped && o.fired &&
                   westOff >= rfp.offsetSpec.min && westOff <= rfp.offsetSpec.max;

    var stamps = {
      size:   { key: 'size', label: 'SIZE', ok: sizeOk,
                value: o.craterActual != null ? o.craterActual.toFixed(1) + ' m' : 'NO CRATER',
                spec: rfp.craterMin + '–' + rfp.craterMax + ' m' },
      timing: { key: 'timing', label: 'TIMING', ok: timingOk,
                value: o.fired && o.detT != null
                  ? 'T+' + (rfp.tSpec + o.detT).toFixed(2) + ' s' : 'NO EVENT',
                spec: 'T+' + rfp.tSpec.toFixed(rfp.dial ? 2 : 1) + ' s ±' + rfp.tTol },
      clean:  { key: 'clean', label: 'CLEAN', ok: cleanOk,
                value: !o.fired ? '—'
                  : o.quality === 'clean' ? 'TEXTBOOK'
                  : o.quality === 'ragged' ? 'RAGGED'
                  : o.quality === 'low-order' ? 'LOW-ORDER' : 'PARTIAL',
                spec: 'ONE BANG, ROUND CRATER' }
    };
    if (shaped) {
      stamps.offset = { key: 'offset', label: 'PLACEMENT', ok: offsetOk,
        value: !o.fired ? 'NO CRATER'
          : Math.abs(westOff) < 0.8 ? 'DEAD CENTRE'
          : Math.abs(westOff).toFixed(1) + ' m ' + (westOff > 0 ? 'W' : 'E'),
        spec: rfp.offsetSpec.min + '–' + rfp.offsetSpec.max + ' m ' + rfp.offsetSpec.dir };
    }
    var stampList = shaped ? [stamps.size, stamps.offset, stamps.timing]
                           : [stamps.size, stamps.timing, stamps.clean];

    var specMet = shaped ? (sizeOk && offsetOk && timingOk) : (sizeOk && timingOk);
    var stars = stampList.reduce(function (n, s) { return n + (s.ok ? 1 : 0); }, 0);

    /* fly-off: their article resolves from the same series seed */
    var flyoff = null;
    var win = specMet;
    if (rfp.flyoff) {
      var vf = simVantageFlyoff(seed, rfp);
      var mid = (rfp.craterMin + rfp.craterMax) / 2;
      var yourDist = o.craterActual != null ? Math.abs(o.craterActual - mid) : Infinity;
      var theirDist = vf.crater != null ? Math.abs(vf.crater - mid) : Infinity;
      var beat = stars > vf.score || (stars === vf.score && yourDist <= theirDist);
      flyoff = { v: vf, yourScore: stars, theirScore: vf.score, beat: beat,
                 yourDist: yourDist, theirDist: theirDist };
      win = specMet && beat;
    }

    var v = rfp.flyoff
      ? { ok: flyoff.v.score >= 2 && !win, headline: flyoff.v.headline, sub: flyoff.v.sub, crater: flyoff.v.crater }
      : simVantage(seed, rfp);

    var award = win ? rfp.payout : 0;
    var bonus = (win && cleanOk) ? rfp.bonusClean : 0;
    var net = award + bonus - d.cost;

    var hint = o.hint;
    if (win && !cleanOk) hint = 'Contract won — but it blew ugly. ' + (o.hint || '');
    if (rfp.flyoff && specMet && !win) {
      hint = 'Spec met — but Vantage met it closer (' + flyoff.theirScore + ' stamps to your ' + stars +
        (flyoff.theirScore === stars ? ', nearer the band centre' : '') + '). Tighter crater, cleaner bang, finer dial.';
    }

    var incident = null;
    if (!win) {
      var rc = o.rootCause;
      if (!rc && rfp.flyoff && specMet) {
        rc = {
          title: 'OUTBID AT THE PAD',
          cause: 'Both articles performed to specification. Theirs performed to it ' +
            (flyoff.theirScore > stars ? 'on more lines' : 'fractionally closer') +
            '. The board measured twice and shook the wrong hand.',
          receipt: 'Root cause: margins — Vantage posted ' + flyoff.theirScore + ' clean stamps to your ' + stars +
            '. Convergence, not luck, wins fly-offs. Assembly Bay.',
          where: 'THE MARGINS'
        };
      }
      if (!rc) rc = {
        title: 'RESULT OUTSIDE SPECIFICATION',
        cause: 'The graph and the contract disagreed.',
        receipt: 'Root cause: see attached telemetry — Assembly Bay.',
        where: 'ASSEMBLY BAY'
      };
      incident = {
        form: 'FORM IR-3 (REV. 12)',
        series: 'TEST SERIES ' + seed,
        contractId: rfp.id,
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
      outcome: o, visual: vis, stamps: stamps, stampList: stampList,
      win: win, specMet: specMet, stars: stars, hint: hint,
      payout: { award: award, bonus: bonus, cost: d.cost, net: net },
      vantage: v, flyoff: flyoff, incident: incident, seed: seed, rfp: rfp
    };
  }

  /* ---------- canned assemblies (harness + tests + validation sweeps) ---------- */
  function wireCorrect(a, seed) {
    var lay = panelLayout(seed);
    var byRole = {};
    Object.keys(lay).forEach(function (t) { byRole[lay[t]] = t; });
    a.wires = { red: byRole.bat, yellow: byRole.tmr, green: byRole.gnd };
    a.torques = { red: true, yellow: true, green: true };
    return a;
  }
  function finish(a, seed) {
    a.timer = a.battery = a.cap = a.panel = a.fins = true;
    wireCorrect(a, seed);
    a.det = { seated: true, slam: 0.1 };
    a.armed = true;
    return a;
  }
  /* the intended approach, per contract — the teaching ladder's answers */
  function cannedFor(idx, seed) {
    var a = makeAssembly();
    switch (idx) {
      case 0:   // the loop: sensible mixed load
        a.shell = 'standard';
        a.canisters = ['ember', 'ember', 'ember', 'frost'];
        break;
      case 1:   // FIRECRACKER: restraint — one calm canister, small shell
        a.shell = 'compact';
        a.canisters = ['frost', null];
        break;
      case 2:   // the Still: refined X in the big shell
        a.shell = 'heavy';
        a.canisters = ['emberx', 'emberx', 'emberx', 'emberx', 'emberx', 'frost'];
        a.refine = { spend: REFINERY.batchCost * 3, stock: { emberx: 1, emberxs: 0, glaze: 0 } };
        break;
      case 3:   // EGG TIMER: the dial, set by a steady hand
        a.shell = 'standard';
        a.canisters = ['ember', 'ember', 'frost', 'frost'];
        a.timerSet = 7.52;
        break;
      case 4:   // HOT PLATE: GLAZE holds EMBER's hand under the sun
        a.shell = 'standard';
        a.canisters = ['ember', 'ember', 'ember', 'glaze'];
        a.refine = { spend: REFINERY.glazeCost, stock: { emberx: 0, emberxs: 0, glaze: 1 } };
        break;
      case 5:   // SHAPED: lopsided on purpose
        a.shell = 'standard';
        a.canisters = ['ember', 'ember', null, 'frost'];
        break;
      case 6:   // FEATHERWEIGHT: X + GLAZE in the standard shell, under the cap
        a.shell = 'standard';
        a.canisters = ['emberx', 'emberx', 'emberx', 'glaze'];
        a.refine = { spend: REFINERY.batchCost * 2 + REFINERY.glazeCost, stock: { emberx: 1, emberxs: 0, glaze: 1 } };
        break;
      case 7:   // THE FLY-OFF: everything you know
        a.shell = 'standard';
        a.canisters = ['emberx', 'emberx', 'frost', 'frost'];
        a.refine = { spend: REFINERY.batchCost, stock: { emberx: 0, emberxs: 0, glaze: 0 } };
        a.timerSet = 6.02;
        break;
    }
    return finish(a, seed);
  }
  function cannedClean(seed) { return cannedFor(0, seed); }
  function cannedClean2(seed) { return cannedFor(2, seed); }

  return {
    CONTRACTS: CONTRACTS, CONTRACT_BY_ID: CONTRACT_BY_ID,
    RFP: CONTRACTS[0], CAMERA: CAMERA, SOUND_DELAY: SOUND_DELAY,
    SHELLS: SHELLS, COMPOUNDS: COMPOUNDS, PARTS: PARTS, REFINERY: REFINERY,
    WIRES: WIRES, WIRE_ROLE: WIRE_ROLE, ROLE_LABEL: ROLE_LABEL, WIRE_NAME: WIRE_NAME,
    SLAM_THRESHOLD: SLAM_THRESHOLD,
    GLAZE_SLAM_FORGIVE: GLAZE_SLAM_FORGIVE, GLAZE_COOK_SHIELD: GLAZE_COOK_SHIELD,
    OFFSET_GAIN: OFFSET_GAIN, ELLIPSE_GAIN: ELLIPSE_GAIN,
    stream: stream, gauss: gauss, clamp: clamp, makeSeed: makeSeed,
    panelLayout: panelLayout, roleOf: roleOf,
    makeAssembly: makeAssembly, derive: derive, describeLoad: describeLoad,
    comOf: comOf, glazeCount: glazeCount, timerSetOf: timerSetOf,
    wireFaults: wireFaults, looseTerminals: looseTerminals,
    resolve: resolve, visualFor: visualFor,
    simVantage: simVantage, simVantageFlyoff: simVantageFlyoff, adjudicate: adjudicate,
    wireCorrect: wireCorrect, cannedFor: cannedFor,
    cannedClean: cannedClean, cannedClean2: cannedClean2
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PG2;
