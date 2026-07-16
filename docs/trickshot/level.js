/* ============================================================
   TRICKSHOT OPEN — Hole 3: "LOADING BAY" (Par 3)
   Geometry + materials + triggers. Pure data, no DOM.
   y-DOWN, meters. Ground (alley floor) at y = 24.

   Lines authored into this hole:
   (a) BANK  — pitch onto the springy dumpster lid; it kicks the
       ball high and right, dropping it at the container mouth.
   (b) FLOP  — lay up to the grass in front of the container,
       then flop with heavy BACKSPIN onto the awning fabric;
       it bites, dribbles down the slope and drips off the tip
       straight through the mouth.
   (c) DREAM — a hard low liner from the tee threads under the
       awning tip, smacks the thin metal support rail, and gets
       slammed down-left directly through the container mouth.
       Hole-in-one. Rail hit -> mouth = gold badge.
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.TSLevel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function build() {
    var segs = [], circles = [];
    function seg(x1, y1, x2, y2, mat, id) {
      segs.push({ x1: x1, y1: y1, x2: x2, y2: y2, mat: mat, id: id });
    }

    var GY = 24;        // alley floor
    var ROOF = 13;      // tee rooftop height

    // --- Left building: tee rooftop ---
    seg(-0.6, ROOF, 7.5, ROOF, 'concrete', 'roofL');
    seg(7.5, ROOF, 7.5, GY, 'concrete', 'wallL');

    // --- Alley floor: concrete / gravel (dead) / grass (soft) / concrete ---
    seg(7.5, GY, 16.5, GY, 'concrete', 'alley1');
    seg(16.5, GY, 20.5, GY, 'gravel', 'gravelPatch');
    seg(20.5, GY, 23.9, GY, 'grass', 'grassStrip');
    seg(23.9, GY, 31.8, GY, 'concrete', 'alley2');

    // --- Dumpster (very springy lid, tilted so banks kick right) ---
    seg(10.0, 21.62, 13.2, 21.88, 'dumpster', 'dumpsterLid');
    seg(10.0, 21.62, 10.0, GY, 'container', 'dumpsterL');
    seg(13.2, 21.88, 13.2, GY, 'container', 'dumpsterR');

    // --- Right building (tall) ---
    seg(31.8, 4.0, 31.8, GY, 'concrete', 'wallR');
    seg(31.8, 4.0, 36.6, 4.0, 'concrete', 'roofR');

    // --- Shipping container, propped: mouth faces UP-AND-LEFT ---
    var th = 38 * Math.PI / 180;
    var dx = Math.cos(th), dy = Math.sin(th);   // axis: down-right
    var px = -dy, py = dx;                       // toward floor-side
    var W = 2.6, L = 7.0;
    var M = { x: 25.3, y: 18.0 };                // mouth center
    var Ax = M.x + px * W / 2, Ay = M.y + py * W / 2; // mouth low corner
    var Bx = Ax + dx * L, By = Ay + dy * L;           // floor deep corner
    var Cx = M.x - px * W / 2, Cy = M.y - py * W / 2; // mouth high corner (roof edge)
    var Dx = Cx + dx * L, Dy = Cy + dy * L;           // roof deep corner
    seg(Ax, Ay, Bx, By, 'container', 'cFloor');
    seg(Cx, Cy, Dx, Dy, 'container', 'cRoof');
    seg(Bx, By, Dx, Dy, 'container', 'cEnd');

    // front support post under the mouth (metal)
    var postX = 26.8;
    var tPost = (postX - Ax) / (dx * L);
    var postTop = Ay + dy * L * tPost + 0.05;
    seg(postX, postTop, postX, GY, 'container', 'post');

    // crate stack propping the deep end (kept clear of the interior)
    seg(30.15, 23.45, 31.8, 23.45, 'crate', 'crateTop');
    seg(30.15, 23.45, 30.15, GY, 'crate', 'crateFace');

    // --- Awning (trampoline w/ absorption) + thin metal support rail ---
    var tip = { x: 24.9, y: 15.05 };
    var anchor = { x: 31.8, y: 12.2 };
    seg(tip.x, tip.y, anchor.x, anchor.y, 'awning', 'awning');
    seg(tip.x, tip.y, Cx, Cy, 'rail', 'rail');            // the Dream deflector
    circles.push({ x: tip.x, y: tip.y, r: 0.13, mat: 'rail', id: 'railCap' });

    // --- Cup: the pocket at the container's deep corner ---
    var cf = L - 0.55;
    var inx = -px, iny = -py; // into interior
    var cup = {
      x: Ax + dx * cf + inx * 0.18,
      y: Ay + dy * cf + iny * 0.18,
      r: 0.55
    };

    // --- Container-interior test (mouth trigger for Dream detection) ---
    function inMouth(x, y) {
      var lx = (x - M.x) * dx + (y - M.y) * dy;      // along axis
      var lw = (x - M.x) * px + (y - M.y) * py;      // across
      return lx > 0.1 && lx < L && lw > -W / 2 + 0.05 && lw < W / 2 - 0.05;
    }

    return {
      name: 'LOADING BAY', holeNo: 3, par: 3, ceiling: 9,
      wind: -1.5, // m/s, toward the LEFT — airborne flight only
      segs: segs, circles: circles, cup: cup,
      tee: { x: 3.0, y: ROOF - 0.18 },
      oob: { minX: -1.5, maxX: 36.9, maxY: 25.6 },
      inMouth: inMouth,
      // geometry handles for the renderer
      geo: {
        GY: GY, ROOF: ROOF,
        dumpster: { x1: 10.0, x2: 13.2, lidL: 21.62, lidR: 21.88 },
        gravel: { x1: 16.5, x2: 20.5 },
        grass: { x1: 20.5, x2: 23.9 },
        container: {
          A: { x: Ax, y: Ay }, B: { x: Bx, y: By },
          C: { x: Cx, y: Cy }, D: { x: Dx, y: Dy },
          M: M, th: th, W: W, L: L
        },
        post: { x: postX, top: postTop },
        crate: { x1: 30.15, x2: 31.8, top: 23.45 },
        awning: { tip: tip, anchor: anchor },
        rail: { a: tip, b: { x: Cx, y: Cy } },
        flag: { x: Cx + 0.35, y: Cy + 0.2, h: 3.2 },
        wallR: { x: 31.8, top: 4.0 },
        leftBldg: { x1: -0.6, x2: 7.5 }
      }
    };
  }

  return { build: build };
});
