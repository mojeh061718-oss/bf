/* ============================================================
   WILDCAT — game.js
   Rendering, input, UI. Sim logic lives in sim.js (WC.*),
   audio in audio.js (WildAudio).
   ============================================================ */
(function () {
  'use strict';

  var WCC = WC.C;
  var AU = window.WildAudio;
  function $(id) { return document.getElementById(id); }

  var cvs = $('game'), ctx = cvs.getContext('2d');
  var chartCvs = $('chart'), chartCtx = chartCvs.getContext('2d');

  /* ---------------- state ---------------- */
  var seed = 1907;
  var G = null;
  var running = false;
  var mode = null;                 // 'sonar' | 'rig' | null
  var view = { scale: 0.38, ox: 0, surfY: 220, w: 390, h: 844, dpr: 1, worldW: 380 };
  var FOG_S = 0.5;
  var fog = document.createElement('canvas'), fogCtx = fog.getContext('2d');
  var terr = document.createElement('canvas'), terrCtx = terr.getContext('2d');
  var tmpA = document.createElement('canvas'), tmpACtx = tmpA.getContext('2d');
  var particles = [], floats = [], pings = [], gushers = [], fireworks = 0;
  var gasFade = {};                // gas index -> fade progress
  var shakeAmt = 0;
  var dispCash = 300;
  var priceHist = [], priceTimer = 0;
  var consumedReveals = 0, pipeRevIdx = [];
  var steer = { active: false, startX: 0, val: 0, id: -1 };
  var keySteer = { l: false, r: false };
  var coinTimer = 0, coinK = 0;
  var fullToastAt = -99;
  var wobT = 0, lastTs = 0;
  var newsUntil = 0;
  var resultsTimer = -1;
  var titleOn = true;
  var parX = 0;                    // sky parallax target

  /* ---------------- helpers ---------------- */
  function fm(n) { return Math.round(n).toLocaleString('en-US'); }
  function fmtT(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function w2sx(x) { return view.ox + x * view.scale; }
  function w2sy(y) { return view.surfY + y * view.scale; }
  function s2wx(px) { return (px - view.ox) / view.scale; }
  function pScale(p) { var r = Math.sqrt(Math.max(0.001, p.vol / p.vol0)); return Math.max(r, 0.22); }

  /* ---------------- layout ---------------- */
  function layout() {
    view.w = window.innerWidth; view.h = window.innerHeight;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width = Math.round(view.w * view.dpr);
    cvs.height = Math.round(view.h * view.dpr);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    view.scale = Math.min((view.w - 4) / WCC.W, (view.h - 265) / WCC.DEPTH);
    view.worldW = WCC.W * view.scale;
    view.ox = (view.w - view.worldW) / 2;
    view.surfY = view.h - 88 - WCC.DEPTH * view.scale;
    bakeTerrain();
  }
  window.addEventListener('resize', layout);

  /* ---------------- terrain bake ---------------- */
  var LAYER_COLS = ['#37294b', '#3d3158', '#333760', '#2b3d6a', '#254470', '#1f416e', '#193b64', '#15355b', '#122e50'];
  function layerYAt(L, x) { return L.y + Math.sin(x * L.freq + L.ph) * L.amp; }
  function bakeTerrain() {
    if (!G) return;
    var W = 1000, H = 1500;
    terr.width = W; terr.height = H;
    var c = terrCtx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    var Ls = G.lease.layers;
    for (var i = 0; i < Ls.length; i++) {
      var L = Ls[i];
      c.fillStyle = LAYER_COLS[L.i % LAYER_COLS.length];
      c.beginPath();
      c.moveTo(0, i === 0 ? 0 : layerYAt(L, 0));
      for (var x = 0; x <= W; x += 25) c.lineTo(x, i === 0 ? 0 : layerYAt(L, x));
      c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
      if (i > 0) {
        c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, layerYAt(L, 0));
        for (var x2 = 0; x2 <= W; x2 += 25) c.lineTo(x2, layerYAt(L, x2));
        c.stroke();
      }
    }
    // speckle grain
    var rng = WC.mulberry32(G.seed + 5);
    c.fillStyle = 'rgba(255,255,255,0.035)';
    for (var k = 0; k < 900; k++) {
      c.fillRect(rng() * W, rng() * H, 2 + rng() * 3, 2 + rng() * 3);
    }
    c.fillStyle = 'rgba(0,0,0,0.14)';
    for (var k2 = 0; k2 < 700; k2++) {
      c.fillRect(rng() * W, rng() * H, 2 + rng() * 3, 2 + rng() * 3);
    }
    // depth shading
    var gr = c.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(2,4,12,0.5)');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    // bedrock slabs
    for (var r = 0; r < G.lease.rocks.length; r++) {
      var rk = G.lease.rocks[r];
      c.save();
      c.translate(rk.x, rk.y); c.rotate(rk.rot);
      var hw = rk.w / 2, hh = rk.h / 2;
      c.fillStyle = '#0c0f18';
      roundRectPath(c, -hw, -hh, rk.w, rk.h, 10); c.fill();
      c.strokeStyle = 'rgba(140,160,210,0.3)'; c.lineWidth = 2.5;
      roundRectPath(c, -hw, -hh, rk.w, rk.h, 10); c.stroke();
      c.save();
      roundRectPath(c, -hw, -hh, rk.w, rk.h, 10); c.clip();
      c.strokeStyle = 'rgba(140,160,210,0.12)'; c.lineWidth = 3;
      for (var hx = -hw - hh; hx < hw + hh; hx += 16) {
        c.beginPath(); c.moveTo(hx, -hh); c.lineTo(hx + hh * 2, hh); c.stroke();
      }
      c.restore();
      c.restore();
    }
  }
  function roundRectPath(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ---------------- fog of war ---------------- */
  function resetFog() {
    fog.width = Math.round(WCC.W * FOG_S);
    fog.height = Math.round(WCC.DEPTH * FOG_S);
    fogCtx.setTransform(FOG_S, 0, 0, FOG_S, 0, 0);
    fogCtx.globalCompositeOperation = 'source-over';
    fogCtx.fillStyle = 'rgba(6,8,15,0.965)';
    fogCtx.fillRect(0, 0, WCC.W, WCC.DEPTH);
  }
  function coneHW(y) { return lerp(WCC.CONE_TOP, WCC.CONE_BOT, y / WCC.DEPTH); }
  function eraseConeSlice(x, y0, y1) {
    var c = fogCtx;
    c.globalCompositeOperation = 'destination-out';
    var hw0 = coneHW(y0), hw1 = coneHW(y1);
    var hw = Math.max(hw0, hw1);
    var g = c.createLinearGradient(x - hw, 0, x + hw, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.22, 'rgba(0,0,0,1)');
    g.addColorStop(0.78, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - hw0, y0 - 1);
    c.lineTo(x + hw0, y0 - 1);
    c.lineTo(x + hw1, y1 + 1);
    c.lineTo(x - hw1, y1 + 1);
    c.closePath();
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  function eraseCircle(x, y, r) {
    var c = fogCtx;
    c.globalCompositeOperation = 'destination-out';
    var g = c.createRadialGradient(x, y, r * 0.3, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  function erasePocket(p) {
    var sc = 1; // reveal full extent
    for (var i = 0; i < p.circles.length; i++) {
      var ci = p.circles[i];
      eraseCircle(p.cx + ci.dx * sc, p.cy + ci.dy * sc, ci.r * sc + 34);
    }
  }

  /* ---------------- game lifecycle ---------------- */
  function newGame(s) {
    seed = s;
    G = WC.createGame(seed);
    particles = []; floats = []; pings = []; gushers = [];
    gasFade = {}; shakeAmt = 0; fireworks = 0;
    dispCash = G.cash;
    priceHist = []; priceTimer = 0;
    consumedReveals = 0; pipeRevIdx = [];
    steer.active = false; steer.val = 0;
    coinTimer = 0; coinK = 0; fullToastAt = -99;
    resultsTimer = -1;
    mode = null;
    armButtons();
    resetFog();
    bakeTerrain();
    $('news').classList.add('hidden');
    $('results').classList.add('hidden');
    $('leaseTag').textContent = 'PROSPECT FLATS · LEASE #' + seed;
    $('loanchip').classList.remove('paid');
    closeShop();
    buildShop();
  }

  function start() {
    titleOn = false;
    $('title').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('controls').classList.remove('hidden');
    $('hint').classList.remove('hidden');
    running = true;
  }

  /* ---------------- toast / floats ---------------- */
  var toastTimer = 0;
  function toast(txt, kind) {
    var el = $('toast');
    el.textContent = txt;
    el.className = 'show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = ''; }, 1600);
  }
  function addFloat(wx, wy, txt, color, screenSpace) {
    floats.push({ x: wx, y: wy, txt: txt, color: color || '#ffb03b', t: 0, ss: !!screenSpace });
  }

  /* ---------------- particles ---------------- */
  function spawn(n, fn) { for (var i = 0; i < n; i++) particles.push(fn(i)); }
  function burstBlowout(wx, wy) {
    var sx = w2sx(wx), sy = w2sy(wy);
    spawn(26, function () {
      var a = Math.random() * 6.283, sp = 30 + Math.random() * 130;
      return { x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 90, life: 0.9 + Math.random() * 0.6, t: 0, size: 2 + Math.random() * 3.5, color: 'rgba(120,235,190,0.9)', type: 'dot' };
    });
    spawn(10, function () {
      return { x: sx + (Math.random() - 0.5) * 20, y: sy, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 60, g: -18, life: 1.6, t: 0, size: 8 + Math.random() * 14, color: 'rgba(140,220,200,0.2)', type: 'smoke' };
    });
  }
  function burstSurfaceGas(wx) {
    var sx = w2sx(wx), sy = view.surfY;
    spawn(18, function () {
      return { x: sx + (Math.random() - 0.5) * 10, y: sy, vx: (Math.random() - 0.5) * 46, vy: -120 - Math.random() * 160, g: 150, life: 1 + Math.random() * 0.5, t: 0, size: 2 + Math.random() * 3, color: 'rgba(150,240,200,0.9)', type: 'dot' };
    });
  }
  function sparkAt(sx, sy) {
    spawn(2, function () {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      return { x: sx, y: sy, vx: Math.cos(a) * (40 + Math.random() * 70), vy: Math.sin(a) * (40 + Math.random() * 70), g: 220, life: 0.35, t: 0, size: 1.6, color: 'rgba(255,190,90,1)', type: 'spark' };
    });
  }
  function barrelFly() {
    var tx = w2sx(depotX() + 8), ty = view.surfY - 26;
    var wx = w2sx(depotX() - 52), wy = view.surfY - 18;
    particles.push({ type: 'barrel', t: 0, life: 0.55, x0: tx, y0: ty, x1: wx, y1: wy });
  }
  function fireworkBurst() {
    var sx = view.ox + Math.random() * view.worldW, sy = view.surfY * (0.25 + Math.random() * 0.5);
    var cols = ['rgba(255,176,59,', 'rgba(160,92,255,', 'rgba(63,224,192,', 'rgba(255,120,150,'];
    var col = cols[(Math.random() * cols.length) | 0];
    spawn(26, function () {
      var a = Math.random() * 6.283, sp = 40 + Math.random() * 130;
      return { x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 70, life: 1 + Math.random() * 0.5, t: 0, size: 2 + Math.random() * 2, color: col + '0.95)', type: 'spark' };
    });
  }

  function stepParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      if (p.type !== 'barrel') {
        p.vy += (p.g || 0) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }
    for (var j = floats.length - 1; j >= 0; j--) {
      floats[j].t += dt;
      if (floats[j].t > 1.4) floats.splice(j, 1);
    }
  }
  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i], u = p.t / p.life, a = 1 - u;
      if (p.type === 'barrel') {
        var e = u * u * (3 - 2 * u);
        var bx = lerp(p.x0, p.x1, e), by = lerp(p.y0, p.y1, e) - Math.sin(e * Math.PI) * 46;
        ctx.save();
        ctx.translate(bx, by); ctx.rotate(e * 5);
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(-4, -5.5, 8, 11);
        ctx.fillStyle = '#c8934f';
        ctx.fillRect(-4, -2.5, 8, 1.6); ctx.fillRect(-4, 1, 8, 1.6);
        ctx.restore();
      } else if (p.type === 'smoke') {
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + u), 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.type === 'spark') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
        ctx.globalAlpha = 1;
      } else { // dot / oil drop
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
  function drawFloats() {
    ctx.textAlign = 'center';
    ctx.font = '800 14px -apple-system, "Segoe UI", sans-serif';
    for (var i = 0; i < floats.length; i++) {
      var f = floats[i], u = f.t / 1.4;
      var sx = f.ss ? f.x : w2sx(f.x);
      var sy = (f.ss ? f.y : w2sy(f.y)) - u * 36;
      ctx.globalAlpha = 1 - u * u;
      ctx.fillStyle = f.color;
      ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 6;
      ctx.fillText(f.txt, sx, sy);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------- sky & surface ---------------- */
  function drawSky(t) {
    var h = view.surfY;
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0b0c1e');
    g.addColorStop(0.45, '#2c1740');
    g.addColorStop(0.78, '#77335a');
    g.addColorStop(1, '#f78d4b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, h);

    var px = parX * 8;
    // sun
    var sx = view.ox + view.worldW * 0.72 - px * 1.6, sy = h - Math.min(74, h * 0.3), sr = Math.min(52, h * 0.24);
    var glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3.2);
    glow.addColorStop(0, 'rgba(255,190,110,0.5)');
    glow.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - sr * 3.2, sy - sr * 3.2, sr * 6.4, sr * 6.4);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, view.w, h); ctx.clip();
    ctx.fillStyle = '#ffd08a';
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 6.2832); ctx.fill();
    // geometric slats across sun
    ctx.fillStyle = 'rgba(119,51,90,0.85)';
    ctx.fillRect(sx - sr, sy + sr * 0.15, sr * 2, 4);
    ctx.fillRect(sx - sr, sy + sr * 0.45, sr * 2, 6);
    ctx.fillRect(sx - sr, sy + sr * 0.75, sr * 2, 8);
    ctx.restore();

    // drifting geometric clouds
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    var ct = (t * 4) % (view.w + 260) - 130;
    roundRectPath(ctx, ct - px * 2, h * 0.28, 120, 12, 6); ctx.fill();
    roundRectPath(ctx, view.w - ct * 0.6 - px * 2, h * 0.16, 90, 10, 5); ctx.fill();

    // far ridge
    ctx.fillStyle = 'rgba(30,16,44,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (var x = 0; x <= view.w; x += 40) {
      ctx.lineTo(x, h - 14 - 12 * Math.sin(x * 0.012 + 1.3) - 6 * Math.sin(x * 0.031) - px * 0.15);
    }
    ctx.lineTo(view.w, h); ctx.closePath(); ctx.fill();

    // boomtown silhouette
    ctx.fillStyle = '#120b20';
    var bx = view.ox + 6 - px * 0.5;
    townShape(bx, h);
    // horizon line
    var hg = ctx.createLinearGradient(0, h - 2, 0, h + 3);
    hg.addColorStop(0, 'rgba(255,176,59,0.9)');
    hg.addColorStop(1, 'rgba(255,176,59,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, h - 2, view.w, 5);
  }
  function townShape(x0, h) {
    var b = [[0, 20, 26], [30, 30, 22], [56, 14, 34], [74, 24, 18], [230, 18, 26], [252, 26, 20]];
    for (var i = 0; i < b.length; i++) {
      ctx.fillRect(x0 + b[i][0], h - b[i][2], b[i][1], b[i][2]);
    }
    // distant derrick silhouettes
    silDerrick(x0 + 130, h, 30);
    silDerrick(x0 + 196, h, 22);
    // windows
    ctx.fillStyle = 'rgba(255,176,59,0.55)';
    ctx.fillRect(x0 + 8, h - 18, 3, 3); ctx.fillRect(x0 + 16, h - 12, 3, 3);
    ctx.fillRect(x0 + 36, h - 24, 3, 3); ctx.fillRect(x0 + 60, h - 28, 3, 3);
    ctx.fillRect(x0 + 238, h - 20, 3, 3);
    ctx.fillStyle = '#120b20';
  }
  function silDerrick(x, h, s) {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.28, h); ctx.lineTo(x - s * 0.07, h - s); ctx.lineTo(x + s * 0.07, h - s); ctx.lineTo(x + s * 0.28, h);
    ctx.closePath(); ctx.fill();
  }

  /* ---------------- depot: tank + wagon ---------------- */
  function depotX() { return 900; }
  function drawDepot(t) {
    var lvl = G.upg.tank;
    var cap = WC.tankCap(G);
    var tw = (26 + lvl * 8) * Math.min(1, view.scale * 2.6);
    var th = (34 + lvl * 12) * Math.min(1, view.scale * 2.6);
    var x = w2sx(depotX()), y = view.surfY;

    // wagon
    var wx = w2sx(depotX() - 52);
    ctx.fillStyle = '#241a33';
    roundRectPath(ctx, wx - 17, y - 15, 34, 10, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
    roundRectPath(ctx, wx - 17, y - 15, 34, 10, 3); ctx.stroke();
    ctx.fillStyle = '#3b2a17';
    ctx.fillRect(wx - 13, y - 24, 7, 9); ctx.fillRect(wx - 4, y - 24, 7, 9); ctx.fillRect(wx + 5, y - 24, 7, 9);
    ctx.fillStyle = '#c8934f';
    ctx.fillRect(wx - 13, y - 21, 7, 1.5); ctx.fillRect(wx - 4, y - 21, 7, 1.5); ctx.fillRect(wx + 5, y - 21, 7, 1.5);
    ctx.fillStyle = '#0d1019';
    ctx.beginPath(); ctx.arc(wx - 9, y - 4, 4.5, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(wx + 9, y - 4, 4.5, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#6a7692';
    ctx.beginPath(); ctx.arc(wx - 9, y - 4, 2, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.arc(wx + 9, y - 4, 2, 0, 6.2832); ctx.stroke();

    // tank body
    var tx = x - tw / 2, ty = y - th - 3;
    ctx.fillStyle = '#171d2c';
    roundRectPath(ctx, tx, ty, tw, th, 7); ctx.fill();
    // oil fill w/ wavy luminous surface
    var frac = clamp(G.tank / cap, 0, 1);
    if (frac > 0.005) {
      ctx.save();
      roundRectPath(ctx, tx, ty, tw, th, 7); ctx.clip();
      var oy = ty + th - frac * (th - 4);
      var og = ctx.createLinearGradient(0, oy, 0, ty + th);
      og.addColorStop(0, '#b46dff');
      og.addColorStop(0.25, '#7a3fd6');
      og.addColorStop(1, '#3c1e70');
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.moveTo(tx, oy + Math.sin(t * 3) * 1.5);
      for (var sx2 = 0; sx2 <= tw; sx2 += 5) {
        ctx.lineTo(tx + sx2, oy + Math.sin(t * 3 + sx2 * 0.35) * 1.5);
      }
      ctx.lineTo(tx + tw, ty + th); ctx.lineTo(tx, ty + th); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(tx + 3, oy + 2, tw * 0.22, 2);
      ctx.restore();
      // glow
      ctx.shadowColor = 'rgba(160,92,255,0.7)'; ctx.shadowBlur = 12 * frac;
      ctx.strokeStyle = 'rgba(160,92,255,' + (0.25 + frac * 0.4) + ')'; ctx.lineWidth = 1.5;
      roundRectPath(ctx, tx, ty, tw, th, 7); ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
      roundRectPath(ctx, tx, ty, tw, th, 7); ctx.stroke();
    }
    // hoops
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
    for (var hp = 1; hp <= 2 + lvl; hp++) {
      var hy = ty + (th / (3 + lvl)) * hp;
      ctx.beginPath(); ctx.moveTo(tx, hy); ctx.lineTo(tx + tw, hy); ctx.stroke();
    }
    // legs
    ctx.fillStyle = '#0d1019';
    ctx.fillRect(tx + 2, y - 4, 3, 4); ctx.fillRect(tx + tw - 5, y - 4, 3, 4);
  }

  /* ---------------- derricks ---------------- */
  function drawDerricks(t) {
    for (var i = 0; i < G.derricks.length; i++) drawDerrick(G.derricks[i], i, t);
  }
  function drawDerrick(d, i, t) {
    var x = w2sx(d.x), y = view.surfY;
    var H = 52, wT = 6, wB = 15;
    var focused = (G.focus === i && d.state === 'drilling');
    var vib = d.state === 'drilling' ? Math.sin(t * 60 + i) * 0.6 : 0;

    ctx.save();
    ctx.translate(x + vib, y);

    if (focused) {
      ctx.fillStyle = 'rgba(255,176,59,0.16)';
      ctx.beginPath(); ctx.ellipse(0, 0, 24, 6, 0, 0, 6.2832); ctx.fill();
    }

    // tower
    var col = d.state === 'offline' ? '#4a3038' : (d.state === 'idle' ? '#39404f' : '#1b2233');
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-wB, 0); ctx.lineTo(-wT, -H); ctx.lineTo(wT, -H); ctx.lineTo(wB, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = d.state === 'pumping' ? 'rgba(196,150,255,0.85)' : 'rgba(220,228,246,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-wB, 0); ctx.lineTo(-wT, -H); ctx.lineTo(wT, -H); ctx.lineTo(wB, 0);
    ctx.closePath(); ctx.stroke();
    // cross braces
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(220,228,246,0.3)';
    for (var b = 1; b <= 3; b++) {
      var yy = -H * b / 4;
      var half = lerp(wB, wT, b / 4);
      ctx.beginPath(); ctx.moveTo(-half, yy); ctx.lineTo(half, yy); ctx.stroke();
      var half2 = lerp(wB, wT, (b - 1) / 4);
      ctx.beginPath(); ctx.moveTo(-half2, -H * (b - 1) / 4); ctx.lineTo(half, yy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(half2, -H * (b - 1) / 4); ctx.lineTo(-half, yy); ctx.stroke();
    }
    // crown
    ctx.fillStyle = '#dce4f6';
    ctx.fillRect(-wT - 2, -H - 4, (wT + 2) * 2, 4);

    if (d.state === 'drilling') {
      // spinning drawworks at base
      ctx.strokeStyle = '#ffb03b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -8, 5, t * 7, t * 7 + 2.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -8, 5, t * 7 + 3.6, t * 7 + 5.4); ctx.stroke();
    }
    if (d.state === 'pumping') {
      // walking-beam pump jack
      d.ph = (d.ph || 0);
      var rocking = d.flow > 0.01;
      if (rocking) d.ph += 0.045 * (1 + WC.pumpRate(G));
      var ang = Math.sin(d.ph) * 0.22;
      ctx.save();
      ctx.translate(0, -H * 0.55);
      ctx.rotate(ang);
      ctx.fillStyle = '#e8d7b8';
      ctx.fillRect(-20, -2.4, 40, 4.8);
      ctx.beginPath(); ctx.arc(-22, 0, 5, 0, 6.2832); ctx.fillStyle = '#39404f'; ctx.fill(); // counterweight
      ctx.beginPath(); // horsehead
      ctx.moveTo(16, -6); ctx.lineTo(24, -2); ctx.lineTo(24, 4); ctx.lineTo(16, 6);
      ctx.closePath(); ctx.fillStyle = '#e8d7b8'; ctx.fill();
      ctx.restore();
    }
    if (d.state === 'offline' || d.state === 'broken') {
      var rem = clamp((d.offlineUntil - G.t) / (d.brokenPipe ? WCC.BLOWOUT_COOLDOWN : WCC.BROKEN_COOLDOWN), 0, 1);
      ctx.strokeStyle = 'rgba(255,93,106,0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, -H - 14, 7, -Math.PI / 2, -Math.PI / 2 + (1 - rem) * 6.2832); ctx.stroke();
      if (Math.sin(t * 8) > 0) {
        ctx.fillStyle = '#ff5d6a';
        ctx.beginPath(); ctx.arc(0, -H - 14, 2.5, 0, 6.2832); ctx.fill();
      }
    }
    // blowout preventer: teal valve at base
    if (G.upg.bop) {
      ctx.fillStyle = '#0f4a44';
      roundRectPath(ctx, -6, -5, 12, 7, 2); ctx.fill();
      ctx.strokeStyle = '#3fe0c0'; ctx.lineWidth = 1.4;
      roundRectPath(ctx, -6, -5, 12, 7, 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -1.5, 2.6, 0, 6.2832); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-3, -1.5); ctx.lineTo(3, -1.5); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- pipes & bits ---------------- */
  function drawPipes(t) {
    for (var i = 0; i < G.derricks.length; i++) {
      var d = G.derricks[i];
      if (!d.pipe || d.pipe.length < 1 || !d.bit && d.state === 'idle') continue;
      if (!d.pipe.length) continue;
      var broken = d.brokenPipe;
      var n = broken ? Math.max(2, Math.floor(d.pipe.length * 0.6)) : d.pipe.length;

      // outline
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(8,10,16,0.85)';
      ctx.lineWidth = 4.5;
      pipePath(d, n); ctx.stroke();
      ctx.strokeStyle = broken ? 'rgba(150,120,120,0.7)' : '#c2cade';
      ctx.lineWidth = 2.2;
      pipePath(d, n); ctx.stroke();

      // flowing oil in pipe while pumping
      if (d.state === 'pumping' && d.flow > 0.01) {
        ctx.save();
        ctx.strokeStyle = 'rgba(180,109,255,0.95)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 9]);
        ctx.lineDashOffset = t * 46;
        ctx.shadowColor = 'rgba(160,92,255,0.8)'; ctx.shadowBlur = 5;
        pipePath(d, n); ctx.stroke();
        ctx.restore();
      }
      if (broken && Math.sin(t * 9 + i) > 0.2) {
        var bp = d.pipe[n - 1];
        ctx.fillStyle = 'rgba(150,240,200,0.7)';
        ctx.beginPath(); ctx.arc(w2sx(bp.x), w2sy(bp.y), 2.5 + Math.random() * 1.5, 0, 6.2832); ctx.fill();
      }

      // the bit
      if (d.state === 'drilling' && d.bit) {
        var bx = w2sx(d.bit.x), by = w2sy(d.bit.y);
        var dia = !!G.upg.diamond;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(d.bit.ang);
        ctx.shadowColor = dia ? 'rgba(110,240,255,0.9)' : 'rgba(255,176,59,0.9)';
        ctx.shadowBlur = 9;
        ctx.fillStyle = dia ? '#6ff0ff' : '#ffb03b';
        ctx.beginPath();
        ctx.moveTo(-4, -2); ctx.lineTo(4, -2); ctx.lineTo(0, 6);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        if (dia) {
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1;
          var sa = t * 10;
          ctx.beginPath(); ctx.moveTo(Math.cos(sa) * 7, Math.sin(sa) * 7); ctx.lineTo(Math.cos(sa) * 10, Math.sin(sa) * 10); ctx.stroke();
        }
        ctx.restore();
        if (d.grind) sparkAt(bx, by);
        // wear indicator
        if (d.wear > 20) {
          ctx.strokeStyle = d.wear > 70 ? 'rgba(255,93,106,0.95)' : 'rgba(255,176,59,0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(bx, by, 10, -Math.PI / 2, -Math.PI / 2 + (d.wear / 100) * 6.2832); ctx.stroke();
        }
        // focused halo + steer arrow
        if (G.focus === i) {
          ctx.strokeStyle = 'rgba(255,176,59,0.35)';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(bx, by, 14 + Math.sin(t * 4) * 2, 0, 6.2832); ctx.stroke();
        }
      }
    }
  }
  function pipePath(d, n) {
    ctx.beginPath();
    ctx.moveTo(w2sx(d.pipe[0].x), view.surfY);
    for (var k = 0; k < n; k++) ctx.lineTo(w2sx(d.pipe[k].x), w2sy(d.pipe[k].y));
    if (!d.brokenPipe && d.bit && (d.state === 'drilling' || d.state === 'pumping')) ctx.lineTo(w2sx(d.bit.x), w2sy(d.bit.y));
  }

  /* ---------------- pockets ---------------- */
  function pocketPathScreen(p, inflate, sc) {
    ctx.beginPath();
    for (var i = 0; i < p.circles.length; i++) {
      var c = p.circles[i];
      var cx = w2sx(p.cx + c.dx * sc), cy = w2sy(p.cy + c.dy * sc);
      var r = Math.max(1, (c.r * sc + (inflate || 0)) * view.scale);
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, 6.2832);
    }
  }
  function drawOilPockets(t) {
    for (var i = 0; i < G.lease.pockets.length; i++) {
      var p = G.lease.pockets[i];
      if (p.vol <= 0 && !p.struck) continue;
      var sc = pScale(p);
      var wob = 1 + Math.sin(t * 1.7 + i * 2.1) * 0.012;
      var scw = sc * wob;
      if (p.struck) {
        if (p.vol <= 0) continue;
        // luminous filled oil
        ctx.save();
        ctx.shadowColor = 'rgba(160,92,255,0.55)';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#0e0618';
        pocketPathScreen(p, 0, scw); ctx.fill();
        ctx.shadowBlur = 0;
        // iridescent sheen
        pocketPathScreen(p, 0, scw);
        ctx.clip();
        var cx = w2sx(p.cx), cy = w2sy(p.cy), R = p.R * sc * view.scale;
        var sg = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.5, 0, cx, cy, R * 1.5);
        sg.addColorStop(0, 'rgba(178,120,255,0.5)');
        sg.addColorStop(0.55, 'rgba(120,60,220,0.16)');
        sg.addColorStop(1, 'rgba(20,8,40,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
        // moving band
        var bandX = cx + Math.sin(t * 0.7 + i) * R;
        var bg = ctx.createLinearGradient(bandX - R * 0.5, 0, bandX + R * 0.5, 0);
        bg.addColorStop(0, 'rgba(63,224,192,0)');
        bg.addColorStop(0.5, 'rgba(63,224,192,0.13)');
        bg.addColorStop(1, 'rgba(255,110,190,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
        ctx.restore();
        // rim
        ctx.strokeStyle = 'rgba(196,140,255,0.8)';
        ctx.lineWidth = 1.6;
        ctx.shadowColor = 'rgba(160,92,255,0.9)'; ctx.shadowBlur = 8;
        pocketPathScreen(p, 0, scw); ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // unstruck: glowing edge hint only (masked by fog)
        var pulse = 0.5 + 0.28 * Math.sin(t * 2.2 + i * 1.7);
        ctx.save();
        ctx.strokeStyle = 'rgba(198,146,255,' + pulse + ')';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(160,92,255,0.9)';
        ctx.shadowBlur = 10;
        pocketPathScreen(p, 0, scw); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,' + pulse * 0.25 + ')';
        ctx.lineWidth = 0.8;
        pocketPathScreen(p, 3, scw); ctx.stroke();
        ctx.restore();
      }
    }
  }
  function drawGasPockets(t) {
    for (var i = 0; i < G.lease.gas.length; i++) {
      var gp = G.lease.gas[i];
      var fade = 1;
      if (!gp.alive) {
        gasFade[i] = (gasFade[i] === undefined ? 0 : gasFade[i]);
        fade = 1 - gasFade[i];
        if (fade <= 0) continue;
      }
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(90,230,190,0.09)';
      gasPath(gp); ctx.fill();
      ctx.strokeStyle = 'rgba(90,230,190,0.5)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 6]);
      ctx.lineDashOffset = -t * 8;
      gasPath(gp); ctx.stroke();
      ctx.setLineDash([]);
      // rising bubbles
      for (var b = 0; b < 3; b++) {
        var u = ((t * 0.35 + b * 0.33 + i * 0.21) % 1);
        var bx = w2sx(gp.cx + Math.sin(b * 5 + i) * gp.R * 0.4);
        var by = w2sy(gp.cy + gp.R * 0.5 - u * gp.R);
        ctx.globalAlpha = fade * (1 - u) * 0.7;
        ctx.strokeStyle = 'rgba(150,240,200,0.8)';
        ctx.beginPath(); ctx.arc(bx, by, 2, 0, 6.2832); ctx.stroke();
      }
      ctx.restore();
    }
  }
  function gasPath(gp) {
    ctx.beginPath();
    for (var i = 0; i < gp.circles.length; i++) {
      var c = gp.circles[i];
      var cx = w2sx(gp.cx + c.dx), cy = w2sy(gp.cy + c.dy);
      var r = c.r * view.scale;
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, 6.2832);
    }
  }

  /* ---------------- sonar ping visuals ---------------- */
  function stepPings(dt) {
    for (var i = pings.length - 1; i >= 0; i--) {
      var p = pings[i];
      var u0 = p.u || 0;
      p.u = Math.min(1, u0 + dt / 0.85);
      // erase newly swept slice of fog
      var y0 = u0 * WCC.DEPTH, y1 = p.u * WCC.DEPTH;
      eraseConeSlice(p.x, y0, y1);
      if (p.u >= 1 && p.t2 === undefined) p.t2 = 0;
      if (p.t2 !== undefined) {
        p.t2 += dt;
        if (p.t2 > 0.5) pings.splice(i, 1);
      }
    }
  }
  function drawPings(t) {
    for (var i = 0; i < pings.length; i++) {
      var p = pings[i];
      var sx = w2sx(p.x);
      if (p.u < 1) {
        var fy = w2sy(p.u * WCC.DEPTH);
        var hw = coneHW(p.u * WCC.DEPTH) * view.scale;
        ctx.strokeStyle = 'rgba(120,220,255,0.85)';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(120,220,255,0.9)'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(sx - hw, fy); ctx.lineTo(sx + hw, fy); ctx.stroke();
        ctx.shadowBlur = 0;
        // surface rings
        var rr = p.u * 26;
        ctx.strokeStyle = 'rgba(120,220,255,' + (1 - p.u) * 0.8 + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(sx, view.surfY, 6 + rr, Math.PI, 0, true); ctx.stroke();
      } else {
        var a = 1 - p.t2 / 0.5;
        ctx.strokeStyle = 'rgba(120,220,255,' + a * 0.5 + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx - WCC.CONE_TOP * view.scale, view.surfY);
        ctx.lineTo(sx - coneHW(WCC.DEPTH) * view.scale, w2sy(WCC.DEPTH));
        ctx.moveTo(sx + WCC.CONE_TOP * view.scale, view.surfY);
        ctx.lineTo(sx + coneHW(WCC.DEPTH) * view.scale, w2sy(WCC.DEPTH));
        ctx.stroke();
      }
    }
  }

  /* ---------------- gushers ---------------- */
  function stepGushers(dt, t) {
    for (var i = gushers.length - 1; i >= 0; i--) {
      var gu = gushers[i];
      if (t > gu.until) { gushers.splice(i, 1); continue; }
      var sx = w2sx(gu.x), sy = view.surfY - 56;
      spawn(5, function () {
        return {
          x: sx + (Math.random() - 0.5) * 6, y: sy,
          vx: (Math.random() - 0.5) * 70, vy: -170 - Math.random() * 130,
          g: 340, life: 1 + Math.random() * 0.6, t: 0,
          size: 2 + Math.random() * 2.6, color: 'rgba(160,92,255,0.95)', type: 'dot'
        };
      });
    }
  }
  function drawGushers(t) {
    for (var i = 0; i < gushers.length; i++) {
      var gu = gushers[i];
      var sx = w2sx(gu.x);
      var a = clamp((gu.until - t) / 2.4, 0, 1);
      ctx.save();
      ctx.globalAlpha = a * 0.8;
      var g = ctx.createLinearGradient(0, view.surfY - 120, 0, view.surfY);
      g.addColorStop(0, 'rgba(160,92,255,0)');
      g.addColorStop(1, 'rgba(160,92,255,0.65)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 3.5, view.surfY - 120, 7, 120 - 56);
      ctx.restore();
    }
  }

  /* ---------------- reveals intake ---------------- */
  function processReveals() {
    while (consumedReveals < G.reveals.length) {
      var r = G.reveals[consumedReveals++];
      if (r.type === 'cone') pings.push({ x: r.x, u: 0 });
      else if (r.type === 'pocket') erasePocket(G.lease.pockets[r.i]);
    }
    for (var i = 0; i < G.derricks.length; i++) {
      var d = G.derricks[i];
      if (!d.pipe) continue;
      var from = pipeRevIdx[i] || 0;
      for (var k = from; k < d.pipe.length; k++) eraseCircle(d.pipe[k].x, d.pipe[k].y, 58);
      pipeRevIdx[i] = d.pipe.length;
    }
  }

  /* ---------------- sim events intake ---------------- */
  function processEvents() {
    for (var i = 0; i < G.events.length; i++) {
      var ev = G.events[i];
      switch (ev.type) {
        case 'spud': AU.spud(); break;
        case 'strike':
          AU.strike();
          shakeAmt = Math.max(shakeAmt, 5);
          gushers.push({ x: G.derricks[ev.d].x, until: wobT + 2.4 });
          toast('STRIKE!', 'good');
          addFloat(ev.x, ev.y - 30, 'OIL!', '#c896ff');
          break;
        case 'blowout':
          AU.blowout();
          shakeAmt = Math.max(shakeAmt, 14);
          burstBlowout(ev.x, ev.y);
          burstSurfaceGas(G.derricks[ev.d].x);
          toast('BLOWOUT! RIG OFFLINE', 'bad');
          break;
        case 'capture':
          AU.capture();
          addFloat(ev.x, ev.y, '+$' + ev.bonus + ' GAS', '#3fe0c0');
          burstSurfaceGas(G.derricks[ev.d].x);
          flashCash();
          break;
        case 'broken':
          AU.broken();
          shakeAmt = Math.max(shakeAmt, 6);
          toast('BIT DESTROYED', 'bad');
          break;
        case 'dry':
          AU.dry();
          toast('DRY HOLE');
          break;
        case 'drained':
          AU.drained();
          toast('POCKET DRAINED');
          break;
        case 'saleEnd':
          AU.saleEnd(ev.total);
          addFloat(w2sx(depotX() - 52), view.surfY - 46, '+$' + fm(ev.total), '#ffb03b', true);
          flashCash();
          break;
        case 'interest':
          AU.interest();
          var lc = $('loanchip');
          lc.classList.remove('pulse'); void lc.offsetWidth; lc.classList.add('pulse');
          break;
        case 'autosell':
          toast('AUTO-SOLD ' + Math.ceil(ev.bbl) + ' bbl FOR INTEREST', 'bad');
          break;
        case 'loan':
          if (ev.left <= 0) {
            AU.loanPaid();
            toast('LOAN PAID OFF!', 'good');
            $('loanchip').classList.add('paid');
          } else {
            AU.tick();
          }
          break;
        case 'spike':
          showNews(ev.label, ev.until);
          AU.tick();
          break;
        case 'spikeEnd':
          $('news').classList.add('hidden');
          break;
        case 'won':
          AU.win();
          fireworks = 3.2;
          resultsTimer = 1.6;
          break;
        case 'lost':
          AU.lose();
          shakeAmt = 10;
          resultsTimer = 1.3;
          break;
      }
    }
    G.events.length = 0;
  }
  function flashCash() {
    var el = $('cash');
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }
  function showNews(label, until) {
    $('newstext').textContent = label;
    $('news').classList.remove('hidden');
    newsUntil = until;
  }

  /* ---------------- HUD ---------------- */
  function updateHUD(dt) {
    // cash counter easing
    var diff = G.cash - dispCash;
    dispCash += diff * Math.min(1, dt * 7);
    if (Math.abs(diff) < 0.6) dispCash = G.cash;
    $('cash').textContent = '$' + fm(dispCash);

    var nw = WC.netWorth(G);
    var nwEl = $('networth');
    nwEl.textContent = 'NET ' + (nw < 0 ? '−$' + fm(-nw) : '$' + fm(nw)) + ' / $5,000';
    nwEl.classList.toggle('good', nw >= WCC.WIN_NW);

    var lc = $('loanchip');
    if (G.debt > 0) {
      $('loanamt').textContent = '$' + fm(G.debt);
      $('paylab').textContent = 'PAY';
      lc.classList.toggle('canpay', G.cash >= Math.min(G.debt, 150));
      var frac = clamp((G.nextInterest - G.t) / WCC.INTEREST_EVERY, 0, 1);
      $('loanbar').style.transform = 'scaleX(' + frac.toFixed(3) + ')';
    } else {
      $('loanamt').textContent = 'PAID';
      $('paylab').textContent = '✓';
      lc.classList.remove('canpay');
      $('loanbar').style.transform = 'scaleX(0)';
    }

    var p = WC.priceAt(G);
    $('price').innerHTML = '$' + p.toFixed(2) + '<i>/bbl</i>';
    $('marketcard').classList.toggle('spike', !!G.spikeOn);

    // news countdown
    if (!$('news').classList.contains('hidden') && newsUntil > 0) {
      var rem = clamp((newsUntil - G.t) / (G.spikeOn ? G.spikeOn.dur : 18), 0, 1);
      $('newsbar').style.transform = 'scaleX(' + rem.toFixed(3) + ')';
    }

    // sonar
    var sc = $('sonarCount');
    sc.textContent = G.sonar;
    sc.classList.toggle('zero', G.sonar === 0);

    // tank
    var cap = WC.tankCap(G);
    var fr = clamp(G.tank / cap, 0, 1);
    $('tankfill').style.width = (fr * 100).toFixed(1) + '%';
    $('tanklab').textContent = 'TANK ' + Math.floor(G.tank) + ' / ' + cap + ' bbl';
    var tm = document.querySelector('.tank-meter');
    tm.classList.toggle('full', fr >= 0.995);
    if (fr >= 0.995 && G.t - fullToastAt > 12) {
      fullToastAt = G.t;
      toast('TANK FULL — SELL!', 'good');
    }

    // sell button
    var sellBtn = $('btnSell');
    sellBtn.classList.toggle('empty', G.tank < 0.5);
    sellBtn.classList.toggle('holding', G.selling && G.tank >= 0.5);
    $('sellSub').textContent = Math.floor(G.tank) + ' bbl · ~$' + fm(G.tank * p);

    $('shopCash').textContent = '$' + fm(G.cash);
    updateShopAfford();
    updateHint();
  }

  /* ---------------- price chart ---------------- */
  function updateChart(dt) {
    priceTimer -= dt;
    if (priceTimer <= 0) {
      priceTimer = 0.3;
      priceHist.push({ t: G.t, p: WC.priceAt(G), s: !!G.spikeOn });
      if (priceHist.length > 300) priceHist.shift();
    }
    var c = chartCtx;
    var dpr = view.dpr;
    if (chartCvs.width !== 140 * dpr) { chartCvs.width = 140 * dpr; chartCvs.height = 42 * dpr; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, 140, 42);
    if (priceHist.length < 2) return;
    var mn = 1e9, mx = -1e9;
    for (var i = 0; i < priceHist.length; i++) {
      if (priceHist[i].p < mn) mn = priceHist[i].p;
      if (priceHist[i].p > mx) mx = priceHist[i].p;
    }
    mn = Math.min(mn, 12); mx = Math.max(mx, 24);
    var pad = (mx - mn) * 0.12;
    mn -= pad; mx += pad;
    function py(v) { return 42 - ((v - mn) / (mx - mn)) * 40 - 1; }
    var t0 = priceHist[0].t, t1 = priceHist[priceHist.length - 1].t;
    var span = Math.max(20, t1 - t0);
    function px(tv) { return 2 + ((tv - t0) / span) * 136; }
    // baseline midline
    c.strokeStyle = 'rgba(255,255,255,0.1)';
    c.lineWidth = 1;
    c.setLineDash([2, 3]);
    c.beginPath(); c.moveTo(0, py(WCC.PRICE_BASE)); c.lineTo(140, py(WCC.PRICE_BASE)); c.stroke();
    c.setLineDash([]);
    // area fill
    c.beginPath();
    c.moveTo(px(priceHist[0].t), py(priceHist[0].p));
    for (var k = 1; k < priceHist.length; k++) c.lineTo(px(priceHist[k].t), py(priceHist[k].p));
    c.lineTo(px(t1), 42); c.lineTo(px(t0), 42); c.closePath();
    var ag = c.createLinearGradient(0, 0, 0, 42);
    ag.addColorStop(0, 'rgba(255,176,59,0.28)');
    ag.addColorStop(1, 'rgba(255,176,59,0)');
    c.fillStyle = ag; c.fill();
    // line (amber, brighter during spikes)
    c.lineWidth = 1.6;
    c.lineJoin = 'round';
    c.beginPath();
    for (var m = 0; m < priceHist.length; m++) {
      var X = px(priceHist[m].t), Y = py(priceHist[m].p);
      if (m === 0) c.moveTo(X, Y); else c.lineTo(X, Y);
    }
    c.strokeStyle = G.spikeOn ? '#ffd08a' : '#ffb03b';
    c.stroke();
    // current dot
    var lp = priceHist[priceHist.length - 1];
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(px(lp.t), py(lp.p), 2.2, 0, 6.2832); c.fill();
  }

  /* ---------------- hint system ---------------- */
  var shopEverOpened = false;
  function updateHint() {
    var el = $('hint');
    var msg = null;
    var anyDrilling = false, anyPumping = false;
    for (var i = 0; i < G.derricks.length; i++) {
      if (G.derricks[i].state === 'drilling') anyDrilling = true;
      if (G.derricks[i].state === 'pumping') anyPumping = true;
    }
    if (G.phase !== 'play') msg = null;
    else if (mode === 'sonar') msg = 'TAP THE LAND to fire the sonar charge';
    else if (mode === 'rig') msg = 'TAP THE SURFACE to plant your derrick';
    else if (G.stats.sonars === 0) msg = 'TAP <b>SONAR</b> — then tap the land to scan for oil';
    else if (G.derricks.length === 0) msg = 'TAP <b>RIG</b> — then tap the surface near a glow';
    else if (G.stats.strikes === 0 && anyDrilling) msg = '<b>DRAG</b> left / right to steer the bit into the glow';
    else if (G.stats.revenue === 0 && (anyPumping || G.tank > 3)) msg = 'HOLD <b>SELL</b> — time it to the price chart';
    else if (!shopEverOpened && G.stats.revenue > 0) msg = 'Open the <b>SHOP</b> — upgrades change everything';
    else if (G.debt > 0 && G.cash >= G.debt) msg = 'You can clear the loan — tap <b>PAY</b>';
    if (msg) {
      if (el.dataset.msg !== msg) { el.innerHTML = msg; el.dataset.msg = msg; }
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
      el.dataset.msg = '';
    }
  }

  /* ---------------- shop ---------------- */
  var ICONS = {
    bit: '<path d="M12 3v8M7 11h10l-5 9z"/>',
    diamond: '<path d="M12 3l6 6-6 12-6-12zM6 9h12"/>',
    bop: '<circle cx="12" cy="12" r="5" fill="none"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    tank: '<rect x="5" y="6" width="14" height="14" rx="2" fill="none"/><path d="M5 13c2.5-2 4.5 2 7 0s4.5-1 7 0"/>',
    pump: '<path d="M4 20h16M7 20l3-9h4l3 9M5 11l14-3M19 8v4"/>',
    derrick2: '<path d="M5 20L7 6l2 14M15 20l2-14 2 14M3 20h18"/>',
    horiz: '<path d="M6 3v7a6 6 0 0 0 6 6h9M17 12l4 4-4 4"/>',
    sonar: '<circle cx="7" cy="17" r="1.6"/><path d="M7 10a7 7 0 0 1 7 7M7 4a13 13 0 0 1 13 13" fill="none"/>'
  };
  function buildShop() {
    var list = $('shopList');
    list.innerHTML = '';
    for (var i = 0; i < WC.UPGRADES.length; i++) {
      var def = WC.UPGRADES[i];
      var card = document.createElement('div');
      card.className = 'upg';
      card.id = 'upg-' + def.id;
      var pips = '';
      if (!def.consumable && def.costs.length > 1) {
        pips = '<span class="pips">';
        for (var pl = 0; pl < def.costs.length; pl++) pips += '<i></i>';
        pips += '</span>';
      }
      card.innerHTML =
        '<div class="icon"><svg viewBox="0 0 24 24">' + ICONS[def.id] + '</svg></div>' +
        '<div class="info"><h3>' + def.name + pips + '</h3><p>' + def.desc + '</p></div>' +
        '<button class="buybtn" data-id="' + def.id + '">$' + fm(def.costs[0]) + '</button>';
      list.appendChild(card);
    }
    list.addEventListener('click', onShopClick);
  }
  function onShopClick(e) {
    var btn = e.target.closest('.buybtn');
    if (!btn) return;
    var id = btn.dataset.id;
    var cost = WC.upgradeCost(G, id);
    if (cost === null || G.cash < cost) { AU.deny(); return; }
    if (WC.buy(G, id)) {
      AU.buy();
      shakeAmt = Math.max(shakeAmt, 2);
      var card = $('upg-' + id);
      card.classList.remove('justbought'); void card.offsetWidth; card.classList.add('justbought');
      setTimeout(function () { card.classList.remove('justbought'); }, 900);
      if (id === 'sonar') toast('+1 SONAR CHARGE', 'good');
      else toast(nameOf(id) + ' INSTALLED', 'good');
    }
  }
  function nameOf(id) {
    for (var i = 0; i < WC.UPGRADES.length; i++) if (WC.UPGRADES[i].id === id) return WC.UPGRADES[i].name;
    return id;
  }
  function updateShopAfford() {
    if (!$('shop').classList.contains('open')) return;
    for (var i = 0; i < WC.UPGRADES.length; i++) {
      var def = WC.UPGRADES[i];
      var card = $('upg-' + def.id);
      if (!card) continue;
      var btn = card.querySelector('.buybtn');
      var cost = WC.upgradeCost(G, def.id);
      if (cost === null) {
        btn.textContent = def.costs.length > 1 ? 'MAXED' : 'OWNED';
        btn.className = 'buybtn owned';
      } else {
        btn.textContent = '$' + fm(cost);
        btn.className = 'buybtn' + (G.cash < cost ? ' cant' : '');
      }
      var pipEls = card.querySelectorAll('.pips i');
      var lvl = G.upg[def.id] || 0;
      for (var k = 0; k < pipEls.length; k++) pipEls[k].classList.toggle('on', k < lvl);
    }
  }
  function openShop() {
    shopEverOpened = true;
    $('shop').classList.remove('hidden');
    requestAnimationFrame(function () { $('shop').classList.add('open'); });
    updateShopAfford();
  }
  function closeShop() { $('shop').classList.remove('open'); }
  function shopIsOpen() { return $('shop').classList.contains('open'); }

  /* ---------------- results ---------------- */
  function showResults() {
    running = false;
    var won = G.phase === 'won';
    var res = $('results');
    res.classList.toggle('lost', !won);
    $('resTitle').textContent = won ? 'LEASE CLEARED' : 'BANKRUPT';
    var stars = won ? WC.grade(G.winT) : 0;
    var starEls = $('stars').querySelectorAll('i');
    for (var i = 0; i < 3; i++) starEls[i].classList.toggle('on', i < stars);
    $('resTime').textContent = won ? ('$5,000 IN ' + fmtT(G.winT)) : ('SURVIVED ' + fmtT(G.t));
    $('stPockets').textContent = G.stats.strikes + '/' + G.lease.pockets.length;
    $('stDrained').textContent = G.stats.drained;
    $('stBest').textContent = '$' + fm(G.stats.bestSale);
    $('stUpg').textContent = G.stats.upgrades;
    $('stRev').textContent = '$' + fm(G.stats.revenue);
    $('stInt').textContent = '$' + fm(G.stats.interestPaid);
    drawNwGraph();
    res.classList.remove('hidden');
  }
  function drawNwGraph() {
    var c = $('nwgraph').getContext('2d');
    var dpr = view.dpr, W = 320, H = 130;
    $('nwgraph').width = W * dpr; $('nwgraph').height = H * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    var h = G.hist;
    if (h.length < 2) return;
    var mn = 0, mx = WCC.WIN_NW;
    for (var i = 0; i < h.length; i++) {
      if (h[i][1] < mn) mn = h[i][1];
      if (h[i][1] > mx) mx = h[i][1];
    }
    var pad = (mx - mn) * 0.08;
    mn -= pad; mx += pad;
    var t1 = h[h.length - 1][0] || 1;
    function X(t) { return 8 + (t / t1) * (W - 16); }
    function Y(v) { return H - 10 - ((v - mn) / (mx - mn)) * (H - 22); }
    // goal + zero lines
    c.strokeStyle = 'rgba(100,221,133,0.5)';
    c.setLineDash([4, 4]); c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, Y(WCC.WIN_NW)); c.lineTo(W, Y(WCC.WIN_NW)); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.14)';
    c.beginPath(); c.moveTo(0, Y(0)); c.lineTo(W, Y(0)); c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(100,221,133,0.75)';
    c.font = '700 8px -apple-system, sans-serif';
    c.fillText('$5,000 GOAL', 6, Y(WCC.WIN_NW) - 4);
    // area
    c.beginPath();
    c.moveTo(X(h[0][0]), Y(h[0][1]));
    for (var k = 1; k < h.length; k++) c.lineTo(X(h[k][0]), Y(h[k][1]));
    c.lineTo(X(t1), H); c.lineTo(X(0), H); c.closePath();
    var ag = c.createLinearGradient(0, 0, 0, H);
    ag.addColorStop(0, 'rgba(255,176,59,0.3)');
    ag.addColorStop(1, 'rgba(255,176,59,0)');
    c.fillStyle = ag; c.fill();
    // line
    c.strokeStyle = '#ffb03b'; c.lineWidth = 2; c.lineJoin = 'round';
    c.beginPath();
    for (var m = 0; m < h.length; m++) {
      var xx = X(h[m][0]), yy = Y(h[m][1]);
      if (m === 0) c.moveTo(xx, yy); else c.lineTo(xx, yy);
    }
    c.stroke();
    var last = h[h.length - 1];
    c.fillStyle = G.phase === 'won' ? '#64dd85' : '#ff5d6a';
    c.beginPath(); c.arc(X(last[0]), Y(last[1]), 3.5, 0, 6.2832); c.fill();
  }

  /* ---------------- input ---------------- */
  function armButtons() {
    $('btnSonar').classList.toggle('armed', mode === 'sonar');
    $('btnRig').classList.toggle('armed', mode === 'rig');
  }
  $('btnSonar').addEventListener('click', function () {
    AU.unlock();
    if (G.sonar <= 0) { AU.deny(); toast('NO CHARGES — BUY MORE IN SHOP'); mode = null; armButtons(); openShop(); return; }
    mode = mode === 'sonar' ? null : 'sonar';
    AU.tick();
    armButtons();
  });
  $('btnRig').addEventListener('click', function () {
    AU.unlock();
    mode = mode === 'rig' ? null : 'rig';
    AU.tick();
    armButtons();
  });
  $('btnShop').addEventListener('click', function () {
    AU.unlock(); AU.tick();
    if (shopIsOpen()) closeShop(); else openShop();
  });
  $('shopClose').addEventListener('click', function () { AU.tick(); closeShop(); });
  $('loanchip').addEventListener('click', function () {
    AU.unlock();
    if (G.debt <= 0) return;
    var paid = WC.payLoan(G);
    if (paid <= 0) { AU.deny(); toast('NO CASH TO PAY'); }
    else if (G.debt > 0) toast('PAID $' + fm(paid) + ' — $' + fm(G.debt) + ' LEFT');
  });

  var sellBtn = $('btnSell');
  function sellDown(e) { e.preventDefault(); AU.unlock(); if (G.phase === 'play') WC.setSelling(G, true); }
  function sellUp() { if (G) WC.setSelling(G, false); }
  sellBtn.addEventListener('pointerdown', sellDown);
  sellBtn.addEventListener('pointerup', sellUp);
  sellBtn.addEventListener('pointercancel', sellUp);
  sellBtn.addEventListener('pointerleave', sellUp);

  cvs.addEventListener('pointerdown', function (e) {
    AU.unlock();
    if (!running || G.phase !== 'play') return;
    if (shopIsOpen()) { closeShop(); return; }
    var px = e.clientX, py = e.clientY;
    parX = (px / view.w - 0.5) * 2;
    var wx = s2wx(px);
    if (mode === 'sonar') {
      if (WC.fireSonar(G, wx)) {
        AU.ping();
        mode = null; armButtons();
      }
      return;
    }
    if (mode === 'rig') {
      var r = WC.placeDerrick(G, wx);
      if (r.ok) {
        mode = null; armButtons();
        pipeRevIdx[r.d] = 0;
      } else {
        AU.deny();
        toast(r.reason, 'bad');
      }
      return;
    }
    // tap near a drilling bit to focus it
    var bestD = -1, bestDist = 46;
    for (var i = 0; i < G.derricks.length; i++) {
      var d = G.derricks[i];
      if (d.state !== 'drilling' || !d.bit) continue;
      var dx = w2sx(d.bit.x) - px, dy = w2sy(d.bit.y) - py;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) { bestDist = dist; bestD = i; }
      var tx = w2sx(d.x) - px, ty = view.surfY - 26 - py;
      dist = Math.sqrt(tx * tx + ty * ty);
      if (dist < bestDist) { bestDist = dist; bestD = i; }
    }
    if (bestD >= 0) G.focus = bestD;
    // steering drag
    steer.active = true;
    steer.startX = px;
    steer.id = e.pointerId;
    cvs.setPointerCapture(e.pointerId);
  });
  cvs.addEventListener('pointermove', function (e) {
    if (steer.active && e.pointerId === steer.id) {
      steer.val = clamp((e.clientX - steer.startX) / 55, -1, 1);
      if (G && G.phase === 'play') WC.setSteer(G, steer.val);
    }
  });
  function steerEnd(e) {
    if (steer.active && e.pointerId === steer.id) {
      steer.active = false; steer.val = 0;
      if (G) WC.setSteer(G, 0);
    }
  }
  cvs.addEventListener('pointerup', steerEnd);
  cvs.addEventListener('pointercancel', steerEnd);

  window.addEventListener('keydown', function (e) {
    if (!G) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keySteer.l = true; e.preventDefault(); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { keySteer.r = true; e.preventDefault(); }
    else if (e.code === 'Space') {
      e.preventDefault();
      if (titleOn) { start(); return; }
      AU.unlock();
      if (G.phase === 'play') WC.setSelling(G, true);
    }
    else if (e.code === 'KeyS') $('btnSonar').click();
    else if (e.code === 'KeyR') $('btnRig').click();
    else if (e.code === 'KeyB' || e.code === 'KeyU') $('btnShop').click();
    else if (e.code === 'KeyP') $('loanchip').click();
  });
  window.addEventListener('keyup', function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keySteer.l = false;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') keySteer.r = false;
    else if (e.code === 'Space' && G) WC.setSelling(G, false);
  });

  $('startBtn').addEventListener('click', function () { AU.unlock(); AU.tick(); start(); });
  $('retryBtn').addEventListener('click', function () {
    AU.tick();
    newGame(seed);
    $('results').classList.add('hidden');
    running = true;
  });
  $('newBtn').addEventListener('click', function () {
    AU.tick();
    newGame(1000 + Math.floor(Math.random() * 89000));
    $('results').classList.add('hidden');
    running = true;
  });

  /* ---------------- main loop ---------------- */
  function frame(ts) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.1, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    wobT += dt;
    var t = wobT;

    if (running && G.phase === 'play') {
      // keyboard steering
      if (!steer.active) {
        var ks = (keySteer.r ? 1 : 0) - (keySteer.l ? 1 : 0);
        WC.setSteer(G, ks);
      }
      WC.step(G, dt);
      processEvents();
      processReveals();
      // gas fades
      for (var gi = 0; gi < G.lease.gas.length; gi++) {
        if (!G.lease.gas[gi].alive) gasFade[gi] = Math.min(1, (gasFade[gi] || 0) + dt * 0.8);
      }
      // selling coin sfx
      if (G.selling && G.tank > 0.01) {
        coinTimer -= dt;
        if (coinTimer <= 0) { coinTimer = 0.13; AU.coin(coinK++); barrelFly(); }
      } else coinK = 0;
      // audio continuous layer
      var anyDrill = false, anyGrind = false, anyPump = false;
      for (var i = 0; i < G.derricks.length; i++) {
        var d = G.derricks[i];
        if (d.state === 'drilling') { anyDrill = true; if (d.grind) anyGrind = true; }
        if (d.state === 'pumping' && d.flow > 0.01) anyPump = true;
      }
      AU.update(dt, { drilling: anyDrill, grinding: anyGrind, pumping: anyPump, speedN: G.upg.bit ? 1 : 0.35, pumpRate: WC.pumpRate(G) });
    } else {
      AU.update(dt, { drilling: false, grinding: false, pumping: false });
    }
    if (resultsTimer > 0) {
      resultsTimer -= dt;
      if (resultsTimer <= 0) { resultsTimer = -1; showResults(); }
    }
    if (fireworks > 0) {
      fireworks -= dt;
      if (Math.random() < dt * 5) fireworkBurst();
    }

    stepPings(dt);
    stepGushers(dt, t);
    stepParticles(dt);
    shakeAmt = Math.max(0, shakeAmt - dt * 26);

    render(t);
    if (running || titleOn) {
      updateHUD(dt);
      updateChart(dt);
    }
  }

  function render(t) {
    ctx.clearRect(0, 0, view.w, view.h);
    ctx.save();
    if (shakeAmt > 0.2) {
      ctx.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
    }

    drawSky(t);

    // underground
    var wx0 = view.ox, wy0 = view.surfY, ww = view.worldW, wh = WCC.DEPTH * view.scale;
    ctx.save();
    ctx.beginPath(); ctx.rect(wx0, wy0, ww, wh); ctx.clip();
    ctx.drawImage(terr, wx0, wy0, ww, wh);
    drawGasPockets(t);
    drawOilPockets(t);
    ctx.drawImage(fog, wx0, wy0, ww, wh);
    ctx.restore();

    // side gutters (desktop letterbox)
    if (view.ox > 1) {
      ctx.fillStyle = '#07090f';
      ctx.fillRect(0, wy0, wx0, wh + 100);
      ctx.fillRect(wx0 + ww, wy0, view.w - wx0 - ww, wh + 100);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(wx0 - 0.5, wy0); ctx.lineTo(wx0 - 0.5, view.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx0 + ww + 0.5, wy0); ctx.lineTo(wx0 + ww + 0.5, view.h); ctx.stroke();
    }

    // depth ticks
    ctx.fillStyle = 'rgba(180,195,230,0.22)';
    ctx.font = '700 8px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    for (var dep = 500; dep < WCC.DEPTH; dep += 500) {
      var ty = w2sy(dep);
      ctx.fillRect(wx0 + 3, ty, 8, 1);
      ctx.fillText(dep + ' ft', wx0 + 14, ty + 3);
    }

    drawPipes(t);
    drawPings(t);
    drawGushers(t);
    drawDepot(t);
    drawDerricks(t);
    drawParticles();
    drawFloats();

    // steering indicator
    if (steer.active && Math.abs(steer.val) > 0.03) {
      var cy = view.h - 130;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#ffb03b';
      var dir = steer.val > 0 ? 1 : -1;
      var mag = Math.abs(steer.val);
      for (var ch = 0; ch < 3; ch++) {
        ctx.globalAlpha = (ch / 3 < mag ? 0.9 : 0.2);
        var cxp = view.w / 2 + dir * (26 + ch * 16);
        ctx.beginPath();
        ctx.moveTo(cxp - 4 * dir, cy - 7);
        ctx.lineTo(cxp + 4 * dir, cy);
        ctx.lineTo(cxp - 4 * dir, cy + 7);
        ctx.lineWidth = 3; ctx.strokeStyle = '#ffb03b'; ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  /* ---------------- boot ---------------- */
  newGame(seed);
  layout();
  requestAnimationFrame(frame);

  // debug/testing handle (read-only use)
  window.__wc = {
    game: function () { return G; },
    view: function () { return view; },
    sx: function (wx) { return w2sx(wx); },
    sy: function (wy) { return w2sy(wy); }
  };
})();
