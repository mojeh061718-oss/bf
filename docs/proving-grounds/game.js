/* ============================================================
   PROVING GROUNDS — game.js
   UI, bench stations, QA bay, Station 7 range camera, adjudication.
   All science is invented. All paperwork is sincere.
   ============================================================ */
'use strict';

(function () {

  /* ================= helpers ================= */
  function $(id) { return document.getElementById(id); }
  function fmt$(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, ms || 2600);
  }

  /* ================= state ================= */
  var S = {
    seed: PG.makeSeed(),
    design: {
      mix: { am4: 0.34, crx: 0.33, vx7: 0.33 },
      mass: 30, alloy: 'sr2', wall: 10,
      fuse: ['surplus', 'surplus', 'surplus', 'surplus'],
      qa: { batch: [null, null, null, null], env: false, mic: 'skip' }
    },
    qaSpend: 0,
    envResult: null,
    micUsed: false,
    result: null
  };

  function resetQA() {
    S.design.qa = { batch: [null, null, null, null], env: false, mic: 'skip' };
    S.qaSpend = 0; S.envResult = null; S.micUsed = false;
  }

  /* ================= screens ================= */
  var screens = ['scr-title', 'scr-rfp', 'scr-bench', 'scr-qa', 'scr-range', 'scr-adjud'];
  function show(id) {
    screens.forEach(function (s) { $(s).classList.toggle('active', s === id); });
    if (id === 'scr-range') Range.onShow(); else Range.onHide();
  }

  /* ================= RFP ================= */
  var rfpTimer = [];
  function buildRFP(fast) {
    var doc = $('rfp-doc');
    var R = PG.RFP;
    doc.innerHTML =
      '<div class="doc-sec">' +
        '<div class="doc-headrow"><span>' + R.form + '</span><span>SHEET 1 OF 1</span></div>' +
        '<div class="doc-stamp">CONFIDENTIAL</div>' +
        '<div class="rfp-no">REQUEST FOR PROPOSAL · ' + R.id + '</div>' +
        '<div class="rfp-title">QUARRY BREACH CHARGE</div>' +
        '<div class="rfp-agency">REPUBLIC PROVING AUTHORITY · BUREAU OF CONTROLLED ENTHUSIASM</div>' +
        '<hr class="doc-rule">' +
      '</div>' +
      '<div class="doc-sec">' +
        '<table class="spec-table">' +
        '<tr><td>EFFECT</td><td><b>Crater diameter ' + R.craterMin + '–' + R.craterMax + ' m</b><br>as measured by Station 7 telemetry (Halloran scaling)</td></tr>' +
        '<tr><td>PRECISION</td><td><b>Detonation at T+' + R.timerSpec.toFixed(1) + ' s, ±' + R.timerTol + ' s</b> of commanded fire</td></tr>' +
        '<tr><td>CONSTRAINTS</td><td><b>Unit cost ≤ ' + fmt$(R.costCap) + '</b> · <b>weight ≤ ' + R.weightCap + ' kg</b> · safety interlock per spec 7.4.1(c)</td></tr>' +
        '<tr><td>TEST CONDITIONS</td><td>Sector 9 quarry face. Forecast: <b>' + R.forecastC + '°C, clear</b>, light washboard on approach road</td></tr>' +
        '</table>' +
      '</div>' +
      '<div class="doc-sec">' +
        '<hr class="doc-rule thin">' +
        '<p class="spec-clause"><span class="cl">7.4.1(c)</span> — The device SHALL incorporate a mechanical arming interlock. The Authority is aware this costs money. The Authority does not care.</p>' +
        '<p class="spec-clause"><span class="cl">9.2</span> — The device shall be paintable. Colour: "Government Grey No. 2" or nearest available regret.</p>' +
        '<p class="spec-clause"><span class="cl">11.3</span> — The test article shall not exceed 40 decibels while being transported. Detonation on the approach road is considered exceeding 40 decibels.</p>' +
      '</div>' +
      '<div class="doc-sec">' +
        '<hr class="doc-rule thin">' +
        '<div class="payline"><span>DEVELOPMENT AWARD</span><b>' + fmt$(R.payout) + '</b></div>' +
        '<div class="payline"><span>PRECISION BONUS (±' + R.timerTol + ' s)</span><b>+' + fmt$(R.bonus) + '</b></div>' +
        '<div class="payline"><span>ADJUDICATION</span><b>FORMULA 9(b), VALUE BASIS</b></div>' +
      '</div>' +
      '<div class="doc-sec">' +
        '<div class="rival-box">' +
          '<div class="rival-logo">V</div>' +
          '<div class="rival-txt"><b>COMPETING BID FILED: VANTAGE DYNAMICS</b><br>' +
          '<span class="rival-quote">“We consider this procurement a formality.” — R.&nbsp;Cavendish&nbsp;Vane, VP of Client Triumph, to <i>Ordnance Weekly</i></span></div>' +
        '</div>' +
        '<div class="rfp-no" style="margin-top:12px">TEST SERIES ' + S.seed + ' · REPLY BY TELETYPE ONLY</div>' +
      '</div>';

    rfpTimer.forEach(clearTimeout); rfpTimer = [];
    var secs = doc.querySelectorAll('.doc-sec');
    $('btn-accept').disabled = true;
    var step = fast ? 90 : 420;
    secs.forEach(function (sec, i) {
      rfpTimer.push(setTimeout(function () {
        sec.classList.add('shown');
        PGAudio.tick();
      }, 150 + i * step));
    });
    rfpTimer.push(setTimeout(function () {
      $('btn-accept').disabled = false;
      PGAudio.typeDing();
    }, 150 + secs.length * step));
    doc.onpointerdown = function () { // impatient bureaucrats may skip
      rfpTimer.forEach(clearTimeout);
      secs.forEach(function (s) { s.classList.add('shown'); });
      $('btn-accept').disabled = false;
    };
  }

  /* ================= BENCH ================= */
  var triCanvas, triCtx, triGeom = null;

  function buildBench() {
    $('chip-series').textContent = 'SERIES ' + S.seed;
    $('chip-forecast').textContent = 'FORECAST ' + PG.RFP.forecastC + '°C ☀';
    buildFillPane();
    buildCasingPane();
    buildFusePane();
    refreshBench();
  }

  /* ---- FILL ---- */
  function buildFillPane() {
    var p = $('pane-fill');
    p.innerHTML =
      '<div class="station-title">STATION 1 · <b>FILL CHEMISTRY</b> — drag the mix point</div>' +
      '<canvas id="tri-canvas"></canvas>' +
      '<div class="prop-bars">' +
        propBar('ENERGY', 'energy', 'en') +
        propBar('STABILITY', 'stability', 'st') +
        propBar('SENSITIVITY', 'sens', 'se') +
      '</div>' +
      '<div class="blend-warns" id="blend-warns"></div>' +
      '<div class="ctl-row"><div class="ctl-lbl"><span>FILL MASS</span><b id="mass-val">30 kg</b></div>' +
      '<input type="range" id="mass-slider" min="10" max="60" step="1" value="' + S.design.mass + '"></div>' +
      '<div class="pred-box"><div class="pred-title">PREDICTED CRATER — 80% CONFIDENCE (UNCERTAINTY IS A PURCHASE)</div>' +
        '<div class="pred-axis" id="pred-axis">' +
          '<div class="pred-rail"></div><div class="pred-band" id="pred-band"></div><div class="pred-ci" id="pred-ci"></div>' +
          '<div class="pred-tick" id="ptick-lo"></div><div class="pred-tick" id="ptick-hi"></div>' +
        '</div>' +
        '<div class="pred-note" id="pred-note"></div>' +
      '</div>';

    triCanvas = $('tri-canvas');
    triCtx = triCanvas.getContext('2d');
    sizeTriangle();

    var dragging = false;
    triCanvas.addEventListener('pointerdown', function (e) {
      dragging = true; triCanvas.setPointerCapture(e.pointerId);
      triDrag(e); PGAudio.click();
    });
    triCanvas.addEventListener('pointermove', function (e) { if (dragging) { triDrag(e); PGAudio.scratch(); } });
    triCanvas.addEventListener('pointerup', function () { dragging = false; });
    triCanvas.addEventListener('pointercancel', function () { dragging = false; });

    $('mass-slider').addEventListener('input', function (e) {
      S.design.mass = +e.target.value;
      PGAudio.scratch();
      refreshBench();
    });
  }
  function propBar(name, key, id) {
    return '<div class="prop-bar"><span class="pb-name">' + name + '</span>' +
      '<span class="pb-track"><span class="pb-fill ' + key + '" id="pb-' + id + '" style="width:0%"></span>' +
      (key === 'stability' ? '<span class="pb-mark" id="pb-req"></span>' : '') +
      '</span><span class="pb-val" id="pbv-' + id + '">—</span></div>';
  }

  function sizeTriangle() {
    if (!triCanvas) return;
    var w = triCanvas.parentElement ? triCanvas.parentElement.clientWidth - 30 : 330;
    w = Math.max(260, Math.min(w, 460));
    var h = Math.round(w * 0.74);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    triCanvas.width = w * dpr; triCanvas.height = h * dpr;
    triCanvas.style.width = w + 'px'; triCanvas.style.height = h + 'px';
    triCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var pad = 34;
    triGeom = {
      w: w, h: h,
      V: { x: w / 2, y: pad - 6 },            // VEX-7 top
      A: { x: pad + 6, y: h - pad },           // AMMONITE-4 bottom-left
      C: { x: w - pad - 6, y: h - pad }        // CERULEX bottom-right
    };
    drawTriangle();
  }

  function mixToPoint(mix) {
    var g = triGeom;
    return {
      x: g.V.x * mix.vx7 + g.A.x * mix.am4 + g.C.x * mix.crx,
      y: g.V.y * mix.vx7 + g.A.y * mix.am4 + g.C.y * mix.crx
    };
  }
  function pointToMix(x, y) {
    var g = triGeom, A = g.A, C = g.C, V = g.V;
    var d = (C.y - V.y) * (A.x - V.x) + (V.x - C.x) * (A.y - V.y);
    var a = ((C.y - V.y) * (x - V.x) + (V.x - C.x) * (y - V.y)) / d;
    var c = ((V.y - A.y) * (x - V.x) + (A.x - V.x) * (y - V.y)) / d;
    var v = 1 - a - c;
    a = Math.max(0, a); c = Math.max(0, c); v = Math.max(0, v);
    var s = a + c + v;
    return { am4: a / s, crx: c / s, vx7: v / s };
  }
  function triDrag(e) {
    var r = triCanvas.getBoundingClientRect();
    S.design.mix = pointToMix(e.clientX - r.left, e.clientY - r.top);
    refreshBench();
  }

  function drawTriangle() {
    if (!triGeom) return;
    var ctx = triCtx, g = triGeom;
    ctx.clearRect(0, 0, g.w, g.h);

    // subdivision grid
    ctx.strokeStyle = 'rgba(88,140,187,.22)';
    ctx.lineWidth = 1;
    for (var i = 1; i < 5; i++) {
      var t = i / 5;
      line(ctx, lerpP(g.A, g.V, t), lerpP(g.C, g.V, t));
      line(ctx, lerpP(g.V, g.A, t), lerpP(g.C, g.A, t));
      line(ctx, lerpP(g.V, g.C, t), lerpP(g.A, g.C, t));
    }
    // main triangle
    ctx.strokeStyle = 'rgba(156,200,234,.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(g.V.x, g.V.y); ctx.lineTo(g.A.x, g.A.y); ctx.lineTo(g.C.x, g.C.y); ctx.closePath();
    ctx.stroke();

    // corner labels
    ctx.font = '700 11px ' + '-apple-system, Segoe UI, Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e06a5a';
    ctx.fillText('VEX-7', g.V.x, g.V.y - 12);
    ctx.font = '9px Menlo, monospace';
    ctx.fillStyle = 'rgba(224,106,90,.8)';
    ctx.fillText('$30/kg · touchy', g.V.x, g.V.y - 2);
    ctx.font = '700 11px -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillStyle = '#f0b95c';
    ctx.textAlign = 'left';
    ctx.fillText('AMMONITE-4', g.A.x - 24, g.A.y + 16);
    ctx.font = '9px Menlo, monospace';
    ctx.fillStyle = 'rgba(240,185,92,.8)';
    ctx.fillText('$16/kg · hates heat', g.A.x - 24, g.A.y + 26);
    ctx.font = '700 11px -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillStyle = '#59c48f';
    ctx.textAlign = 'right';
    ctx.fillText('CERULEX', g.C.x + 22, g.C.y + 16);
    ctx.font = '9px Menlo, monospace';
    ctx.fillStyle = 'rgba(89,196,143,.8)';
    ctx.fillText('$9/kg · dull, loyal', g.C.x + 22, g.C.y + 26);

    // mix point
    var p = mixToPoint(S.design.mix);
    ctx.strokeStyle = 'rgba(229,161,61,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#e5a13d';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(p.x - 20, p.y); ctx.lineTo(p.x - 7, p.y);
    ctx.moveTo(p.x + 7, p.y); ctx.lineTo(p.x + 20, p.y);
    ctx.moveTo(p.x, p.y - 20); ctx.lineTo(p.x, p.y - 7);
    ctx.moveTo(p.x, p.y + 7); ctx.lineTo(p.x, p.y + 20);
    ctx.stroke();
    ctx.fillStyle = '#f0b95c';
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill();
  }
  function lerpP(a, b, t) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }
  function line(ctx, a, b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }

  /* ---- CASING ---- */
  function buildCasingPane() {
    var p = $('pane-casing');
    var cards = Object.keys(PG.ALLOYS).map(function (id) {
      var a = PG.ALLOYS[id];
      return '<button class="alloy-card" data-alloy="' + id + '" type="button">' +
        '<span class="ac-name">' + a.name + '</span>' +
        '<span class="ac-grade">GRADE ' + a.grade + '</span>' +
        '<span class="ac-blurb">' + a.blurb + '</span>' +
        '<span class="ac-stats">' +
          '<span>BASE <b>' + fmt$(a.baseC) + '</b> +' + fmt$(a.cCoef) + '/mm</span>' +
          '<span>WT <b>' + a.baseW + 'kg</b> +' + a.wCoef + '/mm</span>' +
          '<span>BRITTLE <b>' + Math.round(a.brittle * 100) + '%</b></span>' +
          '<span>EFF <b>×' + a.eff.toFixed(2) + '</b></span>' +
        '</span></button>';
    }).join('');
    p.innerHTML =
      '<div class="station-title">STATION 2 · <b>CASING &amp; STRUCTURE</b> — trade sheets on file</div>' +
      '<div class="alloy-cards">' + cards + '</div>' +
      '<div class="ctl-row"><div class="ctl-lbl"><span>WALL THICKNESS</span><b id="wall-val">10 mm</b></div>' +
      '<input type="range" id="wall-slider" min="4" max="24" step="1" value="' + S.design.wall + '"></div>' +
      '<div class="wall-diagram">' +
        '<svg id="wall-svg" viewBox="0 0 84 84">' +
          '<circle cx="42" cy="42" r="34" fill="none" stroke="#9cc8ea" stroke-width="1.2"/>' +
          '<circle id="wall-inner" cx="42" cy="42" r="26" fill="rgba(229,161,61,.12)" stroke="#e5a13d" stroke-width="1"/>' +
          '<path d="M42 4v10M42 70v10M4 42h10M70 42h10" stroke="rgba(156,200,234,.5)" stroke-width="1"/>' +
        '</svg>' +
        '<div class="wall-info" id="wall-info"></div>' +
      '</div>';
    p.querySelectorAll('.alloy-card').forEach(function (btn) {
      btn.addEventListener('click', function () {
        S.design.alloy = btn.dataset.alloy;
        PGAudio.tap();
        refreshBench();
      });
    });
    $('wall-slider').addEventListener('input', function (e) {
      S.design.wall = +e.target.value;
      PGAudio.scratch();
      refreshBench();
    });
  }

  /* ---- FUSE ---- */
  function buildFusePane() {
    var p = $('pane-fuse');
    var html = '<div class="station-title">STATION 3 · <b>FUSE CHAIN</b> — reliability multiplies. Downward.</div>';
    PG.STAGES.forEach(function (st, i) {
      var tiers = ['surplus', 'standard', 'precision'];
      if (i === 0) tiers = ['none'].concat(tiers);
      var btns = tiers.map(function (tid) {
        var t = PG.TIERS[tid];
        var rel = tid === 'none' ? '—' : (t.rel * 100).toFixed(1) + '%';
        var drift = (i === 1 && tid !== 'none') ? ' ±' + t.drift.toFixed(2) + 's' : '';
        return '<button class="fs-tier' + (tid === 'none' ? ' danger' : '') + '" data-stage="' + i + '" data-tier="' + tid + '" type="button">' +
          '<span class="ft-name">' + t.name + '</span>' +
          '<span class="ft-cost">' + (tid === 'none' ? '$0' : fmt$(t.cost)) + '</span>' +
          '<span class="ft-rel">' + rel + drift + '</span></button>';
      }).join('');
      html += '<div class="fuse-stage" id="fstage-' + i + '">' +
        '<span class="fs-measured hidden" id="fmeasured-' + i + '">MEASURED</span>' +
        '<div class="fs-head"><span class="fs-name">' + st.name + '</span><span class="fs-idx">STAGE ' + (i + 1) + '/4</span></div>' +
        '<div class="fs-note">' + st.note + '</div>' +
        '<div class="fs-tiers">' + btns + '</div></div>';
    });
    html += '<div class="chain-strip"><div class="chain-math" id="chain-math"></div>' +
      '<div class="chain-drift" id="chain-drift"></div>' +
      '<div class="spec-alert hidden" id="interlock-alert">⚠ SPEC 7.4.1(c) UNSATISFIED — the bench does not stop you. The board will.</div></div>';
    p.innerHTML = html;
    p.querySelectorAll('.fs-tier').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = +btn.dataset.stage;
        S.design.fuse[i] = btn.dataset.tier;
        if (btn.dataset.tier === 'none') PGAudio.buzz(); else PGAudio.tap();
        refreshBench();
      });
    });
  }

  /* ---- LEDGER ---- */
  function buildLedgerPane(d) {
    var p = $('pane-ledger');
    var R = PG.RFP;
    var qa = S.design.qa;
    var fuseNames = S.design.fuse.map(function (t, i) { return PG.TIERS[t].name; });
    var qaRecord = [];
    for (var i = 0; i < 4; i++) if (qa.batch[i] && qa.batch[i].tier === S.design.fuse[i]) qaRecord.push('STAGE-' + (i + 1) + ' BATCH ' + (qa.batch[i].rate * 100).toFixed(1) + '%');
    if (qa.env) qaRecord.push('ENV CHAMBER ' + (S.envResult && S.envResult.pass ? 'PASS' : 'UNSTABLE+CRATES'));
    if (qa.mic === 'pass') qaRecord.push('MICROMETER TRIM −15% DRIFT');
    if (qa.mic === 'fail') qaRecord.push('INSPECTION INCONCLUSIVE');
    if (!qaRecord.length) qaRecord.push('NONE. NOTED.');

    p.innerHTML =
      '<div class="station-title">STATION 4 · <b>BUDGET LEDGER &amp; COMPLIANCE</b></div>' +
      '<table class="ledger-table">' +
        '<tr><td>FILL — ' + S.design.mass + ' kg blend</td><td>' + fmt$(d.fillCost) + '</td></tr>' +
        '<tr><td>CASING — ' + d.alloy.name + ', ' + S.design.wall + ' mm</td><td>' + fmt$(d.casingCost) + '</td></tr>' +
        '<tr><td>FUSE CHAIN — ' + fuseNames.join(' / ').toLowerCase() + '</td><td>' + fmt$(d.fuseCost) + '</td></tr>' +
        '<tr class="total' + (d.costOk ? '' : ' over') + '"><td>UNIT COST (CAP ' + fmt$(R.costCap) + ')</td><td>' + fmt$(d.unitCost) + '</td></tr>' +
      '</table>' +
      '<div class="compliance">' +
        compRow('EFFECT ⌀ ' + R.craterMin + '–' + R.craterMax + ' m', predVerdict(d), predClass(d)) +
        compRow('PRECISION ±' + R.timerTol + ' s', 'drift ±' + d.chainDrift.toFixed(2) + ' s', d.chainDrift <= R.timerTol * 0.7 ? 'ok' : (d.chainDrift <= R.timerTol * 1.4 ? 'warn' : 'bad')) +
        compRow('CHAIN RELIABILITY', (d.chainRel * 100).toFixed(1) + '%', d.chainRel > 0.95 ? 'ok' : (d.chainRel > 0.85 ? 'warn' : 'bad')) +
        compRow('WEIGHT ≤ ' + R.weightCap + ' kg', d.weight + ' kg', d.weightOk ? 'ok' : 'bad') +
        compRow('INTERLOCK 7.4.1(c)', d.interlock ? 'FITTED' : 'ABSENT', d.interlock ? 'ok' : 'bad') +
        compRow('THERMAL @ ' + R.forecastC + '°C', 'stab ' + d.blend.stability.toFixed(2) + ' / req ' + d.stabilityReq.toFixed(2) + (S.design.qa.env ? ' · QUALIFIED' : ' · UNTESTED'), (d.blend.stability >= d.stabilityReq || S.design.qa.env) ? 'ok' : 'warn') +
      '</div>' +
      '<div class="pred-note" style="margin-top:12px">QA RECORD: ' + qaRecord.join(' · ') + '<br>PROGRAM SPEND ' + fmt$(S.qaSpend) + ' (deducted from payout, not unit cost)</div>';
  }
  function compRow(lbl, val, cls) {
    return '<div class="comp-row ' + cls + '"><span class="cr-lbl">' + lbl + '</span><span class="cr-val">' + val + '</span></div>';
  }
  function predVerdict(d) {
    var R = PG.RFP;
    if (d.craterHi < R.craterMin) return d.craterLo.toFixed(1) + '–' + d.craterHi.toFixed(1) + ' m · UNDER';
    if (d.craterLo > R.craterMax) return d.craterLo.toFixed(1) + '–' + d.craterHi.toFixed(1) + ' m · OVER';
    return d.craterLo.toFixed(1) + '–' + d.craterHi.toFixed(1) + ' m';
  }
  function predClass(d) {
    var R = PG.RFP;
    if (d.craterHi < R.craterMin || d.craterLo > R.craterMax) return 'bad';
    if (d.craterMean < R.craterMin + 1 || d.craterMean > R.craterMax - 1) return 'warn';
    return 'ok';
  }

  /* ---- refresh everything ---- */
  function refreshBench() {
    var d = PG.derive(S.design);
    var R = PG.RFP;

    if (triGeom) drawTriangle();

    // property bars
    var b = d.blend;
    setBar('pb-en', 'pbv-en', b.energy / 10.5, b.energy.toFixed(1));
    setBar('pb-st', 'pbv-st', b.stability, b.stability.toFixed(2));
    setBar('pb-se', 'pbv-se', b.sens, b.sens.toFixed(2));
    var req = $('pb-req');
    if (req) req.style.left = (d.stabilityReq * 100) + '%';

    // warnings
    var warns = $('blend-warns');
    if (warns) {
      var tags = [];
      if (b.stability < d.stabilityReq && !S.design.qa.env)
        tags.push('<span class="warn-tag hot">⚠ THERMAL MARGIN NEGATIVE @ ' + R.forecastC + '°C — UNTESTED</span>');
      if (b.stability < d.stabilityReq && S.design.qa.env)
        tags.push('<span class="warn-tag good">THERMAL CRATES FITTED — CONTAINED</span>');
      if (d.pTransport > 0)
        tags.push('<span class="warn-tag bad">⚠ SHOCK-SENSITIVE — THE ROAD IS WASHBOARD</span>');
      if (b.stability >= d.stabilityReq && d.pTransport === 0 && b.energy > 5)
        tags.push('<span class="warn-tag good">BLEND WITHIN HANDLING ENVELOPE</span>');
      warns.innerHTML = tags.join('');
    }
    var mv = $('mass-val'); if (mv) mv.textContent = S.design.mass + ' kg · ' + fmt$(d.fillCost);

    // prediction band (axis 8..32 m)
    var lo = 8, hi = 32;
    var band = $('pred-band');
    if (band) {
      band.style.left = ((R.craterMin - lo) / (hi - lo) * 100) + '%';
      band.style.width = ((R.craterMax - R.craterMin) / (hi - lo) * 100) + '%';
      var ci = $('pred-ci');
      var cl = clamp((d.craterLo - lo) / (hi - lo), 0, 1), ch = clamp((d.craterHi - lo) / (hi - lo), 0, 1);
      ci.style.left = (cl * 100) + '%';
      ci.style.width = Math.max((ch - cl) * 100, 1.5) + '%';
      $('ptick-lo').style.left = ((R.craterMin - lo) / (hi - lo) * 100) + '%';
      $('ptick-lo').textContent = R.craterMin + 'm';
      $('ptick-hi').style.left = ((R.craterMax - lo) / (hi - lo) * 100) + '%';
      $('ptick-hi').textContent = R.craterMax + 'm';
      $('pred-note').innerHTML = 'PREDICTED ⌀ <b>' + d.craterLo.toFixed(1) + '–' + d.craterHi.toFixed(1) + ' m</b> · yield ' + d.yieldBd + ' Bd · ' + (S.design.qa.env ? 'band tightened by env. qualification' : 'a range, not a number — testing narrows it');
    }

    // casing pane
    document.querySelectorAll('.alloy-card').forEach(function (c) {
      c.classList.toggle('sel', c.dataset.alloy === S.design.alloy);
    });
    var wv = $('wall-val'); if (wv) wv.textContent = S.design.wall + ' mm · ' + fmt$(d.casingCost);
    var wi = $('wall-inner');
    if (wi) wi.setAttribute('r', String(34 - 3 - S.design.wall * 0.9));
    var winfo = $('wall-info');
    if (winfo) winfo.innerHTML =
      'CASING WT <b>' + d.casingW.toFixed(1) + ' kg</b><br>SHAPE EFF <b>×' + d.eff.toFixed(2) + '</b><br>FRAG CHARACTER <b>' + (d.alloy.brittle > 0.7 ? 'WIDE SPRAY' : d.alloy.brittle > 0.35 ? 'MODERATE' : 'TIGHT') + '</b>';

    // fuse pane
    document.querySelectorAll('.fs-tier').forEach(function (btn) {
      btn.classList.toggle('sel', S.design.fuse[+btn.dataset.stage] === btn.dataset.tier);
    });
    for (var i = 0; i < 4; i++) {
      var stEl = $('fstage-' + i);
      if (!stEl) continue;
      stEl.classList.toggle('missing', S.design.fuse[i] === 'none');
      var m = $('fmeasured-' + i);
      var tested = S.design.qa.batch[i] && S.design.qa.batch[i].tier === S.design.fuse[i];
      m.classList.toggle('hidden', !tested);
    }
    var math = $('chain-math');
    if (math) {
      var parts = [], prod = 1;
      for (i = 0; i < 4; i++) {
        var tid = S.design.fuse[i];
        if (tid === 'none') { parts.push('<span style="color:#ff8d7e">1.00*</span>'); continue; }
        var tested2 = S.design.qa.batch[i] && S.design.qa.batch[i].tier === tid;
        var r = tested2 ? S.design.qa.batch[i].rate : PG.TIERS[tid].rel;
        parts.push('<span class="' + (tested2 ? 'measured' : '') + '">' + (r * 100).toFixed(1) + '%</span>');
      }
      math.innerHTML = parts.join(' × ') + ' = <b>' + (d.chainRel * 100).toFixed(1) + '% CHAIN</b>';
      var micNote = S.design.qa.mic === 'pass' ? ' <span class="mic-ok">(−15% micrometer trim)</span>' : '';
      $('chain-drift').innerHTML = 'TIMER DRIFT <b>±' + d.chainDrift.toFixed(2) + ' s</b> vs spec ±' + R.timerTol + ' s' + micNote;
      $('interlock-alert').classList.toggle('hidden', d.interlock);
    }
    var fuseTab = document.querySelector('.bench-tabs [data-tab="fuse"]');
    if (fuseTab) fuseTab.classList.toggle('warn', !d.interlock);
    var ledgerTab = document.querySelector('.bench-tabs [data-tab="ledger"]');
    if (ledgerTab) ledgerTab.classList.toggle('warn', !d.costOk || !d.weightOk);

    // ledger
    buildLedgerPane(d);

    // status bar
    $('bs-cost').textContent = fmt$(d.unitCost);
    $('bs-cost').classList.toggle('over', !d.costOk);
    var cf = $('bs-cost-fill');
    cf.style.width = clamp(d.unitCost / R.costCap * 100, 0, 100) + '%';
    cf.className = 'bs-fill' + (d.unitCost > R.costCap ? ' over' : d.unitCost > R.costCap * 0.85 ? ' warn' : '');
    $('bs-weight').textContent = d.weight + ' kg';
    $('bs-weight').classList.toggle('over', !d.weightOk);
    var wf = $('bs-weight-fill');
    wf.style.width = clamp(d.weight / R.weightCap * 100, 0, 100) + '%';
    wf.className = 'bs-fill' + (d.weight > R.weightCap ? ' over' : d.weight > R.weightCap * 0.85 ? ' warn' : '');
    $('bs-crater').textContent = '⌀ ' + d.craterLo.toFixed(1) + '–' + d.craterHi.toFixed(1) + ' m';
    $('bs-chain').textContent = 'CHAIN ' + (d.chainRel * 100).toFixed(1) + '% · ±' + d.chainDrift.toFixed(2) + 's';
  }
  function setBar(fillId, valId, frac, txt) {
    var f = $(fillId), v = $(valId);
    if (!f) return;
    f.style.width = clamp(frac * 100, 2, 100) + '%';
    v.textContent = txt;
  }

  /* ================= QA BAY ================= */
  function buildQA() {
    var body = $('qa-body');
    var qa = S.design.qa;
    var stageBtns = PG.STAGES.map(function (st, i) {
      var tier = S.design.fuse[i];
      var done = qa.batch[i] && qa.batch[i].tier === tier;
      var dis = tier === 'none' ? ' disabled' : '';
      return '<button class="qa-stage-btn' + (done ? ' done' : '') + '" data-stage="' + i + '"' + dis + ' type="button">' +
        st.short + (done ? ' ✓' : '') + '</button>';
    }).join('');

    body.innerHTML =
      '<div class="qa-card" id="qa-batch">' +
        '<h3>FUSE BATCH TEST <span class="qa-price">$150 / stage</span></h3>' +
        '<p>Fire ten units from a stage’s delivered batch. Replaces the catalog’s poetry with this batch’s <b>measured true rate</b>. Sometimes the war-surplus crate is secretly great. Sometimes.</p>' +
        '<div class="qa-stage-picker">' + stageBtns + '</div>' +
        '<button class="qa-run-btn" id="qa-batch-run" type="button" disabled>SELECT A STAGE</button>' +
        '<div class="qa-result" id="qa-batch-result"></div>' +
      '</div>' +
      '<div class="qa-card" id="qa-env">' +
        '<h3>ENVIRONMENTAL CHAMBER <span class="qa-price">$200</span></h3>' +
        '<p>Bake the blend to the range forecast (' + PG.RFP.forecastC + '°C) and see what it thinks. If it sulks, thermal crates are fitted for the truck ride — no cook-off on the pad.</p>' +
        '<div class="env-meter"><div class="env-needle" id="env-needle"></div></div>' +
        '<button class="qa-run-btn" id="qa-env-run" type="button"' + (qa.env ? ' disabled' : '') + '>' + (qa.env ? 'QUALIFIED' : 'RUN CHAMBER CYCLE') + '</button>' +
        '<div class="qa-result" id="qa-env-result">' + (S.envResult ? envResultText() : '') + '</div>' +
      '</div>' +
      '<div class="qa-card" id="qa-mic">' +
        '<h3>MICROMETER INSPECTION <span class="qa-price">$0 · skill</span></h3>' +
        '<p>You are the QA department. Verify the timer sleeve dimension by hand. Success trims timer drift by 15%. Failure reports, truthfully, nothing.</p>' +
        '<button class="qa-run-btn" id="qa-mic-run" type="button"' + (S.micUsed ? ' disabled' : '') + '>' +
          (S.micUsed ? (qa.mic === 'pass' ? 'TRIMMED −15% DRIFT ✓' : 'INSPECTION INCONCLUSIVE') : 'PICK UP THE MICROMETER') + '</button>' +
        '<div class="qa-result" id="qa-mic-result"></div>' +
      '</div>' +
      '<p class="pred-note" style="padding:0 4px">Skipping QA is always allowed, occasionally correct, and permanently on the record.</p>';

    $('qa-spend').textContent = 'PROGRAM SPEND ' + fmt$(S.qaSpend);

    var selStage = -1;
    body.querySelectorAll('.qa-stage-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selStage = +btn.dataset.stage;
        body.querySelectorAll('.qa-stage-btn').forEach(function (b) { b.style.background = ''; });
        btn.style.background = 'rgba(229,161,61,.18)';
        var tier = S.design.fuse[selStage];
        var done = qa.batch[selStage] && qa.batch[selStage].tier === tier;
        var run = $('qa-batch-run');
        run.disabled = done;
        run.textContent = done ? 'ALREADY MEASURED' : 'FIRE 10 UNITS — ' + PG.STAGES[selStage].short + ' ($150)';
        PGAudio.click();
      });
    });
    $('qa-batch-run').addEventListener('click', function () {
      if (selStage < 0) return;
      runBatchTest(selStage);
    });
    $('qa-env-run').addEventListener('click', runEnvTest);
    $('qa-mic-run').addEventListener('click', openMicrometer);
  }
  function envResultText() {
    if (!S.envResult) return '';
    return S.envResult.pass
      ? '<span class="good">PASS</span> — blend held composure at ' + PG.RFP.forecastC + '°C. Certificate suitable for framing.'
      : '<span class="bad">UNSTABLE</span> — blend expressed opinions at ' + PG.RFP.forecastC + '°C. Thermal crates fitted; pad risk contained. The blend remains on the naughty list.';
  }

  function runBatchTest(stageIdx) {
    var tier = S.design.fuse[stageIdx];
    if (tier === 'none') return;
    S.qaSpend += PG.QA_COST.batch;
    var mont = PG.batchMontage(S.seed, stageIdx, tier);
    var res = $('qa-batch-result');
    res.innerHTML = 'BENCH MONTAGE — ' + PG.STAGES[stageIdx].name + ', ' + PG.TIERS[tier].name + ' batch:' +
      '<div class="pip-row" id="pip-row"></div><div id="pip-verdict"></div>';
    var row = $('pip-row');
    for (var i = 0; i < 10; i++) {
      var pip = document.createElement('span');
      pip.className = 'pip';
      row.appendChild(pip);
    }
    var pips = row.children;
    var k = 0;
    $('qa-batch-run').disabled = true;
    var iv = setInterval(function () {
      var ok = mont.shots[k];
      pips[k].classList.add('fired', ok ? 'hit' : 'miss');
      pips[k].textContent = ok ? '✓' : '✕';
      PGAudio.benchPop(ok);
      k++;
      if (k >= 10) {
        clearInterval(iv);
        S.design.qa.batch[stageIdx] = { tier: tier, rate: mont.rate };
        var cat = PG.TIERS[tier].rel;
        var better = mont.rate >= cat;
        $('pip-verdict').innerHTML = mont.hits + '/10 fired. MEASURED TRUE RATE <b>' + (mont.rate * 100).toFixed(1) + '%</b> ' +
          (better ? '<span class="good">(catalog said ' + (cat * 100).toFixed(1) + '% — this batch is a good one)</span>'
                  : '<span class="bad">(catalog said ' + (cat * 100).toFixed(1) + '% — the catalog was optimistic)</span>');
        $('qa-spend').textContent = 'PROGRAM SPEND ' + fmt$(S.qaSpend);
        setTimeout(function () { buildQA(); $('qa-batch-result').innerHTML = res.innerHTML; }, 1400);
      }
    }, 170);
  }

  function runEnvTest() {
    S.qaSpend += PG.QA_COST.env;
    S.design.qa.env = true;
    var d = PG.derive(S.design);
    var pass = d.blend.stability >= d.stabilityReq;
    S.envResult = { pass: pass };
    $('qa-env-run').disabled = true;
    $('qa-env-run').textContent = 'CYCLING…';
    PGAudio.chamberHum(true);
    var needle = $('env-needle');
    // needle sweeps to where the blend sits vs requirement
    var pos = clamp(0.5 + (d.stabilityReq - d.blend.stability) * 1.6, 0.06, 0.96);
    requestAnimationFrame(function () { needle.style.left = (pos * 100) + '%'; });
    setTimeout(function () {
      $('qa-env-result').innerHTML = envResultText();
      $('qa-env-run').textContent = 'QUALIFIED';
      $('qa-spend').textContent = 'PROGRAM SPEND ' + fmt$(S.qaSpend);
      PGAudio.benchPop(pass);
      if (!pass) PGAudio.buzz();
    }, 1700);
  }

  /* ---- micrometer minigame ---- */
  var mic = { active: false, offset: 0, target: 0, timer: null, t0: 0 };
  function openMicrometer() {
    if (S.micUsed) return;
    $('mic-overlay').classList.remove('hidden');
    mic.active = true;
    mic.target = (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 70); // px the sleeve starts off by
    mic.offset = mic.target;
    mic.t0 = performance.now();
    buildMicScale();
    updateMicSleeve();
    var TIME = 10000;
    clearInterval(mic.timer);
    mic.timer = setInterval(function () {
      var left = 1 - (performance.now() - mic.t0) / TIME;
      $('mic-timer-fill').style.width = Math.max(left * 100, 0) + '%';
      if (left <= 0) finishMicrometer(false, true);
    }, 100);

    var zone = $('mic-zone');
    var dragX = null;
    zone.onpointerdown = function (e) { dragX = e.clientX; zone.setPointerCapture(e.pointerId); };
    zone.onpointermove = function (e) {
      if (dragX == null) return;
      var dx = e.clientX - dragX;
      dragX = e.clientX;
      var prev = Math.round(mic.offset / 8);
      mic.offset += dx * 0.55;   // vernier gearing
      if (Math.round(mic.offset / 8) !== prev) PGAudio.click();
      updateMicSleeve();
    };
    zone.onpointerup = zone.onpointercancel = function () { dragX = null; };
    $('btn-mic-lock').onclick = function () { finishMicrometer(Math.abs(mic.offset) <= 4.5, false); };
  }
  function buildMicScale() {
    var sleeve = $('mic-sleeve');
    var w = $('mic-zone').clientWidth;
    var html = '';
    // ticks across the sleeve; center datum brighter
    for (var i = -12; i <= 12; i++) {
      var x = 50 + i * 4.2;
      var main = i === 0;
      html += '<div style="position:absolute;left:' + x + '%;top:0;width:' + (main ? 2.5 : 1) + 'px;height:' +
        (main ? 100 : (i % 5 === 0 ? 62 : 38)) + '%;background:' + (main ? '#e5a13d' : 'rgba(156,200,234,.65)') +
        (main ? ';box-shadow:0 0 8px rgba(229,161,61,.8)' : '') + '"></div>';
    }
    sleeve.innerHTML = html;
    void w;
  }
  function updateMicSleeve() {
    $('mic-sleeve').style.transform = 'translateX(' + mic.offset + 'px)';
    $('mic-readout').textContent = 'Δ ' + (Math.abs(mic.offset) * 0.0007).toFixed(4) + ' vn';
  }
  function finishMicrometer(success, timedOut) {
    if (!mic.active) return;
    mic.active = false;
    clearInterval(mic.timer);
    $('mic-overlay').classList.add('hidden');
    S.micUsed = true;
    S.design.qa.mic = success ? 'pass' : 'fail';
    if (success) {
      PGAudio.benchPop(true);
      toast('Sleeve within tolerance. Timer drift trimmed −15%.');
    } else {
      PGAudio.buzz();
      toast(timedOut ? 'Time expired. Inspection inconclusive — truthfully reported.' : 'Off tolerance. Inspection inconclusive — truthfully reported.');
    }
    buildQA();
  }

  /* ================= RANGE DAY — STATION 7 ================= */
  var Range = (function () {
    var cv, ctx, W = 390, H = 700, dpr = 1;
    var raf = null, active = false;
    var mode = 'pad';           // pad | camera
    var phase = 'transition';   // transition | idle | armed | counting | outcome | replay
    var t0 = 0;                 // phase start (performance.now)
    var sweep = 0;              // blueprint transition 0..1
    var outcome = null, visual = null;
    var camT = 0;               // seconds since FIRE
    var detAt = null, soundAt = null, detHappened = false, soundHappened = false;
    var lastBeep = null;
    var shake = 0;
    var frags = [], seismo = [];
    var grainTiles = [], vignette = null;
    var caption = $('range-caption');
    var capTimers = [];
    var zoom = 1, zoomTarget = 1;
    var volunteerT = -1;
    var replaySpeed = 1, frameNo = 0;
    var noiseSeedFn = null;
    var inspectorT = -1;
    var lastFrameT = 0;

    function onShow() {
      active = true;
      size();
      if (!raf) { lastFrameT = performance.now(); raf = requestAnimationFrame(loop); }
    }
    function onHide() {
      active = false;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      capTimers.forEach(clearTimeout); capTimers = [];
    }
    function size() {
      cv = $('range-canvas');
      ctx = cv.getContext('2d');
      var r = $('scr-range').getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(300, r.width); H = Math.max(400, r.height);
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeGrain();
      makeVignette();
    }
    function makeGrain() {
      grainTiles = [];
      for (var g = 0; g < 3; g++) {
        var c = document.createElement('canvas');
        c.width = 96; c.height = 96;
        var x = c.getContext('2d');
        var img = x.createImageData(96, 96);
        for (var i = 0; i < img.data.length; i += 4) {
          var v = 110 + Math.random() * 120;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 26;
        }
        x.putImageData(img, 0, 0);
        grainTiles.push(c);
      }
    }
    function makeVignette() {
      vignette = document.createElement('canvas');
      vignette.width = Math.ceil(W / 2); vignette.height = Math.ceil(H / 2);
      var x = vignette.getContext('2d');
      var g = x.createRadialGradient(W / 4, H / 4, Math.min(W, H) * 0.24, W / 4, H / 4, Math.max(W, H) * 0.42);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,.5)');
      x.fillStyle = g;
      x.fillRect(0, 0, vignette.width, vignette.height);
    }

    /* ---- entry ---- */
    function enter(result) {
      outcome = result.outcome;
      visual = outcome.visual;
      mode = 'pad'; phase = 'transition'; t0 = performance.now();
      sweep = 0; camT = 0; detHappened = false; soundHappened = false;
      detAt = null; soundAt = null; lastBeep = null; shake = 0;
      frags = []; seismo = []; zoom = 1; zoomTarget = 1;
      volunteerT = -1; inspectorT = -1; frameNo = 0; replaySpeed = 1;
      noiseSeedFn = PG.stream(S.seed, 'visual-noise');
      $('cam-overlay').classList.add('hidden');
      $('cam-tick').classList.add('hidden');
      $('cam-frame').classList.add('hidden');
      $('btn-arm').classList.add('hidden');
      $('btn-fire').classList.add('hidden');
      $('range-after').classList.add('hidden');
      setCaption('', '');
      schedule(600, function () { PGAudio.wind(); });
    }

    function setCaption(small, main) {
      caption.innerHTML = (small ? '<span class="cap-small">' + small + '</span>' : '') + (main || '');
    }
    function schedule(ms, fn) { capTimers.push(setTimeout(fn, ms)); }

    /* ---- phase transitions ---- */
    function toIdle() {
      phase = 'idle'; t0 = performance.now();
      if (outcome.type === 'transport') {
        setCaption('SECTOR 9 · APPROACH ROAD', 'The board checks its watches. The truck is late.');
        schedule(2200, function () {
          detHappened = true; t0 = performance.now();
          PGAudio.detonation(0.5, false);
          shake = 6;
          setCaption('T−(EARLY)', 'The truck arrived. The device did not.');
          schedule(3200, function () { afterOutcome(); });
        });
        return;
      }
      if (outcome.type === 'interlock') {
        setCaption('PRE-FIRE CHECKLIST', 'A board inspector approaches the pad, clipboard first.');
        inspectorT = 0;
        schedule(4200, function () {
          PGAudio.stampThud();
          setCaption('SPEC 7.4.1(c)', '<b style="color:#ff8d7e">“Where,” the inspector asks, “is the interlock?”</b>');
          schedule(2600, function () {
            PGAudio.buzz();
            setCaption('', '<b style="color:#ff8d7e">TEST HALTED — ARTICLE IMPOUNDED</b>');
            schedule(1800, afterOutcome);
          });
        });
        return;
      }
      setCaption('SECTOR 9 · PAD A · ' + PG.RFP.forecastC + '°C', 'The review board raises its binoculars.');
      $('btn-arm').classList.remove('hidden');
    }

    function armed() {
      phase = 'armed'; t0 = performance.now();
      $('btn-arm').classList.add('hidden');
      PGAudio.klaxon();
      setCaption('RANGE HOT · RANGE HOT', 'All personnel to the bunker. The lunch tent stays where it is.');
      schedule(1700, function () {
        $('btn-fire').classList.remove('hidden');
      });
    }

    function fire() {
      $('btn-fire').classList.add('hidden');
      mode = 'camera'; phase = 'counting'; t0 = performance.now();
      camT = 0;
      $('cam-overlay').classList.remove('hidden');
      $('cam-station').textContent = PG.RFP.camera.id + ' — ' + PG.RFP.camera.km.toFixed(1) + ' KM';
      setCaption('', '');
      // event times (seconds on the camera clock; T-0 = camT 5.0)
      if (outcome.type === 'cookoff') {
        detAt = 2.3;  // T−2.7, off-cue
      } else if (outcome.fired) {
        detAt = 5 + outcome.timerDelta;
      } else {
        detAt = null; // dud
      }
      soundAt = detAt != null ? detAt + visual.soundDelay : null;
      lastBeep = 6;
    }

    function afterOutcome() {
      phase = 'outcome';
      var after = $('range-after');
      after.classList.remove('hidden');
      $('btn-replay').classList.toggle('hidden', !detHappened || mode !== 'camera');
    }

    function startReplay() {
      if (detAt == null) return;
      phase = 'replay'; t0 = performance.now();
      replaySpeed = 0.3;
      camT = detAt - 0.4;
      detHappened = false;
      frags = [];
      frameNo = 0;
      shake = 0;
      $('range-after').classList.add('hidden');
      $('cam-frame').classList.remove('hidden');
      $('cam-tick').classList.add('hidden');
      setCaption('OPTICAL REPLAY — HIGH-SPEED FILM', '');
      // slow-mo covers the silent flash + bloom only; the wavefront was live-only
      schedule(((detAt + 2.0 - camT) / replaySpeed) * 1000, function () {
        replaySpeed = 1;
        $('cam-frame').classList.add('hidden');
        outcomeCaptions();
        afterOutcome();
      });
    }

    /* ---- captions for camera outcomes ---- */
    function outcomeCaptions() {
      var R = PG.RFP;
      if (outcome.type === 'success') {
        setCaption('STATION 7 TELEMETRY', 'Crater ⌀ <b>' + outcome.craterActual.toFixed(1) + ' m</b> · det at T+' + outcome.timerActual.toFixed(2) + ' s.<br>The board pretends not to smile.');
      } else if (outcome.type === 'partial') {
        var small = outcome.craterActual < R.craterMin;
        setCaption('STATION 7 TELEMETRY', 'Crater ⌀ <b>' + outcome.craterActual.toFixed(1) + ' m</b> — ' + (small ? 'under' : 'over') + ' the spec band.<br>' + (small ? 'The quarry face shrugs it off.' : 'The quarry wanted a door, not a lake.'));
      } else if (outcome.type === 'fizzle') {
        setCaption('STATION 7 TELEMETRY', 'Low-order event. Smoke, disappointment, a crater of ⌀ ' + outcome.craterActual.toFixed(1) + ' m.<br>A board member writes one word. It is not a good word.');
      } else if (outcome.type === 'cookoff') {
        setCaption('OFF-CUE EVENT — T−2.7 s', 'The desert heat had opinions about your blend.<br>The lunch tent has been redistributed. Nobody is hurt. Lunch is.');
      }
    }

    function dudSequence() {
      setCaption('T+00:04 · NO EVENT', 'The device sits there. The desert sits there. Everyone sits there.');
      schedule(3500, function () {
        setCaption('T+02:00 · RANGE SAFETY PROTOCOL', 'A volunteer is selected. His helmet is two sizes too large.');
        zoomTarget = 2.8;
        $('cam-tick').textContent = 'ZOOM 2.8×';
        $('cam-tick').classList.remove('hidden');
        volunteerT = 0;
      });
      schedule(9500, function () {
        setCaption('T+09:12', 'He taps it with a very long stick. Nothing. He gives Station 7 a thumbs-up.');
      });
      schedule(12200, function () {
        PGAudio.stampThud();
        setCaption('', '<b>MADE SAFE — STAGE-' + (outcome.failStage + 1) + ' ' + PG.STAGES[outcome.failStage].short + ' NO-FIRE</b>');
        $('cam-tick').classList.add('hidden');
        schedule(1600, afterOutcome);
      });
    }

    /* ---- main loop ---- */
    function loop(now) {
      raf = active ? requestAnimationFrame(loop) : null;
      if (!active) return;
      var dtms = Math.min(now - lastFrameT, 50);
      lastFrameT = now;
      var dt = dtms / 1000;
      var t = (now - t0) / 1000;

      if (phase === 'transition') {
        sweep = clamp(t / 1.9, 0, 1);
        if (sweep >= 1) toIdle();
      }
      if (mode === 'camera' && (phase === 'counting' || phase === 'replay')) {
        camT += dt * replaySpeed;
        if (phase === 'replay') {
          frameNo += Math.round(24 * dt * 4); // slow-mo footage: high-speed frames
          $('cam-frame').textContent = 'FRM ' + String(frameNo).padStart(4, '0') + ' · ' + replaySpeed.toFixed(2) + '×';
        }
        updateCameraClock();
        // countdown beeps (live only)
        if (phase === 'counting' && !detHappened) {
          var tMinus = 5 - camT;
          var whole = Math.ceil(tMinus);
          if (whole >= 0 && whole <= 4 && whole !== lastBeep && tMinus > -0.05) {
            lastBeep = whole;
            PGAudio.beep(whole === 0);
          }
        }
        // detonation
        if (detAt != null && !detHappened && camT >= detAt) {
          detHappened = true;
          frags = [];
          if (phase === 'counting' && outcome.type === 'cookoff') {
            $('cam-tick').textContent = 'OFF-CUE EVENT — T−' + Math.abs(5 - camT).toFixed(1) + ' s';
            $('cam-tick').classList.remove('hidden');
          }
        }
        // dud: T-0 passes with nothing
        if (detAt == null && phase === 'counting' && camT > 5.6 && volunteerT < 0 && phase !== 'outcome') {
          phase = 'outcomePending';
          PGAudio.wind();
          dudSequence();
        }
        // wavefront arrival
        if (soundAt != null && !soundHappened && camT >= soundAt) {
          soundHappened = true;
          shake = visual.fizzle ? 3 : 8 + visual.dust * 8;
          if (phase === 'replay') {
            PGAudio.detonation(0.25, visual.fizzle);
          } else {
            PGAudio.detonation(clamp(visual.dust, 0.2, 1.2), visual.fizzle);
            PGAudio.seismo();
            $('cam-tick').textContent = 'WAVEFRONT — T+' + visual.soundDelay.toFixed(1) + ' s · ' + PG.RFP.camera.km.toFixed(1) + ' KM';
            $('cam-tick').classList.remove('hidden');
            schedule(2400, function () { $('cam-tick').classList.add('hidden'); });
            schedule(2600, function () {
              outcomeCaptions();
              afterOutcome();
            });
          }
        }
      }
      if (phase === 'outcomePending') { camT += dt; updateCameraClock(); }
      if (volunteerT >= 0) volunteerT += dt;
      if (inspectorT >= 0) inspectorT += dt;
      zoom += (zoomTarget - zoom) * Math.min(dt * 2, 1);
      shake = Math.max(0, shake - dt * (shake > 4 ? 9 : 4));

      render(now / 1000, dt);
    }

    function updateCameraClock() {
      var tm = camT - 5;
      var sign = tm < 0 ? 'T−' : 'T+';
      var a = Math.abs(tm);
      var mm = String(Math.floor(a / 60)).padStart(2, '0');
      var ss = (a % 60).toFixed(1).padStart(4, '0');
      $('cam-clock').textContent = sign + mm + ':' + ss;
    }

    /* ---- render dispatch ---- */
    function render(tAbs, dt) {
      ctx.save();
      if (shake > 0.05) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      if (mode === 'pad') renderPadScene(tAbs);
      else renderCameraScene(tAbs, dt);
      ctx.restore();
    }

    /* =========== PAD SCENE (arming) =========== */
    function renderPadScene(tAbs) {
      drawDesert(ctx, W, H, tAbs, false);
      drawPadProps(ctx, tAbs);
      if (outcome && outcome.type === 'transport' && detHappened) {
        // plume on the horizon, stage left
        var tt = (performance.now() - t0) / 1000;
        drawPlume(W * 0.13, H * 0.52, Math.min(tt * 40 + 20, 90), 0.8, tt);
      }
      // blueprint layer wipes away left→right
      if (sweep < 1) {
        var x = sweep * (W + 60);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, 0, W - x + 60, H);
        ctx.clip();
        drawBlueprintScene(ctx, tAbs);
        ctx.restore();
        // develop line
        ctx.fillStyle = 'rgba(240,230,200,.9)';
        ctx.fillRect(x - 1.5, 0, 3, H);
        ctx.fillStyle = 'rgba(156,200,234,.28)';
        ctx.fillRect(x - 10, 0, 9, H);
      }
      drawGrain(0.045);
    }

    function drawBlueprintScene(ctx, tAbs) {
      // blueprint backdrop
      ctx.fillStyle = '#0d2137';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(156,200,234,.14)';
      ctx.lineWidth = 1;
      for (var gx = 0; gx < W; gx += 28) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (var gy = 0; gy < H; gy += 28) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(156,200,234,.9)';
      ctx.lineWidth = 1.4;
      drawSceneLinework(ctx);
      ctx.font = '10px Menlo, monospace';
      ctx.fillStyle = 'rgba(156,200,234,.75)';
      ctx.textAlign = 'left';
      ctx.fillText('FIG. 1 — TEST ARTICLE, PAD A', 16, H * 0.86);
      ctx.fillText('SCALE: OPTIMISTIC', 16, H * 0.86 + 14);
    }
    function drawSceneLinework(ctx) {
      var hy = H * 0.55;
      // horizon + mesas outline
      ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();
      mesaPath(ctx, hy); ctx.stroke();
      // pad
      ctx.strokeRect(W * 0.38, H * 0.66, W * 0.24, 8);
      deviceOutline(ctx, W * 0.5, H * 0.66, true);
      // bunker
      ctx.strokeRect(W * 0.72, H * 0.72, W * 0.2, H * 0.1);
      // stand + tent
      ctx.strokeRect(W * 0.08, H * 0.70, W * 0.16, H * 0.05);
      ctx.beginPath();
      ctx.moveTo(W * 0.08, H * 0.70); ctx.lineTo(W * 0.16, H * 0.655); ctx.lineTo(W * 0.24, H * 0.70);
      ctx.stroke();
    }
    function mesaPath(ctx, hy) {
      ctx.beginPath();
      ctx.moveTo(0, hy);
      ctx.lineTo(W * 0.08, hy - 26); ctx.lineTo(W * 0.2, hy - 26); ctx.lineTo(W * 0.26, hy - 6);
      ctx.lineTo(W * 0.55, hy - 2); ctx.lineTo(W * 0.62, hy - 38); ctx.lineTo(W * 0.78, hy - 38);
      ctx.lineTo(W * 0.85, hy - 8); ctx.lineTo(W, hy - 12);
    }

    function drawDesert(ctx, W, H, tAbs, far) {
      var hy = H * 0.55;
      // sky
      var sky = ctx.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, '#7fb0d6');
      sky.addColorStop(0.55, '#cfd9d3');
      sky.addColorStop(1, '#f0d9a8');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, hy + 2);
      // sun
      ctx.fillStyle = 'rgba(255,244,214,.9)';
      ctx.beginPath(); ctx.arc(W * 0.78, hy * 0.32, 26, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,244,214,.25)';
      ctx.beginPath(); ctx.arc(W * 0.78, hy * 0.32, 44, 0, 7); ctx.fill();
      // mesas
      ctx.fillStyle = '#b98a63';
      mesaPath(ctx, hy);
      ctx.lineTo(W, hy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(133,94,66,.45)';
      ctx.fillRect(0, hy - 2, W, 3);
      // ground
      var gnd = ctx.createLinearGradient(0, hy, 0, H);
      gnd.addColorStop(0, '#d9a05b');
      gnd.addColorStop(1, '#a9713d');
      ctx.fillStyle = gnd;
      ctx.fillRect(0, hy, W, H - hy);
      // scrub dots
      ctx.fillStyle = 'rgba(110,90,50,.35)';
      for (var i = 0; i < 40; i++) {
        var sx = (i * 97.3) % W;
        var sy = hy + 8 + ((i * 53.7) % (H - hy - 20));
        var sc = far ? 0.6 : 1;
        ctx.fillRect(sx, sy, 3 * sc, 1.6 * sc);
      }
    }

    function deviceOutline(ctx, cx, padY, strokeOnly) {
      var mass = S.design.mass;
      var dw = 26 + mass * 0.55, dh = 20 + mass * 0.32;
      var y = padY - dh - 8;
      if (strokeOnly) {
        ctx.strokeRect(cx - dw / 2, y, dw, dh);
        ctx.beginPath(); ctx.arc(cx, y, dw * 0.18, Math.PI, 0); ctx.stroke();
        return;
      }
      var colors = { sr2: ['#6e6a63', '#4c4842'], d9: ['#7c8b99', '#57646f'], n3: ['#c2c8cf', '#8f979f'] };
      var c = colors[S.design.alloy];
      var g = ctx.createLinearGradient(cx - dw / 2, 0, cx + dw / 2, 0);
      g.addColorStop(0, c[1]); g.addColorStop(0.45, c[0]); g.addColorStop(1, c[1]);
      // trestle
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - dw * 0.3, padY - 6); ctx.lineTo(cx - dw * 0.45, padY + 6);
      ctx.moveTo(cx + dw * 0.3, padY - 6); ctx.lineTo(cx + dw * 0.45, padY + 6);
      ctx.stroke();
      ctx.fillStyle = g;
      roundRect(ctx, cx - dw / 2, y, dw, dh, 6); ctx.fill();
      // wall band graphic
      ctx.strokeStyle = 'rgba(20,18,15,.5)';
      ctx.lineWidth = Math.max(1.5, S.design.wall * 0.22);
      roundRect(ctx, cx - dw / 2, y, dw, dh, 6); ctx.stroke();
      // nose cap + stencil
      ctx.fillStyle = '#b02c1e';
      ctx.beginPath(); ctx.arc(cx, y + 2, dw * 0.16, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.font = '700 ' + Math.max(8, dw * 0.16) + 'px Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('041', cx, y + dh * 0.6);
    }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function drawPadProps(ctx, tAbs) {
      var padY = H * 0.685;
      // concrete pad
      ctx.fillStyle = '#b9b3a4';
      ctx.fillRect(W * 0.38, padY - 4, W * 0.24, 10);
      ctx.fillStyle = 'rgba(0,0,0,.15)';
      ctx.fillRect(W * 0.38, padY + 4, W * 0.24, 3);
      deviceOutline(ctx, W * 0.5, padY, false);
      // firing cable to bunker
      ctx.strokeStyle = 'rgba(40,32,22,.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W * 0.52, padY + 4);
      ctx.quadraticCurveTo(W * 0.66, padY + 26, W * 0.78, H * 0.78);
      ctx.stroke();
      // bunker
      ctx.fillStyle = '#8f8878';
      roundRect(ctx, W * 0.72, H * 0.73, W * 0.2, H * 0.09, 6); ctx.fill();
      ctx.fillStyle = '#565045';
      ctx.fillRect(W * 0.75, H * 0.755, W * 0.08, H * 0.02); // slit
      // periscope
      ctx.strokeStyle = '#565045'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(W * 0.9, H * 0.73); ctx.lineTo(W * 0.9, H * 0.71); ctx.lineTo(W * 0.92, H * 0.71); ctx.stroke();
      // viewing stand + figures
      ctx.fillStyle = '#a4906c';
      ctx.fillRect(W * 0.08, H * 0.715, W * 0.17, H * 0.045);
      // lunch tent
      drawTent(ctx, W * 0.13, H * 0.66, 1);
      for (var i = 0; i < 4; i++) {
        drawFigure(ctx, W * 0.105 + i * W * 0.038, H * 0.715, 1, i % 2 === 0, tAbs + i);
      }
      // range flags
      drawFlag(ctx, W * 0.35, padY - 2, tAbs);
      drawFlag(ctx, W * 0.65, padY - 2, tAbs + 2);
      // inspector vignette
      if (inspectorT >= 0) {
        var prog = clamp(inspectorT / 4, 0, 1);
        var ix = lerp(W * 0.78, W * 0.545, easeOut(prog));
        drawFigure(ctx, ix, padY + 6, 1.05, false, 0, true);
      }
    }
    function drawTent(ctx, x, y, s) {
      ctx.fillStyle = '#ddd3b8';
      ctx.beginPath();
      ctx.moveTo(x - 26 * s, y + 22 * s);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 26 * s, y + 22 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(176,44,30,.85)';
      ctx.fillRect(x - 3 * s, y - 8 * s, 6 * s, 8 * s);
    }
    function drawFigure(ctx, x, y, s, binocs, wob, clipboard) {
      var bob = Math.sin(wob * 1.7) * 0.6;
      ctx.fillStyle = '#3d3a33';
      ctx.fillRect(x - 3 * s, y - 16 * s + bob, 6 * s, 12 * s);        // body
      ctx.beginPath(); ctx.arc(x, y - 19 * s + bob, 3.4 * s, 0, 7); ctx.fill(); // head
      ctx.fillRect(x - 4.4 * s, y - 22 * s + bob, 8.8 * s, 1.6 * s);   // hat brim
      ctx.fillRect(x - 2.6 * s, y - 25 * s + bob, 5.2 * s, 3.2 * s);   // hat top
      if (binocs) {
        ctx.fillRect(x + 2 * s, y - 20 * s + bob, 5 * s, 2.4 * s);     // binoculars up
      }
      if (clipboard) {
        ctx.fillStyle = '#e8dfc8';
        ctx.fillRect(x - 8 * s, y - 14 * s + bob, 4.6 * s, 6 * s);
      }
    }
    function drawFlag(ctx, x, y, tAbs) {
      ctx.strokeStyle = '#7a6a4d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 26); ctx.stroke();
      ctx.fillStyle = '#c23b2e';
      var w = Math.sin(tAbs * 3) * 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 26);
      ctx.lineTo(x + 14, y - 23 + w);
      ctx.lineTo(x, y - 19);
      ctx.closePath(); ctx.fill();
    }
    function drawPlume(x, groundY, size, dark, tt) {
      var g = ctx.createRadialGradient(x, groundY - size * 0.7, size * 0.1, x, groundY - size * 0.7, size);
      g.addColorStop(0, 'rgba(70,58,44,' + (0.75 * dark) + ')');
      g.addColorStop(1, 'rgba(70,58,44,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, groundY - size * 0.7, size, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(90,74,54,' + (0.5 * dark) + ')';
      ctx.beginPath(); ctx.arc(x, groundY - size * 0.25, size * 0.4, 0, 7); ctx.fill();
    }

    /* =========== STATION 7 CAMERA SCENE =========== */
    var sceneCv = null, sceneCtx = null;
    function ensureScene() {
      if (!sceneCv || sceneCv.width !== Math.ceil(W) || sceneCv.height !== Math.ceil(H)) {
        sceneCv = document.createElement('canvas');
        sceneCv.width = Math.ceil(W); sceneCv.height = Math.ceil(H);
        sceneCtx = sceneCv.getContext('2d');
      }
    }

    function renderCameraScene(tAbs, dt) {
      ensureScene();
      var x = sceneCtx;
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.clearRect(0, 0, W, H);

      var hy = H * 0.46;             // horizon (long lens compression)
      var padX = W * 0.5, padY = H * 0.60;
      var pxPerM = 3.2 * zoom;       // fictional long-lens scale

      x.save();
      if (zoom !== 1) {
        x.translate(padX, padY);
        x.scale(zoom, zoom);
        x.translate(-padX, -padY);
      }

      // washed-out long-lens sky
      var sky = x.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, '#9dbdd6');
      sky.addColorStop(0.7, '#dcd9c4');
      sky.addColorStop(1, '#eed9a6');
      x.fillStyle = sky;
      x.fillRect(-W, -H, W * 3, hy + H);
      // distant mesas, hazy
      x.fillStyle = 'rgba(160,118,84,.55)';
      x.beginPath();
      x.moveTo(-W, hy);
      x.lineTo(W * 0.05, hy - 18); x.lineTo(W * 0.22, hy - 18); x.lineTo(W * 0.3, hy - 4);
      x.lineTo(W * 0.6, hy - 2); x.lineTo(W * 0.68, hy - 26); x.lineTo(W * 0.86, hy - 26);
      x.lineTo(W * 0.94, hy - 6); x.lineTo(W * 2, hy - 8);
      x.lineTo(W * 2, hy + 4); x.lineTo(-W, hy + 4);
      x.closePath(); x.fill();
      // ground
      var gnd = x.createLinearGradient(0, hy, 0, H);
      gnd.addColorStop(0, '#e0b479');
      gnd.addColorStop(1, '#b3854e');
      x.fillStyle = gnd;
      x.fillRect(-W, hy, W * 3, H * 2);
      // access road
      x.strokeStyle = 'rgba(120,92,58,.5)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(W * 1.2, H); x.quadraticCurveTo(W * 0.72, padY + 30, padX + 12, padY + 2); x.stroke();
      // scrub
      x.fillStyle = 'rgba(105,86,48,.4)';
      for (var i = 0; i < 60; i++) {
        var sx = ((i * 89.7) % (W * 1.4)) - W * 0.2;
        var sy = hy + 4 + ((i * 41.3) % (H - hy));
        var sc = 0.5 + (sy - hy) / (H - hy);
        x.fillRect(sx, sy, 2.6 * sc, 1.4 * sc);
      }

      // the pad, tiny and far
      x.fillStyle = 'rgba(190,182,164,.9)';
      x.fillRect(padX - 9, padY - 1.5, 18, 4);
      // marker boards
      x.fillStyle = 'rgba(200,60,40,.85)';
      x.fillRect(padX - 26, padY - 5, 2.5, 6);
      x.fillRect(padX + 24, padY - 5, 2.5, 6);
      // device speck (pre-detonation)
      if (!detHappened || (camT - (detAt || 0)) < 0) {
        x.fillStyle = '#3c372e';
        x.fillRect(padX - 1.6, padY - 5, 3.2, 5);
        // sun glint
        if (Math.sin(tAbs * 2.2) > 0.6) {
          x.fillStyle = 'rgba(255,255,240,.9)';
          x.fillRect(padX - 0.6, padY - 4.6, 1.4, 1.4);
        }
      }

      // dud volunteer approach (tiny figure, oversized helmet)
      if (volunteerT >= 0) {
        var vp = clamp(volunteerT / 7, 0, 1);
        var vx = lerp(W * 0.94, padX + 8, easeOut(vp));
        x.fillStyle = '#3a382f';
        x.fillRect(vx - 1.2, padY - 6.2, 2.4, 6);
        x.fillStyle = '#d8d2c0';
        x.beginPath(); x.arc(vx, padY - 7.4, 2.6, 0, 7); x.fill(); // the helmet
        if (vp >= 1) { // very long stick
          x.strokeStyle = '#8a7a5a'; x.lineWidth = 1;
          x.beginPath(); x.moveTo(vx - 1, padY - 5); x.lineTo(padX + 1, padY - 3); x.stroke();
        }
      }

      // detonation visuals
      if (detHappened && detAt != null) {
        var dtd = Math.max(camT - detAt, 0);
        drawDetonation(x, padX, padY, pxPerM / zoom, dtd, hy);
      }

      x.restore();

      // ---- composite to main with shimmer ----
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(sceneCv, 0, 0, W, H);
      // heat shimmer band above horizon
      var band = 46;
      for (var yy = 0; yy < band; yy += 2) {
        var sy2 = hy - 8 + yy - band * 0.4;
        if (sy2 < 0 || sy2 + 2 > H) continue;
        var off = Math.sin(tAbs * 5 + yy * 0.55) * (1.9 * (1 - yy / band)) * (1 + (detHappened ? visual.dust * 0.5 : 0));
        ctx.drawImage(sceneCv, 0, sy2, W, 2, off, sy2, W, 2);
      }
      // flash overlay (light arrives instantly, silently — the lens blooms)
      if (detHappened && detAt != null) {
        var ft = camT - detAt;
        if (ft < 0.75 && !visual.fizzle) {
          var fa = clamp(visual.bright * (ft < 0.07 ? ft / 0.07 : 1 - (ft - 0.07) / 0.68), 0, 1);
          ctx.fillStyle = 'rgba(255,252,240,' + fa * 0.95 + ')';
          ctx.fillRect(0, 0, W, H);
          // horizontal lens streak through the fireball
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          var streakY = H * 0.6 - 30;
          var sg = ctx.createLinearGradient(0, streakY - 10, 0, streakY + 10);
          sg.addColorStop(0, 'rgba(255,248,220,0)');
          sg.addColorStop(0.5, 'rgba(255,248,220,' + fa * 0.7 + ')');
          sg.addColorStop(1, 'rgba(255,248,220,0)');
          ctx.fillStyle = sg;
          ctx.fillRect(0, streakY - 10, W, 20);
          ctx.restore();
        }
      }
      // dust surge when the wavefront reaches Station 7
      if (soundHappened && soundAt != null) {
        var st = camT - soundAt;
        if (st >= 0 && st < 1.6 && !visual.fizzle) {
          var sa = (st < 0.15 ? st / 0.15 : 1 - (st - 0.15) / 1.45) * clamp(visual.dust, 0.2, 1) * 0.6;
          var dg = ctx.createLinearGradient(0, H * 0.55, 0, H);
          dg.addColorStop(0, 'rgba(216,180,124,0)');
          dg.addColorStop(1, 'rgba(216,180,124,' + clamp(sa, 0, 1) + ')');
          ctx.fillStyle = dg;
          ctx.fillRect(0, H * 0.55, W, H * 0.45);
        }
      }
      drawSeismoStrip(tAbs);
      drawGrain(soundHappened && (camT - soundAt) < 0.7 ? 0.16 : 0.07);
      ctx.drawImage(vignette, 0, 0, W, H);
    }

    /* the blast itself — parameterized by the player's actual build */
    function drawDetonation(x, padX, padY, pxPerM, t, hy) {
      var fbR = visual.fireball * 0.5 * pxPerM * 1.7;  // cinematic long-lens scale
      var rag = visual.ragged;

      // --- fireball / smoke ---
      if (fbR > 0) {
        var grow = 1 - Math.pow(1 - clamp(t / (visual.fizzle ? 1.6 : 0.9), 0, 1), 2.6);
        var r = fbR * (0.3 + 0.7 * grow);
        var rise = Math.min(t * fbR * (visual.fizzle ? 0.14 : 0.5), fbR * 2.4);
        var cy = padY - r * 0.45 - rise;
        var cool = clamp(t / (visual.fizzle ? 2.2 : 3.6), 0, 1);
        var hot = 1 - cool;

        // rising smoke column: stacked puffs from pad to fireball
        if (t > 0.3 && !visual.fizzle) {
          var puffs = 7;
          for (var P = 0; P < puffs; P++) {
            var pt2 = P / (puffs - 1);
            var py = lerp(padY - 4, cy + r * 0.5, pt2);
            var pr = r * (0.22 + 0.42 * pt2) * (0.8 + 0.2 * Math.sin(P * 2.7));
            var wob = Math.sin(P * 4.1 + t * 0.8) * pr * 0.35 * (rag + 0.3);
            var pg = x.createRadialGradient(padX + wob, py, pr * 0.1, padX + wob, py, pr);
            pg.addColorStop(0, 'rgba(112,92,68,' + (0.7 * (1 - cool * 0.4)) + ')');
            pg.addColorStop(1, 'rgba(96,80,60,0)');
            x.fillStyle = pg;
            x.beginPath(); x.arc(padX + wob, py, pr, 0, 7); x.fill();
          }
        }

        // fireball blob (ragged blends detonate dirty and asymmetric)
        var lobes = 1 + Math.round(rag * 4);
        for (var L = 0; L < lobes; L++) {
          var la = (L / lobes) * Math.PI * 2 + L * 1.7;
          var lox = L === 0 ? 0 : Math.cos(la) * r * 0.5 * rag;
          var loy = L === 0 ? 0 : Math.sin(la) * r * 0.35 * rag;
          var lr = L === 0 ? r : r * (0.4 + 0.35 * ((L * 37) % 10) / 10);
          if (visual.fizzle) {
            var g = x.createRadialGradient(padX + lox, cy + loy, lr * 0.05, padX + lox, cy + loy, lr);
            g.addColorStop(0, 'rgba(126,108,82,' + (0.8 - cool * 0.6) + ')');
            g.addColorStop(0.6, 'rgba(96,84,66,' + (0.6 - cool * 0.4) + ')');
            g.addColorStop(1, 'rgba(96,84,66,0)');
            x.fillStyle = g;
            x.beginPath(); x.arc(padX + lox, cy + loy, lr, 0, 7); x.fill();
          } else {
            // smoke body underneath (takes over as the fireball cools)
            var sm = x.createRadialGradient(padX + lox, cy + loy, lr * 0.05, padX + lox, cy + loy, lr);
            var smA = 0.25 + 0.5 * cool;
            sm.addColorStop(0, 'rgba(116,96,72,' + smA + ')');
            sm.addColorStop(0.6, 'rgba(104,86,66,' + smA * 0.85 + ')');
            sm.addColorStop(1, 'rgba(96,80,60,0)');
            x.fillStyle = sm;
            x.beginPath(); x.arc(padX + lox, cy + loy, lr, 0, 7); x.fill();
            // hot fire on top, fading with cool
            if (hot > 0.02) {
              var g2 = x.createRadialGradient(padX + lox, cy + loy, lr * 0.05, padX + lox, cy + loy, lr);
              g2.addColorStop(0, 'rgba(255,250,228,' + 0.97 * hot + ')');
              g2.addColorStop(0.3, 'rgba(250,186,84,' + 0.9 * hot + ')');
              g2.addColorStop(0.65, 'rgba(168,98,48,' + 0.6 * hot + ')');
              g2.addColorStop(1, 'rgba(90,66,46,0)');
              x.fillStyle = g2;
              x.beginPath(); x.arc(padX + lox, cy + loy, lr, 0, 7); x.fill();
            }
          }
        }
        // white-hot core, first moments only
        if (t < 0.6 && !visual.fizzle) {
          x.save();
          x.globalCompositeOperation = 'lighter';
          var cg = x.createRadialGradient(padX, cy, 1, padX, cy, r * 0.7);
          cg.addColorStop(0, 'rgba(255,255,245,' + (0.9 * (1 - t / 0.6)) + ')');
          cg.addColorStop(1, 'rgba(255,240,200,0)');
          x.fillStyle = cg;
          x.beginPath(); x.arc(padX, cy, r * 0.7, 0, 7); x.fill();
          x.restore();
        }
        // condensation ring blooming around the fireball (clean detonations only)
        if (t > 0.08 && t < 0.85 && !visual.fizzle && rag < 0.5) {
          var ct = (t - 0.08) / 0.77;
          x.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - ct)) + ')';
          x.lineWidth = 2.5;
          x.save();
          x.translate(padX, cy);
          x.scale(1, 0.6);
          x.beginPath(); x.arc(0, 0, r * (0.9 + ct * 1.6), 0, 7); x.stroke();
          x.restore();
        }
      } else if (outcome.type === 'dud') {
        // just the initiator's sad puff
        if (t < 3) {
          x.fillStyle = 'rgba(150,132,100,' + (0.4 * (1 - t / 3)) + ')';
          x.beginPath(); x.arc(padX, padY - 4 - t * 6, 4 + t * 5, 0, 7); x.fill();
        }
      }

      // --- fragmentation spray (casing signature) ---
      if (fbR > 0 && !visual.fizzle) {
        if (frags.length === 0) {
          for (var i = 0; i < visual.fragCount; i++) {
            var a = -Math.PI * (0.12 + 0.76 * ((i * 61) % 100) / 100);
            var spread = visual.fragSpread;
            var v = fbR * (2.2 + 3.2 * ((i * 37) % 100) / 100) * (0.5 + spread);
            frags.push({ a: a, v: v, drift: (((i * 17) % 100) / 100 - 0.5) * spread * 3 });
          }
        }
        x.strokeStyle = 'rgba(70,58,40,.6)';
        x.lineWidth = 1;
        for (var f = 0; f < frags.length; f++) {
          var fr = frags[f];
          var ft = clamp(t * 0.9, 0, 1.6);
          var fx = padX + Math.cos(fr.a) * fr.v * ft * 0.4 + fr.drift * ft * 30;
          var fy = padY + Math.sin(fr.a) * fr.v * ft * 0.4 + 60 * ft * ft; // gravity, fictional
          if (fy < padY + 4 && t < 2.2) {
            x.beginPath();
            x.moveTo(fx, fy);
            x.lineTo(fx - Math.cos(fr.a) * 4, fy - Math.sin(fr.a) * 4 + 2 * ft);
            x.stroke();
          }
        }
      }

      // --- ground shockwave ring racing toward the camera ---
      if (fbR > 0 && soundAt != null && !visual.fizzle) {
        var prog = clamp((camT - detAt) / (soundAt - detAt), 0, 1.05);
        if (prog > 0.02 && prog < 1.02) {
          var maxR = W * 1.35;
          var rr = prog * prog * maxR; // accelerating perspective
          x.save();
          x.translate(padX, padY);
          x.scale(1, 0.26);
          var ringA = (1 - prog * 0.75) * 0.6 + 0.1;
          // dust wall behind the front
          x.strokeStyle = 'rgba(196,158,104,' + ringA * 0.85 + ')';
          x.lineWidth = 14 + prog * 44;
          x.beginPath(); x.arc(0, 0, Math.max(rr - 16, 0), 0, 7); x.stroke();
          x.strokeStyle = 'rgba(214,180,126,' + ringA * 0.5 + ')';
          x.lineWidth = 30 + prog * 60;
          x.beginPath(); x.arc(0, 0, Math.max(rr - 40, 0), 0, 7); x.stroke();
          // the bright pressure front itself
          x.strokeStyle = 'rgba(252,248,232,' + ringA + ')';
          x.lineWidth = 3.5 + prog * 8;
          x.beginPath(); x.arc(0, 0, rr, 0, 7); x.stroke();
          x.restore();
        }
      }

      // --- crater left behind ---
      if (fbR > 0 && t > 2.6) {
        var craterPx = (outcome.craterActual || 0) * pxPerM;
        var ca = clamp((t - 2.6) / 1.2, 0, 1) * 0.55;
        x.save();
        x.translate(padX, padY);
        x.scale(1, 0.3);
        x.fillStyle = 'rgba(74,56,38,' + ca + ')';
        x.beginPath(); x.arc(0, 0, craterPx / 2, 0, 7); x.fill();
        x.strokeStyle = 'rgba(120,94,60,' + ca + ')';
        x.lineWidth = 3;
        x.beginPath(); x.arc(0, 0, craterPx / 2, 0, 7); x.stroke();
        x.restore();
      }
    }

    /* seismograph strip along the bottom of the feed */
    function drawSeismoStrip(tAbs) {
      var sy = H * 0.885, sw = W * 0.44, sx = W * 0.05, sh = 26;
      ctx.fillStyle = 'rgba(10,16,22,.55)';
      ctx.fillRect(sx - 6, sy - sh / 2 - 6, sw + 12, sh + 12);
      ctx.strokeStyle = 'rgba(156,200,234,.3)';
      ctx.strokeRect(sx - 6, sy - sh / 2 - 6, sw + 12, sh + 12);
      // advance trace
      var amp = 0.8;
      if (soundHappened && soundAt != null) {
        var since = camT - soundAt;
        if (since >= 0 && since < 3) amp = 12 * Math.exp(-since * 1.6) + 0.8;
      }
      seismo.push(clamp((Math.random() - 0.5) * amp * 2, -sh / 2 + 2, sh / 2 - 2));
      if (seismo.length > 120) seismo.shift();
      ctx.strokeStyle = 'rgba(126,212,154,.9)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (var i = 0; i < seismo.length; i++) {
        var px = sx + (i / 120) * sw;
        var py = sy + seismo[i];
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.font = '8px Menlo, monospace';
      ctx.fillStyle = 'rgba(156,200,234,.7)';
      ctx.textAlign = 'left';
      ctx.fillText('SEISMO CH-2', sx - 2, sy - sh / 2 - 10);
    }

    function drawGrain(alpha) {
      if (!grainTiles.length) return;
      var tile = grainTiles[(Math.random() * 3) | 0];
      ctx.save();
      ctx.globalAlpha = alpha * 8; // tiles are pre-faded
      var ox = -(Math.random() * 96) | 0, oy = -(Math.random() * 96) | 0;
      for (var yy = oy; yy < H; yy += 96)
        for (var xx = ox; xx < W; xx += 96)
          ctx.drawImage(tile, xx, yy);
      ctx.restore();
    }

    /* ---- controls ---- */
    function bindControls() {
      var armBtn = $('btn-arm');
      var armP = 0, armIv = null;
      function armStart(e) {
        e.preventDefault();
        PGAudio.armLatch();
        clearInterval(armIv);
        armIv = setInterval(function () {
          armP += 4;
          armBtn.style.setProperty('--p', armP);
          if (armP >= 100) {
            clearInterval(armIv);
            armed();
          }
        }, 40);
      }
      function armStop() {
        clearInterval(armIv);
        if (phase === 'idle') { armP = 0; armBtn.style.setProperty('--p', 0); }
      }
      armBtn.addEventListener('pointerdown', armStart);
      armBtn.addEventListener('pointerup', armStop);
      armBtn.addEventListener('pointercancel', armStop);
      armBtn.addEventListener('pointerleave', armStop);
      $('btn-fire').addEventListener('click', function () { PGAudio.tap(); fire(); });
      $('btn-replay').addEventListener('click', function () { PGAudio.tap(); startReplay(); });
      $('btn-telemetry').addEventListener('click', function () {
        PGAudio.tap();
        buildAdjudication();
        show('scr-adjud');
      });
      window.addEventListener('resize', function () { if (active) size(); if (triCanvas) { sizeTriangle(); refreshBench(); } });
    }

    return { enter: enter, onShow: onShow, onHide: onHide, bindControls: bindControls };
  })();

  /* ================= ADJUDICATION ================= */
  function gaugeSVG(id, min, max, bandLo, bandHi, val, unit, hasData) {
    var W2 = 400, H2 = 74, pad = 16;
    function xOf(v) { return pad + (v - min) / (max - min) * (W2 - pad * 2); }
    var ticks = '';
    var step = (max - min) / 8;
    for (var k = 0; k <= 8; k++) {
      var v = min + step * k;
      var tx = xOf(v);
      var lbl = Math.abs(v) < 0.0001 ? '0' : (max - min <= 4 ? v.toFixed(2).replace(/0$/, '') : String(Math.round(v)));
      ticks += '<line x1="' + tx + '" y1="40" x2="' + tx + '" y2="46" stroke="rgba(156,200,234,.5)" stroke-width="1"/>' +
        '<text x="' + tx + '" y="60" fill="#7ba3c4" font-size="9" font-family="Menlo,monospace" text-anchor="middle">' +
        lbl + '</text>';
    }
    var needle = '';
    if (hasData) {
      var nx = clamp(xOf(val), pad, W2 - pad);
      needle = '<g class="needle" style="transform:translateX(' + (nx - xOf(min)) + 'px)">' +
        '<line x1="' + xOf(min) + '" y1="12" x2="' + xOf(min) + '" y2="44" stroke="#f0b95c" stroke-width="2.5"/>' +
        '<path d="M' + (xOf(min) - 5) + ' 8 L' + (xOf(min) + 5) + ' 8 L' + xOf(min) + ' 16 Z" fill="#f0b95c"/></g>';
    }
    return '<svg class="gauge-svg" viewBox="0 0 ' + W2 + ' ' + H2 + '" id="' + id + '">' +
      '<rect x="' + pad + '" y="24" width="' + (W2 - pad * 2) + '" height="12" rx="2" fill="rgba(156,200,234,.1)"/>' +
      '<rect x="' + xOf(bandLo) + '" y="18" width="' + (xOf(bandHi) - xOf(bandLo)) + '" height="24" fill="rgba(74,157,99,.25)" stroke="#4a9d63" stroke-width="1.2"/>' +
      '<text x="' + xOf((bandLo + bandHi) / 2) + '" y="14" fill="#63c584" font-size="8.5" font-family="Menlo,monospace" text-anchor="middle" letter-spacing="1">SPEC BAND</text>' +
      ticks + needle +
      '</svg>';
  }

  function buildAdjudication() {
    var r = S.result;
    var o = r.outcome, R = PG.RFP, v = r.vantage;
    var sheet = $('adjud-scroll');
    var craterHasData = o.craterActual != null && o.type !== 'cookoff';
    var timerHasData = o.timerDelta != null && o.type !== 'cookoff';

    var linesHtml = Object.keys(r.lines).map(function (k) {
      var L = r.lines[k];
      var st = L.pass ? '<span class="stamp-mini pass">PASS</span>' : '<span class="stamp-mini fail">FAIL</span>';
      if ((k === 'crater' || k === 'timer') && (o.craterActual == null && k === 'crater' || o.timerDelta == null && k === 'timer'))
        st = '<span class="stamp-mini na">NO DATA</span>';
      return '<tr><td>' + L.label + '</td><td class="val">' + L.value + '</td><td class="verdict">' + st + '</td></tr>';
    }).join('');

    var vStats = v.catastrophic
      ? '<b>TEST RESULT: WITHDRAWN IN CONFUSION.</b> No telemetry supplied. A brochure was supplied instead.'
      : 'Crater ⌀ <b>' + v.crater.toFixed(1) + ' m</b> · timer Δ <b>' + (v.timerDelta >= 0 ? '+' : '') + v.timerDelta.toFixed(2) + ' s</b> · unit cost <b>' + fmt$(v.cost) + '</b>' +
        (v.cost > R.costCap ? ' <span style="color:#8d2f24">(' + Math.round((v.cost / R.costCap - 1) * 100) + '% OVER CAP)</span>' : '') +
        '<br>Adjudicated value: <b>' + fmt$(v.value) + '</b> vs your <b>' + fmt$(r.value) + '</b>';

    var bannerCls = r.award === 'player' ? 'win' : (r.award === 'vantage' ? 'lose' : 'none');
    var bannerTitle = r.award === 'player' ? 'CONTRACT AWARDED' : (r.award === 'vantage' ? 'CONTRACT LOST' : 'CONTRACT WITHDRAWN');
    var bannerSub = r.award === 'player' ? 'REDLINE ORDNANCE WORKS — pending paperwork, of which there is a great deal'
      : r.award === 'vantage' ? 'Awarded to Vantage Dynamics. Their brochure was already printed.'
      : 'Nobody met specification. The Authority is disappointed in the entire industry.';
    var starsHtml = '';
    if (r.award === 'player') {
      starsHtml = '<div class="ab-stars">';
      for (var s = 1; s <= 3; s++) starsHtml += '<span class="' + (s <= r.stars ? '' : 'dim') + '">★</span>';
      starsHtml += '</div>';
    }

    var payRows =
      '<tr><td>DEVELOPMENT AWARD</td><td>' + (r.payout.award ? fmt$(r.payout.award) : '—') + '</td></tr>' +
      '<tr><td>PRECISION BONUS</td><td>' + (r.payout.bonus ? '+' + fmt$(r.payout.bonus) : '—') + '</td></tr>' +
      '<tr><td>UNIT COST</td><td>−' + fmt$(r.payout.unitCost) + '</td></tr>' +
      '<tr><td>QA PROGRAM SPEND</td><td>−' + fmt$(r.payout.qaSpend) + '</td></tr>' +
      '<tr class="net"><td>NET TO REDLINE</td><td class="' + (r.payout.net >= 0 ? 'pos' : 'neg') + '">' + (r.payout.net < 0 ? '−' : '') + fmt$(Math.abs(r.payout.net)) + '</td></tr>';

    sheet.innerHTML =
      '<div class="adjud-sheet">' +
        '<div class="adjud-head">REPUBLIC PROVING AUTHORITY · FORM PG-77</div>' +
        '<div class="adjud-title">TELEMETRY &amp; ADJUDICATION</div>' +
        '<div class="adjud-sub">TEST SERIES ' + S.seed + ' · AS READ FROM STATION 7 · THE GRAPH DOESN’T LIE</div>' +

        '<div class="gauge-card"><h4><span>MEASURED CRATER DIAMETER (m)</span>' +
          (craterHasData ? '<b class="' + (r.lines.crater.pass ? 'pass' : 'fail') + '">' + o.craterActual.toFixed(1) + ' m</b>' : '<b class="fail">NO DATA</b>') + '</h4>' +
          (craterHasData ? gaugeSVG('g-crater', 8, 32, R.craterMin, R.craterMax, o.craterActual, 'm', true)
            : '<div class="nodata">NO CRATER DATA — SEE INCIDENT REPORT</div>') +
        '</div>' +
        '<div class="gauge-card"><h4><span>TIMER ACCURACY Δ (s)</span>' +
          (timerHasData ? '<b class="' + (r.lines.timer.pass ? 'pass' : 'fail') + '">' + (o.timerDelta >= 0 ? '+' : '') + o.timerDelta.toFixed(2) + ' s</b>' : '<b class="fail">NO DATA</b>') + '</h4>' +
          (timerHasData ? gaugeSVG('g-timer', -1, 1, -R.timerTol, R.timerTol, o.timerDelta, 's', true)
            : '<div class="nodata">NO TIMING DATA RECORDED</div>') +
        '</div>' +

        '<div class="gauge-card"><h4><span>SPEC-LINE ADJUDICATION</span><b>MERIT ' + r.merit + ' PTS</b></h4>' +
          '<table class="score-table">' + linesHtml +
          '<tr><td>FORMULA 9(b) — merit × $40 − adj. price ' + fmt$(r.adjustedPrice) + '</td><td class="val">' + fmt$(r.value) + '</td><td class="verdict"></td></tr>' +
          '</table>' +
        '</div>' +

        '<div class="gauge-card"><h4><span>PAYOUT — REDLINE ORDNANCE WORKS</span></h4>' +
          '<table class="pay-table">' + payRows + '</table></div>' +

        '<div class="clipping">' +
          '<div class="clip-mast"><b>ORDNANCE WEEKLY</b><span>THE TRADE PAPER OF RECORD · 10¢</span></div>' +
          '<div class="clip-headline">' + v.headline + '</div>' +
          '<div class="clip-sub">' + v.sub + '</div>' +
          '<div class="clip-stats">' + vStats + '</div>' +
        '</div>' +

        '<div class="award-banner ' + bannerCls + '">' +
          '<div class="ab-kicker">DECISION OF THE REVIEW BOARD</div>' +
          '<div class="ab-title">' + bannerTitle + '</div>' +
          '<div class="ab-sub">' + bannerSub + '</div>' + starsHtml +
        '</div>' +

        (r.incident ? '<button id="btn-incident" type="button">📄 READ INCIDENT REPORT — FORM IR-3</button>' : '') +

        '<div class="adjud-btns">' +
          '<button id="btn-retry" type="button">RETRY<span class="sub">SAME SERIES · KEEP DESIGN</span></button>' +
          '<button id="btn-newcontract" type="button">NEW CONTRACT<span class="sub">FRESH SERIES</span></button>' +
        '</div>' +
      '</div>';

    sheet.scrollTop = 0;

    // animate needles in
    requestAnimationFrame(function () {
      sheet.querySelectorAll('.needle').forEach(function (n) {
        var target = n.style.transform;
        n.style.transform = 'translateX(0px)';
        n.style.transition = 'transform 1.1s cubic-bezier(.3,1.3,.4,1)';
        requestAnimationFrame(function () { requestAnimationFrame(function () { n.style.transform = target; }); });
      });
    });

    if (r.award === 'player') setTimeout(function () { PGAudio.fanfare(); }, 500);
    else setTimeout(function () { PGAudio.sadDrone(); }, 500);

    var ib = $('btn-incident');
    if (ib) ib.addEventListener('click', openIncident);
    $('btn-retry').addEventListener('click', function () {
      PGAudio.tap();
      resetQA();
      toast('Series ' + S.seed + ' re-slated. Same batches, same weather, same Vantage. Adjust and return.');
      buildBench();
      show('scr-bench');
    });
    $('btn-newcontract').addEventListener('click', function () {
      PGAudio.tap();
      S.seed = PG.makeSeed();
      resetQA();
      buildRFP(true);
      show('scr-rfp');
    });
  }

  /* ================= INCIDENT REPORT ================= */
  function openIncident() {
    var inc = S.result.incident;
    if (!inc) return;
    var doc = $('incident-doc');
    var today = 'DAY ' + (100 + (S.seed.charCodeAt(0) % 60)) + ' · FY 7';
    doc.innerHTML =
      '<div class="ir-agency">REPUBLIC PROVING AUTHORITY</div>' +
      '<div class="ir-form">' + inc.form + ' · FILE UNDER: LESSONS, UNLEARNED</div>' +
      '<div class="ir-title">INCIDENT REPORT</div>' +
      '<hr class="doc-rule">' +
      '<div class="ir-row">' +
        '<div class="ir-field"><div class="ir-lbl">DATE</div><div class="ir-val" data-type="' + today + '"></div></div>' +
        '<div class="ir-field"><div class="ir-lbl">SERIES</div><div class="ir-val" data-type="' + inc.series + '"></div></div>' +
        '<div class="ir-field"><div class="ir-lbl">CONTRACTOR</div><div class="ir-val" data-type="REDLINE ORDNANCE WORKS"></div></div>' +
      '</div>' +
      '<div class="ir-row">' +
        '<div class="ir-field"><div class="ir-lbl">OUTCOME CLASSIFICATION</div><div class="ir-val" data-type="' + inc.outcome + '"></div></div>' +
        '<div class="ir-field" style="flex:0 0 90px"><div class="ir-lbl">CLAUSE</div><div class="ir-val" data-type="' + inc.clause + '"></div></div>' +
      '</div>' +
      '<div class="ir-block"><div class="ir-lbl">FINDING OF FACT</div><div class="ir-boxed" data-type="' + inc.cause + '"></div></div>' +
      '<div class="ir-block"><div class="ir-lbl">ROOT CAUSE (WITH RECEIPT)</div><div class="ir-boxed rc" data-type="' + inc.receipt + '"></div></div>' +
      '<div class="ir-block"><div class="ir-lbl">CONTRIBUTING FACTORS</div><ul class="ir-contrib">' +
        inc.contributing.map(function (c) { return '<li data-type="' + c + '"></li>'; }).join('') +
      '</ul></div>' +
      '<div class="ir-block"><div class="ir-lbl">DISPOSITION</div><div class="ir-boxed" data-type="' + inc.disposition + '"></div></div>' +
      '<div class="ir-stamp" id="ir-stamp">FILED</div>' +
      '<div class="ir-foot">FAILURES ARE NEVER DICE. FAILURES ARE RECEIPTS. — RANGE MASTER’S OFFICE</div>';

    $('incident-overlay').classList.remove('hidden');
    $('incident-overlay').scrollTop = 0;

    // typewriter fill
    var fields = Array.prototype.slice.call(doc.querySelectorAll('[data-type]'));
    var fi = 0;
    function typeNext() {
      if (fi >= fields.length) {
        setTimeout(function () {
          $('ir-stamp').classList.add('stamped');
          PGAudio.stampThud();
        }, 300);
        return;
      }
      var f = fields[fi++];
      var txt = f.getAttribute('data-type');
      f.classList.add('typing');
      var ci = 0;
      var iv = setInterval(function () {
        ci += 2 + ((Math.random() * 2) | 0);
        f.textContent = txt.slice(0, ci);
        PGAudio.typeKey();
        if (ci >= txt.length) {
          f.textContent = txt;
          f.classList.remove('typing');
          clearInterval(iv);
          if (fi === 3) PGAudio.typeDing();
          setTimeout(typeNext, 90);
        }
      }, 28);
    }
    setTimeout(typeNext, 350);
  }

  /* ================= FLOW WIRING ================= */
  function acceptContract() {
    buildBench();
    show('scr-bench');
    toast('Contract accepted. The forecast is on the RFP. Read it twice.');
  }

  function goRange() {
    // final resolution locked in now
    S.result = PG.adjudicate(S.design, S.seed, S.qaSpend);
    var qa = S.design.qa;
    var nothing = !qa.env && qa.mic === 'skip' && !qa.batch.some(function (b, i) { return b && b.tier === S.design.fuse[i]; });
    if (nothing) toast('QA record: none. Noted in the file.');
    Range.enter(S.result);
    show('scr-range');
  }

  function init() {
    // deterministic series for testing / sharing: ?seed=ABCDE
    var sm = (location.search || '').match(/[?&]seed=([A-Za-z0-9]+)/);
    if (sm) S.seed = sm[1].toUpperCase();

    // audio on first gesture
    var boot = function () {
      PGAudio.init();
      document.removeEventListener('pointerdown', boot);
    };
    document.addEventListener('pointerdown', boot);

    $('btn-start').addEventListener('click', function () {
      PGAudio.init(); PGAudio.tap();
      buildRFP(false);
      show('scr-rfp');
    });
    $('btn-accept').addEventListener('click', function () {
      PGAudio.stampThud();
      acceptContract();
    });

    // bench tabs
    $('bench-tabs').querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        PGAudio.click();
        $('bench-tabs').querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
        ['fill', 'casing', 'fuse', 'ledger'].forEach(function (t) {
          $('pane-' + t).classList.toggle('active', t === b.dataset.tab);
        });
        if (b.dataset.tab === 'fill') { sizeTriangle(); refreshBench(); }
      });
    });
    $('btn-toqa').addEventListener('click', function () {
      PGAudio.tap();
      buildQA();
      show('scr-qa');
    });
    $('btn-backbench').addEventListener('click', function () {
      PGAudio.tap();
      buildBench();
      show('scr-bench');
    });
    $('btn-torange').addEventListener('click', function () {
      PGAudio.tap();
      goRange();
    });
    $('btn-incident-close').addEventListener('click', function () {
      PGAudio.tap();
      $('incident-overlay').classList.add('hidden');
    });

    Range.bindControls();
    show('scr-title');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
