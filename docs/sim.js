/* ============================================================
   REDSKY INC — sim.js
   Headless, deterministic assembly-state → outcome resolver.
   ALL SCIENCE HEREIN IS INVENTED. Compounds, shells, constants
   and scaling laws are fictional (Halloran crater scaling,
   Brandt yield units). What is real is *consequence*: the
   outcome is computed from what the player physically did.
   DOM-free. Importable in node:  const PG2 = require('./sim.js')

   M2 — Act I complete: eight contracts, the TIMER DIAL
   (a.timerSet), PAYLOAD ARRANGEMENT (energy centre-of-mass →
   crater offset/ellipse), ADDITIVE G-3 (F-2S-derivative
   stabilizer: calms hot loads, forgives rough seating, resists
   cook-off), contract heat waves (thermal cook-off), and the
   Act I boss — a seeded side-by-side FLY-OFF vs Vantage.

   M3a — nomenclature (stockroom mil-spec designations, all
   invented): FILLER 1A (F-1A), FILLER 2S (F-2S), FILLER 1X
   (F-1X), ADDITIVE G-3 (G-3). Internal keys stay ember/frost/
   emberx/glaze — display names carry the supply-chain fiction.
   Plus: CATALOG WAVE 1 (ten new parts), BUILD PHASES metadata,
   and RFP-066 "SKIPSTONE" (impact-fuze drop test).
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
      clause: 'Raw FILLER 1A will not do. The Authority suggests, without legally suggesting anything, that the contractor owns a refinery.',
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
      clause: 'Forecast for the pan: 47° in the shade, of which there is none. The Authority accepts no liability for what FILLER 1A thinks about that.',
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
    },
    {
      idx: 8,
      id: 'RFP-066',
      title: 'SKIPSTONE',
      form: 'FORM RD-1147-D',
      craterMin: 15, craterMax: 18,
      budget: 2600,
      tSpec: 3.0, tTol: 0.4,            // T+3.0 is the RELEASE cue; the ground provides the rest
      impact: { band: 2.2, missLimit: 4.5, drift: 5.5, scatter: 0.5 },
      dropH: 12,                        // rig-arm height (presentation)
      unlockAfter: 'RFP-057',           // a 9th folder, pinned once SHAPED is won
      payout: 9500, bonusClean: 800,
      meterMax: 24,
      timeOfDay: 'dawn',
      wind: { dir: 260, speed: 0.4 },
      clause: 'The article shall be DROPPED, from the rig, onto the painted plate. The Authority has waived the timing spec: the ground will provide the cue, as the ground reliably does.',
      clause2: '12.4(c): the crater shall centre on the plate band. The blast goes where the load leans, and the lean goes where you loaded it. Trim accordingly.',
      needsRefinery: false
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
                stab: 0.80, rated: true, blurb: 'Four bays. The sensible one.' },
    heavy:    { id: 'heavy',    name: 'BIG SHELL',      slots: 6, cost: 650, w: 30,
                stab: 1.01, rated: true, blurb: 'Six bays and the patience of a bank vault.' },
    /* CATALOG WAVE 1 (M3a) */
    thinwall: { id: 'thinwall', name: 'THIN-WALL SHELL', slots: 4, cost: 340, w: 13,
                stab: 0.62, fragile: true,
                blurb: 'Four bays at featherweight prices. Handles like a soap bubble with opinions — cook-off and handling risks up.' },
    segmented:{ id: 'segmented', name: 'SEGMENTED CASING', slots: 4, cost: 560, w: 24,
                stab: 0.84, rated: true, frag: true,
                blurb: 'Machine-scored squares vent a hot load a little — and join the blast as a visible frag spray.' }
  };
  /* thin-wall handling physics: the shell passes shocks through, the sun through too */
  var FRAGILE_SLAM_AMP = 1.3;
  var FRAGILE_COOK_BIAS = 0.10;
  /* fills wear stockroom designations (stencil = what's painted on the can);
     the crew abbreviates ("run the one-alpha"). Colour bands stay: amber /
     blue / violet — accessibility never depends on reading a stencil. */
  var COMPOUNDS = {
    ember:   { id: 'ember',   name: 'FILLER 1A', stencil: 'F-1A', energy: 10,  cost: 180, w: 6, heat: 1.0,  hue: 'amber',
               blurb: 'The workhorse fill. More bang, less patience. Wants room.' },
    frost:   { id: 'frost',   name: 'FILLER 2S', stencil: 'F-2S', energy: 3.5, cost: 120, w: 6, heat: 0,    hue: 'blue',
               blurb: 'The stabilized fill. Calm, steady, quietly judging the 1A.' },
    emberx:  { id: 'emberx',  name: 'FILLER 1X', stencil: 'F-1X', energy: 26,  cost: 0,   w: 6, heat: 1.25, hue: 'hot',
               blurb: 'The refined grade, from your own still. Brighter, bigger, twitchier.' },
    emberxs: { id: 'emberxs', name: 'SCORCHED F-1X', stencil: 'F-1X', energy: 20, cost: 0,  w: 6, heat: 1.35, hue: 'scorched',
               blurb: 'A refinery batch that got away from you. Weaker AND angrier.' },
    glaze:   { id: 'glaze',   name: 'ADDITIVE G-3', stencil: 'G-3', energy: 2,   cost: 0,   w: 6, heat: -0.9, hue: 'glaze',
               blurb: 'F-2S, poured slow over a line. Calms the load, forgives your hands, shrugs at the sun.' },
    /* CATALOG WAVE 1 (M3a) */
    trimcell: { id: 'trimcell', name: 'TRIM CELL ×¼', stencil: 'F-1A/4', energy: 2.5, cost: 60, w: 1.5, heat: 0.25, hue: 'amber', quarter: true,
               blurb: 'A quarter-can of 1A for the last half-metre. The precision doctrine, tinned.' },
    densepack:{ id: 'densepack', name: 'DENSE-PACK CELL', stencil: 'DP-1', energy: 16, cost: 300, w: 11, heat: 1.15, hue: 'dense', needsRated: true,
               blurb: 'Pressed fill. Twice the shove, none of the manners. Wants a STANDARD-rated shell under it.' },
    ballast:  { id: 'ballast',  name: 'INERT BALLAST', stencil: 'BAL-9', energy: 0, cost: 80, w: 9, heat: 0, hue: 'inert', lean: 7,
               blurb: 'Sand, certified. Moves the centre of mass and absolutely nothing else.' }
  };
  var PARTS = {
    timer:   { id: 'timer',   name: 'TIMER',       cost: 260, w: 2,  blurb: 'Counts to five. Unless you set the dial.' },
    battery: { id: 'battery', name: 'BATTERY',     cost: 140, w: 4,  blurb: 'Angry electrons, boxed.' },
    cap:     { id: 'cap',     name: 'WELL CAP',    cost: 90,  w: 1,  blurb: 'Keeps the desert out of the important hole.' },
    fins:    { id: 'fins',    name: 'FINS',        cost: 60,  w: 2,  blurb: 'Pure style. The device never flies.' },
    panel:   { id: 'panel',   name: 'ARM SWITCH',  cost: 110, w: 1,  blurb: 'One switch, one guard cover, zero excuses.' },
    /* CATALOG WAVE 1 (M3a) */
    batteryl:   { id: 'batteryl',   name: 'BATTERY PACK L', cost: 220, w: 7,
                  blurb: 'Twice the electrons, one spare AUX terminal. Dual-fuze ready, says the label. Eventually.' },
    harness:    { id: 'harness',    name: 'SHIELDED HARNESS', cost: 180, w: 2,
                  blurb: 'Braided sheath over every run. The inspector finds nothing to underline, and one continuity check rides free.' },
    delayrelay: { id: 'delayrelay', name: 'DELAY RELAY', cost: 150, w: 1.5,
                  blurb: 'Adds half a second. Exactly half a second. The only honest component in the drawer.' },
    impactfuze: { id: 'impactfuze', name: 'IMPACT FUZE NOSE', cost: 320, w: 3,
                  blurb: 'No countdown, no opinions. It fires when the ground asks it to.' },
    /* GUIDANCE (M3b wave 2) — the sealed drawer opens */
    gyro:       { id: 'gyro', name: 'GYRO CORE G-7', cost: 520, w: 4,
                  blurb: 'A spinning opinion about which way is straight. Aligned by hand, it cancels the load’s drift. Uncaged, it argues with the fins and wins.' }
  };
  var DELAY_RELAY_S = 0.5;   // the delay relay's fixed stage, stacked after the dial
  var PAINTS = [
    { id: null,     name: 'SHOP STEEL' },
    { id: 'grey2',  name: 'GOVERNMENT GREY No. 2', hex: 0x777f83 },
    { id: 'oxide',  name: 'RANGE OXIDE RED',       hex: 0x8a4a34 },
    { id: 'sand',   name: 'PAN SAND',              hex: 0xb9a06c }
  ];

  /* ---------- REFINERY ---------- */
  var REFINERY = {
    batchCost: 300,       // $ per run of the still (F-1A → F-1X)
    batchYield: 2,        // canisters per run
    holdSeconds: 8,       // time-in-band required
    scorchLimit: 2.0,     // seconds spent too hot before the batch scorches
    glazeCost: 220,       // $ per blend (F-2S → ADDITIVE G-3)
    glazeYield: 2,        // canisters per clean pour
    pourLo: 0.60,         // beaker target band (fraction of the line)
    pourHi: 0.72          // pour past this and the batch degrades
  };

  /* ADDITIVE G-3 effects (per canister aboard) */
  var GLAZE_SLAM_FORGIVE = 0.10;   // shaves recorded seating shock
  var GLAZE_COOK_SHIELD  = 0.10;   // extra cook-off resistance

  /* Halloran's crater-scaling law (invented): D = K * Y^P */
  var CR_K = 6.2, CR_P = 0.36;
  var CRATER_NOISE = 0.05;          // relative sigma, clean build
  var OFFSET_GAIN = 0.55;           // CoM lean → crater centre displacement
  var ELLIPSE_GAIN = 0.85;          // CoM lean → long-axis stretch
  var SLAM_THRESHOLD = 0.55;        // detonator handling shock, normalized

  /* ---------- THE WIRING STATION (M3) ----------
     Every device ships with a printed WIRING SCHEMATIC. The schematic is the
     puzzle: the drawing is tidy, the panel is not. Terminal numbers shuffle
     per series; component positions on the panel shuffle independently.
     Correctness is graded per RUN — each run wired right / wrong / missing
     feeds the failure machinery with a named root cause. */
  var SPOOLS = {
    red:    { id: 'red',    name: 'RED',    gauge: '12 AWG', duty: 'POWER'  },
    yellow: { id: 'yellow', name: 'YELLOW', gauge: '16 AWG', duty: 'SIGNAL' },
    green:  { id: 'green',  name: 'GREEN',  gauge: '14 AWG', duty: 'RETURN' }
  };
  var SPOOL_ORDER = ['red', 'yellow', 'green'];

  /* circuit tiers — the schematic complexity ladder (difficulty lives HERE) */
  var CIRCUITS = {
    t1: {  // RFP-041/044 — three components, three runs. A first-timer's circuit.
      key: 't1',
      comps: [
        { id: 'bat', name: 'BATTERY PACK',    stamp: 'DC-9',  pins: ['+', '−'] },
        { id: 'tmr', name: 'TIMER UNIT',      stamp: 'MK.4',  pins: ['IN', 'OUT'] },
        { id: 'det', name: 'DETONATOR BLOCK', stamp: 'DET-2', pins: ['A', 'B'] }
      ],
      runs: [
        { a: 'bat.0', b: 'tmr.0', color: 'red',    role: 'power',   label: 'BATTERY + → TIMER IN' },
        { a: 'tmr.1', b: 'det.0', color: 'yellow', role: 'command', label: 'TIMER OUT → DET LEAD A' },
        { a: 'det.1', b: 'bat.1', color: 'green',  role: 'return',  label: 'DET LEAD B → BATTERY −' }
      ],
      decoys: []
    },
    t2: {  // RFP-048/052 — a safety switch joins; the timer wants its own ground. 5 runs.
      key: 't2',
      comps: [
        { id: 'bat', name: 'BATTERY PACK',    stamp: 'DC-9',  pins: ['+', '−'] },
        { id: 'sw',  name: 'SAFETY SWITCH',   stamp: 'S-1',   pins: ['1', '2'] },
        { id: 'tmr', name: 'TIMER UNIT',      stamp: 'MK.4',  pins: ['IN', 'OUT', 'GND'] },
        { id: 'det', name: 'DETONATOR BLOCK', stamp: 'DET-2', pins: ['A', 'B'] }
      ],
      runs: [
        { a: 'bat.0', b: 'sw.0',  color: 'red',    role: 'power',   label: 'BATTERY + → SAFETY SW 1' },
        { a: 'sw.1',  b: 'tmr.0', color: 'red',    role: 'safety',  label: 'SAFETY SW 2 → TIMER IN' },
        { a: 'tmr.2', b: 'bat.1', color: 'green',  role: 'clock',   label: 'TIMER GND → BATTERY −' },
        { a: 'tmr.1', b: 'det.0', color: 'yellow', role: 'command', label: 'TIMER OUT → DET LEAD A' },
        { a: 'det.1', b: 'bat.1', color: 'green',  role: 'return',  label: 'DET LEAD B → BATTERY −' }
      ],
      decoys: []
    },
    t3: {  // RFP-055/057/060 — a relay carries the fire line. 6 runs.
      key: 't3',
      comps: [
        { id: 'bat', name: 'BATTERY PACK',    stamp: 'DC-9',  pins: ['+', '−'] },
        { id: 'sw',  name: 'SAFETY SWITCH',   stamp: 'S-1',   pins: ['1', '2'] },
        { id: 'tmr', name: 'TIMER UNIT',      stamp: 'MK.5',  pins: ['IN', 'OUT'] },
        { id: 'rly', name: 'RELAY',           stamp: 'K-9',   pins: ['COIL A', 'COIL B', 'SW'] },
        { id: 'det', name: 'DETONATOR BLOCK', stamp: 'DET-2', pins: ['A', 'B'] }
      ],
      runs: [
        { a: 'bat.0', b: 'sw.0',  color: 'red',    role: 'power',     label: 'BATTERY + → SAFETY SW 1' },
        { a: 'sw.1',  b: 'tmr.0', color: 'red',    role: 'safety',    label: 'SAFETY SW 2 → TIMER IN' },
        { a: 'tmr.1', b: 'rly.0', color: 'yellow', role: 'coil',      label: 'TIMER OUT → RELAY COIL A' },
        { a: 'rly.1', b: 'bat.1', color: 'green',  role: 'coilret',   label: 'RELAY COIL B → BATTERY −' },
        { a: 'rly.2', b: 'det.0', color: 'yellow', role: 'relaypath', label: 'RELAY SW → DET LEAD A' },
        { a: 'det.1', b: 'bat.1', color: 'green',  role: 'return',    label: 'DET LEAD B → BATTERY −' }
      ],
      decoys: []
    },
    ti: {  // RFP-066 — the NOSE FUZE replaces the timer; the drop provides the cue. 5 runs.
      key: 'ti',
      comps: [
        { id: 'bat', name: 'BATTERY PACK',    stamp: 'DC-9',  pins: ['+', '−'] },
        { id: 'sw',  name: 'SAFETY SWITCH',   stamp: 'S-1',   pins: ['1', '2'] },
        { id: 'nfz', name: 'NOSE FUZE',       stamp: 'NF-1',  pins: ['IN', 'OUT', 'GND'] },
        { id: 'det', name: 'DETONATOR BLOCK', stamp: 'DET-2', pins: ['A', 'B'] }
      ],
      runs: [
        { a: 'bat.0', b: 'sw.0',  color: 'red',    role: 'power',   label: 'BATTERY + → SAFETY SW 1' },
        { a: 'sw.1',  b: 'nfz.0', color: 'red',    role: 'safety',  label: 'SAFETY SW 2 → NOSE FUZE IN' },
        { a: 'nfz.2', b: 'bat.1', color: 'green',  role: 'clock',   label: 'NOSE FUZE GND → BATTERY −' },
        { a: 'nfz.1', b: 'det.0', color: 'yellow', role: 'command', label: 'NOSE FUZE OUT → DET LEAD A' },
        { a: 'det.1', b: 'bat.1', color: 'green',  role: 'return',  label: 'DET LEAD B → BATTERY −' }
      ],
      decoys: []
    },
    t4: {  // RFP-063 — capacitor bank + junction block; one N.C. red-herring pair. 7 runs.
      key: 't4',
      comps: [
        { id: 'bat', name: 'BATTERY PACK',    stamp: 'DC-9',  pins: ['+', '−'] },
        { id: 'tmr', name: 'TIMER UNIT',      stamp: 'MK.5',  pins: ['IN', 'OUT'] },
        { id: 'rly', name: 'RELAY',           stamp: 'K-9',   pins: ['COIL A', 'COIL B', 'SW IN', 'SW OUT'] },
        { id: 'cap', name: 'CAPACITOR BANK',  stamp: 'CB-3',  pins: ['CHG', 'OUT'] },
        { id: 'jct', name: 'JUNCTION BLOCK',  stamp: 'J-4',   pins: ['1', '2', '3', '4'] },
        { id: 'det', name: 'DETONATOR BLOCK', stamp: 'DET-2', pins: ['A'] }
      ],
      runs: [
        { a: 'bat.0', b: 'tmr.0', color: 'red',    role: 'power',     label: 'BATTERY + → TIMER IN' },
        { a: 'tmr.1', b: 'rly.0', color: 'yellow', role: 'coil',      label: 'TIMER OUT → RELAY COIL A' },
        { a: 'rly.1', b: 'jct.0', color: 'green',  role: 'coilret',   label: 'RELAY COIL B → JUNCTION 1' },
        { a: 'jct.1', b: 'bat.1', color: 'green',  role: 'return',    label: 'JUNCTION 2 → BATTERY −' },
        { a: 'bat.0', b: 'cap.0', color: 'red',    role: 'charge',    label: 'BATTERY + → CAP BANK CHG' },
        { a: 'cap.1', b: 'rly.2', color: 'yellow', role: 'bank',      label: 'CAP BANK OUT → RELAY SW IN' },
        { a: 'rly.3', b: 'det.0', color: 'yellow', role: 'relaypath', label: 'RELAY SW OUT → DET LEAD A' }
      ],
      decoys: ['jct.2', 'jct.3']   // N.C. — printed on the schematic, tempting on the panel
    }
  };
  var CIRCUIT_FOR_CONTRACT = ['t1', 't1', 't2', 't2', 't3', 't3', 't3', 't4', 'ti'];

  /* run role → failure class + plain narration */
  var RUN_FAIL = {
    power:     { type: 'nofire',   what: 'Battery power never left the pack.' },
    safety:    { type: 'nofire',   what: 'The safety interlock never joined the circuit — the device held itself politely at SAFE.' },
    clock:     { type: 'nofire',   what: 'The timer never found its return path. It counted, privately, to nothing.' },
    command:   { type: 'nofire',   what: 'The fire command left the timer and arrived nowhere in particular.' },
    coil:      { type: 'nofire',   what: 'The relay coil never saw the fire command. The contacts stayed open all the way down the count.' },
    coilret:   { type: 'misfire',  what: 'With its coil return adrift the relay chattered, and the circuit found its own way home' },
    'return':  { type: 'misfire',  what: 'With no ground return, the firing circuit found its own way home' },
    charge:    { type: 'weakfire', what: 'The capacitor bank never took its charge — the detonator fired on leftovers.' },
    bank:      { type: 'weakfire', what: 'The bank’s charge went to the relay by the scenic route and mostly stayed there.' },
    relaypath: { type: 'weakfire', what: 'The fire command crossed the wrong relay path — an arc where a contact should be.' }
  };
  var FAULT_PRIORITY = ['power', 'safety', 'clock', 'command', 'coil', 'coilret', 'charge', 'bank', 'relaypath', 'return'];

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
  /* lot-number stencils (`LOT 214-C` style) — seeded, purely for flavour */
  function lotNumber(seed, key) {
    var r = stream(String(seed), 'lot:' + key);
    var n = 100 + Math.floor(r() * 880);
    var L = 'ABCDEFHJKMNPRSTVWX';
    return 'LOT ' + n + '-' + L[Math.floor(r() * L.length)];
  }
  function makeSeed(rng) {
    var A = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
    var r = rng || Math.random, s = '';
    for (var i = 0; i < 5; i++) s += A[Math.floor(r() * A.length)];
    return s;
  }

  /* ---------- WIRING SPEC + SEEDED PANEL PLAN ---------- */
  function wiringSpec(rfp) {
    rfp = rfp || CONTRACTS[0];
    var idx = typeof rfp.idx === 'number' ? rfp.idx : 0;
    return CIRCUITS[CIRCUIT_FOR_CONTRACT[idx] || 't1'];
  }
  function pinIds(rfp) {
    var spec = wiringSpec(rfp), out = [];
    spec.comps.forEach(function (c) {
      c.pins.forEach(function (p, i) { out.push(c.id + '.' + i); });
    });
    return out;
  }
  function pinLabel(rfp, pin) {
    var spec = wiringSpec(rfp);
    var parts = String(pin).split('.');
    for (var i = 0; i < spec.comps.length; i++) {
      var c = spec.comps[i];
      if (c.id === parts[0]) return c.name + ' · ' + (c.pins[+parts[1]] != null ? c.pins[+parts[1]] : '?');
    }
    return String(pin);
  }
  function shuffled(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  /* stamped screw-terminal numbers — shuffled per series so the schematic must be READ */
  function termNumbers(seed, rfp) {
    var ids = pinIds(rfp);
    var nums = shuffled(ids.map(function (_, i) { return i + 1; }), stream(seed, 'terms:' + wiringSpec(rfp).key));
    var map = {};
    ids.forEach(function (id, i) { map[id] = nums[i]; });
    return map;
  }
  /* physical placement of components on the panel — shuffled per series,
     guaranteed to disagree with the schematic's tidy drawing order */
  function panelPlan(seed, rfp) {
    var spec = wiringSpec(rfp);
    var ids = spec.comps.map(function (c) { return c.id; });
    var cells = ids.slice();
    while (cells.length % 2) cells.push(null);        // 2-column board; blanks stay bare metal
    var plan = shuffled(cells, stream(seed, 'panel:' + spec.key));
    if (plan.filter(function (x) { return x; }).join(',') === ids.join(',')) {
      // never hand the drawing order back: swap the first two placed components
      var fi = -1, si = -1;
      for (var k = 0; k < plan.length; k++) {
        if (!plan[k]) continue;
        if (fi < 0) fi = k; else if (si < 0) { si = k; break; }
      }
      var tmp = plan[fi]; plan[fi] = plan[si]; plan[si] = tmp;
    }
    return { cols: 2, rows: plan.length / 2, cells: plan };
  }

  /* ---------- ASSEMBLY STATE (what the player physically did) ---------- */
  function makeAssembly() {
    return {
      shell: null,                       // shell id (see SHELLS)
      canisters: [],                     // per bay: compound id | null
      timer: false, battery: false, cap: false, fins: false, panel: false,
      batteryl: false, harness: false, delayrelay: false, impactfuze: false,
      gyro: false, gyroCal: null,       // guidance: installed + hand-aligned quality 0..1
      paint: null,                       // cosmetic finish — zero mechanics, pure ownership
      timerSet: null,                    // seconds set on the dial; null = factory 5.0
      refine: { spend: 0, stock: { emberx: 0, emberxs: 0, glaze: 0 } },
      conns: [],                         // installed wires: {a, b, color, torqued} (b null while dangling)
      verified: {},                      // runIdx → true once the continuity tester confirmed it
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
      var def = COMPOUNDS[c];
      var e = def.lean != null ? def.lean : Math.max(def.energy, 1);   // even G-3 weighs on the lean; ballast weighs hardest
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
    ['timer', 'battery', 'cap', 'fins', 'panel', 'batteryl', 'harness', 'delayrelay', 'impactfuze', 'gyro'].forEach(function (k) {
      if (a[k]) { cost += PARTS[k].cost; weight += PARTS[k].w; }
    });
    // DENSE-PACK wants a STANDARD-rated shell under it — a mis-fit never trucks out
    var badFit = !!(sh && !sh.rated && (a.canisters || []).some(function (c) { return c && COMPOUNDS[c].needsRated; }));
    var craterMean = filled > 0 ? CR_K * Math.pow(Y, CR_P) : 0;
    // instability: hot compounds loaded past the shell's calm allowance.
    // ADDITIVE G-3 runs cold (negative heat); a contract heat wave multiplies the rest.
    var heatMult = rfp.heatMult || 1;
    var hotFrac = sh ? Math.max(heat, 0) / sh.slots : 0;
    var effHot = hotFrac * heatMult;
    var severity = sh ? clamp((effHot - sh.stab) * 2.2, 0, 1) : 0;
    var glazeN = glazeCount(a);
    var cookRisk = 0;
    if (sh && heatMult > 1) {
      cookRisk = clamp((effHot - sh.stab - 0.08 + (sh.fragile ? FRAGILE_COOK_BIAS : 0) - GLAZE_COOK_SHIELD * glazeN) * 1.5, 0, 0.9);
    }
    var comX = comOf(a);
    // HUD estimate is deliberately rough — the range decides
    var spread = 0.13 + severity * 0.15;
    var missing = [];
    if (!a.shell) missing.push('shell');
    if (filled === 0) missing.push('canisters');
    if (rfp.impact) { if (!a.impactfuze) missing.push('impact fuze nose'); }
    else if (!a.timer) missing.push('timer');
    if (!a.battery && !a.batteryl) missing.push('battery');
    if (!a.cap) missing.push('well cap');
    if (!a.panel) missing.push('arm switch');
    if (badFit) missing.push('a STANDARD-rated shell (DENSE-PACK aboard)');
    return {
      cost: cost, weight: weight, yieldBd: Y,
      slots: sh ? sh.slots : 0, filled: filled, hotFrac: hotFrac,
      effHot: effHot, cookRisk: cookRisk, glazeN: glazeN,
      comX: comX,
      offsetMean: comX * craterMean * OFFSET_GAIN * gyroMul(a),   // metres, negative = WEST — the gyro has a say
      gyroMul: gyroMul(a),
      craterMean: craterMean,
      frag: !!(sh && sh.frag), badFit: badFit,
      bandLo: craterMean * (1 - spread),
      bandHi: craterMean * (1 + spread),
      severity: severity,
      missing: missing,
      complete: missing.length === 0,
      overBudget: cost > rfp.budget,
      overWeight: !!(rfp.weightCap && weight > rfp.weightCap)
    };
  }

  /* ---------- WIRING ANALYSIS (per-run grading) ---------- */
  function sameEnds(c, a, b) {
    return (c.a === a && c.b === b) || (c.a === b && c.b === a);
  }
  function completeConns(a) {
    return (a.conns || []).filter(function (c) { return c && c.a && c.b; });
  }
  /* per-run status: ok | wrong (a stray wire touched one end) | missing */
  function wireRuns(a, rfp) {
    rfp = rfp || CONTRACTS[0];
    var spec = wiringSpec(rfp);
    var conns = completeConns(a);
    var used = conns.map(function () { return false; });
    var out = spec.runs.map(function (run, i) {
      for (var ci = 0; ci < conns.length; ci++) {
        if (!used[ci] && sameEnds(conns[ci], run.a, run.b)) {
          used[ci] = true;
          return { idx: i, run: run, status: 'ok', conn: conns[ci],
                   colorOk: conns[ci].color === run.color, torqued: !!conns[ci].torqued };
        }
      }
      return { idx: i, run: run, status: 'missing', conn: null, colorOk: false, torqued: false };
    });
    // second pass: attribute stray wires to the run they half-landed
    out.forEach(function (r) {
      if (r.status !== 'missing') return;
      for (var ci = 0; ci < conns.length; ci++) {
        if (used[ci]) continue;
        var c = conns[ci];
        var touchA = (c.a === r.run.a || c.b === r.run.a);
        var touchB = (c.a === r.run.b || c.b === r.run.b);
        if (touchA !== touchB) {                 // exactly one end landed fair
          used[ci] = true;
          r.status = 'wrong';
          r.conn = c;
          r.sharedPin = touchA ? r.run.a : r.run.b;
          r.intendedPin = touchA ? r.run.b : r.run.a;
          r.landedPin = (c.a === r.sharedPin) ? c.b : c.a;
          return;
        }
      }
    });
    return out;
  }
  /* faulty runs, ordered by circuit consequence — the first one names the outcome */
  function wireFaults(a, seed, rfp) {
    rfp = rfp || CONTRACTS[0];
    return wireRuns(a, rfp)
      .filter(function (r) { return r.status !== 'ok'; })
      .sort(function (x, y) {
        var px = FAULT_PRIORITY.indexOf(x.run.role), py = FAULT_PRIORITY.indexOf(y.run.role);
        return px !== py ? px - py : x.idx - y.idx;
      });
  }
  function looseConns(a) {
    return completeConns(a).filter(function (c) { return !c.torqued; });
  }
  function wiringComplete(a, rfp) {
    rfp = rfp || CONTRACTS[0];
    var conns = a.conns || [];
    return completeConns(a).length === conns.length &&
           conns.length === wiringSpec(rfp).runs.length;
  }
  /* the continuity tester: clip two terminals, learn the truth about that run */
  function probe(a, rfp, pinA, pinB) {
    rfp = rfp || CONTRACTS[0];
    if (!pinA || !pinB || pinA === pinB) return { verdict: 'none', runIdx: -1, colorOk: true };
    var spec = wiringSpec(rfp);
    var runIdx = -1;
    spec.runs.forEach(function (r, i) {
      if ((r.a === pinA && r.b === pinB) || (r.a === pinB && r.b === pinA)) runIdx = i;
    });
    var conn = null;
    completeConns(a).forEach(function (c) { if (!conn && sameEnds(c, pinA, pinB)) conn = c; });
    if (conn && runIdx >= 0) return { verdict: 'correct', runIdx: runIdx, colorOk: conn.color === spec.runs[runIdx].color };
    if (conn) return { verdict: 'wrong', runIdx: -1, colorOk: true };       // wired, but no such run
    if (runIdx >= 0) return { verdict: 'open', runIdx: runIdx, colorOk: true };  // a run belongs here, nothing landed
    return { verdict: 'none', runIdx: -1, colorOk: true };
  }
  /* runs the tester has confirmed AND that are still wired that way */
  function verifiedRuns(a, rfp) {
    rfp = rfp || CONTRACTS[0];
    var v = a.verified || {};
    var okRuns = wireRuns(a, rfp).filter(function (r) { return r.status === 'ok'; });
    var n = okRuns.filter(function (r) { return v[r.idx]; }).length;
    // the SHIELDED HARNESS self-reports one run — one probe check rides free
    if (a.harness && n < okRuns.length) n += 1;
    return n;
  }
  /* electrically fine, stylistically noted: wrong-gauge runs draw an inspector aside */
  function wireStyle(a, rfp) {
    rfp = rfp || CONTRACTS[0];
    return wireRuns(a, rfp).filter(function (r) { return r.status === 'ok' && !r.colorOk; });
  }
  /* narration helpers for root causes */
  function runRef(spec, idx) { return 'run ' + (idx + 1) + ' (' + spec.runs[idx].label + ')'; }
  function describeFault(f, seed, rfp) {
    var spec = wiringSpec(rfp);
    var nums = termNumbers(seed, rfp);
    if (f.status === 'missing') return runRef(spec, f.idx) + ' was never landed on the panel';
    return runRef(spec, f.idx) + ' landed on terminal ' + nums[f.landedPin] + ' (' + pinLabel(rfp, f.landedPin) +
      '), not terminal ' + nums[f.intendedPin] + ' (' + pinLabel(rfp, f.intendedPin) + ')';
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

  /* GUIDANCE: an aligned gyro cancels drift; an uncaged one amplifies it.
     Multiplies every spatial error the load produces. */
  function gyroMul(a) {
    if (!a.gyro) return 1;
    if (a.gyroCal == null) return 1.28;                    // uncaged: it argues with the fins
    return clamp(1 - a.gyroCal * 0.85, 0.12, 1);
  }
  /* crater geometry from a resolved lean */
  function applyLean(o, seed, d, a, rfp) {
    var r = gauss(stream(seed, 'lean:' + loadKey(a)));
    var comXa = clamp(d.comX + r * 0.03, -1, 1);
    o.comX = comXa;
    if (rfp && rfp.impact) {
      // the drop drifts with the lean: landing point = crater centre
      o.offsetM = o.dropOff != null ? o.dropOff : 0;
    } else {
      o.offsetM = o.craterActual != null ? comXa * o.craterActual * OFFSET_GAIN * gyroMul(a) : 0;   // negative = WEST
    }
    o.ellipse = 1 + Math.abs(comXa) * ELLIPSE_GAIN;
  }
  /* SKIPSTONE: where the dropped article lands, relative to the plate centre */
  function dropPlan(a, seed, d, rfp) {
    var comXa = clamp(d.comX + gauss(stream(seed, 'lean:' + loadKey(a))) * 0.03, -1, 1);
    var scatterMul = a.gyro && a.gyroCal != null ? 1 - a.gyroCal * 0.55 : 1;
    var off = comXa * rfp.impact.drift * gyroMul(a) +
              gauss(stream(seed, 'drop:' + loadKey(a))) * rfp.impact.scatter * scatterMul;
    return { comX: comXa, off: off };
  }

  /* ---------- RESOLVE: assembly + seed (+ contract) → outcome ---------- */
  function resolve(a, seed, rfp) {
    rfp = rfp || CONTRACTS[0];
    var d = derive(a, rfp);
    var glazeN = d.glazeN;
    var shDef = a.shell ? SHELLS[a.shell] : null;
    var rawSlam = a.det.slam * (shDef && shDef.fragile ? FRAGILE_SLAM_AMP : 1);   // thin walls pass the shock through
    var effSlam = Math.max(0, rawSlam - GLAZE_SLAM_FORGIVE * glazeN);
    var tSet = timerSetOf(a) + (a.delayrelay ? DELAY_RELAY_S : 0);   // the relay stacks its half-second after the dial
    var dialErr = rfp.impact ? 0 : tSet - rfp.tSpec;   // impact articles take their cue from the plate
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
    /* SKIPSTONE: the drop is planned before anything fires — detT is relative to PLATE CONTACT */
    var drop = rfp.impact ? dropPlan(a, seed, d, rfp) : null;
    if (drop) o.dropOff = drop.off;

    /* 0 — Thermal cook-off: the sun does not read the paperwork. Hot-forecast
       contracts only; hot fill past the shell's rating can fire itself. */
    if (d.cookRisk > 0 && stream(seed, 'cookoff')() < d.cookRisk) {
      o.type = 'cookoff';
      o.fired = true;
      o.detT = -(1.2 + stream(seed, 'cookoffT')() * 2.6);
      o.craterActual = d.craterMean * 0.85 * (1 + craterNoise * (CRATER_NOISE + d.severity * 0.16));
      o.quality = 'ragged';
      applyLean(o, seed, d, a, rfp);
      o.rootCause = {
        phase: 'PAYLOAD',
        title: 'THERMAL COOK-OFF — THE SUN FIRED FIRST',
        cause: 'At pan temperature the fill reached its own conclusion ' + Math.abs(o.detT).toFixed(1) +
          ' seconds before the cue. The load ran ' + Math.round(d.effHot * 100) +
          '% hot against the ' + SHELLS[a.shell].name.toLowerCase() + '’s ' +
          Math.round(SHELLS[a.shell].stab * 100) + '% rating under the forecast. Nobody threw a switch. Nobody had to.',
        receipt: 'Root cause: hot fill under a ' + Math.round((rfp.heatMult || 1) * 100) +
          '% heat forecast — canister bays, Assembly Bay. FILLER 2S or ADDITIVE G-3 buys shade.',
        where: 'LOADOUT'
      };
      o.hint = 'The heat cooked it off before the cue. Balance the load — swap F-1A for F-2S, or pour ADDITIVE G-3 at the still.';
      return o;
    }

    /* 1 — Never armed: the funniest dud. Nothing else can happen without power. */
    if (!a.armed) {
      o.type = 'unarmed';
      o.rootCause = {
        phase: 'CLOSE-OUT',
        title: 'DUD — DEVICE NEVER ARMED',
        cause: 'T+' + rfp.tSpec.toFixed(1) + ' came and went. The device listened politely to the entire countdown and did nothing. Post-test inspection found the arming switch in the position marked SAFE, which is, to its credit, exactly what the placard promises.',
        receipt: 'Root cause: arming switch never thrown — arming station, Assembly Bay.',
        where: 'ARMING STATION'
      };
      o.hint = 'It never went off — the arm switch was still on SAFE. Flip it before you truck out.';
      return o;
    }

    /* 2 — Shock-sensitized detonator: chance of an off-cue pop once energized.
       ADDITIVE G-3 aboard pads the shock — the stabilizer forgives a firm hand. */
    if (o.pEarly > 0 && stream(seed, 'early')() < o.pEarly) {
      o.type = 'early';
      o.fired = true;
      if (rfp.impact) {
        // the shock-sensitized detonator lets go at the release jolt — a burst above the plate
        o.detT = -(0.15 + stream(seed, 'earlyT')() * 0.75);        // contact−0.15 … contact−0.9 (mid-fall)
        o.craterActual = d.craterMean * 0.55 * (1 + craterNoise * CRATER_NOISE);
        o.quality = 'ragged';
        applyLean(o, seed, d, a, rfp);
        o.offsetM = o.offsetM * 0.6;   // it never finished its drift
        o.rootCause = {
          phase: 'CLOSE-OUT',
          title: 'MID-AIR BURST — ' + Math.abs(o.detT).toFixed(1) + ' s ABOVE THE PLATE',
          cause: 'The release jolt was all the invitation the detonator needed. The handling log shows a shock impulse of ' +
            (a.det.slam * 9.8).toFixed(1) + ' brandt recorded at seating — the drop merely reminded it.',
          receipt: 'Root cause: detonator seated with a recorded shock impulse — detonator insertion, Assembly Bay. Slow is smooth, especially before a drop test.',
          where: 'DETONATOR INSERTION'
        };
        o.hint = 'It burst in the air, above the plate. Seat the detonator slowly — the release jolt wakes a slammed det.';
        return o;
      }
      o.detT = -(0.6 + stream(seed, 'earlyT')() * 3.0);            // cue−0.6 … cue−3.6
      o.craterActual = d.craterMean * (1 + craterNoise * (CRATER_NOISE + d.severity * 0.16)) * 0.96;
      o.quality = d.severity > 0.15 ? 'ragged' : 'clean';
      applyLean(o, seed, d, a, rfp);
      o.rootCause = {
        phase: 'CLOSE-OUT',
        title: 'OFF-CUE DETONATION — T−' + Math.abs(o.detT).toFixed(1) + ' s',
        cause: 'The detonator functioned before it was told to. The handling log shows a shock impulse of ' +
          (a.det.slam * 9.8).toFixed(1) + ' brandt recorded at seating — a detonator remembers being slammed the way a cat remembers a bath.',
        receipt: 'Root cause: detonator seated with a recorded shock impulse — detonator insertion, Assembly Bay. Slow is smooth.',
        where: 'DETONATOR INSERTION'
      };
      o.hint = 'It went off early. Seat the detonator slowly and gently — it remembers.';
      return o;
    }

    /* 2.5 — SKIPSTONE: a hard lean drops the article clean off the plate.
       The nose fuze wants square plate contact; sand takes it on the shoulder. */
    if (rfp.impact && Math.abs(drop.off) > rfp.impact.missLimit) {
      o.type = 'nosemiss';
      o.comX = drop.comX;
      o.offsetM = drop.off;
      o.rootCause = {
        phase: 'PAYLOAD',
        title: 'DUD — NOSE FUZE NEVER SAW THE PLATE',
        cause: 'The article drifted with its lean and came down ' + Math.abs(drop.off).toFixed(1) +
          ' m off the plate centre, shoulder first, in soft sand. The nose fuze never saw the plate — check the drop alignment. ' +
          'The drop alignment is the load: energy centre at ' + (drop.comX >= 0 ? '+' : '') + drop.comX.toFixed(2) + '.',
        receipt: 'Root cause: load arrangement — ' + describeLoad(a) +
          ' leans the drop off the plate — canister bays, Assembly Bay. Trim cells exist for exactly this.',
        where: 'DROP ALIGNMENT'
      };
      o.hint = 'It missed the plate and lay there. Ease the lean — rearrange the bays, or counterweight with TRIM CELLS.';
      return o;
    }

    /* 3 — Wiring faults, graded per RUN against the schematic. The first fault
       (in circuit-consequence order) names the outcome — traceably. */
    var faults = wireFaults(a, seed, rfp);
    if (faults.length) {
      var f = faults[0];
      var spec = wiringSpec(rfp);
      var fm = RUN_FAIL[f.run.role] || RUN_FAIL.power;
      var landed = describeFault(f, seed, rfp);
      var runN = f.idx + 1;
      o.faultRun = f.idx;
      if (fm.type === 'nofire') {
        o.type = 'nofire';
        o.rootCause = {
          phase: 'CLOSE-OUT',
          title: rfp.impact ? 'NO-FIRE ON PLATE CONTACT' : 'NO-FIRE AT T+' + rfp.tSpec.toFixed(1),
          cause: fm.what + ' The device held its charge and its opinion. Post-test continuity found the break: ' + landed + '.',
          receipt: 'Root cause: ' + landed + ' — wiring, Assembly Bay. The schematic was enclosed with the device.',
          where: 'WIRING'
        };
        o.hint = 'It never went off. Read run ' + runN + ' on the schematic (' + spec.runs[f.idx].label +
          ') and trace it on the panel — the continuity tester knows.';
        return o;
      }
      if (fm.type === 'misfire') {
        o.type = 'misfire';
        o.fired = true;
        var sign = stream(seed, 'misfireSign')() < 0.5 ? -1 : 1;
        o.detT = sign * (1.2 + stream(seed, 'misfireT')() * 1.8);    // ±1.2 … ±3.0 s off cue
        o.craterActual = d.craterMean * 0.55 * (1 + craterNoise * CRATER_NOISE);
        o.quality = 'partial';
        applyLean(o, seed, d, a, rfp);
        o.rootCause = {
          phase: 'CLOSE-OUT',
          title: rfp.impact ? 'MISFIRE — OFF THE CONTACT CUE' : 'MISFIRE — DETONATION OFF-CUE',
          cause: fm.what + ' — ' +
            (o.detT < 0 ? Math.abs(o.detT).toFixed(1) + ' seconds early' : o.detT.toFixed(1) + ' seconds late') +
            ' and at a fraction of its manners. ' + landed.charAt(0).toUpperCase() + landed.slice(1) + '.',
          receipt: 'Root cause: ' + landed + ' — wiring, Assembly Bay.',
          where: 'WIRING'
        };
        o.hint = 'It fired off-cue and weak. Check run ' + runN + ' (' + spec.runs[f.idx].label + ') against the schematic.';
        return o;
      }
      /* weak fire: the train functioned through the wrong path, on cue, at a fraction */
      o.type = 'weakfire';
      o.fired = true;
      o.detT = dialErr + timerNoise * 0.10;
      o.craterActual = d.craterMean * 0.45 * (1 + craterNoise * CRATER_NOISE);
      o.quality = 'partial';
      applyLean(o, seed, d, a, rfp);
      o.rootCause = {
        phase: 'CLOSE-OUT',
        title: 'WEAK FIRE — PARTIAL FUNCTION',
        cause: fm.what + ' A fraction of the contracted energy reached the fill. ' +
          landed.charAt(0).toUpperCase() + landed.slice(1) + '.',
        receipt: 'Root cause: ' + landed + ' — wiring, Assembly Bay.',
        where: 'WIRING'
      };
      o.hint = 'It fired on cue but weak. Check run ' + runN + ' (' + spec.runs[f.idx].label + ') — probe it before you truck out.';
      return o;
    }

    /* 4 — Loose terminal: intermittent contact starves the train. FIZZLE. */
    var loose = looseConns(a);
    if (loose.length > 0) {
      o.type = 'fizzle';
      o.fired = true;
      o.detT = dialErr + timerNoise * 0.12;
      o.craterActual = d.craterMean * 0.30 * (1 + craterNoise * CRATER_NOISE);
      o.quality = 'low-order';
      applyLean(o, seed, d, a, rfp);
      var c0 = loose[0];
      var nums0 = termNumbers(seed, rfp);
      o.rootCause = {
        phase: 'CLOSE-OUT',
        title: 'LOW-ORDER DETONATION (FIZZLE)',
        cause: 'Intermittent contact at terminal ' + nums0[c0.a] + ' starved the firing train. The fill deflagrated — a long, smoky sigh where a bang was contracted.',
        receipt: 'Root cause: the ' + c0.color + ' wire between terminals ' + nums0[c0.a] + ' and ' + nums0[c0.b] +
          ' landed fair but never torqued — terminal close-out, Assembly Bay. The ratchet was right there.',
        where: 'CLOSE-OUT'
      };
      o.hint = 'A smoky fizzle — a terminal was left loose. Twist every landed terminal down tight.';
      return o;
    }

    /* 5 — Clean circuit. Chemistry (and the dial, and the lean) decide. */
    o.fired = true;
    o.detT = rfp.impact ? timerNoise * 0.04 : dialErr + timerNoise * 0.06;   // plate contact keeps its own time
    var spread = CRATER_NOISE + d.severity * 0.16;
    o.craterActual = d.craterMean * (1 + craterNoise * spread);
    applyLean(o, seed, d, a, rfp);
    var inBand = o.craterActual >= rfp.craterMin && o.craterActual <= rfp.craterMax;
    var timingOk = Math.abs(o.detT) <= rfp.tTol;
    var offOk = true, westOff = -o.offsetM;
    if (rfp.offsetSpec) {
      offOk = westOff >= rfp.offsetSpec.min && westOff <= rfp.offsetSpec.max;
    }
    var plateOk = !rfp.impact || Math.abs(o.offsetM) <= rfp.impact.band;
    if (d.severity > 0.15) {
      o.type = 'ragged';
      o.quality = 'ragged';
      o.rootCause = {
        phase: 'PAYLOAD',
        title: 'RAGGED DETONATION',
        cause: 'Hot fill loaded past the ' + SHELLS[a.shell].name.toLowerCase() +
          '’s calm allowance (' + Math.round(d.effHot * 100) + '% hot vs ' +
          Math.round(SHELLS[a.shell].stab * 100) + '% rated' +
          ((rfp.heatMult || 1) > 1 ? ', heat forecast included' : '') + '). The blast came out sideways, in installments.',
        receipt: 'Root cause: fill loadout — canister bays, Assembly Bay. FILLER 1A wants room' +
          (rfp.needsRefinery ? ', or an ADDITIVE G-3 canister to hold its hand.' : '.'),
        where: 'LOADOUT'
      };
      o.hint = 'It blew ugly and lopsided. Hot canisters want room — a bigger shell, or swap some for F-2S' +
        (rfp.needsRefinery ? ' or G-3.' : '.');
    } else {
      o.type = 'clean';
      o.quality = 'clean';
      if (!inBand) {
        var small = o.craterActual < rfp.craterMin;
        var moreName = rfp.needsRefinery ? 'FILLER 1X' : 'FILLER 1A';
        var anyHot = (a.canisters || []).some(function (c) { return c && COMPOUNDS[c].heat > 0; });
        o.rootCause = {
          phase: 'PAYLOAD',
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
            (anyHot ? 'Ease off: swap some hot canisters for F-2S.' : 'Ease off: take a canister out.');
      } else if (!plateOk && rfp.impact) {
        o.rootCause = {
          phase: 'PAYLOAD',
          title: 'CRATER OFF THE PLATE BAND',
          cause: 'Clean function, wrong postcode: the article drifted with its lean and cratered ' +
            Math.abs(o.offsetM).toFixed(1) + ' m off the plate centre against a contracted ' +
            rfp.impact.band.toFixed(1) + ' m band. The blast goes where the load leans.',
          receipt: 'Root cause: load arrangement — ' + describeLoad(a) +
            ', energy centre at ' + (o.comX >= 0 ? '+' : '') + o.comX.toFixed(2) +
            ' — canister bays, Assembly Bay. Counterweight it: TRIM CELLS were invented for the last half-metre.',
          where: 'DROP ALIGNMENT'
        };
        o.hint = 'Crater ' + Math.abs(o.offsetM).toFixed(1) + ' m off the plate — the band is ' +
          rfp.impact.band.toFixed(1) + ' m. Balance the bays; a TRIM CELL opposite the heavy side buys the last metre.';
      } else if (!offOk && rfp.offsetSpec) {
        var wantDir = rfp.offsetSpec.dir === 'W' ? 'west' : 'east';
        o.rootCause = {
          phase: 'PAYLOAD',
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
          phase: 'SYSTEMS',
          title: 'DETONATION OFF THE CONTRACT CUE',
          cause: 'The device fired precisely when its dial told it to — T+' + tSet.toFixed(2) +
            (a.delayrelay ? ' (dial T+' + timerSetOf(a).toFixed(2) + ' + the relay\u2019s fixed ' + DELAY_RELAY_S.toFixed(1) + ' s)' : '') +
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
      bright: o.fired ? (o.type === 'fizzle' ? 0.3 : o.type === 'weakfire' ? 0.42 : 0.55 + yield01 * 0.45) : 0,
      ragged: o.quality === 'ragged' ? clamp(0.35 + d.severity * 0.65, 0, 1)
            : (o.type === 'misfire' ? 0.5 : o.type === 'weakfire' ? 0.45 : 0),
      fizzle: o.type === 'fizzle',
      dud: !o.fired,
      frag: !!(o.fired && d.frag),
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
    var impact = !!rfp.impact;

    var sizeOk = o.fired && o.craterActual != null &&
                 o.craterActual >= rfp.craterMin && o.craterActual <= rfp.craterMax;
    var timingOk = o.fired && o.detT != null && Math.abs(o.detT) <= rfp.tTol;
    var cleanOk = o.fired && o.quality === 'clean';
    var westOff = -(o.offsetM || 0);
    var offsetOk = shaped && o.fired &&
                   westOff >= rfp.offsetSpec.min && westOff <= rfp.offsetSpec.max;
    /* SKIPSTONE: PLACEMENT is distance off the plate; FUNCTION replaces the timing spec */
    var plateOk = impact && o.fired && Math.abs(o.offsetM || 0) <= rfp.impact.band;
    var funcOk = impact && o.fired && o.detT != null && Math.abs(o.detT) <= 0.25;

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
    if (impact) {
      stamps.place = { key: 'place', label: 'PLACEMENT', ok: plateOk,
        value: !o.fired ? (o.type === 'nosemiss' ? Math.abs(o.offsetM).toFixed(1) + ' m OFF PLATE' : 'NO CRATER')
          : Math.abs(o.offsetM || 0) < 0.8 ? 'PLATE CENTRE'
          : Math.abs(o.offsetM).toFixed(1) + ' m OFF',
        spec: '≤ ' + rfp.impact.band.toFixed(1) + ' m OF PLATE CENTRE' };
      stamps.func = { key: 'func', label: 'FUNCTION', ok: funcOk,
        value: !o.fired ? 'NO FUNCTION'
          : Math.abs(o.detT) <= 0.25 ? 'ON CONTACT'
          : o.detT < 0 ? 'MID-AIR' : 'LATE — T+' + o.detT.toFixed(1) + ' s',
        spec: 'DETONATE ON PLATE CONTACT' };
    }
    var stampList = impact ? [stamps.size, stamps.place, stamps.func]
                  : shaped ? [stamps.size, stamps.offset, stamps.timing]
                           : [stamps.size, stamps.timing, stamps.clean];

    var specMet = impact ? (sizeOk && plateOk && funcOk)
                : shaped ? (sizeOk && offsetOk && timingOk) : (sizeOk && timingOk);
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

    /* wrong-gauge runs: electrically fine, stylistically immortal */
    var styleRuns = wireStyle(a, rfp);
    var inspectorNote = null;
    if (styleRuns.length && !a.harness) {
      var s0 = styleRuns[0];
      inspectorNote = 'Run ' + (s0.idx + 1) + ' (' + s0.run.label + ') pulled in ' + SPOOLS[s0.conn.color].name +
        ' where the schematic calls for ' + SPOOLS[s0.run.color].name +
        (styleRuns.length > 1 ? ', and ' + (styleRuns.length - 1) + ' more run' + (styleRuns.length > 2 ? 's' : '') + ' besides' : '') +
        '. Electrically sound. Noted in the margin anyway — “COLOUR CODE, GENTLEMEN.” No action taken.';
    }

    /* segmented casing: the scored shell joins the blast — noted by survey */
    var fragNote = null;
    if (o.fired && d.frag) {
      var fragR = stream(seed, 'fragnote');
      fragNote = 'SEGMENTED CASING — the scoring let go as designed. Survey flags a spall ring of ' +
        (34 + Math.floor(fragR() * 30)) + ' fragments to ' + (o.craterActual ? (o.craterActual * (1.6 + fragR() * 0.5)).toFixed(0) : '40') +
        ' m. The board is impressed and stands well back.';
    }

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
          phase: null,
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
        phase: null,
        title: 'RESULT OUTSIDE SPECIFICATION',
        cause: 'The graph and the contract disagreed.',
        receipt: 'Root cause: see attached telemetry — Assembly Bay.',
        where: 'ASSEMBLY BAY'
      };
      incident = {
        form: 'FORM IR-3 (REV. 12)',
        series: 'TEST SERIES ' + seed,
        contractId: rfp.id,
        phase: rc.phase || null,
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
      inspectorNote: inspectorNote, fragNote: fragNote,
      wiring: { verified: verifiedRuns(a, rfp), total: wiringSpec(rfp).runs.length },
      payout: { award: award, bonus: bonus, cost: d.cost, net: net },
      vantage: v, flyoff: flyoff, incident: incident, seed: seed, rfp: rfp
    };
  }

  /* ================= M3b — THE WORKSHOP =================
     Free R&D, target objects, Type Certification, and the production
     economy. All of it resolves from build + seed, same as everything. */

  /* The bench answers to nobody: a pseudo-contract with no spec sheet.
     Timing carries no stamp — but the close-out still has to be RIGHT,
     because a dud on the range is a shot's worth of parts in the sand. */
  var RND_RFP = {
    idx: -1, id: 'R&D', title: 'WEAPONS ASSEMBLY', form: 'FORM RD-0000-R',
    craterMin: 0, craterMax: 0, meterMax: 44,
    budget: Infinity,                       // your own dime is the only cap
    tSpec: 5.0, tTol: 0.6,                  // FUNCTION window, not a stamp
    payout: 0, bonusClean: 0,
    timeOfDay: 'dusk',                      // R&D happens after hours
    wind: { dir: 290, speed: 0.3 },
    clause: 'No spec sheet. No board. Just you, the article, and an object that measures back.',
    needsRefinery: true                     // the still is your still
  };
  /* the hot-soak abuse variant: the certification oven, basically */
  var RND_RFP_HOT = (function () {
    var r = {};
    for (var k in RND_RFP) r[k] = RND_RFP[k];
    r.heatMult = 1.45;
    return r;
  })();

  /* ---------- TARGET OBJECTS (each measures differently) ---------- */
  var TARGETS = {
    truck: { id: 'truck', name: 'DERELICT HAULER', sub: 'K-9 FLATBED · RETIRED IN DISGRACE',
             metric: 'PENETRATION', unit: 'mm-e', floor: 55,
             blurb: 'Punch through the bed plate. Survey reads the hole in millimetres of plate-equivalent.',
             param: { key: 'mount', label: 'CHARGE MOUNT', options: [
               { id: 'contact', label: 'CONTACT', sub: 'strapped to the plate — deepest hole, least drama' },
               { id: 'standoff', label: 'STANDOFF', sub: 'a metre off the bed — shallower hole, the hauler travels' }
             ] } },
    wall:  { id: 'wall', name: 'WALL SECTION', sub: 'RC-4 CONCRETE · 60 CM · POURED TUESDAY',
             metric: 'BREACH', unit: '%', floor: 60,
             blurb: 'Open a door. Survey reads the breach as a percentage of the panel — off-centre hits open less of it.',
             param: { key: 'aim', label: 'AIM POINT', options: [
               { id: 'base', label: 'BASE', sub: 'the honest cut — full credit, forgiving of lean' },
               { id: 'center', label: 'CENTRE', sub: 'bigger door if you hit it — lean is punished double' },
               { id: 'top', label: 'LINTEL', sub: 'less breach, but past 70% the whole panel comes down' }
             ] } },
    array: { id: 'array', name: 'INSTRUMENT ARRAY', sub: '12 GAUGE PANELS · SET YOUR STANDOFF',
             metric: 'OVERPRESSURE', unit: 'br', floor: 18,
             blurb: 'Ring the gauges. Closer reads higher — but peg them past 62 br and the data dies with the glass.',
             param: { key: 'standoff', label: 'STANDOFF', options: [
               { id: '40', label: '40 M', sub: 'hot reading, real risk of pegging the gauges' },
               { id: '60', label: '60 M', sub: 'the book distance' },
               { id: '80', label: '80 M', sub: 'safe and modest — the gauges barely wake up' }
             ] } }
  };
  var TARGET_ORDER = ['truck', 'wall', 'array'];

  var QUAL_MULT = { clean: 1.0, ragged: 0.8, partial: 0.55, 'low-order': 0.4 };

  /* resolveTarget: full close-out physics (duds, slams, wiring faults all
     apply), then the object reads the blast its own way. */
  function resolveTarget(a, seed, targetId, opts) {
    opts = opts || {};
    var rfp = opts.hot ? RND_RFP_HOT : RND_RFP;
    var t = TARGETS[targetId] || TARGETS.truck;
    var param = opts.param || (t.param ? t.param.options[t.param.key === 'standoff' ? 1 : 0].id : null);
    var o = resolve(a, seed, rfp);
    var funcOk = o.fired && o.detT != null && Math.abs(o.detT) <= rfp.tTol;
    var out = { o: o, target: t, param: param, funcOk: funcOk, primary: null, measures: [], d: o.d };
    if (!o.fired) {
      out.measures.push({ lbl: t.metric, val: 'NO DATA', unit: '', sub: 'THE OBJECT DECLINES TO COMMENT' });
      return out;
    }
    var Ye = o.craterActual || 0;
    var qm = QUAL_MULT[o.quality] != null ? QUAL_MULT[o.quality] : 0.5;
    var off = Math.abs(o.offsetM || 0);
    if (t.id === 'truck') {
      // the test setup is part of the design: contact digs, standoff throws
      var mount = param === 'standoff' ? { pen: 0.78, toss: 1.5, sub: 'STANDOFF MOUNT' }
                                       : { pen: 1.22, toss: 0.55, sub: 'CONTACT MOUNT' };
      var pen = Math.pow(Ye, 1.12) * 2.4 * (o.d.frag ? 1.15 : 1) * qm * mount.pen;
      var toss = Ye * 0.32 * mount.toss;
      out.primary = Math.round(pen);
      out.toss = toss;
      out.measures.push({ lbl: 'PENETRATION', val: String(Math.round(pen)), unit: 'mm-e', sub: 'BED PLATE · ' + mount.sub });
      out.measures.push({ lbl: 'TOSS', val: toss.toFixed(1), unit: 'm', sub: 'WHERE THE HAULER WENT' });
    } else if (t.id === 'wall') {
      var aim = param === 'center' ? { mult: 1.15, offSens: 2.0, sub: 'AIMED AT CENTRE' }
              : param === 'top'    ? { mult: 0.78, offSens: 1.0, sub: 'AIMED AT THE LINTEL' }
                                   : { mult: 1.0, offSens: 1.0, sub: 'AIMED AT THE BASE' };
      var centred = 1 - Math.min(off * aim.offSens / 14, 0.55);
      var breach = clamp(Ye / 26, 0, 1.35) * 100 * qm * centred * aim.mult;
      out.primary = Math.round(breach);
      out.collapsed = param === 'top' && breach >= 70;   // the lintel goes, the panel follows
      out.measures.push({ lbl: 'BREACH', val: String(Math.round(breach)), unit: '%',
                          sub: out.collapsed ? 'LINTEL CUT — FULL PANEL DOWN' : 'OF PANEL · ' + aim.sub });
      out.measures.push({ lbl: 'HIT', val: off < 0.8 ? 'CENTRE' : off.toFixed(1) + ' m OFF', unit: '',
                          sub: 'OFF-CENTRE OPENS LESS DOOR' });
      if (out.collapsed) out.primary = Math.max(out.primary, 100);   // a downed panel is a 100% door
    } else {
      var dist = param === '40' ? 40 : param === '80' ? 80 : 60;
      var op = Math.pow(Ye, 0.92) * 2.6 * qm * Math.pow(60 / dist, 1.05);
      var pegged = op > 62;   // the gauges die with the glass
      var panels = clamp(Math.round(op / 6.5), 0, 12);
      out.pegged = pegged;
      out.primary = pegged ? null : Math.round(op * 10) / 10;
      out.measures.push(pegged
        ? { lbl: 'OVERPRESSURE', val: 'PEGGED', unit: '', sub: 'GAUGES OVERRANGE AT ' + dist + ' M — THE DATA DIED WITH THE GLASS' }
        : { lbl: 'OVERPRESSURE', val: out.primary.toFixed(1), unit: 'br', sub: 'PEAK, AT ' + dist + ' M' });
      out.measures.push({ lbl: 'PANELS', val: panels + ' / 12', unit: '', sub: 'SHATTERED, IN ORDER OF HONESTY' });
      out.panels = panels;
    }
    var tAbs = rfp.tSpec + o.detT;   // when it actually fired, on the range clock
    out.measures.push({ lbl: 'FUNCTION', val: funcOk ? 'ON CUE' : (o.detT < 0 ? 'EARLY' : 'LATE'), unit: '',
                        sub: 'T' + (tAbs >= 0 ? '+' : '−') + Math.abs(tAbs).toFixed(2) + ' s' });
    return out;
  }

  /* ---------- TYPE CERTIFICATION (three tests, design frozen) ---------- */
  var PLATE_NAMES = ['SLEDGE', 'MULE', 'KESTREL', 'ANVIL', 'LANTERN', 'BADGER', 'PICKAXE',
                     'HORNET', 'CALLIOPE', 'DITCH WITCH', 'POSTMASTER', 'JACKRABBIT'];
  function certCodename(seed) {
    var r = stream(seed, 'plate');
    return PLATE_NAMES[Math.floor(r() * PLATE_NAMES.length) % PLATE_NAMES.length];
  }
  function consistencyGrade(rel) {
    return rel <= 0.09 ? 'A' : rel <= 0.18 ? 'B' : rel <= 0.30 ? 'C' : 'F';
  }
  function certSeries(a, seed, targetId, param) {
    var t = TARGETS[targetId] || TARGETS.truck;
    var s1 = resolveTarget(a, seed + '§C1', targetId, { param: param });
    var s2 = resolveTarget(a, seed + '§C2', targetId, { param: param });
    /* abuse pick is seeded: the standards series owns its own dice */
    var abuseKind = stream(seed, 'abuse')() < 0.5 ? 'hotsoak' : 'washboard';
    var a3 = JSON.parse(JSON.stringify(a));
    if (abuseKind === 'washboard') a3.det = { seated: a.det.seated, slam: Math.min(1, (a.det.slam || 0) + 0.4) };
    var s3 = resolveTarget(a3, seed + '§C3', targetId, { hot: abuseKind === 'hotsoak', param: param });

    var perfOk = !!(s1.o.fired && s1.funcOk && s1.primary != null && s1.primary >= t.floor);
    var bothFired = s1.o.fired && s2.o.fired && s1.primary != null && s2.primary != null;
    var rel = bothFired ? Math.abs(s1.primary - s2.primary) / Math.max((s1.primary + s2.primary) / 2, 1e-6) : 1;
    var grade = bothFired ? consistencyGrade(rel) : 'F';
    var consOk = bothFired && grade !== 'F';
    var abuseOk = !!(s3.o.fired && s3.funcOk && s3.primary != null && s3.primary >= t.floor * 0.7);
    var pass = perfOk && consOk && abuseOk;

    var fired = [s1, s2, s3].filter(function (s) { return s.o.fired && s.primary != null; })
                            .map(function (s) { return s.primary; });
    var band = fired.length ? { lo: Math.min.apply(null, fired), hi: Math.max.apply(null, fired) } : null;
    function why(s, extra) {
      if (!s.o.fired) return (s.o.rootCause && s.o.rootCause.title) || 'NO FUNCTION';
      if (!s.funcOk) return 'FIRED OFF CUE';
      return extra || '';
    }
    return {
      pass: pass, target: t, grade: grade, rel: rel, band: band, abuseKind: abuseKind, param: param,
      shots: [s1, s2, s3],
      stamps: [
        { key: 'perf', label: 'PERFORMANCE', ok: perfOk,
          value: s1.primary != null && s1.o.fired ? s1.primary + ' ' + t.unit : 'NO DATA',
          spec: '≥ ' + t.floor + ' ' + t.unit + ' · ON CUE',
          note: perfOk ? '' : why(s1, s1.primary != null && s1.primary < t.floor ? 'UNDER THE FLOOR' : '') },
        { key: 'cons', label: 'CONSISTENCY', ok: consOk,
          value: bothFired ? 'GRADE ' + grade + ' (±' + Math.round(rel * 50) + '%)' : 'NO REPEAT',
          spec: 'TWO SHOTS, ONE NUMBER',
          note: consOk ? '' : (bothFired ? 'THE TWO SHOTS DISAGREED' : why(s2)) },
        { key: 'abuse', label: abuseKind === 'hotsoak' ? 'ABUSE · HOT SOAK' : 'ABUSE · WASHBOARD', ok: abuseOk,
          value: s3.primary != null && s3.o.fired ? s3.primary + ' ' + t.unit : 'NO DATA',
          spec: 'SURVIVE IT, STILL PERFORM',
          note: abuseOk ? '' : why(s3, 'FADED UNDER ABUSE') }
      ]
    };
  }

  /* ---------- THE PRODUCTION BID BOARD ---------- */
  var BUYERS = [
    'REPUBLIC PROVING AUTHORITY', 'HARBOUR BOARD (DEMOLITION ARM)', 'NAVY TEST DIRECTORATE',
    'ALLIED PROGRAMME NINE', 'BUREAU OF ROADS & GRIEVANCES', 'THE QUARRY CONSORTIUM',
    'FRONTIER SURVEY OFFICE', 'MINISTRY OF SANCTIONED NOISE'
  ];
  /* a type's quality score, 0..1 — what buyers actually pay for */
  function typeQ(type) {
    var g = { A: 1, B: 0.62, C: 0.32 }[type.grade] || 0.2;
    var perf = clamp(type.primary / (TARGETS[type.target].floor * 2), 0, 1);
    return clamp(g * 0.6 + perf * 0.4 - (type.incidents || 0) * 0.08, 0.05, 1);
  }
  /* the week's open orders — same week + same plates = same board */
  function genOrders(types, weekKey, rep) {
    var out = [];
    types.forEach(function (ty) {
      var r = stream(ty.plate + '·' + weekKey, 'orders');
      var n = 1 + (r() < clamp(0.25 + typeQ(ty) * 0.5, 0, 0.85) ? 1 : 0);
      for (var i = 0; i < n; i++) {
        var buyer = BUYERS[Math.floor(r() * BUYERS.length) % BUYERS.length];
        var units = 12 + Math.floor(r() * 53);                       // 12–64 units
        out.push({
          id: ty.plate + '-' + weekKey + '-' + (i + 1),
          plate: ty.plate, buyer: buyer, units: units,
          seedKey: ty.plate + '·' + weekKey + '·' + (i + 1)
        });
      }
    });
    return out;
  }
  /* the auction beat: bids climb; specs, grade and history set the ceiling */
  function auctionRun(type, order, rep) {
    var r = stream(order.seedKey, 'auction');
    var q = typeQ(type);
    var unitCost = Math.max(type.unitCost, 1);
    var base = unitCost * (1.3 + 0.55 * q + 0.04 * Math.min(rep || 0, 6) - 0.06 * (type.incidents || 0));
    var nBids = clamp(2 + Math.round(q * 2 + r() * 2 - (type.incidents || 0) * 0.7), 1, 6);
    var steps = [], u = base * 0.72;
    for (var i = 0; i < nBids; i++) {
      u = u * (1.04 + r() * 0.07);
      var buyer = i === nBids - 1 ? order.buyer : BUYERS[Math.floor(r() * BUYERS.length) % BUYERS.length];
      steps.push({ buyer: buyer, unit: Math.round(u / 5) * 5 });
    }
    var finalUnit = steps[steps.length - 1].unit;
    var revenue = finalUnit * order.units;
    var matCost = unitCost * order.units;
    return { steps: steps, finalUnit: finalUnit, revenue: revenue, matCost: matCost,
             net: revenue - matCost, durMin: clamp(Math.round(2 + order.units / 16), 2, 8) };
  }
  /* field QA: the customer's acceptance testing finds the design's true weak point */
  function qaRoll(type, order) {
    var r = stream(order.seedKey, 'qa');
    var q = typeQ(type);
    var p = clamp(0.26 - q * 0.18 + (type.incidents || 0) * 0.04, 0.04, 0.4);
    if (r() >= p) return null;
    var unit = 1 + Math.floor(r() * order.units);
    var t = TARGETS[type.target];
    var story;
    if (type.grade === 'C' || type.grade === 'B') {
      var pct = 6 + Math.floor(r() * 9);
      story = { title: 'FIELD QA CALLBACK — UNIT ' + unit + ' UNDER CARD',
        cause: 'Acceptance testing read unit ' + unit + ' at ' + pct + '% under the certified ' +
          t.metric.toLowerCase() + ' card. The card was honest; the spread was honest too — consistency grade ' +
          type.grade + ' is a promise about variance, and variance kept it.',
        receipt: 'Root cause: batch-to-batch spread inherited from the certified design. A calmer load certifies tighter and sells dearer.' };
    } else if (type.abuseKind === 'hotsoak') {
      story = { title: 'FIELD QA CALLBACK — HOT MAGAZINE',
        cause: 'The customer stored a pallet somewhere the certification oven only hinted at. Unit ' + unit +
          ' functioned, grudgingly, under the card. The customer’s letter uses the word "disappointed" twice.',
        receipt: 'Root cause: thermal margin — the design passed hot-soak with little to spare. ADDITIVE G-3 buys shade at scale, too.' };
    } else {
      story = { title: 'FIELD QA CALLBACK — TRANSPORT SHOCK',
        cause: 'Eleven miles of customer washboard found what the certification rig found: unit ' + unit +
          ' arrived with its detonator sulking. It fired late on the acceptance stand.',
        receipt: 'Root cause: handling margin — the design certified near its shock limit. It ships as gently as it was seated.' };
    }
    story.unit = unit;
    return story;
  }

  /* the intended R&D article — harness + tests */
  function cannedRnd(seed) {
    var a = makeAssembly();
    a.shell = 'standard';
    a.canisters = ['ember', 'ember', 'ember', 'frost'];
    return finish(a, seed, RND_RFP);
  }

  /* ---------- canned assemblies (harness + tests + validation sweeps) ---------- */
  function wireCorrect(a, seed, rfp) {
    rfp = rfp || CONTRACTS[0];
    a.conns = wiringSpec(rfp).runs.map(function (r) {
      return { a: r.a, b: r.b, color: r.color, torqued: true };
    });
    a.verified = {};
    return a;
  }
  function finish(a, seed, rfp) {
    a.timer = a.battery = a.cap = a.panel = a.fins = true;
    wireCorrect(a, seed, rfp);
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
      case 4:   // HOT PLATE: ADDITIVE G-3 holds FILLER 1A's hand under the sun
        a.shell = 'standard';
        a.canisters = ['ember', 'ember', 'ember', 'glaze'];
        a.refine = { spend: REFINERY.glazeCost, stock: { emberx: 0, emberxs: 0, glaze: 1 } };
        break;
      case 5:   // SHAPED: lopsided on purpose
        a.shell = 'standard';
        a.canisters = ['ember', 'ember', null, 'frost'];
        break;
      case 6:   // FEATHERWEIGHT: 1X + G-3 in the standard shell, under the cap
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
      case 8:   // SKIPSTONE: a trim cell counterweights the drop; the nose fuze takes the cue
        a.shell = 'standard';
        a.canisters = ['trimcell', 'ember', null, 'frost'];
        break;
    }
    finish(a, seed, CONTRACTS[idx]);
    if (CONTRACTS[idx].impact) { a.timer = false; a.impactfuze = true; }
    return a;
  }
  function cannedClean(seed) { return cannedFor(0, seed); }
  function cannedClean2(seed) { return cannedFor(2, seed); }

  /* ================= THE LONG SHOT PROGRAM =================
     Pick a target 1–5000 miles out; build an air-to-surface article from
     stepped components; dial in elevation, azimuth, fuel and gyro by hand.
     Range is the difficulty: a fraction of a degree that's nothing at
     5 miles is tens of miles at 5000. Careless dialing misses; a tight
     solution can bullseye any range. Deterministic from build+dials+seed. */
  var LS_AIRFRAMES = {
    dart:   { id: 'dart',   name: 'DART',   sub: 'LIGHT · TWITCHY',   mass: 340, stab: 0.55, cost: 2200 },
    lance:  { id: 'lance',  name: 'LANCE',  sub: 'BALANCED',          mass: 560, stab: 0.85, cost: 3400 },
    pillar: { id: 'pillar', name: 'PILLAR', sub: 'HEAVY · STEADY',    mass: 980, stab: 1.10, cost: 5200 }
  };
  var LS_MOTORS = {
    single: { id: 'single', name: 'SINGLE STAGE', sub: 'SHORT REACH',  reach: 320,  mass: 300,  cost: 2600 },
    dual:   { id: 'dual',   name: 'DUAL STAGE',   sub: 'MEDIUM REACH', reach: 1500, mass: 700,  cost: 6000 },
    triple: { id: 'triple', name: 'TRIPLE STAGE', sub: 'ICBM CLASS',   reach: 6000, mass: 1350, cost: 12000 }
  };
  var LS_GUIDANCE = {
    fin:     { id: 'fin',     name: 'FIN-STABILIZED', sub: 'BALLISTIC · UNFORGIVING', corr: 0.0,  driftK: 1.0,  cepBase: 0.0026, cost: 900 },
    inertial:{ id: 'inertial',name: 'INERTIAL (INS)', sub: 'CORRECTS · STEADY',       corr: 0.60, driftK: 0.42, cepBase: 0.0018, cost: 4200 },
    star:    { id: 'star',    name: 'STAR-TRACKER',   sub: 'SELF-CORRECTING · TIGHT',  corr: 0.85, driftK: 0.18, cepBase: 0.0010, cost: 9800 }
  };
  var LS_WARHEADS = {
    light:   { id: 'light',   name: 'LIGHT',        sub: 'FAR REACH · GRENADE POP',  mass: 90,  bang: 0.7, cost: 1400 },
    std:     { id: 'std',     name: 'STANDARD',     sub: 'THE SENSIBLE ONE',          mass: 180, bang: 1.0, cost: 2200 },
    heavy:   { id: 'heavy',   name: 'HEAVY',        sub: 'SHORT REACH · BIG BANG',    mass: 340, bang: 1.5, cost: 3800 },
    special: { id: 'special', name: 'THERMONUCLEAR', sub: 'CITY-KILLER · HEAVY & SLOW', mass: 620, bang: 3.0, cost: 9800 }
  };
  var LS_STEPS = [
    { key: 'airframe', label: 'AIRFRAME',  cat: LS_AIRFRAMES, order: ['dart', 'lance', 'pillar'] },
    { key: 'motor',    label: 'PROPULSION',cat: LS_MOTORS,    order: ['single', 'dual', 'triple'] },
    { key: 'guidance', label: 'GUIDANCE',  cat: LS_GUIDANCE,  order: ['fin', 'inertial', 'star'] },
    { key: 'warhead',  label: 'WARHEAD',   cat: LS_WARHEADS,  order: ['light', 'std', 'heavy', 'special'] }
  ];
  var LS_REF_DRY = 800;   // reference dry mass for the range penalty
  function lsBuildDefault() { return { airframe: 'lance', motor: 'dual', guidance: 'inertial', warhead: 'std' }; }
  function lsCapability(b) {
    var af = LS_AIRFRAMES[b.airframe], mo = LS_MOTORS[b.motor], gu = LS_GUIDANCE[b.guidance], wh = LS_WARHEADS[b.warhead];
    var dry = af.mass + wh.mass + 120;             // airframe + warhead + the guidance can
    var total = dry + mo.mass;
    // heavier articles reach less; a big motor still dominates
    var rangeMax = mo.reach * clamp(1.15 - (total - (LS_REF_DRY + mo.mass)) / (LS_REF_DRY * 1.6), 0.3, 1.25);
    rangeMax = Math.max(rangeMax, mo.reach * 0.3);
    var cost = af.cost + mo.cost + gu.cost + wh.cost;
    var accClass = gu.id === 'star' ? 'AAA' : gu.id === 'inertial' ? 'AA' : 'B';
    return { rangeMax: Math.round(rangeMax), mass: Math.round(total), cost: cost, accClass: accClass,
             stab: af.stab, guidance: gu, bang: wh.bang };
  }
  /* the intended solution: loft 45°, heading = bearing, burn-cutoff = the range */
  function lsOptimal(b, targetMi, bearingDeg) {
    var cap = lsCapability(b);
    return { elev: 45, azimuth: bearingDeg, rangeSet: Math.min(targetMi, cap.rangeMax), gyro: 1,
             rangeMax: cap.rangeMax, reachable: targetMi <= cap.rangeMax };
  }
  function angDiffDeg(a, b) { var d = ((a - b) % 360 + 540) % 360 - 180; return d; }   // signed −180..180
  /* real-time flight duration: 5mi≈5s, 1000mi≈45s, 5000mi≈~93s */
  function lsFlightTime(mi) { return clamp(2.587 * Math.pow(Math.max(mi, 1), 0.42), 4, 100); }
  /* dial: { elev(deg 20..70), azimuth(deg 0..360), rangeSet(miles, ≤rangeMax), gyro(0..1|null) } */
  var LS_TARGET_TYPES = {
    static:   { id: 'static',   name: 'FIXED INSTALLATION', sub: 'STANDS STILL · ANY WARHEAD' },
    hardened: { id: 'hardened', name: 'HARDENED BUNKER',    sub: 'NEEDS A HEAVY WARHEAD OR A DIRECT HIT' },
    moving:   { id: 'moving',   name: 'MOVING CONVOY',      sub: 'DRIFTS IN FLIGHT · LEAD IT' }
  };
  /* where a moving target will be at impact — solve the lead (2 iterations) */
  function lsIntercept(curMi, curBrg, speedMph, headingDeg, capReachMi) {
    var cx = curMi * Math.sin(curBrg * Math.PI / 180), cy = curMi * Math.cos(curBrg * Math.PI / 180);
    var hx = Math.sin(headingDeg * Math.PI / 180), hy = Math.cos(headingDeg * Math.PI / 180);
    var mi = curMi;
    for (var it = 0; it < 3; it++) {
      var dist = speedMph * lsFlightTime(mi) / 3600;
      var nx = cx + hx * dist, ny = cy + hy * dist;
      mi = Math.hypot(nx, ny);
    }
    var fx = cx + hx * (speedMph * lsFlightTime(mi) / 3600), fy = cy + hy * (speedMph * lsFlightTime(mi) / 3600);
    return { rangeMi: Math.round(Math.hypot(fx, fy)), bearingDeg: (Math.atan2(fx, fy) * 180 / Math.PI + 360) % 360 };
  }
  /* dial: {elev,azimuth,rangeSet,gyro}. aim* is the point to hit (intercept for
     moving). opts.hardened toggles the bunker kill rule. Position-based so any
     bearing/range works; static stays identical to before. */
  function lsResolve(b, dial, aimMi, aimBearing, seed, opts) {
    opts = opts || {};
    var cap = lsCapability(b), gu = cap.guidance, g = dial.gyro == null ? 0 : dial.gyro;
    var elevEff = Math.max(0, Math.sin(2 * dial.elev * Math.PI / 180));
    // THROTTLE: the burn-energy vernier. null → nominal 1 so every legacy dial
    // (and lsOptimal/lsCannedDial, which never set it) resolves byte-identical.
    var thr = dial.throttle == null ? 1 : dial.throttle;
    var achieved = Math.min(dial.rangeSet, cap.rangeMax) * elevEff * thr;
    var aRad = dial.azimuth * Math.PI / 180, tRad = aimBearing * Math.PI / 180;
    // where the missile flies (the aimed point) minus where the target is — pure
    // dial/aim skill, NEVER auto-corrected: the missile delivers to the coordinates
    // you set, and if you aimed wrong (or failed to lead a convoy) that's on you.
    var ex = (achieved * Math.sin(aRad) - aimMi * Math.sin(tRad));
    var ey = (achieved * Math.cos(aRad) - aimMi * Math.cos(tRad));
    var down  = ex * Math.sin(tRad) + ey * Math.cos(tRad);          // along the target bearing
    var cross = ex * Math.cos(tRad) - ey * Math.sin(tRad);          // perpendicular
    // dispersion — guidance sets your grouping, the gyro tightens it further
    var drift = gu.driftK * (1 - g) * gauss(stream(seed, 'ls:drift')) * aimMi * 0.010 / Math.max(cap.stab, 0.4);
    var cep = gu.cepBase * aimMi;
    down  += gauss(stream(seed, 'ls:cd')) * cep;
    cross += drift + gauss(stream(seed, 'ls:cc')) * cep;
    var reachable = aimMi <= cap.rangeMax * 1.02;
    var missMi = Math.hypot(down, cross);
    if (!reachable) { down = -(aimMi - cap.rangeMax); cross = 0; missMi = Math.abs(down); }
    var bull = Math.max(0.15, aimMi * 0.0016), hit = Math.max(0.5, aimMi * 0.006), near = Math.max(2.5, aimMi * 0.025);
    var grade, win, destroyed = null;
    if (opts.hardened) {
      var pen = cap.bang * (missMi <= bull ? 1.6 : missMi <= hit ? 1.0 : 0.25);
      destroyed = reachable && pen >= 1.15;
      win = destroyed;
      grade = !reachable ? 'FELL SHORT' : destroyed ? 'BUNKER DESTROYED'
            : missMi <= hit ? 'STRUCK — INTACT' : missMi <= near ? 'NEAR MISS' : 'MISS';
    } else {
      win = missMi <= hit && reachable;
      grade = missMi <= bull ? 'DIRECT HIT' : missMi <= hit ? 'ON TARGET' : missMi <= near ? 'NEAR MISS' : 'MISS';
    }
    var apogee = Math.min(dial.rangeSet, cap.rangeMax) * 0.22 * (0.5 + Math.sin(dial.elev * Math.PI / 180));
    return {
      hit: win, grade: grade, missMi: missMi, downMi: down, crossMi: cross, destroyed: destroyed,
      achievedMi: achieved, reachable: reachable, flightT: lsFlightTime(aimMi),
      apogeeMi: apogee, targetMi: aimMi, bearingDeg: aimBearing, cap: cap, cepMi: Math.round(cep * 10) / 10,
      hardened: !!opts.hardened
    };
  }
  /* a score for the record board: far + accurate + hard = high */
  function lsScore(res) {
    if (!res.hit) return 0;
    return Math.round(res.targetMi * (1 + 2 / (1 + res.missMi)) * (res.hardened ? 1.4 : 1));
  }
  /* one 0..1 yield scalar that drives the whole detonation — from a grenade
     pop (light warhead) to a thermonuclear mushroom (the special tier). */
  function lsYield(res) {
    var bang = res && res.cap ? res.cap.bang : 1;
    var q = (res && (res.grade === 'DIRECT HIT' || res.grade === 'BUNKER DESTROYED')) ? 1.2 : 1;
    var y01 = clamp((Math.log(bang * q) / Math.LN2 + 0.8) / 2.3, 0, 1);   // light≈0.12 heavy≈0.72 nuke→1
    var tier = y01 > 0.85 ? 'nuclear' : y01 > 0.6 ? 'heavy' : y01 > 0.3 ? 'conventional' : 'grenade';
    return { y01: y01, tier: tier, bang: bang };
  }
  /* a competent canned solution — harness + the 'nominal' hint */
  function lsCannedDial(b, aimMi, aimBearing) {
    var o = lsOptimal(b, aimMi, aimBearing);
    return { elev: o.elev, azimuth: o.azimuth, rangeSet: o.rangeSet, gyro: 0.95 };
  }

  return {
    CONTRACTS: CONTRACTS, CONTRACT_BY_ID: CONTRACT_BY_ID,
    RFP: CONTRACTS[0], CAMERA: CAMERA, SOUND_DELAY: SOUND_DELAY,
    SHELLS: SHELLS, COMPOUNDS: COMPOUNDS, PARTS: PARTS, REFINERY: REFINERY, PAINTS: PAINTS,
    DELAY_RELAY_S: DELAY_RELAY_S, FRAGILE_SLAM_AMP: FRAGILE_SLAM_AMP, FRAGILE_COOK_BIAS: FRAGILE_COOK_BIAS,
    SPOOLS: SPOOLS, SPOOL_ORDER: SPOOL_ORDER, RUN_FAIL: RUN_FAIL,
    SLAM_THRESHOLD: SLAM_THRESHOLD,
    GLAZE_SLAM_FORGIVE: GLAZE_SLAM_FORGIVE, GLAZE_COOK_SHIELD: GLAZE_COOK_SHIELD,
    OFFSET_GAIN: OFFSET_GAIN, ELLIPSE_GAIN: ELLIPSE_GAIN,
    stream: stream, gauss: gauss, clamp: clamp, makeSeed: makeSeed, lotNumber: lotNumber,
    wiringSpec: wiringSpec, pinIds: pinIds, pinLabel: pinLabel,
    termNumbers: termNumbers, panelPlan: panelPlan,
    makeAssembly: makeAssembly, derive: derive, describeLoad: describeLoad,
    comOf: comOf, glazeCount: glazeCount, timerSetOf: timerSetOf,
    wireRuns: wireRuns, wireFaults: wireFaults, looseConns: looseConns,
    wiringComplete: wiringComplete, probe: probe, verifiedRuns: verifiedRuns, wireStyle: wireStyle,
    resolve: resolve, visualFor: visualFor,
    simVantage: simVantage, simVantageFlyoff: simVantageFlyoff, adjudicate: adjudicate,
    wireCorrect: wireCorrect, cannedFor: cannedFor,
    cannedClean: cannedClean, cannedClean2: cannedClean2,
    /* M3b — the Workshop */
    RND_RFP: RND_RFP, TARGETS: TARGETS, TARGET_ORDER: TARGET_ORDER, BUYERS: BUYERS,
    resolveTarget: resolveTarget, certSeries: certSeries, certCodename: certCodename, gyroMul: gyroMul,
    typeQ: typeQ, genOrders: genOrders, auctionRun: auctionRun, qaRoll: qaRoll,
    cannedRnd: cannedRnd,
    /* The Long Shot Program */
    LS_AIRFRAMES: LS_AIRFRAMES, LS_MOTORS: LS_MOTORS, LS_GUIDANCE: LS_GUIDANCE, LS_WARHEADS: LS_WARHEADS, LS_STEPS: LS_STEPS,
    lsBuildDefault: lsBuildDefault, lsCapability: lsCapability, lsOptimal: lsOptimal,
    lsResolve: lsResolve, lsFlightTime: lsFlightTime, lsCannedDial: lsCannedDial, lsAngDiff: angDiffDeg,
    LS_TARGET_TYPES: LS_TARGET_TYPES, lsIntercept: lsIntercept, lsScore: lsScore, lsYield: lsYield
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PG2;
