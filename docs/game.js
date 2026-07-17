/* ============================================================
   REDSKY INC — game.js
   KSP-style 3D assembly bay + hands-on close-out + Station 7
   range day. three.js r149 (global THREE). All science invented.
   ============================================================ */
'use strict';

(function () {

  /* ================= helpers ================= */
  function $(id) { return document.getElementById(id); }
  function fmt$(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function V3(x, y, z) { return new THREE.Vector3(x, y, z); }

  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, ms || 2600);
  }

  /* ================= state ================= */
  var urlSeed = null, urlContract = 0, urlContractForced = false;
  try {
    var q = new URLSearchParams(location.search);
    urlSeed = q.get('seed');
    var cq = parseInt(q.get('c') || '0', 10);
    if (cq >= 1 && cq <= PG2.CONTRACTS.length) { urlContract = cq - 1; urlContractForced = true; }
    else if (cq > PG2.CONTRACTS.length) {
      // ?c=48 → RFP-048 etc.
      PG2.CONTRACTS.forEach(function (c, i) {
        if (c.id === 'RFP-0' + cq) { urlContract = i; urlContractForced = true; }
      });
    }
  } catch (e) {}
  var S = {
    seed: (urlSeed || PG2.makeSeed()).toUpperCase(),
    phase: 'title',            // title hq board museum rfp build wiring dial det arm truck station counting aftermath crater score
    mode: 'contract',          // 'contract' | 'rnd' — the Workshop's two front doors
    rndTarget: 'truck',        // which object measures you tonight
    contract: urlContract,     // index into PG2.CONTRACTS — the Act I ladder
    attempt: 0,                // tests fired on this contract — worn with pride
    best: PG2.CONTRACTS.map(function () { return null; }),   // per-contract best {stars, net, wonOn}
    assembly: PG2.makeAssembly(),
    result: null,
    closeoutStep: -1
  };
  function rfp() { return S.mode === 'rnd' ? PG2.RND_RFP : PG2.CONTRACTS[S.contract]; }

  /* ================= SETTINGS + SAVE (schema v2 — migrates v1 in place) ================= */
  var SAVE_KEY = 'pg2.save.v1';
  var SETTINGS = { sound: true, skipCine: false, lefty: false };
  var SAVE = {
    contracts: {},                                   // per-contract id: { won, stars, net, wonOn, tests }
    stock: { emberx: 0, emberxs: 0, glaze: 0 },      // the batch ledger — a stocked shelf is a war chest
    museum: { irs: [], firsts: {}, plaques: {} },    // framed disasters, brass firsts, best-crater plaques
    scars: {},                                       // per-contract id: [{x,z,r,e}] — the range remembers
    ui: { drawerCat: 'shells' },                     // the drawer remembers your last category
    paint: null,                                     // the paint locker's finish — ownership persists
    /* M3b — the Workshop */
    cash: 2500,                                      // the company account — R&D runs on it, production feeds it
    banked: {},                                      // per-contract id: development award banked (first win only)
    bench: null,                                     // the R&D workbench assembly, exactly as you left it
    rndTests: 0,                                     // shots fired on the company dime
    rsk: 0,                                          // type-plate counter (RSK-1, RSK-2, …)
    types: [],                                       // certified designs: plate, name, target, grade, band, unitCost…
    run: null,                                       // the active production run, if the workshop is booked
    doneOrders: {}                                   // orders already run — a bid board never repeats itself
  };
  function migrateSave(s) {
    // v1 → v2: everything old is kept; the new rooms start empty.
    if (!s.stock) s.stock = { emberx: 0, emberxs: 0, glaze: 0 };
    if (typeof s.stock.glaze !== 'number') s.stock.glaze = 0;
    if (!s.museum) s.museum = { irs: [], firsts: {}, plaques: {} };
    if (!s.museum.irs) s.museum.irs = [];
    if (!s.museum.firsts) s.museum.firsts = {};
    if (!s.museum.plaques) s.museum.plaques = {};
    if (!s.scars) s.scars = {};
    if (!s.ui) s.ui = { drawerCat: 'shells' };
    if (s.paint === undefined) s.paint = null;
    // v2 → v3: the company gets an account. Every development award you ever
    // banked arrives with it — the Workshop era starts on money you earned.
    if (typeof s.cash !== 'number') {
      s.cash = 2500;
      s.banked = {};
      Object.keys(s.contracts || {}).forEach(function (id) {
        var rec = s.contracts[id];
        if (rec && rec.won && typeof rec.net === 'number' && rec.net > 0) {
          s.cash += rec.net;
          s.banked[id] = rec.net;
        }
      });
    }
    if (!s.banked) s.banked = {};
    if (s.bench === undefined) s.bench = null;
    if (typeof s.rndTests !== 'number') s.rndTests = 0;
    if (typeof s.rsk !== 'number') s.rsk = 0;
    if (!s.types) s.types = [];
    if (s.run === undefined) s.run = null;
    if (!s.doneOrders) s.doneOrders = {};
    s.v = 3;
    return s;
  }
  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      var s = migrateSave(JSON.parse(raw) || {});
      if (s.settings) {
        SETTINGS.sound = s.settings.sound !== false;
        SETTINGS.skipCine = !!s.settings.skipCine;
        SETTINGS.lefty = !!s.settings.lefty;
      }
      if (s.contracts) SAVE.contracts = s.contracts;
      SAVE.stock = s.stock;
      SAVE.museum = s.museum;
      SAVE.scars = s.scars;
      SAVE.ui = s.ui;
      SAVE.paint = s.paint || null;
      SAVE.cash = s.cash;
      SAVE.banked = s.banked;
      SAVE.bench = s.bench;
      SAVE.rndTests = s.rndTests;
      SAVE.rsk = s.rsk;
      SAVE.types = s.types;
      SAVE.run = s.run;
      SAVE.doneOrders = s.doneOrders;
      if (SAVE.ui && SAVE.ui.drawerCat) drawer.cat = SAVE.ui.drawerCat;
    } catch (e) { /* private mode etc — play in-memory */ }
  }
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 3, settings: SETTINGS, contracts: SAVE.contracts,
        stock: SAVE.stock, museum: SAVE.museum, scars: SAVE.scars, ui: SAVE.ui, paint: SAVE.paint,
        cash: SAVE.cash, banked: SAVE.banked, bench: SAVE.bench, rndTests: SAVE.rndTests,
        rsk: SAVE.rsk, types: SAVE.types, run: SAVE.run, doneOrders: SAVE.doneOrders
      }));
    } catch (e) {}
  }
  function wonCountAll() {
    var n = 0;
    PG2.CONTRACTS.forEach(function (c, i) { if (contractRec(i).won) n++; });
    return n;
  }
  function contractRec(idx) {
    var id = PG2.CONTRACTS[idx].id;
    if (!SAVE.contracts[id]) SAVE.contracts[id] = { won: false, stars: 0, net: null, wonOn: null, tests: 0 };
    return SAVE.contracts[id];
  }
  function contractUnlocked(idx) {
    if (idx === 0) return true;
    // grandfather clause: anything you already played (v1 saves) stays open
    var rec = SAVE.contracts[PG2.CONTRACTS[idx].id];
    if (rec && (rec.won || rec.tests > 0)) return true;
    if (urlContractForced && urlContract === idx) return true;
    var after = PG2.CONTRACTS[idx].unlockAfter;   // RFP-066 pins up once SHAPED is won
    if (after) return !!(SAVE.contracts[after] && SAVE.contracts[after].won);
    return contractRec(idx - 1).won;
  }
  /* ---- the batch ledger: refined stock persists across contracts ---- */
  function syncStock() {
    SAVE.stock = JSON.parse(JSON.stringify(S.assembly.refine.stock));
    persist();
  }
  function reclaimRefined() {
    // leaving a contract: the crew unloads refined canisters back onto the shelf
    var a = S.assembly;
    (a.canisters || []).forEach(function (c) {
      if (c && PG2.COMPOUNDS[c] && PG2.COMPOUNDS[c].cost === 0) SAVE.stock[c] = (SAVE.stock[c] || 0) + 1;
    });
    persist();
  }
  /* ---- the museum: framed disasters, brass firsts, best-crater plaques ---- */
  function museumFirst(key, label) {
    if (SAVE.museum.firsts[key]) return;
    SAVE.museum.firsts[key] = { t: Date.now(), label: label };
    persist();
  }
  function museumArchiveIR(r) {
    var inc = r.incident;
    if (!inc) return;
    SAVE.museum.irs.push({
      t: Date.now(), c: inc.contractId || r.rfp.id, seed: r.seed, attempt: S.attempt,
      outcome: inc.outcome, cause: inc.cause, receipt: inc.receipt, where: inc.where,
      phase: inc.phase || null,
      disposition: inc.disposition
    });
    if (SAVE.museum.irs.length > 24) SAVE.museum.irs.splice(1, SAVE.museum.irs.length - 24); // keep the first, trim the middle
    museumFirst('incident', 'FIRST FRAMED DISASTER');
    persist();
  }
  function museumPlaque(r) {
    var id = r.rfp.id;
    var crater = r.outcome.craterActual;
    if (crater == null) return;
    var p = SAVE.museum.plaques[id];
    var mid = (r.rfp.craterMin + r.rfp.craterMax) / 2;
    if (!p || Math.abs(crater - mid) < Math.abs(p.crater - mid)) {
      SAVE.museum.plaques[id] = { crater: crater, stars: r.stars, t: Date.now(), attempt: S.attempt };
      persist();
    }
  }
  function applySettings() {
    PGAudio.setMuted(!SETTINGS.sound);
    document.body.classList.toggle('lefty', SETTINGS.lefty);
  }

  var timers = [];
  function later(ms, fn) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearLater() { timers.forEach(clearTimeout); timers = []; }

  /* tween engine (driven by the raf loop) */
  var tweens = [];
  function tween(dur, fn, done, ease) {
    tweens.push({ t0: performance.now(), dur: dur, fn: fn, done: done, ease: ease || easeInOut });
  }
  function stepTweens(now) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i];
      var t = clamp((now - tw.t0) / tw.dur, 0, 1);
      tw.fn(tw.ease(t), t);
      if (t >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
    }
  }

  /* ================= three.js core ================= */
  var renderer, bay, range, W = 390, H = 700;
  var canvas = $('gl');

  function initGL() {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    size();
    window.addEventListener('resize', size);
  }
  function size() {
    var r = $('app').getBoundingClientRect();
    W = Math.max(300, r.width); H = Math.max(400, r.height);
    renderer.setSize(W, H, false);
    if (bay) { bay.camera.aspect = W / H; bay.camera.updateProjectionMatrix(); }
    if (range) { range.camera.aspect = W / H; range.camera.updateProjectionMatrix(); }
  }

  function gradientTexture(stops, vertical) {
    var c = document.createElement('canvas');
    c.width = vertical ? 2 : 256; c.height = vertical ? 256 : 2;
    var x = c.getContext('2d');
    var g = vertical ? x.createLinearGradient(0, 0, 0, 256) : x.createLinearGradient(0, 0, 256, 0);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    x.fillStyle = g;
    x.fillRect(0, 0, c.width, c.height);
    var tx = new THREE.CanvasTexture(c);
    tx.encoding = THREE.sRGBEncoding;
    return tx;
  }
  function mat(color, opts) {
    opts = opts || {};
    var m = new THREE.MeshPhongMaterial({
      color: color, flatShading: opts.flat !== false,
      shininess: opts.shin != null ? opts.shin : 18,
      specular: 0x333333
    });
    if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.ei || 1; }
    if (opts.transparent) { m.transparent = true; m.opacity = opts.opacity != null ? opts.opacity : 0.5; }
    return m;
  }
  function textPlane(txt, w, h, opts) {
    opts = opts || {};
    var c = document.createElement('canvas');
    c.width = 256; c.height = Math.round(256 * h / w);
    var x = c.getContext('2d');
    if (opts.bg) { x.fillStyle = opts.bg; x.fillRect(0, 0, c.width, c.height); }
    x.fillStyle = opts.color || '#e8ddc0';
    var px = opts.px || 64;
    x.font = '700 ' + px + 'px Menlo, monospace';
    var tw = x.measureText(txt).width;
    if (tw > c.width * 0.94) {
      px = Math.floor(px * c.width * 0.94 / tw);
      x.font = '700 ' + px + 'px Menlo, monospace';
    }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(txt, c.width / 2, c.height / 2 + 2);
    var tx = new THREE.CanvasTexture(c);
    tx.encoding = THREE.sRGBEncoding;
    var m = new THREE.MeshBasicMaterial({ map: tx, transparent: true });
    var p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    return p;
  }
  function worldToScreen(v, camera) {
    var p = v.clone().project(camera);
    return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, z: p.z };
  }

  /* ================= PART GEOMETRY (low-poly, flat-shaded) ================= */
  var COL = {
    steel: 0x8fa2b3, steelDark: 0x5c6b7a, nose: 0xb0392b, brass: 0xc9a24b,
    amber: 0xe5a13d, blue: 0x4d8fd1, batt: 0x3d5c46, det: 0xd6d9dd,
    fin: 0x74838f, panel: 0x424d57, wireR: 0xd9402e, wireY: 0xe0b52e, wireG: 0x3d9e57
  };
  function casingDims(id) {
    return { compact: { L: 1.5, r: 0.34 }, standard: { L: 2.1, r: 0.42 }, heavy: { L: 2.7, r: 0.5 },
             thinwall: { L: 2.1, r: 0.40 }, segmented: { L: 2.2, r: 0.44 } }[id];
  }
  /* the paint locker's finish — cosmetic, zero mechanics */
  function bodyColor() {
    var hex = COL.steel;
    PG2.PAINTS.forEach(function (p) { if (p.id === S.assembly.paint && p.hex) hex = p.hex; });
    return hex;
  }
  function slotXs(id) {
    var d = casingDims(id), n = PG2.SHELLS[id].slots;
    var span = d.L * 0.52, xs = [];
    for (var i = 0; i < n; i++) xs.push(n === 1 ? 0 : -span / 2 + span * i / (n - 1));
    return xs;
  }
  function wellX(id) { return casingDims(id).L * 0.395; }

  function buildCasing(id) {
    var d = casingDims(id);
    var g = new THREE.Group();
    var skin = id === 'thinwall' ? 0xa6b5c2 : bodyColor();
    var body = new THREE.Mesh(new THREE.CylinderGeometry(d.r, d.r, d.L, 20, 1, false), mat(skin));
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    g.add(body);
    if (id === 'segmented') {
      // machine-scored frag squares: rings + longitudinal scoring
      for (var ri = -2; ri <= 2; ri++) {
        var score = new THREE.Mesh(new THREE.TorusGeometry(d.r + 0.004, 0.008, 6, 26), mat(0x39434c, { shin: 4 }));
        score.rotation.y = Math.PI / 2;
        score.position.x = ri * d.L * 0.17;
        g.add(score);
      }
      for (var li = 0; li < 8; li++) {
        var strip = new THREE.Mesh(new THREE.BoxGeometry(d.L * 0.86, 0.014, 0.014), mat(0x39434c, { shin: 4 }));
        var ang = li * Math.PI / 4 + Math.PI / 8;
        strip.position.set(0, Math.cos(ang) * (d.r + 0.004), Math.sin(ang) * (d.r + 0.004));
        strip.rotation.x = -ang;
        g.add(strip);
      }
    }
    if (id === 'thinwall') {
      for (var wi = -1; wi <= 1; wi++) {   // stiffening ribs — it needs them
        var rib = new THREE.Mesh(new THREE.TorusGeometry(d.r + 0.008, 0.012, 6, 22), mat(0x77899a));
        rib.rotation.y = Math.PI / 2;
        rib.position.x = wi * d.L * 0.3;
        g.add(rib);
      }
    }
    [-1, 1].forEach(function (s) {
      var dome = new THREE.Mesh(new THREE.SphereGeometry(d.r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(skin));
      dome.rotation.z = s * -Math.PI / 2;
      dome.position.x = s * d.L / 2;
      dome.castShadow = true;
      g.add(dome);
    });
    // painted nose band
    var band = new THREE.Mesh(new THREE.CylinderGeometry(d.r + 0.006, d.r + 0.006, 0.1, 20), mat(COL.nose));
    band.rotation.z = Math.PI / 2;
    band.position.x = d.L / 2 - 0.10;
    g.add(band);
    // stencil
    var st = textPlane({ thinwall: 'RD-047T', segmented: 'RD-051F', compact: 'RD-045', heavy: 'RD-049' }[id] || 'RD-047',
      0.6, 0.18, { color: '#2e2b26', px: 72 });
    st.position.set(-d.L * 0.12, -0.02, d.r + 0.005);
    g.add(st);
    // slot rims + dark bores
    slotXs(id).forEach(function (x, i) {
      var rim = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.022, 8, 18), mat(COL.steelDark));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, d.r - 0.01, 0);
      rim.userData.slotRim = i;
      g.add(rim);
      var bore = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.16, 14), mat(0x1a222b, { shin: 4 }));
      bore.position.set(x, d.r - 0.09, 0);
      g.add(bore);
    });
    // detonator well boss (top, near nose)
    var wx = wellX(id);
    var boss = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.12, 12), mat(COL.steelDark));
    boss.position.set(wx, d.r + 0.02, 0);
    g.add(boss);
    var bore2 = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.1, 10), mat(0x14181d, { shin: 2 }));
    bore2.position.set(wx, d.r + 0.04, 0);
    g.add(bore2);
    // access panel recess (front +Z, center)
    var frame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.05), mat(COL.steelDark));
    frame.position.set(0, 0.02, d.r - 0.05);
    g.add(frame);
    var recess = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.06), mat(0x232b33, { shin: 4 }));
    recess.position.set(0, 0.02, d.r - 0.04);
    g.add(recess);
    // door (hinged at top) — pivot group
    var doorPivot = new THREE.Group();
    doorPivot.position.set(0, 0.19, d.r + 0.015);
    var door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.022), mat(skin));
    door.position.y = -0.17;
    doorPivot.add(door);
    [-0.21, 0.21].forEach(function (dx) {
      [-0.31, -0.03].forEach(function (dy) {
        var screw = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 8), mat(COL.brass, { shin: 60 }));
        screw.rotation.x = Math.PI / 2;
        screw.position.set(dx, dy, 0.012);
        doorPivot.add(screw);
      });
    });
    g.add(doorPivot);
    g.userData.doorPivot = doorPivot;
    g.userData.dims = d;
    return g;
  }
  function buildCanister(comp) {
    var g = new THREE.Group();
    var HUES = { ember: COL.amber, frost: COL.blue, emberx: 0xff7a2e, emberxs: 0x7a5030, glaze: 0x8f6fd8,
                 trimcell: COL.amber, densepack: 0xcf7a2a, ballast: 0x6d7a85 };
    var hue = HUES[comp] || COL.amber;
    var glow = comp === 'emberx' ? 0.5 : comp === 'emberxs' ? 0.08 : comp === 'glaze' ? 0.35
             : comp === 'ballast' ? 0 : comp === 'densepack' ? 0.14 : 0.22;
    // quarter-size trim cells; stout dense-pack; plain certified sand
    var dm = comp === 'trimcell' ? { r: 0.085, h: 0.15, band: 0.05, topY: 0.075, valveY: 0.14 }
           : comp === 'densepack' ? { r: 0.13, h: 0.24, band: 0.1, topY: 0.12, valveY: 0.22 }
           : { r: 0.115, h: 0.26, band: 0.09, topY: 0.13, valveY: 0.24 };
    var bodyCol = comp === 'densepack' ? 0x4b5157 : comp === 'ballast' ? 0x9aa1a7 : 0xb9c2c9;
    var body = new THREE.Mesh(new THREE.CylinderGeometry(dm.r, dm.r, dm.h, 14), mat(bodyCol));
    body.castShadow = true;
    g.add(body);
    var band = new THREE.Mesh(new THREE.CylinderGeometry(dm.r + 0.003, dm.r + 0.003, dm.band, 14),
      glow > 0 ? mat(hue, { emissive: hue, ei: glow }) : mat(hue));
    band.position.y = 0.02;
    g.add(band);
    var top = new THREE.Mesh(new THREE.SphereGeometry(dm.r, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(comp === 'ballast' ? bodyCol : hue));
    top.position.y = dm.topY;
    g.add(top);
    if (comp === 'densepack') {   // pressed fill: hex bolts around the crown
      for (var bi = 0; bi < 6; bi++) {
        var bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 6), mat(COL.brass, { shin: 50 }));
        var ba = bi * Math.PI / 3;
        bolt.position.set(Math.cos(ba) * dm.r * 0.7, dm.topY + 0.02, Math.sin(ba) * dm.r * 0.7);
        g.add(bolt);
      }
    }
    if (comp !== 'ballast') {
      var valve = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), mat(COL.brass, { shin: 60 }));
      valve.position.y = dm.valveY;
      g.add(valve);
    }
    // stockroom stencil: designation + seeded lot number, painted on the can
    var def = PG2.COMPOUNDS[comp];
    if (def && def.stencil) {
      var sc2 = dm.r / 0.115;
      var st = textPlane(def.stencil, 0.16 * sc2, 0.062 * sc2, { color: '#241f18', px: 76 });
      st.position.set(0, -0.035 * sc2, dm.r + 0.002);
      g.add(st);
      var lot = textPlane(PG2.lotNumber(S.seed, comp), 0.17 * sc2, 0.045 * sc2, { color: '#3a332a', px: 46 });
      lot.position.set(0, -0.095 * sc2, dm.r + 0.002);
      g.add(lot);
    }
    return g;
  }
  function buildTimer() {
    var g = new THREE.Group();
    var cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.4, 14), mat(COL.steelDark));
    cone.rotation.z = -Math.PI / 2;
    cone.position.x = 0.2;
    cone.castShadow = true;
    g.add(cone);
    var ring = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.07, 14), mat(COL.amber, { emissive: COL.amber, ei: 0.25 }));
    ring.rotation.z = Math.PI / 2;
    ring.position.x = 0.02;
    g.add(ring);
    var dial = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 12), mat(0xf1e9d3, { shin: 50 }));
    dial.rotation.x = Math.PI / 2;
    dial.position.set(0.16, 0.13, 0.12);
    dial.rotation.z = 0.5;
    g.add(dial);
    return g;
  }
  function buildBattery() {
    var g = new THREE.Group();
    var box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.26), mat(COL.batt));
    box.castShadow = true;
    g.add(box);
    [-0.06, 0.06].forEach(function (dz, i) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 8), mat(i ? COL.brass : 0xb0b6bb, { shin: 70 }));
      post.position.set(-0.08, 0.15, dz);
      g.add(post);
    });
    var lbl = textPlane('DC-9', 0.2, 0.09, { color: '#e8ddc0', px: 80 });
    lbl.position.set(0, 0, 0.135);
    g.add(lbl);
    return g;
  }
  function buildCap() {
    var g = new THREE.Group();
    var dome = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), mat(COL.nose));
    dome.castShadow = true;
    g.add(dome);
    var lip = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 14), mat(COL.steelDark));
    lip.position.y = -0.005;
    g.add(lip);
    return g;
  }
  function buildFins() {
    var g = new THREE.Group();
    var shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(0.34, -0.04); shape.lineTo(0.34, -0.26); shape.lineTo(0.06, -0.18); shape.lineTo(0, -0.16); shape.closePath();
    var geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
    for (var i = 0; i < 4; i++) {
      var f = new THREE.Mesh(geo, mat(COL.fin));
      f.castShadow = true;
      var hold = new THREE.Group();
      f.rotation.y = Math.PI / 2;
      f.position.z = -0.01;
      hold.add(f);
      hold.rotation.x = i * Math.PI / 2 + Math.PI / 4;
      g.add(hold);
    }
    return g;
  }
  function buildArmPanel() {
    var g = new THREE.Group();
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.07), mat(COL.panel));
    base.castShadow = true;
    g.add(base);
    // guard cover (hinged at top)
    var coverPivot = new THREE.Group();
    coverPivot.position.set(-0.045, 0.1, 0.045);
    var cover = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.016), mat(COL.amber, { transparent: true, opacity: 0.82, shin: 70 }));
    cover.position.y = -0.085;
    coverPivot.add(cover);
    g.add(coverPivot);
    g.userData.coverPivot = coverPivot;
    // switch lever
    var leverPivot = new THREE.Group();
    leverPivot.position.set(-0.045, -0.02, 0.038);
    var lever = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.03), mat(0xd8dde2, { shin: 60 }));
    lever.position.y = -0.04;
    leverPivot.add(lever);
    leverPivot.rotation.x = -0.5;
    g.add(leverPivot);
    g.userData.leverPivot = leverPivot;
    // LED
    var led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), mat(0x431410, { emissive: 0x000000 }));
    led.position.set(0.075, 0.05, 0.04);
    g.add(led);
    g.userData.led = led;
    var lbl = textPlane('ARM', 0.09, 0.045, { color: '#f0d9a8', px: 90 });
    lbl.position.set(0.075, -0.03, 0.037);
    g.add(lbl);
    return g;
  }
  function buildDetonator() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 12), mat(COL.det, { shin: 70 }));
    body.castShadow = true;
    g.add(body);
    var tip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.05, 12), mat(COL.nose));
    tip.position.y = -0.15;
    g.add(tip);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), mat(COL.brass, { shin: 70 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    g.add(ring);
    return g;
  }
  function buildBatteryL() {
    var g = new THREE.Group();
    var box = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.3), mat(0x33503e));
    box.castShadow = true;
    g.add(box);
    [-0.1, 0, 0.1].forEach(function (dz, i) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 8),
        mat(i === 2 ? 0x8a929a : i ? COL.brass : 0xb0b6bb, { shin: 70 }));
      post.position.set(-0.1, 0.17, dz);
      g.add(post);
    });
    var strap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.05), mat(0x22303c));
    strap.position.y = 0.12;
    g.add(strap);
    var lbl = textPlane('DC-12 L · AUX', 0.26, 0.08, { color: '#e8ddc0', px: 70 });
    lbl.position.set(0, 0, 0.155);
    g.add(lbl);
    return g;
  }
  function buildHarness() {
    var g = new THREE.Group();
    var coil = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.032, 8, 20), mat(0x2c3238, { shin: 30 }));
    coil.rotation.x = Math.PI / 2;
    g.add(coil);
    var braid = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.036, 8, 20, Math.PI * 1.2), mat(0x5a6672, { shin: 45 }));
    braid.rotation.x = Math.PI / 2;
    g.add(braid);
    [-0.09, 0.09].forEach(function (dx) {
      var clipM = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.07), mat(COL.brass, { shin: 60 }));
      clipM.position.set(dx, 0.01, 0);
      g.add(clipM);
    });
    return g;
  }
  function buildDelayRelay() {
    var g = new THREE.Group();
    var box = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.1), mat(0x4a3527, { shin: 40 }));
    box.castShadow = true;
    g.add(box);
    var can = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.07, 10), mat(0xb9c2c9, { shin: 60 }));
    can.position.set(0.04, 0.09, 0);
    g.add(can);
    var lbl = textPlane('K-DLY +0.5s', 0.15, 0.05, { color: '#f0d9a8', px: 60 });
    lbl.position.set(0, -0.01, 0.055);
    g.add(lbl);
    return g;
  }
  function buildImpactFuze() {
    var g = new THREE.Group();
    var cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.44, 14), mat(COL.nose));
    cone.rotation.z = -Math.PI / 2;
    cone.position.x = 0.2;
    cone.castShadow = true;
    g.add(cone);
    var pin = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.02, 0.14, 8), mat(0xd8dde2, { shin: 80 }));
    pin.rotation.z = -Math.PI / 2;
    pin.position.x = 0.46;
    g.add(pin);
    var ring = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.06, 14), mat(0xd8dde2, { shin: 50 }));
    ring.rotation.z = Math.PI / 2;
    ring.position.x = 0.0;
    g.add(ring);
    var lbl = textPlane('NF-1', 0.14, 0.06, { color: '#f3ede0', px: 80 });
    lbl.position.set(0.14, 0.1, 0.14);
    lbl.rotation.y = 0.35;
    g.add(lbl);
    return g;
  }
  function buildPaintTin() {
    var g = new THREE.Group();
    var tin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 16), mat(0x777f83, { shin: 40 }));
    tin.castShadow = true;
    g.add(tin);
    var lid = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.02, 16), mat(0x9aa1a7, { shin: 60 }));
    lid.position.y = 0.12;
    g.add(lid);
    var handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 16, Math.PI), mat(0xb9c2c9, { shin: 70 }));
    handle.position.y = 0.13;
    g.add(handle);
    var drip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(0x8a4a34));
    drip.position.set(0.12, 0.11, 0.05);
    g.add(drip);
    var lbl = textPlane('GG No.2', 0.2, 0.07, { color: '#241f18', px: 64 });
    lbl.position.set(0, 0, 0.162);
    g.add(lbl);
    return g;
  }
  function partBuilder(id) {
    if (PG2.SHELLS[id]) return buildCasing(id);
    if (PG2.COMPOUNDS[id]) return buildCanister(id);
    if (id === 'timer') return buildTimer();
    if (id === 'battery') return buildBattery();
    if (id === 'batteryl') return buildBatteryL();
    if (id === 'harness') return buildHarness();
    if (id === 'delayrelay') return buildDelayRelay();
    if (id === 'impactfuze') return buildImpactFuze();
    if (id === 'paintlocker') return buildPaintTin();
    if (id === 'cap') return buildCap();
    if (id === 'fins') return buildFins();
    if (id === 'panel') return buildArmPanel();
    return buildDetonator();
  }

  /* ================= BAY SCENE ================= */
  function initBay() {
    var scene = new THREE.Scene();
    scene.background = gradientTexture([[0, '#152c44'], [0.55, '#0d1f33'], [1, '#091421']], true);
    scene.fog = new THREE.Fog(0x0b1c2e, 12, 30);

    var camera = new THREE.PerspectiveCamera(42, W / H, 0.05, 60);

    var hemi = new THREE.HemisphereLight(0xbcd6ee, 0x2a2118, 0.75);
    scene.add(hemi);
    var key = new THREE.DirectionalLight(0xfff1dc, 0.95);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4; key.shadow.camera.right = 4;
    key.shadow.camera.top = 5; key.shadow.camera.bottom = -2;
    key.shadow.camera.far = 22;
    key.shadow.radius = 4;
    scene.add(key);
    var rim = new THREE.DirectionalLight(0x9cc8ea, 0.3);
    rim.position.set(-5, 3, -4);
    scene.add(rim);

    // floor: radial glow + grid, canvas texture — also the chalk diary of your attempts
    var fc = document.createElement('canvas');
    fc.width = fc.height = 512;
    var fx = fc.getContext('2d');
    function drawFloorBase() {
      fx.fillStyle = '#0a1826';
      fx.fillRect(0, 0, 512, 512);
      var fg2 = fx.createRadialGradient(256, 256, 30, 256, 256, 250);
      fg2.addColorStop(0, '#22405e');
      fg2.addColorStop(1, '#0a1826');
      fx.fillStyle = fg2;
      fx.fillRect(0, 0, 512, 512);
      fx.strokeStyle = 'rgba(140,190,235,.16)';
      fx.lineWidth = 1;
      for (var i = 0; i <= 16; i++) {
        fx.beginPath(); fx.moveTo(i * 32, 0); fx.lineTo(i * 32, 512); fx.stroke();
        fx.beginPath(); fx.moveTo(0, i * 32); fx.lineTo(512, i * 32); fx.stroke();
      }
    }
    drawFloorBase();
    var ftx = new THREE.CanvasTexture(fc);
    ftx.encoding = THREE.sRGBEncoding;
    var floor = new THREE.Mesh(new THREE.CircleGeometry(11, 40),
      new THREE.MeshPhongMaterial({ map: ftx, shininess: 8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    // chalk tallies + (after test #3) a coffee ring — the bay keeps score
    function repaintFloor(tests) {
      drawFloorBase();
      var n = Math.min(tests || 0, 40);
      var jr = PG2.stream('BAY', 'chalk');
      fx.lineCap = 'round';
      for (var i = 0; i < n; i++) {
        var group = Math.floor(i / 5), inGroup = i % 5;
        // the engineer's corner: tallies chalked by the clipboard, front-left of the stand
        var gx = 205 + (group % 3) * 42, gy = 286 + Math.floor(group / 3) * 30;
        fx.save();
        fx.translate(gx, gy);
        fx.rotate((jr() - 0.5) * 0.14 + 0.22);
        fx.strokeStyle = 'rgba(228,238,248,' + (0.6 + jr() * 0.2).toFixed(2) + ')';
        fx.lineWidth = 3.6;
        fx.lineCap = 'round';
        fx.beginPath();
        if (inGroup < 4) {
          var x0 = inGroup * 9 + (jr() - 0.5) * 2;
          fx.moveTo(x0, (jr() - 0.5) * 2);
          fx.lineTo(x0 + (jr() - 0.5) * 4, 22 + (jr() - 0.5) * 3);
        } else {
          fx.moveTo(-5, 17 + (jr() - 0.5) * 2);
          fx.lineTo(34, 4 + (jr() - 0.5) * 2);
        }
        fx.stroke();
        fx.restore();
      }
      if ((tests || 0) >= 3) {   // somebody's been living out here
        fx.strokeStyle = 'rgba(158,96,46,.6)';
        fx.lineWidth = 5.5;
        fx.beginPath();
        fx.arc(176, 330, 14, 0.4, Math.PI * 2.1);
        fx.stroke();
        fx.strokeStyle = 'rgba(158,96,46,.3)';
        fx.lineWidth = 4;
        fx.beginPath();
        fx.arc(181, 326, 14, 1.2, Math.PI * 1.7);
        fx.stroke();
      }
      ftx.needsUpdate = true;
    }
    // clipboard by the stand (appears after test #3, with the coffee)
    var clip = new THREE.Group();
    var board = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.016, 0.46), mat(0x6b4a2a, { shin: 6 }));
    board.position.y = 0.01;
    clip.add(board);
    var paper = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.006, 0.4), mat(0xe8dfc8, { shin: 4 }));
    paper.position.y = 0.022;
    clip.add(paper);
    var clipbar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.05), mat(0x8f9aa5, { shin: 60 }));
    clipbar.position.set(0, 0.03, -0.19);
    clip.add(clipbar);
    var scrawl = textPlane('IR-3 · IR-3 · IR-3', 0.24, 0.06, { color: '#57503f', px: 40 });
    scrawl.rotation.x = -Math.PI / 2;
    scrawl.position.set(0, 0.028, 0.02);
    clip.add(scrawl);
    clip.position.set(-1.55, 0.02, 1.62);
    clip.rotation.y = 0.7;
    clip.visible = false;
    scene.add(clip);
    // work-light rig — quietly scoots around to look over your shoulder
    var rig = new THREE.Group();
    var tripod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.15, 8), mat(0x2f3b46));
    tripod.position.y = 1.07;
    rig.add(tripod);
    var feet = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.05, 10), mat(0x22303c));
    feet.position.y = 0.03;
    rig.add(feet);
    var head = new THREE.Group();
    head.position.y = 2.12;
    var hood = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.23, 0.26, 10), mat(0x3a4c5d));
    hood.rotation.x = Math.PI / 2;
    head.add(hood);
    var lens = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff2d0 }));
    lens.position.z = 0.14;
    head.add(lens);
    rig.add(head);
    var wspot = new THREE.SpotLight(0xffe9c4, 0.55, 11, 0.55, 0.6, 1.2);
    wspot.position.set(0, 2.12, 0.1);
    rig.add(wspot);
    var wtarget = new THREE.Object3D();
    scene.add(wtarget);
    wtarget.position.set(0, 1.3, 0);
    wspot.target = wtarget;
    rig.userData.angle = 2.3;
    rig.userData.head = head;
    scene.add(rig);

    // work stand
    var stand = new THREE.Group();
    var base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.16, 24), mat(0x2c3b49));
    base.position.y = 0.08; base.castShadow = true; base.receiveShadow = true;
    stand.add(base);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.02, 8, 40), mat(COL.amber, { emissive: COL.amber, ei: 0.35 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.17;
    stand.add(ring);
    var col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.72, 12), mat(0x3a4c5d));
    col.position.y = 0.52; col.castShadow = true;
    stand.add(col);
    [-0.5, 0.5].forEach(function (x) {
      var arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.5), mat(0x3a4c5d));
      arm.position.set(x, 1.0, 0);
      arm.castShadow = true;
      stand.add(arm);
      [-1, 1].forEach(function (sz) {
        var pad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.08), mat(0x22303c));
        pad.position.set(x, 1.12, sz * 0.2);
        pad.rotation.x = sz * -0.5;
        stand.add(pad);
      });
    });
    scene.add(stand);

    var device = new THREE.Group();
    device.position.set(0, 1.32, 0);
    scene.add(device);

    var nodeGroup = new THREE.Group();  // snap node markers
    device.add(nodeGroup);

    var orbit = { theta: 0.7, phi: 1.18, radius: 4.4, target: V3(0, 1.25, 0) };

    return {
      scene: scene, camera: camera, device: device, stand: stand, nodeGroup: nodeGroup,
      orbit: orbit, spin: 0, lastTouch: 0,
      dip: 0, dipV: 0,                       // work stand suspension
      velTheta: 0, velPhi: 0, velFresh: 0,   // inertial orbit
      repaintFloor: repaintFloor, clipboard: clip, worklight: rig, floorCanvas: fc,
      wiring: null, detStage: null, armStage: null
    };
  }
  function bayCam() {
    var o = bay.orbit;
    var c = bay.camera;
    c.position.set(
      o.target.x + o.radius * Math.sin(o.phi) * Math.sin(o.theta),
      o.target.y + o.radius * Math.cos(o.phi),
      o.target.z + o.radius * Math.sin(o.phi) * Math.cos(o.theta)
    );
    c.lookAt(o.target);
  }

  /* ---------- snap nodes ---------- */
  function nodeList() {
    var a = S.assembly, nodes = [];
    if (!a.shell) {
      nodes.push({ id: 'stand', pos: V3(0, 0, 0), accepts: Object.keys(PG2.SHELLS) });
      return nodes;
    }
    var d = casingDims(a.shell);
    slotXs(a.shell).forEach(function (x, i) {
      if (!a.canisters[i]) nodes.push({ id: 'slot' + i, pos: V3(x, d.r + 0.1, 0), accepts: Object.keys(PG2.COMPOUNDS), slot: i });
    });
    if (!a.timer && !a.impactfuze) nodes.push({ id: 'nose', pos: V3(d.L / 2 + 0.05, 0, 0), accepts: ['timer', 'impactfuze'] });
    if (!a.battery && !a.batteryl) nodes.push({ id: 'tail', pos: V3(-d.L / 2 - 0.18, 0, 0), accepts: ['battery', 'batteryl'] });
    if (!a.cap) nodes.push({ id: 'well', pos: V3(wellX(a.shell), d.r + 0.12, 0), accepts: ['cap'] });
    if (!a.fins) nodes.push({ id: 'finring', pos: V3(-d.L / 2 + 0.3, 0, 0), accepts: ['fins'] });
    if (!a.panel) nodes.push({ id: 'side', pos: V3(-d.L * 0.31, 0.05, d.r + 0.02), accepts: ['panel'] });
    if (!a.delayrelay) nodes.push({ id: 'relaymount', pos: V3(d.L * 0.28, -0.13, d.r - 0.02), accepts: ['delayrelay'] });
    if (!a.harness) nodes.push({ id: 'harnessmount', pos: V3(-d.L * 0.05, -d.r - 0.04, 0), accepts: ['harness'] });
    return nodes;
  }
  function nodePose(nodeId, partId) {
    // local position+rotation a part takes when snapped at a node
    var a = S.assembly;
    var d = a.shell ? casingDims(a.shell) : null;
    if (nodeId === 'stand') return { pos: V3(0, 0, 0), rot: V3(0, 0, 0) };
    if (/^slot/.test(nodeId)) {
      var i = parseInt(nodeId.slice(4), 10);
      return { pos: V3(slotXs(a.shell)[i], d.r + 0.04, 0), rot: V3(0, 0, 0) };
    }
    if (nodeId === 'nose') return { pos: V3(d.L / 2 + 0.02, 0, 0), rot: V3(0, 0, 0) };
    if (nodeId === 'tail') return { pos: V3(-d.L / 2 - 0.16, 0, 0), rot: V3(0, 0, 0) };
    if (nodeId === 'well') return { pos: V3(wellX(a.shell), d.r + 0.055, 0), rot: V3(0, 0, 0) };
    if (nodeId === 'finring') return { pos: V3(-d.L / 2 + 0.28, 0, 0), rot: V3(0, 0, 0) };
    if (nodeId === 'side') return { pos: V3(-d.L * 0.31, 0.05, d.r + 0.02), rot: V3(0, 0, 0) };
    if (nodeId === 'relaymount') return { pos: V3(d.L * 0.28, -0.13, d.r - 0.02), rot: V3(0, 0, 0) };
    if (nodeId === 'harnessmount') return { pos: V3(-d.L * 0.05, -d.r - 0.02, 0), rot: V3(0, 0, 0) };
    return { pos: V3(0, 0, 0), rot: V3(0, 0, 0) };
  }

  /* ---------- device (re)build from assembly ---------- */
  var placedMeshes = [];
  function rebuildDevice() {
    var dev = bay.device;
    // clear everything except nodeGroup (and the CoM whisper)
    for (var i = dev.children.length - 1; i >= 0; i--) {
      if (dev.children[i] !== bay.nodeGroup && dev.children[i] !== bay.comMarker) dev.remove(dev.children[i]);
    }
    placedMeshes = [];
    bay.casingMesh = null;
    bay.capPivot = null;
    bay.armPanelMesh = null;
    var a = S.assembly;
    if (!a.shell) { refreshNodes(null); return; }
    var cas = buildCasing(a.shell);
    cas.userData.remove = { kind: 'shell' };
    tagMeshes(cas);
    dev.add(cas);
    bay.casingMesh = cas;
    var d = casingDims(a.shell);
    a.canisters.forEach(function (c, i) {
      if (!c) return;
      var m = buildCanister(c);
      var p = nodePose('slot' + i, c);
      m.position.copy(p.pos);
      m.userData.remove = { kind: 'canister', slot: i };
      tagMeshes(m);
      dev.add(m);
    });
    if (a.timer) addPart(buildTimer(), 'nose', { kind: 'timer' });
    if (a.impactfuze) addPart(buildImpactFuze(), 'nose', { kind: 'impactfuze' });
    if (a.battery) addPart(buildBattery(), 'tail', { kind: 'battery' });
    if (a.batteryl) addPart(buildBatteryL(), 'tail', { kind: 'batteryl' });
    if (a.delayrelay) addPart(buildDelayRelay(), 'relaymount', { kind: 'delayrelay' });
    if (a.harness) addPart(buildHarness(), 'harnessmount', { kind: 'harness' });
    if (a.cap) {
      var capPivot = new THREE.Group();
      var pp = nodePose('well');
      capPivot.position.copy(pp.pos);
      var capM = buildCap();
      capM.position.set(0, 0, 0);
      capPivot.add(capM);
      capPivot.userData.remove = { kind: 'cap' };
      tagMeshes(capPivot);
      dev.add(capPivot);
      bay.capPivot = capPivot;
    }
    if (a.fins) addPart(buildFins(), 'finring', { kind: 'fins' });
    if (a.panel) {
      var pm = buildArmPanel();
      var pq = nodePose('side');
      pm.position.copy(pq.pos);
      pm.userData.remove = { kind: 'panel' };
      if (a.armed) {
        pm.userData.leverPivot.rotation.x = 0.6;
        pm.userData.led.material.emissive.setHex(0xff2f1e);
        pm.userData.led.material.emissiveIntensity = 1.4;
        pm.userData.led.material.color.setHex(0xff5040);
      }
      tagMeshes(pm);
      dev.add(pm);
      bay.armPanelMesh = pm;
    }
    refreshNodes(null);
  }
  function addPart(mesh, nodeId, removeInfo) {
    var p = nodePose(nodeId);
    mesh.position.copy(p.pos);
    mesh.userData.remove = removeInfo;
    tagMeshes(mesh);
    bay.device.add(mesh);
  }
  function tagMeshes(root) {
    root.traverse(function (m) { if (m.isMesh) { m.userData.rootPart = root; placedMeshes.push(m); } });
  }

  /* ---------- snap node markers ---------- */
  var nodeMarkers = [];
  function refreshNodes(draggingPart) {
    var ng = bay.nodeGroup;
    for (var i = ng.children.length - 1; i >= 0; i--) ng.remove(ng.children[i]);
    nodeMarkers = [];
    if (!draggingPart) return;
    // wrong-category nodes never light — only nodes that accept this part exist at all
    nodeList().forEach(function (n) {
      if (n.accepts.indexOf(draggingPart) < 0) return;
      var mk = new THREE.Group();
      var s = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8),
        mat(0x53e07f, { emissive: 0x2fd465, ei: 0.4, transparent: true, opacity: 0.4 }));
      mk.add(s);
      var r = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 20),
        mat(0x53e07f, { emissive: 0x2fd465, ei: 0.7, transparent: true, opacity: 0.2 }));
      r.rotation.x = Math.PI / 2;
      mk.add(r);
      mk.position.copy(n.pos);
      mk.userData = { node: n, sphere: s, ring: r, prox: 0 };
      ng.add(mk);
      nodeMarkers.push(mk);
    });
  }

  /* ================= THE PARTS DRAWER (M3a) =================
     The bottom scroll strip is retired. Parts live in a KSP-style
     slide-out drawer on the thumb edge: category tabs down the spine,
     a 2-column grid per tab, spring slide, auto-collapse on grab.
     Locked parts show as dark silhouettes — the catalog is the
     progression brochure. Mirrors under the left-handed setting. */
  var ALL_PART_IDS = ['compact', 'standard', 'heavy', 'thinwall', 'segmented',
                      'ember', 'frost', 'emberx', 'emberxs', 'glaze', 'trimcell', 'densepack', 'ballast',
                      'timer', 'battery', 'batteryl', 'harness', 'delayrelay', 'impactfuze',
                      'cap', 'panel', 'fins', 'paintlocker'];
  var DRAWER_CATS = [
    { id: 'shells',   name: 'SHELLS' },
    { id: 'payload',  name: 'PAYLOAD' },
    { id: 'fuzing',   name: 'FUZING' },
    { id: 'power',    name: 'POWER' },
    { id: 'trim',     name: 'TRIM' },
    { id: 'guidance', name: 'GUIDANCE', sealed: 'SEALED — ACT II' }   // the tease
  ];
  /* the catalog: category, one effect line, unlock contract (locked = silhouette) */
  var CATALOG = [
    { id: 'compact',  cat: 'shells',  name: 'SMALL SHELL',    fx: '2 BAYS · EASILY OVERWHELMED', group: 'shell' },
    { id: 'standard', cat: 'shells',  name: 'STANDARD SHELL', fx: '4 BAYS · THE SENSIBLE ONE',   group: 'shell' },
    { id: 'heavy',    cat: 'shells',  name: 'BIG SHELL',      fx: '6 BAYS · VAULT-PATIENT',      group: 'shell' },
    { id: 'thinwall', cat: 'shells',  name: 'THIN-WALL SHELL', fx: '4 BAYS · LIGHT & FRAGILE',   group: 'shell', unlock: 'RFP-048' },
    { id: 'segmented', cat: 'shells', name: 'SEGMENTED CASING', fx: '4 BAYS · SCORED FRAG SPRAY', group: 'shell', unlock: 'RFP-060' },
    { id: 'ember',    cat: 'payload', name: 'FILLER 1A',      fx: '10 Bd · RUNS HOT',            group: 'fill' },
    { id: 'frost',    cat: 'payload', name: 'FILLER 2S',      fx: '3.5 Bd · RUNS COLD',          group: 'fill' },
    { id: 'emberx',   cat: 'payload', name: 'FILLER 1X',      fx: '26 Bd · TWITCHY',             group: 'refined' },
    { id: 'emberxs',  cat: 'payload', name: 'SCORCHED F-1X',  fx: '20 Bd · ANGRIER',             group: 'refined' },
    { id: 'glaze',    cat: 'payload', name: 'ADDITIVE G-3',   fx: 'STABILIZER · COOLS THE LOAD', group: 'refined' },
    { id: 'trimcell', cat: 'payload', name: 'TRIM CELL ×¼',   fx: '2.5 Bd · FINE CoM & YIELD',   group: 'fill', unlock: 'RFP-044' },
    { id: 'densepack', cat: 'payload', name: 'DENSE-PACK CELL', fx: '16 Bd · NEEDS STANDARD+',   group: 'fill', unlock: 'RFP-060' },
    { id: 'ballast',  cat: 'payload', name: 'INERT BALLAST',  fx: 'ZERO YIELD · SHIFTS CoM',     group: 'fill', unlock: 'RFP-057' },
    { id: 'timer',    cat: 'fuzing',  name: 'TIMER',          fx: 'FIRES AT T+5.0 · DIAL SETS IT', group: 'unique', excl: ['impactfuze'] },
    { id: 'delayrelay', cat: 'fuzing', name: 'DELAY RELAY',   fx: '+0.5 s AFTER THE DIAL',       group: 'unique', unlock: 'RFP-052' },
    { id: 'impactfuze', cat: 'fuzing', name: 'IMPACT FUZE NOSE', fx: 'FIRES ON GROUND CONTACT',  group: 'unique', unlock: 'RFP-066', excl: ['timer'] },
    { id: 'battery',  cat: 'power',   name: 'BATTERY',        fx: 'POWERS THE FIRING TRAIN',     group: 'unique', excl: ['batteryl'] },
    { id: 'batteryl', cat: 'power',   name: 'BATTERY PACK L', fx: 'HEAVY · SPARE AUX TERMINAL',  group: 'unique', unlock: 'RFP-063', excl: ['battery'] },
    { id: 'harness',  cat: 'power',   name: 'SHIELDED HARNESS', fx: 'NO COLOUR ASIDE · +1 PROBE FREE', group: 'unique', unlock: 'RFP-055' },
    { id: 'panel',    cat: 'power',   name: 'ARM SWITCH',     fx: 'ONE GUARD · ONE SWITCH',      group: 'unique' },
    { id: 'cap',      cat: 'trim',    name: 'WELL CAP',       fx: 'SEALS THE DET WELL',          group: 'unique' },
    { id: 'fins',     cat: 'trim',    name: 'FINS',           fx: 'ZERO EFFECT · MORALE',        group: 'unique' },
    { id: 'paintlocker', cat: 'trim', name: 'PAINT LOCKER',   fx: '3 FINISHES · ZERO MECHANICS', group: 'unique', unlock: 'RFP-063', free: true,
      tap: function () { cyclePaint(); } }
  ];
  /* the PAINT LOCKER — pure ownership; the finish follows you between contracts */
  function cyclePaint() {
    var a = S.assembly;
    if (!a.shell) { toast('Paint wants a shell to land on.'); return; }
    var idx = 0;
    PG2.PAINTS.forEach(function (p, i) { if (p.id === a.paint) idx = i; });
    var next = PG2.PAINTS[(idx + 1) % PG2.PAINTS.length];
    a.paint = next.id;
    SAVE.paint = next.id;
    persist();
    PGAudio.thunk(0.25);
    toast('PAINT LOCKER — ' + next.name + '. Zero mechanics. Pure ownership.');
    rebuildDevice();
    refreshHUD();
  }
  var drawer = { open: false, cat: 'shells', wasOpenForDrag: false, built: null };
  function partLocked(entry) {
    if (!entry.unlock) return false;
    var idx = -1;
    PG2.CONTRACTS.forEach(function (c, i) { if (c.id === entry.unlock) idx = i; });
    if (idx < 0) return false;
    return !contractUnlocked(idx);
  }
  function catalogList(cat) {
    var st = S.assembly.refine.stock;
    var refinedVisible = rfp().needsRefinery || st.emberx > 0 || st.emberxs > 0 || st.glaze > 0;
    return CATALOG.filter(function (p) {
      if (p.cat !== cat) return false;
      if (p.group === 'refined' && !refinedVisible) return false;
      return true;
    });
  }
  function partCost(id) {
    if (PG2.SHELLS[id]) return PG2.SHELLS[id].cost;
    if (PG2.COMPOUNDS[id]) return PG2.COMPOUNDS[id].cost;
    return PG2.PARTS[id] ? PG2.PARTS[id].cost : 0;
  }
  function costLabel(p) {
    if (p.free) return 'SHOP COURTESY';
    if (p.group === 'refined') return 'FROM THE STILL';
    return '$' + partCost(p.id).toLocaleString('en-US') + (p.group === 'fill' ? ' ea' : '');
  }
  var iconCache = {};
  function makeIcons() {
    try {
      var r2 = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r2.setSize(108, 108);
      r2.setPixelRatio(1);
      r2.outputEncoding = THREE.sRGBEncoding;
      var sc = new THREE.Scene();
      var cam = new THREE.PerspectiveCamera(34, 1, 0.05, 20);
      sc.add(new THREE.HemisphereLight(0xcfe3f4, 0x33291d, 0.9));
      var dl = new THREE.DirectionalLight(0xfff1dc, 1.0);
      dl.position.set(3, 4, 5);
      sc.add(dl);
      ALL_PART_IDS.forEach(function (pid) {
        var m = partBuilder(pid);
        var bb = new THREE.Box3().setFromObject(m);
        var size = bb.getSize(new THREE.Vector3()).length() || 1;
        var ctr = bb.getCenter(new THREE.Vector3());
        m.position.sub(ctr);
        sc.add(m);
        cam.position.set(size * 0.9, size * 0.62, size * 1.15);
        cam.lookAt(0, 0, 0);
        r2.render(sc, cam);
        iconCache[pid] = r2.domElement.toDataURL();
        sc.remove(m);
      });
      r2.dispose();
      r2.forceContextLoss && r2.forceContextLoss();
    } catch (e) { /* icons stay blank; tiles still labeled */ }
  }
  function setDrawerOpen(open, silent) {
    drawer.open = !!open;
    $('drawer').classList.toggle('collapsed', !drawer.open);
    $('ui-bay').classList.toggle('drawer-open', drawer.open);   // the coach text yields
    if (!silent) PGAudio.tap();
  }
  function setDrawerCat(cat, silent) {
    drawer.cat = cat;
    if (SAVE.ui) { SAVE.ui.drawerCat = cat; persist(); }   // the drawer remembers
    buildDrawerGrid();
    refreshDrawerSpine();
    if (!silent) PGAudio.tick();
  }
  function refreshDrawerSpine() {
    document.querySelectorAll('.spine-tab').forEach(function (el) {
      el.classList.toggle('on', el.dataset.cat === drawer.cat);
    });
  }
  function buildDrawerSpine() {
    var sp = $('drawer-spine');
    sp.innerHTML = '';
    DRAWER_CATS.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'spine-tab' + (c.sealed ? ' sealed' : '');
      b.dataset.cat = c.id;
      b.innerHTML = c.sealed ? '<span class="st-lock">🔒</span> ' + c.name : c.name;
      b.addEventListener('click', function () {
        PGAudio.init();
        if (c.sealed) { PGAudio.buzz(); toast(c.name + ' — ' + c.sealed + '. The Authority is still stamping the folders.'); return; }
        setDrawerCat(c.id);
      });
      sp.appendChild(b);
    });
    refreshDrawerSpine();
  }
  /* tile input: drag OUT to grab (drawer collapses), drag UP/DOWN to scroll the grid */
  function bindTilePointer(t, entry) {
    t.addEventListener('pointerdown', function (e) {
      if (S.phase !== 'build') return;
      e.preventDefault();
      PGAudio.init();
      if (partLocked(entry)) { PGAudio.buzz(); toast(entry.name + ' — UNLOCKS · ' + entry.unlock + '. The catalog is the brochure.'); return; }
      if (t.classList.contains('disabled')) { PGAudio.buzz(); toast(explainDisabled(entry)); return; }
      if (entry.tap) { entry.tap(); return; }        // tap-action tiles (e.g. the paint locker)
      var grid = $('drawer-grid');
      var st = { pid: e.pointerId, x0: e.clientX, y0: e.clientY, lastY: e.clientY, mode: null };
      function mv(e2) {
        if (e2.pointerId !== st.pid) return;
        var dx = e2.clientX - st.x0, dy = e2.clientY - st.y0;
        if (!st.mode) {
          if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
          // grab by default (the stand is down-and-right of the drawer);
          // a steep vertical pull scrolls the grid — only when there is more to see
          var overflows = grid.scrollHeight > grid.clientHeight + 4;
          st.mode = (overflows && Math.abs(dy) > 2.5 * Math.abs(dx)) ? 'scroll' : 'grab';
          if (st.mode === 'grab') {
            cleanup();
            drawer.wasOpenForDrag = drawer.open;
            setDrawerOpen(false, true);              // build zone gets the whole screen
            beginPartDrag(entry.id, e2);
            return;
          }
        }
        if (st.mode === 'scroll') {
          grid.scrollTop -= (e2.clientY - st.lastY);
          st.lastY = e2.clientY;
        }
      }
      function up(e2) { if (e2.pointerId === st.pid) cleanup(); }
      function cleanup() {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      }
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }
  function buildDrawerGrid() {
    var grid = $('drawer-grid');
    grid.innerHTML = '';
    var catDef = null;
    DRAWER_CATS.forEach(function (c) { if (c.id === drawer.cat) catDef = c; });
    $('drawer-title').textContent = 'PARTS · ' + (catDef ? catDef.name : '');
    catalogList(drawer.cat).forEach(function (p) {
      var t = document.createElement('div');
      var locked = partLocked(p);
      t.className = 'tile' + (locked ? ' locked' : '');
      t.id = 'tile-' + p.id;
      var badge = !locked && p.group === 'shell' ? '<span class="t-badge">PICK 1</span>'
                : !locked && p.group === 'refined' ? '<span class="t-badge" id="badge-' + p.id + '">×0</span>' : '';
      t.innerHTML = badge +
        '<img alt="" draggable="false"' + (iconCache[p.id] ? ' src="' + iconCache[p.id] + '"' : '') + '>' +
        '<div class="t-name">' + p.name + '</div>' +
        (locked
          ? '<div class="t-unlock">UNLOCKS · ' + p.unlock + '</div>'
          : '<div class="t-cost">' + costLabel(p) + '</div><div class="t-fx">' + p.fx + '</div>');
      bindTilePointer(t, p);
      grid.appendChild(t);
    });
    refreshDrawer();
  }
  function buildDrawer() {
    buildDrawerSpine();
    buildDrawerGrid();
  }
  /* a grayed tile is never mute: tap it and it says why (doctrine: challenging, never confusing) */
  function explainDisabled(p) {
    var a = S.assembly;
    var d = PG2.derive(a, rfp());
    if (p.tap) return 'Place a shell first — there is nothing to paint.';
    if (p.group === 'shell') return 'A shell is already on the stand. Tap it to take it off first — parts come off with it.';
    if (!a.shell) return p.name + ' needs a shell on the stand first. STRUCTURE before trimmings.';
    if (p.group === 'fill' || p.group === 'refined') {
      if (d.filled >= d.slots) return 'All ' + d.slots + ' bays are full. Tap a canister to take it back off.';
      if (p.group === 'refined') return 'No ' + p.name + ' in stock — run ⚗ THE STILL.';
    }
    if (a[p.id]) return p.name + ' is already installed. Tap it on the article to take it back off.';
    if (p.excl) {
      for (var i = 0; i < p.excl.length; i++) {
        if (a[p.excl[i]]) {
          var other = PG2.PARTS[p.excl[i]] ? PG2.PARTS[p.excl[i]].name : p.excl[i].toUpperCase();
          return p.name + ' won’t share the article with ' + other + '. Take that off first.';
        }
      }
    }
    return p.name + ' can’t go on right now.';
  }
  function refreshDrawer() {
    var a = S.assembly;
    var d = PG2.derive(a, rfp());
    catalogList(drawer.cat).forEach(function (p) {
      var t = $('tile-' + p.id);
      if (!t || partLocked(p)) return;
      var dis = false;
      if (p.tap) dis = !a.shell;
      else if (p.group === 'shell') dis = !!a.shell;
      else if (p.group === 'fill') dis = !a.shell || d.filled >= d.slots;
      else if (p.group === 'refined') {
        dis = !a.shell || d.filled >= d.slots || !(a.refine.stock[p.id] > 0);
        var b = $('badge-' + p.id);
        if (b) b.textContent = '×' + a.refine.stock[p.id];
      }
      else dis = !a.shell || !!a[p.id] || (p.excl && p.excl.some(function (x) { return !!a[x]; }));
      // !! matters: for parts with no excl list the chain ends undefined, and
      // classList.toggle(cls, undefined) FLIPS instead of clearing — the well
      // cap greyed out at random on phones because of this.
      t.classList.toggle('disabled', !!dis);
    });
  }
  $('drawer-tab').addEventListener('click', function () {
    PGAudio.init();
    setDrawerOpen(!drawer.open);
  });

  /* ================= BUILD PHASE RAIL (M3a) =================
     1 STRUCTURE · 2 PAYLOAD · 3 SYSTEMS · 4 CLOSE-OUT.
     Tapping a phase focuses the camera and filters the drawer to the
     phase's categories. Navigation, never a lock — free movement until
     the truck rolls. CLOSE-OUT enters the existing close-out flow. */
  var buildPhase = 'structure';
  var PHASE_DEF = {
    structure: { label: 'STRUCTURE', cats: ['shells', 'trim'],
                 view: { theta: 0.7, phi: 1.18, radius: 4.4, target: [0, 1.25, 0] } },
    payload:   { label: 'PAYLOAD', cats: ['payload'],
                 view: { theta: 0.7, phi: 0.52, radius: 3.1, target: [0, 1.35, 0] } },
    systems:   { label: 'SYSTEMS', cats: ['fuzing', 'power'],
                 view: { theta: 1.25, phi: 1.02, radius: 2.7, target: [0.45, 1.3, 0] } },
    closeout:  { label: 'CLOSE-OUT', cats: [] }
  };
  function refreshPhaseRail() {
    var d = PG2.derive(S.assembly, rfp());
    document.querySelectorAll('.pr-step').forEach(function (el) {
      el.classList.toggle('on', el.dataset.phase === buildPhase);
      if (el.dataset.phase === 'closeout') {
        el.classList.toggle('dim', !(d.complete && !d.overBudget && !d.overWeight));
      }
    });
  }
  function tweenPhaseView(v) {
    var o = bay.orbit;
    var t0 = o.theta, p0 = o.phi, r0 = o.radius, tg0 = o.target.clone();
    var tg1 = V3(v.target[0], v.target[1], v.target[2]);
    bay.velTheta = bay.velPhi = 0;
    tween(680, function (t) {
      o.theta = lerp(t0, v.theta, t);
      o.phi = lerp(p0, v.phi, t);
      o.radius = lerp(r0, v.radius, t);
      o.target.lerpVectors(tg0, tg1, t);
    });
  }
  function setBuildPhase(phase) {
    if (S.phase !== 'build') return;
    var def = PHASE_DEF[phase];
    if (!def) return;
    if (phase === 'closeout') {
      var d = PG2.derive(S.assembly, rfp());
      if (!(d.complete && !d.overBudget && !d.overWeight)) {
        PGAudio.buzz();
        toast(d.missing.length ? 'Close-out wants a complete article — still missing: ' + d.missing.join(', ') + '.'
              : d.overBudget ? 'Close-out refused: over budget.' : 'Close-out refused: over the weight cap.');
        return;
      }
      PGAudio.tap();
      enterWiring();
      return;
    }
    buildPhase = phase;
    PGAudio.tick();
    tweenPhaseView(def.view);
    // filter the drawer to the phase's categories (soft — spine stays free)
    if (def.cats.length && def.cats.indexOf(drawer.cat) < 0) setDrawerCat(def.cats[0], true);
    setDrawerOpen(true, true);
    refreshPhaseRail();
  }
  document.querySelectorAll('.pr-step').forEach(function (el) {
    el.addEventListener('click', function () {
      PGAudio.init();
      setBuildPhase(el.dataset.phase);
    });
  });

  /* ================= HUD ================= */
  function closeoutReady() {
    var a = S.assembly;
    return a.det.seated && PG2.wiringComplete(a, rfp());
  }
  function refreshHUD() {
    var d = PG2.derive(S.assembly, rfp());
    var R = rfp();
    var maxM = R.meterMax;
    // R&D: no spec band — the meter reads, it doesn't judge
    $('m-goal').textContent = S.mode === 'rnd' ? 'NO SPEC · R&D' : R.craterMin + '–' + R.craterMax + ' m';
    $('m-max').textContent = maxM + ' m';
    var spec = $('m-crater-spec');
    spec.style.left = (R.craterMin / maxM * 100) + '%';
    spec.style.width = ((R.craterMax - R.craterMin) / maxM * 100) + '%';
    var band = $('m-crater-band');
    if (d.craterMean > 0) {
      var lo = clamp(d.bandLo / maxM, 0, 1) * 100, hi = clamp(d.bandHi / maxM, 0, 1) * 100;
      band.style.left = lo + '%';
      band.style.width = Math.max(hi - lo, 1) + '%';
      $('m-crater-val').textContent = d.bandLo.toFixed(0) + '–' + d.bandHi.toFixed(0) + ' m' + (d.severity > 0.15 ? ' ⚠' : '');
      $('m-crater-val').className = (d.craterMean >= R.craterMin && d.craterMean <= R.craterMax && d.severity <= 0.15) ? 'good' : '';
    } else {
      band.style.width = '0%';
      $('m-crater-val').textContent = '—';
      $('m-crater-val').className = '';
    }
    var wv = $('m-weight-val');
    wv.textContent = Math.round(d.weight) + ' kg' + (R.weightCap ? ' / ' + R.weightCap : '');
    wv.className = d.overWeight ? 'bad' : '';
    var wf = $('m-weight-fill');
    wf.style.width = clamp(d.weight / (R.weightCap ? R.weightCap / 0.88 : 90), 0, 1) * 100 + '%';
    wf.classList.toggle('over', d.overWeight);
    $('m-weight-cap').classList.toggle('hidden', !R.weightCap);
    var cost = $('m-cost-val');
    // R&D runs on the company account: the cap is whatever's in it
    var shortOnCash = S.mode === 'rnd' && d.cost > SAVE.cash;
    cost.textContent = S.mode === 'rnd' ? fmt$(d.cost) + ' / ' + fmt$(SAVE.cash) : fmt$(d.cost);
    cost.className = (d.overBudget || shortOnCash) ? 'bad' : '';
    var cf = $('m-cost-fill');
    cf.style.width = clamp(d.cost / (S.mode === 'rnd' ? Math.max(SAVE.cash, 1) / 0.88 : R.budget / 0.88), 0, 1) * 100 + '%';
    cf.classList.toggle('over', d.overBudget || shortOnCash);
    var btn = $('btn-closeout');
    btn.disabled = !(d.complete && !d.overBudget && !d.overWeight && !shortOnCash);
    $('btn-refire').classList.toggle('hidden', !(S.phase === 'build' && closeoutReady() && d.complete && !d.overBudget && !d.overWeight && !shortOnCash));
    $('btn-refinery').classList.toggle('hidden', !(S.phase === 'build' && R.needsRefinery));
    refreshComMarker(d);
    refreshHint(d);
    refreshDrawer();
    refreshPhaseRail();
  }
  function refreshHint(d) {
    var h = $('bay-hint');
    if (S.phase !== 'build') { h.style.opacity = 0; return; }
    h.style.opacity = 1;
    var R = rfp();
    var msg;
    var shortCash = S.mode === 'rnd' && d.cost > SAVE.cash;
    if (!S.assembly.shell) msg = S.mode === 'rnd'
      ? 'Your bench, your dime, no spec sheet.<br>Pull the <b>PARTS</b> drawer and build the thing you keep sketching.'
      : 'Pull the <b>PARTS</b> drawer and drag a <b>shell</b> onto the glowing stand.<br>One finger orbits · pinch zooms.';
    else if (d.filled === 0) msg = R.needsRefinery && S.mode !== 'rnd'
      ? 'This job wants the still. Fire up <b>⚗ THE STILL</b>, then load the bays.'
      : 'Load <b>canisters</b> into the open bays.<br>Amber F-1A = more bang · blue F-2S = calmer.';
    else if (d.missing.length) msg = 'Still missing: <b>' + d.missing.join(' · ') + '</b>.<br>Tap a placed part to take it back off.';
    else if (shortCash) msg = '<b style="color:#ff8d7e">The account is short.</b> This article costs ' + fmt$(d.cost) +
      ' to expend; the company holds ' + fmt$(SAVE.cash) + '. Win a contract, land an order, or build cheaper.';
    else if (d.overBudget) msg = '<b style="color:#ff8d7e">Over budget.</b> Take something off — the Authority won’t pay a penny past $' + R.budget.toLocaleString('en-US') + '.';
    else if (d.overWeight) msg = '<b style="color:#ff8d7e">Over weight.</b> ' + Math.round(d.weight) + ' kg on a ' + R.weightCap + ' kg crane. The scale does not negotiate.';
    else if (d.cookRisk > 0) msg = '<b style="color:#ff8d7e">Heat warning.</b> This load may <b>cook off</b> under the forecast. F-2S or ADDITIVE G-3 buys shade.';
    else if (closeoutReady()) msg = 'Ready. <b>REFIRE</b> as-is — or run <b>CLOSE-OUT</b> to change wiring, seating or arming.';
    else msg = 'Looks right. Hit <b>CLOSE-OUT</b> to wire it up by hand.';
    if (R.offsetSpec && d.filled > 0 && !d.missing.length && !d.overBudget) {
      var westOff = -d.offsetMean;
      msg += '<br><span style="opacity:.8">Load lean: ' + (Math.abs(westOff) < 0.5 ? 'dead centre' :
        Math.abs(westOff).toFixed(1) + ' m ' + (westOff > 0 ? 'west' : 'east')) + ' (spec ' +
        R.offsetSpec.min + '–' + R.offsetSpec.max + ' m west)</span>';
    }
    h.innerHTML = '<span class="hint-small">ASSEMBLY BAY · ' + R.id + '</span>' + msg;
  }
  /* faint CoM crosshair on the stand — the bay whispers where the blast will lean */
  function refreshComMarker(d) {
    var mk = bay.comMarker;
    if (!mk) {
      mk = new THREE.Group();
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 18),
        mat(COL.amber, { emissive: COL.amber, ei: 0.5, transparent: true, opacity: 0.55 }));
      ring.rotation.x = Math.PI / 2;
      mk.add(ring);
      [0, Math.PI / 2].forEach(function (rz) {
        var bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.008, 0.014),
          mat(COL.amber, { emissive: COL.amber, ei: 0.5, transparent: true, opacity: 0.55 }));
        bar.rotation.y = rz;
        mk.add(bar);
      });
      mk.position.y = -1.135;   // device sits at y=1.32; the marker rides the stand top
      bay.device.add(mk);
      bay.comMarker = mk;
    }
    var a = S.assembly;
    var show = S.phase === 'build' && a.shell && d.filled > 0 && Math.abs(d.comX) > 0.06;
    mk.visible = !!show;
    if (show) {
      var span = casingDims(a.shell).L * 0.52;
      mk.position.x = d.comX * span / 2;
    }
  }

  /* ================= INPUT — bay orbit + part drag + tap remove ================= */
  var pointers = {};
  var dragPart = null;   // {id, ghost, node}
  var raycaster = new THREE.Raycaster();

  function canvasPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function partWeight01(id) {
    var def = PG2.SHELLS[id] || PG2.COMPOUNDS[id] || PG2.PARTS[id];
    return clamp((def ? def.w : 4) / 30, 0.05, 1);
  }
  function beginPartDrag(id, e) {
    PGAudio.init(); PGAudio.pickup();
    hidePartCard();
    var ghost = partBuilder(id);
    ghost.traverse(function (m) {
      if (m.isMesh) {
        m.material = m.material.clone();
        m.material.transparent = true;
        m.material.opacity = 0.55;
        m.castShadow = false;
      }
    });
    bay.scene.add(ghost);
    dragPart = {
      id: id, ghost: ghost, node: null, pid: e.pointerId,
      target: new THREE.Vector3(), snap: false, ghostHot: -1,
      w: partWeight01(id)
    };
    refreshNodes(id);
    frameDragNodes();
    movePartDrag(e);
    dragPart.ghost.position.copy(dragPart.target);   // no fly-in from origin
    window.addEventListener('pointermove', movePartDrag);
    window.addEventListener('pointerup', endPartDrag);
    window.addEventListener('pointercancel', endPartDrag);
  }
  /* the bay presents the socket: if a grabbed part's sockets sit off-screen
     (a long shell's well cap on a narrow phone), slide the view to frame them */
  function frameDragNodes() {
    if (!nodeMarkers.length) return;
    var pad = 34, top = 170, bot = H - 160, bad = false, wx = 0;
    nodeMarkers.forEach(function (mk) {
      mk.getWorldPosition(_mkWP);
      var sp = worldToScreen(_mkWP, bay.camera);
      if (sp.x < pad || sp.x > W - pad || sp.y < top || sp.y > bot) bad = true;
      wx += _mkWP.x;
    });
    if (!bad) return;
    wx /= nodeMarkers.length;
    var o = bay.orbit;
    var t0 = o.target.x, r0 = o.radius;
    var tx = clamp(wx * 0.6, -1.4, 1.4);
    var r1 = Math.min(r0 + 0.9, 6.2);
    tween(380, function (e) {
      o.target.x = lerp(t0, tx, e);
      o.radius = lerp(r0, r1, e);
      bayCam();
    });
  }
  function setGhostHot(hot) {
    if (!dragPart || dragPart.ghostHot === (hot ? 1 : 0)) return;
    dragPart.ghostHot = hot ? 1 : 0;
    dragPart.ghost.traverse(function (m) {
      if (!m.isMesh) return;
      m.material.opacity = hot ? 0.92 : 0.5;
      if (m.material.emissive) {
        if (hot) {
          if (m.userData.e0 == null) m.userData.e0 = m.material.emissive.getHex();
          m.material.emissive.setHex(0x1d5533);   // ghost-preview: this is where it lands
        } else if (m.userData.e0 != null) {
          m.material.emissive.setHex(m.userData.e0);
        }
      }
    });
  }
  var _mkWP = new THREE.Vector3();
  function movePartDrag(e) {
    if (!dragPart || e.pointerId !== dragPart.pid) return;
    var p = canvasPos(e);
    // progressive node feedback: every valid node knows how near the part is
    var best = null, bestD = 96;   // magnetic range
    nodeMarkers.forEach(function (mk) {
      mk.getWorldPosition(_mkWP);
      var sp = worldToScreen(_mkWP, bay.camera);
      var dd = Math.hypot(sp.x - p.x, sp.y - p.y);
      mk.userData.prox = clamp(1 - (dd - 55) / 250, 0, 1);   // distant→0 glow, close→1 hot
      if (dd < bestD) { bestD = dd; best = mk.userData.node; }
    });
    if (best && (!dragPart.node || dragPart.node.id !== best.id)) PGAudio.ghostHum();
    dragPart.node = best;
    if (best) {
      // magnetic pull: the ghost eases into the final pose (see loop)
      var pose = nodePose(best.id, dragPart.id);
      dragPart.target.copy(bay.device.localToWorld(pose.pos.clone()));
      dragPart.snap = true;
      setGhostHot(true);
    } else {
      // float on a camera-facing plane through the device
      var ndc = new THREE.Vector2((p.x / W) * 2 - 1, -(p.y / H) * 2 + 1);
      raycaster.setFromCamera(ndc, bay.camera);
      var plane = new THREE.Plane();
      var n = new THREE.Vector3();
      bay.camera.getWorldDirection(n);
      plane.setFromNormalAndCoplanarPoint(n, bay.orbit.target);
      var hit = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, hit);
      if (hit) dragPart.target.copy(hit);
      dragPart.snap = false;
      setGhostHot(false);
    }
  }
  var _gq = new THREE.Quaternion(), _ge = new THREE.Euler();
  function stepDragGhost(dt) {
    if (!dragPart || !dragPart.ghost) return;
    var g = dragPart.ghost;
    // inertia: heavier parts lag more in the hand
    var k = Math.min(((dragPart.snap ? 17 : 13) - dragPart.w * 5.5) * dt, 1);
    var dx = dragPart.target.x - g.position.x;
    var dy = dragPart.target.y - g.position.y;
    var dz = dragPart.target.z - g.position.z;
    g.position.x += dx * k; g.position.y += dy * k; g.position.z += dz * k;
    if (dragPart.snap) {
      _gq.copy(bay.device.quaternion);   // ghost-preview: final orientation
    } else {
      _ge.set(clamp(dy * 0.55, -0.3, 0.3), 0, clamp(-dx * 0.55, -0.35, 0.35));  // sway with the pull
      _gq.setFromEuler(_ge);
    }
    g.quaternion.slerp(_gq, Math.min(dt * 9, 1));
  }
  function endPartDrag(e) {
    if (!dragPart || (e && e.pointerId !== dragPart.pid)) return;
    window.removeEventListener('pointermove', movePartDrag);
    window.removeEventListener('pointerup', endPartDrag);
    window.removeEventListener('pointercancel', endPartDrag);
    var dp = dragPart;
    dragPart = null;
    bay.scene.remove(dp.ghost);
    if (dp.node) placePart(dp.id, dp.node);
    else refreshNodes(null);
    if (drawer.wasOpenForDrag) {           // the drawer slides back where you left it
      drawer.wasOpenForDrag = false;
      setDrawerOpen(true, true);
    }
  }
  function findPlacedRoot(kind, slot) {
    var found = null;
    bay.device.children.forEach(function (ch) {
      var r = ch.userData.remove;
      if (!r) return;
      if (r.kind === kind && (slot == null || r.slot === slot)) found = ch;
    });
    return found;
  }
  function settleWobble(kind, slot, w) {
    // spring overshoot: the part lands, squashes, rings down
    var root = findPlacedRoot(kind, slot);
    if (!root) return;
    var amp = 0.05 + w * 0.1;
    tween(560, function (e, raw) {
      var kk = Math.exp(-4.8 * raw) * Math.sin(raw * Math.PI * 3.4);
      root.scale.set(1 + amp * kk, 1 - amp * kk * 0.8, 1 + amp * kk);
    }, function () { root.scale.set(1, 1, 1); }, function (t) { return t; });
  }
  function standDip(w) {
    bay.dipV -= 0.6 * w;   // the stand takes the weight, proportionally
  }
  function placePart(id, node) {
    var a = S.assembly;
    if (/^slot/.test(node.id) && PG2.COMPOUNDS[id] && PG2.COMPOUNDS[id].cost === 0 &&
        !(a.refine.stock[id] > 0)) {   // refined — comes from stock
      toast('No ' + PG2.COMPOUNDS[id].name + ' in stock — run ⚗ THE STILL.');
      refreshNodes(null);
      return;
    }
    if (/^slot/.test(node.id) && PG2.COMPOUNDS[id] && PG2.COMPOUNDS[id].needsRated &&
        a.shell && !PG2.SHELLS[a.shell].rated) {
      PGAudio.buzz();
      toast('DENSE-PACK wants a STANDARD-rated shell under it. This one is not.');
      refreshNodes(null);
      return;
    }
    pushHistory();
    var kind, slot = null;
    if (node.id === 'stand') {
      a.shell = id;
      a.canisters = new Array(PG2.SHELLS[id].slots).fill(null);
      kind = 'shell';
    } else if (/^slot/.test(node.id)) {
      if (PG2.COMPOUNDS[id] && PG2.COMPOUNDS[id].cost === 0) { a.refine.stock[id]--; syncStock(); }
      a.canisters[node.slot] = id;
      kind = 'canister'; slot = node.slot;
    } else {
      a[id] = true;
      kind = id;
    }
    var w = partWeight01(id);
    PGAudio.thunk(w);        // a Big Shell thunks deeper than a canister
    standDip(w);
    rebuildDevice();
    settleWobble(kind, slot, w);
    refreshHUD();
  }
  function restock(c) {
    if (c && PG2.COMPOUNDS[c] && PG2.COMPOUNDS[c].cost === 0) { S.assembly.refine.stock[c]++; syncStock(); }
  }
  function removePart(info) {
    pushHistory();
    var a = S.assembly;
    if (info.kind === 'shell') {
      (a.canisters || []).forEach(restock);
      var keepRefine = a.refine;
      S.assembly = PG2.makeAssembly();
      S.assembly.refine = keepRefine;
      toast('Shell removed — everything comes off with it.');
    } else if (info.kind === 'canister') {
      restock(a.canisters[info.slot]);
      a.canisters[info.slot] = null;
    } else {
      a[info.kind] = false;
    }
    PGAudio.unsnap();
    standDip(-partWeight01(info.kind === 'shell' ? 'standard' : info.kind) * 0.4);
    hidePartCard();
    rebuildDevice();
    refreshHUD();
  }

  /* ---------- undo / redo (three steps — tinkering demands safe experimentation) ---------- */
  var hist = { undo: [], redo: [] };
  function histUI() {
    $('btn-undo').disabled = !hist.undo.length;
    $('btn-redo').disabled = !hist.redo.length;
  }
  function snapAssembly() { return JSON.stringify(S.assembly); }
  function pushHistory() {
    hist.undo.push(snapAssembly());
    if (hist.undo.length > 3) hist.undo.shift();
    hist.redo.length = 0;
    histUI();
  }
  function clearHistory() { hist.undo.length = 0; hist.redo.length = 0; histUI(); }
  function applySnapshot(json) {
    S.assembly = JSON.parse(json);
    syncStock();               // undo/redo moves canisters between rack and shelf
    hidePartCard();
    rebuildDevice();
    refreshHUD();
  }
  function doUndo() {
    if (!hist.undo.length || S.phase !== 'build') return;
    hist.redo.push(snapAssembly());
    applySnapshot(hist.undo.pop());
    PGAudio.unsnap();
    histUI();
  }
  function doRedo() {
    if (!hist.redo.length || S.phase !== 'build') return;
    hist.undo.push(snapAssembly());
    applySnapshot(hist.redo.pop());
    PGAudio.thunk(0.4);
    histUI();
  }
  $('btn-undo').addEventListener('click', function () { PGAudio.init(); doUndo(); });
  $('btn-redo').addEventListener('click', function () { PGAudio.init(); doRedo(); });

  /* ---------- part info card (long-press a placed part) ---------- */
  var FLAVOR = {
    compact: 'Two bays and big dreams. Rated for polite explosions only.',
    standard: 'The catalog calls it “dependable”, which is catalog for “blameless”.',
    heavy: 'The patience of a bank vault and the appetite of a quarry.',
    ember: 'The one-alpha. Sloshes if you shake it. Kindly do not shake it.',
    frost: 'The two-sierra. Smells faintly of winter and disapproval.',
    emberx: 'The one-x-ray, from your own still. It hums when nobody is listening.',
    emberxs: 'Left the still angry. Holds a grudge, loses a contest.',
    glaze: 'F-2S poured slow over a line. Calms the load, pads the shocks, ignores the forecast.',
    timer: 'Counts to five. Never wrong — only ever wired wrong.',
    battery: 'DC-9 cells. The label says DO NOT LICK because somebody asked.',
    cap: 'A hat for the important hole. Fits like bureaucracy: snugly.',
    fins: 'Aerodynamically useless. Morale-critical.',
    panel: 'One switch, one guard, zero excuses. The little light means it.'
  };
  function showPartCard(root, p) {
    var info = root.userData.remove;
    if (!info) return;
    var id = info.kind === 'shell' ? S.assembly.shell
           : info.kind === 'canister' ? S.assembly.canisters[info.slot] : info.kind;
    if (!id) return;
    var def = PG2.SHELLS[id] || PG2.COMPOUNDS[id] || PG2.PARTS[id];
    $('pc-name').textContent = def.name;
    $('pc-stats').textContent =
      (def.cost > 0 ? '$' + def.cost.toLocaleString('en-US') : 'FROM THE STILL') +
      ' · ' + def.w + ' KG' +
      (def.slots ? ' · ' + def.slots + ' BAYS' : '') +
      (def.energy ? ' · ' + def.energy + ' Bd' : '');
    $('pc-flavor').textContent = FLAVOR[id] || def.blurb || '';
    var card = $('part-card');
    card.classList.remove('hidden');
    card.style.left = clamp(p.x - 115, 8, W - 238) + 'px';
    card.style.top = clamp(p.y - 140, 60, H - 130) + 'px';
    PGAudio.tick();
  }
  function hidePartCard() { $('part-card').classList.add('hidden'); }

  /* ---------- double-tap focus framing ---------- */
  function pickPart(p) {
    var ndc = new THREE.Vector2((p.x / W) * 2 - 1, -(p.y / H) * 2 + 1);
    raycaster.setFromCamera(ndc, bay.camera);
    var hits = raycaster.intersectObjects(placedMeshes, false);
    return hits.length ? hits[0].object.userData.rootPart : null;
  }
  function focusPart(root) {
    var bb = new THREE.Box3().setFromObject(root);
    var ctr = bb.getCenter(new THREE.Vector3());
    var size = bb.getSize(new THREE.Vector3()).length();
    var o = bay.orbit;
    var t0 = o.target.clone(), r0 = o.radius, r1 = clamp(size * 2.1, 1.3, 5.5);
    PGAudio.pickup();
    tween(620, function (t) {
      o.target.lerpVectors(t0, ctr, t);
      o.radius = lerp(r0, r1, t);
    });
  }
  function resetFraming() {
    var o = bay.orbit;
    var t0 = o.target.clone(), r0 = o.radius;
    tween(620, function (t) {
      o.target.lerpVectors(t0, V3(0, 1.25, 0), t);
      o.radius = lerp(r0, 4.4, t);
    });
  }

  canvas.addEventListener('pointerdown', onCanvasDown);
  canvas.addEventListener('pointermove', onCanvasMove);
  canvas.addEventListener('pointerup', onCanvasUp);
  canvas.addEventListener('pointercancel', onCanvasUp);
  canvas.addEventListener('wheel', function (e) {
    if (S.phase !== 'build') return;
    e.preventDefault();
    bay.orbit.radius = clamp(bay.orbit.radius + e.deltaY * 0.004, 2.2, 8.5);
  }, { passive: false });

  var tapCtl = { lastT: 0, lastRoot: null, removeTimer: null, lpTimer: null, lpFired: false };
  function onCanvasDown(e) {
    PGAudio.init();
    try { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); } catch (err) {}
    var p = canvasPos(e);
    pointers[e.pointerId] = { x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now(), moved: false };
    bay.lastTouch = performance.now();
    if (S.phase === 'wiring') return;   // the wiring station handles its own pointers
    if (S.phase === 'det') { detDown(e, p); return; }
    if (S.phase === 'arm') { armDown(e, p); return; }
    if (S.phase === 'build' && !dragPart && Object.keys(pointers).length === 1) {
      hidePartCard();
      bay.velTheta = bay.velPhi = 0;   // grabbing stops the spin
      tapCtl.lpFired = false;
      clearTimeout(tapCtl.lpTimer);
      var root = pickPart(p);
      if (root) {
        var pid = e.pointerId;
        tapCtl.lpTimer = setTimeout(function () {   // long-press: the part introduces itself
          var pt2 = pointers[pid];
          if (!pt2 || pt2.moved || dragPart || S.phase !== 'build') return;
          tapCtl.lpFired = true;
          showPartCard(root, p);
        }, 460);
      }
    }
  }
  function onCanvasMove(e) {
    var pt = pointers[e.pointerId];
    var p = canvasPos(e);
    if (S.phase === 'det') { detMove(e, p); }
    if (S.phase === 'arm') { armMove(e, p); }
    if (!pt) return;
    var dx = p.x - pt.x, dy = p.y - pt.y;
    if (Math.hypot(p.x - pt.sx, p.y - pt.sy) > 8) {
      if (!pt.moved) clearTimeout(tapCtl.lpTimer);
      pt.moved = true;
    }
    var ids = Object.keys(pointers);
    if (S.phase === 'build' && !dragPart) {
      if (ids.length === 1) {
        bay.orbit.theta -= dx * 0.0065;
        bay.orbit.phi = clamp(bay.orbit.phi - dy * 0.005, 0.18, 1.56);   // soft clamps spring back in the loop
        bay.velTheta = -dx * 0.0065 * 60;   // remembered for inertial release
        bay.velPhi = -dy * 0.005 * 60;
        bay.velFresh = performance.now();
      } else if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var prev = Math.hypot(a.x - b.x, a.y - b.y);
        // update this pointer, compute new dist
        var ax = ids[0] === String(e.pointerId) ? p.x : a.x;
        var ay = ids[0] === String(e.pointerId) ? p.y : a.y;
        var bx = ids[1] === String(e.pointerId) ? p.x : b.x;
        var by = ids[1] === String(e.pointerId) ? p.y : b.y;
        var cur = Math.hypot(ax - bx, ay - by);
        if (prev > 0) bay.orbit.radius = clamp(bay.orbit.radius * (prev / Math.max(cur, 1)), 2.2, 8.5);
      }
    }
    pt.x = p.x; pt.y = p.y;
    bay.lastTouch = performance.now();
  }
  function onCanvasUp(e) {
    var pt = pointers[e.pointerId];
    var p = canvasPos(e);
    if (S.phase === 'det') detUp(e, p);
    if (S.phase === 'arm') armUp(e, p);
    if (pt && S.phase === 'build' && !dragPart && Object.keys(pointers).length === 1) {
      if (pt.moved && performance.now() - bay.velFresh > 90) {
        bay.velTheta = bay.velPhi = 0;   // held still before release: no inertia
      }
      if (!pt.moved) {
        clearTimeout(tapCtl.lpTimer);
        if (!tapCtl.lpFired) {
          var root = pickPart(p);
          var nowT = performance.now();
          if (root && root.userData.remove) {
            if (nowT - tapCtl.lastT < 320 && tapCtl.lastRoot === root) {
              // double-tap: focus-frame the part instead of removing it
              clearTimeout(tapCtl.removeTimer);
              tapCtl.removeTimer = null;
              focusPart(root);
              tapCtl.lastT = 0; tapCtl.lastRoot = null;
            } else {
              tapCtl.lastT = nowT; tapCtl.lastRoot = root;
              var info = root.userData.remove;
              clearTimeout(tapCtl.removeTimer);
              tapCtl.removeTimer = setTimeout(function () {   // short grace so a double-tap can rescue it
                tapCtl.removeTimer = null;
                if (S.phase === 'build' && !dragPart) removePart(info);
              }, 290);
            }
          } else {
            if (nowT - tapCtl.lastT < 320 && !tapCtl.lastRoot) resetFraming();  // double-tap emptiness: step back
            tapCtl.lastT = nowT; tapCtl.lastRoot = null;
          }
        }
      }
    }
    delete pointers[e.pointerId];
  }

  /* ================= SCREENS / FLOW ================= */
  var screens = ['scr-title', 'scr-hq', 'scr-bids', 'scr-board', 'scr-museum', 'scr-rfp', 'scr-score'];
  function showScreen(id) {
    screens.forEach(function (s) { $(s).classList.toggle('active', s === id); });
  }
  function showUI(id) {
    ['ui-bay', 'ui-range'].forEach(function (u) { $(u).classList.toggle('hidden', u !== id); });
    if (!id) { $('ui-bay').classList.add('hidden'); $('ui-range').classList.add('hidden'); }
  }

  /* ---------- RFP ---------- */
  var rfpTimers = [];
  function bigNum3(R) {
    // the third headline number is whatever this contract is ABOUT
    if (R.impact) {
      return '<div class="bignum"><div class="bn-lbl">PLATE BAND</div><div class="bn-val">≤' +
        R.impact.band.toFixed(1) + '</div><div class="bn-unit">METRES OFF CENTRE · DROPPED</div></div>';
    }
    if (R.offsetSpec) {
      return '<div class="bignum"><div class="bn-lbl">BREACH OFFSET</div><div class="bn-val">' +
        R.offsetSpec.min + '–' + R.offsetSpec.max + '</div><div class="bn-unit">METRES ' +
        (R.offsetSpec.dir === 'W' ? 'WEST' : 'EAST') + '</div></div>';
    }
    if (R.weightCap) {
      return '<div class="bignum"><div class="bn-lbl">ARTICLE WEIGHT</div><div class="bn-val">≤' + R.weightCap +
        '</div><div class="bn-unit">KG · CRANE LIMIT</div></div>';
    }
    return '<div class="bignum"><div class="bn-lbl">DETONATE AT</div><div class="bn-val">T+' +
      (R.dial ? R.tSpec.toFixed(2) : R.tSpec.toFixed(1)) + 's</div><div class="bn-unit">±' + R.tTol + ' s' +
      (R.dial ? ' · HAND-SET DIAL' : '') + '</div></div>';
  }
  function buildRFP() {
    var R = rfp();
    var doc = $('rfp-doc');
    var finePrint = R.impact
      ? '<p class="spec-clause fine">Timing spec WAIVED. Release at T+' + R.tSpec.toFixed(1) +
        ' s; detonation on plate contact. IMPACT RELIABILITY is adjudicated in its place. The nose fuze is mandatory and sold separately.</p>'
      : (R.offsetSpec || R.weightCap)
      ? '<p class="spec-clause fine">Detonation at T+' + R.tSpec.toFixed(1) + ' s ±' + R.tTol +
        (R.offsetSpec ? ' · crater centre measured from pad datum.' : ' · weighed at the gate, argued about after.') + '</p>'
      : '';
    doc.innerHTML =
      '<div class="doc-sec">' +
        '<div class="doc-headrow"><span>' + R.form + '</span><span>SHEET 1 OF 1</span></div>' +
        '<div class="doc-stamp">CONFIDENTIAL</div>' +
        '<div class="rfp-no">REQUEST FOR PROPOSAL · ' + R.id + '</div>' +
        '<div class="rfp-title">' + R.title + '</div>' +
        '<div class="rfp-agency">REPUBLIC PROVING AUTHORITY · BUREAU OF CONTROLLED ENTHUSIASM</div>' +
        (R.flyoff ? '<div class="flyoff-note">⚔ SIDE-BY-SIDE FLY-OFF · VANTAGE DYNAMICS AT PAD B · LINE-BY-LINE ADJUDICATION</div>' : '') +
        '<hr class="doc-rule">' +
      '</div>' +
      '<div class="doc-sec">' +
        '<div class="bignums">' +
          '<div class="bignum"><div class="bn-lbl">TARGET CRATER</div><div class="bn-val">' + R.craterMin + '–' + R.craterMax + '</div><div class="bn-unit">METRES ⌀</div></div>' +
          '<div class="bignum"><div class="bn-lbl">PARTS BUDGET</div><div class="bn-val">$' + (R.budget / 1000).toFixed(1).replace('.0', '') + 'k</div><div class="bn-unit">$' + R.budget.toLocaleString() + ' HARD CAP</div></div>' +
          bigNum3(R) +
        '</div>' +
      '</div>' +
      '<div class="doc-sec">' +
        '<hr class="doc-rule thin">' +
        '<p class="spec-clause"><span class="cl">7.4.1(c)</span> — ' + R.clause + '</p>' +
        (R.clause2 ? '<p class="spec-clause"><span class="cl">' + (R.clause2.match(/^[\d.]+\([a-z]\)/) ? '' : '7.4.2(a) — ') + '</span>' + R.clause2 + '</p>' : '') +
        finePrint +
      '</div>' +
      '<div class="doc-sec">' +
        '<hr class="doc-rule thin">' +
        '<div class="payline"><span>DEVELOPMENT AWARD</span><b>' + fmt$(R.payout) + '</b></div>' +
        '<div class="payline"><span>CLEAN-DETONATION BONUS</span><b>+' + fmt$(R.bonusClean) + '</b></div>' +
      '</div>' +
      '<div class="doc-sec">' +
        '<div class="rival-box">' +
          '<div class="rival-logo">V</div>' +
          '<div class="rival-txt"><b>COMPETING BID FILED: VANTAGE DYNAMICS</b><br>' +
          '<span class="rival-quote">“We consider this procurement a formality.” — R.&nbsp;Cavendish&nbsp;Vane, VP of Client Triumph</span></div>' +
        '</div>' +
        '<div class="rfp-no" style="margin-top:12px">TEST SERIES ' + S.seed + ' · REPLY BY TELETYPE ONLY</div>' +
      '</div>';
    rfpTimers.forEach(clearTimeout); rfpTimers = [];
    var secs = doc.querySelectorAll('.doc-sec');
    $('btn-accept').disabled = true;
    secs.forEach(function (sec, i) {
      rfpTimers.push(setTimeout(function () { sec.classList.add('shown'); PGAudio.tick(); }, 150 + i * 380));
    });
    rfpTimers.push(setTimeout(function () { $('btn-accept').disabled = false; PGAudio.typeDing(); }, 150 + secs.length * 380));
    doc.onpointerdown = function () {
      rfpTimers.forEach(clearTimeout);
      secs.forEach(function (s) { s.classList.add('shown'); });
      $('btn-accept').disabled = false;
    };
  }

  /* ---------- enter build ---------- */
  function enterBuild(keepAssembly) {
    clearLater();
    S.phase = 'build';
    S.closeoutStep = -1;
    S.result = null;
    wst = null;
    $('wire-station').classList.add('hidden');
    $('schem-tab').classList.add('hidden');
    $('schem-card').classList.add('hidden');
    bay.detStage = null;
    bay.armStage = null;
    // the tinker loop: a kept build stays EXACTLY as you left it —
    // parts, wires, torque, seating, arming. Tweak one thing. Refire.
    if (!keepAssembly) {
      S.assembly = PG2.makeAssembly();
      S.assembly.refine.stock = JSON.parse(JSON.stringify(SAVE.stock));   // the war chest follows you
      S.assembly.paint = SAVE.paint || null;                              // so does the paint job
      clearHistory();
    }
    histUI();
    hidePartCard();
    showScreen(null); showUI('ui-bay');
    $('ui-bay').classList.remove('closeout');
    if (S.mode === 'rnd') {
      $('bay-brand-txt').textContent = 'WEAPONS ASSEMBLY · R&D';
      $('bay-attempt').textContent = 'SHOT #' + (SAVE.rndTests + 1);
      $('btn-torange').innerHTML = 'OUT THE BACK GATE →';
    } else {
      $('bay-brand-txt').textContent = 'REDSKY INC · ' + rfp().id;
      $('bay-attempt').textContent = 'TEST #' + (S.attempt + 1);
      $('btn-torange').innerHTML = 'TRUCK TO RANGE →';
    }
    buildPhase = S.assembly.shell ? buildPhase : 'structure';   // a fresh stand starts at STRUCTURE
    buildDrawer();
    refreshPhaseRail();
    setDrawerOpen(true, true);        // the drawer presents itself; grabbing a part folds it away
    $('stage-build').classList.remove('hidden');
    $('stage-bar').classList.add('hidden');
    $('wiring-ui').classList.add('hidden');
    $('dial-ui').classList.add('hidden');
    $('det-ui').classList.add('hidden');
    $('arm-ui').classList.add('hidden');
    bay.orbit.theta = 0.7; bay.orbit.phi = 1.18; bay.orbit.radius = 4.4;
    bay.orbit.target.set(0, 1.25, 0);
    bay.velTheta = bay.velPhi = 0;
    bay.device.rotation.y = 0;
    updateStandStory();
    rebuildDevice();
    refreshHUD();
  }
  function updateStandStory() {
    // the bay quietly tells the story of your convergence
    var tests = S.mode === 'rnd' ? SAVE.rndTests : contractRec(S.contract).tests;
    bay.repaintFloor(tests);
    bay.clipboard.visible = tests >= 3;
  }

  /* ================= CLOSE-OUT STAGE 1 — THE WIRING STATION =================
     A component board behind the access panel; a printed schematic on paper;
     three spools on a rack; a continuity tester on a coiled cord. The
     SCHEMATIC is the puzzle — the panel is seeded out of drawing order, and
     wrong terminals are accepted in silence. The tester sells certainty,
     one clip at a time. */
  var WIRE_HEX = { red: '#c8402e', yellow: '#d9b02e', green: '#3d9e57' };
  var WIRE_DIM = { red: '#7c2418', yellow: '#87691c', green: '#245c34' };
  var WIRE_W = { red: 6, yellow: 4.4, green: 5.2 };      // gauge, in pixels of swagger
  var GAUGE_IDX = { red: 0, green: 1, yellow: 2 };       // clip pitch: heavy → deep
  var wst = null;
  var schemPref = 'open';   // remembered across panel visits: 'open' | 'pinned'

  function stationRect() { return $('wire-station').getBoundingClientRect(); }
  function stPos(e) {
    var r = stationRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function endsAt(pin) {
    return (S.assembly.conns || []).filter(function (c) { return c.a === pin || c.b === pin; });
  }
  function termAt(p, rad) {
    var best = null, bestD = rad || 26;
    Object.keys(wst.terms).forEach(function (pin) {
      var t = wst.terms[pin];
      var dd = Math.hypot(t.x - p.x, t.y - p.y);
      if (dd < bestD) { bestD = dd; best = pin; }
    });
    return best;
  }
  function danglePoint(pin) {
    var t = wst.terms[pin];
    return { x: t.x + 4, y: t.y + 46 };
  }

  /* ---------- build the board ---------- */
  var COMP_SKIN = { bat: 'wc-painted', tmr: 'wc-metal', det: 'wc-bakelite', rly: 'wc-bakelite', sw: 'wc-metal', cap: 'wc-metal', jct: 'wc-bakelite', nfz: 'wc-metal' };
  function buildCompDiv(comp, x, y, w, h, nums) {
    var el = document.createElement('div');
    el.className = 'wcomp ' + (COMP_SKIN[comp.id] || 'wc-metal');
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.width = w + 'px'; el.style.height = h + 'px';
    var art = '';
    if (comp.id === 'bat') art = '';
    else if (comp.id === 'tmr') art = '<span class="wtmr-face"></span>';
    else if (comp.id === 'det') art = '<span class="wdet-dome"></span>';
    else if (comp.id === 'nfz') art = '<span class="wdet-dome"></span>';
    else if (comp.id === 'sw') art = '<span class="wsw-lever"></span>';
    else if (comp.id === 'jct') art = '<span class="wjct-bus"></span>';
    else if (comp.id === 'cap') art = '<span class="wcap-cyl" style="left:14%"></span><span class="wcap-cyl" style="left:41%"></span><span class="wcap-cyl" style="left:68%"></span>';
    else if (comp.id === 'rly') art = '<span class="wrly-div"></span><span class="wrly-lbl" style="left:8%">COIL</span><span class="wrly-lbl" style="right:8%">SW</span>';
    el.innerHTML =
      '<div class="wc-name">' + comp.name + '</div>' +
      '<div class="wc-stamp">' + comp.stamp + ' · LOT ' + S.seed.slice(0, 3) + '</div>' +
      '<div class="wc-art">' + art + '</div>' +
      '<div class="wstrip"></div>';
    // pins along the terminal strip
    var stripY = h - 18;
    comp.pins.forEach(function (pname, i) {
      var px = 12 + (i + 0.5) * (w - 24) / comp.pins.length;
      var pin = comp.id + '.' + i;
      var term = document.createElement('div');
      term.className = 'wterm';
      term.style.left = px + 'px'; term.style.top = stripY + 'px';
      term.style.setProperty('--slot', ((PG2.termNumbers(S.seed, rfp())[pin] * 47) % 80 - 40) + 'deg');
      term.dataset.pin = pin;
      el.appendChild(term);
      var num = document.createElement('div');
      num.className = 'wnum';
      num.style.left = px + 'px'; num.style.top = (stripY - 26) + 'px';
      num.textContent = nums[pin];
      el.appendChild(num);
      if (comp.id === 'bat') {
        var pol = document.createElement('div');
        pol.className = 'wpol';
        pol.style.left = (px - 4) + 'px'; pol.style.top = (stripY - 44) + 'px';
        pol.textContent = pname;
        el.appendChild(pol);
      }
      wst.pinLocal[pin] = { el: term, px: px, py: stripY };
    });
    if (comp.id === 'bat' && S.assembly.batteryl) {
      // BATTERY PACK L ships one more terminal on its block — stamped N.C.
      var aux = document.createElement('div');
      aux.className = 'wterm aux';
      aux.style.left = (w - 16) + 'px'; aux.style.top = stripY + 'px';
      el.appendChild(aux);
      var albl = document.createElement('div');
      albl.className = 'wpol aux';
      albl.style.left = (w - 30) + 'px'; albl.style.top = (stripY - 44) + 'px';
      albl.textContent = 'AUX N.C.';
      el.appendChild(albl);
    }
    return el;
  }
  function buildWiringStation() {
    var R = rfp();
    var spec = PG2.wiringSpec(R);
    var plan = PG2.panelPlan(S.seed, R);
    var nums = PG2.termNumbers(S.seed, R);
    var stEl = $('wire-station');
    var boardEl = $('wire-board');
    Array.prototype.slice.call(boardEl.children).forEach(function (ch) {
      if (ch.id !== 'wb-lamp') boardEl.removeChild(ch);
    });
    wst = {
      spec: spec, plan: plan, nums: nums,
      terms: {}, pinLocal: {}, spools: {}, drag: null, twist: null, testing: false,
      probes: {
        red: { pin: null, x: 0, y: 0, el: $('probe-red') },
        blk: { pin: null, x: 0, y: 0, el: $('probe-blk') }
      }
    };
    // geometry: 2-column board above the bench
    var benchTop = H - 128;
    var top = 96;
    var bw = Math.min(W - 20, 396);
    var rows = plan.rows;
    // leave a lane above the bench for the PANEL CLOSED button
    var ch = clamp(Math.floor((benchTop - top - 68) / rows), 100, 150);
    var bh = ch * rows + 14;
    var bx = (W - bw) / 2;
    var by = top + Math.max(0, Math.floor((benchTop - top - 18 - bh) / 3));
    boardEl.style.left = bx + 'px'; boardEl.style.top = by + 'px';
    boardEl.style.width = bw + 'px'; boardEl.style.height = bh + 'px';
    wst.board = { x: bx, y: by, w: bw, h: bh };
    // corner screws + etched plate
    [[7, 7], [bw - 18, 7], [7, bh - 18], [bw - 18, bh - 18]].forEach(function (sp) {
      var sc = document.createElement('div');
      sc.className = 'wb-screw';
      sc.style.left = sp[0] + 'px'; sc.style.top = sp[1] + 'px';
      boardEl.appendChild(sc);
    });
    var plate = document.createElement('div');
    plate.className = 'wb-plate';
    plate.style.right = '26px'; plate.style.top = '5px';
    plate.textContent = 'ACCESS PANEL · SERIES ' + S.seed;
    boardEl.appendChild(plate);
    // components into their seeded cells
    var cw = (bw - 3 * 10) / 2;
    var compH = ch - 10;
    plan.cells.forEach(function (cid, i) {
      var col = i % 2, row = Math.floor(i / 2);
      var cx = 10 + col * (cw + 10);
      var cy = 10 + row * ch;
      if (!cid) {   // a bare stretch of panel with a faded stencil
        var bare = document.createElement('div');
        bare.className = 'wb-plate';
        bare.style.left = (cx + cw / 2 - 34) + 'px'; bare.style.top = (cy + compH / 2) + 'px';
        bare.style.opacity = '.45';
        bare.textContent = 'SPARE FITMENT';
        boardEl.appendChild(bare);
        return;
      }
      var comp = null;
      spec.comps.forEach(function (c) { if (c.id === cid) comp = c; });
      boardEl.appendChild(buildCompDiv(comp, cx, cy, cw, compH, nums));
      comp.pins.forEach(function (_, pi) {
        var pin = comp.id + '.' + pi;
        var loc = wst.pinLocal[pin];
        wst.terms[pin] = { x: bx + cx + loc.px, y: by + cy + loc.py, el: loc.el };
      });
    });
    // spool rack
    var rack = $('spool-rack');
    rack.innerHTML = '';
    PG2.SPOOL_ORDER.forEach(function (cid) {
      var sp = PG2.SPOOLS[cid];
      var d = document.createElement('div');
      d.className = 'spool';
      d.dataset.color = cid;
      d.innerHTML = '<div class="spool-disc" style="--wire:' + WIRE_HEX[cid] + '"></div>' +
        '<div class="spool-lbl">' + sp.name + '<br>' + sp.gauge + '</div>';
      rack.appendChild(d);
    });
    // wire svg sizing
    var svg = $('wire-svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    // meter face
    buildMeterFace();
    setNeedle(-58);
    $('meter-read').textContent = 'CLIP BOTH PROBES';
    $('meter-read').className = '';
    // measure benches after layout
    later(30, function () {
      if (!wst) return;
      var r = stationRect();
      Array.prototype.slice.call(rack.children).forEach(function (d) {
        var rr = d.getBoundingClientRect();
        wst.spools[d.dataset.color] = { x: rr.left - r.left + rr.width / 2, y: rr.top - r.top + rr.height / 2 - 6 };
      });
      var tb = $('tester-box').getBoundingClientRect();
      wst.dock = {
        red: { x: tb.left - r.left + tb.width - 20, y: tb.top - r.top + 4 },
        blk: { x: tb.left - r.left + tb.width - 42, y: tb.top - r.top + 4 }
      };
      dockProbe('red'); dockProbe('blk');
      renderWires();
    });
    refreshTermStates();
    renderWires();
    buildSchematic();
  }
  function dockProbe(id) {
    var pr = wst.probes[id];
    pr.pin = null;
    pr.x = wst.dock ? wst.dock[id].x : 0;
    pr.y = wst.dock ? wst.dock[id].y : 0;
    pr.el.classList.remove('clipped');
    positionProbe(id);
  }
  function positionProbe(id) {
    var pr = wst.probes[id];
    pr.el.style.left = pr.x + 'px';
    pr.el.style.top = pr.y + 'px';
  }

  /* ---------- wires (SVG catenary + shadows + probe cords) ---------- */
  function wirePathD(p1, p2, sagMul) {
    var dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    var sag = Math.min(14 + dist * 0.24, 62) * (sagMul || 1);
    var mx = (p1.x + p2.x) / 2, my = Math.max(p1.y, p2.y) * 0.0 + (p1.y + p2.y) / 2 + sag;
    return 'M' + p1.x.toFixed(1) + ' ' + p1.y.toFixed(1) +
           ' Q' + mx.toFixed(1) + ' ' + my.toFixed(1) +
           ' ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
  }
  function connEnds(c) {
    var p1 = wst.terms[c.a] ? { x: wst.terms[c.a].x, y: wst.terms[c.a].y } : null;
    var p2 = c.b && wst.terms[c.b] ? { x: wst.terms[c.b].x, y: wst.terms[c.b].y } : (p1 ? danglePoint(c.a) : null);
    return p1 ? { p1: p1, p2: p2 } : null;
  }
  function renderWires() {
    if (!wst) return;
    var svg = $('wire-svg');
    var shadows = [], wires = [];
    (S.assembly.conns || []).forEach(function (c, i) {
      var e = connEnds(c);
      if (!e) return;
      var p2 = (wst.drag && wst.drag.kind === 'end' && wst.drag.conn === c) ? { x: wst.drag.x, y: wst.drag.y } : e.p2;
      var d = wirePathD(e.p1, p2);
      shadows.push('<path d="' + d + '" fill="none" stroke="rgba(0,0,0,.38)" stroke-width="' + (WIRE_W[c.color] + 1.5) + '" stroke-linecap="round"/>');
      wires.push('<path d="' + d + '" fill="none" stroke="' + WIRE_DIM[c.color] + '" stroke-width="' + (WIRE_W[c.color] + 2) + '" stroke-linecap="round"/>');
      wires.push('<path d="' + d + '" fill="none" stroke="' + WIRE_HEX[c.color] + '" stroke-width="' + WIRE_W[c.color] + '" stroke-linecap="round"/>');
      // ferrules
      wires.push('<circle cx="' + e.p1.x + '" cy="' + e.p1.y + '" r="4" fill="#cfd6dd" stroke="#22303c" stroke-width="1"/>');
      if (p2) wires.push('<circle cx="' + p2.x + '" cy="' + p2.y + '" r="' + (c.b ? 4 : 5.5) + '" fill="#cfd6dd" stroke="#22303c" stroke-width="1"/>');
    });
    // live pull from a spool
    if (wst.drag && wst.drag.kind === 'new') {
      var sp = wst.spools[wst.drag.color];
      if (sp) {
        var d2 = wirePathD(sp, { x: wst.drag.x, y: wst.drag.y }, 0.7);
        shadows.push('<path d="' + d2 + '" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="' + (WIRE_W[wst.drag.color] + 1) + '" stroke-linecap="round"/>');
        wires.push('<path d="' + d2 + '" fill="none" stroke="' + WIRE_HEX[wst.drag.color] + '" stroke-width="' + WIRE_W[wst.drag.color] + '" stroke-linecap="round"/>');
        wires.push('<circle cx="' + wst.drag.x + '" cy="' + wst.drag.y + '" r="5.5" fill="#cfd6dd" stroke="#22303c" stroke-width="1"/>');
      }
    }
    // probe cords: coiled (dashed) runs from the tester to each probe tip
    var cords = '';
    if (wst.dock) {
      ['red', 'blk'].forEach(function (id) {
        var pr = wst.probes[id];
        var anchor = { x: wst.dock[id].x - 8, y: wst.dock[id].y + 10 };
        var dd = wirePathD(anchor, { x: pr.x, y: pr.y + 4 }, 1.4);
        cords += '<path d="' + dd + '" fill="none" stroke="' + (id === 'red' ? '#8f2a1c' : '#1d232a') +
          '" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="3.5 2.5" opacity=".9"/>';
      });
    }
    svg.innerHTML = '<g transform="translate(3,7)" opacity=".8">' + shadows.join('') + '</g>' + cords + wires.join('');
  }
  function refreshTermStates() {
    if (!wst) return;
    Object.keys(wst.terms).forEach(function (pin) {
      var ends = endsAt(pin);
      var el = wst.terms[pin].el;
      el.classList.toggle('landed', ends.length > 0);
      el.classList.toggle('torqued', ends.length > 0 && ends.every(function (c) { return c.b && c.torqued; }));
    });
  }

  /* ---------- the continuity tester ---------- */
  function buildMeterFace() {
    var svg = $('meter-svg');
    var parts = ['<rect x="2" y="2" width="116" height="54" rx="5" fill="#0d1116" stroke="#2c2620" stroke-width="1.5"/>',
      '<rect x="6" y="6" width="108" height="46" rx="3" fill="#efe6cb"/>'];
    // scale arc + zones (needle pivots at 60,50)
    for (var i = 0; i <= 10; i++) {
      var a = (-64 + i * 12.8) * Math.PI / 180;
      var x1 = 60 + Math.sin(a) * 34, y1 = 50 - Math.cos(a) * 34;
      var x2 = 60 + Math.sin(a) * (i % 5 === 0 ? 28 : 31), y2 = 50 - Math.cos(a) * (i % 5 === 0 ? 28 : 31);
      parts.push('<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#3a3226" stroke-width="1"/>');
    }
    parts.push('<text x="22" y="18" font-size="6.5" font-family="monospace" fill="#8a2c1e">OPEN</text>');
    parts.push('<text x="82" y="18" font-size="6.5" font-family="monospace" fill="#25603a">CONT.</text>');
    parts.push('<g id="meter-needle" transform="rotate(-58 60 50)"><line x1="60" y1="50" x2="60" y2="14" stroke="#8f2418" stroke-width="1.8"/></g>');
    parts.push('<circle cx="60" cy="50" r="4" fill="#3a3226"/>');
    svg.innerHTML = parts.join('');
  }
  function setNeedle(deg) {
    var n = document.getElementById('meter-needle');
    if (n) n.setAttribute('transform', 'rotate(' + deg.toFixed(1) + ' 60 50)');
  }
  function runProbeCheck() {
    if (wst.testing) return;
    var pa = wst.probes.red.pin, pb = wst.probes.blk.pin;
    if (!pa || !pb) return;
    wst.testing = true;
    var res = PG2.probe(S.assembly, rfp(), pa, pb);
    var read = $('meter-read');
    read.textContent = 'MEASURING…';
    read.className = '';
    var target = res.verdict === 'correct' ? 52 : res.verdict === 'wrong' ? 6 : res.verdict === 'open' ? -42 : -50;
    var jitter = res.verdict === 'wrong' ? 5 : 1.2;
    tween(880, function (t, raw) {
      setNeedle(lerp(-58, target, t) + Math.sin(raw * 40) * jitter * (1 - t));
    });
    later(620, function () {
      if (res.verdict === 'correct') {
        PGAudio.needleTone('good');
        S.assembly.verified[res.runIdx] = true;
        read.textContent = '✓ RUN ' + (res.runIdx + 1) + ' — AS DRAWN' + (res.colorOk ? '' : ' *COLOUR');
        read.className = 'good';
      } else if (res.verdict === 'wrong') {
        PGAudio.needleTone('bad');
        read.textContent = '✗ NOT ON THE SCHEMATIC';
        read.className = 'bad';
      } else if (res.verdict === 'open') {
        PGAudio.needleTone('open');
        read.textContent = 'OPEN — DRAWING WANTS A RUN HERE';
        read.className = 'bad';
      } else {
        PGAudio.needleTone('open');
        read.textContent = 'NO CONNECTION';
        read.className = '';
      }
      updateWiringNote();
    });
    later(1500, function () { if (wst) wst.testing = false; });
  }

  /* ---------- the schematic card ---------- */
  var SCHEM_LAYOUTS = {
    t1: { h: 158, comps: { bat: [58, 104], tmr: [160, 52], det: [258, 104] } },
    t2: { h: 190, comps: { bat: [50, 128], sw: [132, 46], tmr: [222, 46], det: [262, 138] } },
    t3: { h: 212, comps: { bat: [44, 152], sw: [118, 42], tmr: [204, 42], rly: [268, 108], det: [168, 168] } },
    t4: { h: 236, comps: { bat: [42, 148], tmr: [122, 40], rly: [208, 92], cap: [106, 192], jct: [226, 196], det: [288, 40] } },
    ti: { h: 190, comps: { bat: [50, 128], sw: [132, 46], nfz: [222, 46], det: [262, 138] } }
  };
  function schemSymbol(comp, cx, cy, nums, rfpRef) {
    var ink = '#33291a';
    var s = '', pinPos = [];
    var n = comp.pins.length;
    function pinRow(y, span) {
      var out = [];
      for (var i = 0; i < n; i++) out.push({ x: cx - span / 2 + (n === 1 ? span / 2 : span * i / (n - 1)), y: cy + y });
      return out;
    }
    if (comp.id === 'nfz') {
      // the nose fuze: a cone with a striker dot — no clock face, no apologies
      s += '<path d="M' + (cx - 14) + ' ' + (cy - 12) + ' L' + (cx + 16) + ' ' + cy + ' L' + (cx - 14) + ' ' + (cy + 12) + ' Z" fill="none" stroke="' + ink + '" stroke-width="1.6"/>';
      s += '<circle cx="' + (cx + 16) + '" cy="' + cy + '" r="2.6" fill="' + ink + '"/>';
      s += '<line x1="' + (cx - 14) + '" y1="' + cy + '" x2="' + (cx - 22) + '" y2="' + cy + '" stroke="' + ink + '" stroke-width="1.2"/>';
      pinPos = [{ x: cx - 22, y: cy }, { x: cx + 22, y: cy }, { x: cx, y: cy + 23 }];
    } else if (comp.id === 'bat') {
      s += '<rect x="' + (cx - 26) + '" y="' + (cy - 14) + '" width="52" height="28" rx="2" fill="none" stroke="' + ink + '" stroke-width="1.6"/>';
      s += '<line x1="' + (cx - 8) + '" y1="' + (cy - 8) + '" x2="' + (cx - 8) + '" y2="' + (cy + 8) + '" stroke="' + ink + '" stroke-width="2.2"/>';
      s += '<line x1="' + (cx + 8) + '" y1="' + (cy - 4) + '" x2="' + (cx + 8) + '" y2="' + (cy + 4) + '" stroke="' + ink + '" stroke-width="1.2"/>';
      pinPos = pinRow(-22, 36);
    } else if (comp.id === 'tmr') {
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="15" fill="none" stroke="' + ink + '" stroke-width="1.6"/>';
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy - 9) + '" stroke="' + ink + '" stroke-width="1.4"/>';
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + 6) + '" y2="' + (cy + 4) + '" stroke="' + ink + '" stroke-width="1.2"/>';
      pinPos = n === 3 ? [{ x: cx - 22, y: cy }, { x: cx + 22, y: cy }, { x: cx, y: cy + 23 }]
                       : [{ x: cx - 22, y: cy }, { x: cx + 22, y: cy }];
    } else if (comp.id === 'sw') {
      s += '<line x1="' + (cx - 16) + '" y1="' + cy + '" x2="' + (cx + 12) + '" y2="' + (cy - 12) + '" stroke="' + ink + '" stroke-width="1.8"/>';
      s += '<circle cx="' + (cx - 16) + '" cy="' + cy + '" r="2.4" fill="' + ink + '"/>';
      s += '<circle cx="' + (cx + 16) + '" cy="' + cy + '" r="2.4" fill="' + ink + '"/>';
      pinPos = [{ x: cx - 22, y: cy }, { x: cx + 22, y: cy }];
    } else if (comp.id === 'rly') {
      s += '<rect x="' + (cx - 30) + '" y="' + (cy - 17) + '" width="60" height="34" rx="2" fill="none" stroke="' + ink + '" stroke-width="1.6"/>';
      s += '<line x1="' + cx + '" y1="' + (cy - 17) + '" x2="' + cx + '" y2="' + (cy + 17) + '" stroke="' + ink + '" stroke-width="1" stroke-dasharray="3 2"/>';
      for (var li = 0; li < 3; li++) {
        s += '<path d="M' + (cx - 24 + li * 8) + ' ' + cy + ' a4 4 0 0 1 8 0" fill="none" stroke="' + ink + '" stroke-width="1.4"/>';
      }
      s += '<line x1="' + (cx + 8) + '" y1="' + (cy + 6) + '" x2="' + (cx + 24) + '" y2="' + (cy - 6) + '" stroke="' + ink + '" stroke-width="1.6"/>';
      s += '<text x="' + (cx - 24) + '" y="' + (cy - 20) + '" font-size="6" font-family="monospace" fill="' + ink + '">COIL</text>';
      s += '<text x="' + (cx + 12) + '" y="' + (cy - 20) + '" font-size="6" font-family="monospace" fill="' + ink + '">SW</text>';
      pinPos = n === 4
        ? [{ x: cx - 24, y: cy + 25 }, { x: cx - 8, y: cy + 25 }, { x: cx + 8, y: cy + 25 }, { x: cx + 24, y: cy + 25 }]
        : [{ x: cx - 24, y: cy + 25 }, { x: cx - 8, y: cy + 25 }, { x: cx + 18, y: cy + 25 }];
    } else if (comp.id === 'cap') {
      for (var ci = 0; ci < 3; ci++) {
        var ox = cx - 12 + ci * 12;
        s += '<line x1="' + (ox - 3) + '" y1="' + (cy - 8) + '" x2="' + (ox - 3) + '" y2="' + (cy + 8) + '" stroke="' + ink + '" stroke-width="1.8"/>';
        s += '<line x1="' + (ox + 3) + '" y1="' + (cy - 8) + '" x2="' + (ox + 3) + '" y2="' + (cy + 8) + '" stroke="' + ink + '" stroke-width="1.8"/>';
      }
      pinPos = [{ x: cx - 24, y: cy }, { x: cx + 24, y: cy }];
    } else if (comp.id === 'jct') {
      s += '<rect x="' + (cx - 32) + '" y="' + (cy - 7) + '" width="64" height="14" rx="2" fill="none" stroke="' + ink + '" stroke-width="1.6"/>';
      pinPos = pinRow(-15, 48);
      s += '<text x="' + (cx + 8) + '" y="' + (cy + 22) + '" font-size="6" font-family="monospace" fill="#8a2c1e">3·4 N.C.</text>';
    } else {  // det
      s += '<rect x="' + (cx - 17) + '" y="' + (cy - 13) + '" width="34" height="26" rx="2" fill="none" stroke="' + ink + '" stroke-width="1.6"/>';
      s += '<path d="M' + cx + ' ' + (cy - 7) + ' l3 5 5 0 -4 4 2 6 -6 -4 -6 4 2 -6 -4 -4 5 0 z" fill="' + ink + '"/>';
      pinPos = pinRow(-21, n === 1 ? 0 : 24);
    }
    var label = '<text x="' + cx + '" y="' + (cy + (comp.id === 'jct' ? 30 : comp.id === 'rly' ? 38 : 30)) +
      '" font-size="6.6" font-weight="700" font-family="monospace" text-anchor="middle" fill="' + ink + '">' + comp.name + '</text>';
    var pins = '';
    comp.pins.forEach(function (pname, i) {
      var pp = pinPos[i];
      pins += '<circle cx="' + pp.x + '" cy="' + pp.y + '" r="2.6" fill="#f4ecd6" stroke="' + ink + '" stroke-width="1.3"/>';
      pins += '<text x="' + pp.x + '" y="' + (pp.y - 5) + '" font-size="6.4" font-weight="800" font-family="monospace" text-anchor="middle" fill="#8a2c1e">' +
        nums[comp.id + '.' + i] + '</text>';
      pins += '<text x="' + (pp.x + 5) + '" y="' + (pp.y + 7.5) + '" font-size="5" font-family="monospace" fill="' + ink + '" opacity=".75">' + pname + '</text>';
    });
    return { svg: s + label + pins, pins: pinPos };
  }
  function buildSchematic() {
    var R = rfp();
    var spec = wst.spec;
    var LAY = SCHEM_LAYOUTS[spec.key];
    var nums = wst.nums;
    $('schem-title').textContent = 'WIRING SCHEMATIC · ' + R.id;
    var svg = $('schem-svg');
    svg.setAttribute('viewBox', '0 0 320 ' + LAY.h);
    var pinXY = {};
    var body = '';
    spec.comps.forEach(function (comp) {
      var pos = LAY.comps[comp.id];
      var sym = schemSymbol(comp, pos[0], pos[1], nums, R);
      comp.pins.forEach(function (_, i) { pinXY[comp.id + '.' + i] = sym.pins[i]; });
      body += sym.svg;
    });
    // routed wire runs (drawn under the symbols' pins, over paper)
    var runsSvg = '';
    spec.runs.forEach(function (run, i) {
      var p1 = pinXY[run.a], p2 = pinXY[run.b];
      var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      var dx = p2.x - p1.x, dy = p2.y - p1.y;
      var len = Math.max(Math.hypot(dx, dy), 1);
      var bow = 10 + (i % 3) * 7;
      var cxp = mx - dy / len * bow, cyp = my + dx / len * bow;
      runsSvg += '<path d="M' + p1.x + ' ' + p1.y + ' Q' + cxp.toFixed(1) + ' ' + cyp.toFixed(1) + ' ' + p2.x + ' ' + p2.y +
        '" fill="none" stroke="' + WIRE_HEX[run.color] + '" stroke-width="2.2" opacity=".85"/>';
      var bx2 = (p1.x + cxp * 2 + p2.x) / 4, by2 = (p1.y + cyp * 2 + p2.y) / 4;   // on-curve midpoint
      runsSvg += '<circle cx="' + bx2.toFixed(1) + '" cy="' + by2.toFixed(1) + '" r="5.6" fill="#f4ecd6" stroke="' + WIRE_HEX[run.color] + '" stroke-width="1.6"/>' +
        '<text x="' + bx2.toFixed(1) + '" y="' + (by2 + 2.6).toFixed(1) + '" font-size="7" font-weight="800" font-family="monospace" text-anchor="middle" fill="#33291a">' + (i + 1) + '</text>';
    });
    svg.innerHTML = runsSvg + body;
    // the run list — the reading half of the puzzle
    var list = '';
    spec.runs.forEach(function (run, i) {
      var partsA = run.a.split('.'), partsB = run.b.split('.');
      list += '<div class="sr-row"><span class="sr-num">RUN ' + (i + 1) + '</span>' +
        '<span class="sr-chip" style="background:' + WIRE_HEX[run.color] + '"></span>' +
        '<span>' + run.label + ' — <b>T' + nums[run.a] + ' → T' + nums[run.b] + '</b></span></div>';
    });
    if (spec.decoys.length) {
      list += '<div class="sr-row"><span class="sr-num">N.C.</span><span class="sr-chip" style="background:transparent"></span>' +
        '<span>terminals T' + spec.decoys.map(function (p) { return nums[p]; }).join(' & T') + ' — NOT CONNECTED. Leave them be.</span></div>';
    }
    $('schem-runs').innerHTML = list;
  }
  function setSchem(state, silent) {
    if (!wst) return;
    var was = wst.schem;
    wst.schem = state;
    var card = $('schem-card');
    card.classList.toggle('hidden', state === 'closed');
    card.classList.toggle('pinned', state === 'pinned');
    $('schem-tab').textContent = state === 'open' ? '⚡ FOLD IT AWAY' : '⚡ SCHEMATIC';
    if (!silent && state !== was) PGAudio.paperFold(state === 'open');
    if (state !== 'closed') schemPref = state;
  }

  /* ---------- flow ---------- */
  function enterWiring() {
    S.phase = 'wiring';
    S.closeoutStep = 0;
    setDrawerOpen(false, true);
    $('ui-bay').classList.add('closeout');
    $('stage-build').classList.add('hidden');
    $('stage-bar').classList.remove('hidden');
    buildStageBar();
    setStageBar(0);
    if (bay.comMarker) bay.comMarker.visible = false;
    $('wiring-ui').classList.remove('hidden');
    $('bay-hint').style.opacity = 0;
    refreshNodes(null);
    // straighten the device & swing camera to the panel; the door opens on arrival
    var d = casingDims(S.assembly.shell);
    tweenOrbitTo(V3(0.08, 1.44, d.r + 1.72), V3(0, 1.31, d.r - 0.05), 1100, function () {
      tween(600, function (t) { bay.casingMesh.userData.doorPivot.rotation.x = -2.0 * t; });
      PGAudio.coverFlick();
      later(380, showWireStation);
    });
    var startRotY = bay.device.rotation.y % (Math.PI * 2);
    if (startRotY > Math.PI) startRotY -= Math.PI * 2;
    tween(700, function (t) { bay.device.rotation.y = lerp(startRotY, 0, t); });
    updateWiringNote();
  }
  function showWireStation() {
    if (S.phase !== 'wiring') return;
    buildWiringStation();
    var stEl = $('wire-station');
    stEl.classList.remove('hidden');
    stEl.style.opacity = 0;
    tween(420, function (t) { stEl.style.opacity = t; });
    $('schem-tab').classList.remove('hidden');
    // the schematic presents itself — you LOOK, then you wire
    setSchem((S.assembly.conns || []).length ? (schemPref === 'pinned' ? 'pinned' : 'open') : 'open', true);
    PGAudio.paperFold(true);
    updateWiringNote();
  }
  function updateWiringNote() {
    var note = $('wiring-note');
    if (!wst) {
      note.innerHTML = 'The access panel comes off. Somebody wired a shed once and now there’s a <b>procedure</b>.';
      $('btn-panel-done').classList.add('hidden');
      return;
    }
    var conns = S.assembly.conns || [];
    var N = wst.spec.runs.length;
    var complete = conns.filter(function (c) { return c.a && c.b; }).length;
    var dangling = conns.length - complete;
    var torqued = conns.filter(function (c) { return c.b && c.torqued; }).length;
    var v = PG2.verifiedRuns(S.assembly, rfp());
    if (conns.length === 0) {
      note.innerHTML = 'The <b>schematic</b> says which numbered terminals meet — the panel is not in drawing order. Pull wire from a <b>spool</b>, clip both ends.';
    } else if (complete < N) {
      note.innerHTML = complete + ' of <b>' + N + ' runs</b> landed' + (dangling ? ' · ' + dangling + ' dangling' : '') +
        '. The panel accepts whatever you clip. Quietly.';
    } else if (torqued < N) {
      note.innerHTML = 'All ' + N + ' runs landed. <b>Twist</b> each bright screw to torque it down (' + torqued + '/' + N + ').';
    } else {
      note.innerHTML = 'Wired and torqued. <b>Probes</b> verify a run against the drawing (' + v + '/' + N +
        ' verified) — certainty costs a minute. The range costs a morning.';
    }
    $('btn-panel-done').classList.toggle('hidden', !PG2.wiringComplete(S.assembly, rfp()));
  }

  /* ---------- station input ---------- */
  function grabLandedEnd(pin, conn) {
    // pull a wire end off this terminal and drag it (most recent unless told which)
    var ends = endsAt(pin);
    if (!ends.length) return false;
    var c = (conn && ends.indexOf(conn) >= 0) ? conn : ends[ends.length - 1];
    if (!c.b) {   // only end A landed: the wire comes back off in the hand
      S.assembly.conns.splice(S.assembly.conns.indexOf(c), 1);
      wst.drag = { kind: 'new', color: c.color, x: wst.terms[pin].x, y: wst.terms[pin].y };
    } else {
      if (c.a === pin) { c.a = c.b; }
      c.b = null;
      c.torqued = false;
      wst.drag = { kind: 'end', conn: c, x: wst.terms[pin].x, y: wst.terms[pin].y };
    }
    PGAudio.unsnap();
    refreshTermStates();
    renderWires();
    updateWiringNote();
    return true;
  }
  function wstDown(e) {
    if (S.phase !== 'wiring' || !wst) return;
    PGAudio.init();
    e.preventDefault();
    var stEl = $('wire-station');
    try { stEl.setPointerCapture(e.pointerId); } catch (err) {}
    var p = stPos(e);
    // 1) probes
    var pk = null;
    ['red', 'blk'].forEach(function (id) {
      var pr = wst.probes[id];
      if (Math.hypot(pr.x - p.x, pr.y - p.y) < 32) pk = id;
    });
    if (pk) {
      wst.drag = { kind: 'probe', id: pk, pid: e.pointerId };
      wst.probes[pk].pin = null;
      wst.probes[pk].el.classList.remove('clipped');
      PGAudio.pickup();
      return;
    }
    // 2) spools
    var spool = null;
    Object.keys(wst.spools).forEach(function (cid) {
      var sp = wst.spools[cid];
      if (Math.hypot(sp.x - p.x, sp.y - p.y) < 34) spool = cid;
    });
    if (spool) {
      if ((S.assembly.conns || []).length >= wst.spec.runs.length) {
        PGAudio.buzz();
        toast('The schematic calls for ' + wst.spec.runs.length + ' runs. Pull a landed wire to re-route it.');
        return;
      }
      wst.drag = { kind: 'new', color: spool, x: p.x, y: p.y, pid: e.pointerId };
      PGAudio.spoolPull();
      renderWires();
      return;
    }
    // 3) dangling wire ends
    var dangler = null;
    (S.assembly.conns || []).forEach(function (c) {
      if (c.b) return;
      var dp = danglePoint(c.a);
      if (Math.hypot(dp.x - p.x, dp.y - p.y) < 26) dangler = c;
    });
    if (dangler) {
      wst.drag = { kind: 'end', conn: dangler, x: p.x, y: p.y, pid: e.pointerId };
      PGAudio.pickup();
      return;
    }
    // 4) terminals: twist an untorqued landed screw, or pull an end to re-route
    var pin = termAt(p, 25);
    if (pin) {
      var ends = endsAt(pin);
      var unt = null;
      ends.forEach(function (c) { if (!unt && c.b && !c.torqued) unt = c; });
      if (unt) {
        var t = wst.terms[pin];
        wst.twist = { pin: pin, conn: unt, pid: e.pointerId, cx: t.x, cy: t.y, angle: null, acc: 0 };
        var ring = $('torque-ring');
        ring.classList.remove('hidden');
        ring.style.left = t.x + 'px';
        ring.style.top = t.y + 'px';
        $('torque-ring-fill').style.setProperty('--p', 0);
        return;
      }
      if (ends.length) { grabLandedEnd(pin); wst.drag && (wst.drag.pid = e.pointerId); return; }
      return;
    }
    // 5) grab a wire mid-span → detach its nearest end
    var bestC = null, bestEnd = null, bestD = 15;
    (S.assembly.conns || []).forEach(function (c) {
      if (!c.b) return;
      var e2 = connEnds(c);
      for (var i = 0; i <= 12; i++) {
        var t = i / 12;
        var sag = Math.min(14 + Math.hypot(e2.p2.x - e2.p1.x, e2.p2.y - e2.p1.y) * 0.24, 62);
        var mx = (e2.p1.x + e2.p2.x) / 2, my = (e2.p1.y + e2.p2.y) / 2 + sag;
        var qx = (1 - t) * (1 - t) * e2.p1.x + 2 * (1 - t) * t * mx + t * t * e2.p2.x;
        var qy = (1 - t) * (1 - t) * e2.p1.y + 2 * (1 - t) * t * my + t * t * e2.p2.y;
        var dd = Math.hypot(qx - p.x, qy - p.y);
        if (dd < bestD) { bestD = dd; bestC = c; bestEnd = t < 0.5 ? 'a' : 'b'; }
      }
    });
    if (bestC) {
      grabLandedEnd(bestEnd === 'a' ? bestC.a : bestC.b, bestC);
      if (wst.drag) wst.drag.pid = e.pointerId;
    }
  }
  function wstMove(e) {
    if (!wst) return;
    var p = stPos(e);
    if (wst.drag && e.pointerId === wst.drag.pid) {
      wst.drag.x = p.x; wst.drag.y = p.y;
      if (wst.drag.kind === 'probe') {
        var pr = wst.probes[wst.drag.id];
        pr.x = p.x; pr.y = p.y;
        positionProbe(wst.drag.id);
      }
      renderWires();
      return;
    }
    if (wst.twist && e.pointerId === wst.twist.pid) {
      var tw = wst.twist;
      var radial = Math.hypot(p.x - tw.cx, p.y - tw.cy);
      if (radial > 46 && tw.acc < 0.6) {
        // pulled straight off: convert the twist into a re-route drag
        $('torque-ring').classList.add('hidden');
        wst.twist = null;
        grabLandedEnd(tw.pin);
        if (wst.drag) { wst.drag.pid = e.pointerId; wst.drag.x = p.x; wst.drag.y = p.y; renderWires(); }
        return;
      }
      var ang = Math.atan2(p.y - tw.cy, p.x - tw.cx);
      if (tw.angle != null) {
        var delta = ang - tw.angle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        var prev = tw.acc;
        tw.acc += Math.abs(delta);
        if (Math.floor(tw.acc / 0.7) > Math.floor(prev / 0.7)) PGAudio.ratchet();
        var frac = clamp(tw.acc / (Math.PI * 2), 0, 1);
        $('torque-ring-fill').style.setProperty('--p', frac * 100);
        if (frac >= 1) {
          tw.conn.torqued = true;
          wst.twist = null;
          $('torque-ring').classList.add('hidden');
          PGAudio.torqueDone();
          refreshTermStates();
          updateWiringNote();
          return;
        }
      }
      tw.angle = ang;
    }
  }
  function wstUp(e) {
    if (!wst) return;
    var p = stPos(e);
    if (wst.twist && e.pointerId === wst.twist.pid) {
      wst.twist = null;
      $('torque-ring').classList.add('hidden');
    }
    if (!wst.drag || e.pointerId !== wst.drag.pid) return;
    var drag = wst.drag;
    wst.drag = null;
    if (drag.kind === 'probe') {
      var pin = termAt(p, 30);
      var pr = wst.probes[drag.id];
      if (pin) {
        pr.pin = pin;
        pr.x = wst.terms[pin].x + (drag.id === 'red' ? -3 : 3);
        pr.y = wst.terms[pin].y - 4;
        pr.el.classList.add('clipped');
        positionProbe(drag.id);
        PGAudio.probeClip();
        runProbeCheck();
      } else {
        dockProbe(drag.id);
        $('meter-read').textContent = 'CLIP BOTH PROBES';
        $('meter-read').className = '';
        setNeedle(-58);
      }
      renderWires();
      return;
    }
    var pin2 = termAt(p, 30);
    if (drag.kind === 'new') {
      if (pin2 && endsAt(pin2).length < 2) {
        S.assembly.conns.push({ a: pin2, b: null, color: drag.color, torqued: false });
        PGAudio.wireClip(GAUGE_IDX[drag.color]);
      } else {
        if (pin2) toast('That terminal already holds two ends.');
        PGAudio.wireDrop();
      }
    } else if (drag.kind === 'end') {
      var c = drag.conn;
      if (pin2 && pin2 !== c.a && endsAt(pin2).length < 2) {
        c.b = pin2;
        PGAudio.wireClip(GAUGE_IDX[c.color]);
      } else {
        if (pin2 === c.a) toast('Both ends on one terminal is a loop, not a run.');
        else if (pin2) toast('That terminal already holds two ends.');
        c.b = null;
        PGAudio.wireDrop();
      }
    }
    refreshTermStates();
    renderWires();
    updateWiringNote();
  }
  (function () {
    var stEl = $('wire-station');
    stEl.addEventListener('pointerdown', wstDown);
    stEl.addEventListener('pointermove', wstMove);
    stEl.addEventListener('pointerup', wstUp);
    stEl.addEventListener('pointercancel', wstUp);
  })();
  $('schem-tab').addEventListener('click', function () {
    PGAudio.tap();
    setSchem(wst && wst.schem === 'open' ? 'closed' : 'open');
  });
  $('schem-pin').addEventListener('click', function (e) {
    e.stopPropagation();
    PGAudio.tap();
    setSchem('pinned');
  });
  function exitWiring() {
    // fold the bench away, close the door over whatever you did
    $('wire-station').classList.add('hidden');
    $('schem-tab').classList.add('hidden');
    setSchem('closed', true);
    tween(500, function (t) { bay.casingMesh.userData.doorPivot.rotation.x = -2.0 * (1 - t); });
    PGAudio.thunk(false);
    later(420, rfp().dial ? enterDial : enterDet);
  }

  /* ================= CLOSE-OUT STAGE 1.5 — THE TIMER DIAL ================= */
  /* A mechanical dial, set by thumb against a vernier. Your misread is
     your timing error — the RFP's timing spec becomes a hands-on skill. */
  var dial = { cur: 5.0, drag: null, built: false, lastTickV: null };
  var DIAL_MIN = 0, DIAL_MAX = 10, DIAL_A0 = -225, DIAL_A1 = 45;   // degrees
  function dialAngle(v) { return DIAL_A0 + (v - DIAL_MIN) / (DIAL_MAX - DIAL_MIN) * (DIAL_A1 - DIAL_A0); }
  function buildDialFace() {
    if (dial.built) return;
    dial.built = true;
    var svg = $('dial-svg');
    var cx = 130, cy = 130;
    var parts = [];
    parts.push('<circle cx="130" cy="130" r="124" class="dl-bezel"/>');
    parts.push('<circle cx="130" cy="130" r="112" class="dl-face"/>');
    for (var t = 0; t <= 100; t++) {           // 0.1 s ticks
      var v = t / 10;
      var a = dialAngle(v) * Math.PI / 180;
      var major = t % 10 === 0, half = t % 5 === 0 && !major;
      var r1 = major ? 88 : half ? 94 : 100;
      var r2 = 106;
      parts.push('<line x1="' + (cx + Math.cos(a) * r1).toFixed(1) + '" y1="' + (cy + Math.sin(a) * r1).toFixed(1) +
        '" x2="' + (cx + Math.cos(a) * r2).toFixed(1) + '" y2="' + (cy + Math.sin(a) * r2).toFixed(1) +
        '" class="' + (major ? 'dl-tick-major' : half ? 'dl-tick-half' : 'dl-tick') + '"/>');
      if (major) {
        var rn = 74;
        parts.push('<text x="' + (cx + Math.cos(a) * rn).toFixed(1) + '" y="' + (cy + Math.sin(a) * rn + 4).toFixed(1) +
          '" class="dl-num" text-anchor="middle">' + Math.round(v) + '</text>');
      }
    }
    parts.push('<text x="130" y="166" class="dl-lbl" text-anchor="middle">T+ SECONDS</text>');
    parts.push('<text x="130" y="180" class="dl-lbl small" text-anchor="middle">RD-TIMER MK.4 · VERNIER PATTERN</text>');
    // needle shadow (parallax), needle, hub
    parts.push('<g id="dial-needle-sh"><line x1="130" y1="130" x2="130" y2="34" class="dl-needle-sh"/></g>');
    parts.push('<g id="dial-needle"><line x1="130" y1="130" x2="130" y2="30" class="dl-needle"/>' +
      '<line x1="130" y1="130" x2="130" y2="152" class="dl-needle tail"/></g>');
    parts.push('<circle cx="130" cy="130" r="9" class="dl-hub"/>');
    parts.push('<circle cx="130" cy="130" r="3.2" class="dl-hub-pin"/>');
    svg.innerHTML = parts.join('');
  }
  function updateDialNeedle() {
    var a = dialAngle(dial.cur) + 90;   // needle art points up = -90°
    var n = $('dial-needle'), sh = $('dial-needle-sh');
    n.setAttribute('transform', 'rotate(' + a.toFixed(2) + ' 130 130)');
    // slight parallax: the shadow lags across the face as the needle swings
    var lag = 1.6 + Math.sin(a * Math.PI / 180) * 1.2;
    sh.setAttribute('transform', 'translate(' + lag.toFixed(2) + ' 2.2) rotate(' + a.toFixed(2) + ' 130 130)');
  }
  function enterDial() {
    S.phase = 'dial';
    S.closeoutStep = 1;
    setStageBar(1);
    $('wiring-ui').classList.add('hidden');
    $('dial-ui').classList.remove('hidden');
    buildDialFace();
    dial.cur = PG2.timerSetOf(S.assembly);
    dial.lastTickV = Math.round(dial.cur * 10);
    updateDialNeedle();
    $('dial-note').innerHTML = 'Contract cue: <b>T+' + rfp().tSpec.toFixed(2) + ' s ±' + rfp().tTol +
      '</b>.<br>Thumb the dial. It slows near the ticks — read the vernier, not your hopes.';
    // swing the camera to the timer on the nose for continuity
    var d = casingDims(S.assembly.shell);
    var noseW = bay.device.localToWorld(V3(d.L / 2 + 0.1, 0, 0));
    tweenOrbitTo(noseW.clone().add(V3(1.35, 0.85, 1.7)), noseW, 900);
  }
  (function () {
    var svg = $('dial-svg');
    function angOf(e) {
      var r = svg.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    }
    svg.addEventListener('pointerdown', function (e) {
      if (S.phase !== 'dial') return;
      PGAudio.init();
      e.preventDefault();
      try { svg.setPointerCapture(e.pointerId); } catch (err) {}
      dial.drag = { pid: e.pointerId, ang: angOf(e) };
    });
    svg.addEventListener('pointermove', function (e) {
      if (!dial.drag || e.pointerId !== dial.drag.pid) return;
      var a = angOf(e);
      var delta = a - dial.drag.ang;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      dial.drag.ang = a;
      var dv = delta * 180 / Math.PI / 27;      // 27°/s on the face
      // gearing: the mechanism detents — fine rotation slows near each half-second tick
      var nearest = Math.round(dial.cur * 2) / 2;
      if (Math.abs(dial.cur - nearest) < 0.06) dv *= 0.35;
      dial.cur = clamp(dial.cur + dv, DIAL_MIN, DIAL_MAX);
      var tickV = Math.round(dial.cur * 10);
      if (tickV !== dial.lastTickV) {
        dial.lastTickV = tickV;
        PGAudio.ratchet();
      }
      updateDialNeedle();
    });
    function up(e) {
      if (dial.drag && e.pointerId === dial.drag.pid) dial.drag = null;
    }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
  })();
  $('btn-dial-done').addEventListener('click', function () {
    PGAudio.tap();
    PGAudio.seatClick();
    S.assembly.timerSet = Math.round(dial.cur * 100) / 100;
    $('dial-ui').classList.add('hidden');
    toast('Dial set. The vernier keeps your secret.');
    enterDet();
  });

  /* ================= CLOSE-OUT STAGE 2 — DETONATOR ================= */
  function enterDet() {
    S.phase = 'det';
    S.closeoutStep = stageIdx('DETONATOR');
    setStageBar(S.closeoutStep);
    $('wiring-ui').classList.add('hidden');
    $('dial-ui').classList.add('hidden');
    $('det-ui').classList.remove('hidden');
    $('btn-det-done').classList.add('hidden');
    $('btn-det-pull').classList.add('hidden');
    var d = casingDims(S.assembly.shell);
    var wellL = V3(wellX(S.assembly.shell), d.r + 0.05, 0);
    var wellW = bay.device.localToWorld(wellL.clone());
    var already = S.assembly.det.seated;
    if (bay.capPivot && !already) tween(600, function (t) { bay.capPivot.rotation.z = 1.9 * t; bay.capPivot.position.y = (d.r + 0.055) + 0.10 * t; });
    tweenOrbitTo(wellW.clone().add(V3(0.72, 0.62, 0.95)), wellW.clone().add(V3(-0.05, 0.02, 0)), 1000, function () {
      if (already) {
        bay.detStage = { seated: true, slam: S.assembly.det.slam, jolt: 0, p: 1, drag: null, det: null, caseG: null, path: null };
        updateSteady(bay.detStage);
        toast('Detonator already seated' + (S.assembly.det.slam > PG2.SLAM_THRESHOLD ? ' — with a shock impulse on the log.' : '.'));
        $('btn-det-done').classList.remove('hidden');
        $('btn-det-pull').classList.remove('hidden');
      } else {
        stageDetCase(wellW);
      }
    });
  }
  function stageDetCase(wellW) {
    var ds = { slam: 0, jolt: 0, p: 0, seated: false, drag: null };
    var caseG = new THREE.Group();
    var box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.2), mat(0x4a3b28));
    caseG.add(box);
    var foam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.16), mat(0x2b2b31, { shin: 2 }));
    foam.position.y = 0.05;
    caseG.add(foam);
    caseG.position.copy(wellW.clone().add(V3(0.34, 0.28, 0.42)));
    bay.scene.add(caseG);
    var det = buildDetonator();
    det.position.copy(caseG.position.clone().add(V3(0, 0.13, 0)));
    det.rotation.z = 0.25;
    bay.scene.add(det);
    ds.caseG = caseG; ds.det = det;
    ds.path = [
      det.position.clone(),
      wellW.clone().add(V3(0, 0.55, 0)),
      wellW.clone().add(V3(0, 0.30, 0)),
      wellW.clone().add(V3(0, 0.115, 0))
    ];
    updateSteady(ds);
    bay.detStage = ds;
  }
  function detPathPoint(p) {
    var path = bay.detStage.path;
    var segs = path.length - 1;
    var f = clamp(p, 0, 1) * segs;
    var i = Math.min(Math.floor(f), segs - 1);
    return path[i].clone().lerp(path[i + 1], f - i);
  }
  function detClosestParam(worldPt) {
    var path = bay.detStage.path;
    var best = 0, bestD = 1e9;
    for (var i = 0; i <= 60; i++) {
      var t = i / 60;
      var d = detPathPoint(t).distanceTo(worldPt);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }
  function detDown(e, p) {
    var ds = bay.detStage;
    if (!ds || ds.seated || !ds.det) return;
    var sp = worldToScreen(ds.det.position, bay.camera);
    if (Math.hypot(sp.x - p.x, sp.y - p.y) < 70) {
      ds.drag = { pid: e.pointerId, lastX: p.x, lastY: p.y, lastT: performance.now(), lastV: 0 };
      PGAudio.pickup();
    }
  }
  function detMove(e, p) {
    var ds = bay.detStage;
    if (!ds || !ds.drag || e.pointerId !== ds.drag.pid || ds.seated) return;
    var now = performance.now();
    var dt = Math.max(now - ds.drag.lastT, 1) / 1000;
    var dist = Math.hypot(p.x - ds.drag.lastX, p.y - ds.drag.lastY);
    var v = dist / dt; // px/s
    ds.drag.lastX = p.x; ds.drag.lastY = p.y; ds.drag.lastT = now;
    // project pointer to a camera-facing plane through the well
    var ndc = new THREE.Vector2((p.x / W) * 2 - 1, -(p.y / H) * 2 + 1);
    raycaster.setFromCamera(ndc, bay.camera);
    var n = new THREE.Vector3();
    bay.camera.getWorldDirection(n);
    var plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, ds.path[2]);
    var hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return;
    var target = detClosestParam(hit);
    ds.p += clamp(target - ds.p, -0.09, 0.09);
    // steadiness: speed spikes hurt, and hurt double in the well
    var jolt = clamp((v - 700) / 1900, 0, 1);
    ds.jolt = Math.max(ds.jolt * 0.9, jolt);
    if (ds.p > 0.55) {
      ds.slam = Math.max(ds.slam, jolt);
      PGAudio.slide();
    }
    updateSteady(ds);
    ds.det.position.copy(detPathPoint(ds.p));
    ds.det.rotation.z = 0.25 * (1 - clamp(ds.p * 2, 0, 1));
    if (ds.p >= 0.94) seatDetonator(v);
  }
  function detUp(e, p) {
    var ds = bay.detStage;
    if (ds && ds.drag && e.pointerId === ds.drag.pid) ds.drag = null;
  }
  function updateSteady(ds) {
    var fill = $('steady-fill');
    fill.style.width = (ds.jolt * 100) + '%';
    var read = $('steady-read');
    if (ds.slam > 0.55) { read.textContent = 'SHOCK IMPULSE LOGGED'; read.className = 'bad'; }
    else if (ds.jolt > 0.66) { read.textContent = 'TOO FAST'; read.className = 'bad'; }
    else if (ds.jolt > 0.33) { read.textContent = 'EASY…'; read.className = 'warn'; }
    else { read.textContent = 'STEADY'; read.className = ''; }
  }
  function seatDetonator(v) {
    var ds = bay.detStage;
    if (ds.seated) return;
    ds.seated = true;
    ds.drag = null;
    ds.det.position.copy(ds.path[3]);
    ds.det.rotation.z = 0;
    S.assembly.det.seated = true;
    S.assembly.det.slam = clamp(ds.slam, 0, 1);
    if (ds.slam > PG2.SLAM_THRESHOLD) {
      PGAudio.slam();
      toast('Seated hard. Shock impulse logged to the handling record.');
    } else {
      PGAudio.seatClick();
      toast('Detonator seated. A small, reassuring click.');
    }
    updateSteady(ds);
    // cap closes back over it
    var d = casingDims(S.assembly.shell);
    if (bay.capPivot) later(500, function () {
      tween(500, function (t) {
        bay.capPivot.rotation.z = 1.9 * (1 - t);
        bay.capPivot.position.y = (d.r + 0.055) + 0.10 * (1 - t);
      }, function () { PGAudio.thunk(false); });
    });
    later(300, function () {
      $('btn-det-done').classList.remove('hidden');
      $('btn-det-pull').classList.remove('hidden');
    });
  }

  /* ================= CLOSE-OUT STAGE 3 — ARM ================= */
  function enterArm() {
    S.phase = 'arm';
    S.closeoutStep = stageIdx('ARM');
    setStageBar(S.closeoutStep);
    $('det-ui').classList.add('hidden');
    $('arm-ui').classList.remove('hidden');
    if (bay.detStage) {
      bay.scene.remove(bay.detStage.caseG);
      bay.scene.remove(bay.detStage.det);
    }
    document.querySelector('.ck-head').textContent = 'PRE-FLIGHT CLOSE-OUT · ' + rfp().id;
    ['ck-wiring', 'ck-torque', 'ck-det', 'ck-dial'].forEach(function (id) { $(id).classList.remove('shown'); });
    $('ck-foot').textContent = S.assembly.armed ? 'Still armed from last time. It remembers.' : 'Flip the guard. Throw the switch.';
    var pm = bay.armPanelMesh;
    var pw = pm.getWorldPosition(new THREE.Vector3());
    bay.armStage = { coverOpen: false, drag: null };
    tweenOrbitTo(pw.clone().add(V3(0.28, 0.32, 0.78)), pw, 900, function () {
      stampChecklist();
    });
  }
  function stampChecklist() {
    var a = S.assembly;
    var N = PG2.wiringSpec(rfp()).runs.length;
    var v = PG2.verifiedRuns(a, rfp());
    var conns = a.conns || [];
    var lines = [
      { id: 'ck-wiring', ok: PG2.wiringComplete(a, rfp()),
        okTxt: '✓ VERIFIED ' + v + '/' + N + ' RUNS',
        sub: N + ' runs landed' + (v >= N ? ' — the tester agrees' : v > 0 ? ' — the rest ride on faith' : ' — verified by optimism') },
      { id: 'ck-torque', ok: conns.length > 0 && conns.every(function (c) { return c.b && c.torqued; }),
        okTxt: '✓ TORQUED', sub: 'all terminals to spec' },
      { id: 'ck-det', ok: a.det.seated,
        okTxt: a.det.slam > PG2.SLAM_THRESHOLD ? '✓ SEATED*' : '✓ SEATED',
        sub: a.det.slam > PG2.SLAM_THRESHOLD ? '*handling log attached' : 'clean seat, full depth' }
    ];
    $('ck-dial').classList.toggle('gone', !rfp().dial);
    if (rfp().dial) {
      lines.splice(1, 0, { id: 'ck-dial', ok: a.timerSet != null,
        okTxt: '✓ DIAL SET', sub: 'the vernier keeps your secret' });
    }
    lines.forEach(function (l, i) {
      later(350 + i * 550, function () {
        var el = $(l.id);
        el.classList.add('shown');
        var st = el.querySelector('.ck-stamp');
        if (l.ok) {
          st.innerHTML = l.okTxt + '<span class="ck-sub">' + l.sub + '</span>';
          st.className = 'ck-stamp ok';
          PGAudio.stampThud();
        } else {
          st.innerHTML = '¯\\_(ツ)_/¯ UNVERIFIED';
          st.className = 'ck-stamp unv';
          PGAudio.buzz();
        }
      });
    });
    later(350 + lines.length * 550 + 200, function () {
      $('btn-torange').classList.remove('hidden');
    });
  }
  function armDown(e, p) {
    var st = bay.armStage;
    if (!st) return;
    var pm = bay.armPanelMesh;
    var coverW = pm.userData.coverPivot.getWorldPosition(new THREE.Vector3());
    var sp = worldToScreen(coverW, bay.camera);
    if (!st.coverOpen) {
      if (Math.hypot(sp.x - p.x, sp.y - p.y) < 120) st.drag = { pid: e.pointerId, sy: p.y, kind: 'cover' };
      return;
    }
    // cover open: tap the lever
    var levW = pm.userData.leverPivot.getWorldPosition(new THREE.Vector3());
    var lp = worldToScreen(levW, bay.camera);
    if (Math.hypot(lp.x - p.x, lp.y - p.y) < 90 && S.assembly.armed) { toast('Already armed. Kindly stop touching it.'); return; }
    if (Math.hypot(lp.x - p.x, lp.y - p.y) < 90 && !S.assembly.armed) {
      S.assembly.armed = true;
      PGAudio.switchClack();
      tween(260, function (t) { pm.userData.leverPivot.rotation.x = lerp(-0.5, 0.6, t); });
      pm.userData.led.material.emissive.setHex(0xff2f1e);
      pm.userData.led.material.emissiveIntensity = 1.4;
      pm.userData.led.material.color.setHex(0xff5040);
      $('ck-foot').innerHTML = '<b style="color:#8f2418">ARMED.</b> The device is now interested in everything you do.';
      toast('ARMED. Kindly stop touching it.');
    }
  }
  function armMove(e, p) {
    var st = bay.armStage;
    if (!st || !st.drag || e.pointerId !== st.drag.pid) return;
    if (st.drag.kind === 'cover' && !st.coverOpen) {
      var dy = st.drag.sy - p.y;
      var pm = bay.armPanelMesh;
      var ang = clamp(dy / 70, 0, 1) * -1.9;
      pm.userData.coverPivot.rotation.x = ang;
      if (dy > 48) {
        st.coverOpen = true;
        st.drag = null;
        PGAudio.coverFlick();
        tween(220, function (t) { pm.userData.coverPivot.rotation.x = lerp(ang, -2.1, t); });
        $('ck-foot').textContent = 'Guard open. The switch waits.';
      }
    }
  }
  function armUp(e, p) {
    var st = bay.armStage;
    if (!st || !st.drag || e.pointerId !== st.drag.pid) return;
    if (st.drag.kind === 'cover' && !st.coverOpen) {
      var pm = bay.armPanelMesh;
      var cur = pm.userData.coverPivot.rotation.x;
      tween(200, function (t) { pm.userData.coverPivot.rotation.x = lerp(cur, 0, t); });
    }
    st.drag = null;
  }

  function stageNames() {
    return rfp().dial ? ['WIRING', 'TIMER', 'DETONATOR', 'ARM'] : ['WIRING', 'DETONATOR', 'ARM'];
  }
  function stageIdx(name) { return stageNames().indexOf(name); }
  function buildStageBar() {
    var bar = $('stage-bar');
    bar.innerHTML = stageNames().map(function (n, i) {
      return '<div class="sb-step" data-step="' + i + '">' + (i + 1) + ' · ' + n + '</div>';
    }).join('');
  }
  function setStageBar(step) {
    document.querySelectorAll('.sb-step').forEach(function (el) {
      var i = parseInt(el.dataset.step, 10);
      el.classList.toggle('on', i === step);
      el.classList.toggle('done', i < step);
    });
  }
  function tweenOrbitTo(camPos, target, dur, done) {
    var o = bay.orbit;
    var c0 = bay.camera.position.clone();
    var t0 = o.target.clone();
    bay.lockOrbit = true;
    tween(dur, function (t) {
      bay.camera.position.lerpVectors(c0, camPos, t);
      o.target.lerpVectors(t0, target, t);
      bay.camera.lookAt(o.target);
    }, done);
  }

  /* ================= RANGE SCENE (v2 — the stage, not the play) ================= */
  /* time-of-day palettes: each contract picks one; the convoy always drives at dawn */
  var RANGE_PAL = {
    dawn: {
      sky: [[0, '#16264a'], [0.36, '#54628c'], [0.56, '#c8825e'], [0.72, '#eda86e'], [1, '#f5c98c']],
      fog: 0xd9a878, fogNear: 1250, fogFar: 4100,
      hemiSky: 0xb9c6e4, hemiGnd: 0x7a5638, hemiI: 0.58,
      sun: 0xffc182, sunI: 1.2, sunPos: [-950, 210, 480],
      mesas: [0x8a5a40, 0x9c6d5c, 0xa07890, 0x9884ab],   // warm near → violet far
      terrTint: 0xffd9b8,
      shimmer: 0.45, longShadow: true
    },
    noon: {
      sky: [[0, '#4f97d6'], [0.5, '#a9cade'], [0.78, '#e9e3cf'], [1, '#efe6c6']],
      fog: 0xe8dfc6, fogNear: 1600, fogFar: 4900,
      hemiSky: 0xdcecf8, hemiGnd: 0xa08a62, hemiI: 1.02,
      sun: 0xfff6e0, sunI: 1.15, sunPos: [140, 1100, 300],
      mesas: [0xb08258, 0xc09a76, 0xccb69c, 0xd2c8b8],                 // bleached, blue-shifted far
      terrTint: 0xffffff,
      shimmer: 1.0, longShadow: false
    },
    dusk: {
      sky: [[0, '#1a1533'], [0.34, '#43305e'], [0.55, '#8c4a5e'], [0.74, '#d97a50'], [1, '#f2b56a']],
      fog: 0xb07a6a, fogNear: 1100, fogFar: 3800,
      hemiSky: 0x8f7fb0, hemiGnd: 0x5e4030, hemiI: 0.5,
      sun: 0xff9a5e, sunI: 1.05, sunPos: [980, 160, 420],
      mesas: [0x6e4550, 0x5e4060, 0x554373, 0x4c4480],   // ember-lit near → violet-night far
      terrTint: 0xe8a988,
      shimmer: 0.2, longShadow: true
    }
  };
  function applyRangePalette(name) {
    var p = RANGE_PAL[name] || RANGE_PAL.dawn;
    if (!range.skyCache) range.skyCache = {};
    if (!range.skyCache[name]) range.skyCache[name] = gradientTexture(p.sky, true);
    range.scene.background = range.skyCache[name];
    range.scene.fog.color.setHex(p.fog);
    range.scene.fog.near = p.fogNear;
    range.scene.fog.far = p.fogFar;
    range.hemi.color.setHex(p.hemiSky);
    range.hemi.groundColor.setHex(p.hemiGnd);
    range.hemi.intensity = p.hemiI;
    range.sun.color.setHex(p.sun);
    range.sun.intensity = p.sunI;
    range.sun.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
    range.mesas.forEach(function (m, i) { m.material.color.setHex(p.mesas[Math.min(i, p.mesas.length - 1)]); });
    range.terrain.material.color.setHex(p.terrTint);
    range.shimmerBase = p.shimmer;
    range.palette = name;
  }
  function buildWheel(r, wdt) {
    var g = new THREE.Group();
    var tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, wdt, 12), mat(0x22262b, { shin: 4 }));
    tyre.rotation.x = Math.PI / 2;
    g.add(tyre);
    var hub = new THREE.Mesh(new THREE.BoxGeometry(r * 1.1, r * 0.34, wdt + 0.04), mat(0x545d66, { shin: 30 }));
    g.add(hub);
    return g;
  }
  function fakeShadow(w, l) {
    // dawn drives cheap long shadows — a stretched dark decal, not a shadow map
    var m = new THREE.Mesh(new THREE.PlaneGeometry(l, w),
      new THREE.MeshBasicMaterial({ color: 0x1c1208, transparent: true, opacity: 0.26, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = 0.42;   // away from the low sun
    return m;
  }
  function initRange() {
    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xe3d4b0, 1400, 3600);
    var camera = new THREE.PerspectiveCamera(7, W / H, 0.5, 8000);

    var hemi = new THREE.HemisphereLight(0xcfe0f0, 0x8a6a42, 0.85);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff3da, 1.0);
    sun.position.set(-800, 900, 500);
    scene.add(sun);

    // terrain (flattened along the convoy road corridor at world z≈26)
    var tg = new THREE.PlaneGeometry(6000, 6000, 56, 56);
    var pos = tg.attributes.position;
    var colors = [];
    var col = new THREE.Color();
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i);
      var wz = -y;   // plane is rotated -90° about X: local +y → world −z
      var r2 = Math.hypot(x, y);
      var h = 0;
      if (r2 > 60) {
        h = Math.sin(x * 0.004 + 1.7) * Math.cos(y * 0.0031) * 7 +
            Math.sin(x * 0.013 + y * 0.009) * 2.5;
        h *= clamp((r2 - 60) / 300, 0, 1);
        h *= clamp((Math.abs(wz - 26) - 14) / 26, 0, 1);   // road corridor stays drivable
      }
      pos.setZ(i, h);
      var shade = 0.84 + Math.sin(x * 0.05) * Math.cos(y * 0.043) * 0.09 + Math.sin(x * 0.21 + y * 0.17) * 0.045;
      col.setRGB(0.82 * shade, 0.615 * shade, 0.37 * shade);
      colors.push(col.r, col.g, col.b);
    }
    tg.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    tg.computeVertexNormals();
    var terrain = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true }));
    terrain.rotation.x = -Math.PI / 2;
    scene.add(terrain);

    // mesas — four ridge lines now, blue-shifting into the fog with distance
    var mesas = [];
    [{ z: -900, h: 48, sp: 2200 }, { z: -1500, h: 74, sp: 3000 },
     { z: -2200, h: 104, sp: 4200 }, { z: -3050, h: 128, sp: 5800 }].forEach(function (m, mi) {
      var pts = [], n = 26;
      for (var i = 0; i <= n; i++) {
        var x = -m.sp / 2 + m.sp * i / n;
        var hh = (Math.sin(i * 2.3 + mi * 5) * 0.5 + 0.5) * m.h * (i % 5 === 2 ? 1 : 0.55) + 8;
        pts.push({ x: x, h: hh });
      }
      var shape = new THREE.Shape();
      shape.moveTo(pts[0].x, 0);
      pts.forEach(function (p2) { shape.lineTo(p2.x, p2.h); });
      shape.lineTo(pts[n].x, 0);
      shape.closePath();
      var geo = new THREE.ExtrudeGeometry(shape, { depth: 60, bevelEnabled: false });
      var mesh = new THREE.Mesh(geo, mat(0xb08258, { shin: 2 }));
      mesh.position.set(0, 0, m.z);
      scene.add(mesh);
      mesas.push(mesh);
    });

    // pad
    var pad = new THREE.Group();
    var slab = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 10), mat(0xb9b3a4, { shin: 4 }));
    slab.position.y = 0.3;
    pad.add(slab);
    var mast = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), mat(0x8f2f24));
    mast.position.set(-4.5, 3.5, -4);
    pad.add(mast);
    scene.add(pad);

    // pad dressing — sandbags and cable runs (consumed by any real detonation)
    var padDress = new THREE.Group();
    var bagRand = PG2.stream('RANGE', 'bags');
    for (var bi = 0; bi < 9; bi++) {
      var bag = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.8), mat(0xa89468, { shin: 3 }));
      var ba = 2.2 + bi * 0.16 + bagRand() * 0.1;
      bag.position.set(14 + Math.cos(ba) * 3.2 + bagRand(), 0.28 + (bi % 3 === 2 ? 0.5 : 0), 8 + Math.sin(ba) * 2.4);
      bag.rotation.y = bagRand() * 0.8;
      padDress.add(bag);
    }
    var jbox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1, 0.8), mat(0x445260, { shin: 10 }));
    jbox.position.set(14.5, 0.5, 7.4);
    padDress.add(jbox);
    var cablePts = [V3(-4.5, 0.12, -3), V3(2, 0.1, 4), V3(9, 0.1, 6.4), V3(14.2, 0.12, 7.2)];
    var cable = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 20, 0.07, 5, false),
      mat(0x1d232a, { shin: 8 }));
    padDress.add(cable);
    var cable2 = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(14.6, 0.12, 7.8), V3(30, 0.1, 22), V3(52, 0.1, 44)]), 12, 0.06, 5, false),
      mat(0x1d232a, { shin: 8 }));
    padDress.add(cable2);
    scene.add(padDress);

    // further out (survives the blast): wind sock, bunker, the volunteer's helmet on a post
    var farDress = new THREE.Group();
    var wsPole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 8), mat(0xd8dde2, { shin: 30 }));
    wsPole.position.set(-46, 3.5, -22);
    farDress.add(wsPole);
    var sock = new THREE.Group();
    var sockCone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 8, 1, true), mat(0xe07b2a, { shin: 6 }));
    sockCone.rotation.z = Math.PI / 2;
    sockCone.position.x = 1.6;
    sock.add(sockCone);
    sock.position.set(-46, 6.8, -22);
    sock.rotation.z = -1.05;
    farDress.add(sock);
    var bunker = new THREE.Mesh(new THREE.BoxGeometry(9, 2.4, 5), mat(0x8a7a58, { shin: 2 }));
    bunker.position.set(-38, 1.0, 44);
    bunker.rotation.y = 0.3;
    farDress.add(bunker);
    var slit = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 0.3), mat(0x14181d, { shin: 2 }));
    slit.position.set(-37.2, 1.7, 46.4);
    slit.rotation.y = 0.3;
    farDress.add(slit);
    var post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.4, 7), mat(0x6b4a2a));
    post.position.set(-30, 1.2, 40);
    farDress.add(post);
    var helmet = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(0x7a8452, { shin: 24 }));   // two sizes too large
    helmet.position.set(-30, 2.35, 40);
    helmet.rotation.z = 0.22;
    farDress.add(helmet);
    scene.add(farDress);

    // jackrabbit (the pre-countdown life beat)
    var rabbit = new THREE.Group();
    var rBody = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 7), mat(0xb2a28c, { shin: 4 }));
    rBody.scale.set(1.25, 0.9, 0.8);
    rBody.position.y = 0.45;
    rabbit.add(rBody);
    var rHead = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), mat(0xb8a894, { shin: 4 }));
    rHead.position.set(0.48, 0.78, 0);
    rabbit.add(rHead);
    [-0.07, 0.07].forEach(function (ez) {
      var ear = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.14), mat(0xa89684, { shin: 4 }));
      ear.position.set(0.42, 1.24, ez);
      ear.rotation.z = -0.18;
      rabbit.add(ear);
    });
    var rTail = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), mat(0xe8e2d4));
    rTail.position.set(-0.5, 0.5, 0);
    rabbit.add(rTail);
    rabbit.visible = false;
    scene.add(rabbit);

    // device on trestle (built from the actual assembly at range entry)
    var deviceHolder = new THREE.Group();
    deviceHolder.position.set(0, 1.6, 0);
    deviceHolder.scale.set(1.6, 1.6, 1.6);
    scene.add(deviceHolder);

    // flatbed truck (wheels grouped so they can roll)
    var truck = new THREE.Group();
    var bed = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 2.6), mat(0x51616e));
    bed.position.set(-0.7, 1.35, 0);
    truck.add(bed);
    var cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 2.4), mat(0xb0392b));
    cab.position.set(3.4, 1.9, 0);
    truck.add(cab);
    var glass = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 2.0), mat(0x9cc8ea, { shin: 80 }));
    glass.position.set(4.4, 2.3, 0);
    truck.add(glass);
    var truckWheels = [];
    for (var wi = 0; wi < 3; wi++) {
      [-1.2, 1.2].forEach(function (z) {
        var wheel = buildWheel(0.55, 0.4);
        wheel.position.set(-2.6 + wi * 2.9, 0.55, z);
        truck.add(wheel);
        truckWheels.push(wheel);
      });
    }
    scene.add(truck);
    truck.visible = false;

    // escort truck — rides ahead of the article
    var escort = new THREE.Group();
    var ebody = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.1, 2.2), mat(0x5c6b52));
    ebody.position.set(-0.3, 1.25, 0);
    escort.add(ebody);
    var ecab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 2.1), mat(0x4d5a45));
    ecab.position.set(1.9, 2.1, 0);
    escort.add(ecab);
    var eglass = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 1.7), mat(0x9cc8ea, { shin: 80 }));
    eglass.position.set(2.8, 2.35, 0);
    escort.add(eglass);
    var canvasTop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 2.1), mat(0x8a7a58, { shin: 3 }));
    canvasTop.position.set(-1.0, 2.25, 0);
    escort.add(canvasTop);
    var escortWheels = [];
    [-1.5, 1.5].forEach(function (x) {
      [-1.05, 1.05].forEach(function (z) {
        var wheel = buildWheel(0.5, 0.36);
        wheel.position.set(x, 0.5, z);
        escort.add(wheel);
        escortWheels.push(wheel);
      });
    });
    scene.add(escort);
    escort.visible = false;

    // convoy-only dressing: road, telephone poles, long fake dawn shadows
    var convoyG = new THREE.Group();
    var road = new THREE.Mesh(new THREE.PlaneGeometry(620, 7.5),
      new THREE.MeshLambertMaterial({ color: 0x9a815c }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(-100, 0.14, 26);
    convoyG.add(road);
    [-1.6, 1.6].forEach(function (dz) {
      var rut = new THREE.Mesh(new THREE.PlaneGeometry(620, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x82694a }));
      rut.rotation.x = -Math.PI / 2;
      rut.position.set(-100, 0.16, 26 + dz);
      convoyG.add(rut);
    });
    for (var pi = 0; pi < 16; pi++) {
      var px = -330 + pi * 24;
      var pole = new THREE.Group();
      var pshaft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 7.2, 6), mat(0x5c4630, { shin: 2 }));
      pshaft.position.y = 3.6;
      pole.add(pshaft);
      var parm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.12), mat(0x4d3a28, { shin: 2 }));
      parm.position.y = 6.6;
      pole.add(parm);
      var pshadow = fakeShadow(0.5, 15);
      pshadow.position.set(6.4, 0.05, -1.6);
      pole.add(pshadow);
      pole.position.set(px, 0, 18.5);
      convoyG.add(pole);
    }
    var truckShadow = fakeShadow(3.4, 17);
    convoyG.add(truckShadow);
    var escortShadow = fakeShadow(2.8, 13);
    convoyG.add(escortShadow);
    convoyG.visible = false;
    scene.add(convoyG);

    // dust pool — washboard-road dust kicking from wheels
    var dustPool = [];

    // heat shimmer bands + a low near-ground layer over the pan
    var shimmer = [];
    for (var si = 0; si < 3; si++) {
      var sm = new THREE.Mesh(new THREE.PlaneGeometry(2400, 14 + si * 9),
        new THREE.MeshBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0.05, depthWrite: false }));
      sm.position.set(0, 9 + si * 12, -420 - si * 260);
      scene.add(sm);
      shimmer.push(sm);
    }
    var nearShimmer = new THREE.Mesh(new THREE.PlaneGeometry(420, 5),
      new THREE.MeshBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0.06, depthWrite: false }));
    nearShimmer.position.set(0, 2.4, 70);
    scene.add(nearShimmer);

    return {
      scene: scene, camera: camera, pad: pad, padDress: padDress, farDress: farDress,
      sock: sock, rabbit: rabbit, deviceHolder: deviceHolder,
      truck: truck, truckWheels: truckWheels, escort: escort, escortWheels: escortWheels,
      convoyG: convoyG, truckShadow: truckShadow, escortShadow: escortShadow,
      dustPool: dustPool,
      hemi: hemi, sun: sun, terrain: terrain,
      mesas: mesas, shimmer: shimmer, nearShimmer: nearShimmer, shimmerBase: 1,
      fx: null, shake: 0, convoyShake: 0, mode: 'idle', palette: null
    };
  }

  /* ---------- range flow ---------- */
  function buildChains() {
    // the article is chained to the bed — the player's actual build, tied down
    if (range.chains) { range.truck.remove(range.chains); range.chains = null; }
    if (!S.assembly.shell) return;
    var d = casingDims(S.assembly.shell);
    var chains = new THREE.Group();
    var rr = d.r * 0.62 + 0.42;
    [-0.75, 0.75].forEach(function (dx) {
      var arc = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.035, 5, 14, Math.PI),
        mat(0x2e343a, { shin: 30 }));
      arc.rotation.y = Math.PI / 2;
      arc.position.set(-0.7 + dx * d.L * 0.62 * 0.5, 1.62, 0);
      chains.add(arc);
      [-1, 1].forEach(function (sz) {
        var buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.07), mat(0x8f9aa5, { shin: 60 }));
        buckle.position.set(-0.7 + dx * d.L * 0.62 * 0.5, 1.5, sz * rr);
        chains.add(buckle);
      });
    });
    range.truck.add(chains);
    range.chains = chains;
  }
  function spawnDust(x, y, z, big) {
    var pool = range.dustPool;
    var d = null;
    for (var i = 0; i < pool.length; i++) if (!pool[i].live) { d = pool[i]; break; }
    if (!d) {
      if (pool.length >= 26) return;
      d = { sp: new THREE.Sprite(new THREE.SpriteMaterial({ map: fxTextures().dust, transparent: true, depthWrite: false })) };
      range.scene.add(d.sp);
      pool.push(d);
    }
    d.live = true;
    d.t = 0;
    d.life = 1.7 + Math.random() * 0.9;
    d.sp.visible = true;
    d.sp.position.set(x, y, z);
    d.vx = -2.6 - Math.random() * 2;
    d.vy = 1.3 + Math.random() * 0.9;
    d.vz = (Math.random() - 0.5) * 1.4;
    d.grow = (big ? 4.6 : 3.2) + Math.random() * 2.2;
    d.sp.scale.set(1, 1, 1);
    d.sp.material.opacity = 0.5;
  }
  function stepDust(dt) {
    range.dustPool.forEach(function (d) {
      if (!d.live) return;
      d.t += dt;
      var k = d.t / d.life;
      if (k >= 1) { d.live = false; d.sp.visible = false; return; }
      d.sp.position.x += d.vx * dt;
      d.sp.position.y += d.vy * dt;
      d.sp.position.z += d.vz * dt;
      var s = 1 + d.grow * easeOut(k);
      d.sp.scale.set(s, s, 1);
      d.sp.material.opacity = 0.5 * (1 - k);
    });
  }
  var CONVOY_LEN = 14.6;

  /* ---------- weather: per-contract wind (presentation) ---------- */
  function windOf(R) {
    var w = R.wind || { dir: 110, speed: 0.35 };
    var rad = w.dir * Math.PI / 180;
    return { dir: rad, speed: w.speed, x: Math.cos(rad) * w.speed, z: Math.sin(rad) * w.speed };
  }

  /* ---------- persistent terrain scarring: the range remembers ---------- */
  function recordScar(r) {
    var o = r.outcome;
    if (!o.fired || o.craterActual == null) return;
    var id = r.rfp.id;
    if (!SAVE.scars[id]) SAVE.scars[id] = [];
    var sr = PG2.stream(S.seed, 'scar' + S.attempt);
    var ang = sr() * Math.PI * 2;
    var dist = 26 + sr() * 40;
    SAVE.scars[id].push({
      x: Math.round(Math.cos(ang) * dist * 10) / 10,
      z: Math.round(Math.sin(ang) * dist * 10) / 10,
      r: Math.round(o.craterActual * 5) / 10,       // radius, metres
      e: Math.round((o.ellipse || 1) * 100) / 100,
      o: Math.round((o.offsetM || 0) * 10) / 10
    });
    if (SAVE.scars[id].length > 8) SAVE.scars[id].shift();   // cap live meshes
    persist();
  }
  function rebuildScars() {
    if (range.scarG) { range.scene.remove(range.scarG); range.scarG = null; }
    var list = SAVE.scars[rfp().id] || [];
    if (!list.length) return;
    var g = new THREE.Group();
    if (!range.scarTex) {
      var c = document.createElement('canvas');
      c.width = c.height = 128;
      var x = c.getContext('2d');
      var gr = x.createRadialGradient(64, 64, 8, 64, 64, 64);
      gr.addColorStop(0, 'rgba(30,22,14,0.85)');
      gr.addColorStop(0.45, 'rgba(58,42,26,0.55)');
      gr.addColorStop(1, 'rgba(80,60,38,0)');
      x.fillStyle = gr;
      x.fillRect(0, 0, 128, 128);
      range.scarTex = new THREE.CanvasTexture(c);
      range.scarTex.encoding = THREE.sRGBEncoding;
    }
    list.forEach(function (s) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(s.r * 3.4 * (s.e || 1), s.r * 3.4),
        new THREE.MeshBasicMaterial({ map: range.scarTex, transparent: true, depthWrite: false, opacity: 0.85 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(s.x + (s.o || 0), 0.22, s.z);
      g.add(m);
      var bowl = new THREE.Mesh(new THREE.CircleGeometry(s.r * 0.85, 20),
        new THREE.MeshBasicMaterial({ color: 0x1f1710, transparent: true, opacity: 0.8, depthWrite: false }));
      bowl.rotation.x = -Math.PI / 2;
      bowl.scale.x = s.e || 1;
      bowl.position.set(s.x + (s.o || 0), 0.24, s.z);
      g.add(bowl);
    });
    range.scene.add(g);
    range.scarG = g;
  }

  /* ---------- SKIPSTONE: the drop rig and the painted plate ---------- */
  function buildDropRig() {
    if (range.dropRig) {
      range.dropRig.visible = true;
      if (range.dropCable) range.dropCable.visible = true;
      return;
    }
    var g = new THREE.Group();
    [-5, 5].forEach(function (x) {
      var post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 13, 0.7), mat(0x6b4a2a));
      post.position.set(x, 6.5, 0);
      post.castShadow = true;
      g.add(post);
      var foot = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 1.7), mat(0x22303c));
      foot.position.set(x, 0.2, 0);
      g.add(foot);
      var brace = new THREE.Mesh(new THREE.BoxGeometry(0.28, 7.2, 0.28), mat(0x5c4a30));
      brace.position.set(x * 0.72, 3.3, x > 0 ? -0.9 : 0.9);
      brace.rotation.z = x > 0 ? 0.34 : -0.34;
      g.add(brace);
    });
    var beam = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.6, 0.8), mat(0x6b4a2a));
    beam.position.set(0, 13.1, 0);
    beam.castShadow = true;
    g.add(beam);
    var winch = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.0), mat(0x2f3b46));
    winch.position.set(0, 13.0, 0);
    g.add(winch);
    var cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), mat(0x22262b));
    cable.position.set(0, 12.4, 0);
    g.add(cable);
    range.dropCable = cable;
    // the plate: dark steel, a painted band at the contract's placement spec
    var plate = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.6, 0.3, 36), mat(0x3c4450, { shin: 40 }));
    plate.position.y = 0.16;
    plate.receiveShadow = true;
    g.add(plate);
    var bandR = (rfp().impact && rfp().impact.band) || 2.2;
    var band = new THREE.Mesh(new THREE.TorusGeometry(bandR, 0.16, 8, 44), mat(COL.amber, { emissive: COL.amber, ei: 0.35 }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.33;
    g.add(band);
    var dot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 20), mat(0xd8dde2, { shin: 30 }));
    dot.position.y = 0.34;
    g.add(dot);
    range.scene.add(g);
    range.dropRig = g;
  }

  /* ---------- THE FLY-OFF: Pad B, dressed and occupied ---------- */
  function buildVantagePad() {
    var g = new THREE.Group();
    var slab = new THREE.Mesh(new THREE.BoxGeometry(9, 0.55, 9), mat(0xa8a296, { shin: 4 }));
    slab.position.y = 0.28;
    g.add(slab);
    [-0.9, 0.9].forEach(function (x) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 1.7), mat(0x3c4046));
      leg.position.set(x, 0.75, 0);
      g.add(leg);
    });
    // their article: sleek, gunmetal, a nose too pointed to be honest
    var art = new THREE.Group();
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 3.4, 16), mat(0x2f3742, { shin: 55 }));
    body.rotation.z = Math.PI / 2;
    art.add(body);
    var noseC = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.5, 16), mat(0xd8dde2, { shin: 70 }));
    noseC.rotation.z = -Math.PI / 2;
    noseC.position.x = 2.45;
    art.add(noseC);
    var tail = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2f3742, { shin: 55 }));
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -1.7;
    art.add(tail);
    var stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.63, 0.28, 16), mat(0xcfd6dd, { shin: 60 }));
    stripe.rotation.z = Math.PI / 2;
    stripe.position.x = 0.6;
    art.add(stripe);
    var vlogo = textPlane('VANTAGE', 1.6, 0.34, { color: '#cfd6dd', px: 60 });
    vlogo.position.set(-0.4, 0.1, 0.64);
    art.add(vlogo);
    art.position.y = 2.2;
    g.add(art);
    g.userData.article = art;
    // a small proprietary flag
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 6), mat(0xd8dde2, { shin: 40 }));
    pole.position.set(-3.6, 1.7, 3.4);
    g.add(pole);
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.7), mat(0x27417a, { shin: 8 }));
    flag.position.set(-2.95, 3.05, 3.4);
    g.add(flag);
    g.position.set(-34, 0, -16);
    return g;
  }
  function vantageBeat(done) {
    // their test resolves first, seeded — full presentation, compressed
    var vf = S.result.flyoff ? S.result.flyoff.v : null;
    if (!vf) { done(); return; }
    setCaption('PAD B · VANTAGE DYNAMICS', 'Coin toss says they fire first. Their VP waves at the newsreel camera.');
    var padPos = V3(-34, 0, -16);
    later(3300, function () {
      if (vf.fail && vf.mode === 'dud') {
        setCaption('PAD B · T+0.0 · NO EVENT', 'Silence. More silence. A man in a Vantage blazer walks briskly toward a telephone.');
        later(3600, function () {
          setCaption('ORDNANCE WEEKLY · WIRE COPY', '“' + vf.headline + '” — ' + vf.sub);
          later(2800, done);
        });
        return;
      }
      // they fire: flash + dust at Pad B
      PGAudio.beep(true);
      var tx = fxTextures();
      var flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx.flash, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      flash.position.copy(padPos).add(V3(0, 4, 0));
      flash.scale.set(1, 1, 1);
      range.scene.add(flash);
      var vG = range.vantageG;
      if (vG && vG.userData.article) vG.userData.article.visible = false;
      tween(2400, function (t) {
        var s = 4 + t * (vf.fail ? 30 : 52);
        flash.scale.set(s, s, 1);
        flash.material.opacity = Math.pow(1 - t, 1.6);
      }, function () { range.scene.remove(flash); });
      for (var i = 0; i < 8; i++) spawnDust(padPos.x + (Math.random() - 0.5) * 6, 2 + Math.random() * 3, padPos.z + (Math.random() - 0.5) * 6, true);
      later(900, function () { PGAudio.detonation(vf.fail ? 0.3 : 0.7, vf.fail && vf.mode === 'ragged'); });
      later(1900, function () {
        var line = vf.fail
          ? (vf.mode === 'early' ? 'It fired mid-speech. The lectern is a memory. The crater is real, though — ' : 'Three bangs, one apology. Measured anyway — ') +
            (vf.crater != null ? vf.crater.toFixed(1) + ' m.' : '')
          : 'Clean flash, fast column. Survey calls it ' + vf.crater.toFixed(1) + ' m' + (vf.clean ? ', round as a coin.' : ', with a second lobe they will dispute.');
        setCaption('PAD B · MEASURED', line);
        later(3100, function () {
          setCaption('STATION 7 · YOUR PAD', 'The board turns its binoculars. Pad A is yours. No pressure beyond the historical kind.');
          later(1600, done);
        });
      });
    });
  }
  function enterRange() {
    clearLater();
    S.attempt++;
    contractRec(S.contract).tests++;   // chalk on the bay floor, forever
    persist();
    S.result = PG2.adjudicate(S.assembly, S.seed, rfp());
    if (!range) range = initRange();
    S.phase = 'truck';
    showUI('ui-range');
    $('stage-bar').classList.add('hidden');
    $('arm-ui').classList.add('hidden');
    $('cam-overlay').classList.add('hidden');
    $('cam-tick').classList.add('hidden');
    $('measure-svg').classList.add('hidden');
    $('btn-arm').classList.add('hidden');
    $('btn-fire').classList.add('hidden');
    $('arm-ring').style.setProperty('--p', 0);
    $('flash').style.opacity = 0;
    $('dustwall').style.opacity = 0;
    window.__pgMeasureDone = false;
    // clean leftovers from a previous run
    if (range.fx && range.fx.group) range.scene.remove(range.fx.group);
    range.fx = null;
    if (range.craterG) { range.scene.remove(range.craterG); range.craterG = null; }
    if (range.vantageG) { range.scene.remove(range.vantageG); range.vantageG = null; }
    if (range.dropRig) range.dropRig.visible = false;
    range.vBeatSkip = null;
    range.deviceHolder.rotation.z = 0;
    msr.active = false;
    rebuildScars();
    range.wind = windOf(rfp());
    range.deviceHolder.visible = true;
    range.pad.visible = true;
    range.padDress.visible = true;
    if (range.trestle) range.trestle.visible = false;
    range.rabbit.visible = false;
    range.rabbit.userData.run = null;
    range.shake = 0;
    range.convoyShake = 0;
    // THE CONVOY — always at dawn; the range day itself keeps the contract's hour
    applyRangePalette('dawn');
    // put the real device on the flatbed
    var dh = range.deviceHolder;
    for (var i = dh.children.length - 1; i >= 0; i--) dh.remove(dh.children[i]);
    var dev = buildRangeDevice();
    dh.add(dev);
    dh.position.set(-0.7, 2.0, 0);
    dh.scale.set(0.62, 0.62, 0.62);
    range.truck.add(dh);
    buildChains();
    range.truck.visible = true;
    range.escort.visible = true;
    range.convoyG.visible = true;
    range.truck.position.set(-96, 0, 26);
    range.escort.position.set(-80, 0, 26);
    range.mode = 'truck';
    var caps = [
      { t: 0.25, small: 'SECTOR 9 · ACCESS ROAD · 05:41', main: 'Dawn. Two trucks, one article, eleven miles of washboard.' },
      { t: 3.9, small: 'RADIO · CONVOY LEAD', radio: true, main: '—Range Seven, Range Seven: convoy’s got the article, over.' },
      { t: 7.1, small: 'RADIO · RANGE SEVEN', radio: true, main: '—Copy, convoy. Pad A is swept. The board brought binoculars and opinions.' },
      { t: 11.6, small: 'RADIO · CONVOY LEAD', radio: true, main: '—Gate in sight. Keep the dust polite, over and out.' }
    ];
    if (!S.result.outcome.slammed) {
      caps.splice(3, 0, { t: 9.3, small: 'RADIO · ESCORT 2', radio: true, main: '—Article’s riding quiet back there. Wish everything did.' });
    }
    range.convoy = {
      t: 0, t0: performance.now(), shot: -1, capIdx: 0, caps: caps, dustT: 0,
      slammed: !!S.result.outcome.slammed, joltT0: null
    };
    PGAudio.engineStart();
    $('btn-skip-truck').classList.remove('hidden');
    if (SETTINGS.skipCine) later(150, stationSeven);
    else later(CONVOY_LEN * 1000, stationSeven);
  }
  function buildRangeDevice() {
    // rebuild from assembly (independent copies for the range scene)
    var g = new THREE.Group();
    var a = S.assembly;
    if (!a.shell) return g;
    g.add(buildCasing(a.shell));
    var d = casingDims(a.shell);
    a.canisters.forEach(function (c, i) {
      if (!c) return;
      var m = buildCanister(c);
      m.position.set(slotXs(a.shell)[i], d.r + 0.04, 0);
      g.add(m);
    });
    if (a.timer) { var t = buildTimer(); t.position.set(d.L / 2 + 0.02, 0, 0); g.add(t); }
    if (a.impactfuze) { var nf = buildImpactFuze(); nf.position.set(d.L / 2 + 0.02, 0, 0); g.add(nf); }
    if (a.battery) { var b = buildBattery(); b.position.set(-d.L / 2 - 0.16, 0, 0); g.add(b); }
    if (a.batteryl) { var bl = buildBatteryL(); bl.position.set(-d.L / 2 - 0.16, 0, 0); g.add(bl); }
    if (a.delayrelay) { var dr = buildDelayRelay(); dr.position.set(d.L * 0.28, -0.13, d.r - 0.02); g.add(dr); }
    if (a.harness) { var hn = buildHarness(); hn.position.set(-d.L * 0.05, -d.r - 0.02, 0); g.add(hn); }
    if (a.cap) { var c2 = buildCap(); c2.position.set(wellX(a.shell), d.r + 0.055, 0); g.add(c2); }
    if (a.fins) { var f = buildFins(); f.position.set(-d.L / 2 + 0.28, 0, 0); g.add(f); }
    if (a.panel) { var p = buildArmPanel(); p.position.set(-d.L * 0.31, 0.05, d.r + 0.02); p.userData.leverPivot.rotation.x = a.armed ? 0.6 : -0.5; g.add(p); }
    return g;
  }
  function stationSeven() {
    if (S.phase !== 'truck') return;
    clearLater();
    S.phase = 'station';
    PGAudio.engineStop();
    $('btn-skip-truck').classList.add('hidden');
    range.mode = 'station';
    range.truck.visible = false;
    range.escort.visible = false;
    range.convoyG.visible = false;
    range.dustPool.forEach(function (d) { d.live = false; d.sp.visible = false; });
    // the range day keeps the contract's hour: dawn for 041, harsh noon for 048
    applyRangePalette(rfp().timeOfDay || 'dawn');
    // device moves to a trestle on the pad
    var dh = range.deviceHolder;
    range.truck.remove(dh);
    range.scene.add(dh);
    dh.scale.set(1.7, 1.7, 1.7);
    dh.rotation.z = 0;
    dh.visible = true;
    if (rfp().impact) {
      // SKIPSTONE: the article hangs from the rig arm over the painted plate
      buildDropRig();
      dh.position.set(0, 12, 0);
      if (range.trestle) range.trestle.visible = false;
    } else {
      dh.position.set(0, 2.1, 0);
      if (range.dropRig) range.dropRig.visible = false;
      // trestle
      if (!range.trestle) {
        var tr = new THREE.Group();
        [-0.9, 0.9].forEach(function (x) {
          var leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.5, 1.6), mat(0x6b4a2a));
          leg.position.set(x, 0.75, 0);
          tr.add(leg);
        });
        range.scene.add(tr);
        range.trestle = tr;
      }
      range.trestle.visible = true;
    }
    // Station 7 long lens
    range.camera.position.set(60, 14, 1600);
    range.camera.fov = 7;
    range.camera.updateProjectionMatrix();
    range.camera.lookAt(0, rfp().impact ? 6.5 : 3, 0);
    $('cam-overlay').classList.remove('hidden');
    $('cam-station').textContent = PG2.CAMERA.id + ' — ' + PG2.CAMERA.km.toFixed(1) + ' KM';
    var cue = rfp().tSpec;
    $('cam-clock').textContent = 'T−00:' + (cue < 10 ? '0' : '') + cue.toFixed(1);
    PGAudio.wind();
    var todLine = { noon: 'The review board raises its binoculars. Heat swims over the pan.',
                    dusk: 'The review board raises its binoculars. The sun is going down on somebody’s contract.',
                    dawn: 'The review board raises its binoculars. The pan is still cold enough to be honest.' };
    if (rfp().impact) {
      setCaption('STATION 7 · DROP RIG · PAD A',
        'Twelve metres of rig arm, one painted plate, one article that only speaks on contact.');
    } else {
      setCaption('STATION 7 · LONG LENS · f/64', todLine[rfp().timeOfDay] || todLine.dawn);
    }
    // the pre-countdown life beat: a jackrabbit clears the frame
    later(2100, startRabbit);
    if (rfp().flyoff) {
      // Pad B, occupied. They fire first. Then it's your range.
      if (!range.vantageG) {
        range.vantageG = buildVantagePad();
        range.scene.add(range.vantageG);
      }
      var armIn = function () {
        range.vBeatSkip = null;
        $('btn-skip-truck').classList.add('hidden');
        $('btn-arm').classList.remove('hidden');
      };
      if (SETTINGS.skipCine) {
        var vf = S.result.flyoff && S.result.flyoff.v;
        setCaption('PAD B · VANTAGE, ALREADY MEASURED', vf && vf.crater != null
          ? 'Their article posted ' + vf.crater.toFixed(1) + ' m. Your pad is hot.'
          : 'Their article posted nothing at all. Your pad is hot.');
        later(1600, armIn);
      } else {
        $('btn-skip-truck').classList.remove('hidden');
        range.vBeatSkip = armIn;
        later(2400, function () { vantageBeat(armIn); });
      }
    } else {
      later(1800, function () { $('btn-arm').classList.remove('hidden'); });
    }
  }
  function startRabbit() {
    if (S.phase !== 'station') return;
    var r = PG2.stream(S.seed, 'rabbit' + S.attempt);
    var dir = r() < 0.5 ? 1 : -1;
    range.rabbit.userData.run = { t: 0, dir: dir, dur: 2.7, z: 1185 + r() * 12 };
    range.rabbit.visible = true;
  }
  function stepRabbit(dt) {
    var run = range.rabbit.userData.run;
    if (!run) return;
    run.t += dt;
    var k = run.t / run.dur;
    if (k >= 1) {
      range.rabbit.visible = false;
      range.rabbit.userData.run = null;
      return;
    }
    // crosses the long-lens foreground in a few urgent hops
    var x = 44 + run.dir * lerp(-9, 9, k);
    var hop = Math.abs(Math.sin(k * Math.PI * 5));
    range.rabbit.position.set(x, hop * 0.5, run.z);
    range.rabbit.scale.set(0.55, 0.55 + hop * 0.08, 0.55);   // an honest-sized jackrabbit
    range.rabbit.rotation.y = run.dir > 0 ? 0 : Math.PI;
    range.rabbit.rotation.z = hop * 0.22 * (Math.sin(k * Math.PI * 10) > 0 ? 1 : -0.4);
  }
  /* the convoy — a proper dawn drive to the range, always skippable */
  function stepConvoy(dt, now) {
    var cv = range.convoy;
    if (!cv) return;
    cv.t = (now - cv.t0) / 1000;   // wall clock — stays in step with the Station 7 handoff
    var speed = 8.5;
    var tx = -96 + speed * cv.t;
    var ex = tx + 16;
    // washboard road
    var bob = Math.sin(cv.t * 21) * 0.045 + Math.sin(cv.t * 33 + 1.7) * 0.028;
    var bob2 = Math.sin(cv.t * 19 + 3) * 0.038;
    // pothole beat — only if the detonator went in hard (physical foreshadowing)
    var jolt = 0;
    if (cv.slammed && cv.joltT0 == null && cv.t >= 8.55) {
      cv.joltT0 = cv.t;
      PGAudio.rattle();
      PGAudio.radioBlip();
      range.convoyShake = 1;
      setCaption('RADIO · ESCORT 2', '—Easy over the washboard, fellas. That article was seated… <b>firmly</b>.');
    }
    if (cv.joltT0 != null) {
      var jt = cv.t - cv.joltT0;
      if (jt < 0.8) jolt = Math.sin(jt * 15) * Math.exp(-5.5 * jt) * 0.5;
    }
    range.truck.position.set(tx, Math.abs(bob) + Math.abs(jolt), 26);
    range.truck.rotation.z = bob * 0.02 + jolt * 0.05;
    range.escort.position.set(ex, Math.abs(bob2) + Math.abs(jolt) * 0.2, 26);
    range.escort.rotation.z = bob2 * 0.02;
    var roll = speed * dt / 0.55;
    range.truckWheels.forEach(function (w) { w.rotation.z -= roll; });
    range.escortWheels.forEach(function (w) { w.rotation.z -= roll * 1.1; });
    // long dawn shadows ride along
    range.truckShadow.position.set(tx + 6.4, 0.06, 24);
    range.escortShadow.position.set(ex + 5.2, 0.06, 24.2);
    // dust kicks from the wheels
    cv.dustT += dt;
    if (cv.dustT > 0.055) {
      cv.dustT = 0;
      spawnDust(tx - 3.2, 0.55, 26 + (Math.random() < 0.5 ? 1.1 : -1.1), true);
      spawnDust(ex - 2.0, 0.5, 26 + (Math.random() < 0.5 ? 1 : -1), false);
    }
    // radio chatter
    while (cv.capIdx < cv.caps.length && cv.t >= cv.caps[cv.capIdx].t) {
      var c = cv.caps[cv.capIdx++];
      if (c.radio) PGAudio.radioBlip();
      setCaption(c.small, c.main);
    }
    // three shots: HELD WIDE (let it breathe) → tracking the article → low front
    var cam = range.camera;
    var shot = cv.t < 6.5 ? 0 : cv.t < 11 ? 1 : 2;
    if (shot !== cv.shot) {
      cv.shot = shot;
      cam.fov = shot === 0 ? 30 : shot === 1 ? 40 : 30;
      cam.updateProjectionMatrix();
      if (shot === 2) PGAudio.enginePitch(1.1);
    }
    if (shot === 0) {
      cam.position.set(-60, 7, 380);
      cam.lookAt(-60, 17, 0);
    } else if (shot === 1) {
      cam.position.set(tx + 5, 3.1 + jolt * 0.4, 37.5);
      cam.lookAt(tx - 0.6, 2.3, 26);
    } else {
      if (cv.t > 13.1 && !cv.dopplerDone) { cv.dopplerDone = true; PGAudio.enginePitch(0.93); }
      cam.position.set(34, 1.5, 31);
      cam.lookAt(tx + 7, 2.4, 26);
    }
    if (range.convoyShake > 0.02) {
      range.convoyShake = Math.max(0, range.convoyShake - dt * 1.6);
      cam.position.x += (Math.random() - 0.5) * range.convoyShake * 0.3;
      cam.position.y += (Math.random() - 0.5) * range.convoyShake * 0.24;
    }
  }

  /* hold-to-arm */
  (function () {
    var armHold = null;
    var btn = $('btn-arm');
    btn.addEventListener('pointerdown', function (e) {
      PGAudio.init();
      btn.setPointerCapture(e.pointerId);
      armHold = { t0: performance.now(), iv: setInterval(function () {
        var p = clamp((performance.now() - armHold.t0) / 1100, 0, 1);
        $('arm-ring').style.setProperty('--p', p * 100);
        if (p >= 1) { clearInterval(armHold.iv); armHold = null; rangeArmed(); }
      }, 16) };
    });
    function cancel() {
      if (armHold) { clearInterval(armHold.iv); armHold = null; $('arm-ring').style.setProperty('--p', 0); }
    }
    btn.addEventListener('pointerup', cancel);
    btn.addEventListener('pointercancel', cancel);
  })();
  function rangeArmed() {
    $('btn-arm').classList.add('hidden');
    PGAudio.armLatch();
    PGAudio.klaxon();
    setCaption('RANGE HOT · RANGE HOT', 'All personnel to the bunker. The lunch tent stays where it is.');
    later(1700, function () { $('btn-fire').classList.remove('hidden'); });
  }
  $('btn-fire').addEventListener('click', function () {
    if (S.phase !== 'station') return;
    $('btn-fire').classList.add('hidden');
    startCountdown();
  });

  var rangeT = { camT: 0, t0: 0, cue: 5, detAt: null, soundAt: null, detDone: false, soundDone: false, lastBeep: null };
  function startCountdown() {
    S.phase = 'counting';
    setCaption('', '');
    var o = S.result.outcome;
    rangeT.cue = rfp().tSpec;         // the countdown runs to the CONTRACT's cue
    rangeT.t0 = performance.now();
    rangeT.camT = 0;
    rangeT.detDone = false;
    rangeT.soundDone = false;
    rangeT.lastBeep = 6;
    rangeT.impact = !!rfp().impact;
    rangeT.fallS = 1.15;
    rangeT.dropDone = false;
    rangeT.landed = false;
    // impact articles keep their own clock: detT is relative to PLATE CONTACT (cue + fall)
    rangeT.detAt = o.fired ? rangeT.cue + (rangeT.impact ? rangeT.fallS : 0) + o.detT : null;
    rangeT.soundAt = rangeT.detAt != null ? rangeT.detAt + PG2.SOUND_DELAY : null;
    rangeT.dudHandled = false;
  }
  /* SKIPSTONE: the release, the fall, the thud (or the flash) */
  function stepDrop() {
    var t = rangeT.camT - rangeT.cue;
    if (t < 0) return;
    var dh = range.deviceHolder;
    var o = S.result.outcome;
    if (!rangeT.dropDone) {
      rangeT.dropDone = true;
      if (range.dropCable) range.dropCable.visible = false;
      PGAudio.coverFlick();
      setCaption('RELEASE · T+' + rangeT.cue.toFixed(1), 'The rig lets go. Gravity accepts the contract.');
    }
    var p = clamp(t / rangeT.fallS, 0, 1);
    dh.position.y = 12 - (12 - 1.05) * p * p;
    dh.position.x = (o.offsetM || 0) * p;
    dh.rotation.z = (o.comX || 0) * 0.55 * p;
    if (p >= 1 && !rangeT.landed) {
      rangeT.landed = true;
      spawnDust(dh.position.x, 0.7, 0.7, true);
      spawnDust(dh.position.x + 0.9, 0.6, -0.6, false);
      if (!o.fired || (rangeT.detAt != null && rangeT.detAt > rangeT.camT + 0.2)) {
        PGAudio.thunk(1);
        range.shake = Math.max(range.shake, 1.2);
        if (o.type === 'nosemiss') {   // shoulder first, into the sand
          var z0 = dh.rotation.z;
          tween(700, function (tt) {
            dh.rotation.z = lerp(z0, o.offsetM > 0 ? -1.35 : 1.35, tt);
            dh.position.y = lerp(1.05, 0.72, tt);
          });
        }
      }
    }
  }
  function updateCamClock() {
    var tm = rangeT.camT - rangeT.cue;
    var sign = tm < 0 ? 'T−' : 'T+';
    var a2 = Math.abs(tm);
    var mm = String(Math.floor(a2 / 60)).padStart(2, '0');
    var ss = (a2 % 60).toFixed(1).padStart(4, '0');
    $('cam-clock').textContent = sign + mm + ':' + ss;
  }

  /* ---------- detonation FX ---------- */
  function spriteTexture(inner, outer) {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(64, 64, 6, 64, 64, 62);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  var TX = null;
  function fxTextures() {
    if (TX) return TX;
    TX = {
      fire: spriteTexture('rgba(255,244,214,1)', 'rgba(255,120,30,0)'),
      smoke: spriteTexture('rgba(70,58,48,.85)', 'rgba(70,58,48,0)'),
      dust: spriteTexture('rgba(196,150,94,.8)', 'rgba(196,150,94,0)'),
      flash: spriteTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)')
    };
    return TX;
  }
  function igniteFX() {
    var vis = S.result.visual;
    var tx = fxTextures();
    var fxGroup = new THREE.Group();
    if (rangeT.impact) {
      var iOx = S.result.outcome.offsetM || 0;
      var iOy = (S.result.outcome.detT != null && S.result.outcome.detT < -0.05)
        ? Math.max(range.deviceHolder.position.y - 1.5, 0) : 0;   // mid-air burst rides the fall
      fxGroup.position.set(iOx, iOy, 0);
    }
    range.scene.add(fxGroup);
    var fx = { t: 0, sprites: [], debris: null, ring: null, torus: null, vis: vis, group: fxGroup };
    var scale = 14 + vis.crater * 1.6;             // fireball metres-ish
    if (vis.fizzle) scale = 10;
    // DOM flash — silent
    if (!vis.fizzle) {
      var flash = $('flash');
      flash.style.transition = 'none';
      flash.style.opacity = 0.95 * vis.bright;
      later(80, function () {
        flash.style.transition = 'opacity 0.3s ease-out';
        flash.style.opacity = 0;
      });
    }
    // lobe directions (ragged blasts lean)
    var lobes = [];
    var lobeR = PG2.stream(S.seed, 'lobes');
    for (var li = 0; li < 2; li++) {
      var a = lobeR() * Math.PI * 2;
      lobes.push(V3(Math.cos(a) * vis.ragged, 1, Math.sin(a) * vis.ragged).normalize());
    }
    var n = vis.fizzle ? 7 : 10;
    var rand = PG2.stream(S.seed, 'fxrand');
    for (var i = 0; i < n; i++) {
      var m = new THREE.SpriteMaterial({
        map: vis.fizzle ? tx.smoke : tx.fire,
        transparent: true, depthWrite: false,
        blending: vis.fizzle ? THREE.NormalBlending : THREE.AdditiveBlending
      });
      var sp = new THREE.Sprite(m);
      var dir = lobes[i % 2].clone().add(V3((rand() - 0.5) * 1.1, rand() * 0.8, (rand() - 0.5) * 1.1)).normalize();
      if (!vis.fizzle) m.color.setRGB(0.8, 0.3, 0.09);   // additive: keep the sum orange
      sp.userData = {
        dir: dir,
        speed: (vis.fizzle ? 4 : 18) * (0.5 + rand()),
        grow: scale * (0.38 + rand() * 0.55),
        delay: vis.fizzle ? rand() * 1.6 : rand() * 0.12
      };
      sp.position.set(0, 2, 0);
      sp.scale.set(0.1, 0.1, 1);
      fxGroup.add(sp);
      fx.sprites.push(sp);
    }
    // emissive core
    if (!vis.fizzle) {
      var core = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xfff0cc, transparent: true, opacity: 1 }));
      core.position.set(0, 3, 0);
      fxGroup.add(core);
      fx.core = core;
      // dust torus
      var torus = new THREE.Mesh(new THREE.TorusGeometry(1, 2.2, 8, 28),
        new THREE.MeshLambertMaterial({ color: 0x9c7043, transparent: true, opacity: 0.7 }));
      torus.rotation.x = Math.PI / 2;
      torus.position.y = 1.5;
      fxGroup.add(torus);
      fx.torus = torus;
      // ground shock ring racing outward at the (invented) speed of sound
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48),
        new THREE.MeshBasicMaterial({ color: 0xfff6e2, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.5;
      fxGroup.add(ring);
      fx.ring = ring;
      // debris streaks
      var dg = new THREE.BufferGeometry();
      var cnt = vis.frag ? 110 : 46, pos2 = new Float32Array(cnt * 3), vel = [];
      for (var di = 0; di < cnt; di++) {
        pos2[di * 3] = 0; pos2[di * 3 + 1] = 2; pos2[di * 3 + 2] = 0;
        var dv = lobes[di % 2].clone().add(V3((rand() - 0.5) * 1.4, rand() * 1.1, (rand() - 0.5) * 1.4));
        dv.normalize().multiplyScalar((25 + rand() * 45 * (0.5 + vis.yield01)) * (vis.frag ? 1.4 : 1));
        vel.push(dv);
      }
      dg.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
      var pts = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x3c2f22, size: 2.4, sizeAttenuation: true }));
      fxGroup.add(pts);
      fx.debris = { pts: pts, vel: vel };
    }
    // remove the device and pad — they are now philosophy
    range.deviceHolder.visible = false;
    if (range.trestle) range.trestle.visible = false;
    if (!vis.fizzle) { range.pad.visible = false; range.padDress.visible = false; }
    // mantle roll: a darker second stage that tumbles up through the flash
    if (!vis.fizzle) {
      fx.mantle = [];
      for (var mi = 0; mi < 5; mi++) {
        var mm = new THREE.SpriteMaterial({
          map: tx.fire, transparent: true, opacity: 0, depthWrite: false,
          blending: THREE.NormalBlending
        });
        mm.color.setRGB(0.5, 0.17, 0.05);
        var msp = new THREE.Sprite(mm);
        msp.position.set((rand() - 0.5) * 2, 2.5, (rand() - 0.5) * 2);
        msp.userData = {
          delay: 0.22 + mi * 0.12,
          rise: 5 + rand() * 4,
          grow: scale * (0.4 + rand() * 0.35)
        };
        fxGroup.add(msp);
        fx.mantle.push(msp);
      }
    }
    // rising smoke column (the part the board photographs) — drifts on the wind
    var wind = range.wind || { x: 0, z: 0, speed: 0 };
    if (!vis.fizzle) {
      fx.smoke = [];
      for (var si = 0; si < 8; si++) {
        var sm = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tx.smoke, transparent: true, opacity: 0, depthWrite: false
        }));
        sm.position.set(0, 4, 0);
        sm.userData = {
          delay: 0.6 + si * 0.3,
          rise: 9 + rand() * 7,
          drift: (rand() - 0.5) * 2 + wind.x * (5 + si * 1.5),   // the column leans downwind
          driftZ: wind.z * (4 + si * 1.2),
          grow: scale * (0.55 + rand() * 0.5)
        };
        fxGroup.add(sm);
        fx.smoke.push(sm);
      }
    }
    fx.scale = scale;
    range.fx = fx;
  }
  function stepFX(dt) {
    var fx = range.fx;
    if (!fx) return;
    fx.t += dt;
    var t = fx.t;
    fx.sprites.forEach(function (sp) {
      var u = sp.userData;
      var tt = Math.max(t - u.delay, 0);
      if (tt <= 0) return;
      var life = fx.vis.fizzle ? 2.6 : 2.2;
      var k = clamp(tt / life, 0, 1);
      sp.position.addScaledVector(u.dir, u.speed * dt * (1 - k * 0.7));
      var s = u.grow * easeOut(k);
      sp.scale.set(s, s, 1);
      sp.material.opacity = Math.pow(1 - k, 1.5) * (fx.vis.fizzle ? 0.8 : 1);
      if (!fx.vis.fizzle) {
        sp.material.color = sp.material.color || new THREE.Color();
        sp.material.color.setRGB(1, clamp(1 - k * 0.8, 0.2, 1), clamp(0.8 - k, 0.05, 1));
      }
    });
    if (fx.mantle) {
      fx.mantle.forEach(function (msp) {
        var u = msp.userData;
        var tt = Math.max(t - u.delay, 0);
        if (tt <= 0) return;
        var k = clamp(tt / 3.2, 0, 1);
        msp.position.y = 2.5 + u.rise * tt * (1 - k * 0.4);
        var s = u.grow * (0.25 + easeOut(k) * 1.0);
        msp.scale.set(s, s, 1);
        msp.material.opacity = 0.55 * (k < 0.12 ? k / 0.12 : Math.pow(1 - (k - 0.12) / 0.88, 1.4));
      });
    }
    if (fx.smoke) {
      fx.smoke.forEach(function (sm) {
        var u = sm.userData;
        var tt = Math.max(t - u.delay, 0);
        if (tt <= 0) return;
        var k = clamp(tt / 6, 0, 1);
        sm.position.y = 4 + u.rise * tt * (1 - k * 0.5);
        sm.position.x = u.drift * tt;
        sm.position.z = (u.driftZ || 0) * tt;
        var s = u.grow * (0.3 + easeOut(k) * 1.1);
        sm.scale.set(s, s, 1);
        sm.material.opacity = 0.5 * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
      });
    }
    if (fx.core) {
      var ck = clamp(t / 0.32, 0, 1);
      var cs = 1 + easeOut(ck) * fx.scale * 0.24;
      fx.core.scale.set(cs, cs, cs);
      fx.core.material.opacity = Math.pow(1 - ck, 2) * 0.95;
      if (ck >= 1) { fx.group.remove(fx.core); fx.core = null; }
    }
    if (fx.torus) {
      var tk = clamp(t / 2.8, 0, 1);
      var tr = 1 + easeOut(tk) * fx.vis.crater * 1.9;
      fx.torus.scale.set(tr, tr, 1);
      fx.torus.material.opacity = 0.75 * (1 - tk);
      if (tk >= 1) { fx.group.remove(fx.torus); fx.torus = null; }
    }
    if (fx.ring) {
      var rr = 333 * t; // invented sound speed ~ 1.6km in 4.8s
      fx.ring.scale.set(rr, rr, 1);
      fx.ring.material.opacity = clamp(0.55 - rr / 4000, 0, 1);
      if (rr > 2400) { fx.group.remove(fx.ring); fx.ring = null; }
    }
    if (fx.debris) {
      var pos = fx.debris.pts.geometry.attributes.position;
      for (var i = 0; i < fx.debris.vel.length; i++) {
        var v = fx.debris.vel[i];
        v.y -= 30 * dt;
        pos.setXYZ(i, pos.getX(i) + v.x * dt, Math.max(pos.getY(i) + v.y * dt, 0), pos.getZ(i) + v.z * dt);
      }
      pos.needsUpdate = true;
      if (t > 4) { fx.group.remove(fx.debris.pts); fx.debris = null; }
    }
  }

  /* ---------- crater reveal + measuring (slow walk-around) ---------- */
  var msr = { active: false };
  function craterReveal() {
    S.phase = 'crater';
    var crater = S.result.outcome.craterActual || 0;
    var r = Math.max(crater / 2, 1.6);
    var ell = S.result.visual.ellipse || 1;      // the crater follows the load
    var ox = S.result.visual.offsetM || 0;       // negative = west
    if (range.craterG) range.scene.remove(range.craterG);
    var g = new THREE.Group();
    // scorch decal
    var sc = document.createElement('canvas');
    sc.width = sc.height = 256;
    var sx = sc.getContext('2d');
    var sg = sx.createRadialGradient(128, 128, 12, 128, 128, 128);
    sg.addColorStop(0, 'rgba(28,20,13,0.95)');
    sg.addColorStop(0.4, 'rgba(56,40,25,0.8)');
    sg.addColorStop(0.72, 'rgba(92,68,42,0.35)');
    sg.addColorStop(1, 'rgba(92,68,42,0)');
    sx.fillStyle = sg;
    sx.fillRect(0, 0, 256, 256);
    var stx = new THREE.CanvasTexture(sc);
    stx.encoding = THREE.sRGBEncoding;
    var scorch = new THREE.Mesh(new THREE.PlaneGeometry(r * 4.6, r * 4.6),
      new THREE.MeshBasicMaterial({ map: stx, transparent: true, depthWrite: false }));
    scorch.rotation.x = -Math.PI / 2;
    scorch.scale.x = ell;
    scorch.position.y = 0.42;
    g.add(scorch);
    // bowl: vertex-graded disc, near-black centre out to rim earth
    var bowlGeo = new THREE.CircleGeometry(r, 36);
    var bp = bowlGeo.attributes.position;
    var bc = [];
    for (var bi = 0; bi < bp.count; bi++) {
      var dd = Math.hypot(bp.getX(bi), bp.getY(bi)) / r;
      bc.push(lerp(0.045, 0.16, dd), lerp(0.03, 0.105, dd), lerp(0.018, 0.06, dd));
    }
    bowlGeo.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
    var bowl = new THREE.Mesh(bowlGeo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    bowl.rotation.x = -Math.PI / 2;
    bowl.scale.x = ell;                          // lopsided loads dig ovals
    bowl.position.y = 0.5;
    g.add(bowl);
    // thrown rim
    var rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.04, r * 0.13, 8, 36),
      new THREE.MeshLambertMaterial({ color: 0x63482c }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.55;
    rim.scale.set(ell, 1, 0.3);
    g.add(rim);
    // ejecta chunks
    var chunkRand = PG2.stream(S.seed, 'chunks');
    for (var ci = 0; ci < 12; ci++) {
      var ang = chunkRand() * Math.PI * 2;
      var dist = r * (1.15 + chunkRand() * 1.6);
      var cs = r * (0.03 + chunkRand() * 0.06);
      var chunk = new THREE.Mesh(new THREE.BoxGeometry(cs * 2, cs, cs * 1.4), mat(0x6e5233, { shin: 2 }));
      chunk.position.set(Math.cos(ang) * dist, 0.5 + cs / 2, Math.sin(ang) * dist);
      chunk.rotation.set(chunkRand() * 3, chunkRand() * 3, chunkRand() * 3);
      g.add(chunk);
    }
    // smoke wisps
    var tx = fxTextures();
    for (var i = 0; i < 5; i++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx.smoke, transparent: true, opacity: 0.2, depthWrite: false }));
      sp.position.set((i - 2) * r * 0.28, r * 0.5 + i * r * 0.18, (i % 2 - 0.5) * r * 0.3);
      sp.scale.set(r * 0.7, r * 0.7, 1);
      sp.userData.rise = (0.3 + i * 0.1) * r * 0.12;
      g.add(sp);
    }
    g.position.x = ox;                           // crater centre follows the load's lean
    range.scene.add(g);
    range.craterG = g;
    // low push-in, then a slow survey orbit while the tape runs
    var c = range.camera;
    c.fov = 24;
    c.updateProjectionMatrix();
    var from = V3(ox + r * 6.4, r * 2.6, r * 8.4);
    var to = V3(ox + r * 3.3, r * 1.35, r * 4.4);
    setCaption('SURVEY PASS · PAD A', S.result.outcome.fired ? 'The dust votes last. Measuring…' : 'There is a device-shaped silence on the pad.');
    tween(3800, function (t) {
      c.position.lerpVectors(from, to, t);
      c.lookAt(ox, 0.6, 0);
    }, function () { initMeasure(r, ox); }, easeInOut);
  }
  function initMeasure(r, ox) {
    var svg = $('measure-svg');
    svg.classList.remove('hidden');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.style.width = W + 'px';
    svg.style.left = '0'; svg.style.top = '0'; svg.style.transform = 'none';
    svg.style.height = H + 'px';
    var shaped = !!rfp().offsetSpec;
    svg.innerHTML =
      '<line class="msr-line" id="msr-main"/>' +
      '<line class="msr-line" id="msr-t1"/>' +
      '<line class="msr-line" id="msr-t2" opacity="0"/>' +
      '<text id="msr-txt" text-anchor="middle" font-size="17">⌀ 0.0 m</text>' +
      (shaped ? '<line class="msr-datum" id="msr-datum"/>' +
                '<line class="msr-off" id="msr-offline" opacity="0"/>' +
                '<text id="msr-offtxt" text-anchor="middle" font-size="12" opacity="0"></text>' : '') +
      '<g id="msr-band"></g>';
    var cam = range.camera;
    var ctr = V3(ox, 0.6, 0);
    var rel = cam.position.clone().sub(ctr);
    msr = {
      active: true, r: r, ox: ox, shaped: shaped,
      crater: S.result.outcome.craterActual || 0,
      t0: performance.now(), progDone: false, bandDone: false,
      orbR: Math.hypot(rel.x, rel.z), orbY: cam.position.y,
      ang: Math.atan2(rel.x, rel.z),
      el: {
        main: svg.querySelector('#msr-main'), t1: svg.querySelector('#msr-t1'),
        t2: svg.querySelector('#msr-t2'), txt: svg.querySelector('#msr-txt'),
        datum: svg.querySelector('#msr-datum'), offline: svg.querySelector('#msr-offline'),
        offtxt: svg.querySelector('#msr-offtxt'), band: svg.querySelector('#msr-band')
      }
    };
  }
  function stepMeasure(now, dt) {
    if (!msr.active) return;
    var cam = range.camera;
    // the aftermath walk-around: a patient half-orbit while the survey runs
    msr.ang += dt * 0.055;
    cam.position.set(msr.ox + Math.sin(msr.ang) * msr.orbR, msr.orbY, Math.cos(msr.ang) * msr.orbR);
    cam.lookAt(msr.ox, 0.6, 0);
    // re-project the tape every frame so it stays glued to the dirt
    var pL = worldToScreen(V3(msr.ox - msr.r, 0.8, 0), cam);
    var pR = worldToScreen(V3(msr.ox + msr.r, 0.8, 0), cam);
    var y = (pL.y + pR.y) / 2 - 12;
    var e = msr.progDone ? 1 : easeInOut(clamp((now - msr.t0) / 1600, 0, 1));
    var el = msr.el;
    el.main.setAttribute('x1', pL.x); el.main.setAttribute('y1', y);
    el.main.setAttribute('x2', lerp(pL.x, pR.x, e)); el.main.setAttribute('y2', y);
    el.t1.setAttribute('x1', pL.x); el.t1.setAttribute('y1', y - 9);
    el.t1.setAttribute('x2', pL.x); el.t1.setAttribute('y2', y + 9);
    el.t2.setAttribute('x1', pR.x); el.t2.setAttribute('y1', y - 9);
    el.t2.setAttribute('x2', pR.x); el.t2.setAttribute('y2', y + 9);
    el.txt.setAttribute('x', (pL.x + pR.x) / 2);
    el.txt.setAttribute('y', y - 16);
    if (!msr.progDone) {
      el.txt.textContent = '⌀ ' + (msr.crater * e).toFixed(1) + ' m';
      PGAudio.measureTick();
    }
    if (msr.shaped && el.datum) {
      // pad datum vs crater centre — the contract's whole argument
      var pD = worldToScreen(V3(0, 0.8, 0), cam);
      var pC = worldToScreen(V3(msr.ox, 0.8, 0), cam);
      el.datum.setAttribute('x1', pD.x); el.datum.setAttribute('y1', pD.y - 26);
      el.datum.setAttribute('x2', pD.x); el.datum.setAttribute('y2', pD.y + 14);
      el.offline.setAttribute('x1', pD.x); el.offline.setAttribute('y1', pD.y + 8);
      el.offline.setAttribute('x2', pC.x); el.offline.setAttribute('y2', pD.y + 8);
      el.offtxt.setAttribute('x', (pD.x + pC.x) / 2);
      el.offtxt.setAttribute('y', pD.y + 24);
    }
    if (!msr.progDone && now - msr.t0 >= 1600) {
      msr.progDone = true;
      el.t2.setAttribute('opacity', '1');
      PGAudio.typeDing();
      if (msr.shaped && el.offtxt) {
        var westOff = -(S.result.visual.offsetM || 0);
        el.offline.setAttribute('opacity', '1');
        el.offtxt.setAttribute('opacity', '1');
        el.offtxt.textContent = 'CENTRE ' + (Math.abs(westOff) < 0.8 ? 'ON DATUM'
          : Math.abs(westOff).toFixed(1) + ' m ' + (westOff > 0 ? 'WEST' : 'EAST'));
      }
      later(3400, showScore);   // the walk-around continues while it breathes
    }
    if (msr.progDone && !msr.bandDone) {
      msr.bandDone = true;
      var R = rfp();
      var yb = H * 0.72;
      var rulerW = Math.min(W * 0.7, 260);
      var rx = W / 2 - rulerW / 2;
      var perM = rulerW / R.meterMax;
      el.band.innerHTML =
        '<line class="msr-line" x1="' + rx + '" y1="' + yb + '" x2="' + (rx + rulerW) + '" y2="' + yb + '" opacity=".6"/>' +
        '<line class="msr-band" x1="' + (rx + R.craterMin * perM) + '" y1="' + yb + '" x2="' + (rx + R.craterMax * perM) + '" y2="' + yb + '"/>' +
        '<text x="' + (rx + R.craterMin * perM) + '" y="' + (yb + 14) + '" text-anchor="middle" font-size="9">' + R.craterMin + '</text>' +
        '<text x="' + (rx + R.craterMax * perM) + '" y="' + (yb + 14) + '" text-anchor="middle" font-size="9">' + R.craterMax + '</text>' +
        '<circle cx="' + (rx + clamp(msr.crater, 0, R.meterMax) * perM) + '" cy="' + yb + '" r="4" fill="' +
          (S.result.stamps.size.ok ? '#7ed49a' : '#ff7a68') + '"/>';
      window.__pgMeasureDone = true;
    }
  }

  /* ---------- captions ---------- */
  function setCaption(small, main) {
    $('range-caption').innerHTML = (small ? '<span class="cap-small">' + small + '</span>' : '') + (main || '');
  }

  /* ---------- dud / no-fire hold ---------- */
  function dudHold() {
    var o = S.result.outcome;
    var line1 = o.type === 'unarmed'
      ? 'The device sits there. The desert sits there. Everyone sits there.'
      : o.type === 'nosemiss'
      ? 'It came down ' + Math.abs(o.offsetM || 0).toFixed(1) + ' m off the plate, shoulder first. The plate is unmoved.'
      : 'Nothing. The firing circuit kept the news to itself.';
    setCaption('T+00:06 · NO EVENT', line1);
    later(3400, function () {
      setCaption('T+02:00 · RANGE SAFETY PROTOCOL', 'A volunteer is selected. His helmet is two sizes too large.');
    });
    later(6800, function () {
      PGAudio.stampThud();
      setCaption('', '<b>MADE SAFE.</b> The long stick has questions for the Assembly Bay.');
    });
    later(9000, craterRevealOrScore);
  }
  function craterRevealOrScore() {
    $('cam-tick').classList.add('hidden');
    if (S.result.outcome.fired) craterReveal();
    else showScore();
  }

  /* ================= SCORECARD ================= */
  function showScore() {
    clearLater();
    S.phase = 'score';
    msr.active = false;
    showUI(null);
    $('measure-svg').classList.add('hidden');
    var r = S.result;
    var R = rfp();
    var actComplete = r.win && R.flyoff && !contractRec(S.contract).won;
    if (r.win) PGAudio.fanfare(); else PGAudio.sadDrone();
    // per-contract bests, worn with pride
    if (!S.best[S.contract]) S.best[S.contract] = { stars: 0, net: -Infinity, wonOn: null };
    var b = S.best[S.contract];
    b.stars = Math.max(b.stars, r.stars);
    b.net = Math.max(b.net, r.payout.net);
    if (r.win && b.wonOn == null) b.wonOn = S.attempt;
    // …and into localStorage: a won contract stays won, and unlocks the next folder
    var rec = contractRec(S.contract);
    rec.stars = Math.max(rec.stars, r.stars);
    rec.net = rec.net == null ? r.payout.net : Math.max(rec.net, r.payout.net);
    if (r.win) {
      rec.won = true;
      if (rec.wonOn == null) rec.wonOn = S.attempt;
    }
    // the range remembers; the museum collects
    recordScar(r);
    if (r.incident) museumArchiveIR(r);
    if (r.win) {
      museumPlaque(r);
      museumFirst('win', 'FIRST CONTRACT WON — ' + R.id);
      if (r.stars === 3) museumFirst('threeStar', 'FIRST FULL CARD — THREE STAMPS');
      if (R.flyoff) museumFirst('flyoff', 'THE FLY-OFF, WON — ACT I COMPLETE');
    }
    if (!r.outcome.fired) museumFirst('dud', 'FIRST DUD — MADE SAFE WITH THE LONG STICK');
    persist();
    var el = $('score-scroll');
    function stampCard(st) {
      return '<div class="stamp-card"><div class="sc-lbl">' + st.label + '</div>' +
        '<div class="sc-val">' + st.value + '</div>' +
        '<div><span class="stamp-big ' + (st.ok ? 'pass' : 'fail') + '">' + (st.ok ? 'IN SPEC' : 'OUT') + '</span></div>' +
        '<div class="sc-spec">SPEC: ' + st.spec + '</div></div>';
    }
    var stars = '';
    for (var i = 0; i < 3; i++) stars += '<span class="' + (i < r.stars ? '' : 'dim') + '">★</span>';
    var nextIdx = (r.win && S.contract + 1 < PG2.CONTRACTS.length && !contractRec(S.contract + 1).won) ? S.contract + 1 : null;
    // the fly-off adjudicates line by line against the competing article
    var flyTable = '';
    if (r.flyoff) {
      var vf = r.flyoff.v;
      function fRow(lbl, yours, yOk, theirs, tOk) {
        return '<tr><td>' + lbl + '</td>' +
          '<td class="' + (yOk ? 'fy-ok' : 'fy-bad') + '">' + yours + ' ' + (yOk ? '✓' : '✗') + '</td>' +
          '<td class="' + (tOk ? 'fy-ok' : 'fy-bad') + '">' + theirs + ' ' + (tOk ? '✓' : '✗') + '</td></tr>';
      }
      flyTable =
        '<div class="flyoff-table-wrap">' +
          '<div class="ft-head">LINE-BY-LINE ADJUDICATION · TWO PADS, ONE CONTRACT</div>' +
          '<table class="flyoff-table">' +
            '<tr class="ft-cols"><th></th><th>REDSKY</th><th>VANTAGE</th></tr>' +
            fRow('CRATER', r.stamps.size.value, r.stamps.size.ok, vf.stamps.size.value, vf.stamps.size.ok) +
            fRow('TIMING', r.stamps.timing.value, r.stamps.timing.ok, vf.stamps.timing.value, vf.stamps.timing.ok) +
            fRow('CLEAN', r.stamps.clean.value, r.stamps.clean.ok, vf.stamps.clean.value, vf.stamps.clean.ok) +
            '<tr class="ft-score"><td>STAMPS</td><td>' + r.flyoff.yourScore + ' / 3</td><td>' + r.flyoff.theirScore + ' / 3</td></tr>' +
          '</table>' +
          '<div class="ft-verdict">' + (r.flyoff.beat
            ? 'VERDICT: REDSKY. ' + (r.flyoff.yourScore === r.flyoff.theirScore ? 'Tie on stamps — your crater sat closer to the number.' : 'More lines met. The board shakes the correct hand.')
            : 'VERDICT: VANTAGE. ' + (r.flyoff.theirScore === r.flyoff.yourScore ? 'Tie on stamps — their crater sat closer to the number.' : 'More lines met. Their VP is already dictating a press release.')) + '</div>' +
        '</div>';
    }
    el.innerHTML =
      '<div class="score-sheet">' +
        '<div class="score-head">REPUBLIC PROVING AUTHORITY · ADJUDICATION</div>' +
        '<div class="score-title">RANGE DAY RESULTS</div>' +
        '<div class="score-sub">' + R.id + ' · TEST #' + S.attempt + ' · SERIES ' + S.seed + '</div>' +
        '<div class="stamp-row">' + r.stampList.map(stampCard).join('') + '</div>' +
        flyTable +
        (r.hint ? '<div class="hint-callout"><span class="hc-kicker">TEST #' + S.attempt +
          (r.win ? ' — VERDICT' : ' — WHAT TO TWEAK') +
          (!r.win && r.outcome.rootCause && r.outcome.rootCause.phase
            ? ' · ' + r.outcome.rootCause.phase + ' PHASE' : '') + '</span>' + r.hint + '</div>' : '') +
        (r.inspectorNote ? '<div class="inspector-aside"><span class="ia-kicker">INSPECTOR’S ASIDE · WIRE COLOUR CODE</span>' +
          r.inspectorNote + '</div>' : '') +
        (r.fragNote ? '<div class="inspector-aside"><span class="ia-kicker">SURVEY NOTE · FRAG PATTERN</span>' +
          r.fragNote + '</div>' : '') +
        '<div class="award-banner ' + (r.win ? 'win' : 'lose') + '">' +
          '<div class="ab-kicker">' + (r.win ? 'CONTRACT AWARDED' : 'CONTRACT NOT AWARDED') + '</div>' +
          '<div class="ab-title">' + (r.win ? 'REDSKY INC' : (r.vantage.ok ? 'VANTAGE DYNAMICS' : 'NO AWARD MADE')) + '</div>' +
          '<div class="ab-stars">' + stars + '</div>' +
        '</div>' +
        (actComplete ? '<div class="act-banner"><div class="ab-kicker">★ ACT I COMPLETE ★</div>' +
          '<div class="act-line">THE SHED IS OUTGROWN. The Authority requests a tour of your facilities. You do not have facilities. Yet.</div>' +
          '<button id="btn-frontpage" type="button">ORDNANCE WEEKLY — READ THE FRONT PAGE</button></div>' : '') +
        '<table class="pay-table">' +
          '<tr><td>DEVELOPMENT AWARD</td><td>' + (r.payout.award ? fmt$(r.payout.award) : '—') + '</td></tr>' +
          '<tr><td>CLEAN-DETONATION BONUS</td><td>' + (r.payout.bonus ? '+' + fmt$(r.payout.bonus) : '—') + '</td></tr>' +
          '<tr><td>PARTS &amp; REFINING (AS BUILT)</td><td>−' + fmt$(r.payout.cost) + '</td></tr>' +
          '<tr class="net"><td>NET TO REDSKY</td><td class="' + (r.payout.net >= 0 ? 'pos' : 'neg') + '">' +
            (r.payout.net >= 0 ? '' : '−') + fmt$(Math.abs(r.payout.net)) + '</td></tr>' +
        '</table>' +
        '<div class="clipping">' +
          '<div class="clip-mast"><b>ORDNANCE WEEKLY</b><span>TRADE PAPER OF RECORD</span></div>' +
          '<div class="clip-headline">' + r.vantage.headline + '</div>' +
          '<div class="clip-sub">' + r.vantage.sub + '</div>' +
        '</div>' +
        (r.incident ? '<button id="btn-incident" type="button">READ INCIDENT REPORT — FORM IR-3</button>' : '') +
        '<div class="score-btns">' +
          '<button id="btn-retry" type="button">TWEAK &amp; REFIRE<span class="sub">YOUR BUILD, AS YOU LEFT IT</span></button>' +
          (nextIdx != null
            ? '<button id="btn-newcontract" type="button">NEXT CONTRACT<span class="sub">' + PG2.CONTRACTS[nextIdx].id + ' · ' + PG2.CONTRACTS[nextIdx].title + '</span></button>'
            : '<button id="btn-newcontract" type="button">NEW CONTRACT<span class="sub">FRESH SERIES</span></button>') +
        '</div>' +
        '<div class="score-navrow"><button id="btn-score-board" type="button">CONTRACT BOARD</button>' +
          '<button id="btn-score-museum" type="button">THE MUSEUM</button></div>' +
        '<div class="score-best">BEST ON ' + R.id + ' — <b>' + b.stars + '★</b>' +
          (b.net > -Infinity ? ' · NET ' + (b.net < 0 ? '−' : '') + fmt$(Math.abs(b.net)) : '') +
          (b.wonOn ? ' · FIRST WIN ON TEST #' + b.wonOn : '') + '</div>' +
        '<div class="score-seed">SERIES ' + S.seed + ' · SAME BUILD + SAME SERIES = SAME RESULT · ALL SCIENCE INVENTED</div>' +
      '</div>';
    showScreen('scr-score');
    if (r.incident) $('btn-incident').addEventListener('click', showIncident);
    if (actComplete) {
      later(600, function () { PGAudio.fanfare(); });
      $('btn-frontpage').addEventListener('click', function () { PGAudio.tap(); showFrontPage(r); });
    }
    $('btn-retry').addEventListener('click', function () {
      PGAudio.tap();
      enterBuild(true);       // the whole build, untouched — tweak one thing
    });
    $('btn-newcontract').addEventListener('click', function () {
      PGAudio.tap();
      reclaimRefined();
      if (nextIdx != null) S.contract = nextIdx;
      S.seed = PG2.makeSeed();
      S.attempt = 0;
      S.assembly = PG2.makeAssembly();
      startContract();
    });
    $('btn-score-board').addEventListener('click', function () { PGAudio.tap(); showBoard(); });
    $('btn-score-museum').addEventListener('click', function () { PGAudio.tap(); showMuseum('scr-score'); });
  }

  /* ---------- ORDNANCE WEEKLY front page (the Act I trophy) ---------- */
  function showFrontPage(r) {
    var rec = contractRec(S.contract);
    var doc = $('frontpage-doc');
    doc.innerHTML =
      '<div class="fp-mast"><span class="fp-price">ONE SHILLING</span><b>ORDNANCE WEEKLY</b><span class="fp-date">TRADE PAPER OF RECORD · SPECIAL</span></div>' +
      '<hr class="doc-rule">' +
      '<div class="fp-headline">REDSKY TAKES THE FLY-OFF</div>' +
      '<div class="fp-sub">VANTAGE VP DEMANDS “RECOUNT OF THE PHYSICS”; PHYSICS DECLINES</div>' +
      '<hr class="doc-rule thin">' +
      '<div class="fp-cols">' +
        '<p>SECTOR 9 — In a side-by-side demonstration witnessed by the full review board, a lunch tent, and one unaffiliated jackrabbit, REDSKY INC took contract ' + r.rfp.id +
        ' from Vantage Dynamics by ' + (r.flyoff.yourScore > r.flyoff.theirScore ? 'a margin of ' + (r.flyoff.yourScore - r.flyoff.theirScore) + ' stamp' + (r.flyoff.yourScore - r.flyoff.theirScore > 1 ? 's' : '') : 'the width of a tape measure') + '.</p>' +
        '<p>The winning article posted <b>' + r.stamps.size.value + '</b> at <b>' + r.stamps.timing.value + '</b>' +
        (r.stamps.clean.ok ? ', in one bang, as contracted' : '') + ' — on test #' + S.attempt + ' of the series' +
        (rec.tests > S.attempt ? ', after ' + rec.tests + ' range days of what the contractor calls “convergence” and the caterer calls “job security”' : '') + '.</p>' +
        '<p>Asked for comment, the founder of Redsky reportedly pointed at the crater and signed something.</p>' +
        '<p class="fp-quote">“We consider this outcome an anomaly of catering.” — R. Cavendish Vane, VP of Client Triumph, Vantage Dynamics</p>' +
        '<p>The Authority confirms ACT I of the proving programme is CLOSED, and that a larger, meaner set of folders is being stamped for the works. The trade paper of record will be watching.</p>' +
      '</div>' +
      '<div class="fp-foot">ALL SCIENCE INVENTED · ALL CRATERS REAL (WITHIN THE FICTION)</div>';
    $('frontpage-overlay').classList.remove('hidden');
    PGAudio.typeDing();
  }
  $('btn-frontpage-close').addEventListener('click', function () {
    PGAudio.tap();
    $('frontpage-overlay').classList.add('hidden');
  });
  function showIncident() {
    PGAudio.tap();
    renderIncidentDoc(S.result.incident, false);
  }
  function renderIncidentDoc(inc, archived) {
    var doc = $('incident-doc');
    doc.innerHTML =
      '<div class="ir-agency">REPUBLIC PROVING AUTHORITY</div>' +
      '<div class="ir-form">' + inc.form + ' · RANGE INCIDENT REPORT</div>' +
      '<div class="ir-title">INCIDENT REPORT</div>' +
      '<div class="ir-row">' +
        '<div class="ir-field"><div class="ir-lbl">SERIES</div><div class="ir-val">' + inc.series + '</div></div>' +
        '<div class="ir-field"><div class="ir-lbl">CONTRACTOR</div><div class="ir-val">REDSKY INC</div></div>' +
      '</div>' +
      '<div class="ir-row">' +
        '<div class="ir-field"><div class="ir-lbl">OUTCOME</div><div class="ir-val" id="ir-outcome"></div></div>' +
        '<div class="ir-field"><div class="ir-lbl">BUILD PHASE</div><div class="ir-val">' +
          (inc.phase ? inc.phase : 'GENERAL') + '</div></div>' +
      '</div>' +
      '<div class="ir-block"><div class="ir-lbl">NARRATIVE OF EVENT</div><div class="ir-boxed" id="ir-cause"></div></div>' +
      '<div class="ir-block"><div class="ir-lbl">ROOT CAUSE (NAMED, AS ALWAYS)</div><div class="ir-boxed rc" id="ir-receipt"></div></div>' +
      '<div class="ir-block"><div class="ir-lbl">DISPOSITION</div><div class="ir-boxed" id="ir-disp"></div></div>' +
      '<div class="ir-stamp" id="ir-stamp">FILED</div>' +
      '<div class="ir-foot">RETAIN FOR YOUR RECORDS. THE AUTHORITY RETAINS ONE ANYWAY.</div>';
    $('incident-overlay').classList.remove('hidden');
    // typewriter fills
    var fields = [
      ['ir-outcome', inc.outcome], ['ir-cause', inc.cause],
      ['ir-receipt', inc.receipt], ['ir-disp', inc.disposition]
    ];
    var fi = 0;
    function typeField() {
      if (fi >= fields.length) {
        var st = $('ir-stamp');
        st.classList.add('stamped');
        PGAudio.stampThud();
        return;
      }
      var el2 = $(fields[fi][0]);
      var txt = fields[fi][1];
      el2.classList.add('typing');
      var ci = 0;
      var iv = setInterval(function () {
        ci += 2;
        el2.textContent = txt.slice(0, ci);
        PGAudio.typeKey();
        if (ci >= txt.length) {
          clearInterval(iv);
          el2.classList.remove('typing');
          fi++;
          setTimeout(typeField, 180);
        }
      }, 24);
    }
    setTimeout(typeField, 350);
  }
  $('btn-incident-close').addEventListener('click', function () {
    PGAudio.tap();
    $('incident-overlay').classList.add('hidden');
  });

  /* ================= MAIN LOOP ================= */
  var lastFrame = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    stepTweens(now);

    if (S.phase === 'title' || S.phase === 'rfp' || S.phase === 'score') return;

    if (S.phase === 'build' || S.phase === 'wiring' || S.phase === 'det' || S.phase === 'arm') {
      stepRefinery(dt, now);
      if (S.phase === 'build') {
        var touching = Object.keys(pointers).length > 0;
        // inertial orbit: released spins coast down exponentially
        if (!touching && !dragPart && (Math.abs(bay.velTheta) > 0.002 || Math.abs(bay.velPhi) > 0.002)) {
          bay.orbit.theta += bay.velTheta * dt;
          bay.orbit.phi += bay.velPhi * dt;
          var damp = Math.exp(-3.2 * dt);
          bay.velTheta *= damp; bay.velPhi *= damp;
        }
        // soft pitch clamps: overshoot springs back
        if (!touching) {
          if (bay.orbit.phi < 0.3) { bay.orbit.phi += (0.3 - bay.orbit.phi) * Math.min(dt * 7, 1); bay.velPhi = 0; }
          if (bay.orbit.phi > 1.45) { bay.orbit.phi += (1.45 - bay.orbit.phi) * Math.min(dt * 7, 1); bay.velPhi = 0; }
        }
        // idle spin on the work stand
        if (!dragPart && bay.spinEnabled !== false && now - bay.lastTouch > 3500 && !touching) {
          bay.device.rotation.y += dt * 0.22;
        }
        bayCam();
      }
      // dragged part: inertia + magnetic settle
      stepDragGhost(dt);
      // the stand takes the weight — damped spring dip
      if (Math.abs(bay.dip) > 0.0005 || Math.abs(bay.dipV) > 0.0005) {
        bay.dipV += (-95 * bay.dip - 9.5 * bay.dipV) * dt;
        bay.dip += bay.dipV * dt;
        bay.device.position.y = 1.32 + bay.dip;
        bay.stand.position.y = bay.dip * 0.35;
      } else if (bay.device.position.y !== 1.32) {
        bay.device.position.y = 1.32;
        bay.stand.position.y = 0;
      }
      // progressive node feedback: distant glow → pulsing ring → hot magnetic target
      nodeMarkers.forEach(function (mk) {
        var u = mk.userData;
        var prox = u.prox || 0;
        u.sphere.material.opacity = 0.32 + prox * 0.6;
        u.sphere.material.emissiveIntensity = 0.35 + prox * 1.05;
        var pulse = prox > 0.3 ? 1 + Math.sin(now * (0.006 + prox * 0.009)) * (0.1 + prox * 0.3) : 1;
        u.ring.scale.set(pulse, pulse, pulse);
        u.ring.material.opacity = 0.18 + prox * 0.7;
        var ms = 1 + prox * 0.3;
        mk.scale.set(ms, ms, ms);
      });
      // the work light quietly scoots around to rim-light the side you're studying
      var rig = bay.worklight;
      var wantA = bay.orbit.theta + 2.45;
      var da = Math.atan2(Math.sin(wantA - rig.userData.angle), Math.cos(wantA - rig.userData.angle));
      rig.userData.angle += da * Math.min(dt * 0.6, 1);
      rig.position.set(Math.sin(rig.userData.angle) * 3.1, 0, Math.cos(rig.userData.angle) * 3.1);
      rig.lookAt(0, 0, 0);
      rig.userData.head.lookAt(0, 1.32, 0);
      renderer.render(bay.scene, bay.camera);
      return;
    }

    /* range phases */
    if (range) {
      // heat shimmer — strongest near the ground and at noon
      var shb = range.shimmerBase || 1;
      range.shimmer.forEach(function (sm, i) {
        sm.position.y = 9 + i * 12 + Math.sin(now * 0.0011 + i * 2.2) * 2.4;
        sm.material.opacity = shb * (0.04 + 0.038 * (0.5 + 0.5 * Math.sin(now * 0.0017 + i)));
      });
      var ns = range.nearShimmer;
      ns.material.opacity = shb * (0.075 + 0.05 * Math.sin(now * 0.0023));
      ns.scale.y = 1 + Math.sin(now * 0.0031) * 0.22;
      ns.position.y = 2.4 + Math.sin(now * 0.0017) * 0.55;
      range.mesas.forEach(function (m, i) {
        m.position.y = Math.sin(now * 0.0021 + i * 1.4) * 0.55;
      });
      // the wind sock reads the contract's forecast — the desert is awake
      var wnd = range.wind || { dir: 0.7, speed: 0.35 };
      range.sock.rotation.y = wnd.dir + Math.sin(now * 0.00037) * (0.5 - wnd.speed * 0.3);
      range.sock.rotation.z = -(1.35 - wnd.speed * 0.85) +
        Math.sin(now * 0.0016) * (0.06 + wnd.speed * 0.2) + Math.sin(now * 0.0037) * 0.08 * (0.4 + wnd.speed);
      if (range.rabbit.userData.run) stepRabbit(dt);
      stepDust(dt);
      if (S.phase === 'truck') stepConvoy(dt, now);
      if (S.phase === 'counting') {
        rangeT.camT = (now - rangeT.t0) / 1000;   // wall clock — never drifts on slow frames
        updateCamClock();
        if (rangeT.impact) stepDrop();
        var tMinus = rangeT.cue - rangeT.camT;
        var whole = Math.ceil(tMinus);
        if (!rangeT.detDone && whole >= 0 && whole <= 4 && whole !== rangeT.lastBeep && tMinus > -0.05) {
          rangeT.lastBeep = whole;
          PGAudio.beep(whole === 0);
        }
        if (rangeT.detAt != null && !rangeT.detDone && rangeT.camT >= rangeT.detAt) {
          rangeT.detDone = true;
          if (rangeT.impact) range.deviceHolder.visible = false;   // the article is spent
          igniteFX();
          if (S.result.outcome.type === 'early' || S.result.outcome.type === 'cookoff') {
            $('cam-tick').textContent = (S.result.outcome.type === 'cookoff' ? 'THERMAL EVENT — T−' : 'OFF-CUE EVENT — T−') +
              Math.abs(rangeT.cue - rangeT.camT).toFixed(1) + ' s';
            $('cam-tick').classList.remove('hidden');
          } else if (S.result.outcome.type === 'misfire' && rangeT.detAt > rangeT.cue + 0.2) {
            $('cam-tick').textContent = 'LATE EVENT — T+' + (rangeT.camT - rangeT.cue).toFixed(1) + ' s';
            $('cam-tick').classList.remove('hidden');
          }
          if (S.result.visual.fizzle) {
            PGAudio.detonation(0.3, true);
            setCaption('', 'Smoke. A great deal of smoke, arranged vertically.');
            later(4200, craterRevealOrScore);
          }
        }
        if (rangeT.soundAt != null && !rangeT.soundDone && rangeT.camT >= rangeT.soundAt && !S.result.visual.fizzle) {
          rangeT.soundDone = true;
          range.shake = 10 + S.result.visual.dust * 9;
          PGAudio.detonation(clamp(S.result.visual.dust, 0.25, 1.25), false);
          PGAudio.seismo();
          var dw = $('dustwall');
          dw.style.transition = 'none';
          dw.style.opacity = 0.9;
          later(160, function () {
            dw.style.transition = 'opacity 2.4s ease';
            dw.style.opacity = 0;
          });
          $('cam-tick').textContent = 'WAVEFRONT — T+' + S.result.visual.soundDelay.toFixed(1) + ' s · ' + PG2.CAMERA.km.toFixed(1) + ' KM';
          $('cam-tick').classList.remove('hidden');
          later(2600, craterRevealOrScore);
        }
        if (rangeT.detAt == null && rangeT.camT > rangeT.cue + (rangeT.impact ? rangeT.fallS + 1.0 : 1.2) && !rangeT.dudHandled) {
          rangeT.dudHandled = true;
          PGAudio.wind();
          dudHold();
        }
      }
      stepFX(dt);
      if (S.phase === 'crater') stepMeasure(now, dt);
      if (range.craterG) {
        range.craterG.children.forEach(function (ch) {
          if (ch.isSprite) { ch.position.y += (ch.userData.rise || 0.4) * dt * 2; ch.material.opacity = Math.max(ch.material.opacity - dt * 0.02, 0.12); }
        });
      }
      // camera shake
      if (range.shake > 0.05) {
        range.shake = Math.max(0, range.shake - dt * (range.shake > 5 ? 10 : 4));
        var c = range.camera;
        c.position.x += (Math.random() - 0.5) * range.shake * 0.6;
        c.position.y += (Math.random() - 0.5) * range.shake * 0.45;
      }
      renderer.render(range.scene, range.camera);
    }
  }

  /* ================= WIRE-UP UI ================= */
  function starsTxt(n) {
    var s = '';
    for (var i = 0; i < 3; i++) s += i < n ? '★' : '☆';
    return s;
  }
  /* ================= THE CONTRACT BOARD (a corkboard of folders) ================= */
  var boardReturn = 'scr-title';
  function showBoard(from) {
    if (from) boardReturn = from; else boardReturn = 'scr-title';
    S.phase = 'board';
    showUI(null);
    var wall = $('board-wall');
    wall.innerHTML = '';
    var wonCount = 0;
    PG2.CONTRACTS.forEach(function (c, i) {
      var recI = contractRec(i);
      if (recI.won) wonCount++;
      var unlocked = contractUnlocked(i);
      var card = document.createElement('button');
      card.type = 'button';
      card.id = 'bd-' + c.id;
      var tilt = ((i * 47) % 5 - 2) * 0.55;
      card.style.setProperty('--tilt', tilt + 'deg');
      if (!unlocked) {
        card.className = 'bd-card locked';
        card.innerHTML = '<span class="bd-pin"></span>' +
          '<div class="bd-id">' + c.id + '</div>' +
          '<div class="bd-folder">▚▚▚▚▚▚▚▚</div>' +
          '<div class="bd-stamp pending">CLEARANCE<br>PENDING</div>';
        card.addEventListener('click', function () {
          PGAudio.init(); PGAudio.buzz();
          toast('Win ' + (c.unlockAfter || PG2.CONTRACTS[i - 1].id) + ' first. The Authority insists on sequence.');
        });
      } else {
        card.className = 'bd-card' + (recI.won ? ' won' : '');
        var mech = c.impact ? 'IMPACT DROP' : c.flyoff ? 'THE FLY-OFF' : c.dial ? 'TIMER DIAL' : c.offsetSpec ? 'SHAPED BREACH' :
                   c.weightCap ? 'WEIGHT CAP' : c.heatMult ? 'HEAT FORECAST' :
                   c.needsRefinery ? 'THE STILL' : i === 1 ? 'RESTRAINT' : 'THE LOOP';
        card.innerHTML = '<span class="bd-pin"></span>' +
          '<div class="bd-id">' + c.id + '</div>' +
          '<div class="bd-title">' + c.title + '</div>' +
          '<div class="bd-nums">' + c.craterMin + '–' + c.craterMax + ' m · $' + (c.budget / 1000).toFixed(1).replace('.0', '') + 'k · ' + mech + '</div>' +
          '<div class="bd-status">' + (recI.won
            ? '<span class="bd-stars">' + starsTxt(recI.stars) + '</span> WON ON TEST #' + (recI.wonOn || '?')
            : (recI.tests ? 'TEST #' + (recI.tests + 1) + ' AWAITS' : 'OPEN FOR BIDS')) + '</div>' +
          (recI.won ? '<div class="bd-stamp won">AWARDED</div>' : '');
        card.addEventListener('click', function () {
          PGAudio.init(); PGAudio.tap();
          reclaimRefined();
          S.contract = i;
          S.seed = PG2.makeSeed().toUpperCase();
          S.attempt = 0;
          S.assembly = PG2.makeAssembly();
          startContract();
        });
      }
      wall.appendChild(card);
    });
    $('board-sub').textContent = wonCount >= PG2.CONTRACTS.length
      ? 'ACT I — THE SHED · COMPLETE. THE BOARD IS PROUD AND SLIGHTLY AFRAID.'
      : 'ACT I — THE SHED · ' + wonCount + ' OF ' + PG2.CONTRACTS.length + ' CONTRACTS AWARDED';
    showScreen('scr-board');
  }
  $('btn-board-back').addEventListener('click', function () {
    PGAudio.tap();
    if (boardReturn === 'scr-score') { S.phase = 'score'; showScreen('scr-score'); }
    else { S.phase = 'title'; showScreen('scr-title'); }
  });
  $('btn-board-museum').addEventListener('click', function () { PGAudio.tap(); showMuseum('scr-board'); });

  /* ================= THE INCIDENT REPORT MUSEUM (paper and brass) ================= */
  var museumReturn = 'scr-title';
  function fmtDay(t) {
    try {
      var d = new Date(t);
      return (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2);
    } catch (e) { return '—'; }
  }
  var FIRST_ORDER = ['win', 'threeStar', 'batch', 'glaze', 'incident', 'dud', 'flyoff'];
  var FIRST_LABEL = {
    win: 'FIRST CONTRACT WON', threeStar: 'FIRST FULL CARD (3 STAMPS)', batch: 'FIRST REFINED BATCH',
    glaze: 'FIRST G-3 POURED', incident: 'FIRST FRAMED DISASTER', dud: 'FIRST DUD, MADE SAFE', flyoff: 'THE FLY-OFF, WON'
  };
  function showMuseum(from) {
    museumReturn = from || 'scr-title';
    S.phase = 'museum';
    showUI(null);
    var M = SAVE.museum;
    var el = $('museum-scroll');
    var html = '<div class="mu-head">REDSKY INC</div>' +
      '<div class="mu-title">THE INCIDENT REPORT MUSEUM</div>' +
      '<div class="mu-sub">EVERY DISASTER FRAMED · EVERY FIRST IN BRASS · ADMISSION FREE, DIGNITY OPTIONAL</div>';
    // wall of firsts
    html += '<div class="mu-sec-head">— WALL OF FIRSTS —</div><div class="mu-firsts">';
    var anyFirst = false;
    FIRST_ORDER.forEach(function (k) {
      var f = M.firsts[k];
      if (!f) return;
      anyFirst = true;
      html += '<div class="mu-brass"><div class="mb-lbl">' + (FIRST_LABEL[k] || f.label) + '</div><div class="mb-date">' + fmtDay(f.t) + '</div></div>';
    });
    if (!anyFirst) html += '<div class="mu-empty">The brass plates are blank. The engraver waits, hungry.</div>';
    html += '</div>';
    // best-crater plaques
    html += '<div class="mu-sec-head">— BEST CRATERS, BY CONTRACT —</div><div class="mu-plaques">';
    var anyPlaque = false;
    PG2.CONTRACTS.forEach(function (c) {
      var p = M.plaques[c.id];
      if (!p) return;
      anyPlaque = true;
      html += '<div class="mu-plaque"><div class="mp-id">' + c.id + '</div>' +
        '<div class="mp-crater">⌀ ' + p.crater.toFixed(1) + ' m</div>' +
        '<div class="mp-sub">' + starsTxt(p.stars) + ' · TEST #' + (p.attempt || '?') + ' · ' + fmtDay(p.t) + '</div></div>';
    });
    if (!anyPlaque) html += '<div class="mu-empty">No craters worth bronze. Yet. The desert is patient.</div>';
    html += '</div>';
    // framed disasters
    html += '<div class="mu-sec-head">— THE GALLERY OF FRAMED DISASTERS —</div><div class="mu-frames">';
    if (!M.irs.length) {
      html += '<div class="mu-empty">No incidents on file. The Authority finds this statistically suspicious.</div>';
    } else {
      M.irs.slice().reverse().forEach(function (ir, i) {
        html += '<button type="button" class="mu-frame" data-ir="' + (M.irs.length - 1 - i) + '">' +
          '<div class="mf-form">FORM IR-3 · ' + ir.c + ' · ' + fmtDay(ir.t) + '</div>' +
          '<div class="mf-outcome">' + ir.outcome + '</div>' +
          '<div class="mf-where">BLAME: ' + (ir.where || 'ASSEMBLY BAY') +
          (ir.phase ? ' · ' + ir.phase + ' PHASE' : '') + ' · TEST #' + (ir.attempt || '?') + '</div>' +
        '</button>';
      });
    }
    html += '</div><div class="mu-foot">EXHIBITS ROTATE. SHAME IS PERMANENT. · ALL SCIENCE INVENTED</div>';
    el.innerHTML = html;
    el.querySelectorAll('.mu-frame').forEach(function (fr) {
      fr.addEventListener('click', function () {
        PGAudio.tap();
        var ir = SAVE.museum.irs[parseInt(fr.dataset.ir, 10)];
        if (ir) showArchivedIncident(ir);
      });
    });
    showScreen('scr-museum');
  }
  function showArchivedIncident(ir) {
    renderIncidentDoc({
      form: 'FORM IR-3 (REV. 12)', series: 'TEST SERIES ' + (ir.seed || '—') + ' · ' + ir.c,
      outcome: ir.outcome, cause: ir.cause, receipt: ir.receipt, phase: ir.phase || null,
      disposition: ir.disposition || 'Filed. Framed. Lit tastefully.'
    }, true);
  }
  $('btn-museum-back').addEventListener('click', function () {
    PGAudio.tap();
    if (museumReturn === 'scr-score') { S.phase = 'score'; showScreen('scr-score'); }
    else if (museumReturn === 'scr-board') { showBoard(boardReturn); }
    else { S.phase = 'title'; showScreen('scr-title'); }
  });

  $('btn-start').addEventListener('click', function () {
    PGAudio.init(); PGAudio.tap();
    startContract();
  });
  $('btn-title-board').addEventListener('click', function () {
    PGAudio.init(); PGAudio.tap();
    showBoard('scr-title');
  });
  $('btn-title-museum').addEventListener('click', function () {
    PGAudio.init(); PGAudio.tap();
    showMuseum('scr-title');
  });
  function refreshTitle() {
    var won = 0;
    PG2.CONTRACTS.forEach(function (c, i) { if (contractRec(i).won) won++; });
    var cur = PG2.CONTRACTS[S.contract];
    $('btn-start').innerHTML = won === 0 ? 'TAP TO START'
      : 'CONTINUE — ' + cur.id + '<span class="start-sub">' + cur.title + '</span>';
    var tp = $('title-progress');
    if (won > 0) {
      tp.classList.remove('hidden');
      tp.textContent = 'ACT I — THE SHED · ' + won + '/' + PG2.CONTRACTS.length + ' CONTRACTS AWARDED';
    } else {
      tp.classList.add('hidden');
    }
  }

  /* settings drawer */
  function refreshSettingsUI() {
    $('set-sound').classList.toggle('on', SETTINGS.sound);
    $('set-skip').classList.toggle('on', SETTINGS.skipCine);
    $('set-lefty').classList.toggle('on', SETTINGS.lefty);
  }
  function bindToggle(id, key) {
    $(id).addEventListener('click', function () {
      SETTINGS[key] = !SETTINGS[key];
      applySettings();
      refreshSettingsUI();
      persist();
      PGAudio.tap();
    });
  }
  bindToggle('set-sound', 'sound');
  bindToggle('set-skip', 'skipCine');
  bindToggle('set-lefty', 'lefty');
  $('btn-settings').addEventListener('click', function () {
    PGAudio.init(); PGAudio.tap();
    refreshSettingsUI();
    $('settings-overlay').classList.remove('hidden');
  });
  $('set-close').addEventListener('click', function () {
    PGAudio.tap();
    $('settings-overlay').classList.add('hidden');
  });
  function startContract() {
    S.phase = 'rfp';
    showUI(null);
    buildRFP();
    showScreen('scr-rfp');
  }
  $('btn-accept').addEventListener('click', function () {
    PGAudio.init(); PGAudio.stampThud();
    enterBuild(false);
  });
  $('btn-closeout').addEventListener('click', function () {
    PGAudio.tap();
    enterWiring();
  });
  $('btn-panel-done').addEventListener('click', function () {
    PGAudio.tap();
    $('btn-panel-done').classList.add('hidden');
    exitWiring();
  });
  $('btn-det-done').addEventListener('click', function () {
    PGAudio.tap();
    $('btn-det-done').classList.add('hidden');
    enterArm();
  });
  $('btn-torange').addEventListener('click', function () {
    PGAudio.tap();
    $('btn-torange').classList.add('hidden');
    enterRange();
  });
  $('btn-skip-truck').addEventListener('click', function () {
    PGAudio.tap();
    if (S.phase === 'truck') { stationSeven(); return; }
    if (S.phase === 'station' && range && range.vBeatSkip) {
      // skip the Vantage demonstration, keep the verdict
      clearLater();
      var fn = range.vBeatSkip;
      range.vBeatSkip = null;
      var vf = S.result.flyoff && S.result.flyoff.v;
      setCaption('PAD B · MEASURED', vf && vf.crater != null
        ? 'Vantage posts ' + vf.crater.toFixed(1) + ' m. Your pad is hot.'
        : 'Vantage posts a silence. Your pad is hot.');
      fn();
    }
  });

  /* ================= THE STILL (REFINERY v1 → SYSTEM) =================
     Two stations now: DISTIL (band-hold, F-1A → F-1X) and
     BLEND (pour-to-ratio, F-2S → ADDITIVE G-3). Stock persists in the save —
     the batch ledger is a war chest. */
  var REF_BAND = { lo: 0.58, hi: 0.78 };    // needle band (matches gauge CSS)
  var ref = {
    open: false, tab: 'distil', running: false, heating: false, scorched: false,
    T: 0, prog: 0, scorch: 0, batchNum: 0, wobbleT: 0, walk: 0, walkTarget: 0, rng: null
  };
  var blend = { running: false, pouring: false, level: 0, flow: 0, batchNum: 0, lastNow: 0 };
  function refStatus(html) { $('ref-status').innerHTML = html; }
  function blendStatus(html) { $('blend-status').innerHTML = html; }
  function refStockLine() {
    var st = S.assembly.refine.stock;
    var line = 'LEDGER — F-1X <b>×' + st.emberx + '</b> · SCORCHED <b>×' + st.emberxs + '</b> · G-3 <b>×' + st.glaze +
      '</b> · SPENT <b>' + fmt$(S.assembly.refine.spend) + '</b><span class="ref-persist">STOCK CARRIES BETWEEN CONTRACTS</span>';
    $('ref-stock').innerHTML = line;
  }
  function updateRefStart() {
    var d = PG2.derive(S.assembly, rfp());
    var over = d.cost + PG2.REFINERY.batchCost > rfp().budget;
    var btn = $('ref-start');
    btn.disabled = ref.running || over;
    btn.textContent = over ? 'BUDGET WON’T COVER ANOTHER BATCH'
      : 'START BATCH — $' + PG2.REFINERY.batchCost + ' · ' + PG2.REFINERY.batchYield + ' CANISTERS';
    var overB = d.cost + PG2.REFINERY.glazeCost > rfp().budget;
    var bb = $('blend-start');
    bb.disabled = blend.running || overB;
    bb.textContent = overB ? 'BUDGET WON’T COVER A POUR'
      : 'START POUR — $' + PG2.REFINERY.glazeCost + ' · UP TO ' + PG2.REFINERY.glazeYield + ' CANISTERS';
    $('blend-bottle').disabled = !(blend.running && !blend.pouring && blend.flow < 0.02 &&
      blend.level >= PG2.REFINERY.pourLo && blend.level <= PG2.REFINERY.pourHi);
  }
  function setRefTab(tab) {
    ref.tab = tab;
    $('ref-tab-distil').classList.toggle('on', tab === 'distil');
    $('ref-tab-blend').classList.toggle('on', tab === 'blend');
    $('ref-distil-body').classList.toggle('hidden', tab !== 'distil');
    $('ref-blend-body').classList.toggle('hidden', tab !== 'blend');
    $('ref-heat').classList.toggle('hidden', tab !== 'distil');
    $('blend-pour').classList.toggle('hidden', tab !== 'blend');
    $('ref-start').classList.toggle('hidden', tab !== 'distil');
    $('blend-start').classList.toggle('hidden', tab !== 'blend');
    $('blend-bottle').classList.toggle('hidden', tab !== 'blend');
    $('ref-head').textContent = tab === 'distil' ? 'THE STILL · FILLER 1A → F-1X' : 'THE BENCH · F-2S → ADDITIVE G-3';
    $('ref-sub').innerHTML = tab === 'distil'
      ? 'Hold <b>HEAT</b> to warm the kettle. Keep the needle in the amber band until the batch is done. Ride it too hot for too long and the batch scorches.'
      : 'Hold <b>POUR</b> to tip the carboy. The stream has momentum — release early, let it settle <b>on the line</b>, then bottle it. Overpour and the bench drinks the difference.';
    PGAudio.tap();
  }
  function openRefinery() {
    ref.open = true;
    ref.running = false; ref.heating = false;
    ref.T = 0; ref.prog = 0; ref.scorch = 0; ref.scorched = false;
    blend.running = false; blend.pouring = false; blend.level = 0; blend.flow = 0;
    $('ref-needle').style.top = '96%';
    $('ref-prog-fill').style.width = '0%';
    $('blend-fill').style.height = '0%';
    refStatus('The kettle is cold. FILLER 1A goes in ordinary; it comes out with ambitions.');
    blendStatus('The carboy waits. FILLER 2S goes in calm; it comes out diplomatic.');
    setRefTab(ref.tab || 'distil');
    refStockLine();
    updateRefStart();
    $('refinery-overlay').classList.remove('hidden');
  }
  function startBatch() {
    ref.running = true; ref.scorched = false;
    ref.T = 0; ref.prog = 0; ref.scorch = 0;
    ref.batchNum++;
    ref.rng = PG2.stream(S.seed, 'refine:' + ref.batchNum);
    ref.walk = 0; ref.walkTarget = 0; ref.wobbleT = 0;
    ref.lastNow = 0;
    refStatus('Batch ' + ref.batchNum + ' on the burner. Hold <b>HEAT</b> — amber band — steady hands.');
    updateRefStart();
  }
  function finishBatch() {
    ref.running = false;
    ref.heating = false;
    $('ref-heat').classList.remove('held');
    document.querySelector('.ref-card').classList.remove('boiling');
    PGAudio.boilStop();
    var a = S.assembly;
    a.refine.spend += PG2.REFINERY.batchCost;
    var kind = ref.scorched ? 'emberxs' : 'emberx';
    a.refine.stock[kind] += PG2.REFINERY.batchYield;
    syncStock();       // the ledger persists — a stocked shelf is a war chest
    museumFirst('batch', 'FIRST REFINED BATCH');
    clearHistory();   // the still changed the stock ledger — undo history can't reach behind it
    PGAudio.batchDone(!ref.scorched);
    refStatus(ref.scorched
      ? '<b class="scorch">SCORCHED.</b> Two canisters of weaker, angrier F-1X. They still count. Barely.'
      : 'Beautiful. Two canisters of <b>FILLER 1X</b>, glowing politely.');
    refStockLine();
    refreshHUD();
    updateRefStart();
  }
  /* ---- BLEND: pour F-2S to the line ---- */
  function startBlend() {
    blend.running = true;
    blend.level = 0; blend.flow = 0; blend.pouring = false;
    blend.batchNum++;
    blend.lastNow = 0;
    var a = S.assembly;
    a.refine.spend += PG2.REFINERY.glazeCost;   // the pour is paid for when the carboy tips
    blendStatus('Carboy up. Hold <b>POUR</b> — mind the momentum, aim for the band.');
    refStockLine();
    updateRefStart();
  }
  function finishBlend(overpoured) {
    blend.running = false; blend.pouring = false;
    PGAudio.boilStop();
    var a = S.assembly;
    var yieldN = overpoured ? 1 : PG2.REFINERY.glazeYield;
    a.refine.stock.glaze += yieldN;
    syncStock();
    museumFirst('glaze', 'FIRST G-3 POURED');
    clearHistory();
    PGAudio.batchDone(!overpoured);
    blendStatus(overpoured
      ? '<b class="scorch">OVERPOURED.</b> The bench drinks the difference. One canister of ADDITIVE G-3, and a lecture.'
      : 'On the line. <b>Two canisters of ADDITIVE G-3</b>, cool as filed paperwork.');
    refStockLine();
    refreshHUD();
    updateRefStart();
  }
  function stepBlend(now) {
    if (!blend.running) return;
    // the pour runs on wall time — slow frames must not slow the stream
    var dt = Math.min((now - (blend.lastNow || now)) / 1000, 0.25);
    blend.lastNow = now;
    // pour physics: flow ramps while held, coasts after release — the skill is stopping early
    var target = blend.pouring ? 0.34 : 0;
    var k = blend.pouring ? 4.5 : 2.6;
    blend.flow += (target - blend.flow) * Math.min(dt * k, 1);
    if (!blend.pouring && blend.flow < 0.004) blend.flow = 0;
    blend.level = clamp(blend.level + blend.flow * dt, 0, 1);
    $('blend-fill').style.height = (blend.level * 100) + '%';
    $('blend-carboy').classList.toggle('tipped', blend.pouring);
    // past the line is past the line — the batch degrades the moment you cross it
    if (blend.level > PG2.REFINERY.pourHi + 0.002) { finishBlend(true); return; }
    updateRefStart();
  }
  function stepRefinery(dt, now) {
    if (!ref.open) return;
    stepBlend(now);
    if (!ref.running) return;
    // the kettle runs on wall time — slow frames must not slow the burner
    dt = Math.min((now - (ref.lastNow || now)) / 1000, 0.25);
    ref.lastNow = now;
    ref.wobbleT += dt;
    if (ref.wobbleT > 0.5) { ref.wobbleT = 0; ref.walkTarget = (ref.rng() - 0.5) * 0.18; }
    ref.walk += (ref.walkTarget - ref.walk) * Math.min(dt * 2.2, 1);
    var rate = ref.heating ? 0.34 : -0.30;
    ref.T = clamp(ref.T + (rate + ref.walk * 0.55) * dt, 0, 1);
    var inBand = ref.T >= REF_BAND.lo && ref.T <= REF_BAND.hi;
    if (inBand) ref.prog += dt;
    if (ref.T > 0.88) {
      ref.scorch += dt;
      if (!ref.scorched && ref.scorch > PG2.REFINERY.scorchLimit) {
        ref.scorched = true;
        PGAudio.buzz();
        refStatus('<b class="scorch">Too hot for too long.</b> The batch has opinions now. Finish it anyway.');
      }
    }
    $('ref-needle').style.top = ((1 - ref.T) * 100) + '%';
    $('ref-prog-fill').style.width = clamp(ref.prog / PG2.REFINERY.holdSeconds, 0, 1) * 100 + '%';
    if (ref.prog >= PG2.REFINERY.holdSeconds) finishBatch();
  }
  (function () {
    var hb = $('ref-heat');
    function down(e) {
      e.preventDefault();
      PGAudio.init();
      if (!ref.running) return;
      ref.heating = true;
      hb.classList.add('held');
      document.querySelector('.ref-card').classList.add('boiling');
      PGAudio.boilStart();
    }
    function up() {
      ref.heating = false;
      hb.classList.remove('held');
      document.querySelector('.ref-card').classList.remove('boiling');
      PGAudio.boilStop();
    }
    hb.addEventListener('pointerdown', down);
    hb.addEventListener('pointerup', up);
    hb.addEventListener('pointercancel', up);
    hb.addEventListener('pointerleave', up);
  })();
  (function () {
    var pb = $('blend-pour');
    function down(e) {
      e.preventDefault();
      PGAudio.init();
      if (!blend.running) return;
      blend.pouring = true;
      pb.classList.add('held');
      PGAudio.boilStart();
    }
    function up() {
      blend.pouring = false;
      pb.classList.remove('held');
      PGAudio.boilStop();
    }
    pb.addEventListener('pointerdown', down);
    pb.addEventListener('pointerup', up);
    pb.addEventListener('pointercancel', up);
    pb.addEventListener('pointerleave', up);
  })();
  $('ref-start').addEventListener('click', function () { PGAudio.tap(); startBatch(); });
  $('blend-start').addEventListener('click', function () { PGAudio.tap(); startBlend(); });
  $('blend-bottle').addEventListener('click', function () {
    if (!blend.running) return;
    PGAudio.tap();
    if (blend.level < PG2.REFINERY.pourLo) { blendStatus('Shy of the line. Keep pouring.'); return; }
    finishBlend(false);
  });
  $('ref-tab-distil').addEventListener('click', function () { setRefTab('distil'); });
  $('ref-tab-blend').addEventListener('click', function () { setRefTab('blend'); });
  $('ref-close').addEventListener('click', function () {
    PGAudio.tap();
    PGAudio.boilStop();
    ref.open = false; ref.running = false; ref.heating = false;
    blend.running = false; blend.pouring = false;
    document.querySelector('.ref-card').classList.remove('boiling');
    $('refinery-overlay').classList.add('hidden');
    refreshHUD();
  });
  $('btn-refinery').addEventListener('click', function () { PGAudio.tap(); openRefinery(); });
  $('btn-refire').addEventListener('click', function () { PGAudio.tap(); enterRange(); });
  $('btn-det-pull').addEventListener('click', function () {
    PGAudio.unsnap();
    $('btn-det-pull').classList.add('hidden');
    $('btn-det-done').classList.add('hidden');
    S.assembly.det = { seated: false, slam: 0 };
    if (bay.detStage) {
      if (bay.detStage.det) bay.scene.remove(bay.detStage.det);
      if (bay.detStage.caseG) bay.scene.remove(bay.detStage.caseG);
    }
    var d = casingDims(S.assembly.shell);
    var wellW = bay.device.localToWorld(V3(wellX(S.assembly.shell), d.r + 0.05, 0));
    if (bay.capPivot) tween(500, function (t) { bay.capPivot.rotation.z = 1.9 * t; bay.capPivot.position.y = (d.r + 0.055) + 0.10 * t; });
    toast('Detonator pulled. Gently, this time.');
    stageDetCase(wellW);
  });

  /* ================= DEBUG / TEST API ================= */
  window.__pg = {
    state: function () {
      return {
        phase: S.phase, seed: S.seed, contract: S.contract, attempt: S.attempt,
        assembly: JSON.parse(JSON.stringify(S.assembly))
      };
    },
    refineState: function () {
      return {
        open: ref.open, running: ref.running, T: ref.T, prog: ref.prog,
        scorch: ref.scorch, scorched: ref.scorched,
        stock: JSON.parse(JSON.stringify(S.assembly.refine.stock)),
        spend: S.assembly.refine.spend
      };
    },
    result: function () { return S.result; },
    setSpin: function (on) { bay.spinEnabled = !!on; },
    nodes: function () {
      var out = {};
      nodeList().forEach(function (n) {
        out[n.id] = worldToScreen(bay.device.localToWorld(n.pos.clone()), bay.camera);
      });
      return out;
    },
    nodesFor: function (partId) {
      var out = {};
      nodeList().forEach(function (n) {
        if (n.accepts.indexOf(partId) < 0) return;
        out[n.id] = worldToScreen(bay.device.localToWorld(n.pos.clone()), bay.camera);
      });
      return out;
    },
    wiring: function () {
      if (!wst || $('wire-station').classList.contains('hidden')) return null;
      var r = stationRect();
      var terms = {};
      Object.keys(wst.terms).forEach(function (pin) {
        terms[pin] = { x: r.left + wst.terms[pin].x, y: r.top + wst.terms[pin].y, n: wst.nums[pin] };
      });
      var spools = {};
      Object.keys(wst.spools).forEach(function (c) {
        spools[c] = { x: r.left + wst.spools[c].x, y: r.top + wst.spools[c].y };
      });
      var probes = {};
      ['red', 'blk'].forEach(function (id) {
        probes[id] = { x: r.left + wst.probes[id].x, y: r.top + wst.probes[id].y, pin: wst.probes[id].pin };
      });
      return {
        runs: JSON.parse(JSON.stringify(wst.spec.runs)),
        decoys: wst.spec.decoys.slice(),
        numbers: JSON.parse(JSON.stringify(wst.nums)),
        plan: JSON.parse(JSON.stringify(wst.plan)),
        terms: terms, spools: spools, probes: probes,
        conns: JSON.parse(JSON.stringify(S.assembly.conns)),
        verified: PG2.verifiedRuns(S.assembly, rfp()),
        complete: PG2.wiringComplete(S.assembly, rfp()),
        schem: wst.schem, testing: wst.testing,
        meter: $('meter-read').textContent
      };
    },
    detAnchors: function () {
      if (!bay.detStage) return null;
      var ds = bay.detStage;
      return {
        det: ds.det ? worldToScreen(ds.det.position, bay.camera) : null,
        above: ds.path ? worldToScreen(ds.path[1], bay.camera) : null,
        mid: ds.path ? worldToScreen(ds.path[2], bay.camera) : null,
        seat: ds.path ? worldToScreen(ds.path[3], bay.camera) : null,
        p: ds.p, seated: ds.seated, slam: ds.slam
      };
    },
    armAnchors: function () {
      if (!bay.armPanelMesh) return null;
      var pm = bay.armPanelMesh;
      return {
        cover: worldToScreen(pm.userData.coverPivot.getWorldPosition(new THREE.Vector3()), bay.camera),
        lever: worldToScreen(pm.userData.leverPivot.getWorldPosition(new THREE.Vector3()), bay.camera),
        coverOpen: bay.armStage ? bay.armStage.coverOpen : false
      };
    },
    save: function () {
      return JSON.parse(JSON.stringify({ settings: SETTINGS, contracts: SAVE.contracts,
        stock: SAVE.stock, museum: SAVE.museum, scars: SAVE.scars }));
    },
    dialState: function () {
      return { phase: S.phase, cur: dial.cur, set: S.assembly.timerSet };
    },
    dialRect: function () {
      var r = $('dial-svg').getBoundingClientRect();
      var app = $('app').getBoundingClientRect();
      return { cx: r.left + r.width / 2 - app.left, cy: r.top + r.height / 2 - app.top, r: r.width / 2 };
    },
    blendState: function () {
      return { running: blend.running, level: blend.level, flow: blend.flow,
        lo: PG2.REFINERY.pourLo, hi: PG2.REFINERY.pourHi,
        stock: JSON.parse(JSON.stringify(S.assembly.refine.stock)) };
    },
    measure: function () { return { active: msr.active, prog: !!msr.progDone, band: !!msr.bandDone }; },
    scars: function () { return JSON.parse(JSON.stringify(SAVE.scars)); },
    vantagePad: function () { return !!(range && range.vantageG); },
    wind: function () { return range && range.wind ? { dir: range.wind.dir, speed: range.wind.speed } : null; },
    debugAssembly: function (a) {
      // test harness only: inject a canned assembly (UI paths are proven separately)
      S.assembly = JSON.parse(JSON.stringify(a));
      if (S.phase === 'build') { rebuildDevice(); refreshHUD(); }
    },
    history: function () { return { undo: hist.undo.length, redo: hist.redo.length }; },
    orbit: function () {
      return { theta: bay.orbit.theta, phi: bay.orbit.phi, radius: bay.orbit.radius,
               target: { x: bay.orbit.target.x, y: bay.orbit.target.y, z: bay.orbit.target.z },
               velTheta: bay.velTheta };
    },
    partScreen: function (kind, slot) {
      var root = findPlacedRoot(kind, slot == null ? null : slot);
      if (!root) return null;
      var bb = new THREE.Box3().setFromObject(root);
      return worldToScreen(bb.getCenter(new THREE.Vector3()), bay.camera);
    },
    partCardVisible: function () { return !$('part-card').classList.contains('hidden'); },
    phaseRail: function () {
      var steps = {};
      document.querySelectorAll('.pr-step').forEach(function (el) {
        var r = el.getBoundingClientRect();
        steps[el.dataset.phase] = { x: r.left + r.width / 2, y: r.top + r.height / 2,
          on: el.classList.contains('on'), dim: el.classList.contains('dim') };
      });
      return { phase: buildPhase, steps: steps };
    },
    drawer: function () {
      var tabR = $('drawer-tab').getBoundingClientRect();
      var tiles = {};
      document.querySelectorAll('#drawer-grid .tile').forEach(function (t) {
        var r = t.getBoundingClientRect();
        tiles[t.id.slice(5)] = { x: r.left + r.width / 2, y: r.top + r.height / 2,
          locked: t.classList.contains('locked'), disabled: t.classList.contains('disabled'),
          unlock: t.querySelector('.t-unlock') ? t.querySelector('.t-unlock').textContent : null };
      });
      var spine = {};
      document.querySelectorAll('.spine-tab').forEach(function (el) {
        var r = el.getBoundingClientRect();
        spine[el.dataset.cat] = { x: r.left + r.width / 2, y: r.top + r.height / 2,
          on: el.classList.contains('on'), sealed: el.classList.contains('sealed') };
      });
      return { open: drawer.open, cat: drawer.cat,
        tab: { x: tabR.left + tabR.width / 2, y: tabR.top + tabR.height / 2 },
        tiles: tiles, spine: spine,
        panelLeft: $('drawer').getBoundingClientRect().left,
        title: $('drawer-title').textContent };
    },
    pickAt: function (x, y) {
      var root = pickPart({ x: x, y: y });
      return root && root.userData.remove ? root.userData.remove : null;
    },
    drop: function () {
      return {
        impact: !!rangeT.impact, landed: !!rangeT.landed, dropped: !!rangeT.dropDone,
        deviceY: range && range.deviceHolder ? range.deviceHolder.position.y : null,
        deviceX: range && range.deviceHolder ? range.deviceHolder.position.x : null,
        rig: !!(range && range.dropRig && range.dropRig.visible)
      };
    },
    convoy: function () {
      return range && range.convoy ? { t: range.convoy.t, shot: range.convoy.shot, slammed: range.convoy.slammed } : null;
    },
    palette: function () { return range ? range.palette : null; },
    standStory: function () {
      return { tests: contractRec(S.contract).tests, clipboard: bay.clipboard.visible };
    },
    floorPixel: function (x, y) {
      var d = bay.floorCanvas.getContext('2d').getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2], d[3]];
    },
    floorScreen: function (wx, wz) { return worldToScreen(V3(wx, 0.02, wz), bay.camera); },
    glOK: function () {
      var gl = renderer.getContext();
      return !!gl && !gl.isContextLost();
    },
    sampleGL: function () {
      // render the active scene, then read back a pixel block — proves real WebGL output
      var scene = null, cam = null;
      if (S.phase === 'build' || S.phase === 'wiring' || S.phase === 'det' || S.phase === 'arm') {
        scene = bay.scene; cam = bay.camera;
      } else if (range) {
        scene = range.scene; cam = range.camera;
      }
      if (!scene) return { ok: false, reason: 'no active scene' };
      renderer.render(scene, cam);
      var gl = renderer.getContext();
      var w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      var px = new Uint8Array(24 * 24 * 4);
      gl.readPixels(Math.floor(w / 2) - 12, Math.floor(h / 2) - 12, 24, 24, gl.RGBA, gl.UNSIGNED_BYTE, px);
      var sum = 0, distinct = {};
      for (var i = 0; i < px.length; i += 4) {
        sum += px[i] + px[i + 1] + px[i + 2];
        distinct[px[i] + ',' + px[i + 1] + ',' + px[i + 2]] = 1;
      }
      return { ok: sum > 0, sum: sum, distinct: Object.keys(distinct).length };
    }
  };

  /* ================= BOOT ================= */
  loadSave();
  applySettings();
  // default to the freshest unlocked, unwon contract on the ladder
  if (!urlSeed && !urlContractForced) {
    for (var ci = 0; ci < PG2.CONTRACTS.length; ci++) {
      if (contractUnlocked(ci) && !contractRec(ci).won) { S.contract = ci; break; }
      if (contractRec(ci).won) S.contract = Math.min(ci + 1, PG2.CONTRACTS.length - 1);
    }
  }
  refreshTitle();
  initGL();
  bay = initBay();
  makeIcons();
  buildDrawer();
  bayCam();
  requestAnimationFrame(loop);

  // PWA: offline shell (network-first, so local dev and ?seed= stay honest)
  if ('serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {}
  }

})();
