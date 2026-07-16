/* Bring It Down — simulation core (browser + node). Deterministic planck.js world. */
'use strict';
var Sim = (function () {
  var pl = (typeof planck !== 'undefined') ? planck : (typeof global !== 'undefined' ? global.planck : null);
  var Vec2 = pl.Vec2;

  // ---------------------------------------------------------------- level def
  var DEF = {
    storyH: 3.0,
    slabT: 0.55,
    colW: 0.52,
    tallLines: [0, 3.6, 7.2],
    tallFloors: 7,
    lowLines: [7.2, 10.8, 14.4],
    lowFloors: 3,
    diner: { x0: 19.2, x1: 24.8, h: 3.3 },
    zone: { x0: -5.2, x1: 16.2, maxY: 6.7 },
    winchX: -8.6,
    budget: 2400,
    timeline: 3.0,
    gravity: -10,
    dt: 1 / 120,
    colDensity: 430,
    slabDensity: 640,
    prices: { torch: 150, charge: 400, cable: 500 },
    maxCharges: 3,
    maxCables: 1
  };
  var COLH = DEF.storyH - DEF.slabT;

  // joint strength tuning: threshold = max(staticLoad * sf, base)
  var STRENGTH = {
    ground: { sfF: 2.8, baseF: 240e3, sfT: 2.6, baseT: 300e3 },
    colslab: { sfF: 2.1, baseF: 150e3, sfT: 2.2, baseT: 45e3 },
    prop: { sfF: 1.6, baseF: 14e3, sfT: 1.6, baseT: 9e3 }
  };
  var CHARGE = { breakR: 2.4, pushR: 3.1, kick: 2.8 };
  var CABLE = { force: 110e3, dur: 2.4, ramp: 0.25, vmax: 7 };

  // ---------------------------------------------------------------- helpers
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- run
  // plan: { tools: [ {type:'torch', memberId}
  //                  {type:'charge', memberId, lx, ly, t}
  //                  {type:'cable', memberId, lx, ly, t} ] }
  function createRun(plan) {
    var world = new pl.World({ gravity: Vec2(0, DEF.gravity) });
    world.setAllowSleeping(false); // off during calibration

    var members = [];
    var joints = [];
    var byId = {};
    var idSeq = 0;

    var ground = world.createBody({ position: Vec2(0, 0) });
    ground.createFixture(pl.Box(120, 3, Vec2(6, -3)), { density: 0, friction: 0.9 });
    ground.mLabel = 'ground';

    var d = DEF.diner;
    var diner = world.createBody({ position: Vec2(0, 0) });
    diner.createFixture(pl.Box((d.x1 - d.x0) / 2, d.h / 2, Vec2((d.x0 + d.x1) / 2, d.h / 2)), { density: 0, friction: 0.6 });
    diner.mLabel = 'diner';

    function addMember(kind, cx, cy, hw, hh, extra) {
      var density = kind === 'col' ? DEF.colDensity : DEF.slabDensity;
      if (kind === 'prop') density = extra.density || 260;
      var body = world.createDynamicBody({ position: Vec2(cx, cy), linearDamping: 0.012, angularDamping: 0.09 });
      body.createFixture(pl.Box(hw, hh), { density: density, friction: 0.68, restitution: 0.02 });
      var m = {
        id: idSeq++, kind: kind, body: body, hw: hw, hh: hh,
        line: extra && extra.line, floor: extra && extra.floor,
        x0: cx, y0: cy, stress: 0, cut: false
      };
      if (extra) for (var k in extra) if (m[k] === undefined) m[k] = extra[k];
      body.mMember = m;
      members.push(m); byId[m.id] = m;
      return m;
    }

    function weld(kind, mA, mB, ax, ay) {
      var bA = mA === 'ground' ? ground : mA.body;
      var bB = mB.body;
      var j = world.createJoint(pl.WeldJoint({}, bA, bB, Vec2(ax, ay)));
      var rec = { joint: j, kind: kind, a: mA, b: mB, ax: ax, ay: ay, broken: false, staticF: 0, staticT: 0, Fmax: 1e18, Tmax: 1e18 };
      joints.push(rec);
      return rec;
    }

    // --- build columns + slabs -------------------------------------------
    // wings: list of {lines, floors}
    var wings = [
      { lines: DEF.tallLines, floors: DEF.tallFloors, tag: 'tall' },
      { lines: DEF.lowLines, floors: DEF.lowFloors, tag: 'low' }
    ];
    var colAt = {}; // key line+'_'+floor -> member
    var slabsAtLevel = {}; // floor -> [slab]
    var li, fi, w;

    for (w = 0; w < wings.length; w++) {
      var wing = wings[w];
      for (li = 0; li < wing.lines.length; li++) {
        var x = wing.lines[li];
        for (fi = 1; fi <= wing.floors; fi++) {
          var key = x.toFixed(1) + '_' + fi;
          if (colAt[key]) continue; // shared line (corner core)
          var baseY = (fi - 1) * DEF.storyH;
          var m = addMember('col', x, baseY + COLH / 2, DEF.colW / 2, COLH / 2,
            { line: x, floor: fi, wing: wing.tag, core: (x === 7.2) });
          colAt[key] = m;
        }
      }
      for (li = 0; li < wing.lines.length - 1; li++) {
        var xa = wing.lines[li], xb = wing.lines[li + 1];
        for (fi = 1; fi <= wing.floors; fi++) {
          var cy = fi * DEF.storyH - DEF.slabT / 2;
          var hw = (xb - xa) / 2 - 0.03;
          var s = addMember('slab', (xa + xb) / 2, cy, hw, DEF.slabT / 2,
            { floor: fi, xa: xa, xb: xb, wing: wing.tag });
          (slabsAtLevel[fi] = slabsAtLevel[fi] || []).push(s);
        }
      }
    }

    // rooftop props for charm
    var tank = addMember('prop', 1.7, DEF.tallFloors * DEF.storyH + 0.95, 0.85, 0.95, { prop: 'tank', density: 300 });
    var ac = addMember('prop', 12.6, DEF.lowFloors * DEF.storyH + 0.42, 0.62, 0.42, { prop: 'ac', density: 220 });

    // --- joints ------------------------------------------------------------
    function slabsTouchingLine(level, x) {
      var out = [], arr = slabsAtLevel[level] || [];
      for (var i = 0; i < arr.length; i++) {
        var s = arr[i];
        if (Math.abs(s.xa - x) < 0.01 || Math.abs(s.xb - x) < 0.01) out.push(s);
      }
      return out;
    }
    members.forEach(function (m) {
      if (m.kind !== 'col') return;
      var x = m.line, f = m.floor;
      var botY = (f - 1) * DEF.storyH, topY = f * DEF.storyH - DEF.slabT;
      if (f === 1) {
        weld('ground', 'ground', m, x, 0);
      } else {
        slabsTouchingLine(f - 1, x).forEach(function (s) { weld('colslab', s, m, x, botY); });
      }
      slabsTouchingLine(f, x).forEach(function (s) { weld('colslab', m, s, x, topY); });
    });
    // props welded weakly to roof slabs
    weld('prop', slabsAtLevel[DEF.tallFloors][0], tank, 1.7, DEF.tallFloors * DEF.storyH);
    weld('prop', slabsAtLevel[DEF.lowFloors][3] || slabsAtLevel[DEF.lowFloors][slabsAtLevel[DEF.lowFloors].length - 1], ac, 12.6, DEF.lowFloors * DEF.storyH);

    // --- contact bookkeeping ----------------------------------------------
    var impacts = [];      // flushed each step
    var collateral = false;
    var collateralAt = null;
    world.on('begin-contact', function (c) {
      var a = c.getFixtureA().getBody(), b = c.getFixtureB().getBody();
      var din = a.mLabel === 'diner' ? a : (b.mLabel === 'diner' ? b : null);
      if (!din) return;
      var other = din === a ? b : a;
      if (other.isDynamic()) {
        collateral = true;
        if (!collateralAt) {
          var wm = c.getWorldManifold(null);
          var p = wm && wm.points && wm.points[0];
          collateralAt = p ? { x: p.x, y: p.y } : { x: other.getPosition().x, y: other.getPosition().y };
        }
      }
    });
    world.on('post-solve', function (c, imp) {
      var ni = imp && imp.normalImpulses;
      if (!ni || !ni.length) return;
      var mx = 0; for (var i = 0; i < ni.length; i++) if (ni[i] > mx) mx = ni[i];
      if (mx < 900) return;
      var wm = c.getWorldManifold(null);
      var p = wm && wm.points && wm.points[0];
      if (!p) return;
      if (impacts.length < 24) impacts.push({ x: p.x, y: p.y, imp: mx });
    });

    // --- calibration: settle & measure static loads ------------------------
    var invDt = 1 / DEF.dt;
    var i, s;
    for (i = 0; i < 130; i++) {
      world.step(DEF.dt, 10, 8);
      if (i >= 90) {
        for (var jn = 0; jn < joints.length; jn++) {
          var jr = joints[jn];
          var F = jr.joint.getReactionForce(invDt).length();
          var T = Math.abs(jr.joint.getReactionTorque(invDt));
          if (F > jr.staticF) jr.staticF = F;
          if (T > jr.staticT) jr.staticT = T;
        }
      }
    }
    var maxStaticF = 1;
    joints.forEach(function (jr) {
      var st = STRENGTH[jr.kind];
      jr.Fmax = Math.max(jr.staticF * st.sfF, st.baseF);
      jr.Tmax = Math.max(jr.staticT * st.sfT, st.baseT);
      if (jr.staticF > maxStaticF) maxStaticF = jr.staticF;
    });
    // per-member stress ratio for the stress view (0..1)
    members.forEach(function (m) { m.stress = 0; });
    joints.forEach(function (jr) {
      var r = jr.staticF / maxStaticF;
      if (jr.a !== 'ground' && r > jr.a.stress) jr.a.stress = r;
      if (r > jr.b.stress) jr.b.stress = r;
    });
    // gentle curve so mid-building reads yellow/orange
    members.forEach(function (m) { m.stress = Math.pow(m.stress, 0.62); });
    world.setAllowSleeping(true);
    // zero out any residual settle velocity so the run starts dead calm
    members.forEach(function (m) {
      m.body.setLinearVelocity(Vec2(0, 0));
      m.body.setAngularVelocity(0);
      m.body.setAwake(false);
      m.x0 = m.body.getPosition().x; m.y0 = m.body.getPosition().y;
      m.a0 = m.body.getAngle();
    });

    // --- run state ----------------------------------------------------------
    var run = {
      def: DEF, world: world, members: members, joints: joints, byId: byId,
      t: 0, started: false, done: false,
      brokenTotal: 0, brokenByStress: 0, firstFailAt: -1,
      collateral: function () { return collateral; },
      collateralPoint: function () { return collateralAt; }
    };
    var pending = [];   // scheduled tool events, sorted by t
    var cables = [];    // active cable pulls

    function destroyJointRec(jr, cause) {
      if (jr.broken) return null;
      jr.broken = true;
      world.destroyJoint(jr.joint);
      run.brokenTotal++;
      if (cause === 'stress') {
        run.brokenByStress++;
        if (run.firstFailAt < 0) run.firstFailAt = run.t;
      }
      var bB = jr.b.body;
      return { type: 'break', x: bB.getWorldPoint ? undefined : 0 };
    }

    function jointWorldAnchor(jr) {
      // anchor rides with body B
      return jr.joint.getAnchorB();
    }

    run.start = function () {
      if (run.started) return;
      run.started = true;
      pending = [];
      (plan && plan.tools ? plan.tools : []).forEach(function (tool) {
        var t = tool.type === 'torch' ? 0 : (tool.t || 0);
        pending.push({ t: t, tool: tool });
      });
      pending.sort(function (a, b) { return a.t - b.t; });
      members.forEach(function (m) { m.body.setAwake(true); });
    };

    function fireTool(tool, events) {
      var m = byId[tool.memberId];
      if (!m) return;
      if (tool.type === 'torch') {
        m.cut = true;
        joints.forEach(function (jr) {
          if (jr.broken) return;
          if (jr.a === m || jr.b === m) destroyJointRec(jr, 'tool');
        });
        m.body.setAwake(true);
        events.push({ type: 'cut', x: m.body.getPosition().x, y: m.body.getPosition().y });
      } else if (tool.type === 'charge') {
        var p = m.body.getWorldPoint(Vec2(tool.lx, tool.ly));
        var px = p.x, py = p.y;
        joints.forEach(function (jr) {
          if (jr.broken) return;
          var a = jointWorldAnchor(jr);
          var dx = a.x - px, dy = a.y - py;
          if (dx * dx + dy * dy < CHARGE.breakR * CHARGE.breakR) destroyJointRec(jr, 'tool');
        });
        members.forEach(function (mm) {
          var c = mm.body.getPosition();
          var dx = c.x - px, dy = c.y - py;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CHARGE.pushR) {
            var fall = 1 - dist / CHARGE.pushR;
            var nl = dist > 0.001 ? 1 / dist : 0;
            var vx = dx * nl, vy = dy * nl + 0.18;
            var imp = mm.body.getMass() * CHARGE.kick * fall;
            mm.body.setAwake(true);
            mm.body.applyLinearImpulse(Vec2(vx * imp, vy * imp), c, true);
            mm.body.applyAngularImpulse(imp * 0.12 * (c.x < px ? -1 : 1), true);
          }
        });
        events.push({ type: 'boom', x: px, y: py });
      } else if (tool.type === 'cable') {
        // spread the pull over the anchor member and its jointed neighbours,
        // like a real choker hitch — a single body would just rip out.
        var crew = [m];
        joints.forEach(function (jr) {
          if (jr.broken) return;
          if (jr.a === m && crew.indexOf(jr.b) < 0) crew.push(jr.b);
          else if (jr.b === m && jr.a !== 'ground' && crew.indexOf(jr.a) < 0) crew.push(jr.a);
        });
        cables.push({ m: m, crew: crew, lx: tool.lx, ly: tool.ly, t0: run.t, tool: tool });
        m.body.setAwake(true);
        var wp0 = m.body.getWorldPoint(Vec2(tool.lx, tool.ly));
        events.push({ type: 'cablego', x: wp0.x, y: wp0.y });
      }
    }

    // one fixed step; returns events for fx layer
    run.step = function () {
      var events = [];
      if (run.done) return events;
      // fire pending tools
      while (pending.length && pending[0].t <= run.t + 1e-9) {
        fireTool(pending.shift().tool, events);
      }
      // cable forces
      for (i = 0; i < cables.length; i++) {
        var cb = cables[i];
        var age = run.t - cb.t0;
        if (age > CABLE.dur) continue;
        var wp = cb.m.body.getWorldPoint(Vec2(cb.lx, cb.ly));
        var dx = DEF.winchX - wp.x, dy = 0.4 - wp.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var ramp = Math.min(1, age / CABLE.ramp);
        var f = CABLE.force * ramp;
        var ux = dx / len, uy = dy / len;
        // 55% on the anchor member, remainder split across its neighbours
        var n = cb.crew.length;
        for (var ci = 0; ci < n; ci++) {
          var body = cb.crew[ci].body;
          var vel = body.getLinearVelocity();
          if (vel.x * ux + vel.y * uy > CABLE.vmax) continue; // winch can't reel faster
          var share = n === 1 ? 1 : (ci === 0 ? 0.55 : 0.45 / (n - 1));
          body.setAwake(true);
          body.applyForce(Vec2(ux * f * share, uy * f * share),
            ci === 0 ? wp : body.getPosition(), true);
        }
        cb.active = true;
      }
      impacts.length = 0;
      world.step(DEF.dt, 10, 8);
      run.t += DEF.dt;
      // break overloaded joints
      for (i = 0; i < joints.length; i++) {
        var jr = joints[i];
        if (jr.broken) continue;
        var F = jr.joint.getReactionForce(invDt).length();
        var T = Math.abs(jr.joint.getReactionTorque(invDt));
        if (F > jr.Fmax || T > jr.Tmax) {
          var a = jointWorldAnchor(jr);
          destroyJointRec(jr, 'stress');
          events.push({ type: 'break', x: a.x, y: a.y });
        }
      }
      for (i = 0; i < impacts.length; i++) {
        var im = impacts[i];
        events.push({ type: 'impact', x: im.x, y: im.y, imp: im.imp });
      }
      return events;
    };

    run.activeCables = function () {
      var out = [];
      for (var i = 0; i < cables.length; i++) {
        var cb = cables[i];
        if (run.t - cb.t0 <= CABLE.dur) {
          var wp = cb.m.body.getWorldPoint(Vec2(cb.lx, cb.ly));
          out.push({ x: wp.x, y: wp.y });
        }
      }
      return out;
    };

    run.agitation = function () {
      var s = 0;
      for (var i = 0; i < members.length; i++) {
        var b = members[i].body;
        if (!b.isAwake()) continue;
        s += b.getLinearVelocity().length() * b.getMass();
      }
      return s;
    };

    run.score = function () {
      var massIn = 0, massTotal = 0;
      var z = DEF.zone;
      members.forEach(function (m) {
        var mass = m.body.getMass();
        massTotal += mass;
        var p = m.body.getPosition();
        if (p.x >= z.x0 && p.x <= z.x1 && p.y <= z.maxY) massIn += mass;
      });
      var pct = massTotal > 0 ? (massIn / massTotal) * 100 : 0;
      return { pct: pct, massIn: massIn, massTotal: massTotal, collateral: collateral };
    };

    return run;
  }

  return { DEF: DEF, createRun: createRun, mulberry32: mulberry32, CHARGE: CHARGE, CABLE: CABLE, STRENGTH: STRENGTH };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
