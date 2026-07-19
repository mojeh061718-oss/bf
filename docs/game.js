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
    world: 'career',           // 'career' | 'sandbox' — picked at the gate; sandbox money is a prop
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
    doneOrders: {},                                  // orders already run — a bid board never repeats itself
    /* the sandbox lot: same workshop, prop money, career progress untouched */
    sb: { bench: null, rndTests: 0, rsk: 0, types: [], run: null, doneOrders: {} },
    ls: { best: [], solutions: [] }   // Long Shot: record board + saved firing solutions
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
    // v3 → v4: the sandbox lot opens next door
    if (!s.sb) s.sb = { bench: null, rndTests: 0, rsk: 0, types: [], run: null, doneOrders: {} };
    if (!s.ls) s.ls = { best: [], solutions: [] };
    s.v = 4;
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
      SAVE.sb = s.sb;
      if (s.ls) SAVE.ls = s.ls;
      if (SAVE.ui && SAVE.ui.drawerCat) drawer.cat = SAVE.ui.drawerCat;
    } catch (e) { /* private mode etc — play in-memory */ }
  }
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 3, settings: SETTINGS, contracts: SAVE.contracts,
        stock: SAVE.stock, museum: SAVE.museum, scars: SAVE.scars, ui: SAVE.ui, paint: SAVE.paint,
        cash: SAVE.cash, banked: SAVE.banked, bench: SAVE.bench, rndTests: SAVE.rndTests,
        rsk: SAVE.rsk, types: SAVE.types, run: SAVE.run, doneOrders: SAVE.doneOrders, sb: SAVE.sb, ls: SAVE.ls
      }));
    } catch (e) {}
  }
  function wonCountAll() {
    var n = 0;
    PG2.CONTRACTS.forEach(function (c, i) { if (contractRec(i).won) n++; });
    return n;
  }
  /* ---- the two worlds: career money is real; sandbox money is a prop ---- */
  function WS() { return S.world === 'sandbox' ? SAVE.sb : SAVE; }
  function cashUnlimited() { return S.world === 'sandbox'; }
  function cashOK(cost) { return cashUnlimited() || SAVE.cash >= cost; }
  function cashSpend(n) { if (!cashUnlimited()) SAVE.cash -= n; }
  function cashAdd(n) { if (!cashUnlimited()) SAVE.cash += n; }
  function cashLabel() { return cashUnlimited() ? 'UNLIMITED · SANDBOX' : fmt$(SAVE.cash); }
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));   // native-res on modern phones
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;                  // the filmic curve is the premium
    renderer.toneMappingExposure = 1.45;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // WIDE GAMUT: the iPhone OLED is Display-P3 — paint the drawing buffer in
    // P3 so the ambers and fireball reds run past the sRGB fence. Feature-
    // detected: a no-op anywhere the extension is absent, so it can't hurt.
    try {
      var _gl = renderer.getContext();
      if (_gl && 'drawingBufferColorSpace' in _gl) _gl.drawingBufferColorSpace = 'display-p3';
    } catch (e) {}
    size();
    window.addEventListener('resize', size);
  }
  function size() {
    var r = $('app').getBoundingClientRect();
    W = Math.max(300, r.width); H = Math.max(400, r.height);
    renderer.setSize(W, H, false);
    if (bay) { bay.camera.aspect = W / H; bay.camera.updateProjectionMatrix(); }
    if (range) { range.camera.aspect = W / H; range.camera.updateProjectionMatrix(); }
    if (BLOOM.ready) bloomResize();
  }

  /* ================= REAL-TIME BLOOM =================
     Hand-rolled (no postprocessing addon): render the scene to a target,
     extract the bright emissives, blur them soft and wide, add back over
     the sharp scene. Everything that glows — the fireball, the tungsten
     lamps, the sun, the beacon, window light, hot terminals — blooms.
     Operates in sRGB space (no dark-banding); hard fallback to a plain
     render if anything in the chain fails, so it can never break the game. */
  var BLOOM = {
    ready: false, on: true, threshold: 0.60, strength: 1.05, spread: 1.35,
    sceneRT: null, a: null, b: null, ortho: null, quad: null,
    mBright: null, mBlur: null, mComp: null, _v: null
  };
  function bloomInit() {
    if (BLOOM.ready || !BLOOM.on) return;
    try {
      var dpr = renderer.getPixelRatio();
      var w = Math.floor(W * dpr), h = Math.floor(H * dpr);
      var hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
      var rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
                     format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false };
      BLOOM.sceneRT = new THREE.WebGLRenderTarget(w, h, rtOpts);
      if (BLOOM.sceneRT.texture.encoding !== undefined) BLOOM.sceneRT.texture.encoding = THREE.sRGBEncoding;
      var half = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false };
      BLOOM.a = new THREE.WebGLRenderTarget(hw, hh, half);
      BLOOM.b = new THREE.WebGLRenderTarget(hw, hh, half);
      BLOOM.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      BLOOM._v = new THREE.Vector2();
      var VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
      BLOOM.mBright = new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, threshold: { value: BLOOM.threshold } },
        vertexShader: VERT,
        fragmentShader:
          'varying vec2 vUv; uniform sampler2D tDiffuse; uniform float threshold;' +
          'void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;' +
          'float l = max(max(c.r, c.g), c.b);' +
          'float k = max(0.0, l - threshold) / max(l, 1e-4);' +
          'gl_FragColor = vec4(c * k * k, 1.0); }',
        depthTest: false, depthWrite: false
      });
      BLOOM.mBlur = new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } },
        vertexShader: VERT,
        fragmentShader:
          'varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 dir;' +
          'void main(){ vec3 s = vec3(0.0);' +
          's += texture2D(tDiffuse, vUv + dir*-4.0).rgb * 0.0512;' +
          's += texture2D(tDiffuse, vUv + dir*-3.0).rgb * 0.0918;' +
          's += texture2D(tDiffuse, vUv + dir*-2.0).rgb * 0.1231;' +
          's += texture2D(tDiffuse, vUv + dir*-1.0).rgb * 0.1353;' +
          's += texture2D(tDiffuse, vUv).rgb * 0.1391;' +
          's += texture2D(tDiffuse, vUv + dir* 1.0).rgb * 0.1353;' +
          's += texture2D(tDiffuse, vUv + dir* 2.0).rgb * 0.1231;' +
          's += texture2D(tDiffuse, vUv + dir* 3.0).rgb * 0.0918;' +
          's += texture2D(tDiffuse, vUv + dir* 4.0).rgb * 0.0512;' +
          'gl_FragColor = vec4(s, 1.0); }',
        depthTest: false, depthWrite: false
      });
      BLOOM.mComp = new THREE.ShaderMaterial({
        uniforms: { tScene: { value: null }, tBloom: { value: null }, strength: { value: BLOOM.strength } },
        vertexShader: VERT,
        fragmentShader:
          'varying vec2 vUv; uniform sampler2D tScene; uniform sampler2D tBloom; uniform float strength;' +
          'void main(){ vec3 base = texture2D(tScene, vUv).rgb; vec3 bl = texture2D(tBloom, vUv).rgb;' +
          // screen-blend the bloom so highlights lift without blowing out
          'vec3 outc = 1.0 - (1.0 - base) * (1.0 - bl * strength);' +
          'gl_FragColor = vec4(outc, 1.0); }',
        depthTest: false, depthWrite: false
      });
      BLOOM.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), BLOOM.mBright);
      BLOOM.ready = true;
    } catch (e) { BLOOM.on = false; BLOOM.ready = false; }
  }
  function bloomResize() {
    if (!BLOOM.ready) return;
    try {
      var dpr = renderer.getPixelRatio();
      var w = Math.floor(W * dpr), h = Math.floor(H * dpr);
      BLOOM.sceneRT.setSize(w, h);
      BLOOM.a.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
      BLOOM.b.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    } catch (e) { BLOOM.on = false; }
  }
  function _blitPass(mat, target) {
    BLOOM.quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(BLOOM.quad, BLOOM.ortho);
  }
  function renderScene(scene, cam) {
    if (!BLOOM.on) { renderer.render(scene, cam); return; }
    if (!BLOOM.ready) { bloomInit(); if (!BLOOM.ready) { renderer.render(scene, cam); return; } }
    try {
      // 1) the scene, tone-mapped + sRGB, into a texture
      renderer.setRenderTarget(BLOOM.sceneRT);
      renderer.clear();
      renderer.render(scene, cam);
      // 2) bright-pass → half-res A
      BLOOM.mBright.uniforms.tDiffuse.value = BLOOM.sceneRT.texture;
      BLOOM.mBright.uniforms.threshold.value = BLOOM.threshold;
      _blitPass(BLOOM.mBright, BLOOM.a);
      // 3) separable blur, two widening iterations, ping-ponging A↔B
      var hw = BLOOM.a.width, hh = BLOOM.a.height;
      for (var i = 0; i < 2; i++) {
        var sp = BLOOM.spread * (1.0 + i);
        BLOOM.mBlur.uniforms.tDiffuse.value = BLOOM.a.texture;
        BLOOM.mBlur.uniforms.dir.value.set(sp / hw, 0);
        _blitPass(BLOOM.mBlur, BLOOM.b);
        BLOOM.mBlur.uniforms.tDiffuse.value = BLOOM.b.texture;
        BLOOM.mBlur.uniforms.dir.value.set(0, sp / hh);
        _blitPass(BLOOM.mBlur, BLOOM.a);
      }
      // 4) composite scene + bloom → screen
      BLOOM.mComp.uniforms.tScene.value = BLOOM.sceneRT.texture;
      BLOOM.mComp.uniforms.tBloom.value = BLOOM.a.texture;
      BLOOM.mComp.uniforms.strength.value = BLOOM.strength;
      _blitPass(BLOOM.mComp, null);
      renderer.setRenderTarget(null);
    } catch (e) {
      BLOOM.on = false;                       // one strike and we go plain — never break the game
      renderer.setRenderTarget(null);
      renderer.render(scene, cam);
    }
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
  /* ---------- the paint shop: canvas skins + machined materials ----------
     Every man-made surface earns a painted skin: panel lines, rivets,
     stencils, AO, grime. Textures are cached; materials are always fresh
     (aftermath tints mutate material.color — a shared material would rust
     the whole catalog at once). */
  var TEXCACHE = {};
  function shadeHex(c, f) {   // f>0 toward white, f<0 toward black — css string out
    var r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  }
  function shadeHexInt(c, f) {   // same ramp, integer out — for material tints
    var r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  }
  function canvasTex(key, w, h, draw) {
    if (TEXCACHE[key]) return TEXCACHE[key];
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var tx = new THREE.CanvasTexture(c);
    tx.encoding = THREE.sRGBEncoding;
    tx.anisotropy = 4;
    TEXCACHE[key] = tx;
    return tx;
  }
  function texGrain(x, w, h, n, alpha, tag) {
    // metal tooth — light + dark speckle, deterministic per tag
    var r = PG2.stream('TEXTURE', tag || 'grain');
    for (var i = 0; i < n; i++) {
      var lite = r() > 0.5;
      x.fillStyle = 'rgba(' + (lite ? '235,240,244' : '8,12,16') + ',' + (alpha * (0.3 + r() * 0.7)).toFixed(3) + ')';
      x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 1.4);
    }
  }
  function brushStrokes(x, w, h, n, alpha, tag) {
    // rolled-steel tooth: streaks along canvas-y (the part's long axis)
    var r = PG2.stream('TEXTURE', tag || 'brush');
    for (var i = 0; i < n; i++) {
      var bx = r() * w, lite = r() > 0.45;
      x.fillStyle = 'rgba(' + (lite ? '225,232,238' : '18,24,30') + ',' + (alpha * (0.25 + r() * 0.75)).toFixed(3) + ')';
      x.fillRect(bx, r() * h * 0.55, 1 + r(), h * (0.3 + r() * 0.7));
    }
  }
  function sideText(x, txt, cx, cy, px, color, alpha, rot) {
    // stencil lettering running along a cylinder's length (canvas-y)
    x.save();
    x.translate(cx, cy);
    x.rotate(rot != null ? rot : Math.PI / 2);
    x.font = '700 ' + px + 'px Menlo, monospace';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.globalAlpha = alpha != null ? alpha : 1;
    x.fillStyle = color;
    x.fillText(txt, 0, 0);
    x.restore();
  }
  function rivetDot(x, px, py, r2, dark, lite) {
    x.fillStyle = dark || 'rgba(10,14,18,0.75)';
    x.beginPath(); x.arc(px, py, r2, 0, Math.PI * 2); x.fill();
    x.fillStyle = lite || 'rgba(228,236,242,0.8)';
    x.beginPath(); x.arc(px - r2 * 0.25, py - r2 * 0.25, r2 * 0.45, 0, Math.PI * 2); x.fill();
  }
  function skinMat(tex, opts) {
    opts = opts || {};
    var m = new THREE.MeshPhongMaterial({
      map: tex, flatShading: !!opts.flat,
      shininess: opts.shin != null ? opts.shin : 26,
      specular: new THREE.Color(opts.spec != null ? opts.spec : 0x3d434a)
    });
    if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.ei || 1; }
    if (opts.transparent) { m.transparent = true; m.opacity = opts.opacity != null ? opts.opacity : 0.5; }
    return m;
  }
  function machMat(color, rough, metal) {
    // machined metal — brass gimbals, polished collars. Tuned to read under
    // plain hemi+key lighting (no env map on a phone budget).
    return new THREE.MeshStandardMaterial({
      color: color, flatShading: true,
      metalness: metal != null ? metal : 0.62,
      roughness: rough != null ? rough : 0.32
    });
  }
  /* PMREM environment — a real thing for the machined metals to reflect.
     Generated once per scene from a small equirect canvas (sky + a hot
     key glint), so brass gimbals and polished collars read like metal
     instead of matte plastic. Guarded: on failure, metals just stay matte. */
  var _pmrem = null;
  function envMap(top, horizon, ground, glintX, glintCol) {
    try {
      var c = document.createElement('canvas'); c.width = 256; c.height = 128;
      var x = c.getContext('2d');
      var g = x.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, top); g.addColorStop(0.5, horizon); g.addColorStop(1, ground);
      x.fillStyle = g; x.fillRect(0, 0, 256, 128);
      var gl = x.createRadialGradient(glintX, 40, 4, glintX, 40, 60);   // the key light, to catch on a curve
      gl.addColorStop(0, glintCol); gl.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gl; x.fillRect(0, 0, 256, 128);
      var tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      if (!_pmrem) { _pmrem = new THREE.PMREMGenerator(renderer); _pmrem.compileEquirectangularShader(); }
      var rt = _pmrem.fromEquirectangular(tex);
      tex.dispose();
      return rt.texture;
    } catch (e) { return null; }
  }
  function grainTint(hex, key, shin) {
    // subtle speckle map multiplied by a tint — for domes and small castings.
    // flat-shaded: facets are the house style, and they break up highlights.
    var g = canvasTex(key || 'graintint', 128, 128, function (x, w, h) {
      x.fillStyle = '#efefef'; x.fillRect(0, 0, w, h);
      texGrain(x, w, h, 300, 0.09, key || 'graintint');
    });
    var m = new THREE.MeshPhongMaterial({ color: hex, map: g, flatShading: true,
      shininess: shin != null ? shin : 24, specular: new THREE.Color(0x3d434a) });
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

  var SHELL_STENCIL = { compact: 'RD-045', standard: 'RD-047', heavy: 'RD-049', thinwall: 'RD-047T', segmented: 'RD-051F' };
  function casingSkin(id, paintHex) {
    // the rolled-steel skin: panel seams, rivets, stencils, hazard band, AO.
    // canvas x wraps the circumference (front of the shell at x=w/2 via
    // offset 0.5; the ground-contact AO lands at x=w/4), canvas y runs
    // tail (y=0) → nose (y=h).
    var key = 'cas:' + id + ':' + paintHex + ':' + S.seed;
    return canvasTex(key, 1024, 512, function (x, w, h) {
      var thin = id === 'thinwall';
      var g0 = x.createLinearGradient(0, 0, 0, h);
      g0.addColorStop(0, shadeHex(paintHex, -0.3));
      g0.addColorStop(0.4, shadeHex(paintHex, -0.06));
      g0.addColorStop(0.86, shadeHex(paintHex, -0.12));
      g0.addColorStop(1, shadeHex(paintHex, -0.22));
      x.fillStyle = g0; x.fillRect(0, 0, w, h);
      brushStrokes(x, w, h, thin ? 150 : 280, thin ? 0.07 : 0.11, key + ':b');
      texGrain(x, w, h, 900, 0.05, key + ':g');
      var rr = PG2.stream('TEXTURE', key + ':wear');
      function seam(yf, heavyRow) {
        var sy = yf * h;
        x.fillStyle = 'rgba(14,19,24,0.66)'; x.fillRect(0, sy - 1.5, w, 3);
        x.fillStyle = 'rgba(232,240,246,0.22)'; x.fillRect(0, sy + 2, w, 1);
        for (var rx = 26; rx < w; rx += 60) {
          rivetDot(x, rx + (heavyRow ? 0 : 8), sy - 9, 4.2);
          if (heavyRow) rivetDot(x, rx + 30, sy + 10, 4.2);
        }
        // chips of bare steel along the seam — the crew is not gentle
        for (var ci = 0; ci < 8; ci++) {
          x.fillStyle = 'rgba(214,224,232,' + (0.2 + rr() * 0.3).toFixed(2) + ')';
          x.fillRect(rr() * w, sy - 2 + rr() * 4, 3 + rr() * 9, 1.6);
        }
      }
      if (id === 'segmented') {
        // machine-scored frag grid — painted score lines, dark and exact
        x.fillStyle = 'rgba(16,22,27,0.72)';
        for (var gy = 0.1; gy < 0.87; gy += 0.096) x.fillRect(0, gy * h, w, 2.6);
        for (var gx = 0; gx < w; gx += 64) x.fillRect(gx, 0.1 * h, 2.6, 0.77 * h);
        x.fillStyle = 'rgba(235,242,247,0.14)';
        for (var gy2 = 0.1; gy2 < 0.87; gy2 += 0.096) x.fillRect(0, gy2 * h + 2.6, w, 1);
      } else if (thin) {
        // light-gauge: no butt seams — spot-weld rows and oil-canning shimmer
        var rs = PG2.stream('TEXTURE', key + ':spot');
        [0.2, 0.5, 0.8].forEach(function (yf) {
          for (var sx = 18; sx < w; sx += 46) rivetDot(x, sx, yf * h + (rs() - 0.5) * 3, 2.6, 'rgba(30,38,44,0.55)', 'rgba(235,242,247,0.5)');
        });
        for (var oc = 0; oc < 9; oc++) {
          var ox2 = rs() * w, oy2 = (0.1 + rs() * 0.75) * h;
          var og = x.createRadialGradient(ox2, oy2, 4, ox2, oy2, 60 + rs() * 90);
          og.addColorStop(0, 'rgba(' + (rs() > 0.5 ? '240,246,250,0.10' : '10,16,22,0.10') + ')');
          og.addColorStop(1, 'rgba(0,0,0,0)');
          x.fillStyle = og; x.fillRect(0, 0, w, h);
        }
      } else {
        var seams = id === 'compact' ? [0.3, 0.62] : id === 'heavy' ? [0.14, 0.4, 0.62, 0.8] : [0.16, 0.56, 0.78];
        seams.forEach(function (yf) { seam(yf, id === 'heavy'); });
        // one longitudinal weld line, kept on the shell's blind side
        x.fillStyle = 'rgba(18,24,30,0.5)';
        for (var wy = 0; wy < h * 0.85; wy += 14) x.fillRect(56, wy, 3, 9);
      }
      // hazard band at the nose end — red oxide with cream pinstripes
      var b0 = 0.885 * h, b1 = 0.985 * h;
      x.fillStyle = shadeHex(COL.nose, -0.06); x.fillRect(0, b0, w, b1 - b0);
      x.fillStyle = 'rgba(12,16,20,0.4)'; x.fillRect(0, b0 - 2, w, 2.4);
      x.fillStyle = 'rgba(240,232,208,0.85)';
      x.fillRect(0, b0 + 5, w, 2.2); x.fillRect(0, b1 - 7, w, 2.2);
      if (id === 'heavy') { x.fillStyle = shadeHex(COL.nose, -0.06); x.fillRect(0, 0.015 * h, w, 0.03 * h); }
      for (var bw = 0; bw < 14; bw++) {   // chipped band edge — painted wear
        x.fillStyle = 'rgba(' + (bw % 2 ? '210,220,228' : '150,160,168') + ',' + (0.25 + rr() * 0.3).toFixed(2) + ')';
        x.fillRect(rr() * w, b0 + rr() * (b1 - b0), 2 + rr() * 7, 1.6);
      }
      // stencil block — designation, lot, and the Authority's fine print
      var ink = 'rgba(26,28,30,0.88)', inkSoft = 'rgba(32,34,36,0.6)';
      sideText(x, SHELL_STENCIL[id] || 'RD-047', w / 2 + 14, h * 0.33, 60, ink);
      sideText(x, PG2.lotNumber(S.seed, id), w / 2 - 44, h * 0.33, 24, inkSoft);
      sideText(x, 'REDSKY INC · AUTHORITY PATTERN', w / 2 - 74, h * 0.33, 13, 'rgba(36,38,40,0.5)');
      sideText(x, 'LIFT HERE', w / 2 + 40, h * 0.76, 15, inkSoft);
      // inspection stamp — a square, a diagonal, a number. Paperwork, painted.
      x.strokeStyle = inkSoft; x.lineWidth = 2.4;
      x.strokeRect(w / 2 - 26, h * 0.62, 52, 52);
      x.beginPath(); x.moveTo(w / 2 - 26, h * 0.62 + 52); x.lineTo(w / 2 + 26, h * 0.62); x.stroke();
      sideText(x, '7', w / 2, h * 0.62 + 26, 26, inkSoft);
      // ground-shadow AO around the belly + a sheen along the spine
      var ao = x.createLinearGradient(0, 0, w, 0);
      ao.addColorStop(0, 'rgba(8,12,16,0.36)');
      ao.addColorStop(0.25, 'rgba(8,12,16,0.52)');
      ao.addColorStop(0.5, 'rgba(8,12,16,0.08)');
      ao.addColorStop(0.75, 'rgba(8,12,16,0)');
      ao.addColorStop(1, 'rgba(8,12,16,0.36)');
      x.fillStyle = ao; x.fillRect(0, 0, w, h);
      var sheen = x.createLinearGradient(w * 0.55, 0, w, 0);
      sheen.addColorStop(0, 'rgba(255,243,224,0)');
      sheen.addColorStop(0.72, 'rgba(255,243,224,0.11)');
      sheen.addColorStop(1, 'rgba(255,243,224,0)');
      x.fillStyle = sheen; x.fillRect(0, 0, w, h);
      // oil smudges under the belly, dust at the tail
      for (var os = 0; os < 5; os++) {
        var sx2 = w * (0.13 + rr() * 0.24), sy2 = rr() * h * 0.8;
        var sg2 = x.createRadialGradient(sx2, sy2, 2, sx2, sy2, 26 + rr() * 40);
        sg2.addColorStop(0, 'rgba(16,14,10,0.20)'); sg2.addColorStop(1, 'rgba(16,14,10,0)');
        x.fillStyle = sg2; x.fillRect(0, 0, w, h);
      }
      var tg = x.createLinearGradient(0, 0, 0, h * 0.09);
      tg.addColorStop(0, 'rgba(10,14,18,0.34)'); tg.addColorStop(1, 'rgba(10,14,18,0)');
      x.fillStyle = tg; x.fillRect(0, 0, w, h * 0.09);
    });
  }
  function buildCasing(id) {
    var d = casingDims(id);
    var g = new THREE.Group();
    var skin = id === 'thinwall' ? 0xa6b5c2 : bodyColor();
    var skinTex = casingSkin(id, skin);
    skinTex.wrapS = THREE.RepeatWrapping;
    skinTex.offset.x = 0.5;
    var body = new THREE.Mesh(new THREE.CylinderGeometry(d.r, d.r, d.L, 24, 1, true), skinMat(skinTex, { shin: 30 }));
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    g.add(body);
    if (id === 'segmented') {
      // two machined score rings keep the grid honest in silhouette
      [-1, 1].forEach(function (s2) {
        var score = new THREE.Mesh(new THREE.TorusGeometry(d.r + 0.003, 0.007, 6, 28), mat(0x2c343c, { shin: 8 }));
        score.rotation.y = Math.PI / 2;
        score.position.x = s2 * d.L * 0.17;
        g.add(score);
      });
    }
    if (id === 'thinwall') {
      for (var wi = -1; wi <= 1; wi++) {   // stiffening ribs — it needs them
        var rib = new THREE.Mesh(new THREE.TorusGeometry(d.r + 0.008, 0.011, 6, 24), machMat(0x9fb1bf, 0.35, 0.55));
        rib.rotation.y = Math.PI / 2;
        rib.position.x = wi * d.L * 0.3;
        g.add(rib);
      }
    }
    [-1, 1].forEach(function (s) {
      var nose2 = s > 0;
      var dome = new THREE.Mesh(new THREE.SphereGeometry(d.r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        grainTint(id === 'thinwall' ? 0x8798a6 : shadeHexInt(skin, nose2 ? -0.1 : -0.16), 'cap:' + id + ':' + s, 16));
      dome.rotation.z = s * -Math.PI / 2;
      dome.position.x = s * d.L / 2;
      dome.castShadow = true;
      g.add(dome);
      // machined end collar — the chamfer that says someone owned a lathe
      var col2 = new THREE.Mesh(new THREE.CylinderGeometry(d.r + 0.006, d.r + 0.006, 0.045, 24, 1, true),
        machMat(nose2 ? 0x5a636d : 0x4c565f, 0.34, 0.6));
      col2.rotation.z = Math.PI / 2;
      col2.position.x = s * (d.L / 2 - 0.028);
      g.add(col2);
    });
    // slot rims + dark bores — machined collars around every payload bay
    slotXs(id).forEach(function (x, i) {
      var rim = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.022, 8, 20), machMat(0x525c66, 0.42, 0.55));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, d.r - 0.01, 0);
      rim.userData.slotRim = i;
      g.add(rim);
      var bore = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.16, 14), mat(0x141b22, { shin: 4 }));
      bore.position.set(x, d.r - 0.09, 0);
      g.add(bore);
    });
    // detonator well boss (top, near nose)
    var wx = wellX(id);
    var boss = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.12, 12), machMat(0x5c6670, 0.34, 0.6));
    boss.position.set(wx, d.r + 0.02, 0);
    g.add(boss);
    var bore2 = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.1, 10), mat(0x11161b, { shin: 2 }));
    bore2.position.set(wx, d.r + 0.04, 0);
    g.add(bore2);
    // access panel recess (front +Z, center)
    var frame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.05), mat(COL.steelDark));
    frame.position.set(0, 0.02, d.r - 0.05);
    g.add(frame);
    var recess = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.06), mat(0x1d252d, { shin: 4 }));
    recess.position.set(0, 0.02, d.r - 0.04);
    g.add(recess);
    // door (hinged at top) — pivot group, wearing a painted service label
    var doorPivot = new THREE.Group();
    doorPivot.position.set(0, 0.19, d.r + 0.015);
    var doorTex = canvasTex('door:' + skin, 256, 174, function (x, w2, h2) {
      x.fillStyle = shadeHex(skin, -0.02); x.fillRect(0, 0, w2, h2);
      texGrain(x, w2, h2, 260, 0.08, 'door:' + skin);
      x.strokeStyle = 'rgba(16,22,28,0.5)'; x.lineWidth = 3;
      x.strokeRect(9, 9, w2 - 18, h2 - 18);
      // louver slots
      x.fillStyle = 'rgba(14,20,26,0.62)';
      for (var lv = 0; lv < 4; lv++) x.fillRect(w2 * 0.12, h2 * 0.24 + lv * h2 * 0.13, w2 * 0.3, 4);
      x.fillStyle = 'rgba(235,242,247,0.16)';
      for (var lv2 = 0; lv2 < 4; lv2++) x.fillRect(w2 * 0.12, h2 * 0.24 + lv2 * h2 * 0.13 + 4, w2 * 0.3, 1.4);
      x.font = '700 17px Menlo, monospace'; x.textAlign = 'left';
      x.fillStyle = 'rgba(28,30,32,0.8)';
      x.fillText('SERVICE', w2 * 0.5, h2 * 0.36);
      x.fillText('BUS', w2 * 0.5, h2 * 0.52);
      x.font = '700 11px Menlo, monospace';
      x.fillStyle = 'rgba(32,34,36,0.55)';
      x.fillText('NO FIELD ENTRY', w2 * 0.5, h2 * 0.7);
      var aog = x.createLinearGradient(0, h2 * 0.6, 0, h2);
      aog.addColorStop(0, 'rgba(10,14,18,0)'); aog.addColorStop(1, 'rgba(10,14,18,0.24)');
      x.fillStyle = aog; x.fillRect(0, 0, w2, h2);
    });
    var door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.022), skinMat(doorTex, { shin: 24 }));
    door.position.y = -0.17;
    doorPivot.add(door);
    [-0.21, 0.21].forEach(function (dx) {
      [-0.31, -0.03].forEach(function (dy) {
        var screw = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 8), machMat(COL.brass, 0.3, 0.8));
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
    var bodyCol = comp === 'densepack' ? 0x454b51 : comp === 'ballast' ? 0x8d949a : 0xa8b1b8;
    // drum skin: spun-metal tooth, crimp shadows, painted AO at the foot
    var drumTex = canvasTex('can:' + comp, 256, 256, function (x, w, h) {
      var g1 = x.createLinearGradient(0, 0, 0, h);
      g1.addColorStop(0, shadeHex(bodyCol, 0.05));
      g1.addColorStop(0.55, shadeHex(bodyCol, -0.04));
      g1.addColorStop(1, shadeHex(bodyCol, -0.26));
      x.fillStyle = g1; x.fillRect(0, 0, w, h);
      // spin lines around the drum
      var r0 = PG2.stream('TEXTURE', 'can:' + comp);
      for (var i = 0; i < 46; i++) {
        var ly = r0() * h, lite = r0() > 0.5;
        x.fillStyle = 'rgba(' + (lite ? '232,238,243' : '16,22,27') + ',' + (0.05 + r0() * 0.09).toFixed(3) + ')';
        x.fillRect(0, ly, w, 1);
      }
      texGrain(x, w, h, 240, 0.06, 'can:' + comp + ':g');
      // crimp shadows top + bottom
      x.fillStyle = 'rgba(12,17,22,0.4)';
      x.fillRect(0, 0, w, 4); x.fillRect(0, h - 5, w, 5);
      // faint vertical side-seam
      x.fillStyle = 'rgba(14,19,24,0.35)'; x.fillRect(w * 0.06, 0, 2, h);
    });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(dm.r, dm.r, dm.h, 18), skinMat(drumTex, { shin: 34 }));
    body.castShadow = true;
    g.add(body);
    // embossed ribs — pressed into the drum, same skin tone
    [-0.26, -0.4].forEach(function (yf) {
      var rib = new THREE.Mesh(new THREE.TorusGeometry(dm.r + 0.003, 0.005, 5, 18), mat(shadeHexInt(bodyCol, -0.05), { shin: 30 }));
      rib.rotation.x = Math.PI / 2;
      rib.position.y = dm.h * yf;
      g.add(rib);
    });
    // the contract band — amber / blue / violet stays exactly as certified
    var band = new THREE.Mesh(new THREE.CylinderGeometry(dm.r + 0.004, dm.r + 0.004, dm.band, 18),
      glow > 0 ? mat(hue, { emissive: hue, ei: glow }) : mat(hue));
    band.position.y = 0.02;
    g.add(band);
    var top = new THREE.Mesh(new THREE.SphereGeometry(dm.r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      grainTint(comp === 'ballast' ? bodyCol : shadeHexInt(hue, -0.04), 'canlid:' + comp, 30));
    top.position.y = dm.topY;
    g.add(top);
    // crimped lid ring + carry bail — someone hauls these by hand all day
    var crimp = new THREE.Mesh(new THREE.TorusGeometry(dm.r * 0.995, 0.008, 5, 18), machMat(0x77818a, 0.4, 0.55));
    crimp.rotation.x = Math.PI / 2;
    crimp.position.y = dm.topY + 0.004;
    g.add(crimp);
    if (comp !== 'trimcell') {
      var bail = new THREE.Mesh(new THREE.TorusGeometry(dm.r * 0.55, 0.008, 5, 12, Math.PI), machMat(0x9aa4ad, 0.35, 0.6));
      bail.position.y = dm.topY + dm.r * 0.34;
      bail.rotation.y = 0.6;
      g.add(bail);
    }
    if (comp === 'densepack') {   // pressed fill: hex bolts around the crown
      for (var bi = 0; bi < 6; bi++) {
        var bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 6), machMat(COL.brass, 0.32, 0.8));
        var ba = bi * Math.PI / 3;
        bolt.position.set(Math.cos(ba) * dm.r * 0.7, dm.topY + 0.02, Math.sin(ba) * dm.r * 0.7);
        g.add(bolt);
      }
    }
    if (comp !== 'ballast') {
      var valve = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), machMat(COL.brass, 0.28, 0.85));
      valve.position.y = dm.valveY;
      g.add(valve);
      var valveCap = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.012, 8), machMat(0xd8dde2, 0.25, 0.85));
      valveCap.position.y = dm.valveY + 0.028;
      g.add(valveCap);
    }
    // stockroom stencil: designation + seeded lot number, painted on the can
    var def = PG2.COMPOUNDS[comp];
    if (def && def.stencil) {
      var sc2 = dm.r / 0.115;
      var st = textPlane(def.stencil, 0.16 * sc2, 0.062 * sc2, { color: '#1e1a15', px: 76 });
      st.position.set(0, -0.035 * sc2, dm.r + 0.003);
      g.add(st);
      var lot = textPlane(PG2.lotNumber(S.seed, comp), 0.17 * sc2, 0.045 * sc2, { color: '#332d25', px: 46 });
      lot.position.set(0, -0.095 * sc2, dm.r + 0.003);
      g.add(lot);
    }
    return g;
  }
  function knurlTex(key, base) {
    // machinist's knurling — fine vertical ticks around a collar
    return canvasTex(key || 'knurl', 128, 24, function (x, w, h) {
      x.fillStyle = shadeHex(base || 0x8a939c, -0.08); x.fillRect(0, 0, w, h);
      for (var i = 0; i < w; i += 4) {
        x.fillStyle = 'rgba(16,22,27,0.6)'; x.fillRect(i, 2, 1.6, h - 4);
        x.fillStyle = 'rgba(235,241,246,0.4)'; x.fillRect(i + 2, 2, 1, h - 4);
      }
    });
  }
  function noseStandoff() {
    // fuzing hardware clears the nose dome of whatever shell it rides —
    // purely visual: the snap node and part origin never move
    var r2 = S.assembly && S.assembly.shell ? casingDims(S.assembly.shell).r : 0.42;
    return Math.max(0, (r2 - 0.2) * 1.3);
  }
  function buildTimer() {
    // T-5 CLOCKWORK: machined cone, graduated amber bezel, brass wind key —
    // shifted proud of the nose dome so the product actually shows
    var g = new THREE.Group();
    var off = noseStandoff();
    var cone = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.36, 16), grainTint(0x424b55, 'timerbody', 30));
    cone.rotation.z = -Math.PI / 2;
    cone.position.x = 0.31 + off;
    cone.castShadow = true;
    g.add(cone);
    var bezTex = canvasTex('timerbezel', 256, 32, function (x, w, h) {
      x.fillStyle = shadeHex(COL.amber, -0.05); x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(38,28,12,0.85)';
      for (var i = 0; i < 24; i++) x.fillRect(i * (w / 24) + 2, h * 0.16, 2, i % 6 === 0 ? h * 0.68 : h * 0.36);
      x.fillStyle = 'rgba(150,44,32,0.95)';
      x.beginPath(); x.moveTo(2, h * 0.28); x.lineTo(10, h * 0.5); x.lineTo(2, h * 0.72); x.closePath(); x.fill();
      var sh = x.createLinearGradient(0, 0, 0, h);
      sh.addColorStop(0, 'rgba(255,246,230,0.18)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(10,8,4,0.3)');
      x.fillStyle = sh; x.fillRect(0, 0, w, h);
    });
    // mounting stem out of the nose dome
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, off + 0.14, 12), grainTint(0x39424c, 'timerstem', 20));
    stem.rotation.z = Math.PI / 2;
    stem.position.x = (off + 0.14) / 2 - 0.02;
    g.add(stem);
    var bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 20),
      skinMat(bezTex, { emissive: COL.amber, ei: 0.16, shin: 42 }));
    bezel.rotation.z = Math.PI / 2;
    bezel.position.x = 0.1 + off;
    g.add(bezel);
    var collar = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.05, 20), skinMat(knurlTex('knurl:steel', 0x77818a), { shin: 46 }));
    collar.rotation.z = Math.PI / 2;
    collar.position.x = 0.155 + off;
    g.add(collar);
    // brass wind key at the tip — the whole mechanism's one honest joke
    var keyStem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.07, 8), machMat(COL.brass, 0.3, 0.8));
    keyStem.rotation.z = Math.PI / 2;
    keyStem.position.x = 0.52 + off;
    g.add(keyStem);
    var keyBow = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.011, 6, 12), machMat(COL.brass, 0.3, 0.8));
    keyBow.rotation.y = Math.PI / 2;
    keyBow.position.x = 0.565 + off;
    g.add(keyBow);
    // set-knob on the shoulder, knurled
    var knob = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.028, 12), skinMat(knurlTex('knurl:steel', 0x77818a), { shin: 50 }));
    knob.rotation.x = Math.PI / 2;
    knob.position.set(0.24 + off, 0.11, 0.13);
    knob.rotation.z = 0.5;
    g.add(knob);
    var tag = textPlane('T-5 · CAL 7A', 0.16, 0.05, { color: '#241f16', bg: '#d9c9a0', px: 40 });
    tag.position.set(0.3 + off, -0.15, 0.1);
    tag.rotation.y = 0.4; tag.rotation.z = -0.5;
    g.add(tag);
    return g;
  }
  function batteryLabelTex(key, base, big, sub) {
    return canvasTex(key, 256, 220, function (x, w, h) {
      x.fillStyle = shadeHex(base, -0.06); x.fillRect(0, 0, w, h);
      texGrain(x, w, h, 200, 0.07, key);
      // moulding lines
      x.fillStyle = 'rgba(10,14,12,0.4)';
      x.fillRect(0, h * 0.1, w, 2); x.fillRect(0, h * 0.86, w, 2);
      // cream label panel, slightly worn
      x.fillStyle = '#ded2ae';
      x.fillRect(w * 0.13, h * 0.24, w * 0.74, h * 0.46);
      x.fillStyle = 'rgba(30,26,18,0.9)';
      x.font = '700 44px Menlo, monospace'; x.textAlign = 'center';
      x.fillText(big, w * 0.5, h * 0.47);
      x.font = '700 15px Menlo, monospace';
      x.fillStyle = 'rgba(48,42,30,0.85)';
      x.fillText(sub, w * 0.5, h * 0.61);
      x.strokeStyle = 'rgba(48,42,30,0.7)'; x.lineWidth = 2;
      x.strokeRect(w * 0.13 + 4, h * 0.24 + 4, w * 0.74 - 8, h * 0.46 - 8);
      // terminal marks over the posts
      x.font = '700 26px Menlo, monospace';
      x.fillStyle = '#d8dde2'; x.fillText('−', w * 0.3, h * 0.14);
      x.fillStyle = '#e0b52e'; x.fillText('+', w * 0.7, h * 0.14);
      // worn corner + AO foot
      var r0 = PG2.stream('TEXTURE', key + ':wear');
      for (var i = 0; i < 10; i++) {
        x.fillStyle = 'rgba(222,210,174,' + (0.12 + r0() * 0.2).toFixed(2) + ')';
        x.fillRect(r0() * w, h * (0.72 + r0() * 0.2), 2 + r0() * 6, 1.6);
      }
      var ao = x.createLinearGradient(0, h * 0.7, 0, h);
      ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(4,8,6,0.4)');
      x.fillStyle = ao; x.fillRect(0, 0, w, h);
    });
  }
  function buildBattery() {
    var g = new THREE.Group();
    var side = batteryLabelTex('batt:side', COL.batt, 'DC-9', '12V · FIRING TRAIN');
    var plain = grainTint(shadeHexInt(COL.batt, -0.1), 'batt:plain', 16);
    var sideM = skinMat(side, { shin: 30 });
    var box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.26),
      [plain, plain.clone(), grainTint(shadeHexInt(COL.batt, -0.16), 'batt:top', 16), plain.clone(), sideM, sideM.clone()]);
    box.castShadow = true;
    g.add(box);
    // terminal block + posts
    var block = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.2), mat(0x23303a, { shin: 8 }));
    block.position.set(-0.08, 0.145, 0);
    g.add(block);
    [-0.06, 0.06].forEach(function (dz, i) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 8), machMat(i ? COL.brass : 0xb0b6bb, 0.3, 0.8));
      post.position.set(-0.08, 0.18, dz);
      g.add(post);
      var nut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 6), machMat(i ? COL.brass : 0x9aa1a7, 0.35, 0.7));
      nut.position.set(-0.08, 0.165, dz);
      g.add(nut);
    });
    return g;
  }
  function buildCap() {
    var g = new THREE.Group();
    var dome = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      grainTint(shadeHexInt(COL.nose, -0.4), 'cap:well', 10));
    dome.castShadow = true;
    g.add(dome);
    // knurled lip — this cap gets torqued by hand, daily
    var lip = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.034, 16), skinMat(knurlTex('knurl:steel', 0x77818a), { shin: 44 }));
    lip.position.y = -0.004;
    g.add(lip);
    var detent = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), machMat(COL.brass, 0.3, 0.8));
    detent.position.set(0.1, 0.062, 0);
    g.add(detent);
    return g;
  }
  function buildFins() {
    var g = new THREE.Group();
    var shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(0.34, -0.04); shape.lineTo(0.34, -0.26); shape.lineTo(0.06, -0.18); shape.lineTo(0, -0.16); shape.closePath();
    var geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
    for (var i = 0; i < 4; i++) {
      var f = new THREE.Mesh(geo, grainTint(COL.fin, 'fin', 30));
      f.castShadow = true;
      var hold = new THREE.Group();
      f.rotation.y = Math.PI / 2;
      f.position.z = -0.01;
      hold.add(f);
      // painted tracking stripe on the trailing edge — morale, in oxide red
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.21, 0.03), mat(shadeHexInt(COL.nose, -0.06), { shin: 14 }));
      stripe.position.set(0, -0.15, -0.335);
      hold.add(stripe);
      hold.rotation.x = i * Math.PI / 2 + Math.PI / 4;
      g.add(hold);
    }
    return g;
  }
  function buildArmPanel() {
    var g = new THREE.Group();
    // painted control face: engraved border, hazard chevrons round the lever
    // slot, stencilled legend, LED bezel — one crafted little instrument
    var faceTex = canvasTex('armface', 256, 200, function (x, w, h) {
      x.fillStyle = shadeHex(COL.panel, -0.05); x.fillRect(0, 0, w, h);
      texGrain(x, w, h, 260, 0.07, 'armface');
      x.strokeStyle = 'rgba(226,234,240,0.28)'; x.lineWidth = 2;
      x.strokeRect(7, 7, w - 14, h - 14);
      // lever slot plate with chevron surround (lever at world x=-0.045 → u≈0.33)
      var px0 = w * 0.2, pw = w * 0.27, py0 = h * 0.18, ph = h * 0.66;
      x.save();
      x.beginPath(); x.rect(px0, py0, pw, ph); x.clip();
      for (var cv = -6; cv < 14; cv++) {
        x.fillStyle = cv % 2 ? '#c8a23c' : '#20262c';
        x.beginPath();
        x.moveTo(px0 + cv * 14, py0 + ph); x.lineTo(px0 + cv * 14 + 14, py0 + ph);
        x.lineTo(px0 + cv * 14 + 14 + ph, py0); x.lineTo(px0 + cv * 14 + ph, py0);
        x.closePath(); x.fill();
      }
      x.restore();
      x.strokeStyle = 'rgba(10,14,18,0.8)'; x.lineWidth = 3;
      x.strokeRect(px0, py0, pw, ph);
      x.fillStyle = 'rgba(10,14,18,0.85)';
      x.fillRect(px0 + pw * 0.5 - 4, py0 + 8, 8, ph - 16);
      // legend
      x.font = '700 24px Menlo, monospace'; x.textAlign = 'center';
      x.fillStyle = '#f0d9a8'; x.fillText('ARM', w * 0.79, h * 0.68);
      x.font = '700 11px Menlo, monospace';
      x.fillStyle = 'rgba(240,217,168,0.55)'; x.fillText('FIRE CIRCUIT', w * 0.79, h * 0.8);
      x.fillText('SAFE ▲', w * 0.79, h * 0.9);
      // LED bezel (led mesh at world 0.075,0.05 → u≈0.79, v≈0.75)
      x.strokeStyle = 'rgba(220,228,234,0.6)'; x.lineWidth = 3;
      x.beginPath(); x.arc(w * 0.79, h * 0.25, 15, 0, Math.PI * 2); x.stroke();
      // corner screws
      [[16, 16], [w - 16, 16], [16, h - 16], [w - 16, h - 16]].forEach(function (p) { rivetDot(x, p[0], p[1], 5); });
      var ao = x.createLinearGradient(0, h * 0.7, 0, h);
      ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(6,10,14,0.3)');
      x.fillStyle = ao; x.fillRect(0, 0, w, h);
    });
    var plainP = grainTint(shadeHexInt(COL.panel, -0.12), 'armside', 18);
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.07),
      [plainP, plainP.clone(), plainP.clone(), plainP.clone(), skinMat(faceTex, { shin: 30 }), plainP.clone()]);
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
    // switch lever — machined, with a red grip ball
    var leverPivot = new THREE.Group();
    leverPivot.position.set(-0.045, -0.02, 0.038);
    var lever = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.1, 0.024), machMat(0xd8dde2, 0.28, 0.8));
    lever.position.y = -0.04;
    leverPivot.add(lever);
    var grip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), grainTint(shadeHexInt(COL.nose, -0.1), 'armgrip', 30));
    grip.position.y = -0.088;
    leverPivot.add(grip);
    leverPivot.rotation.x = -0.5;
    g.add(leverPivot);
    g.userData.leverPivot = leverPivot;
    // LED
    var led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), mat(0x431410, { emissive: 0x000000 }));
    led.position.set(0.075, 0.05, 0.04);
    g.add(led);
    g.userData.led = led;
    return g;
  }
  function buildDetonator() {
    var g = new THREE.Group();
    var detTex = canvasTex('dettube', 128, 128, function (x, w, h) {
      var g1 = x.createLinearGradient(0, 0, w, 0);
      g1.addColorStop(0, '#9ba1a8'); g1.addColorStop(0.28, '#e8ecf0');
      g1.addColorStop(0.55, '#c2c8ce'); g1.addColorStop(1, '#8d939a');
      x.fillStyle = g1; x.fillRect(0, 0, w, h);
      // crimp rings + copper band
      x.fillStyle = 'rgba(20,26,31,0.5)';
      x.fillRect(0, h * 0.2, w, 2); x.fillRect(0, h * 0.26, w, 2);
      x.fillStyle = 'rgba(168,102,58,0.9)'; x.fillRect(0, h * 0.55, w, h * 0.08);
      x.font = '700 10px Menlo, monospace'; x.textAlign = 'center';
      x.fillStyle = 'rgba(40,44,48,0.7)';
      x.save(); x.translate(w * 0.5, h * 0.78); x.rotate(Math.PI / 2); x.fillText('No.8', 0, 0); x.restore();
    });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 12), skinMat(detTex, { shin: 78, spec: 0x666c73 }));
    body.castShadow = true;
    g.add(body);
    var tip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.05, 12), grainTint(shadeHexInt(COL.nose, -0.08), 'dettip', 26));
    tip.position.y = -0.15;
    g.add(tip);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 14), machMat(COL.brass, 0.28, 0.85));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    g.add(ring);
    return g;
  }
  function buildBatteryL() {
    var g = new THREE.Group();
    var side = batteryLabelTex('battL:side', 0x33503e, 'DC-12 L', 'HEAVY · AUX TERMINAL');
    var plain = grainTint(shadeHexInt(0x33503e, -0.1), 'battL:plain', 16);
    var sideM = skinMat(side, { shin: 30 });
    var box = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.3),
      [plain, plain.clone(), grainTint(shadeHexInt(0x33503e, -0.16), 'battL:top', 16), plain.clone(), sideM, sideM.clone()]);
    box.castShadow = true;
    g.add(box);
    var block = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.28), mat(0x1e2a34, { shin: 8 }));
    block.position.set(-0.1, 0.165, 0);
    g.add(block);
    [-0.1, 0, 0.1].forEach(function (dz, i) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 8),
        machMat(i === 2 ? 0x8a929a : i ? COL.brass : 0xb0b6bb, 0.3, 0.8));
      post.position.set(-0.1, 0.2, dz);
      g.add(post);
      var nut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 6), machMat(0x9aa1a7, 0.35, 0.7));
      nut.position.set(-0.1, 0.187, dz);
      g.add(nut);
    });
    // lashing strap with a buckle — it ships heavy
    var strap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.05), mat(0x22303c, { shin: 6 }));
    strap.position.y = 0.12;
    g.add(strap);
    var buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.06), machMat(0x8a929a, 0.4, 0.6));
    buckle.position.set(0.12, 0.12, 0);
    g.add(buckle);
    return g;
  }
  function buildHarness() {
    var g = new THREE.Group();
    // woven shielding — a fine crosshatch skin over the coil
    var weave = canvasTex('weave', 64, 64, function (x, w, h) {
      x.fillStyle = '#262c33'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(122,134,146,0.6)'; x.lineWidth = 2;
      for (var i = -h; i < w + h; i += 7) {
        x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke();
        x.beginPath(); x.moveTo(i + h, 0); x.lineTo(i, h); x.stroke();
      }
      x.fillStyle = 'rgba(8,12,16,0.35)';
      for (var j = 0; j < h; j += 7) x.fillRect(0, j, w, 2);
    });
    weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
    weave.repeat.set(10, 2);
    var coil = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.032, 8, 24), skinMat(weave, { shin: 38, flat: false }));
    coil.rotation.x = Math.PI / 2;
    g.add(coil);
    var braid = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.036, 8, 22, Math.PI * 1.2), skinMat(weave, { shin: 52, flat: false }));
    braid.rotation.x = Math.PI / 2;
    g.add(braid);
    [-0.09, 0.09].forEach(function (dx) {
      var clipM = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.07), machMat(COL.brass, 0.32, 0.8));
      clipM.position.set(dx, 0.01, 0);
      g.add(clipM);
      var screw = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.036, 6), machMat(0xd8dde2, 0.3, 0.8));
      screw.position.set(dx, 0.025, 0);
      g.add(screw);
    });
    var tag = textPlane('SHD-3', 0.08, 0.034, { color: '#241f16', bg: '#d9c9a0', px: 44 });
    tag.position.set(0, 0.012, 0.15);
    tag.rotation.x = -0.5;
    g.add(tag);
    return g;
  }
  function buildDelayRelay() {
    var g = new THREE.Group();
    // bakelite block: warm phenolic swirl, cream stencil, brass screw posts
    var bakTex = canvasTex('relayface', 200, 144, function (x, w, h) {
      x.fillStyle = '#43301f'; x.fillRect(0, 0, w, h);
      var r0 = PG2.stream('TEXTURE', 'bakelite');
      for (var i = 0; i < 26; i++) {   // phenolic swirl
        x.strokeStyle = 'rgba(' + (r0() > 0.5 ? '96,68,42' : '52,36,22') + ',' + (0.14 + r0() * 0.2).toFixed(2) + ')';
        x.lineWidth = 1 + r0() * 3;
        x.beginPath();
        var sy = r0() * h;
        x.moveTo(0, sy);
        x.bezierCurveTo(w * 0.3, sy + (r0() - 0.5) * 40, w * 0.6, sy + (r0() - 0.5) * 40, w, sy + (r0() - 0.5) * 30);
        x.stroke();
      }
      x.font = '700 30px Menlo, monospace'; x.textAlign = 'center';
      x.fillStyle = 'rgba(240,217,168,0.92)'; x.fillText('K-DLY', w / 2, h * 0.44);
      x.font = '700 20px Menlo, monospace';
      x.fillStyle = 'rgba(240,217,168,0.7)'; x.fillText('+0.5 s', w / 2, h * 0.68);
      x.strokeStyle = 'rgba(240,217,168,0.4)'; x.lineWidth = 2;
      x.strokeRect(8, 8, w - 16, h - 16);
      [[16, 16], [w - 16, 16], [16, h - 16], [w - 16, h - 16]].forEach(function (p) { rivetDot(x, p[0], p[1], 4, 'rgba(24,16,8,0.8)', 'rgba(214,182,120,0.8)'); });
    });
    var plainB = grainTint(0x3a2a1c, 'relayplain', 40);
    var box = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.1),
      [plainB, plainB.clone(), plainB.clone(), plainB.clone(), skinMat(bakTex, { shin: 52, spec: 0x5a4a34 }), plainB.clone()]);
    box.castShadow = true;
    g.add(box);
    // the timing can — polished, with a crimped foot
    var can = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.07, 12), machMat(0xc4cbd1, 0.24, 0.85));
    can.position.set(0.04, 0.095, 0);
    g.add(can);
    var canFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.012, 12), machMat(0x8a929a, 0.35, 0.7));
    canFoot.position.set(0.04, 0.062, 0);
    g.add(canFoot);
    [-0.05, -0.01].forEach(function (dx) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.03, 6), machMat(COL.brass, 0.3, 0.82));
      post.position.set(dx, 0.075, 0.02);
      g.add(post);
    });
    return g;
  }
  function buildImpactFuze() {
    var g = new THREE.Group();
    // machined steel ogive with painted grade rings and a red contact tip
    var coneTex = canvasTex('fuzecone', 256, 128, function (x, w, h) {
      var g1 = x.createLinearGradient(0, 0, 0, h);
      g1.addColorStop(0, '#5a636d'); g1.addColorStop(0.6, '#79838d'); g1.addColorStop(1, '#8d97a1');
      x.fillStyle = g1; x.fillRect(0, 0, w, h);
      texGrain(x, w, h, 300, 0.07, 'fuzecone');
      // machining rings (v runs base→tip; tip is canvas top)
      x.fillStyle = 'rgba(20,26,31,0.4)';
      [0.3, 0.44, 0.58, 0.72].forEach(function (yf) { x.fillRect(0, yf * h, w, 1.6); });
      // red contact grade at the tip
      x.fillStyle = shadeHex(COL.nose, -0.08); x.fillRect(0, 0, w, h * 0.2);
      x.fillStyle = 'rgba(240,232,208,0.85)'; x.fillRect(0, h * 0.2, w, 2);
      var ao = x.createLinearGradient(0, h * 0.75, 0, h);
      ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(8,12,16,0.24)');
      x.fillStyle = ao; x.fillRect(0, 0, w, h);
    });
    var off = noseStandoff();
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, off + 0.14, 12), grainTint(0x4c565f, 'fuzestem', 20));
    stem.rotation.z = Math.PI / 2;
    stem.position.x = (off + 0.14) / 2 - 0.02;
    g.add(stem);
    var cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.44, 16), skinMat(coneTex, { shin: 40 }));
    cone.rotation.z = -Math.PI / 2;
    cone.position.x = 0.24 + off;
    cone.castShadow = true;
    g.add(cone);
    var pin = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.02, 0.14, 8), machMat(0xd8dde2, 0.24, 0.85));
    pin.rotation.z = -Math.PI / 2;
    pin.position.x = 0.5 + off;
    g.add(pin);
    var pinTip = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), machMat(COL.brass, 0.28, 0.85));
    pinTip.position.x = 0.575 + off;
    g.add(pinTip);
    // knurled arming collar at the base
    var ring = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.06, 20), skinMat(knurlTex('knurl:steel', 0x77818a), { shin: 46 }));
    ring.rotation.z = Math.PI / 2;
    ring.position.x = 0.04 + off;
    g.add(ring);
    var lbl = textPlane('NF-1', 0.14, 0.06, { color: '#f3ede0', px: 80 });
    lbl.position.set(0.18 + off, 0.1, 0.14);
    lbl.rotation.y = 0.35;
    g.add(lbl);
    return g;
  }
  function buildGyro() {
    // GYRO CORE G-7: brass gimbals over a lit rotor — the most instrument-
    // looking thing in the drawer, and it knows it
    var g = new THREE.Group();
    var housTex = canvasTex('gyrohous', 256, 96, function (x, w, h) {
      x.fillStyle = '#333c46'; x.fillRect(0, 0, w, h);
      texGrain(x, w, h, 220, 0.07, 'gyrohous');
      // calibration tick ring around the top edge
      x.fillStyle = 'rgba(156,200,234,0.8)';
      for (var i = 0; i < 36; i++) x.fillRect(i * (w / 36), 3, 1.6, i % 9 === 0 ? 12 : 6);
      x.fillStyle = 'rgba(12,17,22,0.5)'; x.fillRect(0, h - 6, w, 6);
      // riveted data plate
      x.fillStyle = '#b8bfc6'; x.fillRect(w * 0.38, h * 0.36, w * 0.24, h * 0.34);
      x.fillStyle = 'rgba(30,34,38,0.9)';
      x.font = '700 13px Menlo, monospace'; x.textAlign = 'center';
      x.fillText('G-7', w * 0.5, h * 0.58);
      rivetDot(x, w * 0.4, h * 0.42, 2.4); rivetDot(x, w * 0.6, h * 0.42, 2.4);
    });
    var housing = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.16, 16), skinMat(housTex, { shin: 42 }));
    housing.castShadow = true;
    g.add(housing);
    var ringA = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.014, 8, 26), machMat(0xc9a24b, 0.22, 0.88));
    ringA.position.y = 0.1;
    ringA.rotation.x = 0.5;
    g.add(ringA);
    var ringB = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 8, 24), machMat(0xd8dde2, 0.2, 0.9));
    ringB.position.y = 0.1;
    ringB.rotation.z = 0.9;
    g.add(ringB);
    var rotor = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12),
      mat(0x9cc8ea, { shin: 95, emissive: 0x27506e, ei: 0.45, flat: false }));
    rotor.position.y = 0.1;
    g.add(rotor);
    // inspection tag on a corner — the bench signed it out
    var tag = textPlane('PASS · 7A', 0.11, 0.042, { color: '#241f16', bg: '#d8b25a', px: 40 });
    tag.position.set(0.12, -0.05, 0.13);
    tag.rotation.y = 0.5; tag.rotation.z = -0.35;
    g.add(tag);
    var lbl = textPlane('G-7', 0.12, 0.05, { color: '#9cc8ea', px: 72 });
    lbl.position.set(0, -0.02, 0.187);
    g.add(lbl);
    return g;
  }
  function buildPaintTin() {
    var g = new THREE.Group();
    var tinTex = canvasTex('painttin', 256, 128, function (x, w, h) {
      var g1 = x.createLinearGradient(0, 0, 0, h);
      g1.addColorStop(0, '#8d959b'); g1.addColorStop(0.5, '#6d757b'); g1.addColorStop(1, '#565e64');
      x.fillStyle = g1; x.fillRect(0, 0, w, h);
      texGrain(x, w, h, 200, 0.06, 'painttin');
      // paper label band
      x.fillStyle = '#d9cba2'; x.fillRect(0, h * 0.3, w, h * 0.44);
      x.fillStyle = 'rgba(60,50,34,0.4)'; x.fillRect(0, h * 0.3, w, 2); x.fillRect(0, h * 0.74 - 2, w, 2);
      // a long drip over the label
      x.fillStyle = '#8a4a34';
      x.fillRect(w * 0.68, h * 0.18, 7, h * 0.4);
      x.beginPath(); x.arc(w * 0.68 + 3.5, h * 0.58, 5, 0, Math.PI * 2); x.fill();
    });
    var tin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 18), skinMat(tinTex, { shin: 38 }));
    tin.castShadow = true;
    g.add(tin);
    // lid with a painted swatch ring — the shop's colour card
    var lidTex = canvasTex('paintlid', 128, 128, function (x, w, h) {
      x.fillStyle = '#9aa1a7'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(20,26,31,0.4)'; x.lineWidth = 3;
      x.beginPath(); x.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2); x.stroke();
      x.fillStyle = '#8a4a34';
      x.beginPath(); x.arc(w / 2, h / 2, w * 0.3, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255,246,230,0.25)';
      x.beginPath(); x.arc(w * 0.42, h * 0.42, w * 0.1, 0, Math.PI * 2); x.fill();
    });
    var lid = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.02, 18),
      [machMat(0x9aa1a7, 0.35, 0.6), skinMat(lidTex, { shin: 44 }), machMat(0x9aa1a7, 0.35, 0.6)]);
    lid.position.y = 0.12;
    g.add(lid);
    var handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 18, Math.PI), machMat(0xb9c2c9, 0.3, 0.7));
    handle.position.y = 0.13;
    g.add(handle);
    [[0.12, 0.05], [-0.07, 0.1]].forEach(function (dp, i) {
      var drip = new THREE.Mesh(new THREE.SphereGeometry(i ? 0.02 : 0.03, 8, 6), mat(0x8a4a34, { shin: 46 }));
      drip.position.set(dp[0], 0.11, dp[1]);
      g.add(drip);
    });
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
    if (id === 'gyro') return buildGyro();
    if (id === 'cap') return buildCap();
    if (id === 'fins') return buildFins();
    if (id === 'panel') return buildArmPanel();
    return buildDetonator();
  }

  /* ================= BAY SCENE ================= */
  // Not a pedestal in a void any more: the bay is the company's one-room
  // workshop at 2am — a sealed concrete slab with a painted work-circle,
  // a pegboard over the bench, steel stores racks, a roll-up door somebody
  // chained shut years ago, and two tungsten cage lamps nobody switches off.
  function initBay() {
    var scene = new THREE.Scene();
    scene.background = gradientTexture([[0, '#0d1a29'], [0.6, '#0a1420'], [1, '#070e17']], true);
    scene.fog = new THREE.Fog(0x0e1a28, 12, 30);
    scene.environment = envMap('#2a445f', '#1b3048', '#0e1826', 60, 'rgba(255,224,170,0.95)');  // cool room, warm lamp glint

    var camera = new THREE.PerspectiveCamera(42, W / H, 0.05, 60);

    /* ---- lights: cool shell, warm tungsten heart — lit so the hero part reads ---- */
    var hemi = new THREE.HemisphereLight(0xaec6e0, 0x3a2c1e, 0.66);
    scene.add(hemi);
    var key = new THREE.DirectionalLight(0xfff1dc, 1.06);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -4; key.shadow.camera.right = 4;
    key.shadow.camera.top = 5; key.shadow.camera.bottom = -2;
    key.shadow.camera.far = 22;
    key.shadow.radius = 4;
    scene.add(key);
    var rim = new THREE.DirectionalLight(0x9cc8ea, 0.3);
    rim.position.set(-5, 3, -4);
    scene.add(rim);
    var fill = new THREE.DirectionalLight(0x8fb0d6, 0.3);   // open the shadows so the room isn't a void
    fill.position.set(-3, 2, 6);
    scene.add(fill);
    var stand = new THREE.PointLight(0xffe1b0, 0.5, 8, 1.7);   // a soft warm key over the work stand
    stand.position.set(0, 2.4, 0.4);
    scene.add(stand);

    /* ---- the set plan: one set of prop marks shared by floor AO + meshes ---- */
    var ROOM_R = 9.6, WALL_H = 6.2;
    function azPos(az, d) { return { x: Math.sin(az) * d, z: Math.cos(az) * d }; }
    var P_BENCH = azPos(4.15, 6.6);    // workbench, back-left of the default view
    var P_RACK = azPos(3.0, 6.4);      // stores rack, back-right
    var P_DRUM = azPos(5.2, 4.8);      // waste drum + crates, viewer's left
    var P_STACK = azPos(0.95, 5.3);    // spare crates behind the default camera
    var AZ_DOOR = 3.55;                // the roll-up door, painted on the far wall

    /* ---- floor: 2048px painted slab — still the chalk diary of your attempts ---- */
    var FSZ = 2048, K = FSZ / 512, PXM = FSZ / 22;   // 22 m of world across the canvas
    function w2cx(wx) { return FSZ / 2 + wx * PXM; }
    function w2cy(wz) { return FSZ / 2 + wz * PXM; }
    var fc = document.createElement('canvas');
    fc.width = fc.height = FSZ;
    var fx = fc.getContext('2d');
    var fbase = document.createElement('canvas');    // the slab itself, painted once
    fbase.width = fbase.height = FSZ;
    (function paintSlab() {
      var b = fbase.getContext('2d');
      var pr = PG2.stream('BAY', 'slab');
      var i, o, g;
      b.fillStyle = '#0c1521';
      b.fillRect(0, 0, FSZ, FSZ);
      // cool pool of light on sealed concrete
      g = b.createRadialGradient(FSZ / 2, FSZ / 2, 90, FSZ / 2, FSZ / 2, FSZ * 0.46);
      g.addColorStop(0, '#1a2b3e');
      g.addColorStop(0.55, '#101c2a');
      g.addColorStop(1, '#0a121d');
      b.fillStyle = g;
      b.fillRect(0, 0, FSZ, FSZ);
      // warm breath under the worklight
      g = b.createRadialGradient(FSZ / 2, FSZ / 2, 20, FSZ / 2, FSZ / 2, 300);
      g.addColorStop(0, 'rgba(255,213,150,0.12)');
      g.addColorStop(1, 'rgba(255,213,150,0)');
      b.fillStyle = g;
      b.fillRect(FSZ / 2 - 320, FSZ / 2 - 320, 640, 640);
      // mottle: soft tone patches so the slab isn't one flat pour
      for (i = 0; i < 26; i++) {
        var mx = pr() * FSZ, my = pr() * FSZ, mr = 90 + pr() * 260;
        var mg = b.createRadialGradient(mx, my, 0, mx, my, mr);
        mg.addColorStop(0, pr() > 0.5 ? 'rgba(150,180,205,0.045)' : 'rgba(0,0,0,0.06)');
        mg.addColorStop(1, 'rgba(0,0,0,0)');
        b.fillStyle = mg;
        b.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
      }
      // aggregate speckle
      for (i = 0; i < 3200; i++) {
        b.fillStyle = pr() > 0.6 ? 'rgba(160,190,215,0.06)' : 'rgba(0,0,0,0.08)';
        b.fillRect(pr() * FSZ, pr() * FSZ, 1 + pr() * 2, 1 + pr() * 2);
      }
      // saw-cut expansion joints every 3 m, with a ghost highlight lip
      var JOINT = 3 * PXM;
      b.strokeStyle = 'rgba(0,0,0,0.30)';
      b.lineWidth = 3;
      for (i = -3; i <= 3; i++) {
        o = FSZ / 2 + i * JOINT;
        b.beginPath(); b.moveTo(o, 0); b.lineTo(o, FSZ); b.stroke();
        b.beginPath(); b.moveTo(0, o); b.lineTo(FSZ, o); b.stroke();
      }
      b.strokeStyle = 'rgba(170,200,230,0.05)';
      b.lineWidth = 1;
      for (i = -3; i <= 3; i++) {
        o = FSZ / 2 + i * JOINT + 2.5;
        b.beginPath(); b.moveTo(o, 0); b.lineTo(o, FSZ); b.stroke();
        b.beginPath(); b.moveTo(0, o); b.lineTo(FSZ, o); b.stroke();
      }
      // hairline cracks wandering off the joints
      b.strokeStyle = 'rgba(0,0,0,0.20)';
      b.lineWidth = 1.4;
      for (i = 0; i < 7; i++) {
        var cx0 = pr() * FSZ, cy0 = pr() * FSZ;
        b.beginPath(); b.moveTo(cx0, cy0);
        for (var s = 0; s < 6; s++) { cx0 += (pr() - 0.5) * 120; cy0 += (pr() - 0.5) * 120; b.lineTo(cx0, cy0); }
        b.stroke();
      }
      // the painted work-circle — amber, worn where boots and casters live
      b.save();
      b.translate(FSZ / 2, FSZ / 2);
      b.strokeStyle = 'rgba(206,132,42,0.8)';
      b.lineWidth = 9;
      b.setLineDash([74, 16]);
      b.beginPath(); b.arc(0, 0, 1.78 * PXM, 0.12, Math.PI * 2 + 0.12); b.stroke();
      b.setLineDash([]);
      b.strokeStyle = 'rgba(206,132,42,0.34)';
      b.lineWidth = 3;
      b.beginPath(); b.arc(0, 0, 1.62 * PXM, 0, Math.PI * 2); b.stroke();
      b.strokeStyle = 'rgba(206,132,42,0.65)';
      b.lineWidth = 5;
      for (i = 0; i < 4; i++) {
        b.save(); b.rotate(i * Math.PI / 2);
        b.beginPath(); b.moveTo(1.68 * PXM, 0); b.lineTo(1.9 * PXM, 0); b.stroke();
        b.restore();
      }
      // stencil in front of the circle, squared to the default camera
      b.rotate(-0.7);
      b.fillStyle = 'rgba(210,224,238,0.34)';
      b.font = '700 34px Menlo, monospace';
      b.textAlign = 'center'; b.textBaseline = 'middle';
      b.fillText('ASSEMBLY ZERO', 0, 2.28 * PXM);
      b.font = '700 22px Menlo, monospace';
      b.fillStyle = 'rgba(210,224,238,0.22)';
      b.fillText('KEEP CIRCLE CLEAR', 0, 2.28 * PXM + 34);
      b.rotate(0.7);
      b.restore();
      // caster scuffs orbiting the circle
      b.strokeStyle = 'rgba(0,0,0,0.14)';
      for (i = 0; i < 9; i++) {
        b.lineWidth = 3 + pr() * 4;
        var sr = (1.9 + pr() * 1.1) * PXM, a0 = pr() * Math.PI * 2;
        b.beginPath();
        b.arc(FSZ / 2 + (pr() - 0.5) * 40, FSZ / 2 + (pr() - 0.5) * 40, sr, a0, a0 + 0.5 + pr());
        b.stroke();
      }
      // hazard threshold + faded walk lane at the roll-up door
      (function () {
        var p = azPos(AZ_DOOR, 8.45);
        var ang = Math.atan2(p.z, p.x);
        b.save();
        b.translate(w2cx(p.x), w2cy(p.z));
        b.rotate(ang + Math.PI / 2);
        var hw = 4.2 * PXM / 2, hh = 0.55 * PXM / 2;
        b.beginPath(); b.rect(-hw, -hh, hw * 2, hh * 2); b.clip();
        for (var sx2 = -hw - hh * 2, k2 = 0; sx2 < hw + hh * 2; sx2 += 44, k2++) {
          b.fillStyle = (k2 % 2 === 0) ? 'rgba(213,176,52,0.62)' : 'rgba(16,18,22,0.72)';
          b.beginPath();
          b.moveTo(sx2, -hh); b.lineTo(sx2 + 44, -hh);
          b.lineTo(sx2 + 44 - hh * 2, hh); b.lineTo(sx2 - hh * 2, hh);
          b.closePath(); b.fill();
        }
        b.restore();
        b.strokeStyle = 'rgba(205,220,235,0.10)';
        b.lineWidth = 4;
        b.setLineDash([40, 30]);
        var q1 = azPos(AZ_DOOR, 7.9), q2 = azPos(AZ_DOOR, 2.6);
        var lx = Math.cos(AZ_DOOR), lz = -Math.sin(AZ_DOOR);
        [-1, 1].forEach(function (sgn) {
          b.beginPath();
          b.moveTo(w2cx(q1.x + lx * sgn * 1.1), w2cy(q1.z + lz * sgn * 1.1));
          b.lineTo(w2cx(q2.x + lx * sgn * 1.1), w2cy(q2.z + lz * sgn * 1.1));
          b.stroke();
        });
        b.setLineDash([]);
      })();
      // oil stains: the slab remembers every leak
      function stain(wx, wz, r, a) {
        var n = 5 + Math.floor(pr() * 4);
        for (var j = 0; j < n; j++) {
          var ox = w2cx(wx) + (pr() - 0.5) * r * 1.1, oy = w2cy(wz) + (pr() - 0.5) * r * 1.1;
          var rr = r * (0.35 + pr() * 0.55);
          var sg = b.createRadialGradient(ox, oy, 0, ox, oy, rr);
          sg.addColorStop(0, 'rgba(6,8,10,' + a + ')');
          sg.addColorStop(0.7, 'rgba(6,8,10,' + (a * 0.55).toFixed(2) + ')');
          sg.addColorStop(1, 'rgba(6,8,10,0)');
          b.fillStyle = sg;
          b.fillRect(ox - rr, oy - rr, rr * 2, rr * 2);
        }
      }
      stain(P_DRUM.x + 0.5, P_DRUM.z + 0.4, 42, 0.5);
      stain(P_BENCH.x + 0.9, P_BENCH.z + 0.9, 30, 0.35);
      stain(1.9, 2.6, 26, 0.22);
      stain(-2.6, -1.4, 20, 0.18);
      stain(2.4, 1.9, 24, 0.14);
      // painted contact shadows: everything standing on the slab is glued to it
      function contactAO(wx, wz, rx, rz, rot, a) {
        b.save();
        b.translate(w2cx(wx), w2cy(wz));
        b.rotate(rot || 0);
        b.scale(1, rz / rx);
        var agr = b.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx);
        agr.addColorStop(0, 'rgba(0,0,0,' + a + ')');
        agr.addColorStop(1, 'rgba(0,0,0,0)');
        b.fillStyle = agr;
        b.fillRect(-rx, -rx, rx * 2, rx * 2);
        b.restore();
      }
      function aoFor(p, LX, LZ, a) {
        contactAO(p.x, p.z, LX * PXM / 2, LZ * PXM / 2, Math.atan2(p.z, p.x) + Math.PI / 2, a);
      }
      aoFor(P_BENCH, 2.9, 1.3, 0.5);
      aoFor(P_RACK, 2.4, 1.0, 0.5);
      contactAO(P_DRUM.x, P_DRUM.z, 0.55 * PXM, 0.55 * PXM, 0, 0.5);
      contactAO(P_DRUM.x + 0.85, P_DRUM.z - 0.4, 0.6 * PXM, 0.6 * PXM, 0, 0.45);
      aoFor(P_STACK, 1.5, 1.3, 0.45);
      contactAO(0, 0, 1.4 * PXM, 1.4 * PXM, 0, 0.22);
      // a chalked job number by the circle — the crew talks to itself
      b.fillStyle = 'rgba(222,232,242,0.38)';
      b.font = '400 26px Menlo, monospace';
      b.save(); b.translate(w2cx(-1.15), w2cy(2.35)); b.rotate(-0.45); b.fillText('R-01', 0, 0); b.restore();
      b.save(); b.translate(w2cx(2.5), w2cy(0.9)); b.rotate(0.9);
      b.fillStyle = 'rgba(222,232,242,0.2)'; b.fillText('ø 1.78', 0, 0); b.restore();
      // the slab dies into the walls
      var eg = b.createRadialGradient(FSZ / 2, FSZ / 2, (ROOM_R - 2.2) * PXM, FSZ / 2, FSZ / 2, ROOM_R * PXM);
      eg.addColorStop(0, 'rgba(4,7,11,0)');
      eg.addColorStop(0.8, 'rgba(4,7,11,0.5)');
      eg.addColorStop(1, 'rgba(4,7,11,0.85)');
      b.fillStyle = eg;
      b.fillRect(0, 0, FSZ, FSZ);
    })();
    function drawFloorBase() { fx.drawImage(fbase, 0, 0); }
    drawFloorBase();
    var ftx = new THREE.CanvasTexture(fc);
    ftx.encoding = THREE.sRGBEncoding;
    ftx.anisotropy = 4;
    var floor = new THREE.Mesh(new THREE.CircleGeometry(11, 48),
      new THREE.MeshPhongMaterial({ map: ftx, shininess: 12, specular: 0x16222e }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    // chalk tallies + (after test #3) a coffee ring — the bay keeps score.
    // Drawn in the legacy 512 coordinate frame, scaled up to the new slab.
    function repaintFloor(tests) {
      drawFloorBase();
      var n = Math.min(tests || 0, 40);
      var jr = PG2.stream('BAY', 'chalk');
      fx.save();
      fx.scale(K, K);
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
      fx.restore();
      ftx.needsUpdate = true;
    }

    /* ---- the shell of the room: one painted steel wall, wrapped around ---- */
    var wc = document.createElement('canvas');
    wc.width = 2048; wc.height = 512;
    (function paintWall() {
      var x = wc.getContext('2d');
      var pr = PG2.stream('BAY', 'wall');
      var PXV = 512 / WALL_H, PXH = 2048 / (Math.PI * 2 * ROOM_R);
      function wy(h) { return 512 - h * PXV; }
      var i, g;
      g = x.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#0b1420');
      g.addColorStop(0.5, '#1b2c3d');
      g.addColorStop(0.9, '#131f2d');
      g.addColorStop(1, '#0b121b');
      x.fillStyle = g;
      x.fillRect(0, 0, 2048, 512);
      // panel seams
      for (i = 0; i < 2048; i += 96) {
        x.fillStyle = 'rgba(0,0,0,0.32)';
        x.fillRect(i, 0, 2, 512);
        x.fillStyle = 'rgba(160,200,240,0.08)';
        x.fillRect(i + 2, 0, 1, 512);
      }
      // girts + rivets
      [2.3, 4.4].forEach(function (h) {
        var yy = wy(h);
        x.fillStyle = 'rgba(0,0,0,0.35)';
        x.fillRect(0, yy, 2048, 5);
        x.fillStyle = 'rgba(160,200,240,0.06)';
        x.fillRect(0, yy + 5, 2048, 1);
        x.fillStyle = 'rgba(0,0,0,0.4)';
        for (var rx = 24; rx < 2048; rx += 48) x.fillRect(rx, yy - 4, 3, 3);
      });
      // datum band at 1.35 m — the Authority paints its paperwork onto the world
      var dy = wy(1.35);
      x.fillStyle = 'rgba(226,158,62,0.35)';
      x.fillRect(0, dy, 2048, 4);
      x.fillStyle = 'rgba(220,232,244,0.14)';
      x.fillRect(0, dy - 3, 2048, 1);
      x.fillStyle = 'rgba(200,215,230,0.2)';
      x.font = '700 12px Menlo, monospace';
      x.textAlign = 'left';
      for (i = 60; i < 2048; i += 640) x.fillText('DATUM 1.35 M', i, dy - 7);
      // ghost sign, high on the wall
      x.fillStyle = 'rgba(190,210,230,0.1)';
      x.font = '700 46px Menlo, monospace';
      x.textAlign = 'center';
      x.fillText('R E D S K Y   I N C', 480, wy(4.9));
      x.font = '700 22px Menlo, monospace';
      x.fillText('ASSEMBLY BAY 02', 480, wy(4.9) + 30);
      // ---- roll-up door, centre of the canvas ----
      (function () {
        var cx = 1024, dw2 = 4.4 * PXH / 2, top = wy(3.3);
        x.fillStyle = 'rgba(0,0,0,0.5)';                       // recess
        x.fillRect(cx - dw2 - 8, top - 10, dw2 * 2 + 16, 512 - top + 10);
        x.fillStyle = '#1d2c3b';                               // curtain
        x.fillRect(cx - dw2, top, dw2 * 2, 512 - top);
        for (var yy2 = top + 8; yy2 < 512; yy2 += 12) {        // slats
          x.fillStyle = 'rgba(0,0,0,0.3)';
          x.fillRect(cx - dw2, yy2, dw2 * 2, 2);
          x.fillStyle = 'rgba(170,205,240,0.06)';
          x.fillRect(cx - dw2, yy2 + 2, dw2 * 2, 1);
        }
        x.fillStyle = '#243444';                               // rails + header
        x.fillRect(cx - dw2 - 10, top - 4, 10, 512 - top + 4);
        x.fillRect(cx + dw2, top - 4, 10, 512 - top + 4);
        x.fillRect(cx - dw2 - 14, top - 16, dw2 * 2 + 28, 14);
        // grime kicked up the curtain, weather strip
        var dg = x.createLinearGradient(0, 512 - 60, 0, 512);
        dg.addColorStop(0, 'rgba(0,0,0,0)');
        dg.addColorStop(1, 'rgba(0,0,0,0.55)');
        x.fillStyle = dg;
        x.fillRect(cx - dw2 - 10, 512 - 60, dw2 * 2 + 20, 60);
        x.fillStyle = 'rgba(213,176,52,0.5)';                  // hazard nibs on the rails
        for (var hy = 512 - 12; hy > wy(1.1); hy -= 24) {
          x.fillRect(cx - dw2 - 10, hy, 10, 12);
          x.fillRect(cx + dw2, hy - 12, 10, 12);
        }
        x.fillStyle = 'rgba(200,215,230,0.4)';
        x.font = '700 17px Menlo, monospace';
        x.textAlign = 'center';
        x.fillText('DOOR 2 — KEEP CLEAR', cx, top - 26);
        // the chain and padlock: this door hasn't opened since the lease
        x.strokeStyle = 'rgba(120,135,150,0.55)';
        x.lineWidth = 3;
        x.beginPath();
        x.moveTo(cx - 16, 500);
        x.quadraticCurveTo(cx, 480, cx + 18, 500);
        x.stroke();
      })();
      // fire point, stage left
      (function () {
        var ex = 640, ey = wy(1.75);
        x.fillStyle = 'rgba(200,60,40,0.5)';
        x.fillRect(ex - 8, ey - 22, 16, 16);            // sign
        x.fillStyle = 'rgba(240,240,240,0.5)';
        x.font = '700 7px Menlo, monospace';
        x.textAlign = 'center';
        x.fillText('FIRE', ex, ey - 13);
        x.fillStyle = '#7d2a20';                        // the extinguisher itself
        x.fillRect(ex - 9, ey + 6, 18, 46);
        x.fillStyle = '#1c242c';
        x.fillRect(ex - 4, ey - 2, 8, 10);
        x.fillStyle = 'rgba(0,0,0,0.4)';                // its shadow
        x.fillRect(ex + 9, ey + 10, 6, 44);
      })();
      // stencil warnings between the landmarks
      x.fillStyle = 'rgba(200,120,90,0.22)';
      x.font = '700 18px Menlo, monospace';
      x.textAlign = 'center';
      x.fillText('NO OPEN FLAME', 260, wy(2.0));
      x.fillStyle = 'rgba(200,215,230,0.2)';
      x.fillText('LOT STORAGE →', 1800, wy(1.9));
      // splashback grime at the slab line
      for (i = 0; i < 60; i++) {
        var gx2 = pr() * 2048, gw2 = 5 + pr() * 18, gh2 = 25 + pr() * 70;
        var gg = x.createLinearGradient(0, 512 - gh2, 0, 512);
        gg.addColorStop(0, 'rgba(0,0,0,0)');
        gg.addColorStop(1, 'rgba(0,0,0,0.28)');
        x.fillStyle = gg;
        x.fillRect(gx2, 512 - gh2, gw2, gh2);
      }
      // and the whole base of the wall settles into shadow
      var bg2 = x.createLinearGradient(0, 512 - 36, 0, 512);
      bg2.addColorStop(0, 'rgba(0,0,0,0)');
      bg2.addColorStop(1, 'rgba(0,0,0,0.6)');
      x.fillStyle = bg2;
      x.fillRect(0, 512 - 36, 2048, 36);
    })();
    var wtx = new THREE.CanvasTexture(wc);
    wtx.encoding = THREE.sRGBEncoding;
    wtx.wrapS = THREE.RepeatWrapping;
    wtx.repeat.x = -1;                    // authored to read correctly from inside
    var wall = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_R, ROOM_R, WALL_H, 64, 1, true),
      new THREE.MeshPhongMaterial({ map: wtx, side: THREE.BackSide, shininess: 5 }));
    wall.position.y = WALL_H / 2;
    wall.rotation.y = AZ_DOOR - Math.PI;  // park the painted door on its floor threshold
    scene.add(wall);
    // ceiling: darkness with the bones of the building in it
    var cc = document.createElement('canvas');
    cc.width = cc.height = 512;
    (function paintCeil() {
      var x = cc.getContext('2d');
      x.fillStyle = '#04070b';
      x.fillRect(0, 0, 512, 512);
      [[180, 205], [330, 300]].forEach(function (p) {
        var g = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], 95);
        g.addColorStop(0, 'rgba(130,160,200,0.09)');
        g.addColorStop(1, 'rgba(130,160,200,0)');
        x.fillStyle = g;
        x.fillRect(p[0] - 95, p[1] - 95, 190, 190);
      });
      x.strokeStyle = 'rgba(0,0,0,0.55)';
      x.lineWidth = 9;
      for (var i = 1; i < 5; i++) {
        x.beginPath(); x.moveTo(0, i * 102); x.lineTo(512, i * 102); x.stroke();
      }
      x.strokeStyle = 'rgba(70,90,115,0.12)';
      x.lineWidth = 2;
      for (i = 1; i < 5; i++) {
        x.beginPath(); x.moveTo(0, i * 102 + 6); x.lineTo(512, i * 102 + 6); x.stroke();
      }
    })();
    var ctex = new THREE.CanvasTexture(cc);
    ctex.encoding = THREE.sRGBEncoding;
    var ceil = new THREE.Mesh(new THREE.CircleGeometry(ROOM_R + 0.05, 48),
      new THREE.MeshBasicMaterial({ map: ctex }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = WALL_H;
    scene.add(ceil);

    /* ---- shared soft-dot texture: dust motes + bulb halos ---- */
    var soft = document.createElement('canvas');
    soft.width = soft.height = 32;
    (function () {
      var x = soft.getContext('2d');
      var g = x.createRadialGradient(16, 16, 1, 16, 16, 15);
      g.addColorStop(0, 'rgba(255,235,205,1)');
      g.addColorStop(0.5, 'rgba(255,235,205,0.35)');
      g.addColorStop(1, 'rgba(255,235,205,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 32, 32);
    })();
    var softTex = new THREE.CanvasTexture(soft);

    /* ---- crate skin, shared by every box the company owns ---- */
    var crateTex = (function () {
      var c = document.createElement('canvas');
      c.width = c.height = 256;
      var x = c.getContext('2d');
      var pr = PG2.stream('BAY', 'crate');
      x.fillStyle = '#57452c';
      x.fillRect(0, 0, 256, 256);
      for (var i = 0; i < 4; i++) {                   // planks
        x.fillStyle = 'rgba(0,0,0,' + (0.1 + pr() * 0.12).toFixed(2) + ')';
        x.fillRect(0, i * 64, 256, 3);
        x.strokeStyle = 'rgba(0,0,0,0.12)';
        x.lineWidth = 1.5;
        for (var s = 0; s < 3; s++) {
          var gy = i * 64 + 12 + pr() * 44;
          x.beginPath(); x.moveTo(0, gy);
          x.bezierCurveTo(80, gy + (pr() - 0.5) * 8, 170, gy + (pr() - 0.5) * 8, 256, gy);
          x.stroke();
        }
      }
      x.strokeStyle = 'rgba(0,0,0,0.5)';              // edge AO — the chamfer lie
      x.lineWidth = 14;
      x.strokeRect(0, 0, 256, 256);
      x.strokeStyle = 'rgba(224,200,150,0.10)';
      x.lineWidth = 3;
      x.strokeRect(8, 8, 240, 240);
      x.fillStyle = 'rgba(20,14,8,0.5)';              // corner battens
      x.fillRect(0, 0, 26, 256); x.fillRect(230, 0, 26, 256);
      x.fillStyle = 'rgba(224,214,190,0.5)';
      x.font = '700 30px Menlo, monospace';
      x.textAlign = 'center';
      x.save(); x.translate(128, 140); x.fillText('REDSKY', 0, 0);
      x.font = '700 18px Menlo, monospace';
      x.fillText('LOT 7 · THIS WAY UP', 0, 28); x.restore();
      var t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      return t;
    })();
    var crateMat = new THREE.MeshPhongMaterial({ map: crateTex, shininess: 6 });
    function crate(w, h, d) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), crateMat);
      m.castShadow = false;
      return m;
    }
    function paintCan(r, h) {
      var g = new THREE.Group();
      var tin = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), mat(0x6f7a82, { shin: 45 }));
      g.add(tin);
      var lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.04, h * 0.08, 12), mat(0x8d979e, { shin: 65 }));
      lid.position.y = h / 2;
      g.add(lid);
      return g;
    }

    /* ---- the workbench: scarred ply top, steel legs, pegboard behind ---- */
    (function buildBench() {
      var g = new THREE.Group();
      var topC = document.createElement('canvas');
      topC.width = 512; topC.height = 256;
      (function () {
        var x = topC.getContext('2d');
        var pr = PG2.stream('BAY', 'bench');
        x.fillStyle = '#5f4c31';
        x.fillRect(0, 0, 512, 256);
        for (var i = 0; i < 4; i++) {                 // ply planks + grain
          x.fillStyle = 'rgba(0,0,0,0.18)';
          x.fillRect(0, i * 64, 512, 2);
          x.strokeStyle = 'rgba(0,0,0,0.14)';
          x.lineWidth = 1.4;
          for (var s = 0; s < 5; s++) {
            var gy = i * 64 + 8 + pr() * 50;
            x.beginPath(); x.moveTo(0, gy);
            x.bezierCurveTo(150, gy + (pr() - 0.5) * 10, 360, gy + (pr() - 0.5) * 10, 512, gy);
            x.stroke();
          }
        }
        for (i = 0; i < 3; i++) {                     // ring stains from the mug
          x.strokeStyle = 'rgba(30,20,10,' + (0.2 + pr() * 0.2).toFixed(2) + ')';
          x.lineWidth = 4;
          x.beginPath();
          x.arc(60 + pr() * 400, 40 + pr() * 170, 14 + pr() * 8, 0.3, Math.PI * 2);
          x.stroke();
        }
        for (i = 0; i < 14; i++) {                    // scratches and saw scars
          x.strokeStyle = pr() > 0.5 ? 'rgba(230,215,185,0.16)' : 'rgba(0,0,0,0.2)';
          x.lineWidth = 1 + pr() * 2;
          var sx3 = pr() * 512, sy3 = pr() * 256;
          x.beginPath(); x.moveTo(sx3, sy3);
          x.lineTo(sx3 + (pr() - 0.5) * 160, sy3 + (pr() - 0.5) * 60);
          x.stroke();
        }
        var burn = x.createRadialGradient(400, 190, 4, 400, 190, 46);   // soldering burn
        burn.addColorStop(0, 'rgba(10,6,4,0.6)');
        burn.addColorStop(1, 'rgba(10,6,4,0)');
        x.fillStyle = burn;
        x.fillRect(350, 140, 100, 100);
        x.strokeStyle = 'rgba(0,0,0,0.55)';           // painted edge AO
        x.lineWidth = 18;
        x.strokeRect(0, 0, 512, 256);
        x.fillStyle = 'rgba(228,238,248,0.35)';       // chalked cut list
        x.font = '400 20px Menlo, monospace';
        x.save(); x.translate(120, 200); x.rotate(-0.06);
        x.fillText('2100 × ø420', 0, 0);
        x.fillText('cut 2', 0, 24);
        x.restore();
      })();
      var topT = new THREE.CanvasTexture(topC);
      topT.encoding = THREE.sRGBEncoding;
      var top = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.09, 0.78),
        new THREE.MeshPhongMaterial({ map: topT, shininess: 9 }));
      top.position.y = 0.9;
      g.add(top);
      [[-1.05, -0.3], [1.05, -0.3], [-1.05, 0.3], [1.05, 0.3]].forEach(function (p) {
        var leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.86, 0.08), mat(0x27333f, { shin: 20 }));
        leg.position.set(p[0], 0.43, p[1]);
        g.add(leg);
      });
      var shelf = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.05, 0.6), mat(0x2c3844, { shin: 12 }));
      shelf.position.y = 0.3;
      g.add(shelf);
      var can1 = paintCan(0.09, 0.2); can1.position.set(-0.7, 0.42, 0.05); g.add(can1);
      var can2 = paintCan(0.07, 0.16); can2.position.set(-0.44, 0.4, -0.1); g.add(can2);
      var uBox = crate(0.44, 0.2, 0.34); uBox.position.set(0.6, 0.43, 0); g.add(uBox);
      // vise at the end — cast iron, not negotiable
      var vise = new THREE.Group();
      vise.position.set(0.95, 0.98, 0.12);
      var vBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.14), mat(0x39424c, { shin: 30 }));
      vise.add(vBody);
      var vJaw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.14), mat(0x2c343c, { shin: 40 }));
      vJaw.position.x = -0.14;
      vise.add(vJaw);
      var vScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 8), mat(0x9aa5ad, { shin: 80 }));
      vScrew.rotation.z = Math.PI / 2;
      vScrew.position.set(-0.16, -0.02, 0);
      vise.add(vScrew);
      var vBar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), mat(0x9aa5ad, { shin: 80 }));
      vBar.position.set(-0.27, -0.02, 0);
      vise.add(vBar);
      g.add(vise);
      // toolbox, mug, rag — the still life
      var tbox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.2), mat(0x64231a, { shin: 45 }));
      tbox.position.set(-0.55, 1.03, -0.14);
      tbox.rotation.y = 0.12;
      g.add(tbox);
      var thandle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.011, 6, 12, Math.PI), mat(0x39424c, { shin: 60 }));
      thandle.position.set(-0.55, 1.11, -0.14);
      thandle.rotation.y = 0.12;
      g.add(thandle);
      var mug = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.09, 10), mat(0xd9cfb8, { shin: 55 }));
      mug.position.set(-0.05, 0.99, 0.2);
      g.add(mug);
      var rag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.014, 0.15), mat(0x8a4a34, { shin: 4 }));
      rag.position.set(0.28, 0.95, 0.24);
      rag.rotation.y = 0.5;
      g.add(rag);
      // pegboard: near enough to actually read, tools painted where they belong
      var pbC = document.createElement('canvas');
      pbC.width = 512; pbC.height = 160;
      (function () {
        var x = pbC.getContext('2d');
        x.fillStyle = '#4a4632';
        x.fillRect(0, 0, 512, 160);
        x.strokeStyle = 'rgba(0,0,0,0.5)';
        x.lineWidth = 10;
        x.strokeRect(0, 0, 512, 160);
        x.fillStyle = 'rgba(0,0,0,0.32)';
        for (var px2 = 12; px2 < 512; px2 += 13)
          for (var py2 = 12; py2 < 160; py2 += 13)
            x.fillRect(px2, py2, 2, 2);
        x.fillStyle = 'rgba(12,16,20,0.75)';
        x.strokeStyle = 'rgba(228,238,248,0.28)';
        x.lineWidth = 2;
        // wrench, up close and personal
        x.save(); x.translate(80, 80); x.rotate(0.45);
        x.fillRect(-5, -34, 10, 68);
        x.beginPath(); x.arc(0, -38, 13, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.arc(0, 38, 13, 0, Math.PI * 2); x.fill();
        x.strokeRect(-9, -52, 18, 104);
        x.restore();
        // spanner set, one gone
        for (var sp2 = 0; sp2 < 4; sp2++) {
          if (sp2 === 1) { x.strokeRect(150 + sp2 * 40 - 5, 30, 10, 74); continue; }
          x.fillRect(150 + sp2 * 40 - 4, 32, 8, 70);
          x.beginPath(); x.arc(150 + sp2 * 40, 28, 8, 0, Math.PI * 2); x.fill();
        }
        // mallet
        x.save(); x.translate(360, 78); x.rotate(-0.1);
        x.fillRect(-4, -20, 8, 58);
        x.fillRect(-24, -34, 48, 18);
        x.strokeRect(-28, -38, 56, 84);
        x.restore();
        // tape roll
        x.beginPath(); x.arc(452, 70, 22, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#4a4632';
        x.beginPath(); x.arc(452, 70, 9, 0, Math.PI * 2); x.fill();
      })();
      var pbT = new THREE.CanvasTexture(pbC);
      pbT.encoding = THREE.sRGBEncoding;
      var pb = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.66),
        new THREE.MeshPhongMaterial({ map: pbT, shininess: 4 }));
      pb.position.set(0, 1.26, -0.36);
      g.add(pb);
      g.position.set(P_BENCH.x, 0, P_BENCH.z);
      g.lookAt(0, 0, 0);
      scene.add(g);
    })();

    /* ---- stores rack: slotted angle, crates, canister stock ---- */
    (function buildRack() {
      var g = new THREE.Group();
      var steel = mat(0x2c3844, { shin: 25 });
      [[-0.95, -0.26], [0.95, -0.26], [-0.95, 0.26], [0.95, 0.26]].forEach(function (p) {
        var up = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.55, 0.06), steel);
        up.position.set(p[0], 0.775, p[1]);
        g.add(up);
      });
      [0.16, 0.72, 1.28].forEach(function (y) {
        var sh = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.045, 0.56), mat(0x394856, { shin: 18 }));
        sh.position.y = y;
        g.add(sh);
        var lip = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.02, 0.03), mat(0x51637a, { shin: 40 }));
        lip.position.set(0, y + 0.01, 0.29);
        g.add(lip);
      });
      [-1, 1].forEach(function (s) {                  // cross brace on the back
        var br = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.04, 0.02), steel);
        br.position.set(0, 0.75, -0.28);
        br.rotation.z = s * 0.55;
        g.add(br);
      });
      // bottom: canister stock, racked like wine
      for (var i = 0; i < 5; i++) {
        var cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.52, 12),
          mat(i === 2 ? 0x8a6b32 : 0x6f7d8a, { shin: 50 }));
        cyl.rotation.z = Math.PI / 2;
        cyl.position.set(-0.7 + i * 0.35, 0.29, 0.02);
        g.add(cyl);
      }
      // middle: crates and a can
      var c1 = crate(0.52, 0.36, 0.44); c1.position.set(-0.6, 0.925, 0); g.add(c1);
      var c2 = crate(0.42, 0.3, 0.4); c2.position.set(0.1, 0.895, -0.02); c2.rotation.y = -0.08; g.add(c2);
      var rcan = paintCan(0.1, 0.22); rcan.position.set(0.62, 0.855, 0.06); g.add(rcan);
      // top: one crate, a coil of rope, a small drum
      var c3 = crate(0.46, 0.3, 0.4); c3.position.set(0.55, 1.455, 0); c3.rotation.y = 0.1; g.add(c3);
      var rope = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.045, 8, 16), mat(0x6b5a3c, { shin: 8 }));
      rope.rotation.x = Math.PI / 2;
      rope.position.set(-0.35, 1.35, 0.05);
      g.add(rope);
      var placard = textPlane('RACK B · STORES', 0.7, 0.11, { color: '#9cb4c8', px: 44 });
      placard.position.set(0, 1.62, 0.1);
      g.add(placard);
      g.position.set(P_RACK.x, 0, P_RACK.z);
      g.lookAt(0, 0, 0);
      scene.add(g);
    })();

    /* ---- the drum corner + the spare stack ---- */
    (function buildCorners() {
      var g = new THREE.Group();
      var drum = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.86, 14), mat(0x2b3a44, { shin: 30 }));
      drum.position.y = 0.43;
      g.add(drum);
      [-0.16, 0.16].forEach(function (y) {
        var rib = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.014, 6, 16), mat(0x2c3d49, { shin: 40 }));
        rib.rotation.x = Math.PI / 2;
        rib.position.y = 0.43 + y;
        g.add(rib);
      });
      var lid = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 14), mat(0x27343e, { shin: 45 }));
      lid.position.y = 0.875;
      g.add(lid);
      var funnel = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.12, 10), mat(0x8d979e, { shin: 60 }));
      funnel.rotation.x = Math.PI;
      funnel.position.set(0.08, 0.95, 0.04);
      g.add(funnel);
      var dl = textPlane('WASTE OIL', 0.4, 0.09, { color: '#c8b98a', px: 40 });
      dl.position.set(0, 0.52, 0.3);
      g.add(dl);
      var dc1 = crate(0.56, 0.4, 0.46); dc1.position.set(0.85, 0.2, -0.4); dc1.rotation.y = 0.35; g.add(dc1);
      var dc2 = crate(0.44, 0.32, 0.4); dc2.position.set(0.92, 0.56, -0.44); dc2.rotation.y = 0.2; g.add(dc2);
      var lean = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 0.03), mat(0x4c3e28, { shin: 6 }));
      lean.position.set(-0.55, 0.72, -0.1);
      lean.rotation.z = 0.16;
      g.add(lean);
      g.position.set(P_DRUM.x, 0, P_DRUM.z);
      g.lookAt(0, 0, 0);
      scene.add(g);
      // spare crates behind the default camera — a reward for orbiting
      var st = new THREE.Group();
      var s1 = crate(0.6, 0.42, 0.5); s1.position.y = 0.21; st.add(s1);
      var s2 = crate(0.5, 0.36, 0.44); s2.position.set(0.06, 0.6, -0.02); s2.rotation.y = 0.3; st.add(s2);
      var coil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 16), mat(0x10161c, { shin: 6 }));
      coil.rotation.x = Math.PI / 2;
      coil.position.set(0.62, 0.06, 0.3);
      st.add(coil);
      st.position.set(P_STACK.x, 0, P_STACK.z);
      st.lookAt(0, 0, 0);
      scene.add(st);
      // two cones minding the door threshold
      [[0.35, 7.4], [-0.5, 7.15]].forEach(function (cp) {
        var p = azPos(AZ_DOOR + cp[0] * 0.14, cp[1]);
        var cone = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 10), mat(0x5f2513, { shin: 25 }));
        cone.position.set(p.x, 0.2, p.z);
        scene.add(cone);
        var cbase = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.26), mat(0x63301c, { shin: 20 }));
        cbase.position.set(p.x, 0.015, p.z);
        scene.add(cbase);
      });
    })();

    /* ---- the practicals: two cage lamps, burning since the lease was signed ---- */
    var lamps = [];
    function cageLamp(px, pz, drop, phase) {
      var g = new THREE.Group();
      g.position.set(px, WALL_H, pz);
      var cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, drop, 6), mat(0x11151a, { shin: 30 }));
      cable.position.y = -drop / 2;
      g.add(cable);
      var shade = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.13, 0.11, 12), mat(0x182d24, { shin: 40 }));
      shade.position.y = -drop - 0.05;
      g.add(shade);
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffd9a4 }));
      bulb.position.y = -drop - 0.16;
      g.add(bulb);
      var cageH = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.006, 5, 14), mat(0x22303c, { shin: 50 }));
      cageH.rotation.x = Math.PI / 2;
      cageH.position.y = -drop - 0.16;
      g.add(cageH);
      [0, Math.PI / 2].forEach(function (ry) {
        var cageV = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.006, 5, 14, Math.PI), mat(0x22303c, { shin: 50 }));
        cageV.rotation.set(0, ry, Math.PI);
        cageV.position.y = -drop - 0.16;
        g.add(cageV);
      });
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: softTex, color: 0xffb877, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      halo.material.opacity = 0.13;
      halo.scale.set(0.38, 0.38, 0.38);
      halo.position.y = -drop - 0.16;
      g.add(halo);
      var pt = new THREE.PointLight(0xffb066, 0.66, 9.5, 2);
      pt.position.y = -drop - 0.18;
      g.add(pt);
      scene.add(g);
      lamps.push({ g: g, light: pt, base: 0.66, p: phase, bulb: bulb });
    }
    cageLamp(1.65, -1.81, 3.3, 0);
    cageLamp(-1.97, 1.62, 3.0, 2.1);

    /* ---- dust in the key light: the air in here is old and knows it ---- */
    var dustMat = new THREE.SpriteMaterial({
      map: softTex, color: 0xffe2b8, transparent: true, opacity: 0.14,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    var dust = [];
    var dr = PG2.stream('BAY', 'dust');
    for (var di = 0; di < 38; di++) {
      var dsp = new THREE.Sprite(dustMat);
      dsp.position.set((dr() - 0.5) * 3.2, 0.8 + dr() * 2.7, (dr() - 0.5) * 3.2);
      var dsc = 0.01 + dr() * 0.014;
      dsp.scale.set(dsc, dsc, dsc);
      dsp.userData = { vy: 0.05 + dr() * 0.1, p: dr() * Math.PI * 2 };
      scene.add(dsp);
      dust.push(dsp);
    }

    // chalk tallies + clipboard by the stand (appears after test #3, with the coffee)
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
    var pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), mat(0xc9a23a, { shin: 30 }));
    pencil.rotation.set(Math.PI / 2, 0, 0.5);
    pencil.position.set(0.1, 0.032, 0.16);
    clip.add(pencil);
    clip.position.set(-1.55, 0.02, 1.62);
    clip.rotation.y = 0.7;
    clip.visible = false;
    scene.add(clip);
    // work-light rig — quietly scoots around to look over your shoulder
    var rig = new THREE.Group();
    var tripod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.15, 8), mat(0x1f2830));
    tripod.position.y = 1.07;
    rig.add(tripod);
    var feet = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.05, 10), mat(0x161d24));
    feet.position.y = 0.03;
    rig.add(feet);
    var head = new THREE.Group();
    head.position.y = 2.12;
    var hood = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.23, 0.26, 10), mat(0x25303c));
    hood.rotation.x = Math.PI / 2;
    head.add(hood);
    var lens = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff2d0 }));
    lens.position.z = 0.14;
    head.add(lens);
    rig.add(head);
    var wspot = new THREE.SpotLight(0xffe9c4, 0.22, 11, 0.55, 0.6, 1.2);
    wspot.position.set(0, 2.12, 0.1);
    rig.add(wspot);
    var wtarget = new THREE.Object3D();
    scene.add(wtarget);
    wtarget.position.set(0, 1.3, 0);
    wspot.target = wtarget;
    rig.userData.angle = 2.3;
    rig.userData.head = head;
    scene.add(rig);

    /* ---- the work stand: hydraulic column, rubber cradle, pendant control ---- */
    var stand = new THREE.Group();
    var base = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.08, 0.16, 24), mat(0x161d25));
    base.position.y = 0.08; base.castShadow = true; base.receiveShadow = true;
    stand.add(base);
    // painted top plate: wear rings, bolt circle, the shop's own stencil
    var plateC = document.createElement('canvas');
    plateC.width = plateC.height = 256;
    (function paintPlate() {
      var x = plateC.getContext('2d');
      var pr = PG2.stream('BAY', 'plate');
      var g = x.createRadialGradient(128, 128, 8, 128, 128, 128);
      g.addColorStop(0, '#26333e');
      g.addColorStop(0.7, '#1b2530');
      g.addColorStop(1, '#121a22');
      x.fillStyle = g;
      x.fillRect(0, 0, 256, 256);
      x.strokeStyle = 'rgba(0,0,0,0.25)';             // machining rings
      for (var r = 18; r < 126; r += 9) {
        x.lineWidth = 1 + (r % 27 === 0 ? 1.5 : 0);
        x.beginPath(); x.arc(128, 128, r, 0, Math.PI * 2); x.stroke();
      }
      for (var i = 0; i < 20; i++) {                  // wear scratches
        x.strokeStyle = 'rgba(210,225,240,' + (0.05 + pr() * 0.08).toFixed(2) + ')';
        x.lineWidth = 1;
        var a = pr() * Math.PI * 2, rr = 30 + pr() * 90;
        x.beginPath(); x.arc(128, 128, rr, a, a + 0.3 + pr() * 0.9); x.stroke();
      }
      for (i = 0; i < 8; i++) {                       // bolt circle
        var ba = i * Math.PI / 4 + 0.4;
        var bx2 = 128 + Math.cos(ba) * 104, by2 = 128 + Math.sin(ba) * 104;
        x.fillStyle = 'rgba(0,0,0,0.55)';
        x.beginPath(); x.arc(bx2, by2, 7, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(200,220,240,0.3)';
        x.beginPath(); x.arc(bx2 - 1.5, by2 - 1.5, 2.5, 0, Math.PI * 2); x.fill();
      }
      x.fillStyle = 'rgba(226,158,62,0.5)';
      x.font = '700 17px Menlo, monospace';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.save(); x.translate(128, 128); x.rotate(0.7);
      x.fillText('REDSKY', 0, -70);
      x.fillText('SWL 500', 0, 78);
      x.restore();
      var eo = x.createRadialGradient(128, 128, 104, 128, 128, 128);   // edge AO
      eo.addColorStop(0, 'rgba(0,0,0,0)');
      eo.addColorStop(1, 'rgba(0,0,0,0.5)');
      x.fillStyle = eo;
      x.fillRect(0, 0, 256, 256);
    })();
    var plateT = new THREE.CanvasTexture(plateC);
    plateT.encoding = THREE.sRGBEncoding;
    var plate = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32),
      new THREE.MeshPhongMaterial({ map: plateT, shininess: 30, specular: 0x2e3d4c }));
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = 0.162;
    plate.receiveShadow = true;
    stand.add(plate);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.02, 8, 40), mat(0xc78a2e, { emissive: 0xc78a2e, ei: 0.22 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.17;
    stand.add(ring);
    // hydraulic column: barrel, wiper collar, polished ram
    var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.26, 0.46, 14), mat(0x1a222c));
    barrel.position.y = 0.39; barrel.castShadow = true;
    stand.add(barrel);
    var collar = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.07, 14), mat(0x141b23, { shin: 40 }));
    collar.position.y = 0.64;
    stand.add(collar);
    var ram = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 14), mat(0x3d4954, { shin: 70, flat: false }));
    ram.position.y = 0.86; ram.castShadow = true;
    stand.add(ram);
    // crosshead + uprights + rubber cradle pads
    var beam = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.1, 0.16), mat(0x1d2732));
    beam.position.y = 1.02; beam.castShadow = true;
    stand.add(beam);
    [-0.5, 0.5].forEach(function (bx) {
      var up = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.34), mat(0x1d2732));
      up.position.set(bx, 1.08, 0);
      up.castShadow = true;
      stand.add(up);
      [-1, 1].forEach(function (sz) {
        var pad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.08), mat(0x14181d, { shin: 4 }));
        pad.position.set(bx, 1.12, sz * 0.2);
        pad.rotation.x = sz * -0.5;
        stand.add(pad);
      });
    });
    // pendant control on its drooping cable — UP · DOWN · a red one you don't touch
    var pCable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      V3(0.52, 1.0, 0.06), V3(0.72, 0.82, 0.2), V3(0.78, 0.6, 0.3), V3(0.73, 0.46, 0.34)
    ]), 16, 0.013, 6, false), mat(0x141920, { shin: 25 }));
    stand.add(pCable);
    var pend = new THREE.Group();
    var pBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.05), mat(0x8f7524, { shin: 40 }));
    pend.add(pBody);
    [[0.05, 0x2e7d4f, 0x37995f], [-0.01, 0x2e7d4f, 0x37995f], [-0.07, 0x8a2f24, 0xb0392b]].forEach(function (bt) {
      var btn = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 8),
        mat(bt[1], { emissive: bt[2], ei: 0.5 }));
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, bt[0], 0.028);
      pend.add(btn);
    });
    pend.position.set(0.73, 0.36, 0.34);
    pend.rotation.set(0.1, 0.3, 0.05);
    stand.add(pend);
    // hydraulic hose, base to collar
    stand.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      V3(-0.62, 0.17, 0.42), V3(-0.5, 0.2, 0.28), V3(-0.3, 0.36, 0.1), V3(-0.19, 0.61, 0.02)
    ]), 14, 0.02, 6, false), mat(0x1a222b, { shin: 15 })));
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
      dust: dust, lamps: lamps,              // 2am housekeeping
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
    if (!a.gyro) nodes.push({ id: 'gyromount', pos: V3(-d.L * 0.18, 0.06, -d.r - 0.03), accepts: ['gyro'] });
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
    if (nodeId === 'gyromount') return { pos: V3(-d.L * 0.18, 0.04, -d.r - 0.02), rot: V3(Math.PI / 2, 0, 0) };
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
    { id: 'guidance', name: 'GUIDANCE' }   // the seal is off (M3b wave 2)
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
    { id: 'gyro',     cat: 'guidance', name: 'GYRO CORE G-7', fx: 'CANCELS DRIFT · ALIGN BY HAND', group: 'unique', unlock: 'RFP-063' },
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
    if (S.world === 'sandbox') return false;   // the sandbox lot has the whole catalog on the shelf
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
    systems:   { label: 'SYSTEMS', cats: ['fuzing', 'power', 'guidance'],
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
    var shortOnCash = S.mode === 'rnd' && !cashOK(d.cost);
    cost.textContent = S.mode === 'rnd' ? fmt$(d.cost) + ' / ' + (cashUnlimited() ? '∞' : fmt$(SAVE.cash)) : fmt$(d.cost);
    cost.className = (d.overBudget || shortOnCash) ? 'bad' : '';
    var cf = $('m-cost-fill');
    cf.style.width = clamp(d.cost / (S.mode === 'rnd' ? (cashUnlimited() ? d.cost / 0.42 : Math.max(SAVE.cash, 1) / 0.88) : R.budget / 0.88), 0, 1) * 100 + '%';
    cf.classList.toggle('over', d.overBudget || shortOnCash);
    var btn = $('btn-closeout');
    btn.disabled = !(d.complete && !d.overBudget && !d.overWeight && !shortOnCash);
    $('btn-refire').classList.toggle('hidden', !(S.phase === 'build' && closeoutReady() && d.complete && !d.overBudget && !d.overWeight && !shortOnCash));
    $('btn-refinery').classList.toggle('hidden', !(S.phase === 'build' && R.needsRefinery));
    gyroBtnRefresh();
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
    var shortCash = S.mode === 'rnd' && !cashOK(d.cost);
    if (!S.assembly.shell) msg = S.mode === 'rnd'
      ? 'Your bench, your dime, no spec sheet.<br>Pull the <b>PARTS</b> drawer and build the thing you keep sketching.'
      : 'Pull the <b>PARTS</b> drawer and drag a <b>shell</b> onto the glowing stand.<br>One finger orbits · pinch zooms.';
    else if (d.filled === 0) msg = R.needsRefinery && S.mode !== 'rnd'
      ? 'This job wants the still. Fire up <b>⚗ THE STILL</b>, then load the bays.'
      : 'Load <b>canisters</b> into the open bays.<br>Amber F-1A = more bang · blue F-2S = calmer.';
    else if (d.missing.length) msg = 'Still missing: <b>' + d.missing.join(' · ') + '</b>.<br>Tap a placed part to take it back off.';
    else if (shortCash) msg = '<b style="color:#ff8d7e">The account is short.</b> This article costs ' + fmt$(d.cost) +
      ' to expend; the company holds ' + cashLabel() + '. Win a contract, land an order, or build cheaper.';
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
        // multi-material parts (label + plain faces) ghost per face
        var ghostly = function (mm) {
          var c = mm.clone();
          c.transparent = true;
          c.opacity = 0.55;
          return c;
        };
        m.material = Array.isArray(m.material) ? m.material.map(ghostly) : ghostly(m.material);
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
      if (id === 'gyro') a.gyroCal = null;   // a fresh gyro arrives uncaged
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
      if (info.kind === 'gyro') a.gyroCal = null;   // alignment doesn't survive removal
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
    panel: 'One switch, one guard, zero excuses. The little light means it.',
    gyro: 'A spinning opinion about which way is straight. Align it by hand or it argues with the fins.'
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
  var screens = ['scr-title', 'scr-hq', 'scr-bids', 'scr-board', 'scr-museum', 'scr-rfp', 'scr-score', 'scr-longshot'];
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
      $('bay-brand-txt').textContent = 'WEAPONS ASSEMBLY · ' + (S.world === 'sandbox' ? 'SANDBOX' : 'R&D');
      $('bay-attempt').textContent = 'SHOT #' + (WS().rndTests + 1);
      $('btn-torange').innerHTML = 'OUT THE BACK GATE →';
      $('btn-hq').classList.remove('hidden');
    } else {
      $('bay-brand-txt').textContent = 'REDSKY INC · ' + rfp().id;
      $('bay-attempt').textContent = 'TEST #' + (S.attempt + 1);
      $('btn-torange').innerHTML = 'TRUCK TO RANGE →';
      $('btn-hq').classList.add('hidden');
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
    var tests = S.mode === 'rnd' ? WS().rndTests : contractRec(S.contract).tests;
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
    ['ck-wiring', 'ck-torque', 'ck-det', 'ck-dial', 'ck-gyro'].forEach(function (id) { $(id).classList.remove('shown'); });
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
    $('ck-gyro').classList.toggle('gone', !a.gyro);
    if (a.gyro) {
      lines.push({ id: 'ck-gyro', ok: a.gyroCal != null,
        okTxt: '✓ ALIGNED ' + Math.round((a.gyroCal || 0) * 100) + '%',
        sub: (a.gyroCal || 0) >= 0.85 ? 'the rotor hums' : 'it will hold' });
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
    dawn: {   // pale gold, the air still cold, shadows a hundred metres long
      sky: [[0, '#0e1a38'], [0.22, '#2e3d6b'], [0.36, '#6d5f8e'], [0.445, '#c07a5e'],
            [0.492, '#f5aa66'], [0.53, '#ffdba2'], [0.60, '#e8b98c'], [1, '#c9a17c']],
      fog: 0xe4b088, fogNear: 980, fogFar: 4300,
      hemiSky: 0xb4c2e4, hemiGnd: 0x8f6a46, hemiI: 0.66,
      sun: 0xffc078, sunI: 1.34, sunPos: [-950, 235, 480], sunScale: 860,
      mesas: [0x9a5f46, 0xa26b5e, 0x99738f, 0x8b78a4],   // warm near → violet far
      terrTint: 0xffd6ae,
      haze: 0xe8a97e, hazeOp: 0.36,
      cloudTint: 0xffd2a4, cloudOp: 0.5,
      practicals: 0.5,
      shimmer: 0.4, longShadow: true
    },
    noon: {   // bleached and brutal — the light has opinions and no mercy
      sky: [[0, '#2d7ecf'], [0.26, '#5aa3d8'], [0.42, '#a4c9dc'], [0.492, '#e4dfc8'],
            [0.56, '#eee6cd'], [1, '#e5dabb']],
      fog: 0xece3ca, fogNear: 1750, fogFar: 5300,
      hemiSky: 0xe9f2fa, hemiGnd: 0xb0996c, hemiI: 1.08,
      sun: 0xfff8e6, sunI: 1.3, sunPos: [160, 1150, 260], sunScale: 620,
      mesas: [0xb98f66, 0xc4a37e, 0xcdb99e, 0xd6cab4],   // bleached, dust-shifted far
      terrTint: 0xfffdf4,
      haze: 0xe6ddc2, hazeOp: 0.5,
      cloudTint: 0xffffff, cloudOp: 0.3,
      practicals: 0,
      shimmer: 1.0, longShadow: false
    },
    dusk: {   // ember-violet: the sun goes down angry, the pad lights come up warm
      sky: [[0, '#0f0c28'], [0.22, '#2c2150'], [0.36, '#5c3560'], [0.44, '#a04b58'],
            [0.487, '#e07444'], [0.525, '#ffa054'], [0.60, '#d0855c'], [1, '#7e5850']],
      fog: 0xb07468, fogNear: 930, fogFar: 3900,
      hemiSky: 0x9080b4, hemiGnd: 0x74503c, hemiI: 0.64,
      sun: 0xff8a4a, sunI: 1.14, sunPos: [980, 205, 420], sunScale: 940,
      mesas: [0x6e4148, 0x64405c, 0x55406e, 0x453e76],   // ember-lit near → violet-night far
      terrTint: 0xdfa98d,
      haze: 0x8f5570, hazeOp: 0.4,
      cloudTint: 0xf7a070, cloudOp: 0.55,
      practicals: 1.0,
      shimmer: 0.18, longShadow: true
    }
  };
  function rangeSkyTexture(p) {
    // vertical gradient + horizon bloom + dither grain: the dome without the banding
    var c = document.createElement('canvas');
    c.width = 64; c.height = 512;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 0, 512);
    p.sky.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 512);
    var r = PG2.stream('RANGE', 'skygrain');
    x.globalAlpha = 0.028;
    for (var i = 0; i < 1400; i++) {
      x.fillStyle = r() < 0.5 ? '#000' : '#fff';
      x.fillRect(Math.floor(r() * 64), Math.floor(r() * 512), 1, 1);
    }
    x.globalAlpha = 1;
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function applyRangePalette(name) {
    var p = RANGE_PAL[name] || RANGE_PAL.dawn;
    if (!range.skyCache) range.skyCache = {};
    if (!range.skyCache[name]) range.skyCache[name] = rangeSkyTexture(p);
    range.scene.background = range.skyCache[name];
    range.skyDome.material.map = range.skyCache[name];   // the dome wears the hour
    range.skyDome.material.needsUpdate = true;
    range.scene.fog.color.setHex(p.fog);
    range.scene.fog.near = p.fogNear;
    range.scene.fog.far = p.fogFar;
    range.hemi.color.setHex(p.hemiSky);
    range.hemi.groundColor.setHex(p.hemiGnd);
    range.hemi.intensity = p.hemiI;
    range.sun.color.setHex(p.sun);
    range.sun.intensity = p.sunI;
    // direction from the palette, distance fixed — the shadow frustum stays honest
    var sv = V3(p.sunPos[0], p.sunPos[1], p.sunPos[2]).normalize();
    range.sun.position.copy(sv.clone().multiplyScalar(600));
    range.sunSpr.position.copy(sv.clone().multiplyScalar(3800));
    range.sunSpr.material.color.setHex(p.sun);
    range.sunSpr.scale.set(p.sunScale || 700, p.sunScale || 700, 1);
    range.cloudG.children.forEach(function (cs) {
      cs.material.color.setHex(p.cloudTint);
      cs.material.opacity = p.cloudOp;
    });
    range.mesas.forEach(function (m, i) { m.material.color.setHex(p.mesas[Math.min(i, p.mesas.length - 1)]); });
    range.terrain.material.color.setHex(p.terrTint);
    if (range.terrainMacro) range.terrainMacro.material.color.setHex(p.terrTint);
    if (range.hazeBands) range.hazeBands.forEach(function (hb, i) {
      hb.material.color.setHex(p.haze);
      hb.material.opacity = p.hazeOp * (i ? 0.65 : 1);
    });
    // the pad practicals: warm heads that mean something at dusk, dead glass at noon
    if (range.practicals) range.practicals.forEach(function (pr) {
      pr.mat.emissiveIntensity = 1.5 * p.practicals;
      pr.spr.material.opacity = 0.8 * p.practicals;
      pr.spr.visible = p.practicals > 0.02;
    });
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
    scene.environment = envMap('#cfe0f0', '#e8d6b4', '#8a6a42', 60, 'rgba(255,244,214,1)');  // desert sky IBL + sun glint
    var camera = new THREE.PerspectiveCamera(7, W / H, 0.5, 8000);

    var hemi = new THREE.HemisphereLight(0xcfe0f0, 0x8a6a42, 0.85);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff3da, 1.0);
    sun.position.set(-800, 900, 500);
    // REAL shadows on the range — the aerial view earns them
    sun.castShadow = true;
    sun.shadow.mapSize.set(3072, 3072);
    sun.shadow.camera.left = -170; sun.shadow.camera.right = 170;
    sun.shadow.camera.top = 170; sun.shadow.camera.bottom = -170;
    sun.shadow.camera.near = 150; sun.shadow.camera.far = 1200;
    sun.shadow.bias = -0.0006;
    sun.shadow.radius = 3;
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
            Math.sin(x * 0.013 + y * 0.009) * 2.5 +
            Math.sin(x * 0.031 + y * 0.043) * 0.8;                     // dune ripple
        var farK = clamp((r2 - 420) / 2400, 0, 1);                     // long swells out by the mesas
        h += farK * Math.sin(x * 0.0016 - 2.1) * Math.cos(y * 0.0013 + 0.8) * 17;
        h *= clamp((r2 - 60) / 300, 0, 1);
        h *= clamp((Math.abs(wz - 26) - 14) / 26, 0, 1);   // road corridor stays drivable
      }
      pos.setZ(i, h);
      // multi-zone vertex shading: warm sand near, desert-varnish darkening with
      // distance, patchy gravel sheets — the macro canvas paints the details on top
      var shade = 0.89 + Math.sin(x * 0.05) * Math.cos(y * 0.043) * 0.06 + Math.sin(x * 0.21 + y * 0.17) * 0.035;
      var dK = clamp((r2 - 240) / 2600, 0, 1);                          // distance varnish
      var patch = Math.max(0, Math.sin(x * 0.0021 + 1.2) * Math.sin(y * 0.0017 - 0.4)) * dK * 0.09;
      col.setRGB((0.865 - dK * 0.100 - patch) * shade,
                 (0.665 - dK * 0.095 - patch * 0.9) * shade,
                 (0.450 - dK * 0.065 - patch * 0.5) * shade);
      colors.push(col.r, col.g, col.b);
    }
    tg.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    tg.computeVertexNormals();
    // ground detail skin: multi-scale speckle, pebbles with painted shadows, crack
    // webs and alluvial grain — repeated fine, so the dirt reads at boot height
    var dtc = document.createElement('canvas');
    dtc.width = dtc.height = 1024;
    var dtx = dtc.getContext('2d');
    dtx.fillStyle = '#a49a8a';
    dtx.fillRect(0, 0, 1024, 1024);
    var dnR = PG2.stream('RANGE', 'dirt');
    // low-frequency mottle: soft warm/cool patches
    for (var dm = 0; dm < 240; dm++) {
      var mr = 30 + dnR() * 90, mx = dnR() * 1024, my = dnR() * 1024;
      var mg = dtx.createRadialGradient(mx, my, 2, mx, my, mr);
      var warm = dnR() < 0.5;
      mg.addColorStop(0, warm ? 'rgba(178,156,120,0.08)' : 'rgba(132,126,118,0.08)');
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      dtx.fillStyle = mg;
      dtx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }
    // alluvial grain: faint directional wind strata
    dtx.globalAlpha = 0.07;
    for (var dl2 = 0; dl2 < 54; dl2++) {
      dtx.strokeStyle = dnR() < 0.5 ? '#6e6458' : '#b3a68f';
      dtx.lineWidth = 1 + dnR() * 2;
      dtx.beginPath();
      var gy0 = dnR() * 1024;
      dtx.moveTo(0, gy0);
      dtx.bezierCurveTo(300, gy0 + dnR() * 60 - 30, 700, gy0 + dnR() * 60 - 30, 1024, gy0);
      dtx.stroke();
    }
    dtx.globalAlpha = 1;
    // fine speckle
    for (var dn = 0; dn < 11000; dn++) {
      var l = 134 + Math.floor(dnR() * 56);
      dtx.fillStyle = 'rgb(' + l + ',' + Math.round(l * 0.93) + ',' + Math.round(l * 0.82) + ')';
      var ds = dnR() < 0.92 ? 0.7 + dnR() * 2.2 : 3 + dnR() * 4;
      dtx.globalAlpha = 0.10 + dnR() * 0.22;
      dtx.beginPath();
      dtx.arc(dnR() * 1024, dnR() * 1024, ds, 0, 6.3);
      dtx.fill();
    }
    // pebbles: painted shadow + lit crown, the 3D the polygons can't afford
    for (var dp = 0; dp < 460; dp++) {
      var px2 = dnR() * 1024, py2 = dnR() * 1024, pr2 = 1.6 + dnR() * 3.4;
      dtx.globalAlpha = 0.22;
      dtx.fillStyle = '#584e40';
      dtx.beginPath(); dtx.arc(px2 + pr2 * 0.45, py2 + pr2 * 0.5, pr2, 0, 6.3); dtx.fill();
      var pl = 140 + Math.floor(dnR() * 70);
      dtx.globalAlpha = 0.55;
      dtx.fillStyle = 'rgb(' + pl + ',' + Math.round(pl * 0.94) + ',' + Math.round(pl * 0.85) + ')';
      dtx.beginPath(); dtx.arc(px2, py2, pr2 * 0.85, 0, 6.3); dtx.fill();
      dtx.globalAlpha = 0.4;
      dtx.fillStyle = '#e8ddc8';
      dtx.beginPath(); dtx.arc(px2 - pr2 * 0.3, py2 - pr2 * 0.32, pr2 * 0.32, 0, 6.3); dtx.fill();
    }
    // hairline crack web
    dtx.globalAlpha = 0.07;
    dtx.strokeStyle = '#584e40';
    dtx.lineWidth = 1;
    for (var dc = 0; dc < 120; dc++) {
      var cx0 = dnR() * 1024, cy0 = dnR() * 1024, ca0 = dnR() * 6.3;
      dtx.beginPath();
      dtx.moveTo(cx0, cy0);
      for (var cs2 = 0; cs2 < 4; cs2++) {
        ca0 += dnR() * 1.4 - 0.7;
        cx0 += Math.cos(ca0) * (8 + dnR() * 16);
        cy0 += Math.sin(ca0) * (8 + dnR() * 16);
        dtx.lineTo(cx0, cy0);
      }
      dtx.stroke();
    }
    dtx.globalAlpha = 1;
    var dirtTex = new THREE.CanvasTexture(dtc);
    dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping;
    dirtTex.repeat.set(46, 46);
    dirtTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    dirtTex.encoding = THREE.sRGBEncoding;
    var terrain = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true, map: dirtTex }));
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    scene.add(terrain);

    // MACRO SKIN — a 2048 canvas draped over the central 1500 m: the bleached playa,
    // the dry wash, tire-track history, the Authority's painted datum. Same geometry,
    // clamped UVs, transparent edges — it dissolves into the vertex-shaded distance.
    var mcv = document.createElement('canvas');
    mcv.width = mcv.height = 2048;
    var mx2 = mcv.getContext('2d');
    var mR = PG2.stream('RANGE', 'macro');
    var MSPAN = 1100;                                   // metres the skin covers
    var MSC = 2048 / MSPAN;                             // px per metre
    function mpx(wx) { return 1024 + wx * MSC; }
    function mpz(wzv) { return 1024 + wzv * MSC; }
    // desert varnish blotches — density grows with distance from the pad
    for (var vb = 0; vb < 900; vb++) {
      var va = mR() * Math.PI * 2, vd = Math.pow(mR(), 0.55) * 530;
      if (vd < 150) continue;
      var vx = mpx(Math.cos(va) * vd), vy = mpz(Math.sin(va) * vd);
      var vr = 8 + mR() * 34;
      var vgr = mx2.createRadialGradient(vx, vy, 1, vx, vy, vr);
      vgr.addColorStop(0, 'rgba(74,52,36,' + (0.05 + mR() * 0.10) + ')');
      vgr.addColorStop(1, 'rgba(74,52,36,0)');
      mx2.fillStyle = vgr;
      mx2.fillRect(vx - vr, vy - vr, vr * 2, vr * 2);
    }
    // gravel-sheet streaks: long soft diagonals
    mx2.globalAlpha = 0.06;
    for (var gs = 0; gs < 26; gs++) {
      mx2.strokeStyle = mR() < 0.5 ? '#6a5a44' : '#cbb79a';
      mx2.lineWidth = 10 + mR() * 26;
      mx2.beginPath();
      var gx0 = mR() * 2048, gyy = mR() * 2048;
      mx2.moveTo(gx0, gyy);
      mx2.bezierCurveTo(gx0 + 300, gyy + 160, gx0 + 700, gyy + 240, gx0 + 1100, gyy + 300);
      mx2.stroke();
    }
    mx2.globalAlpha = 1;
    // THE DRY WASH — a braided sand ribbon meandering NW → SE, skirting the pad
    var washPts = [[-700, -760], [-430, -430], [-290, -190], [-205, -55], [-140, 140], [-40, 300], [130, 460], [320, 640], [470, 780]];
    function drawWash(wd, style) {
      mx2.strokeStyle = style;
      mx2.lineWidth = wd;
      mx2.lineCap = 'round'; mx2.lineJoin = 'round';
      mx2.beginPath();
      mx2.moveTo(mpx(washPts[0][0]), mpz(washPts[0][1]));
      for (var wi2 = 1; wi2 < washPts.length - 1; wi2++) {
        var xc = (mpx(washPts[wi2][0]) + mpx(washPts[wi2 + 1][0])) / 2;
        var yc = (mpz(washPts[wi2][1]) + mpz(washPts[wi2 + 1][1])) / 2;
        mx2.quadraticCurveTo(mpx(washPts[wi2][0]), mpz(washPts[wi2][1]), xc, yc);
      }
      mx2.stroke();
    }
    drawWash(46, 'rgba(96,74,52,0.22)');               // dark banks
    drawWash(34, 'rgba(224,204,166,0.5)');             // sand bed
    drawWash(18, 'rgba(238,222,188,0.45)');            // bleached center braid
    mx2.save();
    mx2.translate(6, 4);
    drawWash(5, 'rgba(206,184,148,0.5)');              // side braid
    mx2.restore();
    // THE PLAYA — bleached clay disc around the pad, mud-crack polygons painted in
    var pg2 = mx2.createRadialGradient(1024, 1024, 10, 1024, 1024, 95 * MSC);
    pg2.addColorStop(0, 'rgba(235,224,200,0.55)');
    pg2.addColorStop(0.55, 'rgba(230,218,192,0.45)');
    pg2.addColorStop(0.85, 'rgba(222,208,178,0.24)');
    pg2.addColorStop(1, 'rgba(218,204,172,0)');
    mx2.fillStyle = pg2;
    mx2.beginPath(); mx2.arc(1024, 1024, 95 * MSC, 0, 6.3); mx2.fill();
    // wobble the rim with a few offset lobes so it isn't a perfect coin
    for (var pl2 = 0; pl2 < 7; pl2++) {
      var pa2 = mR() * Math.PI * 2, pd2 = 80 * MSC + mR() * 24;
      var plx = 1024 + Math.cos(pa2) * pd2 * 0.55, ply = 1024 + Math.sin(pa2) * pd2 * 0.55;
      var pgl = mx2.createRadialGradient(plx, ply, 2, plx, ply, 60 + mR() * 50);
      pgl.addColorStop(0, 'rgba(230,218,190,0.28)');
      pgl.addColorStop(1, 'rgba(230,218,190,0)');
      mx2.fillStyle = pgl;
      mx2.beginPath(); mx2.arc(plx, ply, 120, 0, 6.3); mx2.fill();
    }
    // mud-crack polygons
    mx2.strokeStyle = 'rgba(150,133,106,0.16)';
    mx2.lineWidth = 1;
    for (var mc2 = 0; mc2 < 110; mc2++) {
      var ma2 = mR() * Math.PI * 2, md2 = Math.sqrt(mR()) * 88 * MSC;
      var mcx = 1024 + Math.cos(ma2) * md2, mcy = 1024 + Math.sin(ma2) * md2;
      var seg = 3 + Math.floor(mR() * 3), aa = mR() * 6.3;
      mx2.beginPath(); mx2.moveTo(mcx, mcy);
      for (var ms2 = 0; ms2 < seg; ms2++) {
        aa += mR() * 2 - 1;
        mcx += Math.cos(aa) * (6 + mR() * 10); mcy += Math.sin(aa) * (6 + mR() * 10);
        mx2.lineTo(mcx, mcy);
      }
      mx2.stroke();
    }
    // TIRE-TRACK HISTORY — every survey, every convoy, ground into the clay
    function track(pts2, alpha) {
      mx2.strokeStyle = 'rgba(94,72,50,' + alpha + ')';
      mx2.lineWidth = 1.5;
      [-2.4, 2.4].forEach(function (off) {
        mx2.beginPath();
        for (var ti2 = 0; ti2 < pts2.length; ti2++) {
          var tx2 = mpx(pts2[ti2][0]) + off, ty2 = mpz(pts2[ti2][1]) + off * 0.4;
          if (ti2 === 0) mx2.moveTo(tx2, ty2); else mx2.lineTo(tx2, ty2);
        }
        mx2.stroke();
      });
    }
    // arcs looping the pad + spurs from the road (z=26) in to the apron
    for (var ta = 0; ta < 8; ta++) {
      var tr2 = 16 + ta * 6 + mR() * 4, t0 = mR() * 6.3, tlen = 1.2 + mR() * 2.6;
      var arc2 = [];
      for (var tk = 0; tk <= 16; tk++) {
        var ang2 = t0 + tlen * tk / 16;
        arc2.push([Math.cos(ang2) * tr2 * (1 + 0.08 * Math.sin(tk)), Math.sin(ang2) * tr2]);
      }
      track(arc2, 0.08 + mR() * 0.08);
    }
    [[-60, 26], [-20, 26], [30, 26], [70, 26]].forEach(function (sp2) {
      var spur = [];
      for (var sk = 0; sk <= 12; sk++) {
        var st2 = sk / 12;
        spur.push([sp2[0] + (12 - sp2[0]) * st2 * st2 * 0.9, 26 - (26 - 9) * st2 * st2]);
      }
      track(spur, 0.13);
    });
    // the road corridor itself — history of the convoy, painted under the mesh
    mx2.strokeStyle = 'rgba(90,70,48,0.12)';
    mx2.lineWidth = 11;
    mx2.beginPath(); mx2.moveTo(0, mpz(26)); mx2.lineTo(2048, mpz(26)); mx2.stroke();
    [-2.2, 2.2].forEach(function (rz2) {
      mx2.strokeStyle = 'rgba(84,64,44,0.18)';
      mx2.lineWidth = 2;
      mx2.beginPath(); mx2.moveTo(0, mpz(26 + rz2)); mx2.lineTo(2048, mpz(26 + rz2)); mx2.stroke();
    });
    // THE AUTHORITY'S DATUM — chalk circles every 25 m, cardinal lines, a survey stencil
    mx2.strokeStyle = 'rgba(242,238,226,0.62)';
    mx2.setLineDash([8, 7]);
    [25, 50, 75, 100].forEach(function (dr2) {
      mx2.lineWidth = dr2 === 100 ? 2.6 : 1.6;
      mx2.beginPath(); mx2.arc(1024, 1024, dr2 * MSC, 0, 6.3); mx2.stroke();
    });
    mx2.setLineDash([]);
    mx2.lineWidth = 1.7;
    mx2.beginPath();
    mx2.moveTo(mpx(-112), 1024); mx2.lineTo(mpx(112), 1024);
    mx2.moveTo(1024, mpz(-112)); mx2.lineTo(1024, mpz(112));
    mx2.stroke();
    mx2.fillStyle = 'rgba(242,238,226,0.55)';
    mx2.font = '700 34px Menlo, monospace';
    mx2.textAlign = 'center';
    mx2.fillText('RANGE 7', 1024, mpz(-122));
    mx2.font = '700 24px Menlo, monospace';
    mx2.fillText('N', 1024, mpz(-104));
    // edge fade: the skin dissolves before the clamped border
    var fade = mx2.createRadialGradient(1024, 1024, 860, 1024, 1024, 1015);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    mx2.globalCompositeOperation = 'destination-out';
    mx2.fillStyle = fade;
    mx2.fillRect(0, 0, 2048, 2048);
    mx2.clearRect(0, 0, 2048, 8); mx2.clearRect(0, 2040, 2048, 8);
    mx2.clearRect(0, 0, 8, 2048); mx2.clearRect(2040, 0, 8, 2048);
    mx2.globalCompositeOperation = 'source-over';
    var macroTex = new THREE.CanvasTexture(mcv);
    macroTex.wrapS = macroTex.wrapT = THREE.ClampToEdgeWrapping;
    var MREP = 6000 / MSPAN;                            // whole plane → central MSPAN metres
    macroTex.repeat.set(MREP, MREP);
    macroTex.offset.set((1 - MREP) / 2, (1 - MREP) / 2);
    macroTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    macroTex.encoding = THREE.sRGBEncoding;
    var terrainMacro = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({
      map: macroTex, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    terrainMacro.rotation.x = -Math.PI / 2;
    terrainMacro.renderOrder = -2;                      // under every decal and scar
    scene.add(terrainMacro);

    // THE SKY — a real dome, not a backdrop: gradient by hour, a sun with a
    // disc and a halo, and a few patient clouds. The aerial rig can look up now.
    var skyDome = new THREE.Mesh(new THREE.SphereGeometry(4200, 28, 18),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false }));
    scene.add(skyDome);
    // the sun gets a real disc: hard core, warm falloff halo — not an FX flash
    var sunCv = document.createElement('canvas');
    sunCv.width = sunCv.height = 256;
    var sctx = sunCv.getContext('2d');
    var sg2 = sctx.createRadialGradient(128, 128, 4, 128, 128, 128);
    sg2.addColorStop(0, 'rgba(255,255,255,1)');
    sg2.addColorStop(0.14, 'rgba(255,252,240,1)');
    sg2.addColorStop(0.20, 'rgba(255,244,214,0.62)');
    sg2.addColorStop(0.45, 'rgba(255,234,190,0.18)');
    sg2.addColorStop(1, 'rgba(255,226,178,0)');
    sctx.fillStyle = sg2;
    sctx.fillRect(0, 0, 256, 256);
    var sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(sunCv), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.9, fog: false }));
    sunSpr.scale.set(700, 700, 1);
    scene.add(sunSpr);
    // patient desert stratocumulus: puff clusters with shaded bases
    var cloudG = new THREE.Group();
    var cloudTexC = document.createElement('canvas');
    cloudTexC.width = 512; cloudTexC.height = 192;
    var ctx2 = cloudTexC.getContext('2d');
    var cR = PG2.stream('RANGE', 'clouds');
    for (var cb = 0; cb < 40; cb++) {
      var ccx = 60 + cR() * 392, ccy = 56 + cR() * 70, ccr = 24 + cR() * 34;
      var cg = ctx2.createRadialGradient(ccx, ccy - ccr * 0.2, 2, ccx, ccy, ccr);
      cg.addColorStop(0, 'rgba(255,255,255,0.6)');
      cg.addColorStop(0.6, 'rgba(255,255,255,0.28)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx2.fillStyle = cg;
      ctx2.fillRect(0, 0, 512, 192);
    }
    // flat shaded bases: the desert sky's signature
    ctx2.globalCompositeOperation = 'source-atop';
    var cbg = ctx2.createLinearGradient(0, 40, 0, 180);
    cbg.addColorStop(0, 'rgba(255,255,255,0)');
    cbg.addColorStop(1, 'rgba(150,132,128,0.5)');
    ctx2.fillStyle = cbg;
    ctx2.fillRect(0, 0, 512, 192);
    ctx2.globalCompositeOperation = 'source-over';
    var cloudTex = new THREE.CanvasTexture(cloudTexC);
    for (var cl = 0; cl < 8; cl++) {
      var cs = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, depthWrite: false, opacity: 0.5, fog: false }));
      var ca = cR() * Math.PI * 2;
      var cd = 1400 + cR() * 1800;
      cs.position.set(Math.cos(ca) * cd, 340 + cR() * 460, Math.sin(ca) * cd - 600);
      var csw = 620 + cR() * 820;
      cs.scale.set(csw, csw * 0.26, 1);
      cloudG.add(cs);
    }
    scene.add(cloudG);

    // GROUND DRESSING — the aerial view needs something to fly over:
    // creosote scrub, rocks and survey stakes, seeded so the desert is always the same desert
    var dressG = new THREE.Group();
    var dRand = PG2.stream('RANGE', 'dressing');
    // the dry wash line (must match the macro skin painting below)
    var washLine = [[-430, -430], [-290, -190], [-205, -55], [-140, 140], [-40, 300], [130, 460]];
    function washDist(wx2, wz2) {
      var best = 1e9;
      for (var wl = 0; wl < washLine.length; wl++) {
        var dd = Math.hypot(wx2 - washLine[wl][0], wz2 - washLine[wl][1]);
        if (dd < best) best = dd;
      }
      return best;
    }
    var tuftMats = [mat(0x5c6038, { shin: 2 }), mat(0x6b6444, { shin: 2 }), mat(0x77704c, { shin: 2 })];
    var rockMats = [mat(0x8a7a62, { shin: 4 }), mat(0x7a6a54, { shin: 4 })];
    for (var di = 0; di < 150; di++) {
      var da = dRand() * Math.PI * 2;
      var dr = 24 + Math.pow(dRand(), 0.6) * 300;
      var dx2 = Math.cos(da) * dr, dz2 = Math.sin(da) * dr;
      if (Math.abs(dz2 - 26) < 9) continue;              // the road stays drivable
      var wD = washDist(dx2, dz2);
      if (wD < 11) continue;                             // nothing grows in the channel
      if (dr < 92 && dRand() < 0.8) continue;            // the playa is bare clay
      // scrub crowds the wash banks where the water was
      if (wD > 60 && dRand() < 0.34) continue;
      if (dRand() < 0.7) {
        var tuftG = new THREE.Group();
        var tm = tuftMats[Math.floor(dRand() * 3)];
        var t1 = new THREE.Mesh(new THREE.ConeGeometry(0.5 + dRand() * 0.8, 0.8 + dRand() * 1.0, 6), tm);
        t1.position.y = 0.4;
        tuftG.add(t1);
        var t2 = new THREE.Mesh(new THREE.ConeGeometry(0.3 + dRand() * 0.4, 0.5 + dRand() * 0.6, 5), tm);
        t2.position.set(0.4 + dRand() * 0.3, 0.28, (dRand() - 0.5) * 0.6);
        tuftG.add(t2);
        tuftG.position.set(dx2, 0, dz2);
        tuftG.rotation.y = dRand() * 3;
        var ts2 = 0.8 + dRand() * 0.5;
        tuftG.scale.set(ts2, ts2, ts2);
        dressG.add(tuftG);
      } else {
        var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + dRand() * 1.1, 0),
          rockMats[Math.floor(dRand() * 2)]);
        rock.position.set(dx2, 0.3, dz2);
        rock.rotation.set(dRand() * 3, dRand() * 3, dRand() * 3);
        rock.scale.y = 0.55;
        dressG.add(rock);
      }
    }
    // a few proper outcrops in the middle distance — anchors for the aerial eye
    for (var oc = 0; oc < 5; oc++) {
      var oa = dRand() * Math.PI * 2;
      var od = 180 + dRand() * 240;
      var ox2 = Math.cos(oa) * od, oz2 = Math.sin(oa) * od;
      if (Math.abs(oz2 - 26) < 16 || washDist(ox2, oz2) < 24) continue;
      var outG = new THREE.Group();
      for (var ob = 0; ob < 4; ob++) {
        var slabR = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6 + dRand() * 2.6, 0),
          rockMats[ob % 2]);
        slabR.position.set((dRand() - 0.5) * 5, 0.5 + dRand() * 0.7, (dRand() - 0.5) * 5);
        slabR.rotation.set(dRand() * 3, dRand() * 3, dRand() * 3);
        slabR.scale.y = 0.4 + dRand() * 0.25;
        outG.add(slabR);
      }
      outG.position.set(ox2, 0, oz2);
      dressG.add(outG);
    }
    // survey stakes on the cardinal lines every 25 m — the aerial ruler
    [25, 50, 75, 100].forEach(function (sd) {
      [[sd, 0], [-sd, 0], [0, -sd]].forEach(function (sp) {
        var stake = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.22), mat(0xd8cfc0, { shin: 8 }));
        stake.position.set(sp[0], 0.75, sp[1]);
        dressG.add(stake);
        var flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4),
          mat(0xc94f38, { shin: 4 }));
        flag.position.set(sp[0] + 0.3, 1.3, sp[1]);
        dressG.add(flag);
      });
    });
    dressG.traverse(function (m) { if (m.isMesh) m.castShadow = true; });
    scene.add(dressG);

    // mesas — four ridge lines of true table-rock: flat caprock tops, talus slopes,
    // painted strata banding on a canvas skin, blue-shifting into the fog
    var strataCv = document.createElement('canvas');
    strataCv.width = 256; strataCv.height = 256;
    var stx = strataCv.getContext('2d');
    var stR = PG2.stream('RANGE', 'strata');
    // near-white base so the palette tint owns the hue; value does the drawing
    stx.fillStyle = '#ddd2c4';
    stx.fillRect(0, 0, 256, 256);
    // caprock: a dark decisive band at the very top (canvas top = mesa top)
    stx.fillStyle = 'rgba(74,60,50,0.5)';
    stx.fillRect(0, 0, 256, 10);
    stx.fillStyle = 'rgba(255,246,232,0.45)';
    stx.fillRect(0, 10, 256, 5);                        // sunlit ledge under the cap
    // strata bands down the cliff face
    var sy = 18;
    while (sy < 176) {
      var bh = 4 + stR() * 14;
      var dark = stR() < 0.45;
      stx.fillStyle = dark ? 'rgba(96,78,62,' + (0.14 + stR() * 0.2) + ')'
                           : 'rgba(255,244,226,' + (0.10 + stR() * 0.16) + ')';
      stx.fillRect(0, sy, 256, bh);
      if (dark && stR() < 0.6) {                        // shadowed ledge line
        stx.fillStyle = 'rgba(60,48,40,0.3)';
        stx.fillRect(0, sy, 256, 1.5);
      }
      sy += bh + stR() * 6;
    }
    // talus apron: smooth light scree fading to the desert floor
    var tg2 = stx.createLinearGradient(0, 168, 0, 256);
    tg2.addColorStop(0, 'rgba(232,220,202,0)');
    tg2.addColorStop(1, 'rgba(240,230,212,0.85)');
    stx.fillStyle = tg2;
    stx.fillRect(0, 168, 256, 88);
    // vertical erosion streaks
    stx.globalAlpha = 0.12;
    for (var es = 0; es < 60; es++) {
      stx.strokeStyle = stR() < 0.5 ? '#7a6450' : '#f0e6d4';
      stx.lineWidth = 1 + stR() * 2.5;
      var ex2 = stR() * 256;
      stx.beginPath();
      stx.moveTo(ex2, 8 + stR() * 30);
      stx.lineTo(ex2 + (stR() * 14 - 7), 140 + stR() * 90);
      stx.stroke();
    }
    stx.globalAlpha = 1;
    var mesas = [];
    var mesaR = PG2.stream('RANGE', 'mesas');
    [{ z: -900, h: 52, sp: 2200 }, { z: -1500, h: 78, sp: 3000 },
     { z: -2200, h: 108, sp: 4200 }, { z: -3050, h: 132, sp: 5800 }].forEach(function (m, mi) {
      // silhouette walk: plateau tables joined by talus saddles
      var pts = [], xw = -m.sp / 2;
      pts.push({ x: xw, h: 6 });
      while (xw < m.sp / 2 - m.sp * 0.1) {
        var run = m.sp * (0.06 + mesaR() * 0.10);
        var isMesa = mesaR() < 0.48;
        if (isMesa) {
          var th = m.h * (0.52 + mesaR() * 0.48);
          var shoulder = run * (0.16 + mesaR() * 0.1);
          xw += shoulder; pts.push({ x: xw, h: th * 0.55 });        // talus toe
          xw += shoulder * 0.4; pts.push({ x: xw, h: th });         // cliff to cap
          var topRun = run * (0.5 + mesaR() * 0.5);
          xw += topRun; pts.push({ x: xw, h: th * (0.96 + mesaR() * 0.04) });  // the table
          xw += shoulder * 0.4; pts.push({ x: xw, h: th * 0.5 });
          xw += shoulder; pts.push({ x: xw, h: m.h * (0.08 + mesaR() * 0.08) });
        } else {
          xw += run;
          pts.push({ x: xw, h: m.h * (0.06 + mesaR() * 0.16) });    // low saddle
        }
      }
      pts.push({ x: m.sp / 2, h: 6 });
      var shape = new THREE.Shape();
      shape.moveTo(pts[0].x, 0);
      pts.forEach(function (p2) { shape.lineTo(p2.x, p2.h); });
      shape.lineTo(pts[pts.length - 1].x, 0);
      shape.closePath();
      var geo = new THREE.ExtrudeGeometry(shape, { depth: 70, bevelEnabled: false });
      var mtex = new THREE.CanvasTexture(strataCv);
      mtex.wrapS = THREE.RepeatWrapping;
      mtex.wrapT = THREE.ClampToEdgeWrapping;
      mtex.encoding = THREE.sRGBEncoding;
      // ExtrudeGeometry UVs are shape coordinates: scale so v spans the ridge height
      mtex.repeat.set(1 / 620, 1 / (m.h * 1.04));
      var mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xb08258, map: mtex }));
      mesh.position.set(0, 0, m.z);
      scene.add(mesh);
      mesas.push(mesh);
    });
    // haze bands — the distance made visible: soft air pooled in front of the ridges
    var hazeCv = document.createElement('canvas');
    hazeCv.width = 16; hazeCv.height = 128;
    var hcx = hazeCv.getContext('2d');
    var hg2 = hcx.createLinearGradient(0, 0, 0, 128);
    hg2.addColorStop(0, 'rgba(255,255,255,0)');
    hg2.addColorStop(0.55, 'rgba(255,255,255,0.5)');
    hg2.addColorStop(1, 'rgba(255,255,255,0.9)');
    hcx.fillStyle = hg2;
    hcx.fillRect(0, 0, 16, 128);
    var hazeTex = new THREE.CanvasTexture(hazeCv);
    var hazeBands = [];
    [{ z: -860, h: 190 }, { z: -1950, h: 340 }].forEach(function (hb) {
      var hm = new THREE.Mesh(new THREE.PlaneGeometry(6000, hb.h),
        new THREE.MeshBasicMaterial({ map: hazeTex, color: 0xe8a97e, transparent: true,
          opacity: 0.36, depthWrite: false, fog: false }));
      hm.position.set(0, hb.h * 0.4, hb.z);
      scene.add(hm);
      hazeBands.push(hm);
    });

    // painted contact shadows — one shared radial decal grounds everything
    var ctCv = document.createElement('canvas');
    ctCv.width = ctCv.height = 128;
    var ctx3 = ctCv.getContext('2d');
    var ctg = ctx3.createRadialGradient(64, 64, 4, 64, 64, 62);
    ctg.addColorStop(0, 'rgba(28,20,12,0.5)');
    ctg.addColorStop(0.6, 'rgba(28,20,12,0.28)');
    ctg.addColorStop(1, 'rgba(28,20,12,0)');
    ctx3.fillStyle = ctg;
    ctx3.fillRect(0, 0, 128, 128);
    var ctTex = new THREE.CanvasTexture(ctCv);
    function contactShadow(r, x, z, sx) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2 * (sx || 1), r * 2),
        new THREE.MeshBasicMaterial({ map: ctTex, transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.07, z);
      return m;
    }

    // THE PAD — a real concrete apron: expansion joints, stains, stencils, a datum ring
    var padCv = document.createElement('canvas');
    padCv.width = padCv.height = 1024;
    var pcx = padCv.getContext('2d');
    var pR = PG2.stream('RANGE', 'padskin');
    pcx.fillStyle = '#c8c2b2';
    pcx.fillRect(0, 0, 1024, 1024);
    for (var pn = 0; pn < 4200; pn++) {                 // aggregate noise
      var pv = 164 + Math.floor(pR() * 56);
      pcx.fillStyle = 'rgb(' + pv + ',' + Math.round(pv * 0.985) + ',' + Math.round(pv * 0.94) + ')';
      pcx.globalAlpha = 0.10 + pR() * 0.16;
      pcx.fillRect(pR() * 1024, pR() * 1024, 1 + pR() * 2.5, 1 + pR() * 2.5);
    }
    pcx.globalAlpha = 1;
    // expansion joints: 4×4 panels, shadow line + sun-caught chamfer
    for (var pj = 1; pj < 4; pj++) {
      var jp = pj * 256;
      pcx.fillStyle = 'rgba(60,55,48,0.4)';
      pcx.fillRect(jp - 2, 0, 4, 1024);
      pcx.fillRect(0, jp - 2, 1024, 4);
      pcx.fillStyle = 'rgba(240,236,226,0.32)';
      pcx.fillRect(jp + 2, 0, 2, 1024);
      pcx.fillRect(0, jp + 2, 1024, 2);
    }
    // panel-corner wear + a few chips
    for (var pw = 0; pw < 26; pw++) {
      var wx2 = pR() * 1024, wy2 = pR() * 1024;
      var wg2 = pcx.createRadialGradient(wx2, wy2, 1, wx2, wy2, 10 + pR() * 26);
      wg2.addColorStop(0, 'rgba(92,84,70,' + (0.12 + pR() * 0.18) + ')');
      wg2.addColorStop(1, 'rgba(92,84,70,0)');
      pcx.fillStyle = wg2;
      pcx.fillRect(0, 0, 1024, 1024);
    }
    // oil bleed where the trestle stands + scorch history
    var oil = pcx.createRadialGradient(560, 480, 4, 560, 480, 90);
    oil.addColorStop(0, 'rgba(38,32,24,0.36)');
    oil.addColorStop(1, 'rgba(38,32,24,0)');
    pcx.fillStyle = oil;
    pcx.fillRect(0, 0, 1024, 1024);
    // tire scuff arcs
    pcx.strokeStyle = 'rgba(52,46,38,0.18)';
    for (var psc = 0; psc < 8; psc++) {
      pcx.lineWidth = 5 + pR() * 7;
      pcx.beginPath();
      pcx.arc(300 + pR() * 500, 640 + pR() * 300, 120 + pR() * 200, pR() * 3, pR() * 3 + 0.5 + pR() * 0.8);
      pcx.stroke();
    }
    // the Authority's paint: amber datum ring, centre cross, hazard band, stencils
    pcx.strokeStyle = 'rgba(216,158,58,0.85)';
    pcx.lineWidth = 10;
    pcx.beginPath(); pcx.arc(512, 512, 190, 0, 6.3); pcx.stroke();
    pcx.strokeStyle = 'rgba(238,234,222,0.8)';
    pcx.lineWidth = 6;
    pcx.beginPath();
    pcx.moveTo(512 - 70, 512); pcx.lineTo(512 + 70, 512);
    pcx.moveTo(512, 512 - 70); pcx.lineTo(512, 512 + 70);
    pcx.stroke();
    pcx.save();                                          // hazard chevrons, south edge
    pcx.beginPath(); pcx.rect(0, 960, 1024, 64); pcx.clip();
    for (var hz = -2; hz < 18; hz++) {
      pcx.fillStyle = hz % 2 ? 'rgba(216,158,58,0.85)' : 'rgba(40,38,34,0.8)';
      pcx.beginPath();
      pcx.moveTo(hz * 64, 1024); pcx.lineTo(hz * 64 + 64, 960);
      pcx.lineTo(hz * 64 + 128, 960); pcx.lineTo(hz * 64 + 64, 1024);
      pcx.fill();
    }
    pcx.restore();
    pcx.fillStyle = 'rgba(235,231,220,0.78)';
    pcx.font = '700 64px Menlo, monospace';
    pcx.textAlign = 'center';
    pcx.fillText('PAD A', 512, 160);
    pcx.font = '700 30px Menlo, monospace';
    pcx.fillStyle = 'rgba(235,231,220,0.5)';
    pcx.fillText('AUTHORITY SURVEY 7-41 · NO SMOKING', 512, 890);
    // painted edge AO: the slab sits IN the desert, not on it
    pcx.fillStyle = 'rgba(70,62,52,0.30)';
    pcx.fillRect(0, 0, 1024, 14); pcx.fillRect(0, 1010, 1024, 14);
    pcx.fillRect(0, 0, 14, 1024); pcx.fillRect(1010, 0, 14, 1024);
    var padTex = new THREE.CanvasTexture(padCv);
    padTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    padTex.encoding = THREE.sRGBEncoding;
    var pad = new THREE.Group();
    var padSideM = mat(0x9d978a, { shin: 3 });
    var padTopM = new THREE.MeshLambertMaterial({ map: padTex });
    var slab = new THREE.Mesh(new THREE.BoxGeometry(15, 0.6, 15),
      [padSideM, padSideM, padTopM, padSideM, padSideM, padSideM]);
    slab.position.y = 0.3;
    slab.receiveShadow = true;
    pad.add(slab);
    pad.add(contactShadow(9.6, 0, 0.4, 1.06));
    // the mast: candy-striped so the theodolites have something to argue about
    var mastCv = document.createElement('canvas');
    mastCv.width = 32; mastCv.height = 128;
    var mcx2 = mastCv.getContext('2d');
    for (var msb = 0; msb < 8; msb++) {
      mcx2.fillStyle = msb % 2 ? '#e8e2d4' : '#b03426';
      mcx2.fillRect(0, msb * 16, 32, 16);
    }
    var mastTex = new THREE.CanvasTexture(mastCv);
    mastTex.encoding = THREE.sRGBEncoding;
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 7, 8),
      new THREE.MeshLambertMaterial({ map: mastTex }));
    mast.position.set(-4.5, 3.5, -4);
    mast.castShadow = true;
    pad.add(mast);
    var mastTip = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), mat(0xd8dde2, { shin: 60 }));
    mastTip.position.set(-4.5, 7.1, -4);
    pad.add(mastTip);
    scene.add(pad);

    // pad dressing — sandbag ring, junction gear, cable runs (consumed by any real detonation)
    var padDress = new THREE.Group();
    var bagRand = PG2.stream('RANGE', 'bags');
    var bagMats = [mat(0xa89468, { shin: 3 }), mat(0x9c8a60, { shin: 3 }), mat(0xb29e74, { shin: 3 })];
    // a proper two-course ring around the instrument point
    for (var bi = 0; bi < 14; bi++) {
      var ba = (bi / 14) * Math.PI * 2;
      var bag = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.5, 0.75), bagMats[bi % 3]);
      bag.position.set(14.5 + Math.cos(ba) * 3.1, 0.26, 7.6 + Math.sin(ba) * 2.6);
      bag.rotation.y = -ba + bagRand() * 0.3;
      bag.rotation.z = (bagRand() - 0.5) * 0.08;
      padDress.add(bag);
      if (bi % 2 === 0) {
        var bag2 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.48, 0.72), bagMats[(bi + 1) % 3]);
        bag2.position.set(14.5 + Math.cos(ba + 0.22) * 3.05, 0.74, 7.6 + Math.sin(ba + 0.22) * 2.55);
        bag2.rotation.y = -ba + 0.3 + bagRand() * 0.3;
        padDress.add(bag2);
      }
    }
    padDress.add(contactShadow(4.6, 14.5, 7.6, 1.15));
    var jbox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1, 0.8), mat(0x445260, { shin: 10 }));
    jbox.position.set(14.5, 0.5, 7.4);
    padDress.add(jbox);
    var jboxLid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.9), mat(0x37424e, { shin: 16 }));
    jboxLid.position.set(14.5, 1.03, 7.4);
    padDress.add(jboxLid);
    var jlamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), mat(0xc94f38, { emissive: 0xc94f38, ei: 0.8 }));
    jlamp.position.set(14.9, 1.14, 7.4);
    padDress.add(jlamp);
    // cable runs snake across the playa — firing line, instrument line, camera line
    var cablePts = [V3(-4.5, 0.12, -3), V3(2, 0.1, 4), V3(9, 0.1, 6.4), V3(14.2, 0.12, 7.2)];
    var cable = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 20, 0.07, 5, false),
      mat(0x1d232a, { shin: 8 }));
    padDress.add(cable);
    var cable2 = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(14.6, 0.12, 7.8), V3(30, 0.1, 22), V3(52, 0.1, 44)]), 12, 0.06, 5, false),
      mat(0x1d232a, { shin: 8 }));
    padDress.add(cable2);
    var cable3 = new THREE.Mesh(                        // to the blockhouse
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
        [V3(13.9, 0.1, 7.9), V3(2, 0.09, 14), V3(-16, 0.1, 24), V3(-30, 0.1, 36), V3(-36.5, 0.12, 42.5)]), 22, 0.06, 5, false),
      mat(0x232019, { shin: 6 }));
    padDress.add(cable3);
    var cable4 = new THREE.Mesh(                        // to the camera tower
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
        [V3(14.8, 0.1, 6.9), V3(19, 0.09, -2), V3(24, 0.1, -10), V3(26.5, 0.12, -15)]), 14, 0.055, 5, false),
      mat(0x232019, { shin: 6 }));
    padDress.add(cable4);
    scene.add(padDress);

    // further out (survives the blast): wind sock, blockhouse, camera tower,
    // light poles with warm heads, and the volunteer's helmet on a post
    var farDress = new THREE.Group();
    var wsPole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 7, 8), mat(0xd8dde2, { shin: 30 }));
    wsPole.position.set(-46, 3.5, -22);
    wsPole.castShadow = true;
    farDress.add(wsPole);
    farDress.add(contactShadow(1.1, -46, -22));
    // the sock itself: segmented, half traffic-orange, half bleached — FAA by way of the Authority
    var sock = new THREE.Group();
    var sockR = [0.5, 0.42, 0.34, 0.27, 0.19];
    for (var sg3 = 0; sg3 < 4; sg3++) {
      var seg = new THREE.Mesh(new THREE.CylinderGeometry(sockR[sg3 + 1], sockR[sg3], 0.82, 8, 1, true),
        mat(sg3 % 2 ? 0xf2ede0 : 0xe8641e, { shin: 5 }));
      seg.rotation.z = -Math.PI / 2;
      seg.position.x = 0.55 + sg3 * 0.82;
      sock.add(seg);
    }
    var sockRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 5, 12), mat(0x8f9aa5, { shin: 40 }));
    sockRing.rotation.y = Math.PI / 2;
    sockRing.position.x = 0.14;
    sock.add(sockRing);
    var swivel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 8), mat(0x6a737c, { shin: 30 }));
    sock.add(swivel);
    sock.position.set(-46, 6.8, -22);
    sock.rotation.z = -1.05;
    farDress.add(sock);
    // THE BLOCKHOUSE — cast concrete, slit window, earth berms; where the brave hide
    var bhG = new THREE.Group();
    var bhCv = document.createElement('canvas');
    bhCv.width = 512; bhCv.height = 256;
    var bcx = bhCv.getContext('2d');
    bcx.fillStyle = '#a29478';
    bcx.fillRect(0, 0, 512, 256);
    var bR = PG2.stream('RANGE', 'blockhouse');
    for (var bn2 = 0; bn2 < 900; bn2++) {
      var bl2 = 135 + Math.floor(bR() * 50);
      bcx.fillStyle = 'rgb(' + bl2 + ',' + Math.round(bl2 * 0.93) + ',' + Math.round(bl2 * 0.78) + ')';
      bcx.globalAlpha = 0.12 + bR() * 0.14;
      bcx.fillRect(bR() * 512, bR() * 256, 1 + bR() * 3, 1 + bR() * 3);
    }
    bcx.globalAlpha = 1;
    for (var fb = 1; fb < 5; fb++) {                    // formwork board lines
      bcx.fillStyle = 'rgba(70,60,46,0.25)';
      bcx.fillRect(0, fb * 50, 512, 2);
    }
    bcx.fillStyle = 'rgba(24,26,30,0.95)';              // the slit, painted deep
    bcx.fillRect(96, 60, 320, 30);
    bcx.fillStyle = 'rgba(240,236,226,0.25)';
    bcx.fillRect(96, 92, 320, 3);                       // sill catch-light
    var dg2 = bcx.createLinearGradient(0, 150, 0, 256); // dust gradient at grade
    dg2.addColorStop(0, 'rgba(120,96,64,0)');
    dg2.addColorStop(1, 'rgba(120,96,64,0.5)');
    bcx.fillStyle = dg2;
    bcx.fillRect(0, 150, 512, 106);
    [70, 260, 430].forEach(function (sx2) {             // rain-streaks off the roofline
      bcx.fillStyle = 'rgba(74,64,50,0.28)';
      bcx.fillRect(sx2, 0, 4 + bR() * 5, 40 + bR() * 90);
    });
    bcx.fillStyle = 'rgba(235,231,220,0.7)';
    bcx.font = '700 26px Menlo, monospace';
    bcx.textAlign = 'left';
    bcx.fillText('OBS 1', 24, 140);
    bcx.font = '700 13px Menlo, monospace';
    bcx.fillStyle = 'rgba(216,158,58,0.75)';
    bcx.fillText('LOT 7-1148 · RATED 40 KT·M', 24, 162);
    var bhTex = new THREE.CanvasTexture(bhCv);
    bhTex.encoding = THREE.sRGBEncoding;
    var bhPlainM = mat(0x94886c, { shin: 2 });
    var bhFrontM = new THREE.MeshLambertMaterial({ map: bhTex });
    var bunker = new THREE.Mesh(new THREE.BoxGeometry(9, 2.6, 5),
      [bhPlainM, bhPlainM, bhPlainM, bhPlainM, bhFrontM, bhPlainM]);
    bunker.position.y = 1.1;
    bunker.castShadow = true;
    bhG.add(bunker);
    var bhRoof = new THREE.Mesh(new THREE.BoxGeometry(9.7, 0.45, 5.7), mat(0x86795e, { shin: 2 }));
    bhRoof.position.y = 2.6;
    bhRoof.castShadow = true;
    bhG.add(bhRoof);
    [-1, 1].forEach(function (bs) {                      // earth berms shoulder the walls
      var berm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.0, 5.4), mat(0x97835f, { shin: 2 }));
      berm.position.set(bs * 5.1, 0.6, 0);
      berm.rotation.z = bs * 0.42;
      bhG.add(berm);
    });
    var vent = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.0, 6), mat(0x5a6068, { shin: 20 }));
    vent.position.set(-2.6, 3.2, -0.8);
    bhG.add(vent);
    var whip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.045, 4.2, 5), mat(0x2e343a, { shin: 40 }));
    whip.position.set(3.6, 4.8, -1.4);
    bhG.add(whip);
    bhG.add(contactShadow(6.4, 0, 0.3, 1.5));
    bhG.position.set(-38, 0, 44);
    bhG.rotation.y = 0.3;
    farDress.add(bhG);
    // THE CAMERA TOWER — a lattice with a Fastax shack on top; film is the only witness
    var twr = new THREE.Group();
    var twrM = mat(0x7c8288, { shin: 26 });
    var twrH = 12.5, twrB = 1.45, twrT = 0.8;
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (cn) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, twrH, 0.15), twrM);
      leg.position.set(cn[0] * (twrB + twrT) / 2, twrH / 2, cn[1] * (twrB + twrT) / 2);
      leg.rotation.z = -cn[0] * Math.atan((twrB - twrT) / twrH);
      leg.rotation.x = cn[1] * Math.atan((twrB - twrT) / twrH);
      leg.castShadow = true;
      twr.add(leg);
    });
    for (var lv = 1; lv <= 3; lv++) {
      var ly = lv * twrH / 4;
      var lw = twrB - (twrB - twrT) * ly / twrH;
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(function (fc) {
        var girt = new THREE.Mesh(new THREE.BoxGeometry(fc[1] ? lw * 2 : 0.1, 0.09, fc[0] ? lw * 2 : 0.1), twrM);
        girt.position.set(fc[0] * lw, ly, fc[1] * lw);
        twr.add(girt);
      });
      [1, -1].forEach(function (dg3) {                   // X-bracing on the camera faces
        var diag = new THREE.Mesh(new THREE.BoxGeometry(lw * 2.55, 0.06, 0.06), twrM);
        diag.position.set(0, ly - twrH / 8, lw);
        diag.rotation.z = dg3 * Math.atan((twrH / 4) / (lw * 2));
        twr.add(diag);
        var diag2 = diag.clone();
        diag2.position.z = -lw;
        twr.add(diag2);
      });
    }
    var deck = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.14, 2.3), mat(0x666d74, { shin: 20 }));
    deck.position.y = twrH;
    deck.castShadow = true;
    twr.add(deck);
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(function (rl) {
      var rail = new THREE.Mesh(new THREE.BoxGeometry(rl[1] ? 2.3 : 0.06, 0.06, rl[0] ? 2.3 : 0.06), twrM);
      rail.position.set(rl[0] * 1.12, twrH + 0.95, rl[1] * 1.12);
      twr.add(rail);
    });
    var camShack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.05), mat(0xb6ad98, { shin: 6 }));
    camShack.position.set(-0.35, twrH + 0.57, 0);
    camShack.castShadow = true;
    twr.add(camShack);
    var camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 8), mat(0x1d232a, { shin: 80 }));
    camLens.rotation.x = Math.PI / 2;
    camLens.position.set(-0.35, twrH + 0.62, 0.75);
    twr.add(camLens);
    var dish = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.16, 10), mat(0xd8dde2, { shin: 40 }));
    dish.position.set(0.75, twrH + 1.35, -0.4);
    dish.rotation.x = 1.1;
    twr.add(dish);
    twr.add(contactShadow(2.3, 0, 0.2));
    twr.position.set(27, 0, -16);
    twr.rotation.y = 2.55;                               // lens aimed at the pad
    farDress.add(twr);
    // LIGHT POLES — four warm practicals ringing the pad; dusk belongs to them
    var practicals = [];
    var glowCv = document.createElement('canvas');
    glowCv.width = glowCv.height = 64;
    var gcx = glowCv.getContext('2d');
    var gg2 = gcx.createRadialGradient(32, 32, 2, 32, 32, 32);
    gg2.addColorStop(0, 'rgba(255,214,150,0.9)');
    gg2.addColorStop(0.4, 'rgba(255,190,110,0.32)');
    gg2.addColorStop(1, 'rgba(255,180,100,0)');
    gcx.fillStyle = gg2;
    gcx.fillRect(0, 0, 64, 64);
    var glowTex = new THREE.CanvasTexture(glowCv);
    [[18, -13], [-17, -15], [-21, 14], [21, 13]].forEach(function (pp) {
      var pole = new THREE.Group();
      var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 6.6, 6), mat(0x4c545c, { shin: 24 }));
      shaft.position.y = 3.3;
      shaft.castShadow = true;
      pole.add(shaft);
      var arm = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.08), mat(0x4c545c, { shin: 24 }));
      arm.position.set(0.5, 6.5, 0);
      pole.add(arm);
      var headMat = new THREE.MeshPhongMaterial({
        color: 0x3a4046, emissive: 0xffc46a, emissiveIntensity: 0, shininess: 30, flatShading: true });
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.32), headMat);
      head.position.set(1.0, 6.42, 0);
      pole.add(head);
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0 }));
      spr.position.set(1.0, 6.36, 0);
      spr.scale.set(3.4, 3.4, 1);
      pole.add(spr);
      pole.add(contactShadow(0.9, 0, 0));
      pole.position.set(pp[0], 0, pp[1]);
      pole.rotation.y = Math.atan2(pp[1], -pp[0]);       // head leans toward the pad
      farDress.add(pole);
      practicals.push({ mat: headMat, spr: spr });
    });
    // the volunteer's helmet on a post — two sizes too large, same as ever
    var post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.4, 7), mat(0x6b4a2a));
    post.position.set(-30, 1.2, 40);
    farDress.add(post);
    var helmet = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(0x7a8452, { shin: 24 }));
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
    // the corridor: a painted double-track dirt road — ruts, washboard, a scrub median
    var rdCv = document.createElement('canvas');
    rdCv.width = 1024; rdCv.height = 128;
    var rcx = rdCv.getContext('2d');
    var rdR = PG2.stream('RANGE', 'road');
    rcx.fillStyle = '#a0855e';
    rcx.fillRect(0, 0, 1024, 128);
    // soft edges blending into the desert
    [[0, 16], [112, 128]].forEach(function (ed) {
      var edg = rcx.createLinearGradient(0, ed[0], 0, ed[1]);
      edg.addColorStop(ed[0] === 0 ? 0 : 1, 'rgba(140,116,82,0.55)');
      edg.addColorStop(ed[0] === 0 ? 1 : 0, 'rgba(140,116,82,0)');
      rcx.fillStyle = edg;
      rcx.fillRect(0, ed[0], 1024, ed[1] - ed[0]);
    });
    // the two wheel tracks: compacted pale centres with dark rut shoulders
    [[26, 46], [82, 102]].forEach(function (tk2) {
      rcx.fillStyle = 'rgba(72,56,38,0.5)';
      rcx.fillRect(0, tk2[0] - 3, 1024, tk2[1] - tk2[0] + 6);
      var tg3 = rcx.createLinearGradient(0, tk2[0], 0, tk2[1]);
      tg3.addColorStop(0, 'rgba(190,166,126,0.9)');
      tg3.addColorStop(0.5, 'rgba(200,178,138,1)');
      tg3.addColorStop(1, 'rgba(184,160,120,0.9)');
      rcx.fillStyle = tg3;
      rcx.fillRect(0, tk2[0], 1024, tk2[1] - tk2[0]);
    });
    // the median: scrub tufts and stones no axle has touched
    for (var md = 0; md < 90; md++) {
      rcx.fillStyle = rdR() < 0.5 ? 'rgba(104,102,62,0.6)' : 'rgba(88,74,50,0.5)';
      rcx.beginPath();
      rcx.arc(rdR() * 1024, 56 + rdR() * 16, 1 + rdR() * 3, 0, 6.3);
      rcx.fill();
    }
    // washboard: the suspension already knows
    rcx.globalAlpha = 0.07;
    for (var wb = 0; wb < 1024; wb += 7 + Math.floor(rdR() * 8)) {
      rcx.fillStyle = '#4e3e2a';
      rcx.fillRect(wb, 18, 2, 92);
    }
    rcx.globalAlpha = 1;
    // scattered stones + dust patches
    for (var st3 = 0; st3 < 240; st3++) {
      var sl3 = 150 + Math.floor(rdR() * 60);
      rcx.fillStyle = 'rgb(' + sl3 + ',' + Math.round(sl3 * 0.9) + ',' + Math.round(sl3 * 0.74) + ')';
      rcx.globalAlpha = 0.14 + rdR() * 0.2;
      rcx.beginPath();
      rcx.arc(rdR() * 1024, rdR() * 128, 0.6 + rdR() * 1.8, 0, 6.3);
      rcx.fill();
    }
    rcx.globalAlpha = 1;
    var roadTex = new THREE.CanvasTexture(rdCv);
    roadTex.wrapS = THREE.RepeatWrapping;
    roadTex.wrapT = THREE.ClampToEdgeWrapping;
    roadTex.repeat.set(14, 1);
    roadTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    roadTex.encoding = THREE.sRGBEncoding;
    var road = new THREE.Mesh(new THREE.PlaneGeometry(620, 7.5),
      new THREE.MeshLambertMaterial({ map: roadTex }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(-100, 0.14, 26);
    road.receiveShadow = true;
    convoyG.add(road);
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

    // heat shimmer bands + a low near-ground mirage layer over the pan —
    // streaked alpha so the air tears horizontally instead of glowing flatly
    var shimCv = document.createElement('canvas');
    shimCv.width = 256; shimCv.height = 64;
    var shx = shimCv.getContext('2d');
    var shR = PG2.stream('RANGE', 'shimmer');
    for (var sl2 = 0; sl2 < 46; sl2++) {
      var sy2 = shR() * 64, sw2 = 30 + shR() * 160, sxx = shR() * 256;
      var slg = shx.createLinearGradient(sxx - sw2 / 2, 0, sxx + sw2 / 2, 0);
      slg.addColorStop(0, 'rgba(255,255,255,0)');
      slg.addColorStop(0.5, 'rgba(255,255,255,' + (0.25 + shR() * 0.5) + ')');
      slg.addColorStop(1, 'rgba(255,255,255,0)');
      shx.fillStyle = slg;
      shx.fillRect(sxx - sw2 / 2, sy2, sw2, 1.5 + shR() * 2.5);
    }
    var shimTex = new THREE.CanvasTexture(shimCv);
    shimTex.wrapS = THREE.RepeatWrapping;
    var shimmer = [];
    for (var si = 0; si < 3; si++) {
      var smTex = shimTex.clone();
      smTex.needsUpdate = true;
      smTex.repeat.set(4 + si, 1);
      var sm = new THREE.Mesh(new THREE.PlaneGeometry(2400, 14 + si * 9),
        new THREE.MeshBasicMaterial({ map: smTex, color: 0xfff4dc, transparent: true,
          opacity: 0.05, depthWrite: false }));
      sm.position.set(0, 9 + si * 12, -420 - si * 260);
      scene.add(sm);
      shimmer.push(sm);
    }
    var nsTex = shimTex.clone();
    nsTex.needsUpdate = true;
    nsTex.repeat.set(2, 1);
    var nearShimmer = new THREE.Mesh(new THREE.PlaneGeometry(420, 5),
      new THREE.MeshBasicMaterial({ map: nsTex, color: 0xfff4dc, transparent: true,
        opacity: 0.06, depthWrite: false }));
    nearShimmer.position.set(0, 2.4, 70);
    scene.add(nearShimmer);

    return {
      scene: scene, camera: camera, pad: pad, padDress: padDress, farDress: farDress,
      sock: sock, rabbit: rabbit, deviceHolder: deviceHolder,
      truck: truck, truckWheels: truckWheels, escort: escort, escortWheels: escortWheels,
      convoyG: convoyG, truckShadow: truckShadow, escortShadow: escortShadow,
      dustPool: dustPool,
      hemi: hemi, sun: sun, terrain: terrain, terrainMacro: terrainMacro,
      skyDome: skyDome, sunSpr: sunSpr, cloudG: cloudG,
      mesas: mesas, hazeBands: hazeBands, practicals: practicals,
      shimmer: shimmer, nearShimmer: nearShimmer, shimmerBase: 1,
      fx: null, shake: 0, convoyShake: 0, mode: 'idle', palette: null
    };
  }

  /* ================= RECON 2 — THE AERIAL RIG =================
     45° overhead, touch to fly: one finger orbits and tilts the range,
     pinch zooms, a tap during the survey drops a measuring stake. */
  var aerial = { on: false, theta: 0.75, radius: 95, tx: 0, tz: 0, marks: [], savedFov: 7, savedStation: '' };
  var surveyHold = null;
  function aerialAllowed() {
    return !!range && ['station', 'counting', 'crater'].indexOf(S.phase) >= 0;
  }
  function gzPoint() {
    var ox = S.result && S.result.visual ? (S.result.visual.offsetM || 0) : 0;
    return { x: ox, z: 0 };
  }
  function setAerial(on) {
    if (on === aerial.on) return;
    aerial.on = on;
    var cam = range.camera;
    var btn = $('btn-cam');
    if (on) {
      var gz = gzPoint();
      aerial.tx = gz.x; aerial.tz = gz.z;
      aerial.theta = 0.75;
      aerial.savedFov = cam.fov;
      aerial.savedStation = $('cam-station').textContent;
      cam.fov = 38;
      cam.updateProjectionMatrix();
      var r0 = 230, r1 = S.phase === 'crater' ? 68 : 110;
      aerial.radius = r0;
      tween(750, function (e) { aerial.radius = lerp(r0, r1, e); });   // the recon plane banks in
      btn.classList.add('aerial');
      btn.innerHTML = '📷 STATION 7<span class="bc-sub">BACK TO THE LONG LENS</span>';
      PGAudio.radioBlip();
    } else {
      cam.fov = aerial.savedFov;
      cam.updateProjectionMatrix();
      $('cam-station').textContent = aerial.savedStation || (PG2.CAMERA.id + ' — ' + PG2.CAMERA.km.toFixed(1) + ' KM');
      // hand the camera back to whoever owned it
      if (S.phase === 'crater') {
        // the survey orbit (stepMeasure) or the parked survey cam picks it back up
      } else {
        cam.position.set(60, 14, 1600);
        cam.lookAt(S.rndTarget === 'array' && S.mode === 'rnd' ? 18 : 6, 3, 0);
      }
      btn.classList.remove('aerial');
      btn.innerHTML = '✈ RECON 2<span class="bc-sub">OVERHEAD · TOUCH TO FLY</span>';
    }
  }
  function applyAerialCam() {
    if (!aerial.on || !range) return;
    var cam = range.camera;
    var h = aerial.radius * 0.707;                    // 45° up, 45° out
    cam.position.set(
      aerial.tx + Math.sin(aerial.theta) * aerial.radius * 0.707,
      Math.max(h, 8),
      aerial.tz + Math.cos(aerial.theta) * aerial.radius * 0.707);
    cam.lookAt(aerial.tx, 0.6, aerial.tz);
    $('cam-station').textContent = 'RECON 2 · ALT ' + Math.round(h) + ' M';
  }
  /* touch: fly it like you mean it */
  (function () {
    var pts = {};
    var cv = $('gl');
    function gate() { return aerial.on && aerialAllowed(); }
    cv.addEventListener('pointerdown', function (e) {
      if (!gate()) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() };
    });
    cv.addEventListener('pointermove', function (e) {
      if (!gate() || !pts[e.pointerId]) return;
      var p = pts[e.pointerId];
      var ids = Object.keys(pts);
      if (ids.length === 1) {
        aerial.theta -= (e.clientX - p.x) * 0.0062;
        aerial.radius = clamp(aerial.radius + (e.clientY - p.y) * 0.45, 26, 320);
      } else if (ids.length === 2) {
        var o = pts[ids[0] === String(e.pointerId) ? ids[1] : ids[0]];
        var d0 = Math.hypot(p.x - o.x, p.y - o.y);
        p.x = e.clientX; p.y = e.clientY;
        var d1 = Math.hypot(p.x - o.x, p.y - o.y);
        if (d0 > 0 && d1 > 0) aerial.radius = clamp(aerial.radius * d0 / d1, 26, 320);
        return;
      }
      p.x = e.clientX; p.y = e.clientY;
    });
    function up(e) {
      if (!pts[e.pointerId]) return;
      var p = pts[e.pointerId];
      var moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
      var dt = performance.now() - p.t0;
      delete pts[e.pointerId];
      if (!gate()) return;
      // a stationary press is a tap — clocks lie under load, fingers don't move
      if (moved < 12 && S.phase === 'crater') tapMeasure(e);
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  })();
  /* a tap drops a survey stake: range from ground zero, plotted live */
  var _mPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);
  var _mHit = new THREE.Vector3();
  function tapMeasure(e) {
    var cam = range.camera;
    var ndc = new THREE.Vector2((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1);
    raycaster.setFromCamera(ndc, cam);
    if (!raycaster.ray.intersectPlane(_mPlane, _mHit)) return;
    var gz = gzPoint();
    var d = Math.hypot(_mHit.x - gz.x, _mHit.z - gz.z);
    aerial.marks.push({ x: _mHit.x, z: _mHit.z, d: d });
    if (aerial.marks.length > 3) aerial.marks.shift();
    PGAudio.measureTick();
    ensureMarksSvg();
  }
  function ensureMarksSvg() {
    var svg = $('measure-svg');
    if (svg.classList.contains('hidden')) {          // R&D survey has no tape — marks only
      svg.classList.remove('hidden');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.style.width = W + 'px'; svg.style.height = H + 'px';
      svg.style.left = '0'; svg.style.top = '0'; svg.style.transform = 'none';
      svg.innerHTML = '<g id="msr-marks"></g>';
    } else if (!svg.querySelector('#msr-marks')) {
      var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', 'msr-marks');
      svg.appendChild(g);
    }
  }
  function drawMarks() {
    var g = document.querySelector('#msr-marks');
    if (!g) return;
    if (!aerial.marks.length) { g.innerHTML = ''; return; }
    var cam = range.camera;
    var gz = gzPoint();
    var p0 = worldToScreen(V3(gz.x, 0.7, gz.z), cam);
    var out = '';
    aerial.marks.forEach(function (m) {
      var p1 = worldToScreen(V3(m.x, 0.7, m.z), cam);
      out += '<line class="msr-mark" x1="' + p0.x + '" y1="' + p0.y + '" x2="' + p1.x + '" y2="' + p1.y + '" stroke-dasharray="5 4"/>' +
        '<circle class="msr-mark" cx="' + p1.x + '" cy="' + p1.y + '" r="4" fill="none"/>' +
        '<text class="msr-mark-txt" x="' + (p1.x + 8) + '" y="' + (p1.y - 8) + '">' + m.d.toFixed(0) + ' m</text>';
    });
    g.innerHTML = out;
  }
  /* the survey files when YOU say so — if you're flying, it waits */
  function advanceOrHold(fn) {
    if (aerial.on) {
      surveyHold = fn;
      $('btn-survey').classList.remove('hidden');
    } else fn();
  }
  $('btn-survey').addEventListener('click', function () {
    PGAudio.tap();
    var fn = surveyHold;
    surveyHold = null;
    $('btn-survey').classList.add('hidden');
    aerial.marks = [];
    setAerial(false);
    if (fn) fn();
  });
  $('btn-cam').addEventListener('click', function () {
    PGAudio.tap();
    setAerial(!aerial.on);
  });
  function aerialReset() {
    aerial.on = false;
    aerial.marks = [];
    surveyHold = null;
    $('btn-cam').classList.remove('aerial');
    $('btn-cam').innerHTML = '✈ RECON 2<span class="bc-sub">OVERHEAD · TOUCH TO FLY</span>';
    $('btn-cam').classList.add('hidden');
    $('btn-survey').classList.add('hidden');
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
    aerialReset();
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
    if (a.gyro) { var gy = buildGyro(); gy.position.set(-d.L * 0.18, 0.04, -d.r - 0.02); gy.rotation.x = Math.PI / 2; g.add(gy); }
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
    c.width = c.height = 256;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(128, 128, 12, 128, 128, 124);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
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
      // the detonation owns the light for a second and a half — terrain,
      // pad dressing and target objects all take the flare
      var burst = new THREE.PointLight(0xffd9a6, 0, 620, 1.6);
      burst.position.set(0, 10, 0);
      fxGroup.add(burst);
      fx.light = burst;
      // ember arcs: hot metal on ballistic paper-math trajectories
      fx.embers = [];
      var eRand = PG2.stream(S.seed, 'embers');
      var nE = 10 + Math.round(vis.dust * 8);
      for (var ei = 0; ei < nE; ei++) {
        var em = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tx.fire, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        em.material.color.setRGB(1, 0.75, 0.4);
        var ea = eRand() * Math.PI * 2;
        var ev = 14 + eRand() * 26;
        em.userData = {
          vx: Math.cos(ea) * ev * (0.4 + eRand() * 0.6),
          vy: 16 + eRand() * 22,
          vz: Math.sin(ea) * ev * (0.4 + eRand() * 0.6),
          delay: eRand() * 0.14, dead: false
        };
        em.position.set(0, 2.5, 0);
        em.scale.set(1.6, 1.6, 1);
        fxGroup.add(em);
        fx.embers.push(em);
      }
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
      var pts = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x3c2f22, size: 3.0, sizeAttenuation: true,
        map: fxTextures().dust, transparent: true, depthWrite: false, opacity: 0.9 }));   // soft specks, not hard squares
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
    if (fx.light) {
      // flare hard, decay to ember red, gone by a second and a half
      var lk = clamp(t / 1.5, 0, 1);
      fx.light.intensity = Math.pow(1 - lk, 1.7) * (26 + fx.vis.dust * 30);
      fx.light.color.setRGB(1, lerp(0.85, 0.4, lk), lerp(0.65, 0.16, lk));
    }
    if (fx.embers) {
      fx.embers.forEach(function (em) {
        var u = em.userData;
        if (u.dead) return;
        var tt = t - u.delay;
        if (tt <= 0) return;
        em.position.x += u.vx * dt;
        em.position.z += u.vz * dt;
        u.vy -= 30 * dt;                      // invented gravity, honest arc
        em.position.y += u.vy * dt;
        em.material.opacity = clamp(1.2 - tt * 0.5, 0, 1);
        var es = Math.max(1.7 - tt * 0.55, 0.5);
        em.scale.set(es, es, 1);
        if (em.position.y <= 0.4) {           // it lands, it dies, the dust remembers
          u.dead = true;
          em.visible = false;
          spawnDust(em.position.x, 0.6, em.position.z, false);
        }
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
  function buildCraterGroup(r, ell, ox) {
    var g = new THREE.Group();
    // scorch decal with ejecta rays — the blast writes its own sunburst
    var sc = document.createElement('canvas');
    sc.width = sc.height = 512;
    var sx = sc.getContext('2d');
    var rayR = PG2.stream(S.seed, 'rays');
    // ejecta rays first, under the scorch: pale thrown undersoil + dark char
    for (var ry = 0; ry < 18; ry++) {
      var ra = rayR() * Math.PI * 2;
      var rl = 110 + rayR() * 110;                  // ray length in px (256 = full)
      var rw2 = 3 + rayR() * 8;                     // half-width at the far end
      var pale = rayR() > 0.45;
      sx.save();
      sx.translate(256, 256);
      sx.rotate(ra);
      var rg2 = sx.createLinearGradient(0, 0, rl, 0);
      if (pale) { rg2.addColorStop(0, 'rgba(146,114,72,0.34)'); rg2.addColorStop(0.8, 'rgba(150,122,84,0.14)'); rg2.addColorStop(1, 'rgba(150,122,84,0)'); }
      else { rg2.addColorStop(0, 'rgba(40,28,16,0.42)'); rg2.addColorStop(0.75, 'rgba(52,38,22,0.14)'); rg2.addColorStop(1, 'rgba(52,38,22,0)'); }
      sx.fillStyle = rg2;
      sx.beginPath();
      sx.moveTo(30, 0);
      sx.lineTo(rl, -rw2);
      sx.lineTo(rl + rw2 * 1.4, 0);
      sx.lineTo(rl, rw2);
      sx.closePath();
      sx.fill();
      sx.restore();
    }
    var sg = sx.createRadialGradient(256, 256, 24, 256, 256, 256);
    sg.addColorStop(0, 'rgba(24,17,11,0.96)');
    sg.addColorStop(0.34, 'rgba(52,37,23,0.82)');
    sg.addColorStop(0.62, 'rgba(88,64,40,0.32)');
    sg.addColorStop(1, 'rgba(92,68,42,0)');
    sx.fillStyle = sg;
    sx.fillRect(0, 0, 512, 512);
    var stx = new THREE.CanvasTexture(sc);
    stx.encoding = THREE.sRGBEncoding;
    var scorch = new THREE.Mesh(new THREE.PlaneGeometry(r * 4.6, r * 4.6),
      new THREE.MeshBasicMaterial({ map: stx, transparent: true, depthWrite: false }));
    scorch.rotation.x = -Math.PI / 2;
    scorch.scale.x = ell;
    scorch.position.y = 0.42;
    g.add(scorch);
    // fused glass at the hypocentre — dark, slick, faintly proud of itself
    var glassD = new THREE.Mesh(new THREE.CircleGeometry(r * 0.42, 20),
      new THREE.MeshPhongMaterial({ color: 0x0c0e12, specular: new THREE.Color(0x7d8ba0), shininess: 90 }));
    glassD.rotation.x = -Math.PI / 2;
    glassD.scale.x = ell;
    glassD.position.y = 0.515;
    g.add(glassD);
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
    // layered thrown rim: a charred inner lip inside the raised earth berm
    var rimIn = new THREE.Mesh(new THREE.TorusGeometry(r * 0.97, r * 0.09, 7, 36),
      new THREE.MeshLambertMaterial({ color: 0x3d2c1a }));
    rimIn.rotation.x = Math.PI / 2;
    rimIn.position.y = 0.53;
    rimIn.scale.set(ell, 1, 0.34);
    g.add(rimIn);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.08, r * 0.13, 8, 36),
      new THREE.MeshLambertMaterial({ color: 0x63482c }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.55;
    rim.scale.set(ell, 1, 0.3);
    g.add(rim);
    // rim debris — clumped where the berm broke, thinning with distance
    var chunkRand = PG2.stream(S.seed, 'chunks');
    for (var cl = 0; cl < 6; cl++) {
      var clAng = chunkRand() * Math.PI * 2;
      var clDist = r * (1.1 + chunkRand() * 0.35);
      var clN = 2 + Math.floor(chunkRand() * 2);
      for (var cj = 0; cj < clN; cj++) {
        var cs0 = r * (0.035 + chunkRand() * 0.06);
        var jx = Math.cos(clAng) * clDist * ell + (chunkRand() - 0.5) * r * 0.34;
        var jz = Math.sin(clAng) * clDist + (chunkRand() - 0.5) * r * 0.34;
        var clod = new THREE.Mesh(cj % 2 ? new THREE.DodecahedronGeometry(cs0, 0) : new THREE.BoxGeometry(cs0 * 2, cs0, cs0 * 1.5),
          mat(chunkRand() > 0.6 ? 0x584022 : 0x6e5233, { shin: 2 }));
        clod.position.set(jx, 0.5 + cs0 / 2, jz);
        clod.rotation.set(chunkRand() * 3, chunkRand() * 3, chunkRand() * 3);
        g.add(clod);
      }
    }
    // far-flung singles riding the ejecta rays
    for (var ci = 0; ci < 7; ci++) {
      var ang = chunkRand() * Math.PI * 2;
      var dist = r * (1.5 + chunkRand() * 1.5);
      var cs = r * (0.025 + chunkRand() * 0.045);
      var chunk = new THREE.Mesh(new THREE.BoxGeometry(cs * 2, cs, cs * 1.4), mat(0x6e5233, { shin: 2 }));
      chunk.position.set(Math.cos(ang) * dist * ell, 0.5 + cs / 2, Math.sin(ang) * dist);
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
    // BLAST SURVEY CONTOURS — the premium part of the paperwork: scorch and
    // overpressure radii drawn on the dirt, staggered in like a plotter working
    g.userData.surveyRings = [];
    [{ mult: 2.2, color: 0xe5a13d, op: 0.34, key: 'SCORCH' },
     { mult: 4.2, color: 0x9cc8ea, op: 0.26, key: 'OVERPRESSURE' }].forEach(function (rc, ri) {
      var RR = r * rc.mult;
      var ring = new THREE.Mesh(new THREE.RingGeometry(RR * 0.985, RR, 72),
        new THREE.MeshBasicMaterial({ color: rc.color, transparent: true, opacity: 0,
          side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.scale.x = ell;
      ring.position.y = 0.44;
      ring.userData.radiusM = RR;
      ring.userData.key = rc.key;
      g.add(ring);
      g.userData.surveyRings.push(ring);
      tween(900 + ri * 500, function (e) { ring.material.opacity = rc.op * e; });
    });
    g.position.x = ox;                           // crater centre follows the load's lean
    return g;
  }
  function craterReveal() {
    S.phase = 'crater';
    var crater = S.result.outcome.craterActual || 0;
    var r = Math.max(crater / 2, 1.6);
    var ell = S.result.visual.ellipse || 1;      // the crater follows the load
    var ox = S.result.visual.offsetM || 0;       // negative = west
    if (range.craterG) range.scene.remove(range.craterG);
    range.craterG = buildCraterGroup(r, ell, ox);
    range.scene.add(range.craterG);
    // low push-in, then a slow survey orbit while the tape runs
    var c = range.camera;
    c.fov = 24;
    c.updateProjectionMatrix();
    var from = V3(ox + r * 6.4, r * 2.6, r * 8.4);
    var to = V3(ox + r * 3.3, r * 1.35, r * 4.4);
    setCaption('SURVEY PASS · PAD A', S.result.outcome.fired ? 'The dust votes last. Measuring…' : 'There is a device-shaped silence on the pad.');
    tween(3800, function (t) {
      if (aerial.on) return;                        // the recon plane has the stick
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
      '<text id="msr-ring0" text-anchor="middle" font-size="9" opacity="0"></text>' +
      '<text id="msr-ring1" text-anchor="middle" font-size="9" opacity="0"></text>' +
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
        offtxt: svg.querySelector('#msr-offtxt'), band: svg.querySelector('#msr-band'),
        rings: [svg.querySelector('#msr-ring0'), svg.querySelector('#msr-ring1')]
      }
    };
  }
  function stepMeasure(now, dt) {
    if (!msr.active) return;
    var cam = range.camera;
    // the aftermath walk-around: a patient half-orbit while the survey runs
    // (unless the recon plane has the stick)
    if (!aerial.on) {
      msr.ang += dt * 0.055;
      cam.position.set(msr.ox + Math.sin(msr.ang) * msr.orbR, msr.orbY, Math.cos(msr.ang) * msr.orbR);
      cam.lookAt(msr.ox, 0.6, 0);
    }
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
    // the survey contours label themselves once drawn — glued to their rings
    if (range.craterG && range.craterG.userData.surveyRings) {
      range.craterG.userData.surveyRings.forEach(function (ring, ri) {
        var lt = el.rings[ri];
        if (!lt || ring.material.opacity <= 0.02) return;
        var pR = worldToScreen(V3(msr.ox, 0.7, ring.userData.radiusM), cam);
        lt.setAttribute('x', pR.x);
        lt.setAttribute('y', pR.y - 4);
        lt.setAttribute('opacity', String(Math.min(ring.material.opacity * 2.4, 0.85)));
        lt.textContent = ring.userData.key + ' R ' + ring.userData.radiusM.toFixed(0) + ' m';
      });
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
      later(3400, function () { advanceOrHold(showScore); });   // the walk-around continues — unless you're flying
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
    if (S.mode === 'rnd') {
      if (S.result.outcome.fired) rndSurvey();
      else showRndScore();
      return;
    }
    if (S.result.outcome.fired) craterReveal();
    else showScore();
  }

  /* ================= SCORECARD ================= */
  function showScore() {
    clearLater();
    S.phase = 'score';
    msr.active = false;
    aerialReset();
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
    var firstWin = r.win && !rec.won;   // the development award banks ONCE per contract
    rec.stars = Math.max(rec.stars, r.stars);
    rec.net = rec.net == null ? r.payout.net : Math.max(rec.net, r.payout.net);
    if (r.win) {
      rec.won = true;
      if (rec.wonOn == null) rec.wonOn = S.attempt;
    }
    if (firstWin) {
      SAVE.cash += r.payout.net;
      SAVE.banked[R.id] = r.payout.net;
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
          (firstWin ? '<tr><td>BANKED — COMPANY ACCOUNT</td><td>' + fmt$(SAVE.cash) + '</td></tr>' : '') +
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
          '<button id="btn-score-hq" type="button">THE COMPOUND</button>' +
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
    $('btn-score-hq').addEventListener('click', function () { PGAudio.tap(); showHQ(); });
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

    if (S.phase === 'lsterm') { if (lsTerm) lsTermStep(dt, now); return; }
    if (lsBench && lsBench.active) { lsBenchStep(dt, now); return; }   // the live 3D build bench
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
      // 2am housekeeping: dust drifts through the key light, the lamps breathe
      if (bay.dust) for (var bi = 0; bi < bay.dust.length; bi++) {
        var mote = bay.dust[bi], mu = mote.userData;
        mote.position.y -= mu.vy * dt;
        mote.position.x += Math.sin(now * 0.0005 + mu.p) * 0.05 * dt;
        mote.position.z += Math.cos(now * 0.0004 + mu.p * 1.7) * 0.05 * dt;
        if (mote.position.y < 0.55) mote.position.y = 3.5;
      }
      if (bay.lamps) for (var bl = 0; bl < bay.lamps.length; bl++) {
        var lp = bay.lamps[bl];
        lp.light.intensity = lp.base * (0.93 + 0.05 * Math.sin(now * 0.0021 + lp.p) + 0.02 * Math.sin(now * 0.013 + lp.p * 3));
        lp.g.rotation.x = Math.sin(now * 0.00037 + lp.p) * 0.012;
        lp.g.rotation.z = Math.cos(now * 0.00031 + lp.p) * 0.012;
      }
      renderer.toneMappingExposure = 1.72;    // the bay runs a brighter filmic exposure — lift the room out of the murk
      renderScene(bay.scene, bay.camera);
      renderer.toneMappingExposure = 1.45;    // restore for the range / terminal
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
      // RECON 2: the aerial rig owns the camera when it's on
      $('btn-cam').classList.toggle('hidden', !aerialAllowed());
      applyAerialCam();
      if (S.phase === 'crater') stepMeasure(now, dt);
      if (S.phase === 'crater' && aerial.marks.length) drawMarks();
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
      renderScene(range.scene, range.camera);
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
          S.mode = 'contract';
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
    else if (boardReturn === 'scr-hq') { showHQ(); }
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
    else if (museumReturn === 'scr-hq') { showHQ(); }
    else { S.phase = 'title'; showScreen('scr-title'); }
  });

  $('btn-start').addEventListener('click', function () {
    PGAudio.init(); PGAudio.tap();
    S.world = 'sandbox';   // pure sandbox: no contracts, no money — just build the rocket and fire it
    showHQ();
  });
  $('btn-sandbox').addEventListener('click', function () {
    PGAudio.init(); PGAudio.tap();
    S.world = 'sandbox';
    showHQ();
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
    $('btn-start').innerHTML = 'BUILD A ROCKET<span class="start-sub">THE LONG SHOT PROGRAM · SANDBOX · NO LIMITS</span>';
    $('title-progress').classList.add('hidden');
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
    if (S.mode === 'rnd') { openTargetPicker(); return; }   // the button stays for a change of heart
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
  $('btn-refire').addEventListener('click', function () {
    PGAudio.tap();
    if (S.mode === 'rnd') { openTargetPicker(); return; }
    enterRange();
  });
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

  /* ================= M3b — THE WORKSHOP =================
     The HQ compound, Weapons Assembly (free R&D), the target range,
     Type Certification, and the production bid board. */

  /* ---------- THE HQ: the compound is the main menu ---------- */
  var hqTimer = null;
  function stopHqTimer() { if (hqTimer) { clearInterval(hqTimer); hqTimer = null; } }
  function runRemainMs() {
    return WS().run ? Math.max(0, WS().run.t0 + WS().run.durMs - Date.now()) : 0;
  }
  function typeByPlate(plate) {
    for (var i = 0; i < WS().types.length; i++) if (WS().types[i].plate === plate) return WS().types[i];
    return null;
  }
  function showHQ() {
    stopHqTimer();
    S.phase = 'hq';
    S.mode = 'contract';
    showUI(null);
    reclaimRefined();
    var sandbox = S.world === 'sandbox';
    $('hq-cash').textContent = 'COMPANY ACCOUNT · ' + cashLabel();
    document.querySelector('.hq-brand').innerHTML = 'REDSKY INC · THE COMPOUND' +
      (sandbox ? '<span class="hq-world-badge">SANDBOX LOT</span>' : '');
    var wins = wonCountAll();
    var doors = $('hq-doors');
    var nextC = null;
    for (var ci = 0; ci < PG2.CONTRACTS.length; ci++) {
      if (contractUnlocked(ci) && !contractRec(ci).won) { nextC = PG2.CONTRACTS[ci]; break; }
    }
    function door(id, kicker, name, sub, cls, badge) {
      return '<button type="button" class="hq-door ' + (cls || '') + '" id="' + id + '">' +
        (badge || '') + '<span class="hd-kicker">' + kicker + '</span>' +
        '<div class="hd-name">' + name + '</div><div class="hd-sub">' + sub + '</div></button>';
    }
    var waLocked = !sandbox && wins === 0;   // the sandbox lot never checks your paperwork
    var waBooked = !!WS().run;
    var longshotDoor = door('hq-longshot', 'THE PROGRAM', 'THE LONG SHOT PROGRAM',
      'Build the rocket on the 3D bench, plan the flight by hand, then ride it down and watch it level a real target — from a grenade pop to a thermonuclear mushroom. 1 to 5,000 miles.',
      'primary', '<span class="hd-badge">1–5000 MI</span>');
    var assemblyDoor = door('hq-assembly', 'THE BIG SHED', 'SHELL TEST BAY',
      waLocked ? 'Free R&D — build anything on your own dime. The Authority wants one won contract on file first.'
        : waBooked ? 'The floor is tooled up and running an order. R&D resumes on delivery.'
        : (sandbox ? 'The old workshop — hand-build a shell and drop-test it on the range. A sandbox toy. ' : 'Free R&D on the company dime. No spec sheet over your shoulder. ') +
          (WS().bench ? 'Your bench is as you left it.' : 'The bench is clean.'),
      waLocked || waBooked ? 'locked' : '',
      waBooked ? '<span class="hd-badge warn">BOOKED</span>' : waLocked ? '<span class="hd-badge warn">CLEARANCE</span>' : '');
    var list = [];
    if (sandbox) {
      list.push(longshotDoor, assemblyDoor);          // pure sandbox: the rocket program, and the shell bay as a toy
    } else {
      list.push(door('hq-office', 'THE FRONT DOOR', 'CONTRACT OFFICE',
        wins >= PG2.CONTRACTS.length ? 'Act I complete. The corkboard is a trophy wall.'
          : nextC ? 'Next up: ' + nextC.id + ' “' + nextC.title + '”. The corkboard awaits.'
          : 'The corkboard awaits.', wins === 0 ? 'primary' : '', ''));
      list.push(assemblyDoor);
      list.push(door('hq-bids', 'THE BACK OFFICE', 'PRODUCTION BID BOARD',
        WS().types.length ? WS().types.length + ' certified type' + (WS().types.length > 1 ? 's' : '') + ' on file. Buyers post weekly.'
          : 'Certified types only. Prototype in the shed, pass the standards series, then sell it.',
        WS().types.length ? '' : 'locked', WS().types.length ? '' : '<span class="hd-badge warn">NO TYPES</span>'));
      list.push(longshotDoor);
      list.push(door('hq-museum', 'THE LONG HALL', 'THE MUSEUM', 'Framed disasters, brass firsts, best-crater plaques.', '', ''));
    }
    doors.innerHTML = list.join('') + '<button id="hq-gate" type="button">' + (sandbox ? '← MAIN MENU' : '← THE GATE · CHANGE MODE') + '</button>';
    $('hq-longshot').addEventListener('click', function () {
      PGAudio.init();
      if (waLocked) { PGAudio.buzz(); toast('Win one contract first — the Program vets its contractors.'); return; }
      PGAudio.tap(); stopHqTimer(); showLongShot();
    });
    $('hq-gate').addEventListener('click', function () {
      PGAudio.tap(); stopHqTimer();
      S.phase = 'title';
      refreshTitle();
      showScreen('scr-title');
    });
    if (!sandbox) $('hq-office').addEventListener('click', function () { PGAudio.init(); PGAudio.tap(); stopHqTimer(); showBoard('scr-hq'); });
    $('hq-assembly').addEventListener('click', function () {
      PGAudio.init();
      if (waLocked) { PGAudio.buzz(); toast('Win one contract first. The Authority funds hobbies it has vetted.'); return; }
      if (WS().run) { PGAudio.buzz(); toast('The workshop is booked — ' + WS().run.plate + ' for ' + WS().run.buyer + '. R&D resumes on delivery.'); return; }
      PGAudio.tap(); stopHqTimer(); enterRnd();
    });
    if ($('hq-bids')) $('hq-bids').addEventListener('click', function () {
      PGAudio.init();
      if (!WS().types.length) { PGAudio.buzz(); toast('No certified types on file. The bid board only trades in stamped plates.'); return; }
      PGAudio.tap(); stopHqTimer(); showBids();
    });
    if ($('hq-museum')) $('hq-museum').addEventListener('click', function () { PGAudio.init(); PGAudio.tap(); stopHqTimer(); showMuseum('scr-hq'); });
    refreshRunTicker();
    showScreen('scr-hq');
    hqTimer = setInterval(refreshRunTicker, 1000);
  }
  function refreshRunTicker() {
    var tk = $('hq-run-ticker');
    if (!WS().run) { tk.classList.add('hidden'); return; }
    tk.classList.remove('hidden');
    var left = runRemainMs();
    if (left <= 0) {
      tk.innerHTML = '<b>PRODUCTION RUN COMPLETE</b> — ' + WS().run.units + '× ' + WS().run.plate +
        ' crated for ' + WS().run.buyer + '. <b>TAP TO DELIVER.</b>';
      tk.onclick = function () { PGAudio.tap(); deliverRun(); };
      return;
    }
    tk.onclick = null;
    var p = 1 - left / WS().run.durMs;
    var mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
    tk.innerHTML = 'WORKSHOP BOOKED — ' + WS().run.units + '× ' + WS().run.plate + ' FOR ' + WS().run.buyer +
      ' · DELIVERY IN ' + mm + ':' + String(ss).padStart(2, '0') +
      '<div class="rt-bar"><div class="rt-fill" style="width:' + Math.round(p * 100) + '%"></div></div>';
  }

  /* ---------- WEAPONS ASSEMBLY: the R&D bench ---------- */
  function saveBench() {
    if (S.mode !== 'rnd') return;
    WS().bench = JSON.parse(JSON.stringify(S.assembly));
    persist();
  }
  function enterRnd() {
    S.mode = 'rnd';
    if (WS().bench) {
      S.assembly = JSON.parse(JSON.stringify(WS().bench));
    } else {
      S.assembly = PG2.makeAssembly();
      S.assembly.paint = SAVE.paint || null;
    }
    S.assembly.refine.stock = JSON.parse(JSON.stringify(SAVE.stock));   // the shelf is shared
    S.seed = PG2.makeSeed().toUpperCase();   // every R&D shot is its own series
    clearHistory();
    enterBuild(true);
    $('btn-hq').classList.remove('hidden');
  }
  $('btn-hq').addEventListener('click', function () {
    PGAudio.tap();
    saveBench();
    $('btn-hq').classList.add('hidden');
    showHQ();
  });

  /* ---------- GYRO ALIGNMENT BENCH: hold the wander in the ring ---------- */
  var gyroSt = null;
  function gyroBtnRefresh() {
    var a = S.assembly;
    var show = S.phase === 'build' && a.shell && a.gyro;
    $('btn-gyro').classList.toggle('hidden', !show);
    if (!show) return;
    var sub = $('btn-gyro-sub');
    if (a.gyroCal == null) {
      sub.textContent = 'UNCAGED — ALIGN IT';
      $('btn-gyro').classList.add('warn');
    } else {
      sub.textContent = 'ALIGNED ' + Math.round(a.gyroCal * 100) + '%';
      $('btn-gyro').classList.remove('warn');
    }
  }
  $('btn-gyro').addEventListener('click', function () {
    PGAudio.tap();
    openGyroBench();
  });
  function openGyroBench() {
    gyroSt = { running: false, trim: { x: 0, y: 0 }, drag: null };
    $('gyro-read').textContent = S.assembly.gyroCal == null
      ? 'ROTOR CAGED' : 'LAST CAPTURE · ' + Math.round(S.assembly.gyroCal * 100) + '% — RUN IT AGAIN IF YOU DARE';
    $('gyro-sub').textContent = 'Spin it up. Drag the amber trim to hold the wander inside the ring for the whole capture.';
    $('gyro-run').disabled = false;
    $('gs-prog').setAttribute('d', '');
    $('gs-dot').setAttribute('cx', 120); $('gs-dot').setAttribute('cy', 120);
    $('gs-trim').setAttribute('transform', 'translate(120,120)');
    $('gyro-overlay').classList.remove('hidden');
  }
  $('gyro-close').addEventListener('click', function () {
    PGAudio.tap();
    var wasLs = gyroSt && gyroSt.lsTarget;
    if (gyroSt) gyroSt.running = false;
    $('gyro-overlay').classList.add('hidden');
    if (wasLs) { lsRenderDial(); return; }   // the Long Shot dial-in reclaims the screen
    gyroBtnRefresh();
    refreshHUD();
  });
  /* the trim crosshair follows the finger — you are the servo */
  (function () {
    var scope = $('gyro-scope');
    function toScope(e) {
      var r = scope.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * 240 - 120, y: (e.clientY - r.top) / r.height * 240 - 120 };
    }
    scope.addEventListener('pointerdown', function (e) {
      if (!gyroSt) return;
      e.preventDefault();
      scope.setPointerCapture(e.pointerId);
      gyroSt.drag = e.pointerId;
      var p = toScope(e);
      gyroSt.trim = { x: clamp(p.x, -95, 95), y: clamp(p.y, -95, 95) };
    });
    scope.addEventListener('pointermove', function (e) {
      if (!gyroSt || gyroSt.drag !== e.pointerId) return;
      var p = toScope(e);
      gyroSt.trim = { x: clamp(p.x, -95, 95), y: clamp(p.y, -95, 95) };
    });
    function up(e) { if (gyroSt && gyroSt.drag === e.pointerId) gyroSt.drag = null; }
    scope.addEventListener('pointerup', up);
    scope.addEventListener('pointercancel', up);
  })();
  $('gyro-run').addEventListener('click', function () {
    if (!gyroSt || gyroSt.running) return;
    PGAudio.armLatch();
    $('gyro-run').disabled = true;
    $('gyro-read').textContent = 'ROTOR AT SPEED · CAPTURING…';
    // the wander: three incommensurate sines per axis, phases rolled fresh
    function wobble() {
      return { a: 26 + Math.random() * 22, f: 0.35 + Math.random() * 0.75, p: Math.random() * 6.28 };
    }
    gyroSt.wx = [wobble(), wobble(), wobble()];
    gyroSt.wy = [wobble(), wobble(), wobble()];
    gyroSt.running = true;
    gyroSt.t0 = performance.now();
    gyroSt.good = 0;
    gyroSt.samples = 0;
    var DUR = 6000, RING = 30;
    function step(now) {
      if (!gyroSt || !gyroSt.running) return;
      var t = (now - gyroSt.t0) / 1000;
      var k = clamp((now - gyroSt.t0) / DUR, 0, 1);
      function drift(w, tt) {
        var v = 0;
        w.forEach(function (o) { v += Math.sin(tt * o.f * 6.28 + o.p) * o.a; });
        return v / w.length * (0.5 + k * 0.9);   // it gets meaner as the capture runs
      }
      var dx = drift(gyroSt.wx, t) + gyroSt.trim.x;
      var dy = drift(gyroSt.wy, t) + gyroSt.trim.y;
      dx = clamp(dx, -100, 100); dy = clamp(dy, -100, 100);
      $('gs-dot').setAttribute('cx', 120 + dx);
      $('gs-dot').setAttribute('cy', 120 + dy);
      $('gs-trim').setAttribute('transform', 'translate(' + (120 + gyroSt.trim.x) + ',' + (120 + gyroSt.trim.y) + ')');
      var err = Math.hypot(dx, dy);
      gyroSt.samples++;
      if (err <= RING) { gyroSt.good++; if (gyroSt.samples % 14 === 0) PGAudio.measureTick(); }
      // progress arc around the bezel
      var ang = k * Math.PI * 2 - Math.PI / 2;
      var large = k > 0.5 ? 1 : 0;
      $('gs-prog').setAttribute('d', 'M 120 8 A 112 112 0 ' + large + ' 1 ' +
        (120 + 112 * Math.cos(ang)) + ' ' + (120 + 112 * Math.sin(ang)));
      $('gyro-read').textContent = 'DRIFT ' + err.toFixed(0) + ' µRAD · IN-RING ' +
        Math.round(gyroSt.good / gyroSt.samples * 100) + '%';
      if (k >= 1) {
        gyroSt.running = false;
        var q = clamp(gyroSt.good / gyroSt.samples, 0, 1);
        if (gyroSt.lsTarget && S.ls) { S.ls.dial.gyro = Math.round(q * 100) / 100; }
        else { S.assembly.gyroCal = Math.round(q * 100) / 100; saveBench(); }
        var grade = q >= 0.85 ? 'FINE ALIGNMENT' : q >= 0.6 ? 'SERVICEABLE' : q >= 0.35 ? 'ROUGH' : 'BARELY CAGED';
        $('gyro-read').textContent = 'LOCKED · ' + Math.round(q * 100) + '% — ' + grade;
        $('gyro-sub').textContent = q >= 0.85
          ? 'The rotor hums. The fins will never know what they lost.'
          : 'It will hold. Run the capture again to tighten it.';
        $('gyro-run').disabled = false;
        PGAudio.stampThud();
        gyroBtnRefresh();
        return;
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });

  /* ---------- the target picker: which object measures you tonight ---------- */
  function openTargetPicker() {
    var d = PG2.derive(S.assembly, rfp());
    if (!cashOK(d.cost)) {
      PGAudio.buzz();
      toast('The account is short: this article costs ' + fmt$(d.cost) + ' to expend, the company holds ' + cashLabel() + '.');
      return;
    }
    $('tgt-cost').textContent = 'THIS SHOT EXPENDS THE ARTICLE — ' + fmt$(d.cost) + ' · ACCOUNT ' + cashLabel();
    var list = $('tgt-list');
    list.innerHTML = '';
    if (!S.rndParams) S.rndParams = {};
    PG2.TARGET_ORDER.forEach(function (tid) {
      var t = PG2.TARGETS[tid];
      if (S.rndParams[tid] == null) S.rndParams[tid] = t.param.options[t.param.key === 'standoff' ? 1 : 0].id;
      var row = document.createElement('div');
      row.className = 'tgt-row';
      row.innerHTML = '<span class="tg-metric">' + t.metric + '</span><div class="tg-name">' + t.name + '</div>' +
        '<div class="tg-sub">' + t.sub + '</div><div class="tg-blurb">' + t.blurb + '</div>' +
        '<div class="tgt-params" data-tid="' + tid + '"></div>' +
        '<div class="tgt-param-sub" id="tps-' + tid + '"></div>' +
        '<button type="button" class="tgt-go" style="width:100%;margin-top:8px;font-family:var(--mono);font-size:9px;font-weight:800;letter-spacing:.14em;color:#0a1420;background:var(--amber);border-radius:6px;padding:9px">TRUCK IT OUT — ' + t.param.label + ': <span id="tgo-' + tid + '"></span></button>';
      var pWrap = row.querySelector('.tgt-params');
      function refreshParamUI() {
        var opt = null;
        t.param.options.forEach(function (o) { if (o.id === S.rndParams[tid]) opt = o; });
        pWrap.querySelectorAll('button').forEach(function (bb) {
          bb.classList.toggle('on', bb.dataset.opt === S.rndParams[tid]);
        });
        row.querySelector('#tps-' + tid).textContent = opt ? opt.sub : '';
        row.querySelector('#tgo-' + tid).textContent = opt ? opt.label : '';
      }
      t.param.options.forEach(function (o) {
        var ob = document.createElement('button');
        ob.type = 'button';
        ob.dataset.opt = o.id;
        ob.textContent = o.label;
        ob.addEventListener('click', function (ev) {
          ev.stopPropagation();
          PGAudio.tick();
          S.rndParams[tid] = o.id;
          refreshParamUI();
        });
        pWrap.appendChild(ob);
      });
      refreshParamUI();
      row.querySelector('.tgt-go').addEventListener('click', function () {
        PGAudio.tap();
        $('target-overlay').classList.add('hidden');
        enterRangeRnd(tid, S.rndParams[tid]);
      });
      list.appendChild(row);
    });
    $('target-overlay').classList.remove('hidden');
  }
  $('tgt-close').addEventListener('click', function () {
    PGAudio.tap();
    $('target-overlay').classList.add('hidden');
  });

  /* ---------- the R&D range: out the back gate, no convoy, an object that measures back ---------- */
  function enterRangeRnd(targetId, param) {
    clearLater();
    aerialReset();
    S.rndTarget = targetId;
    var d = PG2.derive(S.assembly, rfp());
    cashSpend(d.cost);                 // the article is spent the moment it leaves the shed
    WS().rndTests++;
    saveBench();
    var rt = PG2.resolveTarget(S.assembly, S.seed, targetId, { param: param });
    S.result = { outcome: rt.o, visual: PG2.visualFor(rt.o), rnd: rt, shotCost: d.cost, seed: S.seed };
    if (!range) range = initRange();
    S.phase = 'station';
    showUI('ui-range');
    $('stage-bar').classList.add('hidden');
    $('arm-ui').classList.add('hidden');
    $('cam-overlay').classList.remove('hidden');
    $('cam-tick').classList.add('hidden');
    $('measure-svg').classList.add('hidden');
    $('btn-arm').classList.add('hidden');
    $('btn-fire').classList.add('hidden');
    $('btn-skip-truck').classList.add('hidden');
    $('arm-ring').style.setProperty('--p', 0);
    $('flash').style.opacity = 0;
    $('dustwall').style.opacity = 0;
    window.__pgMeasureDone = false;
    if (range.fx && range.fx.group) range.scene.remove(range.fx.group);
    range.fx = null;
    if (range.craterG) { range.scene.remove(range.craterG); range.craterG = null; }
    if (range.vantageG) { range.scene.remove(range.vantageG); range.vantageG = null; }
    if (range.dropRig) range.dropRig.visible = false;
    range.vBeatSkip = null;
    range.mode = 'station';
    range.truck.visible = false;
    range.escort.visible = false;
    range.convoyG.visible = false;
    range.convoy = null;
    range.dustPool.forEach(function (dd) { dd.live = false; dd.sp.visible = false; });
    range.rabbit.visible = false;
    range.rabbit.userData.run = null;
    range.shake = 0;
    range.convoyShake = 0;
    rebuildScars();
    range.wind = windOf(rfp());
    applyRangePalette(rfp().timeOfDay || 'dusk');   // R&D happens after hours
    range.pad.visible = true;
    range.padDress.visible = true;
    // the article on the trestle — no convoy for a company shot
    var dh = range.deviceHolder;
    if (dh.parent) dh.parent.remove(dh);
    range.scene.add(dh);
    for (var i = dh.children.length - 1; i >= 0; i--) dh.remove(dh.children[i]);
    dh.add(buildRangeDevice());
    dh.position.set(0, 2.1, 0);
    dh.scale.set(1.7, 1.7, 1.7);
    dh.rotation.z = 0;
    dh.visible = true;
    if (!range.trestle) {
      var tr = new THREE.Group();
      [-0.9, 0.9].forEach(function (x) {
        var leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.5, 1.6), mat(0x6b4a2a));
        leg.castShadow = true;
        leg.position.set(x, 0.75, 0);
        tr.add(leg);
      });
      range.scene.add(tr);
      range.trestle = tr;
    }
    range.trestle.visible = true;
    // the object of the evening, set up per the test card
    setTargetObject(targetId);
    if (targetId === 'array' && range.targetG) {
      range.targetG.position.x = param === '40' ? 25 : param === '80' ? 55 : 40;   // stage depth reads the standoff
    }
    // Station 7, after hours
    range.camera.position.set(60, 14, 1600);
    range.camera.fov = 7;
    range.camera.updateProjectionMatrix();
    range.camera.lookAt(targetId === 'array' ? 18 : 6, 3, 0);
    $('cam-station').textContent = PG2.CAMERA.id + ' — ' + PG2.CAMERA.km.toFixed(1) + ' KM';
    $('cam-clock').textContent = 'T−00:0' + rfp().tSpec.toFixed(1);
    PGAudio.wind();
    var t = PG2.TARGETS[targetId];
    setCaption('STATION 7 · AFTER HOURS · R&D SHOT #' + WS().rndTests,
      'No board. No binoculars. Just the ' + t.name.toLowerCase() + ', which measures back.');
    later(2100, startRabbit);
    later(1800, function () { $('btn-arm').classList.remove('hidden'); });
    persist();
  }

  /* ---------- the objects: built fresh per shot, damaged per the survey ---------- */
  function setTargetObject(tid) {
    if (range.targetG) { range.scene.remove(range.targetG); range.targetG = null; }
    var g = buildTargetGroup(tid);
    g.traverse(function (m) {
      if (m.isMesh && !(m.material && m.material.transparent)) { m.castShadow = true; m.receiveShadow = true; }
    });
    range.scene.add(g);
    range.targetG = g;
  }
  function groundDecal(w2, l2, dark) {
    // painted contact shadow — a soft ellipse of settled dust under anything
    // that has sat on the playa long enough to matter
    var tx = canvasTex('gshadow', 128, 128, function (x, w, h) {
      var gr = x.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.5);
      gr.addColorStop(0, 'rgba(24,18,10,0.42)');
      gr.addColorStop(0.7, 'rgba(30,23,13,0.2)');
      gr.addColorStop(1, 'rgba(30,23,13,0)');
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
    });
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w2, l2),
      new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: dark != null ? dark : 0.85, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 1;
    return m;
  }
  function rustSkin(key, base, paintPatch) {
    return canvasTex(key, 512, 512, function (x, w, h) {
      x.fillStyle = shadeHex(base, -0.02); x.fillRect(0, 0, w, h);
      var r0 = PG2.stream('TEXTURE', key);
      // the old paint, going in continents
      if (paintPatch) {
        for (var p = 0; p < 7; p++) {
          x.fillStyle = 'rgba(122,118,92,' + (0.18 + r0() * 0.2).toFixed(2) + ')';
          x.beginPath();
          x.ellipse(r0() * w, r0() * h, 40 + r0() * 90, 26 + r0() * 60, r0() * 3, 0, Math.PI * 2);
          x.fill();
        }
      }
      // rust blooms
      for (var i = 0; i < 26; i++) {
        var bx = r0() * w, by = r0() * h, br = 8 + r0() * 46;
        var rg = x.createRadialGradient(bx, by, 1, bx, by, br);
        rg.addColorStop(0, 'rgba(' + (r0() > 0.5 ? '92,54,28' : '58,36,20') + ',' + (0.3 + r0() * 0.3).toFixed(2) + ')');
        rg.addColorStop(1, 'rgba(70,44,24,0)');
        x.fillStyle = rg; x.fillRect(0, 0, w, h);
      }
      // rain streaks, always downhill
      for (var s = 0; s < 40; s++) {
        var sx2 = r0() * w, sy2 = r0() * h * 0.5;
        x.fillStyle = 'rgba(40,26,14,' + (0.1 + r0() * 0.16).toFixed(2) + ')';
        x.fillRect(sx2, sy2, 1.6 + r0() * 2, 30 + r0() * 110);
      }
      texGrain(x, w, h, 700, 0.06, key + ':g');
      var ao = x.createLinearGradient(0, h * 0.62, 0, h);
      ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(16,12,6,0.42)');
      x.fillStyle = ao; x.fillRect(0, 0, w, h);
    });
  }
  function buildTargetGroup(tid) {
    var g = new THREE.Group();
    g.userData.tid = tid;
    if (tid === 'truck') {
      // the derelict hauler: a real flatbed silhouette — chassis rails, cab
      // with dark glass, arched fenders, stake rails, one dead tyre. It sags.
      var rust = 0x6b4b32, rust2 = 0x59422f;
      var skinT = rustSkin('trk:cab', rust, true);
      var bedT = rustSkin('trk:bed', rust2, false);
      function rustM(tex) { return skinMat(tex, { shin: 10 }); }
      // chassis rails + rear crossmember
      [-0.62, 0.62].forEach(function (z) {
        var rail = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.16, 0.12), mat(0x33291c, { shin: 5 }));
        rail.position.set(0.15, 0.74, z);
        g.add(rail);
      });
      var bed = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.22, 2.1), rustM(bedT));
      bed.position.set(0, 1.06, 0);
      g.add(bed);
      g.userData.bed = bed;
      // stake rails round the flatbed
      [-1, 1].forEach(function (sz) {
        var rail2 = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.07, 0.07), mat(0x4a3826, { shin: 6 }));
        rail2.position.set(0, 1.62, sz * 1.01);
        g.add(rail2);
        [-1.75, -0.55, 0.65, 1.85].forEach(function (sx) {
          var stake = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), mat(0x4a3826, { shin: 6 }));
          stake.position.set(sx, 1.42, sz * 1.01);
          g.add(stake);
        });
      });
      // cab with painted patina + true dark glass
      var cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.9), rustM(skinT));
      cab.position.set(2.6, 1.5, 0);
      g.add(cab);
      var shield = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.62), mat(0x0d1319, { shin: 80, spec: 0x5a7186, flat: false }));
      shield.position.set(3.36, 1.86, 0);
      shield.rotation.y = Math.PI / 2;
      g.add(shield);
      [-1, 1].forEach(function (sz) {
        var win = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.5), mat(0x0d1319, { shin: 80, spec: 0x5a7186, flat: false }));
        win.position.set(2.42, 1.86, sz * 0.955);
        win.rotation.y = sz > 0 ? 0 : Math.PI;
        g.add(win);
        // mirror stalks — long dead, still standing
        var stalk = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.3), mat(0x3a3026, { shin: 8 }));
        stalk.position.set(3.3, 2.0, sz * 1.06);
        g.add(stalk);
        var mir = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.14), mat(0x2a2f34, { shin: 30 }));
        mir.position.set(3.3, 1.96, sz * 1.22);
        g.add(mir);
      });
      var hood = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.7), rustM(skinT));
      hood.position.set(3.85, 1.05, 0);
      g.add(hood);
      // radiator grille + arched front fenders
      var grille = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.62),
        skinMat(canvasTex('trk:grille', 128, 64, function (x, w, h) {
          x.fillStyle = '#241c12'; x.fillRect(0, 0, w, h);
          x.fillStyle = 'rgba(150,140,120,0.5)';
          for (var i = 6; i < w; i += 10) x.fillRect(i, 5, 3, h - 10);
          x.strokeStyle = 'rgba(160,150,130,0.6)'; x.lineWidth = 3; x.strokeRect(2, 2, w - 4, h - 4);
        }), { shin: 20 }));
      grille.position.set(4.41, 1.0, 0);
      grille.rotation.y = Math.PI / 2;
      g.add(grille);
      [-1, 1].forEach(function (sz) {
        var fender = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.34, 12, 1, true, 0, Math.PI), rustM(skinT));
        fender.rotation.x = Math.PI / 2;
        fender.rotation.y = Math.PI / 2;
        fender.position.set(3.8, 0.6, sz * 1.1);
        g.add(fender);
      });
      // wheels — one rear tyre is done with all of this
      [[-1.4, 0.75], [-0.1, 0.75], [2.7, 0.75], [3.8, 0.75]].forEach(function (wxz, wi) {
        [-1, 1].forEach(function (sz) {
          var dead = (wi === 0 && sz < 0);
          var wh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), mat(0x1d2126, { shin: 4 }));
          wh.rotation.x = Math.PI / 2;
          wh.position.set(wxz[0], dead ? 0.36 : 0.42, sz * 1.1);
          if (dead) wh.scale.set(1, 1, 0.86);
          g.add(wh);
          var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.32, 8), mat(0x4c443a, { shin: 20 }));
          hub.rotation.x = Math.PI / 2;
          hub.position.copy(wh.position);
          if (dead) hub.scale.copy(wh.scale);
          g.add(hub);
        });
      });
      // exhaust stack behind the cab, and the dust it all sits in
      var stack = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.5, 8), mat(0x3a332a, { shin: 12 }));
      stack.position.set(1.95, 2.0, -0.75);
      g.add(stack);
      var shad = groundDecal(6.6, 3.6);
      shad.position.y = 0.045;
      g.add(shad);
      g.rotation.z = 0.028;          // rear springs went first — the derelict sags
      g.position.set(15, 0, -2.5);
      g.rotation.y = 0.4;
    } else if (tid === 'wall') {
      // board-formed test panels: tie holes, formwork lines, rebar waiting
      // under the skin for the day the survey goes loud
      var slabTex = canvasTex('wallslab', 256, 512, function (x, w, h) {
        x.fillStyle = '#7f8587'; x.fillRect(0, 0, w, h);
        var r0 = PG2.stream('TEXTURE', 'wallslab');
        // board-form strata
        for (var b = 0; b < h; b += 36) {
          x.fillStyle = 'rgba(' + (r0() > 0.5 ? '235,238,240' : '30,34,36') + ',' + (0.07 + r0() * 0.09).toFixed(3) + ')';
          x.fillRect(0, b, w, 34);
          x.fillStyle = 'rgba(24,28,30,0.5)'; x.fillRect(0, b, w, 3);
        }
        // tie holes with rust weep
        for (var ty = 0; ty < 3; ty++) {
          for (var tx2 = 0; tx2 < 2; tx2++) {
            var hx2 = w * (0.3 + tx2 * 0.4), hy = h * (0.2 + ty * 0.3);
            x.fillStyle = 'rgba(120,90,60,0.35)';
            x.fillRect(hx2 - 3, hy, 6, 30 + r0() * 60);
            x.fillStyle = '#3c4042';
            x.beginPath(); x.arc(hx2, hy, 6, 0, Math.PI * 2); x.fill();
            x.fillStyle = 'rgba(255,255,255,0.25)';
            x.beginPath(); x.arc(hx2, hy - 2, 3, 0, Math.PI * 2); x.fill();
          }
        }
        texGrain(x, w, h, 600, 0.06, 'wallslab:g');
        // weather stain from the crown, grime at the foot
        var tg2 = x.createLinearGradient(0, 0, 0, h * 0.2);
        tg2.addColorStop(0, 'rgba(60,58,50,0.3)'); tg2.addColorStop(1, 'rgba(60,58,50,0)');
        x.fillStyle = tg2; x.fillRect(0, 0, w, h * 0.2);
        var ao = x.createLinearGradient(0, h * 0.72, 0, h);
        ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(30,26,18,0.4)');
        x.fillStyle = ao; x.fillRect(0, 0, w, h);
      });
      g.userData.slabs = [];
      g.userData.rebar = [];
      [-3.6, 0, 3.6].forEach(function (z, i) {
        var slab = new THREE.Mesh(new THREE.BoxGeometry(0.62, 4.4, 3.5), skinMat(slabTex, { shin: 4 }));
        slab.position.set(0, 2.2, z);
        g.add(slab);
        g.userData.slabs.push(slab);
        var foot = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 3.5), grainTint(0x83898b, 'wallfoot', 4));
        foot.position.set(0, 0.2, z);
        g.add(foot);
        // panel designation, stencilled by the Authority
        var pn = textPlane('PANEL B-' + (i + 1), 1.1, 0.24, { color: '#3d4144', px: 60 });
        pn.position.set(0.32, 3.6, z);
        pn.rotation.y = Math.PI / 2;
        g.add(pn);
        // rebar stubs — invisible until the damage states earn them
        var rb = new THREE.Group();
        for (var ri = 0; ri < 5; ri++) {
          var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.7 + (ri % 3) * 0.25, 6), mat(0x5a4632, { shin: 26 }));
          rod.position.set((ri % 2 ? 0.1 : -0.1), 0.6, -1.2 + ri * 0.6);
          rod.rotation.x = (ri - 2) * 0.16;
          rod.rotation.z = (ri % 2 ? 0.22 : -0.18);
          rb.add(rod);
        }
        rb.position.z = z;
        rb.visible = false;
        g.add(rb);
        g.userData.rebar.push(rb);
      });
      var shadW = groundDecal(3.4, 11.6);
      shadW.position.y = 0.045;
      g.add(shadW);
      g.position.set(14.5, 0, 0);
    } else {
      // the instrument array: twelve honest panes on proper survey racks —
      // tripod-braced posts, junction boxes, cable droops between stations
      g.userData.panels = [];
      var postGeo = new THREE.BoxGeometry(0.09, 2.6, 0.09);
      var barGeo = new THREE.BoxGeometry(0.08, 0.08, 1.72);
      var legGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.05, 6);
      var boxGeo = new THREE.BoxGeometry(0.2, 0.34, 0.46);
      var glassGeo = new THREE.PlaneGeometry(1.5, 1.5);
      var glassTex = canvasTex('arrayglass', 128, 128, function (x, w, h) {
        // fresnel-ish pane: airy center, luminous rim
        var gr = x.createRadialGradient(w / 2, h / 2, w * 0.08, w / 2, h / 2, w * 0.72);
        gr.addColorStop(0, 'rgba(156,200,234,0.5)');
        gr.addColorStop(0.72, 'rgba(170,212,240,0.72)');
        gr.addColorStop(1, 'rgba(220,240,252,1)');
        x.fillStyle = gr; x.fillRect(0, 0, w, h);
        x.strokeStyle = 'rgba(240,250,255,0.9)'; x.lineWidth = 5;
        x.strokeRect(2, 2, w - 4, h - 4);
        // one long diagonal glare stripe
        x.save();
        x.translate(w / 2, h / 2); x.rotate(-0.7);
        x.fillStyle = 'rgba(235,246,255,0.5)';
        x.fillRect(-w, -h * 0.16, w * 2, h * 0.1);
        x.restore();
      });
      var jboxTex = canvasTex('jbox', 128, 96, function (x, w, h) {
        x.fillStyle = '#38424c'; x.fillRect(0, 0, w, h);
        [[0.32, 0.42], [0.68, 0.42]].forEach(function (dc) {
          x.fillStyle = '#dfe6d8';
          x.beginPath(); x.arc(w * dc[0], h * dc[1], 13, 0, Math.PI * 2); x.fill();
          x.strokeStyle = '#2a2f34'; x.lineWidth = 2;
          x.beginPath(); x.arc(w * dc[0], h * dc[1], 13, 0, Math.PI * 2); x.stroke();
          x.beginPath(); x.moveTo(w * dc[0], h * dc[1]);
          x.lineTo(w * dc[0] + 8, h * dc[1] - 6); x.stroke();
        });
        x.fillStyle = 'rgba(229,161,61,0.9)'; x.fillRect(w * 0.2, h * 0.72, w * 0.6, 6);
        rivetDot(x, 10, 10, 3); rivetDot(x, w - 10, 10, 3); rivetDot(x, 10, h - 10, 3); rivetDot(x, w - 10, h - 10, 3);
      });
      for (var i = 0; i < 12; i++) {
        var row = Math.floor(i / 6), col = i % 6;
        var pg = new THREE.Group();
        [-0.78, 0.78].forEach(function (pz) {
          var post = new THREE.Mesh(postGeo, mat(0x3c4650, { shin: 22 }));
          post.position.set(0, 1.3, pz);
          pg.add(post);
          var leg = new THREE.Mesh(legGeo, mat(0x333c46, { shin: 18 }));
          leg.position.set(0.4, 0.5, pz);
          leg.rotation.z = 0.72;
          pg.add(leg);
        });
        [2.52, 0.92].forEach(function (by) {
          var bar = new THREE.Mesh(barGeo, mat(0x46505a, { shin: 22 }));
          bar.position.set(0, by, 0);
          pg.add(bar);
        });
        var jb = new THREE.Mesh(boxGeo, skinMat(jboxTex, { shin: 26 }));
        jb.position.set(0, 0.36, 0);
        pg.add(jb);
        var conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), mat(0x2c3238, { shin: 20 }));
        conduit.position.set(0, 0.72, 0);
        pg.add(conduit);
        var glass = new THREE.Mesh(glassGeo,
          skinMat(glassTex, { shin: 90, spec: 0x9cc8ea, emissive: 0x2c4a66, ei: 0.5, transparent: true, opacity: 0.5, flat: false }));
        glass.position.y = 1.7;
        glass.rotation.y = -Math.PI / 2;
        pg.add(glass);
        pg.userData.glass = glass;
        var shadP = groundDecal(1.5, 2.2, 0.6);
        shadP.position.y = 0.045;
        pg.add(shadP);
        pg.position.set(row * 3.2, 0, -8.75 + col * 3.5);
        g.add(pg);
        g.userData.panels.push(pg);
      }
      // cable droops between stations — the array is wired like it means it
      for (var rw = 0; rw < 2; rw++) {
        for (var cd = 0; cd < 5; cd++) {
          var z0 = -8.75 + cd * 3.5, z1 = z0 + 3.5, xw = rw * 3.2;
          var curve = new THREE.QuadraticBezierCurve3(
            V3(xw, 0.42, z0 + 0.25), V3(xw, 0.1, (z0 + z1) / 2), V3(xw, 0.42, z1 - 0.25));
          var cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.016, 5, false), mat(0x23282e, { shin: 16 }));
          g.add(cable);
        }
      }
      g.position.set(40, 0, 0);
    }
    return g;
  }
  function applyTargetDamage() {
    var g = range.targetG;
    if (!g || !S.result.rnd || !S.result.outcome.fired) return;
    var rt = S.result.rnd;
    var r = PG2.stream(S.seed, 'aftermath');
    // every object wears the scorch
    g.traverse(function (m) {
      if (m.isMesh && m.material && m.material.color) m.material.color.multiplyScalar(0.62);
    });
    if (g.userData.tid === 'truck') {
      var pen = rt.primary || 0;
      var toss = rt.toss || 0;
      if (pen >= 140 || toss >= 9) {   // clean through, or thrown outright
        g.rotation.z = 1.75 + r() * 0.4;
        g.position.y += 1.15;
        g.position.x += 1.0 + toss * 0.22;
      } else if (pen >= 70 || toss >= 5) {
        g.rotation.z = 0.34;
        g.position.x += 0.4 + toss * 0.12;
        g.position.y += 0.18;
      }
      if (pen >= 40 && g.userData.bed) {
        var hole = new THREE.Mesh(new THREE.CircleGeometry(0.35 + Math.min(pen, 200) / 260, 12),
          new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
        hole.rotation.x = -Math.PI / 2;
        hole.position.set(-0.4, 0.12, 0);
        g.userData.bed.add(hole);
      }
    } else if (g.userData.tid === 'wall') {
      var breach = rt.primary || 0;
      var mid = g.userData.slabs[1];
      if (rt.collapsed) breach = 100;   // the lintel went; the panel followed
      if (breach >= 95) {
        mid.visible = false;
        if (g.userData.rebar && g.userData.rebar[1]) g.userData.rebar[1].visible = true;   // the skeleton shows
        for (var i = 0; i < 7; i++) {
          var ch = new THREE.Mesh(new THREE.BoxGeometry(0.5 + r() * 0.5, 0.4 + r() * 0.5, 0.6 + r() * 0.6),
            grainTint(0x767c7e, 'wallchunk', 4));
          ch.position.set(-1.2 + r() * 3.2, 0.3, -1.4 + r() * 2.8);
          ch.rotation.set(r() * 2, r() * 2, r() * 2);
          g.add(ch);
        }
      } else if (breach >= 55) {
        mid.scale.y = 0.42;
        mid.position.y = 3.5;    // the bottom went; the lintel holds, embarrassed
        if (g.userData.rebar && g.userData.rebar[1]) g.userData.rebar[1].visible = true;   // rebar stubs, revealed
        for (var j = 0; j < 4; j++) {
          var ch2 = new THREE.Mesh(new THREE.BoxGeometry(0.5 + r() * 0.4, 0.4 + r() * 0.4, 0.5 + r() * 0.5),
            grainTint(0x767c7e, 'wallchunk', 4));
          ch2.position.set(-0.9 + r() * 2.4, 0.28, -1.1 + r() * 2.2);
          ch2.rotation.set(r() * 2, r() * 2, r() * 2);
          g.add(ch2);
        }
      } else if (breach >= 25) {
        mid.rotation.x = 0.05 - r() * 0.1;   // cracked, leaning, standing out of spite
      }
    } else {
      var n = rt.panels || 0;
      g.userData.panels.forEach(function (pg, i) {
        if (i < n) {
          pg.userData.glass.material.opacity = 0.07;
          pg.userData.glass.rotation.z = (r() - 0.5) * 0.5;
          pg.rotation.x = (r() - 0.5) * 0.14;
        }
      });
    }
  }

  /* ---------- the R&D survey: the object reads back, then the card ---------- */
  function rndSurvey() {
    S.phase = 'crater';
    msr.active = false;
    var o = S.result.outcome;
    var rt = S.result.rnd;
    var t = rt.target;
    // the crater happens exactly as it always does
    var crater = o.craterActual || 0;
    var cr = Math.max(crater / 2, 1.6);
    if (range.craterG) range.scene.remove(range.craterG);
    range.craterG = buildCraterGroup(cr, S.result.visual.ellipse || 1, S.result.visual.offsetM || 0);
    range.scene.add(range.craterG);
    applyTargetDamage();
    // survey pass: pad first, then the object
    var g = range.targetG;
    var tx = g ? g.position.x : 14, tz = g ? g.position.z : 0;
    var cam = range.camera;
    cam.fov = 26;
    cam.updateProjectionMatrix();
    var from = V3(tx * 0.4, 7, 30);
    var to = V3(tx - (rt.target.id === 'array' ? 16 : 9), 4.2, 13);
    setCaption('SURVEY PASS · THE OBJECT', 'The dust votes first. The instruments vote last.');
    tween(4200, function (e) {
      if (aerial.on) return;                        // the recon plane has the stick
      cam.position.lerpVectors(from, to, e);
      cam.lookAt(tx, rt.target.id === 'wall' ? 2.2 : 1.4, tz);
    }, null, easeInOut);
    var m0 = rt.measures[0], m1 = rt.measures[1];
    later(2400, function () {
      PGAudio.typeDing();
      setCaption('SURVEY · ' + t.name, '<b>' + m0.lbl + ' — ' + m0.val + (m0.unit ? ' ' + m0.unit : '') + '</b><br>' + m0.sub);
    });
    later(4600, function () {
      if (m1) {
        PGAudio.typeDing();
        setCaption('SURVEY · ' + t.name, '<b>' + m1.lbl + ' — ' + m1.val + (m1.unit ? ' ' + m1.unit : '') + '</b><br>' + m1.sub);
      }
    });
    later(6600, function () {
      // the blast survey reads its own contours off the dirt
      PGAudio.measureTick();
      setCaption('BLAST SURVEY · CONTOURS PLOTTED',
        '<b>CRATER ⌀ ' + crater.toFixed(1) + ' m · SCORCH R ' + (cr * 2.2).toFixed(0) +
        ' m · OVERPRESSURE R ' + (cr * 4.2).toFixed(0) + ' m</b><br>The plotter is smug about the circles.');
    });
    later(8800, function () { advanceOrHold(showRndScore); });
  }

  /* ---------- the R&D readout card ---------- */
  function certFee() {
    var unitCost = S.result && S.result.shotCost != null ? S.result.shotCost
      : PG2.derive(S.assembly, rfp()).cost;
    return 500 + unitCost * 2;   // filing, plus the two extra articles the series expends
  }
  function showRndScore() {
    clearLater();
    S.phase = 'score';
    msr.active = false;
    aerialReset();
    showUI(null);
    $('measure-svg').classList.add('hidden');
    var rt = S.result.rnd;
    var o = S.result.outcome;
    var t = rt.target;
    if (o.fired && rt.funcOk) PGAudio.fanfare(); else if (!o.fired) PGAudio.sadDrone();
    persist();
    var el = $('score-scroll');
    function mCard(m) {
      return '<div class="stamp-card"><div class="sc-lbl">' + m.lbl + '</div>' +
        '<div class="sc-val">' + m.val + (m.unit ? ' <span style="font-size:11px">' + m.unit + '</span>' : '') + '</div>' +
        '<div class="sc-spec">' + m.sub + '</div></div>';
    }
    var certifiable = o.fired && rt.funcOk;
    var fee = certFee();
    el.innerHTML =
      '<div class="score-sheet">' +
        '<div class="score-head">WEAPONS ASSEMBLY · INTERNAL — NOT FOR THE AUTHORITY</div>' +
        '<div class="score-title">RANGE READOUT</div>' +
        '<div class="score-sub">' + t.name + ' · R&D SHOT #' + WS().rndTests + ' · SERIES ' + S.result.seed + '</div>' +
        '<div class="stamp-row">' + rt.measures.map(mCard).join('') + '</div>' +
        (!o.fired && o.rootCause
          ? '<div class="hint-callout"><span class="hc-kicker">NO DATA — ' + o.rootCause.title + '</span>' +
            (o.hint || '') + '</div>'
          : (o.hint && !rt.funcOk ? '<div class="hint-callout"><span class="hc-kicker">OFF CUE</span>' + o.hint + '</div>' : '')) +
        '<table class="pay-table">' +
          '<tr><td>ARTICLE, EXPENDED (PARTS &amp; REFINING)</td><td>−' + fmt$(S.result.shotCost) + '</td></tr>' +
          '<tr class="net"><td>COMPANY ACCOUNT</td><td>' + cashLabel() + '</td></tr>' +
        '</table>' +
        '<div class="score-btns">' +
          '<button id="btn-rnd-retry" type="button">BACK TO THE BENCH<span class="sub">YOUR BUILD, AS YOU LEFT IT</span></button>' +
          (certifiable
            ? '<button id="btn-rnd-cert" type="button">SUBMIT FOR TYPE CERTIFICATION<span class="sub">FREEZE THE DESIGN · 3-TEST SERIES · ' + fmt$(fee) + '</span></button>'
            : '') +
        '</div>' +
        '<div class="score-navrow"><button id="btn-rnd-hq" type="button">THE COMPOUND</button></div>' +
        '<div class="score-seed">SERIES ' + S.result.seed + ' · SAME BUILD + SAME SERIES = SAME RESULT · ALL SCIENCE INVENTED</div>' +
      '</div>';
    showScreen('scr-score');
    $('btn-rnd-retry').addEventListener('click', function () {
      PGAudio.tap();
      S.seed = PG2.makeSeed().toUpperCase();   // a fresh evening, a fresh series
      enterBuild(true);
      $('btn-hq').classList.remove('hidden');
    });
    if (certifiable) $('btn-rnd-cert').addEventListener('click', function () { PGAudio.tap(); certifyDesign(); });
    $('btn-rnd-hq').addEventListener('click', function () { PGAudio.tap(); saveBench(); showHQ(); });
  }

  /* ---------- TYPE CERTIFICATION: three tests, design frozen ---------- */
  function certifyDesign() {
    var fee = certFee();
    if (!cashOK(fee)) {
      PGAudio.buzz();
      toast('The series costs ' + fmt$(fee) + '; the company holds ' + cashLabel() + '. The Authority does not run tabs.');
      return;
    }
    cashSpend(fee);
    var certSeed = PG2.makeSeed().toUpperCase();
    var certParam = S.result && S.result.rnd ? S.result.rnd.param : null;
    var series = PG2.certSeries(S.assembly, certSeed, S.rndTarget, certParam);
    var doc = $('cert-doc');
    var t = series.target;
    function stampRow(st) {
      return '<div class="cert-row"><div><div class="cr-lbl">' + st.label + '</div>' +
        '<span class="cr-note">' + st.spec + (st.note ? ' · ' + st.note : '') + '</span></div>' +
        '<div class="cr-val">' + st.value + '<br><span class="cert-stamp ' + (st.ok ? 'pass' : 'fail') + '">' +
        (st.ok ? 'PASS' : 'FAIL') + '</span></div></div>';
    }
    doc.innerHTML =
      '<div class="doc-headrow"><span>FORM RD-2200-T</span><span>STANDARDS SERIES ' + certSeed + '</span></div>' +
      '<div class="rfp-no">TYPE CERTIFICATION · ' + t.name + '</div>' +
      '<div class="rfp-title" style="font-size:16px">THE DESIGN IS FROZEN. THREE TESTS. NO TWEAKS.</div>' +
      '<hr class="doc-rule">' +
      series.stamps.map(stampRow).join('') +
      '<div class="cert-verdict">' + (series.pass
        ? '★ PRODUCTION READY ★'
        : 'NOT CERTIFIED — THE FEE IS NOT REFUNDED.<br><span style="font-size:10px;font-weight:400">The Authority thanks you for the fireworks.</span>') + '</div>';
    $('cert-overlay').classList.remove('hidden');
    $('cert-close').classList.add('hidden');
    var rows = doc.querySelectorAll('.cert-row');
    rows.forEach(function (row, i) {
      later(700 + i * 1100, function () { row.classList.add('shown'); PGAudio.stampThud(); });
    });
    later(700 + rows.length * 1100 + 400, function () {
      doc.querySelector('.cert-verdict').classList.add('shown');
      if (series.pass) PGAudio.fanfare(); else PGAudio.sadDrone();
      $('cert-close').classList.remove('hidden');
    });
    $('cert-close').onclick = function () {
      PGAudio.tap();
      $('cert-overlay').classList.add('hidden');
      clearLater();
      if (series.pass) mintType(series, certSeed);
      else { persist(); showRndScore(); }
    };
  }
  function mintType(series, certSeed) {
    WS().rsk++;
    var plate = 'RSK-' + WS().rsk;
    var name = PG2.certCodename(certSeed);
    var s1 = series.shots[0];
    var ty = {
      plate: plate, name: name, target: S.rndTarget, param: series.param || null,
      grade: series.grade, band: series.band, primary: s1.primary,
      unitCost: S.result && S.result.shotCost != null ? S.result.shotCost : PG2.derive(S.assembly, rfp()).cost,
      abuseKind: series.abuseKind, incidents: 0,
      assembly: JSON.parse(JSON.stringify(S.assembly)),
      certSeed: certSeed, t: Date.now()
    };
    WS().types.push(ty);
    persist();
    var t = series.target;
    $('plate-doc').innerHTML =
      '<div class="type-plate">' +
        '<div class="tp-kicker">REDSKY INC · TYPE PLATE</div>' +
        '<div class="tp-plate">' + plate + '</div>' +
        '<div class="tp-name">“' + name + '”</div>' +
        '<span class="tp-ready">PRODUCTION READY</span>' +
        '<div class="tp-spec">' +
          (series.param ? '<div>TEST CARD · ' + t.name + ' <b>' + String(series.param).toUpperCase() + '</b></div>' : '') +
          '<div>' + t.metric + ', CERTIFIED <b>' + series.band.lo + '–' + series.band.hi + ' ' + t.unit + '</b></div>' +
          '<div>CONSISTENCY <b>GRADE ' + series.grade + '</b></div>' +
          '<div>ABUSE · ' + (series.abuseKind === 'hotsoak' ? 'HOT SOAK' : 'WASHBOARD') + ' <b>PASSED</b></div>' +
          '<div>UNIT COST, AS BUILT <b>' + fmt$(ty.unitCost) + '</b></div>' +
        '</div>' +
      '</div>';
    $('plate-overlay').classList.remove('hidden');
    PGAudio.stampThud();
  }
  $('plate-close').addEventListener('click', function () {
    PGAudio.tap();
    $('plate-overlay').classList.add('hidden');
    saveBench();
    showHQ();
  });

  /* ---------- THE PRODUCTION BID BOARD ---------- */
  function weekKey() { return 'W' + Math.floor(Date.now() / 6048e5); }
  function showBids() {
    S.phase = 'bids';
    showUI(null);
    var wall = $('bids-wall');
    wall.innerHTML = '';
    var orders = PG2.genOrders(WS().types, weekKey(), wonCountAll())
      .filter(function (o) { return !WS().doneOrders[o.id]; });
    $('bids-sub').textContent = 'PROCUREMENT ' + weekKey() + ' · ' + orders.length + ' OPEN ORDER' + (orders.length === 1 ? '' : 'S') +
      ' · ACCOUNT ' + cashLabel();
    if (!WS().types.length) {
      wall.innerHTML = '<div class="bids-empty">No certified types on file.</div>';
    }
    WS().types.forEach(function (ty) {
      var t = PG2.TARGETS[ty.target];
      var box = document.createElement('div');
      box.className = 'bid-type';
      var mine = orders.filter(function (o) { return o.plate === ty.plate; });
      box.innerHTML =
        '<div class="bt-head"><span class="bt-plate">' + ty.plate + ' “' + ty.name + '”</span>' +
        '<span class="bt-grade">GRADE ' + ty.grade + (ty.incidents ? ' · ' + ty.incidents + ' QA CALLBACK' + (ty.incidents > 1 ? 'S' : '') : '') + '</span></div>' +
        '<div class="bt-spec">' + t.metric + ' ' + ty.band.lo + '–' + ty.band.hi + ' ' + t.unit +
        (ty.param ? ' · ' + String(ty.param).toUpperCase() + ' CARD' : '') +
        ' · UNIT COST ' + fmt$(ty.unitCost) + '</div>' +
        (mine.length ? '' : '<div class="bt-spec" style="margin-top:8px">No open orders this week. The paper says demand is “seasonal”.</div>');
      mine.forEach(function (order) {
        var row = document.createElement('div');
        row.className = 'bid-order';
        row.innerHTML = '<div class="bo-txt"><b>' + order.buyer + '</b><br>' + order.units + ' UNITS · SEALED BIDS</div>';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = WS().run ? 'WORKSHOP BOOKED' : 'OPEN THE BIDDING';
        btn.disabled = !!WS().run;
        btn.addEventListener('click', function () { PGAudio.tap(); runAuction(ty, order); });
        row.appendChild(btn);
        wall.appendChild(box);
        box.appendChild(row);
      });
      wall.appendChild(box);
    });
    showScreen('scr-bids');
  }
  $('btn-bids-back').addEventListener('click', function () { PGAudio.tap(); showHQ(); });

  /* the auction beat: watch the number climb, then decide */
  function runAuction(ty, order) {
    var au = PG2.auctionRun(ty, order, wonCountAll());
    var doc = $('auction-doc');
    doc.innerHTML =
      '<div class="doc-headrow"><span>FORM RD-3300-B</span><span>' + weekKey() + '</span></div>' +
      '<div class="rfp-no">SEALED-BID OPENING · ' + ty.plate + ' “' + ty.name + '”</div>' +
      '<div class="rfp-title" style="font-size:15px">' + order.units + ' UNITS FOR ' + order.buyer + '</div>' +
      '<hr class="doc-rule">' +
      au.steps.map(function (s) {
        return '<div class="auc-row"><span>' + s.buyer + '</span><span class="au-amt">' + fmt$(s.unit) + ' / UNIT</span></div>';
      }).join('') +
      '<div class="auc-final">GAVEL — ' + fmt$(au.finalUnit) + ' / UNIT<br>' +
        '<span style="font-size:10px;font-weight:400">REVENUE ' + fmt$(au.revenue) + ' · MATERIALS −' + fmt$(au.matCost) +
        ' · <b>NET ' + fmt$(au.net) + '</b> · RUN TIME ' + au.durMin + ' MIN</span></div>';
    $('auction-overlay').classList.remove('hidden');
    $('auction-accept').classList.add('hidden');
    $('auction-decline').classList.add('hidden');
    var rows = doc.querySelectorAll('.auc-row');
    rows.forEach(function (row, i) {
      later(500 + i * 800, function () { row.classList.add('shown'); PGAudio.tick(); });
    });
    later(500 + rows.length * 800 + 300, function () {
      doc.querySelector('.auc-final').classList.add('shown');
      PGAudio.stampThud();
      $('auction-accept').classList.remove('hidden');
      $('auction-decline').classList.remove('hidden');
    });
    $('auction-accept').onclick = function () {
      PGAudio.tap();
      clearLater();
      $('auction-overlay').classList.add('hidden');
      WS().doneOrders[order.id] = 1;
      WS().run = {
        orderId: order.id, plate: ty.plate, name: ty.name, buyer: order.buyer,
        units: order.units, finalUnit: au.finalUnit, net: au.net,
        seedKey: order.seedKey, t0: Date.now(), durMs: au.durMin * 60000
      };
      persist();
      toast('The workshop books the run. ' + order.units + ' articles, ' + au.durMin + ' minutes of honest noise.');
      showHQ();
    };
    $('auction-decline').onclick = function () {
      PGAudio.tap();
      clearLater();
      $('auction-overlay').classList.add('hidden');
      WS().doneOrders[order.id] = 1;   // a spurned buyer does not call twice in one week
      persist();
      showBids();
    };
  }

  /* ---------- delivery day (and the occasional letter) ---------- */
  function deliverRun() {
    var run = WS().run;
    if (!run || runRemainMs() > 0) return;
    var ty = typeByPlate(run.plate);
    var qa = ty ? PG2.qaRoll(ty, { seedKey: run.seedKey, units: run.units }) : null;
    var doc = $('delivery-doc');
    doc.innerHTML =
      '<div class="doc-headrow"><span>FORM RD-4400-D</span><span>' + run.plate + '</span></div>' +
      '<div class="rfp-no">DELIVERY RECEIPT · ' + run.buyer + '</div>' +
      '<div class="rfp-title" style="font-size:15px">' + run.units + '× ' + run.plate + ' “' + run.name + '” — DELIVERED</div>' +
      '<hr class="doc-rule">' +
      '<div class="payline"><span>' + run.units + ' UNITS @ ' + fmt$(run.finalUnit) + '</span><b>' + fmt$(run.finalUnit * run.units) + '</b></div>' +
      '<div class="payline"><span>MATERIALS, AS BUILT</span><b>−' + fmt$(run.finalUnit * run.units - run.net) + '</b></div>' +
      '<div class="payline" style="font-weight:800"><span>NET TO REDSKY</span><b>' + fmt$(run.net) + '</b></div>' +
      (qa ? '<hr class="doc-rule thin"><p class="spec-clause"><span class="cl">' + qa.title + '</span> — ' + qa.cause + '</p>' +
            '<p class="spec-clause fine">' + qa.receipt + '</p>' : '');
    $('delivery-overlay').classList.remove('hidden');
    PGAudio.typeDing();
    $('delivery-close').onclick = function () {
      PGAudio.tap();
      $('delivery-overlay').classList.add('hidden');
      cashAdd(run.net);
      if (qa && ty) {
        ty.incidents = (ty.incidents || 0) + 1;
        SAVE.museum.irs.push({
          t: Date.now(), c: run.plate + ' · FIELD QA', seed: run.seedKey, attempt: 0,
          outcome: qa.title, cause: qa.cause, receipt: qa.receipt,
          where: 'CUSTOMER ACCEPTANCE', phase: 'PRODUCTION', disposition: 'RETURNED WITH LETTER'
        });
        museumFirst('qaletter', 'FIRST QA CALLBACK — THE CUSTOMER MEASURES TOO');
      }
      WS().run = null;
      persist();
      showHQ();
    };
  }

  /* ================= THE LONG SHOT PROGRAM ================= */
  var LS_MIN = 1, LS_MAX = 5000;   // miles
  function lsShowPhase(id) {
    ['ls-mission', 'ls-build', 'ls-dial', 'ls-flight', 'ls-result'].forEach(function (p) {
      $(p).classList.toggle('hidden', p !== id);
    });
    var onBench = (id === 'ls-build');
    $('scr-longshot').classList.toggle('bench', onBench);      // transparent so the 3D rocket shows through
    if (lsBench) { lsBench.active = onBench; if (onBench) lsBench.lastTouch = performance.now(); }
  }
  function lsDifficulty(mi) {
    return mi <= 50 ? { c: 'd-easy', t: 'SHORT RANGE · FORGIVING' }
         : mi <= 600 ? { c: 'd-med', t: 'MEDIUM RANGE · STEADY HANDS' }
         : mi <= 2500 ? { c: 'd-hard', t: 'LONG RANGE · UNFORGIVING' }
         : { c: 'd-max', t: 'STRATEGIC RANGE · A FRACTION OF A DEGREE MATTERS' };
  }
  function showLongShot() {
    if (!S.ls) S.ls = { rangeMi: 250, bearing: 127, type: 'static', moveSpeed: 500, moveHeading: 20,
      build: PG2.lsBuildDefault(), dial: null, result: null };
    if (!SAVE.ls) SAVE.ls = { best: [], solutions: [] };
    S.phase = 'longshot';
    showUI(null);
    lsShowPhase('ls-mission');
    lsRenderMission();
    showScreen('scr-longshot');
  }
  /* the point to actually hit: the target itself, or the convoy's lead intercept */
  function lsAim() {
    if (S.ls.type === 'moving') {
      var cap = PG2.lsCapability(S.ls.build);
      return PG2.lsIntercept(S.ls.rangeMi, S.ls.bearing, S.ls.moveSpeed, S.ls.moveHeading, cap.rangeMax);
    }
    return { rangeMi: S.ls.rangeMi, bearingDeg: S.ls.bearing };
  }
  /* ---------- PHASE 1: the tactical target map ---------- */
  function lsMapGeom() { return { cx: 160, cy: 160, rMax: 132, rMin: 14 }; }
  function lsRangeToR(mi) {   // log scale: 1mi near centre, 5000mi at the rim
    var g = lsMapGeom();
    var t = Math.log(mi / LS_MIN) / Math.log(LS_MAX / LS_MIN);
    return g.rMin + t * (g.rMax - g.rMin);
  }
  function lsRToRange(r) {
    var g = lsMapGeom();
    var t = clamp((r - g.rMin) / (g.rMax - g.rMin), 0, 1);
    return clamp(Math.round(LS_MIN * Math.pow(LS_MAX / LS_MIN, t)), LS_MIN, LS_MAX);
  }
  function lsRenderMission() {
    var g = lsMapGeom(), svg = $('ls-map'), s = '';
    // range rings + labels
    [10, 100, 1000, 5000].forEach(function (mi) {
      var r = lsRangeToR(mi);
      s += '<circle class="lm-ring" cx="' + g.cx + '" cy="' + g.cy + '" r="' + r.toFixed(1) + '"/>';
      s += '<text class="lm-ring-lbl" x="' + g.cx + '" y="' + (g.cy - r + 9).toFixed(1) + '" text-anchor="middle">' + (mi >= 1000 ? (mi / 1000) + 'K' : mi) + ' MI</text>';
    });
    // compass spokes + cardinal marks
    ['N', 'E', 'S', 'W'].forEach(function (d, i) {
      var a = i * 90 * Math.PI / 180;
      s += '<line class="lm-spoke" x1="' + g.cx + '" y1="' + g.cy + '" x2="' + (g.cx + Math.sin(a) * g.rMax) + '" y2="' + (g.cy - Math.cos(a) * g.rMax) + '"/>';
      s += '<text class="lm-ring-lbl" x="' + (g.cx + Math.sin(a) * (g.rMax + 8)) + '" y="' + (g.cy - Math.cos(a) * (g.rMax + 8) + 3) + '" text-anchor="middle">' + d + '</text>';
    });
    // launch site
    s += '<circle class="lm-site-ring" cx="' + g.cx + '" cy="' + g.cy + '" r="7"/><circle class="lm-site" cx="' + g.cx + '" cy="' + g.cy + '" r="2.5"/>';
    // the target
    var tr = lsRangeToR(S.ls.rangeMi), ta = S.ls.bearing * Math.PI / 180;
    var tx = g.cx + Math.sin(ta) * tr, ty = g.cy - Math.cos(ta) * tr;
    s += '<line class="lm-line" x1="' + g.cx + '" y1="' + g.cy + '" x2="' + tx.toFixed(1) + '" y2="' + ty.toFixed(1) + '"/>';
    // moving: draw the drift arrow + the predicted-intercept lead marker
    if (S.ls.type === 'moving') {
      var aim = lsAim(), lr = lsRangeToR(aim.rangeMi), la = aim.bearingDeg * Math.PI / 180;
      var lx = g.cx + Math.sin(la) * lr, ly = g.cy - Math.cos(la) * lr;
      var hx = Math.sin(S.ls.moveHeading * Math.PI / 180), hy = -Math.cos(S.ls.moveHeading * Math.PI / 180);
      s += '<line class="lm-line" style="stroke:#7fd4b8;stroke-dasharray:2 2" x1="' + tx.toFixed(1) + '" y1="' + ty.toFixed(1) + '" x2="' + (tx + hx * 22).toFixed(1) + '" y2="' + (ty + hy * 22).toFixed(1) + '"/>';
      s += '<circle class="lm-target-ring" style="stroke:#7fd4b8" cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="6"/><text class="lm-ring-lbl" x="' + lx.toFixed(1) + '" y="' + (ly - 9).toFixed(1) + '" text-anchor="middle" style="fill:#7fd4b8">LEAD</text>';
    }
    s += '<circle class="lm-target-ring" cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="8"/><circle class="lm-target" cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="3.5"/>';
    svg.innerHTML = s;
    var d = lsDifficulty(S.ls.rangeMi);
    var aimT = lsAim();
    var typeRow = '<div class="ls-type-row">' + ['static', 'hardened', 'moving'].map(function (t) {
      return '<button type="button" class="ls-type' + (S.ls.type === t ? ' on' : '') + '" data-type="' + t + '">' + PG2.LS_TARGET_TYPES[t].name.split(' ')[0] + '</button>';
    }).join('') + '</div>';
    $('ls-mission-read').innerHTML =
      'TARGET · <b>' + S.ls.rangeMi.toLocaleString() + ' mi</b> · BEARING <b>' + Math.round(S.ls.bearing) + '°</b>' +
      (S.ls.type === 'moving' ? ' · ' + S.ls.moveSpeed + ' MPH → INTERCEPT <b>' + aimT.rangeMi.toLocaleString() + ' mi / ' + Math.round(aimT.bearingDeg) + '°</b>' : '') +
      '<br>FLIGHT TIME ≈ ' + PG2.lsFlightTime(aimT.rangeMi).toFixed(0) + ' s · ' + PG2.LS_TARGET_TYPES[S.ls.type].sub +
      '<br><span class="diff ' + d.c + '">' + d.t + '</span>' + typeRow;
    $('ls-mission-read').querySelectorAll('.ls-type').forEach(function (b) {
      b.addEventListener('click', function () {
        PGAudio.tick();
        S.ls.type = b.dataset.type;
        if (S.ls.type === 'moving') { var r = PG2.stream(S.ls.rangeMi + ':' + S.ls.bearing, 'mv'); S.ls.moveHeading = Math.round(r() * 360); S.ls.moveSpeed = 300 + Math.round(r() * 500); }
        lsRenderMission();
      });
    });
  }
  (function () {
    var svg = $('ls-map'), drag = false;
    function place(e) {
      var r = svg.getBoundingClientRect(), g = lsMapGeom();
      var mx = (e.clientX - r.left) / r.width * 320 - g.cx;
      var my = (e.clientY - r.top) / r.height * 320 - g.cy;
      var rr = Math.hypot(mx, my);
      S.ls.rangeMi = lsRToRange(rr);
      var brg = Math.atan2(mx, -my) * 180 / Math.PI;   // 0=N, clockwise
      S.ls.bearing = (brg + 360) % 360;
      lsRenderMission();
    }
    svg.addEventListener('pointerdown', function (e) { if (S.phase !== 'longshot') return; drag = true; svg.setPointerCapture(e.pointerId); place(e); });
    svg.addEventListener('pointermove', function (e) { if (drag) place(e); });
    svg.addEventListener('pointerup', function () { drag = false; });
    svg.addEventListener('pointercancel', function () { drag = false; });
  })();
  $('ls-mission-back').addEventListener('click', function () { PGAudio.tap(); showHQ(); });
  $('ls-mission-go').addEventListener('click', function () { PGAudio.tap(); lsBenchInit(); lsBuildRocket(S.ls.build); lsRenderBuild(); lsShowPhase('ls-build'); });

  /* ---------- PHASE 2: the live 3D build bench ----------
     A turntable rocket you assemble part by part — every choice reshapes the
     3D article in real time. PBR metal + env reflections + a cast shadow,
     matched to the terminal look so the thing you build is the thing you fly. */
  var lsBench = null;
  var LS_AF_DIM = { dart: { len: 1.9, rad: 0.15 }, lance: { len: 2.7, rad: 0.19 }, pillar: { len: 3.5, rad: 0.25 } };
  var LS_WH_DIM = { light: 0.5, std: 0.74, heavy: 1.0, special: 1.35 };
  var LS_MO_STAGES = { single: 1, dual: 2, triple: 3 };
  function lsBenchInit() {
    if (lsBench) return lsBench;
    try {
      var scene = new THREE.Scene();
      scene.background = gradientTexture([[0, '#0a121e'], [0.5, '#14273b'], [1, '#20374f']], true);   // studio backdrop
      scene.environment = envMap('#33506e', '#4a5f78', '#141c26', 150, 'rgba(215,232,255,0.95)');    // studio IBL for the metal
      var camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 120);
      scene.add(new THREE.HemisphereLight(0xcfe0f4, 0x2a3446, 0.75));
      var key = new THREE.DirectionalLight(0xffffff, 1.55); key.position.set(5, 9, 6);
      key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1; key.shadow.camera.far = 34;
      key.shadow.camera.left = -5; key.shadow.camera.right = 5; key.shadow.camera.top = 7; key.shadow.camera.bottom = -4;
      key.shadow.bias = -0.0005; key.shadow.radius = 3; scene.add(key);
      var rim = new THREE.DirectionalLight(0x86acff, 0.75); rim.position.set(-6, 3, -6); scene.add(rim);   // cool product rim
      var fill = new THREE.DirectionalLight(0xffe9cf, 0.42); fill.position.set(-4, 2, 7); scene.add(fill);
      // turntable
      var pad = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.75, 0.28, 56),
        new THREE.MeshStandardMaterial({ color: 0x1a2531, metalness: 0.7, roughness: 0.42, envMapIntensity: 0.8 }));
      pad.position.y = -0.14; pad.receiveShadow = true; scene.add(pad);
      var padTop = new THREE.Mesh(new THREE.CircleGeometry(2.42, 56),
        new THREE.MeshStandardMaterial({ color: 0x27384a, metalness: 0.35, roughness: 0.7 }));
      padTop.rotation.x = -Math.PI / 2; padTop.position.y = 0.005; padTop.receiveShadow = true; scene.add(padTop);
      var rocket = new THREE.Group(); scene.add(rocket);
      lsBench = { scene: scene, camera: camera, rocket: rocket, theta: -0.75, phi: 0.42, vel: 0, spin: true, lastTouch: 0, active: false };
      lsBenchCam();
    } catch (e) { lsBench = null; }
    return lsBench;
  }
  function lsMetal(col, rough) { return new THREE.MeshStandardMaterial({ color: col, metalness: 0.9, roughness: rough != null ? rough : 0.3, envMapIntensity: 1.0 }); }
  function lsBuildRocket(build) {
    if (!lsBenchInit()) return;
    var g = lsBench.rocket;
    while (g.children.length) { var c = g.children.pop(); if (c.geometry) c.geometry.dispose(); }
    var af = LS_AF_DIM[build.airframe], noseLen = LS_WH_DIM[build.warhead] * 1.4, stages = LS_MO_STAGES[build.motor];
    var rad = af.rad, bodyLen = af.len, y0 = 0.45;   // body base above the pad; motor hangs below
    // body
    var body = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.05, bodyLen, 44), lsMetal(0xc4ced8, 0.28));
    body.position.y = y0 + bodyLen / 2; body.castShadow = true; g.add(body);
    // painted service band + a stencil ring
    var band = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.015, rad * 1.05, 0.16, 44), lsMetal(0xd8492f, 0.5));
    band.position.y = y0 + bodyLen * 0.62; band.castShadow = true; g.add(band);
    // warhead nose (bigger/blunter with mass)
    var nose = new THREE.Mesh(new THREE.ConeGeometry(rad, noseLen, 44),
      new THREE.MeshStandardMaterial({ color: 0xb23a2a, metalness: 0.45, roughness: 0.5, envMapIntensity: 0.9 }));
    nose.position.y = y0 + bodyLen + noseLen / 2; nose.castShadow = true; g.add(nose);
    // guidance: fin span + a star-tracker sensor ring
    var finCount = build.guidance === 'star' ? 3 : 4;
    var finSpan = build.guidance === 'fin' ? 0.6 : build.guidance === 'inertial' ? 0.44 : 0.3;
    for (var i = 0; i < finCount; i++) {
      var ang = i * (Math.PI * 2 / finCount);
      var fin = new THREE.Mesh(new THREE.BoxGeometry(0.035, finSpan, finSpan * 1.35), lsMetal(0x9aa4ad, 0.4));
      fin.position.set(Math.sin(ang) * (rad + finSpan * 0.48), y0 + finSpan * 0.7, Math.cos(ang) * (rad + finSpan * 0.48));
      fin.rotation.y = ang; fin.castShadow = true; g.add(fin);
    }
    if (build.guidance === 'star') {
      var sring = new THREE.Mesh(new THREE.TorusGeometry(rad * 1.16, 0.028, 10, 28),
        new THREE.MeshStandardMaterial({ color: 0x63cfff, metalness: 0.4, roughness: 0.3, emissive: 0x1b6f9c, emissiveIntensity: 0.6 }));
      sring.position.y = y0 + bodyLen * 0.9; sring.rotation.x = Math.PI / 2; g.add(sring);
    }
    // motor: a skirt + one nozzle bell per stage clustered at the base
    var skirt = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.05, rad * 1.25, 0.32, 32), lsMetal(0x39434f, 0.5));
    skirt.position.y = y0 - 0.14; skirt.castShadow = true; g.add(skirt);
    var bellR = rad * (stages === 1 ? 0.9 : stages === 2 ? 0.62 : 0.5);
    var offs = stages === 1 ? [[0, 0]] : stages === 2 ? [[-bellR * 0.9, 0], [bellR * 0.9, 0]]
      : [[0, bellR * 1.0], [-bellR * 0.95, -bellR * 0.55], [bellR * 0.95, -bellR * 0.55]];
    offs.forEach(function (o) {
      var bell = new THREE.Mesh(new THREE.CylinderGeometry(bellR * 0.55, bellR, 0.34, 22),
        new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.85, roughness: 0.35 }));
      bell.position.set(o[0], y0 - 0.42, o[1]); bell.castShadow = true; g.add(bell);
    });
    // frame the whole article in the upper stage (the control sheet owns the lower ~45%)
    var top = y0 + bodyLen + noseLen, bot = y0 - 0.6, Hr = top - bot, ctr = (top + bot) / 2;
    lsBench.fitR = clamp(Hr / 0.33, 9, 18);
    lsBench.fitEye = ctr + Hr * 0.06;
    lsBench.fitLook = ctr - Hr * 0.22;                    // bias the article up out from behind the sheet
    if (lsBench) lsBench.lastTouch = performance.now();   // reset idle-spin so the change is visible face-on
  }
  function lsBenchCam() {
    var b = lsBench, r = b.fitR || 11;
    b.camera.position.set(Math.sin(b.theta) * r * Math.cos(b.phi), (b.fitEye || 2.4) + Math.sin(b.phi) * r * 0.5, Math.cos(b.theta) * r * Math.cos(b.phi));
    b.camera.lookAt(0, b.fitLook != null ? b.fitLook : 2, 0);
  }
  function lsBenchStep(dt, now) {
    var b = lsBench;
    if (b.spin && now - b.lastTouch > 2200) b.theta += dt * 0.32;
    else if (Math.abs(b.vel) > 0.0008) { b.theta += b.vel * dt; b.vel *= Math.exp(-4 * dt); }
    b.phi = clamp(b.phi, 0.06, 1.05);
    lsBenchCam();
    renderScene(b.scene, b.camera);
  }
  // drag the stage to orbit the rocket
  (function () {
    var stage = $('ls-build-stage'); if (!stage) return;
    var drag = false, lx = 0, ly = 0;
    stage.addEventListener('pointerdown', function (e) { if (!lsBench) return; drag = true; lx = e.clientX; ly = e.clientY; lsBench.lastTouch = performance.now(); stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', function (e) {
      if (!drag || !lsBench) return;
      var dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      lsBench.theta -= dx * 0.01; lsBench.phi += dy * 0.006; lsBench.vel = -dx * 0.01 / Math.max(0.001, 0.016);
      lsBench.lastTouch = performance.now();
    });
    stage.addEventListener('pointerup', function () { drag = false; });
    stage.addEventListener('pointercancel', function () { drag = false; });
  })();

  /* ---------- PHASE 2: the stepped builder ---------- */
  function lsRenderBuild() {
    var aim = lsAim();
    $('ls-build-target').textContent = (S.ls.type === 'moving' ? 'INTERCEPT ' : 'TARGET ') + aim.rangeMi.toLocaleString() + ' MI · BRG ' + Math.round(aim.bearingDeg) + '°' + (S.ls.type === 'hardened' ? ' · HARDENED' : '');
    var wrap = $('ls-build-steps');
    wrap.innerHTML = '';
    PG2.LS_STEPS.forEach(function (step) {
      var row = document.createElement('div'); row.className = 'ls-step';
      var opts = step.order.map(function (id) {
        var o = step.cat[id], on = S.ls.build[step.key] === id;
        return '<button type="button" class="ls-opt' + (on ? ' on' : '') + '" data-step="' + step.key + '" data-opt="' + id + '">' +
          '<div class="lo-name">' + o.name + '</div><div class="lo-sub">' + o.sub + '</div></button>';
      }).join('');
      row.innerHTML = '<div class="ls-step-h">' + step.label + '</div><div class="ls-opts">' + opts + '</div>';
      wrap.appendChild(row);
    });
    wrap.querySelectorAll('.ls-opt').forEach(function (b) {
      b.addEventListener('click', function () {
        PGAudio.tick();
        S.ls.build[b.dataset.step] = b.dataset.opt;
        lsBuildRocket(S.ls.build);     // reshape the 3D article live
        lsRenderBuild();
      });
    });
    var cap = PG2.lsCapability(S.ls.build);
    var reaches = aim.rangeMi <= cap.rangeMax;
    $('ls-build-caps').innerHTML =
      'MAX RANGE <b>' + cap.rangeMax.toLocaleString() + ' mi</b>' +
      ' · ACCURACY <b>' + cap.accClass + '</b>' +
      ' · MASS <b>' + cap.mass + ' kg</b>' +
      ' · <span class="' + (reaches ? 'reach-ok' : 'reach-no') + '">' + (reaches ? 'REACHES TARGET ✓' : 'CANNOT REACH — BIGGER MOTOR') + '</span>';
    $('ls-build-go').disabled = !reaches;
  }
  $('ls-build-back').addEventListener('click', function () { PGAudio.tap(); lsRenderMission(); lsShowPhase('ls-mission'); });
  $('ls-build-go').addEventListener('click', function () {
    PGAudio.tap();
    var aim = lsAim();
    var opt = PG2.lsOptimal(S.ls.build, aim.rangeMi, aim.bearingDeg);
    S.ls.rangeMax = opt.rangeMax;
    // THE ENGINEER — Ballistics preloads a solution that lands within 5–20% of
    // target: close, but never a hit. You correct it and lock it in. Seeded, so
    // a mission is a fixed puzzle, not a dice roll.
    var r = PG2.stream(aim.rangeMi + ':' + aim.bearingDeg + ':' + S.ls.type, 'ls:preload');
    var f = 0.05 + r() * 0.15, th = r() * 6.2832;
    var cross = f * aim.rangeMi * Math.sin(th), down = f * aim.rangeMi * Math.cos(th);
    S.ls.preErr = Math.max(1, Math.round(f * 100));
    S.ls.dial = {
      elev: 45 + (r() - 0.5) * 3,
      azimuth: (aim.bearingDeg + Math.atan2(cross, aim.rangeMi) * 180 / Math.PI + 360) % 360,
      rangeSet: clamp(Math.round(aim.rangeMi - down), 1, opt.rangeMax),
      throttle: 1, gyro: null
    };
    lsRenderDial(); lsShowPhase('ls-dial');
  });

  /* ---------- PHASE 3: the flight-plan console ---------- */
  // deterministic mean impact (no noise) + the CEP the gyro shrinks — the honest
  // preview, from the exact numbers lsResolve will use at launch.
  function lsProject(build, d, aimMi, aimBearing) {
    var cap = PG2.lsCapability(build), gu = cap.guidance, g = d.gyro == null ? 0 : d.gyro;
    var elevEff = Math.max(0, Math.sin(2 * d.elev * Math.PI / 180));
    var thr = d.throttle == null ? 1 : d.throttle;
    var achieved = Math.min(d.rangeSet, cap.rangeMax) * elevEff * thr;
    var aRad = d.azimuth * Math.PI / 180, tRad = aimBearing * Math.PI / 180;
    var ex = achieved * Math.sin(aRad) - aimMi * Math.sin(tRad);
    var ey = achieved * Math.cos(aRad) - aimMi * Math.cos(tRad);
    var down = ex * Math.sin(tRad) + ey * Math.cos(tRad);
    var cross = ex * Math.cos(tRad) - ey * Math.sin(tRad);
    var dispMi = gu.cepBase * aimMi + gu.driftK * (1 - g) * aimMi * 0.010 / Math.max(cap.stab, 0.4);
    var missMi = Math.hypot(down, cross);
    var hit = Math.max(0.5, aimMi * 0.006);
    var reachable = aimMi <= cap.rangeMax * 1.02;
    return { down: down, cross: cross, missMi: missMi, dispMi: dispMi,
      bull: Math.max(0.15, aimMi * 0.0016), hit: hit, near: Math.max(2.5, aimMi * 0.025),
      reachable: reachable, locked: reachable && (missMi + dispMi) <= hit,
      azOk: Math.abs(cross) <= hit * 0.75, dnOk: Math.abs(down) <= hit * 0.75,
      gyroOk: d.gyro != null && dispMi <= hit };
  }
  function lsRenderDial() {
    S.phase = 'longshot'; showScreen('scr-longshot'); lsShowPhase('ls-dial');
    var aim = lsAim();
    $('ls-dial-target').textContent = (S.ls.type === 'moving' ? 'INTERCEPT ' : 'TARGET ') + aim.rangeMi.toLocaleString() + ' MI · BRG ' + Math.round(aim.bearingDeg) + '°' + (S.ls.type === 'hardened' ? ' · HARDENED' : S.ls.type === 'moving' ? ' · ' + S.ls.moveSpeed + ' MPH' : '');
    $('ls-dials').innerHTML =
      '<div class="fp-eng" id="fp-eng"></div>' +
      '<svg id="fp-plot" class="fp-plot" viewBox="0 0 200 200" aria-label="impact plot"></svg>' +
      '<div class="fp-inst-h">BURN PLAN · CUT THE ENGINE, GLIDE IT IN <span id="fp-burn-read"></span></div>' +
      '<svg id="fp-burn" class="fp-burn" viewBox="0 0 300 122" aria-label="burn profile"></svg>' +
      '<div class="fp-thr-row"><span>THROTTLE</span><div class="fp-thr" id="fp-thr"><div class="fp-thr-fill" id="fp-thr-fill"></div><div class="fp-thr-knob" id="fp-thr-knob"></div></div><b id="fp-thr-val"></b></div>' +
      '<div class="fp-row">' +
        '<div class="fp-inst"><div class="fp-inst-h">HEADING <span id="fp-head-read"></span></div><svg id="fp-head" class="fp-rose" viewBox="0 0 100 100"></svg>' +
          '<div class="fp-fine" data-axis="head"><button type="button" data-d="-1">−1°</button><button type="button" data-d="-0.1">−.1</button><button type="button" data-d="0.1">+.1</button><button type="button" data-d="1">+1°</button></div></div>' +
        '<div class="fp-inst"><div class="fp-inst-h">LOFT <span id="fp-loft-read"></span></div><svg id="fp-loft" class="fp-loft" viewBox="0 0 100 100"></svg>' +
          '<div class="fp-fine" data-axis="loft"><button type="button" data-d="-1">−1°</button><button type="button" data-d="-0.1">−.1</button><button type="button" data-d="0.1">+.1</button><button type="button" data-d="1">+1°</button></div></div>' +
      '</div>' +
      '<button type="button" id="ls-gyro-btn" class="ls-gyro-btn"></button>';
    lsWireDial();
    lsDialUpdate();
  }
  function lsWireDial() {
    var d = S.ls.dial, rmax = S.ls.rangeMax, aim = lsAim();
    function dragEl(id, fn) {
      var el = $(id); if (!el) return;
      function at(e) { var r = el.getBoundingClientRect(); fn(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)); lsDialUpdate(); }
      el.addEventListener('pointerdown', function (e) { el.setPointerCapture(e.pointerId); el._drag = true; PGAudio.tick(); at(e); });
      el.addEventListener('pointermove', function (e) { if (el._drag) at(e); });
      el.addEventListener('pointerup', function () { el._drag = false; });
      el.addEventListener('pointercancel', function () { el._drag = false; });
    }
    var xMax = Math.min(rmax, Math.max(aim.rangeMi * 1.9, aim.rangeMi + 50));   // window the burn axis around the target
    dragEl('fp-burn', function (fx) { d.rangeSet = clamp(Math.round(((fx * 300 - 12) / 276) * xMax), 1, rmax); });
    dragEl('fp-thr', function (fx) { d.throttle = clamp(0.85 + fx * 0.30, 0.85, 1.15); });
    dragEl('fp-head', function (fx, fy) { d.azimuth = (Math.atan2(fx * 100 - 50, -(fy * 100 - 50)) * 180 / Math.PI + 360) % 360; });
    dragEl('fp-loft', function (fx, fy) { var e = clamp(20 + (1 - fy) * 50, 20, 70); if (Math.abs(e - 45) < 1.6) e = 45; d.elev = e; });
    $('ls-dials').querySelectorAll('.fp-fine').forEach(function (grp) {
      var axis = grp.dataset.axis;
      grp.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          PGAudio.tick(); var dv = parseFloat(b.dataset.d);
          if (axis === 'head') d.azimuth = (d.azimuth + dv + 360) % 360; else d.elev = clamp(d.elev + dv, 20, 70);
          lsDialUpdate();
        });
      });
    });
    $('ls-gyro-btn').addEventListener('click', function () { PGAudio.tap(); openGyroBench(); gyroSt.lsTarget = true; });
  }
  function lsDialUpdate() {
    var d = S.ls.dial, rmax = S.ls.rangeMax, aim = lsAim();
    var pr = lsProject(S.ls.build, d, aim.rangeMi, aim.bearingDeg);
    var col = pr.locked ? '#7ed49a' : '#ffb570';
    $('fp-eng').innerHTML = 'BALLISTICS · PROPOSED SOLUTION' +
      '<span class="fp-eng-sub">You’re ~' + (S.ls.preErr || 10) + '% off. Correct heading, burn cutoff & throttle, align the gyro — walk it into the ring and LOCK.</span>';
    // impact plot — auto-zooms as the marker closes on the bull
    var span = Math.max(pr.missMi * 1.3, pr.hit * 3.0, pr.dispMi * 1.6, aim.rangeMi * 0.0008);
    function R(mi) { return clamp(88 * mi / span, 0, 97); }
    var mx = clamp(88 * pr.cross / span, -97, 97), my = clamp(88 * pr.down / span, -97, 97);
    $('fp-plot').innerHTML =
      '<circle cx="100" cy="100" r="' + R(pr.near).toFixed(1) + '" class="fpp-ring"/>' +
      '<circle cx="100" cy="100" r="' + R(pr.hit).toFixed(1) + '" class="fpp-hit"/>' +
      '<circle cx="100" cy="100" r="' + R(pr.bull).toFixed(1) + '" class="fpp-bull"/>' +
      '<line x1="100" y1="84" x2="100" y2="116" class="fpp-cross"/><line x1="84" y1="100" x2="116" y2="100" class="fpp-cross"/>' +
      '<circle cx="' + (100 + mx).toFixed(1) + '" cy="' + (100 - my).toFixed(1) + '" r="' + R(pr.dispMi).toFixed(1) + '" class="fpp-cep" style="stroke:' + col + '"/>' +
      '<circle cx="' + (100 + mx).toFixed(1) + '" cy="' + (100 - my).toFixed(1) + '" r="4.5" fill="' + col + '"/>';
    // burn graph — x windowed around the target so the control is precise where it matters
    var thr = d.throttle == null ? 1 : d.throttle;
    var xMax = Math.min(rmax, Math.max(aim.rangeMi * 1.9, aim.rangeMi + 50));
    function BX(mi) { return 12 + clamp(mi / xMax, 0, 1) * 276; }
    function TY(t) { return 106 - clamp((t - 0.6) / 0.6, 0, 1) * 92; }
    var cutX = BX(d.rangeSet), py = TY(thr), tgtX = BX(aim.rangeMi), impX = BX(aim.rangeMi + pr.down);
    $('fp-burn').innerHTML =
      '<rect x="12" y="' + py.toFixed(1) + '" width="' + Math.max(0, cutX - 12).toFixed(1) + '" height="' + (106 - py).toFixed(1) + '" class="fpb-bar"/>' +
      '<path d="M ' + cutX.toFixed(1) + ' ' + py.toFixed(1) + ' Q ' + ((cutX + impX) / 2).toFixed(1) + ' ' + (py - 12).toFixed(1) + ' ' + impX.toFixed(1) + ' 106" class="fpb-glide" style="stroke:' + col + '"/>' +
      '<line x1="' + tgtX.toFixed(1) + '" y1="8" x2="' + tgtX.toFixed(1) + '" y2="106" class="fpb-tgt"/><text x="' + tgtX.toFixed(1) + '" y="119" class="fpb-txt" text-anchor="middle">TGT</text>' +
      '<line x1="12" y1="106" x2="288" y2="106" class="fpb-ground"/>' +
      '<line x1="' + cutX.toFixed(1) + '" y1="' + py.toFixed(1) + '" x2="' + cutX.toFixed(1) + '" y2="106" class="fpb-cut"/><circle cx="' + cutX.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="6" class="fpb-cuth"/>';
    $('fp-burn-read').textContent = 'CUT ' + Math.round(d.rangeSet).toLocaleString() + ' mi';
    var tf = clamp((thr - 0.85) / 0.30, 0, 1);
    $('fp-thr-fill').style.width = (tf * 100) + '%'; $('fp-thr-knob').style.left = (tf * 100) + '%';
    $('fp-thr-val').textContent = Math.round(thr * 100) + '%';
    // heading rose
    var hAng = d.azimuth * Math.PI / 180, tAng = aim.bearingDeg * Math.PI / 180;
    $('fp-head').innerHTML =
      '<circle cx="50" cy="50" r="44" class="fpr-face"/><circle cx="50" cy="50" r="44" class="fpr-rim"/>' +
      '<line x1="50" y1="50" x2="' + (50 + Math.sin(tAng) * 41).toFixed(1) + '" y2="' + (50 - Math.cos(tAng) * 41).toFixed(1) + '" class="fpr-tgt"/>' +
      '<line x1="50" y1="50" x2="' + (50 + Math.sin(hAng) * 37).toFixed(1) + '" y2="' + (50 - Math.cos(hAng) * 37).toFixed(1) + '" class="fpr-needle" style="stroke:' + (pr.azOk ? '#7ed49a' : '#ffb570') + '"/>' +
      '<circle cx="50" cy="50" r="3.2" fill="#cfe0f4"/>';
    $('fp-head-read').textContent = d.azimuth.toFixed(1) + '°';
    // loft arc
    var lf = (d.elev - 20) / 50, apexY = 84 - lf * 66;
    $('fp-loft').innerHTML =
      '<line x1="10" y1="84" x2="90" y2="84" class="fpl-ground"/>' +
      '<path d="M 12 84 Q 50 ' + apexY.toFixed(1) + ' 88 84" class="fpl-arc" style="stroke:' + (Math.abs(d.elev - 45) < 3 ? '#7ed49a' : '#ffb570') + '"/>';
    $('fp-loft-read').textContent = d.elev.toFixed(1) + '°';
    // gyro
    $('ls-gyro-btn').className = 'ls-gyro-btn' + (d.gyro == null ? ' warn' : '');
    $('ls-gyro-btn').innerHTML = d.gyro == null ? '⟲ ALIGN THE GYRO — UNCAGED' : '⟲ GYRO ALIGNED ' + Math.round(d.gyro * 100) + '% · RE-RUN';
    // lock strip + launch
    var launch = $('ls-dial-launch');
    if (pr.locked) {
      $('ls-solution').innerHTML = 'FIRE CONTROL · <b class="sol-nominal">● SOLUTION LOCKED — SEND IT</b>';
      launch.classList.add('locked'); launch.textContent = 'LAUNCH ▲';
    } else {
      var need = [];
      if (!pr.reachable) need.push('RANGE'); if (!pr.azOk) need.push('HEADING');
      if (!pr.dnOk) need.push('BURN'); if (!pr.gyroOk) need.push('GYRO');
      $('ls-solution').innerHTML = 'FIRE CONTROL · <b class="sol-coarse">CORRECT: ' + need.join(' · ') + '</b> <span class="fp-miss">proj. miss ' + pr.missMi.toFixed(pr.missMi < 10 ? 2 : 1) + ' mi</span>';
      launch.classList.remove('locked'); launch.textContent = 'LAUNCH ▲ · UNLOCKED';
    }
  }
  $('ls-dial-back').addEventListener('click', function () { PGAudio.tap(); lsRenderBuild(); lsShowPhase('ls-build'); });
  $('ls-dial-launch').addEventListener('click', function () {
    PGAudio.init(); PGAudio.armLatch();
    S.ls.seed = PG2.makeSeed().toUpperCase();
    var aim = lsAim();
    S.ls.result = PG2.lsResolve(S.ls.build, S.ls.dial, aim.rangeMi, aim.bearingDeg, S.ls.seed, { hardened: S.ls.type === 'hardened' });
    lsFlight();
  });

  /* ---------- PHASE 4: real-time mission-control flight ---------- */
  var lsFly = null;
  function lsFlight() {
    lsShowPhase('ls-flight');
    var res = S.ls.result;
    var W2 = 360, H2 = 200;
    // static arc backdrop (ghost = planned parabola to target; live arc fills over it)
    var tgtX = W2 * 0.9;
    var apexY = clamp(H2 - 20 - (res.apogeeMi / Math.max(res.targetMi, 1)) * 260, 24, H2 - 60);
    var grid = '';
    for (var gx = 0; gx <= W2; gx += 45) grid += '<line class="mca-grid" x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + H2 + '"/>';
    for (var gy = 0; gy <= H2; gy += 40) grid += '<line class="mca-grid" x1="0" y1="' + gy + '" x2="' + W2 + '" y2="' + gy + '"/>';
    $('ls-mc-arc').innerHTML = grid +
      '<line class="mca-ground" x1="0" y1="' + (H2 - 18) + '" x2="' + W2 + '" y2="' + (H2 - 18) + '"/>' +
      '<path class="mca-arc-ghost" d="M 20 ' + (H2 - 18) + ' Q ' + (tgtX / 2) + ' ' + (apexY - 30) + ' ' + tgtX + ' ' + (H2 - 18) + '"/>' +
      '<path class="mca-arc" id="mca-live" d=""/>' +
      '<circle class="mca-target" cx="' + tgtX + '" cy="' + (H2 - 18) + '" r="4"/>' +
      '<circle class="mca-missile" id="mca-m" cx="20" cy="' + (H2 - 18) + '" r="3.5"/>' +
      '<text class="mca-lbl" x="' + tgtX + '" y="' + (H2 - 24) + '" text-anchor="middle">TGT</text>';
    // track handoff nodes
    var stations = ['LAUNCH', 'DOWNRANGE 1', 'MID-COURSE', 'TRACKING 7', 'TERMINAL'];
    var tk = '';
    stations.forEach(function (st, i) {
      var x = 20 + i * (320 / (stations.length - 1));
      tk += '<line class="mct-line" id="mct-l' + i + '" x1="' + (i ? 20 + (i - 1) * (320 / (stations.length - 1)) : 20) + '" y1="20" x2="' + x + '" y2="20"/>';
    });
    stations.forEach(function (st, i) {
      var x = 20 + i * (320 / (stations.length - 1));
      tk += '<circle class="mct-node" id="mct-n' + i + '" cx="' + x + '" cy="20" r="3"/>' +
        '<text class="mct-lbl" x="' + x + '" y="34" text-anchor="middle">' + st + '</text>';
    });
    $('ls-mc-track').innerHTML = tk;
    $('ls-warp').classList.remove('on'); $('ls-warp').textContent = 'SKIP →';
    lsFly = { el: 0, lastNow: performance.now(), dur: res.flightT, res: res, W2: W2, H2: H2, tgtX: tgtX, apexY: apexY,
              stations: stations, lastStation: -1, done: false, raf: 0 };
    lsFlyStep();
  }
  function lsFlyStep() {
    if (!lsFly || lsFly.done) return;
    var now = performance.now();
    var dtReal = Math.min((now - lsFly.lastNow) / 1000, 0.05); lsFly.lastNow = now;
    // AUTO-WARP: the descent is the event, not the wait. Short flights play
    // in real time; long ones fast-forward the mid-course to a bounded montage,
    // easing back near the hand-off so the 3D terminal doesn't teleport in.
    var dur = lsFly.dur, kEst = clamp(lsFly.el / dur, 0, 1);
    var base = Math.max(1, dur / clamp(dur, 4, 8));
    var warp = kEst < 0.06 ? 1 : (kEst > 0.88 ? Math.max(1, base * 0.3) : base);
    lsFly.el += dtReal * warp;
    var el = lsFly.el;
    var k = clamp(el / lsFly.dur, 0, 1);
    var res = lsFly.res, W2 = lsFly.W2, H2 = lsFly.H2, tgtX = lsFly.tgtX;
    // trajectory: parabola; downrange fraction = k, height = arc. Terminal drifts to the ACTUAL impact.
    var groundY = H2 - 18;
    var landFrac = res.reachable ? clamp((res.targetMi + res.downMi) / res.targetMi, 0.2, 1.25) : (res.cap.rangeMax / res.targetMi);
    var mx = 20 + k * (tgtX - 20) * (res.reachable ? 1 : landFrac);
    var arcH = Math.sin(k * Math.PI) * (groundY - lsFly.apexY);
    var my = groundY - arcH;
    $('mca-m').setAttribute('cx', mx.toFixed(1));
    $('mca-m').setAttribute('cy', my.toFixed(1));
    // live arc path
    var pts = 'M 20 ' + groundY;
    for (var i = 1; i <= 24; i++) {
      var kk = k * i / 24;
      var px = 20 + kk * (tgtX - 20) * (res.reachable ? 1 : landFrac);
      var py = groundY - Math.sin(kk * Math.PI) * (groundY - lsFly.apexY);
      pts += ' L ' + px.toFixed(1) + ' ' + py.toFixed(1);
    }
    $('mca-live').setAttribute('d', pts);
    // clock + phase + telemetry
    var secs = el;
    $('ls-mc-clock').textContent = 'T+' + String(Math.floor(secs / 60)).padStart(2, '0') + ':' + (secs % 60).toFixed(1).padStart(4, '0');
    var phase = k < 0.12 ? 'BOOST' : k < 0.45 ? 'ASCENT' : k < 0.62 ? 'APOGEE' : k < 0.9 ? 'DESCENT' : 'TERMINAL';
    $('ls-mc-phase').textContent = phase;
    var alt = Math.round(arcH / (groundY - lsFly.apexY) * res.apogeeMi * 5.28 * 1000);   // ~feet, flavour
    var downrange = Math.round(k * res.targetMi);
    var vel = Math.round((res.targetMi * 3600 / lsFly.dur) * (0.6 + 0.8 * Math.cos(k * Math.PI)) );
    $('ls-mc-tele').innerHTML =
      '<div class="t-cell"><div class="t-lbl">ALTITUDE</div><div class="t-val">' + Math.max(0, alt).toLocaleString() + ' ft</div></div>' +
      '<div class="t-cell"><div class="t-lbl">DOWNRANGE</div><div class="t-val">' + downrange.toLocaleString() + ' mi</div></div>' +
      '<div class="t-cell"><div class="t-lbl">VELOCITY</div><div class="t-val">' + Math.max(0, vel).toLocaleString() + ' mph</div></div>';
    // station handoffs
    var stIdx = Math.min(lsFly.stations.length - 1, Math.floor(k * lsFly.stations.length));
    if (stIdx > lsFly.lastStation) {
      lsFly.lastStation = stIdx;
      for (var n = 0; n <= stIdx; n++) { $('mct-n' + n).classList.add('on'); if (n > 0) $('mct-l' + n).classList.add('mct-done'); }
      PGAudio.tick();
      var caps = ['Ignition. The article clears the rail.', 'Downrange station has it — telemetry nominal.',
        'Mid-course. The gyro holds the line, or it doesn’t.', 'Tracking Seven has acquired. Terminal geometry locking.',
        'Terminal. The desert comes up to meet it.'];
      $('ls-mc-caption').textContent = caps[stIdx];
    }
    // hand off to the 3D view at apogee — the whole descent plays in 3D, the 2D arc is just the boost/ascent pre-roll
    if (k >= 0.58) { lsFly.done = true; lsImpact(); return; }
    lsFly.raf = requestAnimationFrame(lsFlyStep);
  }
  $('ls-warp').addEventListener('click', function () {
    if (!lsFly || lsFly.done) return;
    PGAudio.tap();
    lsFly.el = Math.max(lsFly.el, lsFly.dur * 0.9);   // cut the montage — jump to the terminal hand-off
    $('ls-warp').classList.add('on');
  });
  function lsImpact() { lsTerminal(); }   // hand off to the 3D terminal descent

  /* ---------- PHASE 4.5: the 3D terminal descent ---------- */
  var lsTerm = null;
  function lsGroundTex() {
    return canvasTex('lsground', 1024, 1024, function (x, w, h) {
      var g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#5c4630'); g.addColorStop(0.5, '#6a5136'); g.addColorStop(1, '#493725');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      var r = PG2.stream('lsground', 'sand');
      for (var i = 0; i < 70; i++) {                     // broad dune shading
        var bx = r() * w, by = r() * h, br = 40 + r() * 170, lite = r() > 0.5;
        var rg = x.createRadialGradient(bx, by, 0, bx, by, br);
        rg.addColorStop(0, lite ? 'rgba(158,126,84,0.10)' : 'rgba(26,18,12,0.13)');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = rg; x.beginPath(); x.arc(bx, by, br, 0, 7); x.fill();
      }
      for (var j = 0; j < 9000; j++) {                   // fine sand tooth
        var l2 = r() > 0.5;
        x.fillStyle = 'rgba(' + (l2 ? '214,184,132' : '38,26,16') + ',' + (0.05 + r() * 0.12).toFixed(3) + ')';
        x.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r());
      }
      for (var s = 0; s < 240; s++) {                    // scattered scrub
        x.fillStyle = 'rgba(58,62,36,' + (0.18 + r() * 0.4).toFixed(2) + ')';
        x.beginPath(); x.arc(r() * w, r() * h, 1 + r() * 2.4, 0, 7); x.fill();
      }
    });
  }
  /* a normal map baked from a height field (dunes + ripple grain) so the sand
     catches real relief under the grazing dusk light. Linear-encoded — a
     normal map through the sRGB path would light wrong. Built once, cached. */
  function lsGroundNormalTex() {
    if (TEXCACHE['lsgroundN']) return TEXCACHE['lsgroundN'];
    var N = 256;
    var hc = document.createElement('canvas'); hc.width = N; hc.height = N;
    var hx = hc.getContext('2d');
    hx.fillStyle = '#808080'; hx.fillRect(0, 0, N, N);
    var r = PG2.stream('lsgroundN', 'h');
    for (var i = 0; i < 34; i++) {                       // low-freq dunes
      var bx = r() * N, by = r() * N, br = 22 + r() * 70, up = r() > 0.5;
      var g = hx.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, up ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)');
      g.addColorStop(1, 'rgba(128,128,128,0)');
      hx.fillStyle = g; hx.beginPath(); hx.arc(bx, by, br, 0, 7); hx.fill();
    }
    for (var j = 0; j < 3600; j++) {                     // ripple grain
      var v = r() > 0.5 ? 255 : 0;
      hx.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.05 + r() * 0.09).toFixed(3) + ')';
      hx.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r());
    }
    var hd = hx.getImageData(0, 0, N, N).data;
    function H(px, py) { px = (px + N) % N; py = (py + N) % N; return hd[(py * N + px) * 4] / 255; }
    var nc = document.createElement('canvas'); nc.width = N; nc.height = N;
    var nx = nc.getContext('2d'), nd = nx.createImageData(N, N), st = 2.4;
    for (var y = 0; y < N; y++) for (var xx = 0; xx < N; xx++) {
      var ddx = (H(xx - 1, y) - H(xx + 1, y)) * st, ddy = (H(xx, y - 1) - H(xx, y + 1)) * st;
      var len = Math.hypot(ddx, ddy, 1), o = (y * N + xx) * 4;
      nd.data[o] = Math.round((ddx / len * 0.5 + 0.5) * 255);
      nd.data[o + 1] = Math.round((ddy / len * 0.5 + 0.5) * 255);
      nd.data[o + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
      nd.data[o + 3] = 255;
    }
    nx.putImageData(nd, 0, 0);
    var tex = new THREE.CanvasTexture(nc);
    tex.encoding = THREE.LinearEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(10, 10);
    TEXCACHE['lsgroundN'] = tex;
    return tex;
  }
  /* a dark tactical grid for the strike-camera ground — near-black with thin
     glowing scan lines, a brighter major grid, and a soft radial falloff. */
  function lsGridTex() {
    return canvasTex('lsgrid', 1024, 1024, function (x, w, h) {
      x.fillStyle = '#04070c'; x.fillRect(0, 0, w, h);
      for (var i = 0; i <= 32; i++) {                       // minor grid
        var p = i / 32 * w, major = (i % 8 === 0);
        x.strokeStyle = major ? 'rgba(90,150,190,0.55)' : 'rgba(56,96,124,0.22)';
        x.lineWidth = major ? 2 : 1;
        x.beginPath(); x.moveTo(p, 0); x.lineTo(p, h); x.moveTo(0, p); x.lineTo(w, p); x.stroke();
      }
      var g = x.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.62);
      g.addColorStop(0, 'rgba(4,7,12,0)'); g.addColorStop(1, 'rgba(4,7,12,0.85)');   // fade the grid out toward the edges
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    });
  }
  /* ---- destructible targets: a real installation / bunker / convoy that
     comes apart on the hit. Each piece carries its own physics for the break. */
  function lsTargetMat(kind) {
    // dark fills so the neon edges carry the read — a sensor-lock look
    var m = { concrete: [0x10161c, 0.1, 0.85], concrete2: [0x0b1015, 0.1, 0.9], steel: [0x161d26, 0.7, 0.4],
      rust: [0x1a130e, 0.4, 0.7], tire: [0x07080a, 0.1, 0.9], glass: [0x081820, 0.4, 0.3] }[kind] || [0x111820, 0.2, 0.8];
    return new THREE.MeshStandardMaterial({ color: m[0], metalness: m[1], roughness: m[2] });
  }
  function lsAddPiece(g, geo, kind, x, y, z, ry) {
    var mesh = new THREE.Mesh(geo, lsTargetMat(kind));
    mesh.position.set(x, y, z); if (ry) mesh.rotation.y = ry;
    mesh.castShadow = true; mesh.receiveShadow = true;
    try {   // crisp neon outline — the structure reads as a locked target
      var edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 22),
        new THREE.LineBasicMaterial({ color: 0x39d6ff, transparent: true, opacity: 0.8 }));
      mesh.add(edges); mesh.userData.edges = edges;
    } catch (e) {}
    g.add(mesh); return mesh;
  }
  function lsBuildTarget(g, type) {
    while (g.children.length) { var c = g.children.pop(); if (c.geometry) c.geometry.dispose(); }
    if (type === 'hardened') {
      lsAddPiece(g, new THREE.CylinderGeometry(4.3, 4.9, 1.3, 32), 'concrete2', 0, 0.65, 0);
      lsAddPiece(g, new THREE.SphereGeometry(2.7, 26, 13, 0, 6.2832, 0, Math.PI / 2), 'concrete', 0, 1.15, 0);
      lsAddPiece(g, new THREE.CylinderGeometry(0.75, 0.75, 0.55, 16), 'steel', 0.9, 3.3, 0.5);
      for (var i = 0; i < 5; i++) { var a = i * 1.257 + 0.4; lsAddPiece(g, new THREE.BoxGeometry(1.1, 1.1, 1.1), 'concrete2', Math.sin(a) * 3.9, 0.55, Math.cos(a) * 3.9, a); }
    } else if (type === 'moving') {
      lsAddPiece(g, new THREE.BoxGeometry(2.3, 0.45, 8), 'steel', 0, 0.72, 0);
      lsAddPiece(g, new THREE.BoxGeometry(2.5, 2.4, 5.4), 'rust', 0, 2.1, 1.3);
      lsAddPiece(g, new THREE.BoxGeometry(2.3, 1.9, 2.1), 'steel', 0, 1.85, -3.1);
      lsAddPiece(g, new THREE.BoxGeometry(1.9, 0.9, 0.12), 'glass', 0, 2.3, -4.16);
      [[-1.15, -2.8], [1.15, -2.8], [-1.15, 1.6], [1.15, 1.6], [-1.15, 3.3], [1.15, 3.3]].forEach(function (w) {
        var wh = lsAddPiece(g, new THREE.CylinderGeometry(0.72, 0.72, 0.5, 16), 'tire', w[0], 0.72, w[1]); wh.rotation.z = Math.PI / 2;
      });
    } else {
      lsAddPiece(g, new THREE.BoxGeometry(4.6, 3.3, 4.6), 'concrete', 0, 1.65, 0);
      lsAddPiece(g, new THREE.BoxGeometry(5.1, 0.55, 5.1), 'concrete2', 0, 3.55, 0);
      lsAddPiece(g, new THREE.BoxGeometry(1.4, 2.0, 0.2), 'steel', 0, 1.0, 2.35);
      lsAddPiece(g, new THREE.CylinderGeometry(0.13, 0.17, 6.4, 10), 'steel', 1.7, 3.2, 1.7);
      var dish = lsAddPiece(g, new THREE.SphereGeometry(0.85, 16, 8, 0, 6.2832, 0, 1.3), 'steel', 1.7, 6.3, 1.7); dish.rotation.x = Math.PI;
      lsAddPiece(g, new THREE.BoxGeometry(2.3, 1.9, 2.3), 'concrete2', -3.6, 0.95, 1.6, 0.3);
      lsAddPiece(g, new THREE.BoxGeometry(1.9, 1.5, 1.9), 'concrete', 3.4, 0.75, -2.5, -0.4);
    }
    g.children.forEach(function (p) { p.userData.rest = p.position.clone(); });
    return g.children.slice();
  }
  function lsBreakTarget(res, y01) {
    var lt = lsTerm;
    if (S.ls.type === 'hardened' && !res.destroyed) return;   // struck but not defeated — the bunker holds
    lt.targetBroken = true;
    var rand = PG2.stream(S.ls.seed || 'x', 'lsbreak'), c = V3(lt.impact.x * 0.3, 0.5, lt.impact.z * 0.3);
    lt.targetG.children.forEach(function (p) {
      var dir = p.position.clone().sub(c); if (dir.length() < 0.1) dir.set(rand() - 0.5, 1, rand() - 0.5); dir.normalize();
      var force = (2.5 + rand() * 4) * (0.55 + y01);
      p.userData.vel = V3(dir.x * force * (0.6 + rand()), (2 + rand() * 4.5) * (0.5 + y01), dir.z * force * (0.6 + rand()));
      p.userData.ang = V3((rand() - 0.5) * 7, (rand() - 0.5) * 7, (rand() - 0.5) * 7);
    });
  }
  function lsTermInit() {
    if (lsTerm) return lsTerm;
    try {
      // STRIKE CAMERA — a stylized night fire-control feed. Deep black, bold
      // accents, hard contrast: a look that survives the phone's bloom instead
      // of washing to mud.
      var scene = new THREE.Scene();
      scene.background = gradientTexture([[0, '#02040a'], [0.55, '#050a14'], [0.85, '#081420'], [1, '#0b1a26']], true);
      scene.fog = new THREE.Fog(0x03060c, 55, 240);         // the world falls to black — contains the frame
      var camera = new THREE.PerspectiveCamera(46, W / H, 0.1, 1400);
      scene.add(new THREE.HemisphereLight(0x2a4258, 0x05080e, 0.5));
      // strong cool key — hard rim on the article; low ambient keeps blacks deep
      var sun = new THREE.DirectionalLight(0xcfe6ff, 1.5); sun.position.set(-40, 46, 30);
      sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 160;
      sun.shadow.camera.left = -34; sun.shadow.camera.right = 34; sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
      sun.shadow.bias = -0.0006; sun.shadow.radius = 2.5; scene.add(sun);
      var rim = new THREE.DirectionalLight(0xff8a3c, 1.1); rim.position.set(46, 16, -30); scene.add(rim);   // hot amber back-rim — the accent
      // dark tactical grid ground with a neon target ring baked in
      var gt = lsGridTex(); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(6, 6);
      try { gt.anisotropy = renderer.capabilities.getMaxAnisotropy(); } catch (e) {}
      var ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900),
        new THREE.MeshStandardMaterial({ map: gt, roughness: 0.85, metalness: 0.1, emissive: 0x0a1a26, emissiveMap: gt, emissiveIntensity: 0.9 }));
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
      // scorch scar, revealed at impact
      var scorch = new THREE.Mesh(new THREE.CircleGeometry(6, 40),
        new THREE.MeshBasicMaterial({ color: 0x120a06, transparent: true, opacity: 0, depthWrite: false }));
      scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.03; scene.add(scorch);
      // neon target-lock reticle on the deck — crisp bright rings + a hot bull
      var ringG = new THREE.Group();
      [{ r: 5.5, w: 0.16, o: 0.95, c: 0x35e0ff }, { r: 9, w: 0.1, o: 0.55, c: 0x35e0ff }, { r: 13, w: 0.08, o: 0.3, c: 0x2aa8c8 }].forEach(function (rc) {
        var rr = new THREE.Mesh(new THREE.RingGeometry(rc.r - rc.w, rc.r, 72),
          new THREE.MeshBasicMaterial({ color: rc.c, transparent: true, opacity: rc.o, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
        rr.rotation.x = -Math.PI / 2; rr.position.y = 0.06; ringG.add(rr);
      });
      // tick marks at the cardinal points of the inner ring
      [0, 1, 2, 3].forEach(function (i) {
        var a = i * Math.PI / 2, tk = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 1.1),
          new THREE.MeshBasicMaterial({ color: 0x35e0ff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
        tk.position.set(Math.sin(a) * 5.5, 0.07, Math.cos(a) * 5.5); tk.rotation.y = a; ringG.add(tk);
      });
      var bull = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0xff5533, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
      bull.rotation.x = -Math.PI / 2; bull.position.y = 0.08; ringG.add(bull);
      scene.add(ringG);
      var targetG = new THREE.Group(); scene.add(targetG);   // the real installation/bunker/convoy, built per shot
      // the article — a slim, dark, hard-edged airframe. Near-black body so the
      // amber rim carves a bright edge; a white-hot glowing nose + a crisp streak.
      var m = new THREE.Group();
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.9, 24),
        new THREE.MeshStandardMaterial({ color: 0x141a22, metalness: 0.85, roughness: 0.32 }));
      body.castShadow = true; m.add(body);
      var stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.153, 0.153, 0.16, 24),
        new THREE.MeshBasicMaterial({ color: 0xff7a2a })); stripe.position.y = 0.5; m.add(stripe);
      var nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.82, 24),
        new THREE.MeshStandardMaterial({ color: 0xff5a28, emissive: 0xff5a1e, emissiveIntensity: 1.2, metalness: 0.3, roughness: 0.5 }));
      nose.position.y = 1.72; nose.castShadow = true; m.add(nose);
      [0, 1, 2, 3].forEach(function (i) {
        var f = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.03),
          new THREE.MeshStandardMaterial({ color: 0x1c242e, metalness: 0.8, roughness: 0.4 }));
        f.position.y = -1.28; f.rotation.y = i * 1.5708; f.castShadow = true; m.add(f);
      });
      var sheath = new THREE.Sprite(new THREE.SpriteMaterial({ map: fxTextures().fire, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      sheath.material.color.setRGB(1, 0.85, 0.5); sheath.scale.set(0.9, 2.6, 1); sheath.position.y = -0.7; m.add(sheath);
      scene.add(m);
      // a crisp plasma streak — fewer, tighter, brighter sprites than a fuzzy trail
      var trail = [];
      for (var i = 0; i < 14; i++) {
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fxTextures().fire, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
        scene.add(sp); trail.push(sp);
      }
      var contrail = [];
      for (var q = 0; q < 8; q++) {
        var cs = new THREE.Sprite(new THREE.SpriteMaterial({ map: fxTextures().smoke, transparent: true, depthWrite: false, opacity: 0 }));
        scene.add(cs); contrail.push(cs);
      }
      var flare = new THREE.PointLight(0xffd9a6, 0, 170, 1.7); scene.add(flare);   // the detonation lights the deck
      lsTerm = { scene: scene, camera: camera, ring: ringG, bull: bull, targetG: targetG, missile: m, nose: nose, sheath: sheath, trail: trail, contrail: contrail, scorch: scorch, flare: flare, fx: null };
    } catch (e) { lsTerm = null; }
    return lsTerm;
  }
  function lsTerminal() {
    if (!lsTermInit()) { lsResult(); return; }
    var res = S.ls.result, lt = lsTerm;
    var hitMi = Math.max(0.5, res.targetMi * 0.006), scale = 5 / hitMi;
    var ix = clamp(res.crossMi * scale, -22, 22), iz = clamp(-res.downMi * scale, -22, 22);
    lt.impact = V3(ix, 0, iz);
    var apo = res.apogeeMi || 0;
    var startY = 62 + clamp(apo, 0, 700) * 0.055;                 // a higher loft starts the descent higher
    lt.start = V3(ix * 0.2 - 6, startY, iz * 0.2 - 52);
    var dir = lt.impact.clone().sub(lt.start).normalize();
    lt.missile.quaternion.setFromUnitVectors(V3(0, 1, 0), dir);   // nose leads the descent
    lt.missile.position.copy(lt.start);
    lt.missile.visible = true;
    // build the target for this mission, intact
    lsBuildTarget(lt.targetG, S.ls.type);
    lt.targetG.children.forEach(function (p) { p.userData.vel = null; p.userData.sleep = false; });
    lt.targetBroken = false; lt.endT = 2.0;
    // camera keyframes: high reentry entry → downrange dolly → punch on the target
    var flat = V3(lt.impact.x - lt.start.x, 0, lt.impact.z - lt.start.z);
    if (flat.length() < 0.001) flat.set(0, 0, 1);
    flat.normalize();
    var sdv = V3(flat.z, 0, -flat.x);
    lt.camHigh = lt.impact.clone().add(flat.clone().multiplyScalar(30)).add(sdv.clone().multiplyScalar(8)).add(V3(0, 27, 0));
    lt.camFar = lt.impact.clone().add(flat.clone().multiplyScalar(16)).add(sdv.clone().multiplyScalar(5)).add(V3(0, 11, 0));
    lt.camNear = lt.impact.clone().add(flat.clone().multiplyScalar(7.5)).add(sdv.clone().multiplyScalar(1.7)).add(V3(0, 3.6, 0));
    lt.camBlast = lt.impact.clone().add(flat.clone().multiplyScalar(26)).add(sdv.clone().multiplyScalar(4)).add(V3(0, 16, 0));   // pull back to reveal a mushroom
    lt.t0 = null; lt.t = 0; lt.dur = clamp(2.8 + apo * 0.0016, 2.9, 4.4); lt.postT = 0; lt.blownAt = 0; lt.holdAt = 0; lt.blown = false; lt.done = false; lt.shake = 0;
    var col = res.hit ? 0x8effb0 : 0xff6a52;
    lt.ring.children.forEach(function (c) { if (c.geometry && c.geometry.type === 'RingGeometry') c.material.color.setHex(col); });
    lt.bull.material.color.setHex(col); lt.bull.material.opacity = 0.9;
    lt.trail.forEach(function (s) { s.material.opacity = 0; });
    lt.contrail.forEach(function (s) { s.material.opacity = 0; });
    lt.sheath.material.opacity = 0;
    lt.scorch.material.opacity = 0; lt.flare.intensity = 0;
    lt.camera.fov = 46; lt.camera.updateProjectionMatrix();
    renderer.toneMappingExposure = 1.45;
    if (lt.fx) { lt.scene.remove(lt.fx); lt.fx = null; }
    if (lt.mush) { lt.scene.remove(lt.mush.group); lt.mush = null; }
    S.phase = 'lsterm';
    $('lth-clock').textContent = 'TERMINAL';
    $('lth-caption').textContent = res.reachable ? 'Tracking Seven has it — terminal phase.' : 'Out of fuel. Watch it fall short.';
    $('ls-term-hud').classList.remove('hidden');
    showScreen(null);
  }
  function lsTermStep(dt, now) {
    var lt = lsTerm, res = S.ls.result, c = lt.camera, k;
    if (lt.t0 == null) lt.t0 = now;
    if (!lt.blown) {
      lt.t = (now - lt.t0) / 1000;   // wall-clock: the cinematic plays in real seconds at any framerate
      k = clamp(lt.t / lt.dur, 0, 1);
      // dramatic time-map: accelerating fall to ~82%, then a slow-mo crawl on the final approach
      var e;
      if (k < 0.7) { var a = k / 0.7; e = 0.82 * a * a; }
      else { var b = (k - 0.7) / 0.3; e = 0.82 + 0.18 * (1 - (1 - b) * (1 - b)); }
      lt.missile.visible = true;
      lt.missile.position.lerpVectors(lt.start, lt.impact, e);
      // plasma sheath bites harder deeper in, and blooms in the slow-mo
      lt.sheath.material.opacity = clamp(0.35 + k * 0.65, 0, 1) * (k > 0.03 ? 1 : 0);
      var shs = 2.6 + k * 2.2; lt.sheath.scale.set(shs * 0.55, shs, 1);
      if (lt.nose) lt.nose.material.emissiveIntensity = 0.6 + k * 2.6;   // the nose glows white-hot on the way in
      // hot plasma trail sampled behind the nose (hot at the tip → cool up-track)
      lt.trail.forEach(function (s, i) {
        var kk = Math.max(0, e - i * 0.012);
        s.position.lerpVectors(lt.start, lt.impact, kk);
        var f = i / lt.trail.length;
        s.material.color.setRGB(1, 0.75 - f * 0.45, 0.45 - f * 0.4);
        var sc = 1.5 - i * 0.045; s.scale.set(sc, sc, 1);
        s.material.opacity = (0.7 - i * 0.028) * (k > 0.02 ? 1 : 0);
      });
      // smoke contrail up the track — lags, lingers
      lt.contrail.forEach(function (s, i) {
        var kk2 = Math.max(0, e - 0.08 - i * 0.05);
        s.position.lerpVectors(lt.start, lt.impact, kk2); s.position.y += 0.3;
        var sc2 = 2.2 + i * 0.5; s.scale.set(sc2, sc2, 1);
        s.material.opacity = Math.min(s.material.opacity + dt * 1.5, 0.32 - i * 0.02) * (kk2 > 0 ? 1 : 0);
      });
      $('lth-clock').textContent = 'T−' + Math.max(0, lt.dur - lt.t).toFixed(1);
      if (k >= 1) {
        lt.missile.position.copy(lt.impact);
        if (!lt.holdAt) lt.holdAt = now;                 // hitstop: freeze on contact
        if (now - lt.holdAt >= 110) lsTermBurst();
      }
    } else {
      lt.postT = (now - lt.blownAt) / 1000; k = 1;
      var p = lt.postT;
      lt.flare.intensity = Math.max(0, (lt.flarePeak || 8.5) * (1 - p * 0.9));   // the flash lights the desert, then fades
      if (lt.expPeak) renderer.toneMappingExposure = 1.45 + (lt.expPeak - 1.45) * clamp(1 - p / 0.3, 0, 1);   // blinding exposure spike
      lt.scorch.material.opacity = Math.min(0.85, p * 1.6);
      if (lt.fx) {
        lt.fx.children.forEach(function (ch) {
          if (ch.userData.kind === 'flash') { ch.material.opacity = Math.max(0, 0.98 - p * 2.0); var fs = (ch.userData.g0 || 14) + p * 26; ch.scale.set(fs, fs, 1); }
          else if (ch.userData.kind === 'ring') { var rs = 1 + p * 30; ch.scale.set(rs, rs, rs); ch.material.opacity = Math.max(0, 0.9 - p * 0.85); }
          else if (ch.userData.kind === 'gring') { var gs2 = 1 + p * (ch.userData.gscale || 46); ch.scale.set(gs2, gs2, gs2); ch.material.opacity = Math.max(0, 0.7 - p * 0.6); }
          else if (ch.userData.kind === 'fire') { ch.position.y += ch.userData.rise * dt; var gs = ch.userData.grow * (0.4 + p * 1.7); ch.scale.set(gs, gs, 1); ch.material.opacity = Math.max(0, 1 - p * 1.05); }
          else if (ch.userData.kind === 'smoke') { ch.position.y += ch.userData.rise * dt; var ss = ch.userData.grow * (0.6 + p * 1.4); ch.scale.set(ss, ss, 1); ch.material.opacity = Math.max(0, ch.userData.o * (1 - p * 0.5)); }
        });
      }
      // mushroom cloud: the cap rises and inflates, the stem billows, the Wilson ring flashes out
      if (lt.mush) {
        var mm = lt.mush; mm.group.position.y = Math.min(mm.maxH, p * mm.rise);
        mm.stem.forEach(function (st) { st.material.opacity = clamp(0.55 - p * 0.12, 0, 0.6); });
        mm.cap.forEach(function (cp) { var cg = mm.capGrow * (0.5 + p * 0.9); cp.scale.set(cg, cg, 1); cp.material.opacity = clamp(0.62 - p * 0.14, 0, 0.7); });
        var wr = 1 + p * 34; mm.wil.scale.set(wr, wr, wr); mm.wil.material.opacity = Math.max(0, 0.5 - p * 1.1);
      }
      lt.sheath.material.opacity = 0;
      lt.trail.forEach(function (s) { s.material.opacity = Math.max(0, s.material.opacity - dt * 3.5); });
      lt.contrail.forEach(function (s) { s.material.opacity = Math.max(0, s.material.opacity - dt * 0.5); });
      // the target comes apart — each piece flies, spins, falls, and settles
      if (lt.targetBroken) {
        lt.targetG.children.forEach(function (pc) {
          var v = pc.userData.vel; if (!v || pc.userData.sleep) return;
          v.y -= 26 * dt;
          pc.position.x += v.x * dt; pc.position.y += v.y * dt; pc.position.z += v.z * dt;
          var av = pc.userData.ang; if (av) { pc.rotation.x += av.x * dt; pc.rotation.y += av.y * dt; pc.rotation.z += av.z * dt; }
          if (pc.position.y <= 0.22) { pc.position.y = 0.22; v.y *= -0.24; v.x *= 0.6; v.z *= 0.6; if (av) av.multiplyScalar(0.55); if (v.length() < 0.5) pc.userData.sleep = true; }
        });
      }
      if (lt.postT > (lt.endT || 2.0) && !lt.done) {
        lt.done = true;
        if (lt.expPeak) { renderer.toneMappingExposure = 1.45; lt.expPeak = null; }
        if (lt.mush) { lt.scene.remove(lt.mush.group); lt.mush = null; }
        $('ls-term-hud').classList.add('hidden');
        S.phase = 'longshot'; showScreen('scr-longshot'); lsResult();
        return;
      }
    }
    // ---- camera choreography: high reentry entry → downrange dolly → punch on the target → pull back for a mushroom ----
    if (k >= 1) {
      if (lt.mush && lt.camBlast) { var pb = clamp(lt.postT / 1.6, 0, 1); c.position.copy(lt.camNear).lerp(lt.camBlast, pb * pb * (3 - 2 * pb)); }
      else { c.position.copy(lt.camNear); }
    }
    else if (k < 0.4) { var a2 = k / 0.4; c.position.copy(lt.camHigh).lerp(lt.camFar, a2 * a2 * (3 - 2 * a2)); }
    else { var a3 = (k - 0.4) / 0.6; c.position.copy(lt.camFar).lerp(lt.camNear, a3 * a3 * (3 - 2 * a3)); }
    var fov = 46 - (k > 0.8 ? (k - 0.8) / 0.2 * 7 : 0);
    if (lt.blown) fov = 39 + Math.min(7, lt.postT * 10);
    if (Math.abs(c.fov - fov) > 0.01) { c.fov = fov; c.updateProjectionMatrix(); }
    if (lt.shake > 0.02) {
      c.position.x += (Math.random() - 0.5) * lt.shake;
      c.position.y += (Math.random() - 0.5) * lt.shake;
      c.position.z += (Math.random() - 0.5) * lt.shake;
      lt.shake = Math.max(0, lt.shake - dt * 5);
    }
    var settle = clamp((k - 0.5) / 0.5, 0, 1); settle = settle * settle * (3 - 2 * settle);
    var lookY = 0.4;
    if (lt.mush && lt.blown) lookY = 0.4 + clamp(lt.postT / 1.6, 0, 1) * 6;   // tilt up to follow the rising cloud
    var lookP = lt.missile.position.clone().lerp(lt.impact.clone().add(V3(0, lookY, 0)), settle);
    c.lookAt(lookP);
    // ---- fire-control HUD: live telemetry + a target-lock box on the deck ----
    var lock = $('lth-lock');
    if (!lt.blown) {
      $('lth-range').textContent = Math.max(0, Math.round(lt.missile.position.distanceTo(lt.impact) * 44)).toLocaleString() + ' M';
      $('lth-alt').textContent = Math.max(0, Math.round(lt.missile.position.y * 480)).toLocaleString() + ' FT';
      $('lth-vel').textContent = 'MACH ' + (2.6 + k * 5.2).toFixed(1);
      c.updateMatrixWorld();
      var sp = worldToScreen(lt.impact.clone().add(V3(0, 1.1, 0)), c);
      if (sp.z < 1) { lock.style.display = 'block'; lock.style.left = (sp.x / W * 100).toFixed(2) + '%'; lock.style.top = (sp.y / H * 100).toFixed(2) + '%'; var lsz = clamp(58 + k * 96, 58, 154); lock.style.width = lsz + 'px'; lock.style.height = lsz + 'px'; }
      else lock.style.display = 'none';
    } else { lock.style.display = 'none'; $('lth-vel').textContent = '—'; }
    renderScene(lt.scene, lt.camera);
  }
  function lsTermBurst() {
    var lt = lsTerm, res = S.ls.result, tx = fxTextures();
    var yld = PG2.lsYield(res), y = yld.y01, tier = yld.tier;
    lt.blown = true; lt.blownAt = performance.now(); lt.missile.visible = false;
    lt.shake = 1.4 + y * 6.5;
    lt.endT = tier === 'nuclear' ? 3.6 : tier === 'heavy' ? 2.8 : 2.0;
    lt.flarePeak = 5 + y * 42; lt.flare.distance = 120 + y * 240;
    lt.flare.position.copy(lt.impact); lt.flare.position.y = 2 + y * 3; lt.flare.intensity = lt.flarePeak;
    lt.expPeak = 1.45 + y * 1.05;
    // break the target — unless a hardened bunker held, or a small warhead missed wide
    if (res.hit || Math.hypot(lt.impact.x, lt.impact.z) < (3 + y * 13)) lsBreakTarget(res, y);
    var fx = new THREE.Group(); fx.position.copy(lt.impact);
    var flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx.flash, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    flash.position.y = 1.6 + y * 2; flash.userData = { kind: 'flash', g0: 12 + y * 42 }; fx.add(flash);
    var ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.3, 44), new THREE.MeshBasicMaterial({ color: 0xffe0a8, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.14; ring.userData.kind = 'ring'; fx.add(ring);
    // ground shockwave — crisp neon rings racing outward (matches the HUD)
    [{ c: 0x9fe8ff, g: 22 + y * 82, o: 0.9 }, { c: 0xffffff, g: 14 + y * 52, o: 0.7 }].forEach(function (rc, ri) {
      if (ri === 1 && y < 0.4) return;
      var gr = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.4, 64), new THREE.MeshBasicMaterial({ color: rc.c, transparent: true, opacity: rc.o, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      gr.rotation.x = -Math.PI / 2; gr.position.y = 0.1 + ri * 0.02; gr.userData = { kind: 'gring', gscale: rc.g }; fx.add(gr);
    });
    var rand = PG2.stream(S.ls.seed || 'x', 'lsterm');
    // fireball — count + size scale with yield
    var fc = 6 + Math.round(y * 16);
    for (var i = 0; i < fc; i++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx.fire, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.material.color.setRGB(1, 0.5 + rand() * 0.25, 0.14);
      sp.position.set((rand() - 0.5) * (3 + y * 4), 1 + rand() * (2 + y * 3), (rand() - 0.5) * (3 + y * 4));
      sp.userData = { kind: 'fire', grow: (5 + rand() * 7) * (0.7 + y * 2.2), rise: 3 + rand() * 4 };
      fx.add(sp);
    }
    for (var j = 0; j < 8; j++) {
      var sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx.smoke, transparent: true, depthWrite: false, opacity: 0 }));
      sm.position.set((rand() - 0.5) * 2.4, 1 + j * 0.7, (rand() - 0.5) * 2.4);
      sm.userData = { kind: 'smoke', grow: (5 + rand() * 5) * (0.7 + y * 1.6), rise: 2 + rand() * 2.5, o: 0.5 - j * 0.03 };
      fx.add(sm);
    }
    lt.scene.add(fx); lt.fx = fx;
    // MUSHROOM CLOUD for the big tiers — rising stem + inflating cap + a Wilson ring
    lt.mush = null;
    if (y > 0.62) {
      var mg = new THREE.Group(); mg.position.copy(lt.impact); lt.scene.add(mg);
      var stem = [], cap = [];
      for (var s2 = 0; s2 < 7; s2++) {
        var st = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx.smoke, transparent: true, depthWrite: false, opacity: 0 }));
        st.position.set((rand() - 0.5) * 2, s2 * 2.1, (rand() - 0.5) * 2); var ss = 4 + s2 * 0.3; st.scale.set(ss, ss, 1); mg.add(st); stem.push(st);
      }
      for (var c2 = 0; c2 < 10; c2++) {
        var a = c2 / 10 * 6.2832;
        var cs2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx.smoke, transparent: true, depthWrite: false, opacity: 0 }));
        cs2.position.set(Math.cos(a) * 4.6, 15, Math.sin(a) * 4.6); mg.add(cs2); cap.push(cs2);
      }
      var wil = new THREE.Mesh(new THREE.RingGeometry(1, 2.4, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      wil.rotation.x = -Math.PI / 2; wil.position.y = 3.2; mg.add(wil);
      lt.mush = { group: mg, stem: stem, cap: cap, wil: wil, rise: 7, maxH: 9, capGrow: 6 + y * 5 };
    }
    PGAudio.detonation(clamp(yld.bang, 0.4, 2.5), false);
    if (res.hit) PGAudio.fanfare(); else PGAudio.sadDrone();
    try { var app = $('app'); if (app && app.animate) app.animate([{ transform: 'scale(' + (1.02 + y * 0.06).toFixed(3) + ') translateY(' + Math.round(3 + y * 6) + 'px)' }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.9,.3,1)' }); } catch (e) {}
    $('lth-clock').textContent = 'IMPACT';
    $('lth-caption').textContent = res.hit ? (tier === 'nuclear' ? 'Thermonuclear. ' : '') + res.grade + '.'
      : res.reachable ? 'Impact — ' + res.missMi.toFixed(res.missMi < 10 ? 2 : 1) + ' mi off. ' + res.grade + '.'
      : 'Fell short — out of fuel by ' + Math.round(res.targetMi - res.cap.rangeMax) + ' mi.';
  }

  /* ---------- PHASE 5: result + records ---------- */
  function lsRecordShot(res) {
    var sc = PG2.lsScore(res);
    if (!res.hit || sc <= 0) return null;
    var entry = { score: sc, rangeMi: res.targetMi, missMi: Math.round(res.missMi * 100) / 100,
      grade: res.grade, type: S.ls.type, guidance: S.ls.build.guidance, t: Date.now() };
    var best = WS().ls ? WS().ls.best : (SAVE.ls.best);
    best.push(entry);
    best.sort(function (a, b) { return b.score - a.score; });
    if (best.length > 15) best.length = 15;
    persist();
    return best.indexOf(entry) + 1;   // rank (1-based), 0 if off the board
  }
  function lsResult() {
    lsShowPhase('ls-result');
    var res = S.ls.result;
    var rank = lsRecordShot(res);
    var gcls = res.hit ? 'g-hit' : res.grade === 'NEAR MISS' ? 'g-near' : 'g-miss';
    var downTxt = (res.downMi >= 0 ? 'LONG ' : 'SHORT ') + Math.abs(res.downMi).toFixed(1) + ' mi';
    var crossTxt = (res.crossMi >= 0 ? 'RIGHT ' : 'LEFT ') + Math.abs(res.crossMi).toFixed(1) + ' mi';
    var fix = res.hit ? 'Textbook. The Program files it under “show-off.”'
      : !res.reachable ? 'It never had the legs. Bigger motor, or a lighter warhead.'
      : S.ls.type === 'hardened' && res.missMi <= Math.max(0.5, res.targetMi * 0.006)
        ? 'You hit it — but a bunker shrugs off a light warhead. Bring a HEAVY, or score a direct hit.'
      : S.ls.type === 'moving'
        ? 'A convoy won’t wait. Aim the LEAD marker, not where it sits now.'
      : Math.abs(res.crossMi) > Math.abs(res.downMi)
        ? 'Cross-range dominated — your azimuth was off. At this range, tenths of a degree are miles.'
        : 'Downrange dominated — trim the burn cutoff, and keep the loft at 45°.';
    $('ls-result-card').innerHTML =
      '<div class="ls-grade ' + gcls + '">' + res.grade + '</div>' +
      '<div class="ls-miss">MISS DISTANCE <b>' + res.missMi.toFixed(res.missMi < 10 ? 2 : 1) + '</b> mi</div>' +
      (rank ? '<div class="ls-miss" style="color:var(--green-hot)">★ RECORD BOARD · RANK #' + rank + '</div>' : '') +
      '<div class="ls-breakdown">' +
        (S.ls.type === 'moving' ? 'MOVING TARGET · INTERCEPT ' : S.ls.type === 'hardened' ? 'HARDENED · ' : '') +
        'TARGET <b>' + res.targetMi.toLocaleString() + ' mi</b> · BRG <b>' + Math.round(res.bearingDeg) + '°</b><br>' +
        'DOWNRANGE ERROR <b>' + downTxt + '</b><br>CROSS-RANGE ERROR <b>' + crossTxt + '</b><br>' +
        'GUIDANCE <b>' + S.ls.build.guidance.toUpperCase() + '</b> · CEP <b>' + res.cepMi + ' mi</b><br><br>' +
        fix + '</div>' +
      '<div class="ls-sol-row"><button id="ls-save-sol" type="button">★ SAVE SOLUTION</button>' +
        '<button id="ls-show-records" type="button">▤ RECORD BOARD</button></div>';
    if (res.hit && !cashUnlimited()) {
      var bounty = Math.round(1500 + res.targetMi * 4 * (res.grade === 'DIRECT HIT' || res.grade === 'BUNKER DESTROYED' ? 1.6 : 1) * (S.ls.type !== 'static' ? 1.3 : 1));
      SAVE.cash += bounty; persist();
      $('ls-result-card').innerHTML += '<div class="ls-miss" style="margin-top:10px">PROGRAM BOUNTY <b>' + fmt$(bounty) + '</b></div>';
    }
    $('ls-save-sol').addEventListener('click', function () {
      var sols = SAVE.ls.solutions;
      sols.unshift({ name: (PG2.LS_TARGET_TYPES[S.ls.type].name.split(' ')[0]) + ' ' + S.ls.rangeMi + 'mi', type: S.ls.type,
        rangeMi: S.ls.rangeMi, bearing: S.ls.bearing, moveSpeed: S.ls.moveSpeed, moveHeading: S.ls.moveHeading,
        build: JSON.parse(JSON.stringify(S.ls.build)), dial: JSON.parse(JSON.stringify(S.ls.dial)) });
      if (sols.length > 12) sols.length = 12;
      persist(); PGAudio.stampThud(); this.textContent = '✓ SAVED';
    });
    $('ls-show-records').addEventListener('click', function () { PGAudio.tap(); lsShowRecords(); });
  }
  function lsShowRecords() {
    var best = SAVE.ls.best, sols = SAVE.ls.solutions, list = $('ls-records-list');
    var h = '';
    if (!best.length) h += '<div class="ls-rec-empty">No shots on the board yet. Thread a target to earn a rank.</div>';
    best.forEach(function (e, i) {
      h += '<div class="ls-rec"><span class="lr-rank">#' + (i + 1) + '</span>' +
        '<span class="lr-main">' + e.rangeMi.toLocaleString() + ' mi · ' + e.grade + ' · ' + e.missMi + ' mi · ' + (e.guidance || '').toUpperCase() + '</span>' +
        '<span class="lr-score">' + e.score.toLocaleString() + '</span></div>';
    });
    if (sols.length) {
      h += '<div class="ls-step-h" style="margin-top:10px">SAVED FIRING SOLUTIONS</div>';
      sols.forEach(function (sv, i) {
        h += '<div class="ls-rec"><span class="lr-main">' + sv.name + ' · ' + sv.build.guidance.toUpperCase() + '</span>' +
          '<button class="lr-load" data-i="' + i + '" style="font-family:var(--mono);font-size:8px;font-weight:800;color:#0a1420;background:var(--amber);border-radius:5px;padding:5px 9px">LOAD</button></div>';
      });
    }
    list.innerHTML = h;
    list.querySelectorAll('.lr-load').forEach(function (b) {
      b.addEventListener('click', function () {
        PGAudio.tap();
        var sv = SAVE.ls.solutions[+b.dataset.i];
        S.ls.type = sv.type; S.ls.rangeMi = sv.rangeMi; S.ls.bearing = sv.bearing;
        S.ls.moveSpeed = sv.moveSpeed || 500; S.ls.moveHeading = sv.moveHeading || 20;
        S.ls.build = JSON.parse(JSON.stringify(sv.build));
        var opt = PG2.lsOptimal(S.ls.build, lsAim().rangeMi, lsAim().bearingDeg);
        S.ls.rangeMax = opt.rangeMax;
        S.ls.dial = JSON.parse(JSON.stringify(sv.dial));
        $('ls-records-overlay').classList.add('hidden');
        lsRenderDial();
      });
    });
    $('ls-records-overlay').classList.remove('hidden');
  }
  $('ls-records-close').addEventListener('click', function () { PGAudio.tap(); $('ls-records-overlay').classList.add('hidden'); });
  $('ls-result-tweak').addEventListener('click', function () { PGAudio.tap(); lsRenderDial(); });
  $('ls-result-new').addEventListener('click', function () { PGAudio.tap(); lsRenderMission(); lsShowPhase('ls-mission'); });
  $('ls-result-hq').addEventListener('click', function () { PGAudio.tap(); showHQ(); });

  /* ================= DEBUG / TEST API ================= */
  window.__pg = {
    state: function () {
      return {
        phase: S.phase, seed: S.seed, contract: S.contract, attempt: S.attempt,
        mode: S.mode, rndTarget: S.rndTarget, world: S.world,
        assembly: JSON.parse(JSON.stringify(S.assembly))
      };
    },
    /* M3b — the Workshop */
    rnd: function () { return S.result && S.result.rnd ? JSON.parse(JSON.stringify({
      target: S.result.rnd.target.id, primary: S.result.rnd.primary,
      funcOk: S.result.rnd.funcOk, measures: S.result.rnd.measures,
      param: S.result.rnd.param, pegged: !!S.result.rnd.pegged, collapsed: !!S.result.rnd.collapsed,
      toss: S.result.rnd.toss || 0 })) : null; },
    debugGrant: function (opts) {
      opts = opts || {};
      if (opts.wins) {
        for (var i = 0; i < Math.min(opts.wins, PG2.CONTRACTS.length); i++) {
          var rec = contractRec(i);
          rec.won = true; rec.tests = rec.tests || 1; rec.stars = rec.stars || 2;
        }
      }
      if (typeof opts.cash === 'number') SAVE.cash = opts.cash;
      if (opts.finishRun && WS().run) WS().run.t0 = Date.now() - WS().run.durMs - 1000;
      persist();
      refreshTitle();
    },
    showHQ: function () { showHQ(); },
    showLongShot: function () { showLongShot(); },
    lsState: function () { return S.ls ? JSON.parse(JSON.stringify({ rangeMi: S.ls.rangeMi, bearing: S.ls.bearing, build: S.ls.build, dial: S.ls.dial, rangeMax: S.ls.rangeMax, result: S.ls.result, phase: (function () { var ph = ['ls-mission', 'ls-build', 'ls-dial', 'ls-flight', 'ls-result'].filter(function (p) { return !$(p).classList.contains('hidden'); }); return ph[0]; })() })) : null; },
    lsDialPerfect: function () {   // tests: snap to the intended firing solution (leads a convoy)
      if (!S.ls || !S.ls.dial) return;
      var aim = lsAim();
      var o = PG2.lsOptimal(S.ls.build, aim.rangeMi, aim.bearingDeg);
      S.ls.dial = { elev: 45, azimuth: o.azimuth, rangeSet: o.rangeSet, throttle: 1, gyro: 0.95 };
      lsRenderDial();
    },
    debugFinishCloseout: function () {
      // tests only: a correct panel, a gentle hand, an armed switch
      PG2.wireCorrect(S.assembly, S.seed, rfp());
      S.assembly.det = { seated: true, slam: 0.1 };
      S.assembly.armed = true;
      refreshHUD();
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
    setOrbit: function (t, p, r) {
      bay.orbit.theta = t; bay.orbit.phi = p; bay.orbit.radius = r;
      bay.velTheta = 0; bay.velPhi = 0; bay.lastTouch = performance.now();
    },
    setRangePalette: function (n) { if (range) applyRangePalette(n); },   // tests: hour swap
    aerialTo: function (theta, radius, tx, tz) {                          // tests: park the recon plane
      if (!range) return;
      aerial.theta = theta; aerial.radius = radius;
      if (tx != null) aerial.tx = tx;
      if (tz != null) aerial.tz = tz;
    },
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
      var s = JSON.parse(JSON.stringify(SAVE));
      s.settings = JSON.parse(JSON.stringify(SETTINGS));
      return s;
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
