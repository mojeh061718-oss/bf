/* ============================================================
   PROVING GROUNDS — sim.js
   Headless, deterministic contract-resolution core.
   ALL SCIENCE HEREIN IS INVENTED. Compounds, alloys, constants
   and scaling laws are fictional ("Halloran's law", Brandt units).
   The only real thing simulated is engineering *process*.
   Importable in node:  const PG = require('./sim.js')
   ============================================================ */
'use strict';

var PG = (function () {

  /* ---------- THE CONTRACT ---------- */
  var RFP = {
    id: 'RFP-041',
    title: 'QUARRY BREACH CHARGE',
    form: 'FORM RD-1147-A',
    craterMin: 18,        // metres (fictional Halloran scaling)
    craterMax: 24,
    timerSpec: 5.0,       // seconds
    timerTol: 0.4,        // ± seconds for precision bonus
    costCap: 2400,        // $ unit cost ceiling
    weightCap: 80,        // kg
    payout: 6000,
    bonus: 1500,
    forecastC: 41,        // range-day forecast, °C. The desert is HOT.
    camera: { id: 'STATION 7', km: 1.6, secPerKm: 3.0 }  // fictional sound speed
  };

  /* ---------- FICTIONAL COMPOUNDS (per kg) ---------- */
  var COMPOUNDS = {
    am4: { id: 'am4', name: 'AMMONITE-4', energy: 6.0,  stability: 0.30, sens: 0.55, cost: 16,
           blurb: 'Quarry workhorse. Cheap, eager, complains bitterly about heat.' },
    crx: { id: 'crx', name: 'CERULEX',    energy: 3.2,  stability: 0.95, sens: 0.10, cost: 9,
           blurb: 'Stable as a filing cabinet, and roughly as energetic.' },
    vx7: { id: 'vx7', name: 'VEX-7',      energy: 10.5, stability: 0.62, sens: 0.98, cost: 30,
           blurb: 'Brilliant, expensive, and extremely touchy about potholes.' }
  };

  /* ---------- FICTIONAL CASING ALLOYS ---------- */
  var ALLOYS = {
    sr2: { id: 'sr2', name: 'SR-2 “SCRAPPER” PLATE', eff: 0.82, baseW: 8, wCoef: 0.90,
           baseC: 120, cCoef: 6,  brittle: 0.85, grade: 'C−',
           blurb: 'War-surplus rolled plate. Smells of the previous war.' },
    d9:  { id: 'd9',  name: 'DURALIDE D-9',          eff: 0.95, baseW: 6, wCoef: 0.70,
           baseC: 260, cCoef: 9,  brittle: 0.45, grade: 'B+',
           blurb: 'The sensible choice. Nobody was ever fired for specifying D-9.' },
    n3:  { id: 'n3',  name: 'NOVALITH N-3',          eff: 1.05, baseW: 4, wCoef: 0.55,
           baseC: 420, cCoef: 12, brittle: 0.20, grade: 'A',
           blurb: 'Aerospace-grade. The invoice arrives by courier, in a velvet folder.' }
  };

  /* ---------- FUSE CHAIN ---------- */
  var STAGES = [
    { id: 0, name: 'ARMING INTERLOCK', short: 'INTERLOCK', note: 'Satisfies spec 7.4.1(c). Allegedly optional.' },
    { id: 1, name: 'CHRONEX TIMER',    short: 'TIMER',     note: 'Counts to five. The whole job, really.' },
    { id: 2, name: 'FIREBELL INITIATOR', short: 'INITIATOR', note: 'Wakes the train. Light sleeper preferred.' },
    { id: 3, name: 'CASCADE RELAY TRAIN', short: 'DET TRAIN', note: 'Passes the message along, loudly.' }
  ];
  var TIERS = {
    none:      { id: 'none',      name: 'NONE',              cost: 0,   rel: 1.0,   drift: 0,    w: 0,   sigma: 0 },
    surplus:   { id: 'surplus',   name: 'WAR-SURPLUS',       cost: 60,  rel: 0.94,  drift: 0.50, w: 2.5, sigma: 0.045 },
    standard:  { id: 'standard',  name: 'STANDARD',          cost: 140, rel: 0.98,  drift: 0.25, w: 2.0, sigma: 0.016 },
    precision: { id: 'precision', name: 'PRECISION-MACHINED', cost: 320, rel: 0.997, drift: 0.08, w: 1.5, sigma: 0.003 }
  };
  var TIER_CLAMP = {
    surplus: [0.72, 0.995], standard: [0.90, 0.998], precision: [0.985, 0.9995], none: [1, 1]
  };
  var DRIFT_W = [0, 1.0, 0.4, 0.25];   // stage contribution to timer drift

  var QA_COST = { batch: 150, env: 200, mic: 0 };
  var MIC_DRIFT_FACTOR = 0.85;

  /* Halloran's crater-scaling law (invented): D = K * Y^P, Y in Brandt units */
  var CR_K = 3.1, CR_P = 0.36;
  var CRATER_SIGMA = 0.085;        // base relative sigma on realised diameter
  var CRATER_SIGMA_ENV = 0.065;    // after environmental qualification
  var VALUE_MERIT_MULT = 40;       // Formula 9(b): value = merit × $40 − adjusted price

  /* ---------- SEEDED RNG ---------- */
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
    var r = rng || Math.random;
    var s = '';
    for (var i = 0; i < 5; i++) s += A[Math.floor(r() * A.length)];
    return s;
  }

  /* ---------- BLEND ---------- */
  function blend(mix) {
    var out = { energy: 0, stability: 0, sens: 0, costKg: 0 };
    for (var k in COMPOUNDS) {
      var w = mix[k] || 0, c = COMPOUNDS[k];
      out.energy += w * c.energy;
      out.stability += w * c.stability;
      out.sens += w * c.sens;
      out.costKg += w * c.cost;
    }
    return out;
  }

  /* Required stability index at forecast temperature (invented curve) */
  function stabilityReq(tempC) { return (tempC - 18) / 44; }

  function cookoffProb(design) {
    var b = blend(design.mix);
    var deficit = stabilityReq(RFP.forecastC) - b.stability;
    return deficit > 0 ? clamp(deficit * 2.4, 0, 0.80) : 0;
  }
  function transportProb(design) {
    var b = blend(design.mix);
    return b.sens > 0.78 ? clamp((b.sens - 0.78) * 0.9, 0, 0.18) : 0;
  }

  /* True (hidden) reliability of a stage's batch this run. Seeded per run. */
  function trueRate(seed, stageIdx, tierId) {
    if (tierId === 'none') return 1.0;
    var t = TIERS[tierId];
    var g = gauss(stream(seed, 'batch:' + stageIdx + ':' + tierId));
    var cl = TIER_CLAMP[tierId];
    return clamp(t.rel + g * t.sigma, cl[0], cl[1]);
  }

  /* Ten-shot bench montage for the QA bay (display only; truth is trueRate). */
  function batchMontage(seed, stageIdx, tierId) {
    var rate = trueRate(seed, stageIdx, tierId);
    var r = stream(seed, 'qa-montage:' + stageIdx + ':' + tierId);
    var shots = [], hits = 0;
    for (var i = 0; i < 10; i++) {
      var ok = r() < rate;
      if (ok) hits++;
      shots.push(ok);
    }
    return { rate: rate, shots: shots, hits: hits };
  }

  /* ---------- DERIVE (bench readouts; catalog knowledge only) ---------- */
  function derive(design) {
    var b = blend(design.mix);
    var alloy = ALLOYS[design.alloy];
    var qa = design.qa || { batch: [null, null, null, null], env: false, mic: 'skip' };

    var fillCost = design.mass * b.costKg;
    var casingW = alloy.baseW + alloy.wCoef * design.wall;
    var casingCost = alloy.baseC + alloy.cCoef * design.wall;

    var fuseCost = 0, fuseW = 0, chainRel = 1, relParts = [];
    var interlockPresent = design.fuse[0] !== 'none';
    for (var i = 0; i < 4; i++) {
      var t = TIERS[design.fuse[i]];
      fuseCost += t.cost; fuseW += t.w;
      var r = t.rel;
      // if this exact (stage, tier) was batch-tested, bench shows measured truth
      if (qa.batch[i] && qa.batch[i].tier === design.fuse[i]) r = qa.batch[i].rate;
      relParts.push(r);
      chainRel *= r;
    }
    var drift2 = 0;
    for (i = 0; i < 4; i++) {
      var dd = DRIFT_W[i] * TIERS[design.fuse[i]].drift;
      drift2 += dd * dd;
    }
    var chainDrift = Math.sqrt(drift2);
    if (qa.mic === 'pass') chainDrift *= MIC_DRIFT_FACTOR;

    // casing shape efficiency (invented containment curve)
    var shape = 0.75 + 0.35 * Math.tanh((design.wall - 6) / 8);
    var eff = alloy.eff * shape;

    var Y = b.energy * design.mass * eff;                 // Brandt units
    var craterMean = CR_K * Math.pow(Math.max(Y, 1), CR_P);
    var craterSigma = (qa.env ? CRATER_SIGMA_ENV : CRATER_SIGMA);

    var unitCost = Math.round(fillCost + casingCost + fuseCost);
    var weight = design.mass + casingW + fuseW;

    var pCook = qa.env ? 0 : cookoffProb(design);
    var pTrans = transportProb(design);

    return {
      blend: b, alloy: alloy,
      fillCost: Math.round(fillCost), casingW: casingW, casingCost: Math.round(casingCost),
      fuseCost: fuseCost, fuseW: fuseW,
      unitCost: unitCost, weight: Math.round(weight * 10) / 10,
      eff: eff, yieldBd: Math.round(Y * 10) / 10,
      craterMean: craterMean, craterSigma: craterSigma,
      craterLo: craterMean * (1 - 1.28 * craterSigma),
      craterHi: craterMean * (1 + 1.28 * craterSigma),
      chainRel: chainRel, relParts: relParts, chainDrift: chainDrift,
      interlock: interlockPresent,
      stabilityReq: stabilityReq(RFP.forecastC),
      pCook: pCook, pTransport: pTrans,
      costOk: unitCost <= RFP.costCap,
      weightOk: weight <= RFP.weightCap
    };
  }

  /* ---------- MERIT (Formula 9(b), Technical Merit) ---------- */
  function craterPts(d) {
    if (d == null) return 0;
    if (d >= RFP.craterMin && d <= RFP.craterMax) return 40;
    var out = d < RFP.craterMin ? RFP.craterMin - d : d - RFP.craterMax;
    return Math.max(0, Math.round(40 - 14 * out));
  }
  function timerPts(delta) {
    if (delta == null) return 0;
    var a = Math.abs(delta);
    if (a <= RFP.timerTol) return 25;
    return Math.max(0, Math.round(25 - 40 * (a - RFP.timerTol)));
  }
  function adjustedPrice(cost) {
    return Math.round(cost + 2 * Math.max(0, cost - RFP.costCap));
  }

  /* ---------- BLAST VISUAL PARAMETERS (drives Station 7 footage) ---------- */
  function visualFor(design, d, outcomeType, craterActual) {
    var b = d.blend;
    var fired = (outcomeType === 'success' || outcomeType === 'partial' ||
                 outcomeType === 'cookoff' || outcomeType === 'fizzle');
    var crater = craterActual || 0;
    var fireball = 0, bright = 0;
    if (fired) {
      fireball = (outcomeType === 'fizzle') ? crater * 0.9 : crater * 1.15; // metres
      bright = clamp(b.energy / 10.5, 0.25, 1);
      if (outcomeType === 'fizzle') bright *= 0.35;
    }
    var deficit = Math.max(0, d.stabilityReq - b.stability);
    return {
      fireball: fireball,                                     // metres, 0 for duds
      bright: bright,                                         // 0..1 flash intensity
      ragged: clamp(deficit * 3 + b.sens * 0.25, 0, 1),       // asymmetric, dirty det
      fragCount: Math.round(8 + d.alloy.brittle * 46 + design.wall * 0.9),
      fragSpread: clamp(0.35 + d.alloy.brittle * 0.6, 0, 1),  // brittle = wide spray
      dust: fired ? clamp(crater / 26, 0.1, 1.3) : (outcomeType === 'dud' ? 0.06 : 0),
      early: outcomeType === 'cookoff',
      fizzle: outcomeType === 'fizzle',
      soundDelay: Math.round(RFP.camera.km * RFP.camera.secPerKm * 10) / 10
    };
  }

  /* ---------- ROOT-CAUSE RECEIPTS ---------- */
  function stageReceipt(design, seed, stageIdx) {
    var tier = design.fuse[stageIdx];
    var qa = design.qa || { batch: [] };
    var tested = qa.batch && qa.batch[stageIdx] && qa.batch[stageIdx].tier === tier;
    var truth = trueRate(seed, stageIdx, tier);
    var tag;
    if (tested) {
      tag = 'batch-tested at ' + (truth * 100).toFixed(1) + '% — known risk, accepted in the QA Bay';
    } else if (tier === 'precision') {
      tag = 'UNINSPECTED — manufacturing escape; even 99.7% is not a promise';
    } else {
      tag = 'UNINSPECTED — cost decision, Design Bench';
    }
    return 'Stage-' + (stageIdx + 1) + ' ' + STAGES[stageIdx].short.toLowerCase() +
      ', ' + TIERS[tier].name.toLowerCase() + ' batch (true rate ' + (truth * 100).toFixed(1) + '%), ' + tag + '.';
  }

  /* ---------- RANGE RESOLUTION ---------- */
  function resolve(design, seed) {
    var d = derive(design);
    var qa = design.qa || { batch: [null, null, null, null], env: false, mic: 'skip' };
    var o = {
      type: 'success', fired: false, failStage: -1,
      craterActual: null, timerActual: null, timerDelta: null,
      rootCause: null, d: d
    };

    // 0) The board's pad inspector finds the missing interlock before arming.
    if (design.fuse[0] === 'none') {
      o.type = 'interlock';
      o.rootCause = {
        title: 'TEST HALTED — SPECIFICATION VIOLATION',
        cause: 'Arming interlock ABSENT. Specification 7.4.1(c) requires a mechanical arming interlock on all test articles.',
        receipt: 'Interlock stage set to NONE ($0) — cost decision, Design Bench.',
        clause: '7.4.1(c)'
      };
      o.visual = visualFor(design, d, 'interlock', 0);
      return o;
    }

    // 1) Transport shock (very sensitive blends only)
    var pT = transportProb(design);
    if (pT > 0 && stream(seed, 'transport')() < pT) {
      o.type = 'transport';
      o.rootCause = {
        title: 'EARLY DETONATION — TRANSPORT PHASE',
        cause: 'Fill blend shock sensitivity index ' + d.blend.sens.toFixed(2) +
          ' exceeded the washboard-road allowance on the approach.',
        receipt: 'Vex-7-rich blend selected without shock mitigation — Design Bench. The truck is fine. The road is not.',
        clause: '11.3'
      };
      o.visual = visualFor(design, d, 'transport', 0);
      return o;
    }

    // 2) Thermal cook-off (unstable blend, hot forecast, no environmental qual)
    var pC = qa.env ? 0 : cookoffProb(design);
    if (pC > 0 && stream(seed, 'cookoff')() < pC) {
      o.type = 'cookoff';
      o.fired = true;
      o.craterActual = d.craterMean * (1 + gauss(stream(seed, 'crater')) * d.craterSigma) * 0.9;
      o.rootCause = {
        title: 'PREMATURE DETONATION — THERMAL',
        cause: 'Fill blend stability index ' + d.blend.stability.toFixed(2) +
          ' vs required ' + d.stabilityReq.toFixed(2) + ' at forecast ' + RFP.forecastC + '°C.',
        receipt: 'Environmental qualification SKIPPED — QA Bay. The forecast was printed on the RFP.',
        clause: '6.1.2'
      };
      o.visual = visualFor(design, d, 'cookoff', o.craterActual);
      return o;
    }

    // 3) Fuse chain, stage by stage, against hidden true rates
    for (var i = 0; i < 4; i++) {
      var u = stream(seed, 'fuse:' + i)();
      if (u > trueRate(seed, i, design.fuse[i])) {
        if (i === 3) {
          // Detonation train under-performs: low-order fizzle, not a clean dud
          o.type = 'fizzle';
          o.fired = true;
          o.failStage = 3;
          o.craterActual = d.craterMean * 0.34 * (1 + gauss(stream(seed, 'crater')) * d.craterSigma);
          o.timerActual = RFP.timerSpec + gauss(stream(seed, 'timer')) * (d.chainDrift / 2);
          o.timerDelta = o.timerActual - RFP.timerSpec;
          o.rootCause = {
            title: 'LOW-ORDER DETONATION',
            cause: 'Cascade relay train propagated partially; the fill deflagrated instead of detonating.',
            receipt: stageReceipt(design, seed, 3),
            clause: '8.5'
          };
          o.visual = visualFor(design, d, 'fizzle', o.craterActual);
          return o;
        }
        o.type = 'dud';
        o.failStage = i;
        o.rootCause = {
          title: (i === 0 ? 'FAILURE TO ARM' : 'NO-FIRE'),
          cause: STAGES[i].name.charAt(0) + STAGES[i].name.slice(1).toLowerCase() +
            (i === 0 ? ' refused to arm.' : ' failed to function on command.'),
          receipt: stageReceipt(design, seed, i),
          clause: '8.2'
        };
        o.visual = visualFor(design, d, 'dud', 0);
        return o;
      }
    }

    // 4) Fired clean: sample realised timer + crater
    o.fired = true;
    o.timerActual = RFP.timerSpec + gauss(stream(seed, 'timer')) * (d.chainDrift / 2);
    o.timerDelta = o.timerActual - RFP.timerSpec;
    o.craterActual = d.craterMean * (1 + gauss(stream(seed, 'crater')) * d.craterSigma);

    var inBand = o.craterActual >= RFP.craterMin && o.craterActual <= RFP.craterMax;
    o.type = inBand ? 'success' : 'partial';
    if (!inBand) {
      var small = o.craterActual < RFP.craterMin;
      o.rootCause = {
        title: small ? 'EFFECT BELOW SPECIFICATION' : 'EFFECT ABOVE SPECIFICATION',
        cause: 'Measured crater ' + o.craterActual.toFixed(1) + ' m vs specified band ' +
          RFP.craterMin + '–' + RFP.craterMax + ' m (Station 7 telemetry).',
        receipt: small
          ? 'Energy budget short: predicted ' + d.craterMean.toFixed(1) + ' m ±' +
            Math.round(d.craterSigma * 128) / 10 + '% — fill mass / blend energy, Design Bench.'
          : 'Energy budget excessive: predicted ' + d.craterMean.toFixed(1) +
            ' m already flirting with the ceiling — Design Bench. The quarry wanted a door, not a lake.',
        clause: '4.1'
      };
    } else if (Math.abs(o.timerDelta) > RFP.timerTol) {
      // in-band crater but blown precision — carry a cause for the bonus line
      o.rootCause = {
        title: 'PRECISION SPECIFICATION MISSED',
        cause: 'Detonation at T+' + o.timerActual.toFixed(2) + ' s vs ' + RFP.timerSpec.toFixed(1) +
          ' s ±' + RFP.timerTol + ' s.',
        receipt: 'Timer chain drift ±' + d.chainDrift.toFixed(2) + ' s as built' +
          (qa.mic === 'pass' ? ' (after micrometer trim)' : ' (no dimensional inspection)') +
          ' — component quality, Design Bench.',
        clause: '5.2'
      };
    }
    o.visual = visualFor(design, d, o.type, o.craterActual);
    return o;
  }

  /* ---------- VANTAGE DYNAMICS (the rival, simulated) ---------- */
  var VANTAGE_FAILS = [
    { h: 'VANTAGE TEST ARTICLE DEPARTS CRANE, BEGINS NEW CAREER AS PLOW', s: 'Handling procedures “under review”; sand “mostly recovered”.' },
    { h: 'VANTAGE “SMARTFUZE” COUNTS DOWN, RECONSIDERS', s: 'Device reportedly “needs space”. Board waits 40 minutes in the sun.' },
    { h: 'VANTAGE DEMONSTRATION SCATTERS OWN LUNCH TENT', s: 'Caterer demands danger pay; potato salad declared total loss.' },
    { h: 'VANTAGE CHARGE FIRES 6.2 SECONDS EARLY; BOARD’S COFFEE UNRECOVERABLE', s: 'Company statement blames “an ambitious capacitor”.' }
  ];

  function simVantage(seed) {
    var r = stream(seed, 'vantage');
    var v = { name: 'VANTAGE DYNAMICS' };
    var uCat = r();
    v.crater = 21 + gauss(r) * 1.5;
    v.timerDelta = gauss(r) * 0.16;
    var lossLeader = r() < 0.30;
    v.cost = Math.round(lossLeader ? 1990 + r() * 400 : 2600 + r() * 1000);
    v.weight = Math.round(58 + r() * 16);
    v.lossLeader = lossLeader;
    v.catastrophic = uCat < 0.12;
    if (v.catastrophic) {
      var pick = VANTAGE_FAILS[Math.floor(r() * VANTAGE_FAILS.length) % VANTAGE_FAILS.length];
      v.headline = pick.h; v.sub = pick.s;
      v.qualified = false; v.merit = 12; v.value = -99999;
      v.crater = null; v.timerDelta = null;
      return v;
    }
    v.craterIn = v.crater >= RFP.craterMin && v.crater <= RFP.craterMax;
    v.timerIn = Math.abs(v.timerDelta) <= RFP.timerTol;
    v.qualified = v.craterIn;
    v.merit = craterPts(v.crater) + timerPts(v.timerDelta) + (v.weight <= RFP.weightCap ? 10 : 0) + 10;
    v.value = v.merit * VALUE_MERIT_MULT - adjustedPrice(v.cost);
    v.headline = v.qualified
      ? (v.cost > RFP.costCap
        ? 'VANTAGE HITS SPEC AT MERELY ' + Math.round((v.cost / RFP.costCap - 1) * 100) + '% OVER THE COST CAP'
        : 'VANTAGE UNDERCUTS: “WE CAN AFFORD TO LOSE MONEY. CAN YOU?”')
      : 'VANTAGE CRATER MEASURES ' + v.crater.toFixed(1) + ' m; SPEC BAND UNMOVED BY BROCHURE';
    v.sub = v.qualified
      ? '“We consider this procurement a formality.” — R. Cavendish Vane, VP Client Triumph'
      : 'Vantage attributes variance to “atmospheric conditions of a proprietary nature”.';
    return v;
  }

  /* ---------- FULL ADJUDICATION ---------- */
  function adjudicate(design, seed, qaSpend) {
    var out = resolve(design, seed);
    var d = out.d;
    var v = simVantage(seed);
    qaSpend = qaSpend || 0;

    var lines = {
      crater:   { label: 'EFFECT — crater ⌀ ' + RFP.craterMin + '–' + RFP.craterMax + ' m',
                  pass: out.fired && out.craterActual != null &&
                        out.craterActual >= RFP.craterMin && out.craterActual <= RFP.craterMax &&
                        out.type !== 'cookoff' && out.type !== 'fizzle',
                  value: out.craterActual != null ? out.craterActual.toFixed(1) + ' m' : 'NO DATA' },
      timer:    { label: 'PRECISION — T+' + RFP.timerSpec.toFixed(1) + ' s ±' + RFP.timerTol + ' s',
                  pass: out.timerDelta != null && Math.abs(out.timerDelta) <= RFP.timerTol && out.type !== 'cookoff',
                  value: out.timerActual != null ? 'T+' + out.timerActual.toFixed(2) + ' s' : 'NO DATA' },
      cost:     { label: 'UNIT COST ≤ $' + RFP.costCap,
                  pass: d.unitCost <= RFP.costCap, value: '$' + d.unitCost },
      weight:   { label: 'WEIGHT ≤ ' + RFP.weightCap + ' kg',
                  pass: d.weight <= RFP.weightCap, value: d.weight + ' kg' },
      interlock:{ label: 'SAFETY INTERLOCK — spec 7.4.1(c)',
                  pass: d.interlock && out.type !== 'interlock',
                  value: d.interlock ? 'FITTED' : 'ABSENT' }
    };

    var merit = 0;
    if (out.type !== 'cookoff') {
      merit += craterPts(lines.crater.pass ? out.craterActual : out.craterActual);
      merit += timerPts(out.timerDelta);
    }
    merit += (lines.weight.pass ? 10 : 0) + (lines.interlock.pass ? 10 : 0);
    var value = merit * VALUE_MERIT_MULT - adjustedPrice(d.unitCost);

    var pQual = out.fired && lines.crater.pass && lines.interlock.pass && out.type === 'success';
    var vQual = v.qualified;

    var award;
    if (pQual && vQual) award = value >= v.value ? 'player' : 'vantage';
    else if (pQual) award = 'player';
    else if (vQual) award = 'vantage';
    else award = 'withdrawn';

    var stars = 0;
    if (award === 'player') {
      stars = 1;
      var allLines = lines.crater.pass && lines.timer.pass && lines.cost.pass &&
                     lines.weight.pass && lines.interlock.pass;
      if (allLines) stars++;
      if ((vQual && value >= v.value) || d.unitCost <= RFP.costCap * 0.88) stars++;
    }

    var awardMoney = award === 'player' ? RFP.payout : 0;
    var bonusMoney = (award === 'player' && lines.timer.pass) ? RFP.bonus : 0;
    var net = awardMoney + bonusMoney - d.unitCost - qaSpend;

    // Why did we lose? Priority-ordered primary cause; always non-empty on loss.
    var incident = null;
    if (award !== 'player') {
      var rc = out.rootCause;
      if (!rc) {
        if (!lines.cost.pass) {
          rc = {
            title: 'OUTBID — VALUE ADJUDICATION',
            cause: 'All effect lines met, but unit cost $' + d.unitCost + ' exceeded the $' + RFP.costCap +
              ' cap; adjusted price $' + adjustedPrice(d.unitCost) + ' under Formula 9(b).',
            receipt: 'Component selection totals — cost decision, Design Bench. Gold plating is heavy in the ledger.',
            clause: '9(b)'
          };
        } else if (!lines.weight.pass) {
          rc = {
            title: 'MASS LIMIT EXCEEDED',
            cause: 'All-up weight ' + d.weight + ' kg vs ' + RFP.weightCap + ' kg limit.',
            receipt: 'Fill mass + casing wall — Design Bench. The crane operator sends regards.',
            clause: '4.3'
          };
        } else {
          rc = {
            title: 'OUTBID — VALUE ADJUDICATION',
            cause: 'Design met specification but Vantage Dynamics returned higher adjudicated value ($' +
              v.value + ' vs $' + value + ') under Formula 9(b).',
            receipt: 'Technical merit ' + merit + ' pts at $' + d.unitCost + '/unit — value line, Design Bench.',
            clause: '9(b)'
          };
        }
      }
      incident = {
        form: 'FORM IR-3 (REV. 11)',
        series: 'TEST SERIES ' + seed,
        outcome: rc.title,
        cause: rc.cause,
        receipt: rc.receipt,
        clause: rc.clause,
        contributing: buildContributing(design, d, out),
        disposition: award === 'vantage'
          ? 'Contract awarded to Vantage Dynamics. Contractor invited to resubmit next cycle. Catering invoice enclosed.'
          : 'Contract WITHDRAWN pending review of, frankly, everybody. Range remains closed for sweeping.'
      };
    }

    return {
      outcome: out, lines: lines, merit: merit, value: value,
      adjustedPrice: adjustedPrice(d.unitCost),
      vantage: v, award: award, stars: stars,
      payout: { award: awardMoney, bonus: bonusMoney, unitCost: d.unitCost, qaSpend: qaSpend, net: net },
      incident: incident, seed: seed
    };
  }

  function buildContributing(design, d, out) {
    var c = [];
    var qa = design.qa || { batch: [null, null, null, null], env: false, mic: 'skip' };
    var anyBatch = false;
    for (var i = 0; i < 4; i++) if (qa.batch[i] && qa.batch[i].tier === design.fuse[i]) anyBatch = true;
    if (!anyBatch) c.push('No fuse batch testing on record. The catalog is a poem, not a promise.');
    if (!qa.env && cookoffProb(design) > 0) c.push('Environmental qualification skipped against a ' + RFP.forecastC + '°C forecast.');
    if (qa.mic === 'skip') c.push('Dimensional inspection: none performed.');
    if (qa.mic === 'fail') c.push('Dimensional inspection attempted; result inconclusive. Honesty noted with approval.');
    if (!d.costOk) c.push('Unit cost over cap by $' + (d.unitCost - RFP.costCap) + '.');
    if (out.failStage >= 0) c.push('Chain reliability as designed: ' + (d.chainRel * 100).toFixed(1) + '%.');
    if (c.length === 0) c.push('None recorded. Sometimes the desert simply wins.');
    return c;
  }

  /* ---------- canned designs (harness + demo presets) ---------- */
  var CANNED = {
    cheap: {
      mix: { am4: 0.7, crx: 0.3, vx7: 0 }, mass: 36, alloy: 'sr2', wall: 8,
      fuse: ['surplus', 'surplus', 'surplus', 'surplus'],
      qa: { batch: [null, null, null, null], env: false, mic: 'skip' }
    },
    balanced: {
      mix: { am4: 0.45, crx: 0.35, vx7: 0.2 }, mass: 38, alloy: 'd9', wall: 12,
      fuse: ['standard', 'standard', 'standard', 'standard'],
      qa: { batch: [null, { tier: 'standard', rate: 0 }, null, null], env: true, mic: 'pass' }
    },
    gold: {
      mix: { am4: 0.4, crx: 0.3, vx7: 0.3 }, mass: 34, alloy: 'n3', wall: 16,
      fuse: ['precision', 'precision', 'precision', 'precision'],
      qa: { batch: [null, null, null, null], env: true, mic: 'pass' }
    },
    nointerlock: {
      mix: { am4: 0.45, crx: 0.35, vx7: 0.2 }, mass: 38, alloy: 'd9', wall: 12,
      fuse: ['none', 'standard', 'standard', 'standard'],
      qa: { batch: [null, null, null, null], env: false, mic: 'skip' }
    },
    unstable: {
      mix: { am4: 0.85, crx: 0, vx7: 0.15 }, mass: 36, alloy: 'd9', wall: 12,
      fuse: ['standard', 'standard', 'standard', 'standard'],
      qa: { batch: [null, null, null, null], env: false, mic: 'skip' }
    }
  };

  return {
    RFP: RFP, COMPOUNDS: COMPOUNDS, ALLOYS: ALLOYS, STAGES: STAGES, TIERS: TIERS,
    QA_COST: QA_COST, MIC_DRIFT_FACTOR: MIC_DRIFT_FACTOR, CANNED: CANNED,
    stream: stream, gauss: gauss, clamp: clamp, makeSeed: makeSeed,
    blend: blend, stabilityReq: stabilityReq, cookoffProb: cookoffProb, transportProb: transportProb,
    trueRate: trueRate, batchMontage: batchMontage,
    derive: derive, resolve: resolve, simVantage: simVantage, adjudicate: adjudicate,
    craterPts: craterPts, timerPts: timerPts, adjustedPrice: adjustedPrice
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PG;
