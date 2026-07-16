/* Bring It Down — game shell: rendering, input, tools, timeline, grading. */
'use strict';
(function () {
  var DEF = Sim.DEF;
  var DT = DEF.dt;

  // ---------------------------------------------------------------- dom
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var el = {};
  ['hud', 'title', 'grade', 'toast', 'hint', 'budgetVal', 'chargeLeft', 'cableLeft',
    'tlTrack', 'tlTicks', 'tlChips', 'tlPlayhead', 'dropBtn', 'dropFill', 'dropLbl',
    'clearBtn', 'stressBtn', 'gradeTitle', 'stars', 'stFoot', 'stCollat', 'stBudget',
    'stBonus', 'stTotal', 'gradeNote', 'retryBtn', 'replayBtn', 'slowmoTag', 'bottomPanel', 'topbar']
    .forEach(function (id) { el[id] = document.getElementById(id); });

  // ---------------------------------------------------------------- state
  var phase = 'title';            // title | plan | drop | grade
  var planRef = { tools: [] };
  var run = Sim.createRun(planRef);
  var placed = [];                // {uid,type,memberId,lx,ly,t,cost,chip}
  var uidSeq = 1;
  var budget = DEF.budget;
  var selectedTool = null;
  var stressView = true;
  var W = 0, H = 0, dpr = 1;
  var cam = { x: 6, y: 9, scale: 10 };
  var shake = 0, shakeX = 0, shakeY = 0;
  var timeScale = 1, slowmoUsed = false, slowmoLeft = 0;
  var acc = 0;
  var endAt = -1, gradeShown = false, collatToastShown = false;
  var removeHintShown = false;
  var lastPlanTools = 0;
  var rng = Sim.mulberry32(7);
  var parts = [], rings = [], flashes = [];
  var cutFx = [];  // brief spark bursts
  var maxToolT = 0;
  var toastTimer = null;

  // ---------------------------------------------------------------- camera
  function resize() {
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function fitCamera() {
    var x0 = -10.2, x1 = 26.5, span = x1 - x0;
    // leave room for the bottom control panel and the top bar
    var groundY = Math.max(H * 0.52, H - 295);
    var headroom = groundY - 120; // px available above ground line
    cam.scale = Math.max(6, Math.min(W / span, headroom / 25));
    cam.x = (x0 + x1) / 2;
    cam.y = (groundY - H / 2) / cam.scale; // ground line lands at groundY
  }
  function clampCam() {
    cam.scale = Math.max(W / 90, Math.min(W / 5, cam.scale));
    cam.x = Math.max(-30, Math.min(45, cam.x));
    cam.y = Math.max(-6, Math.min(45, cam.y));
  }
  function s2w(sx, sy) {
    return { x: (sx - W / 2) / cam.scale + cam.x, y: (H / 2 - sy) / cam.scale + cam.y };
  }
  function w2s(wx, wy) {
    return { x: (wx - cam.x) * cam.scale + W / 2, y: H / 2 - (wy - cam.y) * cam.scale };
  }

  // ---------------------------------------------------------------- helpers
  function fmt$(n) { return '$' + n.toLocaleString('en-US'); }
  function toast(msg, bad) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    el.toast.style.borderColor = bad ? 'rgba(255,120,100,0.55)' : 'rgba(140,200,255,0.4)';
    el.toast.style.color = bad ? '#ffb3a8' : '#bcd8f0';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.add('hidden'); }, 1700);
  }
  function hint(msg) {
    if (!msg) { el.hint.classList.remove('show'); return; }
    el.hint.textContent = msg;
    el.hint.classList.add('show');
  }
  function spentTotal() {
    var s = 0; placed.forEach(function (p) { s += p.cost; }); return s;
  }
  function countType(t) {
    var n = 0; placed.forEach(function (p) { if (p.type === t) n++; }); return n;
  }

  // ---------------------------------------------------------------- timeline
  var TL_PAD = 34;
  function tToPx(t) {
    var w = el.tlTrack.clientWidth;
    return TL_PAD + (t / DEF.timeline) * (w - 2 * TL_PAD);
  }
  function pxToT(px) {
    var w = el.tlTrack.clientWidth;
    var t = (px - TL_PAD) / (w - 2 * TL_PAD) * DEF.timeline;
    return Math.max(0, Math.min(DEF.timeline, Math.round(t * 20) / 20));
  }
  function buildTicks() {
    el.tlTicks.innerHTML = '';
    for (var t = 0; t <= DEF.timeline + 0.001; t += 0.25) {
      var d = document.createElement('div');
      d.className = 'tick' + (Math.abs(t - Math.round(t)) < 0.01 ? ' major' : '');
      d.style.left = tToPx(t) + 'px';
      el.tlTicks.appendChild(d);
    }
  }
  var torchChip = null;
  function refreshTorchChip() {
    var n = countType('torch');
    if (n === 0) { if (torchChip) { torchChip.remove(); torchChip = null; } return; }
    if (!torchChip) {
      torchChip = document.createElement('div');
      torchChip.className = 'chip torch';
      el.tlChips.appendChild(torchChip);
    }
    torchChip.textContent = 'CUT×' + n + ' · 0s';
    torchChip.style.left = tToPx(0) + 'px';
  }
  function chipLabel(p) {
    var tag = p.type === 'cable' ? 'PULL' : 'C' + (p.num || '');
    return tag + ' · ' + parseFloat(p.t.toFixed(2)) + 's';
  }
  function makeChip(p) {
    var c = document.createElement('div');
    c.className = 'chip ' + p.type;
    c.textContent = chipLabel(p);
    c.style.left = tToPx(p.t) + 'px';
    el.tlChips.appendChild(c);
    p.chip = c;
    c.addEventListener('pointerdown', function (e) {
      if (phase !== 'plan') return;
      e.preventDefault(); e.stopPropagation();
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
      c.classList.add('drag');
      AudioFX.tick();
      var move = function (ev) {
        var r = el.tlTrack.getBoundingClientRect();
        p.t = pxToT(ev.clientX - r.left);
        c.style.left = tToPx(p.t) + 'px';
        c.textContent = chipLabel(p);
      };
      var up = function () {
        c.classList.remove('drag');
        c.removeEventListener('pointermove', move);
        c.removeEventListener('pointerup', up);
        c.removeEventListener('pointercancel', up);
        AudioFX.tick();
      };
      c.addEventListener('pointermove', move);
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
    });
  }
  function renumberCharges() {
    var n = 1;
    placed.forEach(function (p) {
      if (p.type === 'charge') { p.num = n++; if (p.chip) p.chip.textContent = chipLabel(p); }
    });
  }

  // ---------------------------------------------------------------- tools ui
  function refreshHud() {
    var left = budget - spentTotal();
    el.budgetVal.textContent = fmt$(left);
    el.budgetVal.classList.toggle('over', left < 150);
    el.chargeLeft.innerHTML = '&times;' + (DEF.maxCharges - countType('charge'));
    el.cableLeft.innerHTML = '&times;' + (DEF.maxCables - countType('cable'));
    document.querySelectorAll('.tool').forEach(function (b) {
      var t = b.dataset.tool;
      var price = DEF.prices[t];
      var dead = price > left ||
        (t === 'charge' && countType('charge') >= DEF.maxCharges) ||
        (t === 'cable' && countType('cable') >= DEF.maxCables);
      b.classList.toggle('dead', dead);
      b.classList.toggle('sel', selectedTool === t);
    });
  }
  var TOOL_HINTS = {
    torch: 'Tap a column or slab to cut it — fires at t=0',
    charge: 'Tap the structure to strap a charge — drag its chip to set time',
    cable: 'Tap an anchor point — the ground winch pulls it LEFT'
  };
  function selectTool(t) {
    if (phase !== 'plan') return;
    selectedTool = (selectedTool === t) ? null : t;
    AudioFX.select();
    hint(selectedTool ? TOOL_HINTS[selectedTool] : '');
    refreshHud();
  }
  document.querySelectorAll('.tool').forEach(function (b) {
    b.addEventListener('click', function () { selectTool(b.dataset.tool); });
  });
  el.stressBtn.addEventListener('click', function () {
    stressView = !stressView;
    el.stressBtn.classList.toggle('on', stressView);
    AudioFX.tick();
  });
  el.clearBtn.addEventListener('click', function () {
    if (phase !== 'plan' || !placed.length) return;
    placed.forEach(function (p) { if (p.chip) p.chip.remove(); });
    placed = [];
    refreshTorchChip(); refreshHud();
    AudioFX.refund();
    toast('Plan cleared — full refund');
  });

  // ---------------------------------------------------------------- member hit tests
  function memberLocal(m, wx, wy) {
    var b = m.body, p = b.getPosition(), a = b.getAngle();
    var dx = wx - p.x, dy = wy - p.y;
    var c = Math.cos(-a), s = Math.sin(-a);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }
  function memberAt(wx, wy, tol) {
    tol = tol || 0.25;
    for (var i = 0; i < run.members.length; i++) {
      var m = run.members[i];
      var l = memberLocal(m, wx, wy);
      if (Math.abs(l.x) <= m.hw + tol && Math.abs(l.y) <= m.hh + tol) return m;
    }
    return null;
  }
  function nearestMember(wx, wy, maxD) {
    var best = null, bestD = maxD;
    for (var i = 0; i < run.members.length; i++) {
      var m = run.members[i];
      var l = memberLocal(m, wx, wy);
      var cx = Math.max(-m.hw, Math.min(m.hw, l.x));
      var cy = Math.max(-m.hh, Math.min(m.hh, l.y));
      var d = Math.hypot(l.x - cx, l.y - cy);
      if (d < bestD) { bestD = d; best = { m: m, lx: cx, ly: cy }; }
    }
    return best;
  }
  function markerWorld(p) {
    var m = run.byId[p.memberId];
    if (!m) return null;
    return m.body.getWorldPoint(planck.Vec2(p.lx, p.ly));
  }

  // ---------------------------------------------------------------- placement
  function tryRemoveAt(wx, wy) {
    var rPx = 26 / cam.scale;
    for (var i = placed.length - 1; i >= 0; i--) {
      var p = placed[i], wp = markerWorld(p);
      if (wp && Math.hypot(wp.x - wx, wp.y - wy) < rPx) {
        placed.splice(i, 1);
        if (p.chip) p.chip.remove();
        refreshTorchChip(); renumberCharges(); refreshHud();
        AudioFX.refund();
        toast(p.type.toUpperCase() + ' removed — ' + fmt$(p.cost) + ' refunded');
        return true;
      }
    }
    return false;
  }
  function place(wx, wy) {
    var tool = selectedTool;
    var price = DEF.prices[tool];
    if (price > budget - spentTotal()) { AudioFX.deny(); toast('OVER BUDGET', true); return; }
    if (tool === 'charge' && countType('charge') >= DEF.maxCharges) { AudioFX.deny(); toast('NO CHARGES LEFT', true); return; }
    if (tool === 'cable' && countType('cable') >= DEF.maxCables) { AudioFX.deny(); toast('ONLY ONE WINCH ON SITE', true); return; }

    if (tool === 'torch') {
      var m = memberAt(wx, wy, 0.3);
      if (!m || m.kind === 'prop') { AudioFX.deny(); toast('TAP A COLUMN OR SLAB', true); return; }
      if (isCutPlanned(m)) { AudioFX.deny(); toast('ALREADY CUT', true); return; }
      placed.push({ uid: uidSeq++, type: 'torch', memberId: m.id, lx: 0, ly: 0, t: 0, cost: price });
      AudioFX.torch();
      refreshTorchChip();
    } else {
      var hit = nearestMember(wx, wy, 1.6);
      if (!hit || hit.m.kind === 'prop') { AudioFX.deny(); toast('PLACE IT ON THE STRUCTURE', true); return; }
      // snap to the member for a tidy, predictable rig: columns anchor at their
      // center, slabs anchor on their centerline at the tapped span position
      if (hit.m.kind === 'col') { hit.lx = 0; hit.ly = 0; }
      else { hit.ly = 0; hit.lx = Math.round(hit.lx * 2) / 2; }
      var p = {
        uid: uidSeq++, type: tool, memberId: hit.m.id, lx: hit.lx, ly: hit.ly,
        t: tool === 'charge' ? Math.min(DEF.timeline, countType('charge') * 0.5) : 0,
        cost: price
      };
      placed.push(p);
      makeChip(p);
      renumberCharges();
      if (tool === 'cable') AudioFX.cable(); else AudioFX.place();
    }
    refreshHud();
    if (!removeHintShown && placed.length >= 2) {
      removeHintShown = true;
      toast('Tap a placed tool to remove it');
    }
  }

  // helper: is member already torch-planned
  function isCutPlanned(m) {
    return placed.some(function (p) { return p.type === 'torch' && p.memberId === m.id; });
  }

  // ---------------------------------------------------------------- input (pan/zoom/tap)
  var pointers = new Map();
  var pinch = null;
  canvas.addEventListener('pointerdown', function (e) {
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, t: performance.now() });
    if (pointers.size === 2) {
      var pts = Array.from(pointers.values());
      pinch = {
        d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        scale: cam.scale,
        mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        camX: cam.x, camY: cam.y
      };
      pinch.midW = s2w(pinch.mid.x, pinch.mid.y);
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    var p = pointers.get(e.pointerId);
    if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 7) p.moved = true;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1 && p.moved) {
      cam.x -= dx / cam.scale;
      cam.y += dy / cam.scale;
      clampCam();
    } else if (pointers.size === 2 && pinch) {
      var pts = Array.from(pointers.values());
      var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      cam.scale = pinch.scale * (d / pinch.d);
      clampCam();
      var mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      // keep the world point under the pinch midpoint
      cam.x = pinch.midW.x - (mid.x - W / 2) / cam.scale;
      cam.y = pinch.midW.y - (H / 2 - mid.y) / cam.scale;
      clampCam();
    }
  });
  function pointerEnd(e) {
    var p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!p) return;
    if (!p.moved && performance.now() - p.t < 500 && pointers.size === 0) {
      var w = s2w(p.x, p.y);
      if (phase === 'plan') {
        if (tryRemoveAt(w.x, w.y)) return;
        if (selectedTool) place(w.x, w.y);
      }
    }
  }
  canvas.addEventListener('pointerup', pointerEnd);
  canvas.addEventListener('pointercancel', pointerEnd);
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var w = s2w(e.clientX, e.clientY);
    cam.scale *= Math.pow(1.0016, -e.deltaY);
    clampCam();
    cam.x = w.x - (e.clientX - W / 2) / cam.scale;
    cam.y = w.y - (H / 2 - e.clientY) / cam.scale;
    clampCam();
  }, { passive: false });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });

  // ---------------------------------------------------------------- phases
  function enterPlan() {
    phase = 'plan';
    el.title.classList.add('hidden');
    el.grade.classList.add('hidden');
    el.hud.classList.remove('hidden');
    el.bottomPanel.style.display = '';
    el.tlPlayhead.style.display = 'none';
    el.slowmoTag.classList.add('hidden');
    document.querySelectorAll('#toolbar, #dropRow').forEach(function (n) { n.style.display = ''; });
    buildTicks();
    refreshTorchChip();
    placed.forEach(function (p) { if (p.chip) p.chip.style.left = tToPx(p.t) + 'px'; });
    refreshHud();
    hint('Pinch / drag to survey · red members carry the load');
    setTimeout(function () { if (phase === 'plan' && !selectedTool) hint(''); }, 3800);
  }

  function newRun() {
    run = Sim.createRun(planRef);
    timeScale = 1; slowmoUsed = false; slowmoLeft = 0;
    acc = 0; endAt = -1; gradeShown = false; collatToastShown = false;
    parts = []; rings = []; flashes = []; cutFx = [];
    shake = 0;
    rng = Sim.mulberry32(7);
  }

  function startDrop() {
    planRef.tools = placed.map(function (p) {
      return { type: p.type, memberId: p.memberId, lx: p.lx, ly: p.ly, t: p.t };
    });
    maxToolT = 0;
    placed.forEach(function (p) { if (p.t > maxToolT) maxToolT = p.t; });
    phase = 'drop';
    selectedTool = null;
    hint('');
    document.querySelectorAll('#toolbar, #dropRow').forEach(function (n) { n.style.display = 'none'; });
    el.tlPlayhead.style.display = 'block';
    placed.forEach(function (p) { if (p.chip) p.chip.classList.remove('fired'); p.fired = false; });
    run.start();
    AudioFX.tick();
  }

  // hold-to-drop
  var holdRAF = null, holdStart = 0;
  function holdFrame() {
    var k = Math.min(1, (performance.now() - holdStart) / 620);
    el.dropFill.style.width = (k * 100).toFixed(1) + '%';
    if (k >= 1) {
      el.dropFill.style.width = '0%';
      el.dropLbl.textContent = 'HOLD TO DROP';
      startDrop();
      return;
    }
    holdRAF = requestAnimationFrame(holdFrame);
  }
  el.dropBtn.addEventListener('pointerdown', function (e) {
    if (phase !== 'plan') return;
    e.preventDefault();
    try { el.dropBtn.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
    holdStart = performance.now();
    el.dropLbl.textContent = 'ARMING…';
    AudioFX.drumroll();
    cancelAnimationFrame(holdRAF);
    holdRAF = requestAnimationFrame(holdFrame);
  });
  function holdCancel() {
    if (phase !== 'plan') return;
    cancelAnimationFrame(holdRAF);
    el.dropFill.style.width = '0%';
    el.dropLbl.textContent = 'HOLD TO DROP';
  }
  el.dropBtn.addEventListener('pointerup', holdCancel);
  el.dropBtn.addEventListener('pointercancel', holdCancel);
  el.dropBtn.addEventListener('pointerleave', holdCancel);

  // title
  el.title.addEventListener('pointerup', function () {
    AudioFX.init();
    AudioFX.select();
    if (phase === 'title') enterPlan();
  });

  // grade buttons
  el.retryBtn.addEventListener('click', function () {
    AudioFX.select();
    newRun();
    enterPlan();
  });
  el.replayBtn.addEventListener('click', function () {
    AudioFX.select();
    newRun();
    el.grade.classList.add('hidden');
    startDrop();
  });

  // ---------------------------------------------------------------- grading
  function showGrade() {
    phase = 'grade';
    AudioFX.rumble(0);
    var s = run.score();
    var spent = spentTotal();
    var unspent = budget - spent;
    var collat = s.collateral;
    var maxY = 0;
    run.members.forEach(function (m) { var y = m.body.getPosition().y; if (y > maxY) maxY = y; });
    var standing = maxY > DEF.tallFloors * DEF.storyH * 0.5;
    var bonus = (collat || standing) ? 0 : Math.min(10, Math.round(unspent / 150));
    var total = Math.round(s.pct) + bonus;
    var stars = collat ? 1 : standing ? 1 : total >= 78 ? 3 : total >= 56 ? 2 : 1;

    var title, note, cls = '';
    if (collat) {
      title = 'YOU HIT SAL’S!';
      note = 'The diner is protected — grade capped at one star.';
      cls = 'bad';
    } else if (standing) {
      title = 'STILL STANDING';
      note = 'Too much of the structure survived. Cut deeper.';
      cls = 'bad';
    } else if (stars === 3) {
      title = 'PERFECT DROP';
      note = 'Textbook implosion. The inspector tips his hat.';
      cls = 'good';
    } else if (stars === 2) {
      title = 'CLEAN CONTRACT';
      note = 'Solid work — tighten the timeline for three stars.';
    } else {
      title = 'MESSY SITE';
      note = 'Too much debris outside the chalk. Re-plan the sequence.';
    }
    el.gradeTitle.textContent = title;
    el.gradeTitle.className = cls;
    el.stFoot.textContent = Math.round(s.pct) + '%';
    el.stCollat.textContent = collat ? 'DINER HIT' : 'NONE';
    el.stCollat.className = collat ? 'bad' : 'good';
    el.stBudget.textContent = fmt$(spent) + ' / ' + fmt$(budget);
    el.stBonus.textContent = '+' + bonus;
    el.stTotal.textContent = String(total);
    el.gradeNote.textContent = note;

    var starEls = el.stars.querySelectorAll('.star');
    starEls.forEach(function (se) { se.classList.remove('lit'); });
    el.grade.classList.remove('hidden');
    AudioFX.fanfare(stars >= 2);
    for (var i = 0; i < stars; i++) {
      (function (i) {
        setTimeout(function () {
          if (phase !== 'grade') return;
          starEls[i].classList.add('lit');
          AudioFX.star(i);
        }, 550 + i * 420);
      })(i);
    }
  }

  // ---------------------------------------------------------------- fx
  function spawnDust(x, y, n, power, col) {
    for (var i = 0; i < n; i++) {
      if (parts.length > 460) parts.shift();
      var a = rng() * Math.PI, sp = (0.4 + rng() * 1.1) * power;
      parts.push({
        x: x + (rng() - 0.5) * 0.8, y: y + rng() * 0.3,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 + 0.5,
        r: 0.25 + rng() * 0.5, growth: 0.5 + rng() * 0.8,
        age: 0, life: 0.9 + rng() * 1.3, col: col || 'dust'
      });
    }
  }
  function spawnSparks(x, y, n) {
    for (var i = 0; i < n; i++) {
      if (parts.length > 460) parts.shift();
      var a = rng() * Math.PI * 2, sp = 3 + rng() * 9;
      parts.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 0.06 + rng() * 0.08, growth: 0, grav: -22,
        age: 0, life: 0.25 + rng() * 0.4, col: 'spark'
      });
    }
  }
  function handleEvents(evs) {
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      if (e.type === 'boom') {
        flashes.push({ x: e.x, y: e.y, r: 3.2, age: 0, life: 0.14 });
        rings.push({ x: e.x, y: e.y, r: 0.5, v: 26, age: 0, life: 0.5 });
        spawnSparks(e.x, e.y, 26);
        spawnDust(e.x, e.y, 22, 3.4, 'smoke');
        shake = Math.min(20, shake + 15);
        AudioFX.boom();
      } else if (e.type === 'cut') {
        spawnSparks(e.x, e.y, 10);
        AudioFX.torch();
      } else if (e.type === 'cablego') {
        AudioFX.winchRun();
        spawnDust(DEF.winchX, 0.3, 6, 1.2);
      } else if (e.type === 'break') {
        spawnDust(e.x, e.y, 2, 1.1);
        AudioFX.snap();
      } else if (e.type === 'impact') {
        var k = Math.min(1, e.imp / 26000);
        if (e.imp > 2600 && e.y < 2.5) {
          spawnDust(e.x, Math.max(0.15, e.y), Math.round(3 + k * 10), 1 + k * 2.6);
          AudioFX.thud(k);
          if (k > 0.55) shake = Math.min(14, shake + k * 5);
        }
      }
    }
  }

  // ---------------------------------------------------------------- update
  var last = performance.now();
  function update(rdt) {
    if (phase === 'drop') {
      // slow-mo on first structural failure
      if (!slowmoUsed && run.firstFailAt >= 0 && run.t > 0.05) {
        slowmoUsed = true;
        slowmoLeft = 0.8;
        timeScale = 0.25;
        el.slowmoTag.classList.remove('hidden');
      }
      if (slowmoLeft > 0) {
        slowmoLeft -= rdt;
        if (slowmoLeft <= 0) { timeScale = 1; el.slowmoTag.classList.add('hidden'); }
      }
      acc += rdt * timeScale;
      var guard = 0;
      while (acc >= DT && guard++ < 10) {
        handleEvents(run.step());
        acc -= DT;
      }
      if (guard >= 10) acc = 0;
      // playhead + chip firing
      var tl = Math.min(run.t, DEF.timeline);
      el.tlPlayhead.style.left = tToPx(tl) + 'px';
      placed.forEach(function (p) {
        if (!p.fired && p.type !== 'torch' && run.t >= p.t) {
          p.fired = true;
          if (p.chip) p.chip.classList.add('fired');
        }
      });
      // diner hit feedback
      if (!collatToastShown && run.collateral()) {
        collatToastShown = true;
        toast('SAL’S DINER HIT — GRADE CAPPED', true);
        AudioFX.deny();
        shake = Math.min(20, shake + 8);
      }
      // rumble follows the chaos
      var ag = run.agitation();
      AudioFX.rumble(Math.min(0.42, ag / 90000));
      // end detection
      var settleGate = Math.max(2.6, maxToolT + 2.2);
      if (endAt < 0 && ((run.t > settleGate && ag < 2200) || run.t > 9.5)) endAt = run.t;
      if (endAt > 0 && run.t > endAt + 0.7 && !gradeShown) {
        gradeShown = true;
        showGrade();
      }
    }
    AudioFX.updateRumble(rdt);
    // shake decay
    if (shake > 0.01) {
      shake *= Math.pow(0.001, rdt);
      shakeX = (Math.random() - 0.5) * shake;
      shakeY = (Math.random() - 0.5) * shake;
    } else { shakeX = shakeY = 0; }
    // particles
    var pdt = rdt * (phase === 'drop' ? timeScale : 1);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.age += pdt;
      if (p.age > p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * pdt; p.y += p.vy * pdt;
      p.vx *= (1 - 1.6 * pdt); p.vy *= (1 - 1.6 * pdt);
      if (p.grav) p.vy += p.grav * pdt; else p.vy += 0.5 * pdt;
      if (p.growth) p.r += p.growth * pdt;
      if (p.y < 0.05 && !p.grav) { p.y = 0.05; p.vy = Math.abs(p.vy) * 0.2; }
    }
    for (i = rings.length - 1; i >= 0; i--) {
      rings[i].age += pdt; rings[i].r += rings[i].v * pdt;
      if (rings[i].age > rings[i].life) rings.splice(i, 1);
    }
    for (i = flashes.length - 1; i >= 0; i--) {
      flashes[i].age += pdt;
      if (flashes[i].age > flashes[i].life) flashes.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- render
  function stressColor(r) {
    // green -> yellow -> orange -> red
    var h = 118 * (1 - Math.min(1, r));
    return 'hsl(' + h.toFixed(0) + ',64%,' + (46 - r * 6).toFixed(0) + '%)';
  }
  var MAT = { col: '#b9c2ca', slab: '#9aa4ad', prop: '#8b9aa7' };

  function render() {
    // sky
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7fa8cf');
    g.addColorStop(0.55, '#a8c3d9');
    g.addColorStop(0.8, '#dfd3b2');
    g.addColorStop(1, '#e7c795');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // sun glow
    var sun = w2s(-6 + cam.x * 0.1, 26);
    var sg = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 160);
    sg.addColorStop(0, 'rgba(255,244,214,0.85)');
    sg.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2 - cam.x * cam.scale + shakeX, H / 2 + cam.y * cam.scale + shakeY);
    ctx.scale(cam.scale, -cam.scale);
    var px = 1 / cam.scale; // one screen pixel in world units

    drawBackdrop(px);
    drawGround(px);
    drawDiner(px);
    drawWinch(px);
    drawMembers(px);
    drawMarkers(px);
    drawFx(px);
    ctx.restore();

    drawWorldTexts();

    // slow-mo vignette
    if (timeScale < 1 && phase === 'drop') {
      var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      vg.addColorStop(0, 'rgba(20,30,45,0)');
      vg.addColorStop(1, 'rgba(20,30,45,0.4)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawBackdrop(px) {
    // distant skyline (parallax via slight offset against cam.x)
    var off = cam.x * 0.35;
    ctx.fillStyle = 'rgba(112,132,152,0.42)';
    var sk = [[-38, 7], [-30, 12], [-24, 5], [-16, 9], [30, 10], [38, 6], [46, 13], [56, 8]];
    for (var i = 0; i < sk.length; i++) {
      var bx = sk[i][0] + off, bh = sk[i][1];
      ctx.fillRect(bx, 0, 6.5, bh);
    }
    ctx.fillStyle = 'rgba(126,146,164,0.3)';
    var sk2 = [[-46, 15], [-10, 6], [26, 15], [50, 17], [-20, 4]];
    for (i = 0; i < sk2.length; i++) {
      ctx.fillRect(sk2[i][0] + cam.x * 0.5, 0, 8, sk2[i][1]);
    }
    // clouds
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    var cl = [[-20, 24, 4], [12, 28, 5.5], [34, 22, 3.5]];
    for (i = 0; i < cl.length; i++) {
      var cx = cl[i][0] + cam.x * 0.15, cy = cl[i][1], r = cl[i][2];
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.32, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + r * 0.7, cy + 0.5, r * 0.6, r * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGround(px) {
    // pavement
    ctx.fillStyle = '#5c6672';
    ctx.fillRect(-80, -20, 200, 20);
    ctx.fillStyle = '#6d7884';
    ctx.fillRect(-80, -0.35, 200, 0.35);
    // curb highlight
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(-80, -0.08, 200, 0.08);

    // chalk target zone
    var z = DEF.zone;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 3.4 * px;
    ctx.setLineDash([0.55, 0.4]);
    ctx.beginPath();
    ctx.moveTo(z.x0, 0.04); ctx.lineTo(z.x1, 0.04);
    ctx.stroke();
    ctx.setLineDash([]);
    // hatch ticks inward
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2 * px;
    ctx.beginPath();
    for (var x = z.x0; x <= z.x1; x += 1.3) {
      ctx.moveTo(x, 0.04); ctx.lineTo(x + 0.34, -0.5);
    }
    ctx.stroke();
    // end posts
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 3.4 * px;
    ctx.beginPath();
    ctx.moveTo(z.x0, 0); ctx.lineTo(z.x0, 1.15);
    ctx.moveTo(z.x1, 0); ctx.lineTo(z.x1, 1.15);
    ctx.stroke();
    // little flags
    ctx.fillStyle = '#ff8c42';
    ctx.beginPath();
    ctx.moveTo(z.x0, 1.15); ctx.lineTo(z.x0 + 0.72, 0.95); ctx.lineTo(z.x0, 0.75); ctx.closePath();
    ctx.moveTo(z.x1, 1.15); ctx.lineTo(z.x1 - 0.72, 0.95); ctx.lineTo(z.x1, 0.75); ctx.closePath();
    ctx.fill();
  }

  function drawDiner(px) {
    var d = DEF.diner;
    var wdt = d.x1 - d.x0;
    // body
    ctx.fillStyle = '#efe6d2';
    ctx.fillRect(d.x0, 0, wdt, d.h);
    ctx.strokeStyle = '#25313d';
    ctx.lineWidth = 2 * px;
    ctx.strokeRect(d.x0, 0, wdt, d.h);
    // roof band
    ctx.fillStyle = '#c8574b';
    ctx.fillRect(d.x0 - 0.18, d.h - 0.42, wdt + 0.36, 0.42);
    // window band
    ctx.fillStyle = 'rgba(90,140,175,0.75)';
    ctx.fillRect(d.x0 + 0.5, 1.15, wdt - 2.4, 1.35);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.4 * px;
    for (var wx = d.x0 + 0.5; wx < d.x0 + wdt - 2.4; wx += 1.1) {
      ctx.beginPath(); ctx.moveTo(wx, 1.15); ctx.lineTo(wx, 2.5); ctx.stroke();
    }
    // door
    ctx.fillStyle = '#7c5a44';
    ctx.fillRect(d.x1 - 1.7, 0, 0.95, 2.1);
    // awning (striped)
    var ax0 = d.x0 + 0.3, ax1 = d.x1 - 2.0;
    for (var i = 0, sx = ax0; sx < ax1; i++, sx += 0.62) {
      ctx.fillStyle = i % 2 ? '#f3f0e8' : '#d5544a';
      ctx.beginPath();
      ctx.moveTo(sx, 2.62);
      ctx.lineTo(Math.min(sx + 0.62, ax1), 2.62);
      ctx.lineTo(Math.min(sx + 0.62, ax1) - 0.18, 2.14);
      ctx.lineTo(sx - 0.18, 2.14);
      ctx.closePath();
      ctx.fill();
    }
    // rooftop sign
    ctx.fillStyle = '#33414f';
    ctx.fillRect(d.x0 + wdt / 2 - 0.09, d.h, 0.18, 0.95);
    ctx.fillStyle = '#f3f0e8';
    ctx.fillRect(d.x0 + wdt / 2 - 1.85, d.h + 0.85, 3.7, 1.05);
    ctx.strokeStyle = '#c8574b';
    ctx.lineWidth = 3 * px;
    ctx.strokeRect(d.x0 + wdt / 2 - 1.85, d.h + 0.85, 3.7, 1.05);
    // protected marker: green dashed halo
    var hit = run.collateral();
    ctx.strokeStyle = hit ? 'rgba(255,80,60,0.95)' : 'rgba(80,200,120,0.8)';
    ctx.lineWidth = (hit ? 3.4 : 2.4) * px;
    ctx.setLineDash([0.5, 0.32]);
    ctx.strokeRect(d.x0 - 0.55, -0.02, wdt + 1.1, d.h + 2.4);
    ctx.setLineDash([]);
  }

  function drawWinch(px) {
    var hasCable = placed.some(function (p) { return p.type === 'cable'; });
    if (!hasCable) return;
    var wx = DEF.winchX;
    ctx.fillStyle = '#3b4653';
    ctx.fillRect(wx - 1.05, 0, 2.1, 0.62);
    ctx.fillStyle = '#586675';
    ctx.beginPath(); ctx.arc(wx, 0.85, 0.52, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a333d';
    ctx.beginPath(); ctx.arc(wx, 0.85, 0.2, 0, Math.PI * 2); ctx.fill();
    // hazard stripes on base
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(wx - 1.05, 0.5, 2.1, 0.12);
  }

  function drawMembers(px) {
    var i, m;
    // window bands behind everything (attached to slabs)
    for (i = 0; i < run.members.length; i++) {
      m = run.members[i];
      if (m.kind !== 'slab') continue;
      var b = m.body, p = b.getPosition(), a = b.getAngle();
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      var bw = m.hw * 2 * 0.94, bh = 1.9;
      ctx.fillStyle = 'rgba(58,84,110,0.6)';
      ctx.fillRect(-bw / 2, -m.hh - bh, bw, bh);
      ctx.strokeStyle = 'rgba(212,228,240,0.35)';
      ctx.lineWidth = 1.2 * px;
      ctx.beginPath();
      for (var wx = -bw / 2 + 0.55; wx < bw / 2; wx += 0.92) {
        ctx.moveTo(wx, -m.hh - bh); ctx.lineTo(wx, -m.hh);
      }
      ctx.moveTo(-bw / 2, -m.hh - bh * 0.55);
      ctx.lineTo(bw / 2, -m.hh - bh * 0.55);
      ctx.stroke();
      ctx.restore();
    }
    // members
    var showStress = stressView && phase === 'plan';
    for (i = 0; i < run.members.length; i++) {
      m = run.members[i];
      var body = m.body, pos = body.getPosition(), ang = body.getAngle();
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(ang);
      var fill = showStress && m.kind !== 'prop' ? stressColor(m.stress) : MAT[m.kind];
      ctx.fillStyle = fill;
      ctx.fillRect(-m.hw, -m.hh, m.hw * 2, m.hh * 2);
      // simple shading edge
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-m.hw, m.hh - 0.09, m.hw * 2, 0.09);
      ctx.fillStyle = 'rgba(15,25,35,0.16)';
      ctx.fillRect(m.hw - 0.1, -m.hh, 0.1, m.hh * 2);
      ctx.strokeStyle = '#232f3a';
      ctx.lineWidth = 1.6 * px;
      ctx.strokeRect(-m.hw, -m.hh, m.hw * 2, m.hh * 2);
      if (m.prop === 'tank') {
        ctx.strokeStyle = '#54626f';
        ctx.lineWidth = 3 * px;
        ctx.beginPath();
        ctx.moveTo(-m.hw, -0.2); ctx.lineTo(m.hw, -0.2);
        ctx.moveTo(-m.hw, 0.35); ctx.lineTo(m.hw, 0.35);
        ctx.stroke();
      }
      if (m.cut) {
        // glowing severed marks
        ctx.strokeStyle = 'rgba(255,140,50,0.95)';
        ctx.lineWidth = 3 * px;
        ctx.beginPath();
        ctx.moveTo(-m.hw * 0.8, -m.hh * 0.25); ctx.lineTo(m.hw * 0.8, m.hh * 0.25);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawMarkers(px) {
    var planPhase = phase === 'plan';
    // cable line first
    placed.forEach(function (p) {
      if (p.type !== 'cable') return;
      if (phase === 'drop' && p.fired && run.activeCables().length === 0) return;
      var wp = markerWorld(p);
      if (!wp) return;
      ctx.strokeStyle = planPhase ? 'rgba(45,110,168,0.9)' : '#274a66';
      ctx.lineWidth = (planPhase ? 2.6 : 3.4) * px;
      if (planPhase || !p.fired) ctx.setLineDash([0.5, 0.35]);
      ctx.beginPath();
      ctx.moveTo(DEF.winchX, 0.85);
      ctx.lineTo(wp.x, wp.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // anchor hook
      ctx.fillStyle = '#2d6ea8';
      ctx.beginPath(); ctx.arc(wp.x, wp.y, 7 * px, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 * px;
      ctx.stroke();
    });
    // torch marks on planned (not yet fired) cuts
    if (planPhase) {
      placed.forEach(function (p) {
        if (p.type !== 'torch') return;
        var m = run.byId[p.memberId];
        if (!m) return;
        var pos = m.body.getPosition(), ang = m.body.getAngle();
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(ang);
        ctx.strokeStyle = '#ff8c42';
        ctx.lineWidth = 3 * px;
        ctx.setLineDash([0.18, 0.12]);
        ctx.beginPath();
        ctx.moveTo(-m.hw - 0.12, m.hh * 0.18); ctx.lineTo(m.hw + 0.12, -m.hh * 0.18);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ff8c42';
        ctx.beginPath(); ctx.arc(0, 0, 5 * px, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      // charges
      placed.forEach(function (p) {
        if (p.type !== 'charge') return;
        var wp = markerWorld(p);
        if (!wp) return;
        // blast radius ghost
        ctx.fillStyle = 'rgba(224,74,56,0.09)';
        ctx.beginPath(); ctx.arc(wp.x, wp.y, Sim.CHARGE.breakR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(224,74,56,0.5)';
        ctx.lineWidth = 1.6 * px;
        ctx.setLineDash([0.3, 0.25]);
        ctx.beginPath(); ctx.arc(wp.x, wp.y, Sim.CHARGE.breakR, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        // charge pack
        ctx.fillStyle = '#c23c2d';
        ctx.fillRect(wp.x - 0.28, wp.y - 0.22, 0.56, 0.44);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.6 * px;
        ctx.strokeRect(wp.x - 0.28, wp.y - 0.22, 0.56, 0.44);
        ctx.fillStyle = '#ffd76a';
        ctx.beginPath(); ctx.arc(wp.x, wp.y + 0.32, 0.09, 0, Math.PI * 2); ctx.fill();
      });
    } else {
      // during drop show unfired charges
      placed.forEach(function (p) {
        if (p.type !== 'charge' || p.fired) return;
        var wp = markerWorld(p);
        if (!wp) return;
        ctx.fillStyle = '#c23c2d';
        ctx.fillRect(wp.x - 0.28, wp.y - 0.22, 0.56, 0.44);
        var blink = Math.sin(performance.now() / 90) > 0;
        ctx.fillStyle = blink ? '#ffd76a' : '#7e2317';
        ctx.beginPath(); ctx.arc(wp.x, wp.y + 0.32, 0.1, 0, Math.PI * 2); ctx.fill();
      });
    }
  }

  function drawFx(px) {
    var i;
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      var k = p.age / p.life;
      if (p.col === 'spark') {
        ctx.fillStyle = 'rgba(255,' + Math.round(190 - 120 * k) + ',60,' + (1 - k).toFixed(2) + ')';
      } else if (p.col === 'smoke') {
        ctx.fillStyle = 'rgba(90,88,84,' + (0.5 * (1 - k)).toFixed(2) + ')';
      } else {
        ctx.fillStyle = 'rgba(168,158,142,' + (0.55 * (1 - k)).toFixed(2) + ')';
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (i = 0; i < rings.length; i++) {
      var r = rings[i], kk = r.age / r.life;
      ctx.strokeStyle = 'rgba(255,236,200,' + (0.75 * (1 - kk)).toFixed(2) + ')';
      ctx.lineWidth = (5 - 4 * kk) * px * 2;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (i = 0; i < flashes.length; i++) {
      var f = flashes[i], fk = f.age / f.life;
      var fg = ctx.createRadialGradient(f.x, f.y, 0.1, f.x, f.y, f.r);
      fg.addColorStop(0, 'rgba(255,252,235,' + (0.95 * (1 - fk)).toFixed(2) + ')');
      fg.addColorStop(1, 'rgba(255,200,90,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    }
    // live cable during pull
    if (phase === 'drop') {
      var cbs = run.activeCables();
      for (i = 0; i < cbs.length; i++) {
        ctx.strokeStyle = '#38566e';
        ctx.lineWidth = 3.2 * px;
        ctx.beginPath();
        ctx.moveTo(DEF.winchX, 0.85);
        ctx.lineTo(cbs[i].x, cbs[i].y);
        ctx.stroke();
      }
    }
  }

  function drawWorldTexts() {
    // screen-space labels anchored to world points
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var z = DEF.zone;
    var zc = w2s((z.x0 + z.x1) / 2, -1.15);
    ctx.font = '700 ' + Math.max(10, cam.scale * 0.85) + 'px -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('T A R G E T   F O O T P R I N T', zc.x, zc.y);

    var d = DEF.diner;
    var sc = w2s((d.x0 + d.x1) / 2, d.h + 1.38);
    ctx.font = '900 ' + Math.max(9, cam.scale * 0.66) + 'px -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = '#c8574b';
    ctx.fillText("SAL'S", sc.x, sc.y);
    var pc = w2s((d.x0 + d.x1) / 2, -1.15);
    ctx.font = '700 ' + Math.max(8, cam.scale * 0.5) + 'px -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = run.collateral() ? 'rgba(255,90,70,0.95)' : 'rgba(80,200,120,0.9)';
    ctx.fillText(run.collateral() ? '✗ PROTECTED — HIT' : '✓ PROTECTED', pc.x, pc.y);

    if (placed.some(function (p) { return p.type === 'cable'; })) {
      var wc = w2s(DEF.winchX, -1.15);
      ctx.fillStyle = 'rgba(230,240,250,0.8)';
      ctx.fillText('WINCH', wc.x, wc.y);
    }
  }

  // ---------------------------------------------------------------- main loop
  function frame(now) {
    var rdt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(rdt);
    render();
    requestAnimationFrame(frame);
  }

  // tiny debug surface (used by automated smoke tests; no console output)
  window.__w2s = function (wx, wy) { return w2s(wx, wy); };
  window.__state = function () {
    return {
      phase: phase,
      budgetLeft: budget - spentTotal(),
      tools: placed.map(function (p) { return { type: p.type, t: p.t, member: p.memberId }; })
    };
  };

  // ---------------------------------------------------------------- boot
  window.addEventListener('resize', function () { resize(); buildTicks(); });
  resize();
  fitCamera();
  requestAnimationFrame(function (t) { last = t; requestAnimationFrame(frame); });
})();
