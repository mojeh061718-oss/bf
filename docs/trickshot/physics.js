/* ============================================================
   TRICKSHOT OPEN — bespoke deterministic 2D ball simulator.
   World: meters, y-DOWN (matches canvas). Fixed step 240 Hz.
   No DOM. Importable in node (module.exports) or browser
   (window.TSPhysics). One dynamic circle vs static geometry.
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.TSPhysics = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DT = 1 / 240;          // simulation timestep (s)
  var G = 9.81;              // gravity (m/s^2, +y is down)
  var R = 0.18;              // ball radius (m) — arcade scale
  var KD = 0.0075;           // quadratic air drag coefficient
  var CM = 0.0042;           // Magnus coefficient (spin lift)
  var CS = 0.30;             // sidespin lateral curve coefficient
  var SPIN_AIR_DECAY = 0.10; // spin loss per second airborne
  var SPIN_GROUND_DECAY = 3.0;
  var MAX_SPEED = 23;        // launch speed at full draw (m/s)
  var GRIP_V = 0.68;         // slip -> tangential velocity coupling
  var GRIP_S = 3.0;          // slip -> spin change coupling
  var STICK_VN = 0.40;       // below this normal speed, bounce dies
  var REST_SPEED = 0.30;
  var REST_TIME = 0.25;

  /* Material alphabet — per-surface feel. rest: restitution,
     grip: tangential/spin bite, spinKeep: spin kept per bounce,
     rollRes: rolling resistance (1/s velocity decay grounded). */
  var MATERIALS = {
    concrete:  { rest: 0.60, grip: 0.28, spinKeep: 0.55, rollRes: 0.9 },
    grass:     { rest: 0.28, grip: 0.85, spinKeep: 0.50, rollRes: 2.2 },
    dumpster:  { rest: 0.93, grip: 0.26, spinKeep: 0.45, rollRes: 1.6 },
    awning:    { rest: 0.52, grip: 0.80, spinKeep: 0.55, rollRes: 3.4 },
    rail:      { rest: 0.92, grip: 0.06, spinKeep: 0.85, rollRes: 0.7 },
    gravel:    { rest: 0.10, grip: 0.60, spinKeep: 0.25, rollRes: 7.5 },
    container: { rest: 0.45, grip: 0.35, spinKeep: 0.50, rollRes: 1.4 },
    crate:     { rest: 0.38, grip: 0.50, spinKeep: 0.50, rollRes: 2.2 }
  };

  function makeBall(x, y) {
    return {
      x: x, y: y, vx: 0, vy: 0,
      spin: 0,        // rad/s; + = backspin (for rightward flight, lifts)
      side: 0,        // -1..1 sidespin; + curves right
      rest: true, holed: false, oob: false,
      restTimer: 0, grounded: false, groundMat: null,
      inMouth: false
    };
  }

  function clone(b) {
    return {
      x: b.x, y: b.y, vx: b.vx, vy: b.vy, spin: b.spin, side: b.side,
      rest: b.rest, holed: b.holed, oob: b.oob, restTimer: b.restTimer,
      grounded: b.grounded, groundMat: b.groundMat, inMouth: b.inMouth
    };
  }

  function launch(b, vx, vy, spin, side) {
    b.vx = vx; b.vy = vy;
    b.spin = spin || 0; b.side = side || 0;
    b.rest = false; b.holed = false; b.oob = false;
    b.restTimer = 0; b.grounded = false; b.inMouth = false;
  }

  /* Contact response: positional correction + impulse.
     Tangent convention t = (-ny, nx); contact slip u = vt + spin*R,
     so + spin (backspin) skids "forward" on a floor -> friction
     bites it backward. This is what makes flops suck back. */
  function resolve(b, nx, ny, pen, m, id, ev, allowEvents, cx, cy) {
    b.x += nx * pen; b.y += ny * pen;
    var vn = b.vx * nx + b.vy * ny;
    var tx = -ny, ty = nx;
    var vt = b.vx * tx + b.vy * ty;
    if (vn < 0) {
      var imp = -vn;
      var e = m.rest;
      if (imp < 1.2) e *= imp / 1.2;      // micro-impact -> deader (settling)
      var vnp = imp * e;
      if (vnp < STICK_VN) vnp = 0;
      var u = vt + b.spin * R;             // slip at contact
      var vtp = vt - m.grip * u * GRIP_V;
      b.spin = (b.spin - m.grip * u * GRIP_S) * m.spinKeep;
      b.vx = nx * vnp + tx * vtp;
      b.vy = ny * vnp + ty * vtp;
      if (allowEvents && ev && imp > 0.9) {
        ev.push({ type: 'bounce', mat: m._name, id: id, x: cx, y: cy, nx: nx, ny: ny, impact: imp });
      }
    }
    if (ny < -0.35) { b.grounded = true; b.groundMat = m; }
  }

  function collideSeg(b, s, ev, allowEvents) {
    var dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    var len2 = dx * dx + dy * dy;
    if (len2 === 0) return;
    var t = ((b.x - s.x1) * dx + (b.y - s.y1) * dy) / len2;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var cx = s.x1 + dx * t, cy = s.y1 + dy * t;
    var nx = b.x - cx, ny = b.y - cy;
    var d2 = nx * nx + ny * ny;
    if (d2 >= R * R || d2 < 1e-12) return;
    var d = Math.sqrt(d2);
    resolve(b, nx / d, ny / d, R - d, MATERIALS[s.mat], s.id, ev, allowEvents, cx, cy);
  }

  function collideCircle(b, c, ev, allowEvents) {
    var nx = b.x - c.x, ny = b.y - c.y;
    var rr = R + c.r;
    var d2 = nx * nx + ny * ny;
    if (d2 >= rr * rr || d2 < 1e-12) return;
    var d = Math.sqrt(d2);
    resolve(b, nx / d, ny / d, rr - d, MATERIALS[c.mat], c.id, ev, allowEvents, c.x, c.y);
  }

  /* One 240 Hz step. Pushes events into ev (optional array):
     bounce / rest / holed / oob / mouth. Pure & deterministic. */
  function step(b, world, ev) {
    if (b.rest || b.holed) return;

    var wind = world.wind || 0;
    var vrx = b.vx - wind, vry = b.vy;
    var vr = Math.sqrt(vrx * vrx + vry * vry);
    var ax = -KD * vrx * vr;
    var ay = G - KD * vry * vr;
    if (!b.grounded) {
      // Magnus: backspin (+) on rightward flight pushes up (-y)
      ax += CM * b.spin * b.vy;
      ay += -CM * b.spin * b.vx;
      var sp0 = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      ax += CS * b.side * sp0; // 2D shorthand for fade/draw curve
    }
    b.vx += ax * DT; b.vy += ay * DT;
    b.x += b.vx * DT; b.y += b.vy * DT;
    b.spin *= (1 - SPIN_AIR_DECAY * DT);

    b.grounded = false; b.groundMat = null;
    var i;
    for (var pass = 0; pass < 2; pass++) {
      var first = pass === 0;
      for (i = 0; i < world.segs.length; i++) collideSeg(b, world.segs[i], ev, first);
      for (i = 0; i < world.circles.length; i++) collideCircle(b, world.circles[i], ev, first);
    }

    var spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);

    if (b.grounded) {
      var f = 1 - b.groundMat.rollRes * DT;
      if (f < 0) f = 0;
      b.vx *= f; b.vy *= f;
      b.spin *= (1 - SPIN_GROUND_DECAY * DT);
      if (spd < REST_SPEED) {
        b.restTimer += DT;
        if (b.restTimer > REST_TIME) {
          b.rest = true; b.vx = 0; b.vy = 0; b.spin = 0; b.side = 0;
          if (ev) ev.push({ type: 'rest', x: b.x, y: b.y, mat: b.groundMat._name });
        }
      } else b.restTimer = 0;
    } else b.restTimer = 0;

    // container mouth trigger (for Dream Shot detection)
    if (world.inMouth) {
      var inside = world.inMouth(b.x, b.y);
      if (inside && !b.inMouth) { b.inMouth = true; if (ev) ev.push({ type: 'mouth' }); }
      else if (!inside) b.inMouth = false;
    }

    // cup capture: close & slow -> drop
    if (world.cup && !b.holed) {
      var cdx = b.x - world.cup.x, cdy = b.y - world.cup.y;
      if (cdx * cdx + cdy * cdy < world.cup.r * world.cup.r && spd < 3.4) {
        b.holed = true; b.rest = true;
        if (ev) ev.push({ type: 'holed', x: b.x, y: b.y });
      }
    }

    // out of play
    if (world.oob && (b.x < world.oob.minX || b.x > world.oob.maxX || b.y > world.oob.maxY)) {
      b.oob = true; b.rest = true;
      if (ev) ev.push({ type: 'oob', x: b.x, y: b.y });
    }
  }

  /* Predicted trajectory for aiming: first `seconds` of flight,
     truncated at the first surface contact (pre-bounce only). */
  function predict(ball, world, seconds, sampleEvery) {
    var b = clone(ball);
    b.rest = false; b.holed = false; b.oob = false;
    var pts = [];
    var steps = Math.floor(seconds / DT);
    for (var i = 0; i < steps; i++) {
      var ev = [];
      step(b, world, ev);
      var stop = b.grounded || b.holed || b.oob;
      for (var k = 0; k < ev.length; k++) if (ev[k].type === 'bounce') stop = true;
      if (i % sampleEvery === 0) pts.push(b.x, b.y);
      if (stop) break;
    }
    return pts;
  }

  // tag material names for events
  for (var mk in MATERIALS) MATERIALS[mk]._name = mk;

  return {
    DT: DT, G: G, R: R, MAX_SPEED: MAX_SPEED, MATERIALS: MATERIALS,
    makeBall: makeBall, clone: clone, launch: launch, step: step, predict: predict
  };
});
