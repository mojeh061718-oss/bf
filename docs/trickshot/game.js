/* ============================================================
   TRICKSHOT OPEN — game shell: render / input / camera / flow.
   Deterministic core lives in physics.js + level.js.
   Sim: fixed 240 Hz. Render: 60 fps canvas.
   ============================================================ */
(function () {
  'use strict';

  var P = window.TSPhysics;
  var LV = window.TSLevel;
  var A = window.TSAudio;

  var world = LV.build();
  var geo = world.geo;
  var DT = P.DT;

  // ---------- DOM ----------
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var elTitle = document.getElementById('title');
  var elResults = document.getElementById('results');
  var elResBody = document.getElementById('resBody');
  var elToast = document.getElementById('toast');
  var elStroke = document.getElementById('hudStroke');
  var elBest = document.getElementById('hudBest');
  var elHud = document.getElementById('hud');
  var elSpinbar = document.getElementById('spinbar');
  var elSide = document.getElementById('sideSlider');
  var chipEls = [].slice.call(document.querySelectorAll('.chip'));

  var dpr = 1, cw = 0, chh = 0;
  function resize() {
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    cw = window.innerWidth; chh = window.innerHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(chh * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = chh + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- state ----------
  var mode = 'title';          // title | play | results
  var sub = 'aim';             // aim | drag | anticipate | flight | sink
  var strokes = 0;
  var ball = P.makeBall(world.tee.x, world.tee.y);
  var prevLie = { x: world.tee.x, y: world.tee.y };
  var runStrokes = [];
  var railThisStroke = false, dreamThisStroke = false;
  var anticT = 0, pendingShot = null;
  var aimPreviewT = 0;         // brief overview beat before aim framing
  var sinkT = 0, sinkFrom = null;
  var finalInfo = null;
  var spinSel = 0;             // +1 back, 0 none, -1 top
  var acc = 0, lastT = 0, simTime = 0;

  var best = null;
  try {
    var raw = localStorage.getItem('tso.best.v1');
    if (raw) best = JSON.parse(raw);
    if (best && (!best.strokes || !best.strokes.length)) best = null;
  } catch (err) { best = null; }

  var ghost = null;

  // input
  var drag = null;             // {id, sx, sy, cx, cy}
  var MAX_DRAW = function () { return cw * 0.40; };

  // fx
  var trail = [];
  var particles = [];
  var windP = [];
  var toastT = 0;
  var shake = 0;

  for (var wi = 0; wi < 26; wi++) {
    windP.push({ x: Math.random() * 40 - 2, y: 2 + Math.random() * 21, s: 0.7 + Math.random() * 0.7 });
  }

  // deterministic-looking skyline (fixed seed)
  function seededList(seed, n, fn) {
    var s = seed, out = [];
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    for (var i = 0; i < n; i++) out.push(fn(rnd, i));
    return out;
  }
  var skyFar = seededList(42, 14, function (rnd, i) {
    return { x: -6 + i * 3.6 + rnd() * 1.4, w: 2.4 + rnd() * 2.2, h: 5 + rnd() * 9 };
  });
  var skyNear = seededList(99, 10, function (rnd, i) {
    return { x: -8 + i * 5.2 + rnd() * 2, w: 3.4 + rnd() * 2.6, h: 3 + rnd() * 6, ac: rnd() > 0.5 };
  });
  var backDoors = seededList(7, 6, function (rnd, i) {
    return { x: 9 + i * 4.2 + rnd() * 1.6, w: 1.1 + rnd() * 0.5, h: 2.1 + rnd() * 0.4, pipe: rnd() > 0.4 };
  });

  // camera
  var cam = { x: 18, y: 14, z: 12 };

  // ---------- helpers ----------
  function showToast(text, ms) {
    elToast.textContent = text;
    elToast.classList.add('show');
    toastT = (ms || 1800) / 1000;
  }
  function hideOverlays() {
    elTitle.classList.add('hidden');
    elResults.classList.add('hidden');
  }
  function setSpinbarVisible(v) {
    elSpinbar.classList.toggle('hidden', !v);
  }
  function updateHud() {
    // while a stroke is in the air, show the stroke being played
    var inStroke = sub === 'flight' || sub === 'sink' || sub === 'anticipate';
    var n = Math.min(strokes + (inStroke ? 0 : 1), world.ceiling);
    elStroke.textContent = 'STROKE ' + n + ' · PAR ' + world.par;
    elBest.textContent = best ? ('BEST ' + best.score) : 'NO BEST YET';
  }

  function saveBest(score, medal) {
    if (!(best) || score < best.score) {
      best = { score: score, medal: medal.label, dream: dreamThisStroke, strokes: runStrokes.slice() };
      try { localStorage.setItem('tso.best.v1', JSON.stringify(best)); } catch (err) { /* private mode */ }
      return true;
    }
    return false;
  }

  // ---------- flow ----------
  function startPlay() {
    mode = 'play'; sub = 'aim';
    strokes = 0; runStrokes = [];
    ball = P.makeBall(world.tee.x, world.tee.y);
    prevLie = { x: ball.x, y: ball.y };
    railThisStroke = false; dreamThisStroke = false;
    trail.length = 0; particles.length = 0;
    finalInfo = null; spinSel = 0;
    elSide.value = 0;
    chipEls.forEach(function (c) { c.classList.toggle('on', c.dataset.spin === '0'); });
    hideOverlays();
    elHud.classList.remove('hidden');
    setSpinbarVisible(true);
    aimPreviewT = 1.2;
    updateHud();
    // ghost of your best run races you
    if (best) {
      ghost = {
        ball: P.makeBall(best.strokes[0].x, best.strokes[0].y),
        idx: 0, timer: 1.2, trail: [], tick: 0, done: false
      };
    } else ghost = null;
  }

  function medalFor(holed, score, dream) {
    if (!holed) return { tier: 0, label: 'STROKE LIMIT', cls: 'none' };
    if (dream) return { tier: 3, label: 'DREAM SHOT', cls: 'gold' };
    if (score === 1) return { tier: 2, label: 'ACE', cls: 'silver' };
    if (score < world.par) return { tier: 2, label: 'BIRDIE', cls: 'silver' };
    if (score === world.par) return { tier: 1, label: 'PAR', cls: 'bronze' };
    return { tier: 0, label: '+' + (score - world.par), cls: 'none' };
  }

  function finishHole(holed) {
    mode = 'results';
    var score = Math.min(strokes, world.ceiling);
    var medal = medalFor(holed, score, dreamThisStroke);
    var isNewBest = holed ? saveBest(score, medal) : false;
    finalInfo = { holed: holed, score: score, medal: medal, newBest: isNewBest };
    if (medal.tier > 0) A.medal(medal.tier);

    var relNames = { '-2': 'ACE', '-1': 'BIRDIE', '0': 'PAR', '1': 'BOGEY', '2': 'DOUBLE BOGEY' };
    var rel = score - world.par;
    var relTxt = holed ? (score === 1 ? 'HOLE IN ONE' : (relNames[rel] || ('+' + rel))) : 'DID NOT FINISH';

    var html = '';
    html += '<div class="res-score">' + score + '<span class="res-strokes"> STROKE' + (score === 1 ? '' : 'S') + '</span></div>';
    html += '<div class="res-rel">' + relTxt + '</div>';
    if (medal.tier > 0) {
      html += '<div class="medal ' + medal.cls + '"><span class="medal-dot"></span>' + medal.label + '</div>';
      if (medal.tier === 3) html += '<div class="res-note gold-note">Rail &rarr; mouth. You saw the shot nobody else sees.</div>';
    }
    html += '<div class="res-best">' + (isNewBest ? 'NEW BEST — saved as your ghost' : (best ? 'BEST: ' + best.score + ' STROKES' : '')) + '</div>';
    elResBody.innerHTML = html;
    elResults.classList.remove('hidden');
    elHud.classList.add('hidden');
    setSpinbarVisible(false);
    A.setRoll(0);
  }

  function endStroke() {
    prevLie = { x: ball.x, y: ball.y };
    if (strokes >= world.ceiling) { finishHole(false); return; }
    sub = 'aim';
    railThisStroke = false;
    setSpinbarVisible(true);
    aimPreviewT = 0.9;
    updateHud();
    A.setRoll(0);
  }

  function doLaunch() {
    var s = pendingShot; pendingShot = null;
    strokes++;
    prevLie = { x: ball.x, y: ball.y };
    runStrokes.push({ x: ball.x, y: ball.y, vx: s.vx, vy: s.vy, spin: s.spin, side: s.side });
    railThisStroke = false; dreamThisStroke = false;
    P.launch(ball, s.vx, s.vy, s.spin, s.side);
    trail.length = 0;
    sub = 'flight';
    A.thwack(s.pow);
    updateHud();
  }

  // ---------- sim ----------
  var dustColors = {
    concrete: '#cfbccb', grass: '#8bc26e', gravel: '#b3a693', dumpster: '#7fe3ab',
    awning: '#ffd9ac', rail: '#fff3b8', container: '#e89a70', crate: '#d4b183'
  };

  function spawnDust(x, y, nx, ny, impact, mat) {
    var n = Math.min(14, 3 + Math.floor(impact * 0.8));
    var col = dustColors[mat] || '#ccc';
    for (var i = 0; i < n; i++) {
      var a = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.9;
      var sp = (0.6 + Math.random() * 0.9) * Math.min(4.5, impact * 0.35);
      particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.45, t: 0,
        r: 0.05 + Math.random() * 0.09, col: col, spark: mat === 'rail'
      });
    }
  }

  function cupBurst(x, y) {
    for (var i = 0; i < 26; i++) {
      var a = -Math.PI * (0.15 + Math.random() * 0.7);
      var sp = 2 + Math.random() * 5;
      particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.6 + Math.random() * 0.6, t: 0,
        r: 0.06 + Math.random() * 0.08,
        col: i % 3 === 0 ? '#ffc861' : (i % 3 === 1 ? '#fff3d0' : '#ff8a5c'), spark: true
      });
    }
  }

  function stepBall() {
    var ev = [];
    P.step(ball, world, ev);
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i];
      if (e.type === 'bounce') {
        A.bounce(e.mat, e.impact);
        spawnDust(e.x, e.y, e.nx, e.ny, e.impact, e.mat);
        if (e.impact > 6) shake = Math.min(0.5, shake + e.impact * 0.014);
        if (e.id === 'rail' || e.id === 'railCap') {
          railThisStroke = true;
          showToast('OFF THE RAIL!', 900);
        }
      } else if (e.type === 'mouth') {
        if (railThisStroke && !dreamThisStroke) {
          dreamThisStroke = true;
          showToast('THE DREAM LINE!', 1400);
        }
      } else if (e.type === 'holed') {
        sub = 'sink'; sinkT = 0; sinkFrom = { x: ball.x, y: ball.y };
        cupBurst(world.cup.x, world.cup.y - 0.4);
        A.cupDrop();
        A.setRoll(0);
      } else if (e.type === 'rest') {
        endStroke();
      } else if (e.type === 'oob') {
        strokes++; // penalty
        A.penalty();
        showToast('OUT OF PLAY — +1 STROKE, REPLAY FROM LIE', 2200);
        ball = P.makeBall(prevLie.x, prevLie.y);
        trail.length = 0;
        if (strokes >= world.ceiling) { finishHole(false); return; }
        sub = 'aim';
        setSpinbarVisible(true);
        updateHud();
        A.setRoll(0);
      }
      if (mode !== 'play') return;
    }
  }

  function stepGhost() {
    if (!ghost || ghost.done) return;
    var b = ghost.ball;
    if (b.holed) { ghost.done = true; return; }
    if (b.rest || b.oob) {
      ghost.timer -= DT;
      if (ghost.timer <= 0) {
        if (ghost.idx >= best.strokes.length) { ghost.done = true; return; }
        var s = best.strokes[ghost.idx++];
        b.x = s.x; b.y = s.y;
        P.launch(b, s.vx, s.vy, s.spin, s.side);
        ghost.timer = 1.3;
      }
      return;
    }
    P.step(b, world, null);
    ghost.tick++;
    if (ghost.tick % 4 === 0) {
      ghost.trail.push(b.x, b.y);
      if (ghost.trail.length > 300) ghost.trail.splice(0, 2);
    }
  }

  // ---------- input ----------
  function canvasPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener('pointerdown', function (e) {
    A.unlock();
    if (mode !== 'play' || sub !== 'aim') return;
    e.preventDefault();
    var p = canvasPos(e);
    drag = { id: e.pointerId, sx: p.x, sy: p.y, cx: p.x, cy: p.y };
    aimPreviewT = 0; // touching skips the establishing beat
    sub = 'drag';
    setSpinbarVisible(false);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    var p = canvasPos(e);
    drag.cx = p.x; drag.cy = p.y;
  });

  function shotFromDrag() {
    var dx = drag.cx - drag.sx, dy = drag.cy - drag.sy; // pull vector
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 10) return null;
    var pow = Math.min(1, len / MAX_DRAW());
    var speed = P.MAX_SPEED * (0.04 + 0.96 * pow);
    var inv = 1 / len;
    return {
      vx: -dx * inv * speed, vy: -dy * inv * speed,
      spin: spinSel * 85,
      side: (parseFloat(elSide.value) || 0) / 100,
      pow: pow
    };
  }

  canvas.addEventListener('pointerup', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    var p = canvasPos(e);
    drag.cx = p.x; drag.cy = p.y;
    var shot = shotFromDrag();
    drag = null;
    if (!shot) { sub = 'aim'; setSpinbarVisible(true); return; }
    pendingShot = shot;
    anticT = 0.08;              // anticipation freeze, then launch
    sub = 'anticipate';
  });

  canvas.addEventListener('pointercancel', function () {
    if (drag) { drag = null; if (sub === 'drag') { sub = 'aim'; setSpinbarVisible(true); } }
  });

  // spin chips + side slider
  chipEls.forEach(function (c) {
    c.addEventListener('click', function () {
      A.unlock(); A.uiTick();
      spinSel = parseInt(c.dataset.spin, 10);
      chipEls.forEach(function (o) { o.classList.toggle('on', o === c); });
    });
  });
  elSide.addEventListener('input', function () { });

  elTitle.addEventListener('pointerdown', function () { A.unlock(); startPlay(); });
  document.getElementById('retryBtn').addEventListener('click', function () { A.unlock(); A.uiTick(); startPlay(); });

  // ---------- camera ----------
  function overviewCam() {
    // full-hole framing; portrait can't fit all 38 m, so show the
    // alley->container money shot and let the follow-cam do the rest
    var z = chh > cw ? cw / 28 : Math.min(cw / 39, chh / 25);
    var cy = 25.8 - (chh / z) / 2;
    return { x: chh > cw ? 16.3 : 17.8, y: Math.min(14.5, cy), z: z };
  }
  function camTarget() {
    if (mode !== 'play') return overviewCam();
    var ZMAX = 46; // px/m cap so desktop keeps context
    if (sub === 'flight' || sub === 'sink') {
      var spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      var z = cw / (13 + Math.min(20, spd) * 1.25);
      z = Math.max(overviewCam().z, Math.min(z, chh / 11, ZMAX));
      var tx = ball.x + ball.vx * 0.22;
      var ty = ball.y + ball.vy * 0.10 - 1.2;
      var maxCy = 25.6 - (chh / z) / 2 + 1.5;
      return { x: tx, y: Math.min(ty, maxCy), z: z };
    }
    // establishing beat: brief overview so the player reads the hole
    if (sub === 'aim' && aimPreviewT > 0) return overviewCam();
    // aim framing: ball + look toward the pin
    var za = Math.min(cw / 13.5, chh / 11.5, ZMAX);
    var lookX = ball.x + (world.cup.x > ball.x ? 2.2 : -2.2);
    var maxCy2 = 25.9 - (chh / za) / 2 + 5.5;
    return { x: lookX, y: Math.min(ball.y - 3.2, maxCy2), z: za };
  }
  function updateCam(dt) {
    var t = camTarget();
    var kp = 1 - Math.exp(-5.2 * dt);
    var kz = 1 - Math.exp(-3.4 * dt);
    cam.x += (t.x - cam.x) * kp;
    cam.y += (t.y - cam.y) * kp;
    cam.z += (t.z - cam.z) * kz;
  }

  // ---------- render ----------
  function worldTransform(par) {
    var p = par === undefined ? 1 : par;
    var sx = shake > 0.01 ? (Math.random() - 0.5) * shake * 14 : 0;
    var sy = shake > 0.01 ? (Math.random() - 0.5) * shake * 10 : 0;
    ctx.setTransform(
      dpr * cam.z, 0, 0, dpr * cam.z,
      dpr * (cw / 2 - (cam.x * p + 18 * (1 - p)) * cam.z + sx),
      dpr * (chh / 2 - (cam.y * p + 13 * (1 - p)) * cam.z + sy)
    );
  }
  function screenTransform() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }

  function drawSky(time) {
    screenTransform();
    var g = ctx.createLinearGradient(0, 0, 0, chh);
    g.addColorStop(0, '#42284f');
    g.addColorStop(0.35, '#7c3b5d');
    g.addColorStop(0.62, '#c65f52');
    g.addColorStop(0.82, '#e8925a');
    g.addColorStop(1, '#f4bd72');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, chh);
    // sun
    var sx = cw * 0.68 - cam.x * 2.0, sy = chh * 0.42 - cam.y * 2.0;
    var rg = ctx.createRadialGradient(sx, sy, 4, sx, sy, Math.max(cw, chh) * 0.42);
    rg.addColorStop(0, 'rgba(255,236,190,0.95)');
    rg.addColorStop(0.08, 'rgba(255,214,150,0.55)');
    rg.addColorStop(0.35, 'rgba(255,170,110,0.14)');
    rg.addColorStop(1, 'rgba(255,170,110,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, cw, chh);
    ctx.beginPath();
    ctx.arc(sx, sy, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,242,205,0.9)';
    ctx.fill();
  }

  function drawSkyline() {
    // far
    worldTransform(0.25);
    ctx.fillStyle = 'rgba(90,49,87,0.75)';
    for (var i = 0; i < skyFar.length; i++) {
      var b = skyFar[i];
      ctx.fillRect(b.x, 24 - b.h - 6, b.w, b.h + 40);
    }
    // near
    worldTransform(0.55);
    ctx.fillStyle = 'rgba(58,33,64,0.9)';
    for (var j = 0; j < skyNear.length; j++) {
      var n = skyNear[j];
      ctx.fillRect(n.x, 24 - n.h - 2, n.w, n.h + 40);
      if (n.ac) ctx.fillRect(n.x + n.w * 0.3, 24 - n.h - 2.55, 0.9, 0.55);
    }
  }

  function corrugate(x1, y1, x2, y2, spacing, len, color, width) {
    var dx = x2 - x1, dy = y2 - y1;
    var L = Math.sqrt(dx * dx + dy * dy);
    var ux = dx / L, uy = dy / L;
    var nx = -uy, ny = ux;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (var d = spacing; d < L; d += spacing) {
      var px = x1 + ux * d, py = y1 + uy * d;
      ctx.moveTo(px, py);
      ctx.lineTo(px + nx * len, py + ny * len);
    }
    ctx.stroke();
  }

  function drawWorld(time) {
    worldTransform(1);
    var GY = geo.GY;

    // alley back wall
    var wg = ctx.createLinearGradient(0, 12.5, 0, GY);
    wg.addColorStop(0, '#6b4266');
    wg.addColorStop(1, '#4c2c50');
    ctx.fillStyle = wg;
    ctx.fillRect(-2, 12.5, 41, GY - 12.5);
    // doors / pipes on back wall
    for (var d = 0; d < backDoors.length; d++) {
      var dr = backDoors[d];
      ctx.fillStyle = 'rgba(35,20,42,0.55)';
      ctx.fillRect(dr.x, GY - dr.h, dr.w, dr.h);
      ctx.fillStyle = 'rgba(255,190,120,0.10)';
      ctx.fillRect(dr.x + 0.08, GY - dr.h + 0.08, dr.w - 0.16, 0.3);
      if (dr.pipe) {
        ctx.fillStyle = 'rgba(30,16,36,0.5)';
        ctx.fillRect(dr.x + dr.w + 0.3, 13.5, 0.16, GY - 13.5);
      }
    }
    ctx.fillStyle = 'rgba(30,16,36,0.35)';
    ctx.fillRect(-2, GY - 0.9, 41, 0.9); // grime line
    ctx.fillStyle = 'rgba(255,215,165,0.28)';
    ctx.fillRect(-2, 12.5, 41, 0.12); // sunlit wall coping

    // ground slab
    var gg = ctx.createLinearGradient(0, GY, 0, GY + 4);
    gg.addColorStop(0, '#8a7080');
    gg.addColorStop(1, '#57405c');
    ctx.fillStyle = gg;
    ctx.fillRect(-2, GY, 41, 14);
    ctx.fillStyle = 'rgba(255,225,180,0.35)';
    ctx.fillRect(-2, GY, 41, 0.1);
    // expansion joints
    ctx.fillStyle = 'rgba(40,25,48,0.28)';
    for (var jx = -1; jx < 38; jx += 3.1) ctx.fillRect(jx, GY, 0.09, 0.45);

    // gravel patch
    ctx.fillStyle = '#6f6257';
    ctx.fillRect(geo.gravel.x1, GY - 0.14, geo.gravel.x2 - geo.gravel.x1, 0.7);
    ctx.fillStyle = '#8b7d6e';
    for (var gvi = 0; gvi < 34; gvi++) {
      var gx = geo.gravel.x1 + ((gvi * 37) % 100) / 100 * (geo.gravel.x2 - geo.gravel.x1);
      var gy = GY - 0.1 + ((gvi * 53) % 40) / 100 * 0.35;
      ctx.fillRect(gx, gy, 0.14, 0.09);
    }

    // grass strip
    ctx.fillStyle = '#5d8f4e';
    ctx.fillRect(geo.grass.x1, GY - 0.16, geo.grass.x2 - geo.grass.x1, 0.6);
    ctx.strokeStyle = '#6fa75c';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    for (var bl = 0; bl < 26; bl++) {
      var bx = geo.grass.x1 + 0.1 + ((bl * 41) % 100) / 100 * (geo.grass.x2 - geo.grass.x1 - 0.2);
      ctx.moveTo(bx, GY - 0.12);
      ctx.lineTo(bx + 0.05, GY - 0.42 - ((bl * 29) % 20) / 100);
    }
    ctx.stroke();

    // ---- left building (tee rooftop) ----
    var lb = ctx.createLinearGradient(0, geo.ROOF, 0, GY + 2);
    lb.addColorStop(0, '#7b5270');
    lb.addColorStop(1, '#5a3a5e');
    ctx.fillStyle = lb;
    ctx.fillRect(geo.leftBldg.x1, geo.ROOF, geo.leftBldg.x2 - geo.leftBldg.x1, GY + 4 - geo.ROOF);
    ctx.fillStyle = 'rgba(255,220,170,0.5)';
    ctx.fillRect(geo.leftBldg.x1, geo.ROOF, geo.leftBldg.x2 - geo.leftBldg.x1, 0.12); // sunlit roof edge
    ctx.fillStyle = 'rgba(35,20,42,0.5)';
    for (var wy = 0; wy < 3; wy++) for (var wx = 0; wx < 4; wx++) {
      ctx.fillRect(0.7 + wx * 1.8, 14.6 + wy * 3.0, 1.1, 1.7);
    }
    ctx.fillStyle = 'rgba(255,200,125,0.55)';
    ctx.fillRect(0.7 + 2 * 1.8, 14.6 + 1 * 3.0, 1.1, 1.7); // one lit window
    // roof gravel + vent
    ctx.fillStyle = '#4e3153';
    ctx.fillRect(0.6, geo.ROOF - 0.9, 1.5, 0.9);
    ctx.fillStyle = '#5f3d61';
    ctx.fillRect(0.75, geo.ROOF - 1.15, 1.2, 0.25);
    // tee mat
    ctx.fillStyle = '#2f5d46';
    ctx.fillRect(world.tee.x - 0.55, geo.ROOF - 0.07, 1.1, 0.09);

    // ---- dumpster ----
    var dm = geo.dumpster;
    var dg = ctx.createLinearGradient(0, dm.lidL, 0, GY);
    dg.addColorStop(0, '#3f7d5c');
    dg.addColorStop(1, '#2c5843');
    ctx.fillStyle = dg;
    ctx.fillRect(dm.x1, dm.lidL + 0.12, dm.x2 - dm.x1, GY - dm.lidL - 0.12);
    // ribs
    ctx.fillStyle = 'rgba(20,45,35,0.5)';
    for (var rb = 0; rb < 4; rb++) ctx.fillRect(dm.x1 + 0.35 + rb * 0.75, dm.lidL + 0.55, 0.14, GY - dm.lidL - 1.1);
    // lid (tilted, springy — draw slightly bulged)
    ctx.beginPath();
    ctx.moveTo(dm.x1 - 0.12, dm.lidL);
    ctx.lineTo(dm.x2 + 0.12, dm.lidR);
    ctx.lineTo(dm.x2 + 0.12, dm.lidR + 0.34);
    ctx.lineTo(dm.x1 - 0.12, dm.lidL + 0.34);
    ctx.closePath();
    ctx.fillStyle = '#54a276';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,0.4)';
    ctx.fillRect(dm.x1 - 0.12, dm.lidL - 0.02, dm.x2 - dm.x1 + 0.24, 0.08);
    // wheels + grime
    ctx.fillStyle = '#241722';
    ctx.beginPath();
    ctx.arc(dm.x1 + 0.5, GY - 0.18, 0.18, 0, Math.PI * 2);
    ctx.arc(dm.x2 - 0.5, GY - 0.18, 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = '0.52px sans-serif';
    ctx.fillText('CITY WASTE', dm.x1 + 0.55, GY - 0.85);

    // ---- right building ----
    var rb2 = ctx.createLinearGradient(geo.wallR.x, 0, geo.wallR.x + 5, 0);
    rb2.addColorStop(0, '#4f3158');
    rb2.addColorStop(1, '#6b4266');
    ctx.fillStyle = rb2;
    ctx.fillRect(geo.wallR.x, geo.wallR.top, 36.6 - geo.wallR.x, GY + 4 - geo.wallR.top);
    ctx.fillStyle = 'rgba(255,220,170,0.45)';
    ctx.fillRect(geo.wallR.x, geo.wallR.top, 36.6 - geo.wallR.x, 0.12);
    ctx.fillStyle = 'rgba(30,16,36,0.45)';
    for (var wy2 = 0; wy2 < 5; wy2++) for (var wx2 = 0; wx2 < 2; wx2++) {
      ctx.fillRect(geo.wallR.x + 0.8 + wx2 * 2.1, 5.4 + wy2 * 3.3, 1.3, 2.0);
    }
    ctx.fillStyle = 'rgba(255,200,125,0.5)';
    ctx.fillRect(geo.wallR.x + 0.8, 5.4 + 3 * 3.3, 1.3, 2.0);
    // painted sign
    ctx.save();
    ctx.translate(geo.wallR.x + 2.4, 9.2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(255,235,200,0.16)';
    ctx.font = 'bold 1.6px sans-serif';
    ctx.fillText('BAY 3', -1.8, 0);
    ctx.restore();

    // ---- crate stack ----
    var cr = geo.crate;
    ctx.fillStyle = '#8a6742';
    ctx.fillRect(cr.x1, cr.top, cr.x2 - cr.x1, GY - cr.top);
    ctx.strokeStyle = 'rgba(50,32,20,0.6)';
    ctx.lineWidth = 0.05;
    ctx.strokeRect(cr.x1 + 0.05, cr.top + 0.05, (cr.x2 - cr.x1) / 2 - 0.1, GY - cr.top - 0.1);
    ctx.strokeRect(cr.x1 + (cr.x2 - cr.x1) / 2 + 0.05, cr.top + 0.05, (cr.x2 - cr.x1) / 2 - 0.1, GY - cr.top - 0.1);
    ctx.fillStyle = 'rgba(255,225,180,0.25)';
    ctx.fillRect(cr.x1, cr.top, cr.x2 - cr.x1, 0.08);

    // ---- container (open mouth faces up-left) ----
    var C = geo.container;
    // interior (dark)
    ctx.beginPath();
    ctx.moveTo(C.A.x, C.A.y);
    ctx.lineTo(C.B.x, C.B.y);
    ctx.lineTo(C.D.x, C.D.y);
    ctx.lineTo(C.C.x, C.C.y);
    ctx.closePath();
    var ig = ctx.createLinearGradient(C.M.x, C.M.y, C.B.x, C.B.y);
    ig.addColorStop(0, '#3a2030');
    ig.addColorStop(1, '#1c0f1c');
    ctx.fillStyle = ig;
    ctx.fill();
    // interior ribs
    corrugate(C.A.x, C.A.y, C.B.x, C.B.y, 0.7, 0.35, 'rgba(90,45,55,0.5)', 0.06);
    // cup (glowing target pocket)
    var cup = world.cup;
    var cg = ctx.createRadialGradient(cup.x, cup.y, 0.05, cup.x, cup.y, 0.8);
    cg.addColorStop(0, 'rgba(255,200,97,0.5)');
    cg.addColorStop(1, 'rgba(255,200,97,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cup.x, cup.y, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#120a12';
    ctx.beginPath();
    ctx.ellipse(cup.x + 0.05, cup.y + 0.28, 0.34, 0.16, -C.th, 0, Math.PI * 2);
    ctx.fill();
    // pin: flagstick from cup out the mouth
    ctx.strokeStyle = '#f3e6c8';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(cup.x, cup.y + 0.2);
    ctx.lineTo(cup.x - 1.7, cup.y - 3.4);
    ctx.stroke();
    ctx.fillStyle = '#ff5f45';
    ctx.beginPath();
    ctx.moveTo(cup.x - 1.7, cup.y - 3.4);
    ctx.lineTo(cup.x - 2.55, cup.y - 3.12);
    ctx.lineTo(cup.x - 1.7, cup.y - 2.86);
    ctx.closePath();
    ctx.fill();
    // shell walls
    ctx.lineWidth = 0.22;
    ctx.strokeStyle = '#c0603f';
    ctx.beginPath();
    ctx.moveTo(C.A.x, C.A.y); ctx.lineTo(C.B.x, C.B.y);
    ctx.moveTo(C.C.x, C.C.y); ctx.lineTo(C.D.x, C.D.y);
    ctx.moveTo(C.B.x, C.B.y); ctx.lineTo(C.D.x, C.D.y);
    ctx.stroke();
    // corrugation on outside of floor & roof
    corrugate(C.C.x, C.C.y, C.D.x, C.D.y, 0.55, -0.22, '#a34f33', 0.09);
    corrugate(C.A.x, C.A.y, C.B.x, C.B.y, 0.55, 0.22, '#8f4029', 0.09);
    // mouth rim highlight
    ctx.lineWidth = 0.1;
    ctx.strokeStyle = '#ffd9a8';
    ctx.beginPath();
    ctx.moveTo(C.A.x - 0.05, C.A.y - 0.08); ctx.lineTo(C.A.x + 0.18, C.A.y + 0.1);
    ctx.moveTo(C.C.x - 0.05, C.C.y - 0.08); ctx.lineTo(C.C.x + 0.18, C.C.y + 0.1);
    ctx.stroke();
    // label along roof
    ctx.save();
    ctx.translate(C.C.x + 0.9, C.C.y + 1.05);
    ctx.rotate(C.th);
    ctx.fillStyle = 'rgba(255,235,205,0.35)';
    ctx.font = 'bold 0.62px sans-serif';
    ctx.fillText('TSO FREIGHT', 0, 0);
    ctx.restore();

    // front post + pallet
    ctx.fillStyle = '#5d4a58';
    ctx.fillRect(geo.post.x - 0.09, geo.post.top, 0.18, GY - geo.post.top);
    ctx.fillStyle = '#7a5a3c';
    ctx.fillRect(geo.post.x - 0.7, GY - 0.35, 1.4, 0.35);

    // ---- awning + rail ----
    var aw = geo.awning;
    // wall bracket
    ctx.fillStyle = '#3c2745';
    ctx.fillRect(aw.anchor.x - 0.15, aw.anchor.y - 0.4, 0.3, 0.9);
    // fabric with stripes
    var steps = 7;
    for (var st = 0; st < steps; st++) {
      var t0 = st / steps, t1 = (st + 1) / steps;
      var fx0 = aw.tip.x + (aw.anchor.x - aw.tip.x) * t0;
      var fy0 = aw.tip.y + (aw.anchor.y - aw.tip.y) * t0;
      var fx1 = aw.tip.x + (aw.anchor.x - aw.tip.x) * t1;
      var fy1 = aw.tip.y + (aw.anchor.y - aw.tip.y) * t1;
      ctx.fillStyle = st % 2 === 0 ? '#d95f4b' : '#f2e3c8';
      ctx.beginPath();
      ctx.moveTo(fx0, fy0);
      ctx.lineTo(fx1, fy1);
      ctx.lineTo(fx1, fy1 + 0.42);
      // scalloped bottom
      ctx.arc((fx0 + fx1) / 2, (fy0 + fy1) / 2 + 0.42, 0.5 * Math.abs(fx1 - fx0), 0, Math.PI, false);
      ctx.lineTo(fx0, fy0 + 0.42);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(60,25,30,0.4)';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(aw.tip.x, aw.tip.y);
    ctx.lineTo(aw.anchor.x, aw.anchor.y);
    ctx.stroke();
    // support rail (the Dream deflector) — thin, bright, true
    var rl = geo.rail;
    ctx.strokeStyle = '#e8e2d4';
    ctx.lineWidth = 0.13;
    ctx.beginPath();
    ctx.moveTo(rl.a.x, rl.a.y);
    ctx.lineTo(rl.b.x, rl.b.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(rl.a.x - 0.02, rl.a.y - 0.03);
    ctx.lineTo(rl.b.x - 0.02, rl.b.y - 0.03);
    ctx.stroke();
    ctx.fillStyle = '#f4efe2';
    ctx.beginPath();
    ctx.arc(aw.tip.x, aw.tip.y, 0.14, 0, Math.PI * 2);
    ctx.fill();

    // ---- flag (shows wind: blows LEFT) ----
    var fl = geo.flag;
    ctx.strokeStyle = '#efe3c4';
    ctx.lineWidth = 0.09;
    ctx.beginPath();
    ctx.moveTo(fl.x, fl.y);
    ctx.lineTo(fl.x, fl.y - fl.h);
    ctx.stroke();
    var wav = Math.sin(time * 7) * 0.14;
    ctx.fillStyle = '#ffc861';
    ctx.beginPath();
    ctx.moveTo(fl.x, fl.y - fl.h);
    ctx.quadraticCurveTo(fl.x - 0.8, fl.y - fl.h + 0.1 + wav, fl.x - 1.5, fl.y - fl.h + 0.12 - wav);
    ctx.lineTo(fl.x - 1.45, fl.y - fl.h + 0.5 - wav);
    ctx.quadraticCurveTo(fl.x - 0.75, fl.y - fl.h + 0.5 + wav, fl.x, fl.y - fl.h + 0.55);
    ctx.closePath();
    ctx.fill();
  }

  function drawGhost() {
    if (!ghost) return;
    worldTransform(1);
    // trail
    ctx.strokeStyle = 'rgba(190,225,255,0.28)';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    for (var i = 0; i < ghost.trail.length; i += 2) {
      if (i === 0) ctx.moveTo(ghost.trail[0], ghost.trail[1]);
      else ctx.lineTo(ghost.trail[i], ghost.trail[i + 1]);
    }
    ctx.stroke();
    if (!ghost.done) {
      var b = ghost.ball;
      ctx.fillStyle = 'rgba(200,230,255,0.4)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, P.R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,230,255,0.5)';
      ctx.lineWidth = 0.04;
      ctx.stroke();
    }
  }

  function drawBallAndFx(time, dt) {
    worldTransform(1);

    // trail
    if (trail.length >= 4) {
      for (var i = 2; i < trail.length; i += 2) {
        var a = i / trail.length;
        ctx.strokeStyle = 'rgba(255,246,220,' + (0.35 * a).toFixed(3) + ')';
        ctx.lineWidth = 0.05 + 0.09 * a;
        ctx.beginPath();
        ctx.moveTo(trail[i - 2], trail[i - 1]);
        ctx.lineTo(trail[i], trail[i + 1]);
        ctx.stroke();
      }
    }

    // particles
    for (var pi = particles.length - 1; pi >= 0; pi--) {
      var pp = particles[pi];
      pp.t += dt;
      if (pp.t >= pp.life) { particles.splice(pi, 1); continue; }
      pp.vy += (pp.spark ? 2.5 : 5.5) * dt;
      pp.vx *= (1 - 1.6 * dt);
      pp.x += pp.vx * dt; pp.y += pp.vy * dt;
      var al = 1 - pp.t / pp.life;
      ctx.globalAlpha = al * 0.85;
      ctx.fillStyle = pp.col;
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, pp.r * (pp.spark ? al : (1.6 - 0.6 * al)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // wind streaks
    ctx.strokeStyle = 'rgba(255,240,215,0.20)';
    ctx.lineWidth = 0.045;
    ctx.beginPath();
    for (var wpi = 0; wpi < windP.length; wpi++) {
      var w = windP[wpi];
      w.x += world.wind * w.s * dt * 2.2;
      if (w.x < -3) { w.x = 39; w.y = 2 + Math.random() * 21; }
      ctx.moveTo(w.x, w.y);
      ctx.lineTo(w.x + 0.55 * w.s, w.y + Math.sin(time * 2 + wpi) * 0.03);
    }
    ctx.stroke();

    // ball (hidden once fully sunk)
    var sinking = sub === 'sink';
    var sk = sinking ? Math.min(1, sinkT / 0.5) : 0;
    if (sk < 1) {
      var bx = ball.x, by = ball.y, brad = P.R * (1 - sk * 0.85);
      if (sinking) {
        bx += (world.cup.x - ball.x) * sk;
        by += (world.cup.y + 0.25 - ball.y) * sk;
      }
      var squash = sub === 'anticipate' ? 0.85 : 1;
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(1, squash);
      var bg = ctx.createRadialGradient(-0.05, -0.06, 0.02, 0, 0, brad * 1.2);
      bg.addColorStop(0, '#fffdf6');
      bg.addColorStop(0.7, '#f2e3cd');
      bg.addColorStop(1, '#cfae9a');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(0, 0, brad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // spin badge on ball while aiming
      if (mode === 'play' && (sub === 'aim' || sub === 'drag') && !sinking) {
        if (spinSel !== 0) {
          ctx.strokeStyle = spinSel > 0 ? '#7ae0c3' : '#ff8a5c';
          ctx.lineWidth = 0.06;
          ctx.beginPath();
          if (spinSel > 0) ctx.arc(bx, by, P.R + 0.14, Math.PI * 0.2, Math.PI * 1.3, true);
          else ctx.arc(bx, by, P.R + 0.14, Math.PI * 1.8, Math.PI * 0.7, false);
          ctx.stroke();
          // arrowhead
          var aa = spinSel > 0 ? Math.PI * 1.3 : Math.PI * 0.7;
          var ax = bx + Math.cos(aa) * (P.R + 0.14), ay = by + Math.sin(aa) * (P.R + 0.14);
          ctx.fillStyle = spinSel > 0 ? '#7ae0c3' : '#ff8a5c';
          ctx.beginPath();
          ctx.arc(ax, ay, 0.07, 0, Math.PI * 2);
          ctx.fill();
        }
        var sv = (parseFloat(elSide.value) || 0) / 100;
        if (Math.abs(sv) > 0.05) {
          ctx.strokeStyle = '#ffd166';
          ctx.lineWidth = 0.06;
          ctx.beginPath();
          ctx.moveTo(bx, by + P.R + 0.28);
          ctx.lineTo(bx + sv * 0.55, by + P.R + 0.28);
          ctx.stroke();
          ctx.fillStyle = '#ffd166';
          ctx.beginPath();
          ctx.arc(bx + sv * 0.55, by + P.R + 0.28, 0.07, 0, Math.PI * 2);
          ctx.fill();
        }
        // resting pulse ring
        if (sub === 'aim') {
          var pr = P.R + 0.22 + Math.sin(time * 3.2) * 0.05;
          ctx.strokeStyle = 'rgba(255,246,220,0.4)';
          ctx.lineWidth = 0.035;
          ctx.beginPath();
          ctx.arc(bx, by, pr, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  function drawAim() {
    if (sub !== 'drag' || !drag) return;
    var shot = shotFromDrag();
    // screen-space: elastic band from ball to finger (1:1, no smoothing)
    screenTransform();
    var bsx = (ball.x - cam.x) * cam.z + cw / 2;
    var bsy = (ball.y - cam.y) * cam.z + chh / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(bsx, bsy);
    ctx.lineTo(drag.cx, drag.cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(drag.cx, drag.cy, 14, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.stroke();

    if (!shot) return;
    // power ring around ball
    var pow = shot.pow;
    ctx.beginPath();
    ctx.arc(bsx, bsy, 24, -Math.PI / 2, -Math.PI / 2 + pow * Math.PI * 2);
    ctx.strokeStyle = pow > 0.92 ? '#ff5f45' : '#ffc861';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,246,220,0.9)';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(pow * 100) + '%', bsx, bsy - 32);
    ctx.textAlign = 'left';

    // predicted first ~0.5 s of flight, pre-bounce (thin dotted)
    var tb = P.makeBall(ball.x, ball.y);
    P.launch(tb, shot.vx, shot.vy, shot.spin, shot.side);
    var pts = P.predict(tb, world, 0.5, 6);
    worldTransform(1);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (var i = 0; i < pts.length; i += 2) {
      var r2 = 0.06 * (1 - (i / pts.length) * 0.55);
      ctx.beginPath();
      ctx.arc(pts[i], pts[i + 1], r2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPinHint() {
    if (mode !== 'play' || (sub !== 'aim' && sub !== 'drag')) return;
    screenTransform();
    var sx = (world.cup.x - cam.x) * cam.z + cw / 2;
    var sy = (world.cup.y - 1.2 - cam.y) * cam.z + chh / 2;
    if (sx > 24 && sx < cw - 24) return; // pin on screen
    var edgeX = sx <= 24 ? 20 : cw - 20;
    var dir = sx <= 24 ? -1 : 1;
    var ey = Math.max(70, Math.min(chh - 160, sy));
    ctx.fillStyle = '#ffc861';
    ctx.beginPath();
    ctx.moveTo(edgeX + dir * 8, ey);
    ctx.lineTo(edgeX - dir * 4, ey - 8);
    ctx.lineTo(edgeX - dir * 4, ey + 8);
    ctx.closePath();
    ctx.fill();
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = dir > 0 ? 'right' : 'left';
    ctx.fillStyle = 'rgba(255,234,200,0.9)';
    ctx.fillText(Math.round(Math.abs(world.cup.x - ball.x)) + 'm', edgeX - dir * 10, ey + 4);
    ctx.textAlign = 'left';
  }

  function drawVignette() {
    screenTransform();
    var vg = ctx.createRadialGradient(cw / 2, chh / 2, Math.min(cw, chh) * 0.45, cw / 2, chh / 2, Math.max(cw, chh) * 0.78);
    vg.addColorStop(0, 'rgba(20,8,25,0)');
    vg.addColorStop(1, 'rgba(20,8,25,0.32)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, cw, chh);
  }

  // ---------- main loop ----------
  function frame(now) {
    requestAnimationFrame(frame);
    if (!lastT) lastT = now;
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    var time = now / 1000;

    if (sub === 'aim' && aimPreviewT > 0) aimPreviewT -= dt;

    // anticipation freeze -> launch (render-clock, 80 ms)
    if (sub === 'anticipate') {
      anticT -= dt;
      if (anticT <= 0) doLaunch();
    }

    // fixed-step simulation
    if (mode === 'play') {
      acc += dt;
      var guard = 0;
      while (acc >= DT && guard++ < 30) {
        acc -= DT;
        if (sub === 'flight') stepBall();
        stepGhost();
        simTime += DT;
      }
      // trail sampling
      if (sub === 'flight' && !ball.rest) {
        var spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (spd > 2.5) {
          trail.push(ball.x, ball.y);
          if (trail.length > 56) trail.splice(0, 2);
        }
        A.setRoll(ball.grounded ? spd : 0, ball.groundMat ? ball.groundMat._name : '');
      } else {
        A.setRoll(0);
      }
      if (sub === 'sink') {
        sinkT += dt;
        if (sinkT > 1.05) finishHole(true);
      }
    }

    shake *= Math.exp(-6 * dt);
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) elToast.classList.remove('show');
    }

    updateCam(dt);

    // render
    drawSky(time);
    drawSkyline();
    drawWorld(time);
    drawGhost();
    drawBallAndFx(time, dt);
    if (mode === 'play') drawAim();
    drawPinHint();
    drawVignette();
    screenTransform();
  }

  // tiny debug/test handle (read-only)
  window.__TSO = {
    getState: function () {
      return {
        mode: mode, sub: sub, strokes: strokes,
        x: ball.x, y: ball.y, rest: ball.rest, holed: ball.holed,
        rail: railThisStroke, dream: dreamThisStroke,
        ghost: !!ghost
      };
    }
  };

  updateHud();
  requestAnimationFrame(frame);
})();
