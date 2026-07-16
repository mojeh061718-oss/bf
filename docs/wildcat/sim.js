/* ============================================================
   WILDCAT — sim.js
   Headless game core: seeded lease generation, market, drilling,
   pumping, economy. No DOM. Runs in the browser (window.WC) and
   in node (module.exports) for economy simulation / tuning.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- constants (the tuning surface) ---------- */
  var C = {
    W: 1000,               // world width (units)
    DEPTH: 1500,           // underground depth (units)
    SURF_MIN: 40,          // leftmost usable surface x
    SURF_MAX: 800,         // rightmost derrick x (depot lives right of this)
    BIT_SPEED: 42,         // units/s
    BIT_FAST_MULT: 1.5,
    TURN_RATE: 1.15,       // rad/s
    TURN_RATE_H: 2.1,
    MAX_ANG: 0.96,         // ~55 deg from vertical
    MAX_ANG_H: 1.55,       // ~89 deg
    ROCK_MULT: 0.16,       // grind speed multiplier
    ROCK_MULT_DIAMOND: 0.62,
    WEAR_RATE: 7,          // wear/s while grinding (bit dies at 100)
    PUMP_RATES: [0.55, 1.05, 1.6], // bbl/s by pump level
    TANK_CAPS: [60, 130, 240],     // bbl by tank level
    SELL_RATE: 12,         // bbl/s while sell held
    START_CASH: 300,
    START_DEBT: 1000,
    WIN_NW: 5000,
    INTEREST_EVERY: 12,    // seconds
    INTEREST_PCT: 0.012,   // of remaining debt, per tick
    SONAR_START: 3,
    CONE_TOP: 36,          // sonar cone half-width at surface
    CONE_BOT: 180,         // at full depth
    BLOWOUT_COOLDOWN: 9,   // s derrick offline
    BROKEN_COOLDOWN: 4,
    GAS_BONUS: 100,
    PRICE_BASE: 17,
    PRICE_MIN: 7,
    PRICE_MAX: 42,
    STAR3_T: 360,          // <= 6:00  -> 3 stars
    STAR2_T: 520           // <= 8:40  -> 2 stars
  };

  var UPGRADES = [
    { id: 'bit',      name: 'FASTER BIT',      costs: [250],      desc: 'Drill speed ×1.5 — the crown spins hot.' },
    { id: 'diamond',  name: 'DIAMOND BIT',     costs: [600],      desc: 'Chews straight through bedrock. Bit turns ice-blue.' },
    { id: 'bop',      name: 'BLOWOUT PREVENTER', costs: [500],    desc: 'Gas pockets pay +$100 instead of exploding.' },
    { id: 'tank',     name: 'BIGGER TANK',     costs: [400, 900], desc: 'Storage 130 / 240 bbl. Tank visibly grows.' },
    { id: 'pump',     name: 'PUMP RATE',       costs: [350, 800], desc: 'Pump 1.4 / 2.2 bbl per second.' },
    { id: 'derrick2', name: 'SECOND DERRICK',  costs: [1200],     desc: 'Run two wells at once.' },
    { id: 'horiz',    name: 'HORIZONTAL RIG',  costs: [700],      desc: 'Sharper steering — curve pipes sideways.' },
    { id: 'sonar',    name: 'SONAR CHARGE',    costs: [150],      desc: '+1 survey ping.', consumable: true }
  ];

  var SPIKE_NEWS = [
    'RAILROAD CONTRACT', 'REFINERY SHORTAGE', 'NAVY FUEL ORDER',
    'EASTERN SYNDICATE BUYS', 'PIPELINE OUTAGE', 'MOTORCAR CRAZE'
  ];

  /* ---------- seeded rng ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------- lease generation ---------- */
  function genLease(seed) {
    var rng = mulberry32((seed * 9301 + 49297) | 0);
    var lease = { seed: seed, pockets: [], gas: [], rocks: [], layers: [] };

    // sediment layer boundaries (render-only)
    var y = 0, li = 0;
    while (y < C.DEPTH) {
      var th = 130 + rng() * 190;
      lease.layers.push({ y: y, amp: 14 + rng() * 26, freq: 0.004 + rng() * 0.006, ph: rng() * 6.283, i: li++ });
      y += th;
    }

    // oil pockets: spec of depth-band + volume, placed w/ separation
    var specs = [
      { d0: 150, d1: 300, v: 60 },
      { d0: 320, d1: 500, v: 90 },
      { d0: 520, d1: 740, v: 130 },
      { d0: 760, d1: 1000, v: 160 },
      { d0: 1040, d1: 1330, v: 200 },
      { d0: 430, d1: 920, v: 85 }
    ];
    var placed = [];
    function farEnough(cx, cy, R, pad) {
      for (var i = 0; i < placed.length; i++) {
        var p = placed[i];
        var dx = cx - p.cx, dy = cy - p.cy;
        if (Math.sqrt(dx * dx + dy * dy) < R + p.R + pad) return false;
      }
      return true;
    }
    for (var s = 0; s < specs.length; s++) {
      var sp = specs[s], ok = false, cx = 0, cy = 0;
      var R = 24 + Math.sqrt(sp.v) * 4.0;
      for (var tr = 0; tr < 80 && !ok; tr++) {
        cx = 110 + rng() * 780;
        cy = sp.d0 + rng() * (sp.d1 - sp.d0);
        if (cx - R < 24 || cx + R > C.W - 24) continue;
        ok = farEnough(cx, cy, R, 70);
      }
      if (!ok) continue;
      var circles = [{ dx: 0, dy: 0, r: R * 0.72 }];
      var n = 4 + Math.floor(rng() * 2);
      for (var ci = 0; ci < n; ci++) {
        circles.push({
          dx: (rng() * 2 - 1) * R * 0.72,
          dy: (rng() * 2 - 1) * R * 0.34,
          r: R * (0.36 + rng() * 0.3)
        });
      }
      var pk = { type: 'oil', cx: cx, cy: cy, R: R, circles: circles, vol: sp.v, vol0: sp.v, struck: false };
      lease.pockets.push(pk);
      placed.push(pk);
    }

    // gas pockets (hazards)
    for (var gi = 0; gi < 3; gi++) {
      var gok = false, gx = 0, gy = 0, gR = 32 + rng() * 20;
      for (var gt = 0; gt < 80 && !gok; gt++) {
        gx = 100 + rng() * 800;
        gy = 240 + rng() * 950;
        gok = farEnough(gx, gy, gR, 60);
      }
      if (!gok) continue;
      var gc = [{ dx: 0, dy: 0, r: gR * 0.8 }];
      for (var g2 = 0; g2 < 3; g2++) {
        gc.push({ dx: (rng() * 2 - 1) * gR * 0.6, dy: (rng() * 2 - 1) * gR * 0.45, r: gR * (0.4 + rng() * 0.3) });
      }
      var gp = { type: 'gas', cx: gx, cy: gy, R: gR, circles: gc, alive: true };
      lease.gas.push(gp);
      placed.push(gp);
    }

    // bedrock slabs
    for (var bi = 0; bi < 8; bi++) {
      var bok = false, bx = 0, by = 0;
      var bw = 90 + rng() * 140, bh = 34 + rng() * 38, rot = (rng() * 2 - 1) * 0.24;
      for (var bt = 0; bt < 60 && !bok; bt++) {
        bx = 70 + rng() * 860;
        by = 140 + rng() * 1280;
        bok = true;
        for (var pi = 0; pi < placed.length; pi++) {
          var pp = placed[pi];
          var ddx = bx - pp.cx, ddy = by - pp.cy;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < pp.R + bw * 0.5 + 40) { bok = false; break; }
        }
        if (bok) {
          for (var ri = 0; ri < lease.rocks.length; ri++) {
            var rr = lease.rocks[ri];
            var rdx = bx - rr.x, rdy = by - rr.y;
            if (Math.sqrt(rdx * rdx + rdy * rdy) < (bw + rr.w) * 0.5 + 60) { bok = false; break; }
          }
        }
      }
      if (!bok) continue;
      lease.rocks.push({ x: bx, y: by, w: bw, h: bh, rot: rot });
    }
    return lease;
  }

  /* material sampling: 'rock' | 'gas' | 'oil' | 'dirt' (+index) */
  function materialAt(lease, x, y, r) {
    r = r || 6;
    var i, k;
    for (i = 0; i < lease.rocks.length; i++) {
      var rk = lease.rocks[i];
      var dx = x - rk.x, dy = y - rk.y;
      var cs = Math.cos(-rk.rot), sn = Math.sin(-rk.rot);
      var lx = dx * cs - dy * sn, ly = dx * sn + dy * cs;
      if (Math.abs(lx) < rk.w * 0.5 + r && Math.abs(ly) < rk.h * 0.5 + r) return { t: 'rock', i: i };
    }
    for (i = 0; i < lease.gas.length; i++) {
      var gp = lease.gas[i];
      if (!gp.alive) continue;
      for (k = 0; k < gp.circles.length; k++) {
        var gc = gp.circles[k];
        var gx = gp.cx + gc.dx - x, gy = gp.cy + gc.dy - y;
        if (gx * gx + gy * gy < (gc.r + r) * (gc.r + r)) return { t: 'gas', i: i };
      }
    }
    for (i = 0; i < lease.pockets.length; i++) {
      var pk = lease.pockets[i];
      if (pk.vol <= 0.5) continue;
      var sc = Math.sqrt(pk.vol / pk.vol0);
      if (sc < 0.22) sc = 0.22;
      for (k = 0; k < pk.circles.length; k++) {
        var c = pk.circles[k];
        var ox = pk.cx + c.dx * sc - x, oy = pk.cy + c.dy * sc - y;
        var rr = c.r * sc + r;
        if (ox * ox + oy * oy < rr * rr) return { t: 'oil', i: i };
      }
    }
    return { t: 'dirt', i: -1 };
  }

  /* ---------- market ---------- */
  function genMarket(seed) {
    var rng = mulberry32((seed * 7349 + 1013) | 0);
    var m = {
      p0: rng() * 6.283, p1: rng() * 6.283,
      nseed: (seed * 2654435761) | 0,
      spikes: []
    };
    var t = 42 + rng() * 26;
    var ni = Math.floor(rng() * SPIKE_NEWS.length);
    while (t < 1800) {
      var dur = 15 + rng() * 5;
      var mult = 1.32 + rng() * 0.33;
      m.spikes.push({
        t0: t, dur: dur, mult: mult,
        label: SPIKE_NEWS[ni % SPIKE_NEWS.length] + ' +' + Math.round((mult - 1) * 20) * 5 + '%'
      });
      ni++;
      t += dur + 38 + rng() * 42;
    }
    return m;
  }
  function noise1(seedI) {
    var t = (seedI + 0x9E3779B9) | 0;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    t = t ^ (t >>> 15);
    return ((t >>> 0) / 4294967296) * 2 - 1;
  }
  function marketNoise(m, t) {
    var k = t / 5;                    // knot every 5s
    var i = Math.floor(k), f = k - i;
    var a = noise1(m.nseed + i), b = noise1(m.nseed + i + 1);
    var u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  }
  function activeSpike(m, t) {
    for (var i = 0; i < m.spikes.length; i++) {
      var s = m.spikes[i];
      if (t >= s.t0 && t <= s.t0 + s.dur) return s;
      if (s.t0 > t) break;
    }
    return null;
  }
  function spikeMult(m, t) {
    var s = activeSpike(m, t);
    if (!s) return 1;
    var inR = clamp((t - s.t0) / 2, 0, 1);
    var outR = clamp((s.t0 + s.dur - t) / 2, 0, 1);
    var r = Math.min(inR, outR);
    var e = r * r * (3 - 2 * r);
    return 1 + (s.mult - 1) * e;
  }
  function priceOf(m, t) {
    var p = C.PRICE_BASE *
      (1 + 0.22 * Math.sin(t * 0.33 + m.p0) + 0.12 * Math.sin(t * 0.071 + m.p1) + 0.16 * marketNoise(m, t)) *
      spikeMult(m, t);
    return clamp(p, C.PRICE_MIN, C.PRICE_MAX);
  }

  /* ---------- game state ---------- */
  function createGame(seed) {
    var g = {
      seed: seed,
      t: 0,
      phase: 'play',            // play | won | lost
      winT: 0,
      lease: genLease(seed),
      market: genMarket(seed),
      cash: C.START_CASH,
      debt: C.START_DEBT,
      tank: 0,
      sonar: C.SONAR_START,
      upg: { bit: 0, diamond: 0, bop: 0, tank: 0, pump: 0, derrick2: 0, horiz: 0 },
      derricks: [],
      focus: -1,
      selling: false,
      saleAccum: 0, saleBbl: 0,
      nextInterest: C.INTEREST_EVERY,
      hist: [],
      histNext: 0,
      reveals: [],
      events: [],
      spikeOn: null,
      stats: { strikes: 0, drained: 0, bestSale: 0, blowouts: 0, captured: 0, upgrades: 0, revenue: 0, interestPaid: 0, sonars: 0 }
    };
    pushHist(g);
    return g;
  }

  function priceAt(g) { return priceOf(g.market, g.t); }
  function tankCap(g) { return C.TANK_CAPS[g.upg.tank]; }
  function pumpRate(g) { return C.PUMP_RATES[g.upg.pump]; }
  function maxDerricks(g) { return 1 + g.upg.derrick2; }
  function netWorth(g) { return g.cash + g.tank * priceAt(g) - g.debt; }
  function pushHist(g) {
    g.hist.push([g.t, netWorth(g)]);
    g.histNext = g.t + 2;
  }
  function grade(t) { return t <= C.STAR3_T ? 3 : (t <= C.STAR2_T ? 2 : 1); }

  /* ---------- actions ---------- */
  function fireSonar(g, x) {
    if (g.phase !== 'play' || g.sonar <= 0) return false;
    g.sonar--;
    g.stats.sonars++;
    x = clamp(x, C.SURF_MIN, C.W - 40);
    g.reveals.push({ type: 'cone', x: x, t: g.t });
    g.events.push({ type: 'sonar', x: x });
    return true;
  }

  function placeDerrick(g, x) {
    if (g.phase !== 'play') return { ok: false, reason: 'GAME OVER' };
    x = clamp(x, C.SURF_MIN, C.SURF_MAX);
    for (var i = 0; i < g.derricks.length; i++) {
      var od = g.derricks[i];
      if (od.state !== 'idle' && Math.abs(od.x - x) < 55) return { ok: false, reason: 'TOO CLOSE TO A RIG' };
    }
    var d = null, idx = -1;
    if (g.derricks.length < maxDerricks(g)) {
      d = {}; idx = g.derricks.length; g.derricks.push(d);
    } else {
      for (var j = 0; j < g.derricks.length; j++) {
        if (g.derricks[j].state === 'idle') { d = g.derricks[j]; idx = j; break; }
      }
      if (!d) return { ok: false, reason: 'ALL RIGS BUSY' };
    }
    d.x = x;
    d.state = 'drilling';
    d.bit = { x: x, y: 2, ang: 0 };
    d.pipe = [{ x: x, y: 0 }];
    d.steer = 0;
    d.wear = 0;
    d.pocket = -1;
    d.offlineUntil = 0;
    d.flow = 0;
    d.grind = false;
    d.brokenPipe = false;
    d.born = g.t;
    g.focus = idx;
    g.events.push({ type: 'spud', d: idx, x: x });
    return { ok: true, d: idx };
  }

  function setSteer(g, v) {
    if (g.focus < 0 || g.focus >= g.derricks.length) return;
    var d = g.derricks[g.focus];
    if (d.state === 'drilling') d.steer = clamp(v, -1, 1);
  }

  function setSelling(g, on) {
    on = !!on;
    if (on === g.selling) return;
    if (on) { g.saleAccum = 0; g.saleBbl = 0; }
    else if (g.saleBbl > 0.01) {
      if (g.saleAccum > g.stats.bestSale) g.stats.bestSale = g.saleAccum;
      g.events.push({ type: 'saleEnd', total: g.saleAccum, bbl: g.saleBbl });
    }
    g.selling = on;
  }

  function upgradeCost(g, id) {
    var def = null;
    for (var i = 0; i < UPGRADES.length; i++) if (UPGRADES[i].id === id) def = UPGRADES[i];
    if (!def) return null;
    if (def.consumable) return def.costs[0];
    var lvl = g.upg[id] || 0;
    if (lvl >= def.costs.length) return null;   // maxed
    return def.costs[lvl];
  }

  function buy(g, id) {
    if (g.phase !== 'play') return false;
    var cost = upgradeCost(g, id);
    if (cost === null || g.cash < cost) return false;
    g.cash -= cost;
    if (id === 'sonar') g.sonar++;
    else g.upg[id] = (g.upg[id] || 0) + 1;
    g.stats.upgrades++;
    g.events.push({ type: 'buy', id: id, cost: cost });
    return true;
  }

  function payLoan(g) {
    if (g.phase !== 'play' || g.debt <= 0) return 0;
    var pay = Math.min(Math.floor(g.cash), g.debt);
    if (pay <= 0) return 0;
    g.cash -= pay;
    g.debt -= pay;
    g.events.push({ type: 'loan', paid: pay, left: g.debt });
    return pay;
  }

  /* ---------- per-derrick stepping ---------- */
  function stepDerrick(g, d, di, h) {
    if (d.state === 'offline' || d.state === 'broken') {
      if (g.t >= d.offlineUntil) {
        d.state = 'idle';
        d.pipe = [];
        d.bit = null;
        d.brokenPipe = false;
      }
      return;
    }
    if (d.state === 'drilling') {
      var sp = C.BIT_SPEED * (g.upg.bit ? C.BIT_FAST_MULT : 1);
      var m = materialAt(g.lease, d.bit.x, d.bit.y, 7);
      d.grind = false;
      if (m.t === 'rock') {
        if (g.upg.diamond) sp *= C.ROCK_MULT_DIAMOND;
        else {
          sp *= C.ROCK_MULT;
          d.wear += C.WEAR_RATE * h;
          d.grind = true;
          if (d.wear >= 100) {
            d.state = 'broken';
            d.offlineUntil = g.t + C.BROKEN_COOLDOWN;
            g.events.push({ type: 'broken', d: di, x: d.bit.x, y: d.bit.y });
            return;
          }
        }
      }
      var tr = g.upg.horiz ? C.TURN_RATE_H : C.TURN_RATE;
      var mx = g.upg.horiz ? C.MAX_ANG_H : C.MAX_ANG;
      d.bit.ang = clamp(d.bit.ang + d.steer * tr * h, -mx, mx);
      d.bit.x = clamp(d.bit.x + Math.sin(d.bit.ang) * sp * h, 24, C.W - 24);
      d.bit.y += Math.cos(d.bit.ang) * sp * h;

      var lp = d.pipe[d.pipe.length - 1];
      var pdx = d.bit.x - lp.x, pdy = d.bit.y - lp.y;
      if (pdx * pdx + pdy * pdy > 16) d.pipe.push({ x: d.bit.x, y: d.bit.y });

      var m2 = materialAt(g.lease, d.bit.x, d.bit.y, 8);
      if (m2.t === 'gas') {
        var gp = g.lease.gas[m2.i];
        gp.alive = false;
        if (g.upg.bop) {
          g.cash += C.GAS_BONUS;
          g.stats.captured++;
          g.events.push({ type: 'capture', d: di, x: gp.cx, y: gp.cy, bonus: C.GAS_BONUS });
        } else {
          d.state = 'offline';
          d.offlineUntil = g.t + C.BLOWOUT_COOLDOWN;
          d.brokenPipe = true;
          d.steer = 0;
          g.stats.blowouts++;
          g.events.push({ type: 'blowout', d: di, x: gp.cx, y: gp.cy });
          return;
        }
      } else if (m2.t === 'oil') {
        var pk = g.lease.pockets[m2.i];
        d.state = 'pumping';
        d.pocket = m2.i;
        d.steer = 0;
        if (!pk.struck) { pk.struck = true; g.stats.strikes++; }
        g.reveals.push({ type: 'pocket', i: m2.i, t: g.t });
        g.events.push({ type: 'strike', d: di, i: m2.i, x: d.bit.x, y: d.bit.y });
        return;
      }
      if (d.bit.y >= C.DEPTH) {
        d.state = 'broken';   // dry hole -> short teardown, then idle
        d.offlineUntil = g.t + 2;
        g.events.push({ type: 'dry', d: di });
      }
      return;
    }
    if (d.state === 'pumping') {
      var pk2 = g.lease.pockets[d.pocket];
      var space = tankCap(g) - g.tank;
      var take = Math.min(pk2.vol, pumpRate(g) * h, Math.max(0, space));
      pk2.vol -= take;
      g.tank += take;
      d.flow = h > 0 ? take / h : 0;
      if (pk2.vol <= 0.01) {
        pk2.vol = 0;
        g.stats.drained++;
        d.state = 'idle';
        d.flow = 0;
        g.events.push({ type: 'drained', d: di, i: d.pocket });
      }
    }
  }

  /* ---------- main step ---------- */
  function step(g, dt) {
    if (g.phase !== 'play') return;
    var remaining = dt;
    while (remaining > 0 && g.phase === 'play') {
      var h = Math.min(remaining, 1 / 30);
      remaining -= h;
      stepOnce(g, h);
    }
  }

  function stepOnce(g, h) {
    g.t += h;

    // market spike edge events
    var sp = activeSpike(g.market, g.t);
    if (sp && g.spikeOn !== sp) { g.spikeOn = sp; g.events.push({ type: 'spike', label: sp.label, dur: sp.dur, until: sp.t0 + sp.dur }); }
    if (!sp && g.spikeOn) { g.spikeOn = null; g.events.push({ type: 'spikeEnd' }); }

    for (var i = 0; i < g.derricks.length; i++) stepDerrick(g, g.derricks[i], i, h);

    // selling stream
    if (g.selling && g.tank > 0.001) {
      var amt = Math.min(g.tank, C.SELL_RATE * h);
      var p = priceAt(g);
      g.tank -= amt;
      var gain = amt * p;
      g.cash += gain;
      g.saleAccum += gain;
      g.saleBbl += amt;
      g.stats.revenue += gain;
      if (g.tank <= 0.001) { g.tank = 0; setSelling(g, false); g.events.push({ type: 'tankEmpty' }); }
    }

    // loan interest
    if (g.debt > 0 && g.t >= g.nextInterest) {
      g.nextInterest += C.INTEREST_EVERY;
      var charge = Math.max(5, Math.round(g.debt * C.INTEREST_PCT));
      if (g.cash < charge) {
        var need = charge - g.cash;
        var pr = priceAt(g);
        var bbl = need / pr;
        if (g.tank >= bbl) {
          g.tank -= bbl;
          g.cash += need;
          g.events.push({ type: 'autosell', bbl: bbl, cash: need });
        } else {
          g.phase = 'lost';
          g.events.push({ type: 'lost', charge: charge });
          pushHist(g);
          return;
        }
      }
      g.cash -= charge;
      g.stats.interestPaid += charge;
      g.events.push({ type: 'interest', charge: charge });
    }

    // history samples
    if (g.t >= g.histNext) pushHist(g);

    // win check
    if (g.debt <= 0 && netWorth(g) >= C.WIN_NW) {
      g.phase = 'won';
      g.winT = g.t;
      pushHist(g);
      g.events.push({ type: 'won', t: g.t, stars: grade(g.t) });
    }
  }

  /* ---------- exports ---------- */
  var WC = {
    C: C, UPGRADES: UPGRADES,
    mulberry32: mulberry32, clamp: clamp,
    genLease: genLease, materialAt: materialAt,
    genMarket: genMarket, priceOf: priceOf, activeSpike: activeSpike,
    createGame: createGame, step: step,
    fireSonar: fireSonar, placeDerrick: placeDerrick, setSteer: setSteer,
    setSelling: setSelling, buy: buy, payLoan: payLoan, upgradeCost: upgradeCost,
    priceAt: priceAt, netWorth: netWorth, tankCap: tankCap, pumpRate: pumpRate,
    maxDerricks: maxDerricks, grade: grade
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = WC;
  if (typeof window !== 'undefined') window.WC = WC;
})();
