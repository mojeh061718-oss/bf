/* ============================================================
   PROVING GROUNDS v2 — game.js
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
  var urlSeed = null, urlContract = 0;
  try {
    var q = new URLSearchParams(location.search);
    urlSeed = q.get('seed');
    urlContract = q.get('c') === '2' ? 1 : 0;
  } catch (e) {}
  var S = {
    seed: (urlSeed || PG2.makeSeed()).toUpperCase(),
    phase: 'title',            // title rfp build wiring det arm truck station counting aftermath crater score
    contract: urlContract,     // 0 = RFP-041 · 1 = RFP-048 (needs the still)
    attempt: 0,                // tests fired on this contract — worn with pride
    best: [null, null],        // per-contract best {stars, net, wonOn}
    assembly: PG2.makeAssembly(),
    result: null,
    closeoutStep: -1
  };
  function rfp() { return PG2.CONTRACTS[S.contract]; }

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
    return { compact: { L: 1.5, r: 0.34 }, standard: { L: 2.1, r: 0.42 }, heavy: { L: 2.7, r: 0.5 } }[id];
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
    var body = new THREE.Mesh(new THREE.CylinderGeometry(d.r, d.r, d.L, 20, 1, false), mat(COL.steel));
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    g.add(body);
    [-1, 1].forEach(function (s) {
      var dome = new THREE.Mesh(new THREE.SphereGeometry(d.r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(COL.steel));
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
    var st = textPlane('RD-047', 0.6, 0.18, { color: '#2e2b26', px: 72 });
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
    var door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.022), mat(COL.steel));
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
    var HUES = { ember: COL.amber, frost: COL.blue, emberx: 0xff7a2e, emberxs: 0x7a5030 };
    var hue = HUES[comp] || COL.amber;
    var glow = comp === 'emberx' ? 0.5 : comp === 'emberxs' ? 0.08 : 0.22;
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.26, 14), mat(0xb9c2c9));
    body.castShadow = true;
    g.add(body);
    var band = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.09, 14), mat(hue, { emissive: hue, ei: glow }));
    band.position.y = 0.02;
    g.add(band);
    var top = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), mat(hue));
    top.position.y = 0.13;
    g.add(top);
    var valve = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), mat(COL.brass, { shin: 60 }));
    valve.position.y = 0.24;
    g.add(valve);
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
  function partBuilder(id) {
    if (PG2.SHELLS[id]) return buildCasing(id);
    if (PG2.COMPOUNDS[id]) return buildCanister(id);
    if (id === 'timer') return buildTimer();
    if (id === 'battery') return buildBattery();
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

    // floor: radial glow + grid, canvas texture
    var fc = document.createElement('canvas');
    fc.width = fc.height = 512;
    var fx = fc.getContext('2d');
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
    var ftx = new THREE.CanvasTexture(fc);
    ftx.encoding = THREE.sRGBEncoding;
    var floor = new THREE.Mesh(new THREE.CircleGeometry(11, 40),
      new THREE.MeshPhongMaterial({ map: ftx, shininess: 8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

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
      orbit: orbit, spin: 0, lastTouch: 0, bounce: 0,
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
    if (!a.timer) nodes.push({ id: 'nose', pos: V3(d.L / 2 + 0.05, 0, 0), accepts: ['timer'] });
    if (!a.battery) nodes.push({ id: 'tail', pos: V3(-d.L / 2 - 0.18, 0, 0), accepts: ['battery'] });
    if (!a.cap) nodes.push({ id: 'well', pos: V3(wellX(a.shell), d.r + 0.12, 0), accepts: ['cap'] });
    if (!a.fins) nodes.push({ id: 'finring', pos: V3(-d.L / 2 + 0.3, 0, 0), accepts: ['fins'] });
    if (!a.panel) nodes.push({ id: 'side', pos: V3(-d.L * 0.31, 0.05, d.r + 0.02), accepts: ['panel'] });
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
    return { pos: V3(0, 0, 0), rot: V3(0, 0, 0) };
  }

  /* ---------- device (re)build from assembly ---------- */
  var placedMeshes = [];
  function rebuildDevice() {
    var dev = bay.device;
    // clear everything except nodeGroup
    for (var i = dev.children.length - 1; i >= 0; i--) {
      if (dev.children[i] !== bay.nodeGroup) dev.remove(dev.children[i]);
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
    if (a.battery) addPart(buildBattery(), 'tail', { kind: 'battery' });
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
    nodeList().forEach(function (n) {
      if (n.accepts.indexOf(draggingPart) < 0) return;
      var mk = new THREE.Group();
      var s = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8),
        mat(0x53e07f, { emissive: 0x2fd465, ei: 0.9, transparent: true, opacity: 0.9 }));
      mk.add(s);
      var r = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 20),
        mat(0x53e07f, { emissive: 0x2fd465, ei: 0.7, transparent: true, opacity: 0.75 }));
      r.rotation.x = Math.PI / 2;
      mk.add(r);
      mk.position.copy(n.pos);
      mk.userData.node = n;
      ng.add(mk);
      nodeMarkers.push(mk);
    });
  }

  /* ================= SHELF ================= */
  var ALL_PART_IDS = ['compact', 'standard', 'heavy', 'ember', 'frost', 'emberx', 'emberxs',
                      'timer', 'battery', 'cap', 'panel', 'fins'];
  function shelfList() {
    var list = [
      { id: 'compact', name: 'SMALL SHELL', group: 'shell' },
      { id: 'standard', name: 'STANDARD SHELL', group: 'shell' },
      { id: 'heavy', name: 'BIG SHELL', group: 'shell' },
      { id: 'ember', name: 'EMBER CANISTER', group: 'fill' },
      { id: 'frost', name: 'FROST CANISTER', group: 'fill' }
    ];
    if (rfp().needsRefinery) {
      list.push({ id: 'emberx', name: 'EMBER-X CANISTER', group: 'refined' });
      list.push({ id: 'emberxs', name: 'SCORCHED X', group: 'refined' });
    }
    list.push(
      { id: 'timer', name: 'TIMER', group: 'unique' },
      { id: 'battery', name: 'BATTERY', group: 'unique' },
      { id: 'cap', name: 'WELL CAP', group: 'unique' },
      { id: 'panel', name: 'ARM SWITCH', group: 'unique' },
      { id: 'fins', name: 'FINS', group: 'unique' }
    );
    return list;
  }
  function partCost(id) {
    if (PG2.SHELLS[id]) return PG2.SHELLS[id].cost;
    if (PG2.COMPOUNDS[id]) return PG2.COMPOUNDS[id].cost;
    return PG2.PARTS[id].cost;
  }
  function costLabel(p) {
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
  function buildShelf() {
    var sc = $('shelf-scroll');
    sc.innerHTML = '';
    shelfList().forEach(function (p) {
      var t = document.createElement('div');
      t.className = 'tile';
      t.id = 'tile-' + p.id;
      var badge = p.group === 'shell' ? '<span class="t-badge">PICK 1</span>'
                : p.group === 'refined' ? '<span class="t-badge" id="badge-' + p.id + '">×0</span>' : '';
      t.innerHTML = badge +
        '<img alt="" draggable="false"' + (iconCache[p.id] ? ' src="' + iconCache[p.id] + '"' : '') + '>' +
        '<div class="t-name">' + p.name + '</div>' +
        '<div class="t-cost">' + costLabel(p) + '</div>';
      t.addEventListener('pointerdown', function (e) {
        if (S.phase !== 'build') return;
        e.preventDefault();
        beginPartDrag(p.id, e);
      });
      sc.appendChild(t);
    });
    refreshShelf();
  }
  function refreshShelf() {
    var a = S.assembly;
    var d = PG2.derive(a, rfp());
    shelfList().forEach(function (p) {
      var t = $('tile-' + p.id);
      if (!t) return;
      var dis = false;
      if (p.group === 'shell') dis = !!a.shell;
      else if (p.group === 'fill') dis = !a.shell || d.filled >= d.slots;
      else if (p.group === 'refined') {
        dis = !a.shell || d.filled >= d.slots || !(a.refine.stock[p.id] > 0);
        var b = $('badge-' + p.id);
        if (b) b.textContent = '×' + a.refine.stock[p.id];
      }
      else dis = !a.shell || !!a[p.id];
      t.classList.toggle('disabled', dis);
    });
  }

  /* ================= HUD ================= */
  function closeoutReady() {
    var a = S.assembly;
    return a.det.seated && PG2.WIRES.every(function (c) { return a.wires[c]; });
  }
  function refreshHUD() {
    var d = PG2.derive(S.assembly, rfp());
    var R = rfp();
    var maxM = R.meterMax;
    $('m-goal').textContent = R.craterMin + '–' + R.craterMax + ' m';
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
    $('m-weight-val').textContent = Math.round(d.weight) + ' kg';
    $('m-weight-fill').style.width = clamp(d.weight / 90, 0, 1) * 100 + '%';
    var cost = $('m-cost-val');
    cost.textContent = fmt$(d.cost);
    cost.className = d.overBudget ? 'bad' : '';
    var cf = $('m-cost-fill');
    cf.style.width = clamp(d.cost / (R.budget / 0.88), 0, 1) * 100 + '%';
    cf.classList.toggle('over', d.overBudget);
    var btn = $('btn-closeout');
    btn.disabled = !(d.complete && !d.overBudget);
    $('btn-refire').classList.toggle('hidden', !(S.phase === 'build' && closeoutReady() && d.complete && !d.overBudget));
    $('btn-refinery').classList.toggle('hidden', !(S.phase === 'build' && R.needsRefinery));
    refreshHint(d);
    refreshShelf();
  }
  function refreshHint(d) {
    var h = $('bay-hint');
    if (S.phase !== 'build') { h.style.opacity = 0; return; }
    h.style.opacity = 1;
    var msg;
    if (!S.assembly.shell) msg = 'Drag a <b>shell</b> from the shelf onto the glowing stand.<br>One finger orbits · pinch zooms.';
    else if (d.filled === 0) msg = rfp().needsRefinery
      ? 'This job needs <b>EMBER-X</b>. Fire up <b>⚗ THE STILL</b>, then load the bays.'
      : 'Load <b>canisters</b> into the open bays.<br>Amber EMBER = more bang · blue FROST = calmer.';
    else if (d.missing.length) msg = 'Still missing: <b>' + d.missing.join(' · ') + '</b>.<br>Tap a placed part to take it back off.';
    else if (d.overBudget) msg = '<b style="color:#ff8d7e">Over budget.</b> Take something off — the Authority won’t pay a penny past $' + rfp().budget.toLocaleString('en-US') + '.';
    else if (closeoutReady()) msg = 'Ready. <b>REFIRE</b> as-is — or run <b>CLOSE-OUT</b> to change wiring, seating or arming.';
    else msg = 'Looks right. Hit <b>CLOSE-OUT</b> to wire it up by hand.';
    h.innerHTML = '<span class="hint-small">ASSEMBLY BAY · ' + rfp().id + '</span>' + msg;
  }

  /* ================= INPUT — bay orbit + part drag + tap remove ================= */
  var pointers = {};
  var dragPart = null;   // {id, ghost, node}
  var raycaster = new THREE.Raycaster();

  function canvasPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function beginPartDrag(id, e) {
    PGAudio.init(); PGAudio.pickup();
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
    dragPart = { id: id, ghost: ghost, node: null, pid: e.pointerId };
    refreshNodes(id);
    movePartDrag(e);
    window.addEventListener('pointermove', movePartDrag);
    window.addEventListener('pointerup', endPartDrag);
    window.addEventListener('pointercancel', endPartDrag);
  }
  function movePartDrag(e) {
    if (!dragPart || e.pointerId !== dragPart.pid) return;
    var p = canvasPos(e);
    // nearest valid node in screen space
    var best = null, bestD = 76;
    nodeMarkers.forEach(function (mk) {
      var wp = mk.getWorldPosition(new THREE.Vector3());
      var sp = worldToScreen(wp, bay.camera);
      var dd = Math.hypot(sp.x - p.x, sp.y - p.y);
      if (dd < bestD) { bestD = dd; best = mk.userData.node; }
    });
    if (best && (!dragPart.node || dragPart.node.id !== best.id)) PGAudio.ghostHum();
    dragPart.node = best;
    if (best) {
      var pose = nodePose(best.id, dragPart.id);
      var wp2 = bay.device.localToWorld(pose.pos.clone());
      dragPart.ghost.position.copy(wp2);
      dragPart.ghost.rotation.copy(bay.device.rotation);
      dragPart.ghost.traverse(function (m) { if (m.isMesh) m.material.opacity = 0.85; });
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
      if (hit) dragPart.ghost.position.copy(hit);
      dragPart.ghost.rotation.set(0, 0, 0);
      dragPart.ghost.traverse(function (m) { if (m.isMesh) m.material.opacity = 0.45; });
    }
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
  }
  function placePart(id, node) {
    var a = S.assembly;
    if (node.id === 'stand') {
      a.shell = id;
      a.canisters = new Array(PG2.SHELLS[id].slots).fill(null);
      PGAudio.thunk(true);
    } else if (/^slot/.test(node.id)) {
      if (PG2.COMPOUNDS[id] && PG2.COMPOUNDS[id].cost === 0) {   // refined — comes from stock
        if (!(a.refine.stock[id] > 0)) {
          toast('No ' + PG2.COMPOUNDS[id].name + ' in stock — run ⚗ THE STILL.');
          refreshNodes(null);
          return;
        }
        a.refine.stock[id]--;
      }
      a.canisters[node.slot] = id;
      PGAudio.thunk(false);
    } else {
      a[id] = true;
      PGAudio.thunk(id === 'battery');
    }
    bay.bounce = 1;
    rebuildDevice();
    refreshHUD();
  }
  function restock(c) {
    if (c && PG2.COMPOUNDS[c] && PG2.COMPOUNDS[c].cost === 0) S.assembly.refine.stock[c]++;
  }
  function removePart(info) {
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
    rebuildDevice();
    refreshHUD();
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

  function onCanvasDown(e) {
    PGAudio.init();
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    var p = canvasPos(e);
    pointers[e.pointerId] = { x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now(), moved: false };
    bay.lastTouch = performance.now();
    if (S.phase === 'wiring') { wiringDown(e, p); return; }
    if (S.phase === 'det') { detDown(e, p); return; }
    if (S.phase === 'arm') { armDown(e, p); return; }
  }
  function onCanvasMove(e) {
    var pt = pointers[e.pointerId];
    var p = canvasPos(e);
    if (S.phase === 'wiring') { wiringMove(e, p); }
    if (S.phase === 'det') { detMove(e, p); }
    if (S.phase === 'arm') { armMove(e, p); }
    if (!pt) return;
    var dx = p.x - pt.x, dy = p.y - pt.y;
    if (Math.hypot(p.x - pt.sx, p.y - pt.sy) > 8) pt.moved = true;
    var ids = Object.keys(pointers);
    if (S.phase === 'build' && !dragPart) {
      if (ids.length === 1) {
        bay.orbit.theta -= dx * 0.0065;
        bay.orbit.phi = clamp(bay.orbit.phi - dy * 0.005, 0.25, 1.5);
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
    if (S.phase === 'wiring') wiringUp(e, p);
    if (S.phase === 'det') detUp(e, p);
    if (S.phase === 'arm') armUp(e, p);
    if (pt && !pt.moved && S.phase === 'build' && !dragPart && Object.keys(pointers).length === 1) {
      // tap: try remove part
      var ndc = new THREE.Vector2((p.x / W) * 2 - 1, -(p.y / H) * 2 + 1);
      raycaster.setFromCamera(ndc, bay.camera);
      var hits = raycaster.intersectObjects(placedMeshes, false);
      if (hits.length) {
        var root = hits[0].object.userData.rootPart;
        if (root && root.userData.remove) removePart(root.userData.remove);
      }
    }
    delete pointers[e.pointerId];
  }

  /* ================= SCREENS / FLOW ================= */
  var screens = ['scr-title', 'scr-rfp', 'scr-score'];
  function showScreen(id) {
    screens.forEach(function (s) { $(s).classList.toggle('active', s === id); });
  }
  function showUI(id) {
    ['ui-bay', 'ui-range'].forEach(function (u) { $(u).classList.toggle('hidden', u !== id); });
    if (!id) { $('ui-bay').classList.add('hidden'); $('ui-range').classList.add('hidden'); }
  }

  /* ---------- RFP ---------- */
  var rfpTimers = [];
  function buildRFP() {
    var R = rfp();
    var doc = $('rfp-doc');
    doc.innerHTML =
      '<div class="doc-sec">' +
        '<div class="doc-headrow"><span>' + R.form + '</span><span>SHEET 1 OF 1</span></div>' +
        '<div class="doc-stamp">CONFIDENTIAL</div>' +
        '<div class="rfp-no">REQUEST FOR PROPOSAL · ' + R.id + '</div>' +
        '<div class="rfp-title">' + R.title + '</div>' +
        '<div class="rfp-agency">REPUBLIC PROVING AUTHORITY · BUREAU OF CONTROLLED ENTHUSIASM</div>' +
        '<hr class="doc-rule">' +
      '</div>' +
      '<div class="doc-sec">' +
        '<div class="bignums">' +
          '<div class="bignum"><div class="bn-lbl">TARGET CRATER</div><div class="bn-val">' + R.craterMin + '–' + R.craterMax + '</div><div class="bn-unit">METRES ⌀</div></div>' +
          '<div class="bignum"><div class="bn-lbl">PARTS BUDGET</div><div class="bn-val">$' + (R.budget / 1000).toFixed(1).replace('.0', '') + 'k</div><div class="bn-unit">$' + R.budget.toLocaleString() + ' HARD CAP</div></div>' +
          '<div class="bignum"><div class="bn-lbl">DETONATE AT</div><div class="bn-val">T+' + R.tSpec.toFixed(1) + 's</div><div class="bn-unit">±' + R.tTol + ' s</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="doc-sec">' +
        '<hr class="doc-rule thin">' +
        '<p class="spec-clause"><span class="cl">7.4.1(c)</span> — ' + R.clause + '</p>' +
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
    bay.wiring = null;
    bay.detStage = null;
    bay.armStage = null;
    // the tinker loop: a kept build stays EXACTLY as you left it —
    // parts, wires, torque, seating, arming. Tweak one thing. Refire.
    if (!keepAssembly) S.assembly = PG2.makeAssembly();
    showScreen(null); showUI('ui-bay');
    $('ui-bay').classList.remove('closeout');
    $('bay-brand-txt').textContent = 'REDLINE ORDNANCE WORKS · ' + rfp().id;
    $('bay-attempt').textContent = 'TEST #' + (S.attempt + 1);
    buildShelf();
    $('stage-build').classList.remove('hidden');
    $('stage-bar').classList.add('hidden');
    $('wiring-ui').classList.add('hidden');
    $('det-ui').classList.add('hidden');
    $('arm-ui').classList.add('hidden');
    bay.orbit.theta = 0.7; bay.orbit.phi = 1.18; bay.orbit.radius = 4.4;
    bay.device.rotation.y = 0;
    rebuildDevice();
    refreshHUD();
  }

  /* ================= CLOSE-OUT STAGE 1 — WIRING ================= */
  var WIRE_COLORS = { red: COL.wireR, yellow: COL.wireY, green: COL.wireG };
  function panelLocal(x, y, z) {
    // wiring panel local coords → device local (panel centered at (0, .02, r))
    var d = casingDims(S.assembly.shell);
    return V3(x, 0.02 + y, d.r + (z || 0));
  }
  function initWiring() {
    var w = {
      posts: {}, terms: {}, wires: {}, drag: null,
      twist: null, group: new THREE.Group()
    };
    var lay = PG2.panelLayout(S.seed);
    var d = casingDims(S.assembly.shell);
    // posts (left column): red top, yellow mid, green bottom
    PG2.WIRES.forEach(function (c, i) {
      var y = 0.10 - i * 0.10;
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.07, 8),
        mat(WIRE_COLORS[c], { emissive: WIRE_COLORS[c], ei: 0.25, shin: 60 }));
      post.rotation.x = Math.PI / 2;
      post.position.copy(panelLocal(-0.17, y, -0.005));
      w.group.add(post);
      w.posts[c] = { local: panelLocal(-0.17, y, 0.03), mesh: post };
    });
    // terminals (right column): T1,T2,T3 top→bottom, labeled with shuffled roles
    ['T1', 'T2', 'T3'].forEach(function (t, i) {
      var y = 0.10 - i * 0.10;
      var screw = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 6),
        mat(COL.brass, { shin: 80 }));
      screw.rotation.x = Math.PI / 2;
      screw.position.copy(panelLocal(0.13, y, 0));
      w.group.add(screw);
      var lbl = textPlane(t + '·' + PG2.ROLE_LABEL[lay[t]], 0.16, 0.038, { color: '#f0e6c8', px: 46 });
      lbl.position.copy(panelLocal(0.13, y - 0.045, 0.012));
      w.group.add(lbl);
      w.terms[t] = { local: panelLocal(0.13, y, 0.03), mesh: screw, wire: null };
    });
    // wire tube meshes
    PG2.WIRES.forEach(function (c) {
      var m = new THREE.Mesh(new THREE.BufferGeometry(),
        mat(WIRE_COLORS[c], { shin: 40, flat: false }));
      m.frustumCulled = false;
      w.group.add(m);
      w.wires[c] = { mesh: m, end: null };  // end = terminal id or null (dangling)
    });
    bay.device.add(w.group);
    bay.wiring = w;
    // restore wiring already done — the tinker loop keeps your work
    PG2.WIRES.forEach(function (c) {
      var t = S.assembly.wires[c];
      if (t) {
        w.wires[c].end = t;
        w.terms[t].wire = c;
        if (S.assembly.torques[c]) {
          w.terms[t].mesh.material.color.setHex(0x8f7331);
          w.terms[t].mesh.scale.set(1, 0.8, 1);
        }
      }
    });
    PG2.WIRES.forEach(function (c) { updateWireCurve(c, null); });
    updateWiringNote();
  }
  function wireEndLocal(c) {
    var w = bay.wiring;
    var wr = w.wires[c];
    if (w.drag && w.drag.color === c) return w.drag.point;
    if (wr.end) return w.terms[wr.end].local;
    var p = w.posts[c].local.clone();
    p.y -= 0.16; p.z += 0.02;
    return p;
  }
  function updateWireCurve(c, dragPoint) {
    var w = bay.wiring;
    var a = w.posts[c].local.clone();
    var b = dragPoint || wireEndLocal(c);
    var pts = [];
    var sag = w.wires[c].end ? 0.05 : 0.025;
    for (var i = 0; i <= 10; i++) {
      var t = i / 10;
      var p = a.clone().lerp(b, t);
      p.y -= sag * Math.sin(Math.PI * t);       // catenary droop
      p.z += 0.02 * Math.sin(Math.PI * t);
      pts.push(p);
    }
    var curve = new THREE.CatmullRomCurve3(pts);
    var old = w.wires[c].mesh.geometry;
    w.wires[c].mesh.geometry = new THREE.TubeGeometry(curve, 16, 0.011, 6, false);
    if (old && old.dispose) old.dispose();
  }
  function screenOfLocal(v) {
    return worldToScreen(bay.device.localToWorld(v.clone()), bay.camera);
  }
  function enterWiring() {
    S.phase = 'wiring';
    S.closeoutStep = 0;
    $('ui-bay').classList.add('closeout');
    $('stage-build').classList.add('hidden');
    $('stage-bar').classList.remove('hidden');
    setStageBar(0);
    $('wiring-ui').classList.remove('hidden');
    $('bay-hint').style.opacity = 0;
    refreshNodes(null);
    // straighten the device & swing camera to the panel
    var d = casingDims(S.assembly.shell);
    tweenOrbitTo(V3(0.08, 1.44, d.r + 1.72), V3(0, 1.31, d.r - 0.05), 1100, function () {
      if (!bay.wiring) initWiring();
      tween(600, function (t) { bay.casingMesh.userData.doorPivot.rotation.x = -2.0 * t; });
      PGAudio.coverFlick();
    });
    var startRotY = bay.device.rotation.y % (Math.PI * 2);
    if (startRotY > Math.PI) startRotY -= Math.PI * 2;
    tween(700, function (t) { bay.device.rotation.y = lerp(startRotY, 0, t); });
    updateWiringNote();
  }
  function updateWiringNote() {
    var a = S.assembly;
    var attached = PG2.WIRES.filter(function (c) { return a.wires[c]; }).length;
    var torqued = PG2.WIRES.filter(function (c) { return a.torques[c]; }).length;
    var note = $('wiring-note');
    if (attached < 3) note.innerHTML = 'Drag each <b>wire</b> from its post to a terminal. Read the labels — the panel doesn’t.';
    else note.innerHTML = 'Wires landed. <b>Twist</b> each terminal in circles to torque it down. Or don’t. It’s your name on the form.' + (torqued ? ' (' + torqued + '/3 torqued)' : '');
    $('btn-panel-done').classList.toggle('hidden', attached < 3);
  }
  function wiringDown(e, p) {
    var w = bay.wiring;
    if (!w) return;
    // 1) a terminal that already holds an untorqued wire → circular twist to torque
    var bt = null, btD = 58;
    Object.keys(w.terms).forEach(function (t) {
      if (!w.terms[t].wire) return;
      if (S.assembly.torques[w.terms[t].wire]) return;
      var sp = screenOfLocal(w.terms[t].local);
      var dd = Math.hypot(sp.x - p.x, sp.y - p.y);
      if (dd < btD) { btD = dd; bt = t; }
    });
    if (bt) {
      var color = w.terms[bt].wire;
      var sp2 = screenOfLocal(w.terms[bt].local);
      w.twist = { term: bt, color: color, pid: e.pointerId, cx: sp2.x, cy: sp2.y, angle: null, acc: 0 };
      var ring = $('torque-ring');
      ring.classList.remove('hidden');
      ring.style.left = sp2.x + 'px';
      ring.style.top = sp2.y + 'px';
      return;
    }
    // 2) a post (or a dangling wire end) → drag that wire; grabbing the post of
    //    an attached wire pulls it back off its terminal
    var best = null, bestD = 55;
    PG2.WIRES.forEach(function (c) {
      var pts = [w.posts[c].local];
      if (!w.wires[c].end) pts.push(wireEndLocal(c));
      pts.forEach(function (lp) {
        var sp = screenOfLocal(lp);
        var dd = Math.hypot(sp.x - p.x, sp.y - p.y);
        if (dd < bestD) { bestD = dd; best = c; }
      });
    });
    if (best) {
      if (w.wires[best].end) {
        w.terms[w.wires[best].end].wire = null;
        w.wires[best].end = null;
        S.assembly.wires[best] = null;
        S.assembly.torques[best] = false;
        updateWiringNote();
      }
      w.drag = { color: best, pid: e.pointerId, point: w.posts[best].local.clone() };
      PGAudio.pickup();
    }
  }
  function wiringMove(e, p) {
    var w = bay.wiring;
    if (!w) return;
    if (w.drag && e.pointerId === w.drag.pid) {
      // project pointer onto the panel plane (device-local z = r+0.03)
      var d = casingDims(S.assembly.shell);
      var ndc = new THREE.Vector2((p.x / W) * 2 - 1, -(p.y / H) * 2 + 1);
      raycaster.setFromCamera(ndc, bay.camera);
      var planePt = bay.device.localToWorld(V3(0, 0, d.r + 0.03));
      var planeN = V3(0, 0, 1).applyQuaternion(bay.device.quaternion);
      var plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeN, planePt);
      var hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, hit)) {
        w.drag.point = bay.device.worldToLocal(hit.clone());
        updateWireCurve(w.drag.color, w.drag.point);
      }
    }
    if (w.twist && e.pointerId === w.twist.pid) {
      var ang = Math.atan2(p.y - w.twist.cy, p.x - w.twist.cx);
      if (w.twist.angle != null) {
        var delta = ang - w.twist.angle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        var prev = w.twist.acc;
        w.twist.acc += Math.abs(delta);
        if (Math.floor(w.twist.acc / 0.7) > Math.floor(prev / 0.7)) PGAudio.ratchet();
        var frac = clamp(w.twist.acc / (Math.PI * 2), 0, 1);
        $('torque-ring-fill').style.setProperty('--p', frac * 100);
        w.terms[w.twist.term].mesh.rotation.y += delta;
        if (frac >= 1) { finishTorque(); return; }   // twist is done and cleared
      }
      w.twist.angle = ang;
    }
  }
  function finishTorque() {
    var w = bay.wiring;
    var tw = w.twist;
    if (!tw) return;
    S.assembly.torques[tw.color] = true;
    w.terms[tw.term].mesh.material.color.setHex(0x8f7331);
    w.terms[tw.term].mesh.scale.set(1, 0.8, 1);
    PGAudio.torqueDone();
    toast('Terminal ' + tw.term.slice(1) + ' torqued.');
    w.twist = null;
    $('torque-ring').classList.add('hidden');
    updateWiringNote();
  }
  function wiringUp(e, p) {
    var w = bay.wiring;
    if (!w) return;
    if (w.drag && e.pointerId === w.drag.pid) {
      var c = w.drag.color;
      // nearest free terminal within 60px
      var best = null, bestD = 60;
      Object.keys(w.terms).forEach(function (t) {
        if (w.terms[t].wire) return;
        var sp = screenOfLocal(w.terms[t].local);
        var dd = Math.hypot(sp.x - p.x, sp.y - p.y);
        if (dd < bestD) { bestD = dd; best = t; }
      });
      w.drag = null;
      if (best) {
        w.wires[c].end = best;
        w.terms[best].wire = c;
        S.assembly.wires[c] = best;
        PGAudio.wireSnap();
      } else {
        w.wires[c].end = null;
        S.assembly.wires[c] = null;
        PGAudio.wireDrop();
      }
      updateWireCurve(c, null);
      updateWiringNote();
    }
    if (w.twist && e.pointerId === w.twist.pid) {
      w.twist = null;
      $('torque-ring').classList.add('hidden');
    }
  }
  function exitWiring() {
    // close the door over whatever you did
    tween(500, function (t) { bay.casingMesh.userData.doorPivot.rotation.x = -2.0 * (1 - t); });
    PGAudio.thunk(false);
    later(420, enterDet);
  }

  /* ================= CLOSE-OUT STAGE 2 — DETONATOR ================= */
  function enterDet() {
    S.phase = 'det';
    S.closeoutStep = 1;
    setStageBar(1);
    $('wiring-ui').classList.add('hidden');
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
    S.closeoutStep = 2;
    setStageBar(2);
    $('det-ui').classList.add('hidden');
    $('arm-ui').classList.remove('hidden');
    if (bay.detStage) {
      bay.scene.remove(bay.detStage.caseG);
      bay.scene.remove(bay.detStage.det);
    }
    document.querySelector('.ck-head').textContent = 'PRE-FLIGHT CLOSE-OUT · ' + rfp().id;
    ['ck-wiring', 'ck-torque', 'ck-det'].forEach(function (id) { $(id).classList.remove('shown'); });
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
    var lines = [
      { id: 'ck-wiring', ok: PG2.WIRES.every(function (c) { return a.wires[c]; }),
        okTxt: '✓ ROUTED', sub: 'three conductors landed' },
      { id: 'ck-torque', ok: PG2.WIRES.every(function (c) { return a.torques[c]; }),
        okTxt: '✓ TORQUED', sub: 'all terminals to spec' },
      { id: 'ck-det', ok: a.det.seated,
        okTxt: a.det.slam > PG2.SLAM_THRESHOLD ? '✓ SEATED*' : '✓ SEATED',
        sub: a.det.slam > PG2.SLAM_THRESHOLD ? '*handling log attached' : 'clean seat, full depth' }
    ];
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
    later(350 + 3 * 550 + 200, function () {
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

  /* ================= RANGE SCENE ================= */
  function initRange() {
    var scene = new THREE.Scene();
    scene.background = gradientTexture([[0, '#6fa5cf'], [0.42, '#c8d5cf'], [0.6, '#f0d9a8'], [1, '#e8c68a']], true);
    scene.fog = new THREE.Fog(0xe3d4b0, 1400, 3600);
    var camera = new THREE.PerspectiveCamera(7, W / H, 0.5, 6000);

    scene.add(new THREE.HemisphereLight(0xcfe0f0, 0x8a6a42, 0.85));
    var sun = new THREE.DirectionalLight(0xfff3da, 1.0);
    sun.position.set(-800, 900, 500);
    scene.add(sun);

    // terrain
    var tg = new THREE.PlaneGeometry(6000, 6000, 56, 56);
    var pos = tg.attributes.position;
    var colors = [];
    var col = new THREE.Color();
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i);
      var r2 = Math.hypot(x, y);
      var h = 0;
      if (r2 > 60) {
        h = Math.sin(x * 0.004 + 1.7) * Math.cos(y * 0.0031) * 7 +
            Math.sin(x * 0.013 + y * 0.009) * 2.5;
        h *= clamp((r2 - 60) / 300, 0, 1);
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

    // mesas (three ridge lines, fading with distance)
    var mesas = [];
    [{ z: -900, h: 48, c: 0x9a6b45, sp: 2200 }, { z: -1500, h: 74, c: 0xb08258, sp: 3000 }, { z: -2200, h: 110, c: 0xc9a37e, sp: 4200 }].forEach(function (m, mi) {
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
      var mesh = new THREE.Mesh(geo, mat(m.c, { shin: 2 }));
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

    // device on trestle (built from the actual assembly at range entry)
    var deviceHolder = new THREE.Group();
    deviceHolder.position.set(0, 1.6, 0);
    deviceHolder.scale.set(1.6, 1.6, 1.6);
    scene.add(deviceHolder);

    // flatbed truck
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
    for (var wi = 0; wi < 3; wi++) {
      [-1.2, 1.2].forEach(function (z) {
        var wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12), mat(0x22262b, { shin: 4 }));
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(-2.6 + wi * 2.9, 0.55, z);
        truck.add(wheel);
      });
    }
    scene.add(truck);
    truck.visible = false;

    // heat shimmer bands
    var shimmer = [];
    for (var si = 0; si < 3; si++) {
      var sm = new THREE.Mesh(new THREE.PlaneGeometry(2400, 14 + si * 9),
        new THREE.MeshBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0.05, depthWrite: false }));
      sm.position.set(0, 9 + si * 12, -420 - si * 260);
      scene.add(sm);
      shimmer.push(sm);
    }

    return {
      scene: scene, camera: camera, pad: pad, deviceHolder: deviceHolder,
      truck: truck, mesas: mesas, shimmer: shimmer,
      fx: null, shake: 0, mode: 'idle'
    };
  }

  /* ---------- range flow ---------- */
  function enterRange() {
    clearLater();
    S.attempt++;
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
    range.deviceHolder.visible = true;
    range.pad.visible = true;
    if (range.trestle) range.trestle.visible = false;
    range.shake = 0;
    // put the real device on the flatbed
    var dh = range.deviceHolder;
    for (var i = dh.children.length - 1; i >= 0; i--) dh.remove(dh.children[i]);
    var dev = buildRangeDevice();
    dh.add(dev);
    dh.position.set(-0.7, 2.0, 0);
    dh.scale.set(0.62, 0.62, 0.62);
    range.truck.add(dh);
    range.truck.visible = true;
    range.truck.position.set(-90, 0, 34);
    range.camera.fov = 30;
    range.camera.updateProjectionMatrix();
    range.mode = 'truck';
    range.truckT = 0;
    setCaption('SECTOR 9 · ACCESS ROAD', 'The device rides out to Pad A. It has never looked more certain of anything.');
    PGAudio.engineStart();
    $('btn-skip-truck').classList.remove('hidden');
    later(7000, stationSeven);
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
    if (a.battery) { var b = buildBattery(); b.position.set(-d.L / 2 - 0.16, 0, 0); g.add(b); }
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
    // device moves to a trestle on the pad
    var dh = range.deviceHolder;
    range.truck.remove(dh);
    range.scene.add(dh);
    dh.position.set(0, 2.1, 0);
    dh.scale.set(1.7, 1.7, 1.7);
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
    // Station 7 long lens
    range.camera.position.set(60, 14, 1600);
    range.camera.fov = 7;
    range.camera.updateProjectionMatrix();
    range.camera.lookAt(0, 3, 0);
    $('cam-overlay').classList.remove('hidden');
    $('cam-station').textContent = PG2.CAMERA.id + ' — ' + PG2.CAMERA.km.toFixed(1) + ' KM';
    $('cam-clock').textContent = 'T−00:05.0';
    PGAudio.wind();
    setCaption('STATION 7 · LONG LENS · f/64', 'The review board raises its binoculars. Heat swims over the pan.');
    later(1800, function () { $('btn-arm').classList.remove('hidden'); });
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

  var rangeT = { camT: 0, t0: 0, detAt: null, soundAt: null, detDone: false, soundDone: false, lastBeep: null };
  function startCountdown() {
    S.phase = 'counting';
    setCaption('', '');
    var o = S.result.outcome;
    rangeT.t0 = performance.now();
    rangeT.camT = 0;
    rangeT.detDone = false;
    rangeT.soundDone = false;
    rangeT.lastBeep = 6;
    rangeT.detAt = o.fired ? 5 + o.detT : null;
    rangeT.soundAt = rangeT.detAt != null ? rangeT.detAt + PG2.SOUND_DELAY : null;
    rangeT.dudHandled = false;
  }
  function updateCamClock() {
    var tm = rangeT.camT - 5;
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
      var cnt = 46, pos2 = new Float32Array(cnt * 3), vel = [];
      for (var di = 0; di < cnt; di++) {
        pos2[di * 3] = 0; pos2[di * 3 + 1] = 2; pos2[di * 3 + 2] = 0;
        var dv = lobes[di % 2].clone().add(V3((rand() - 0.5) * 1.4, rand() * 1.1, (rand() - 0.5) * 1.4));
        dv.normalize().multiplyScalar(25 + rand() * 45 * (0.5 + vis.yield01));
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
    if (!vis.fizzle) range.pad.visible = false;
    // rising smoke column (the part the board photographs)
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
          drift: (rand() - 0.5) * 3,
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
    if (fx.smoke) {
      fx.smoke.forEach(function (sm) {
        var u = sm.userData;
        var tt = Math.max(t - u.delay, 0);
        if (tt <= 0) return;
        var k = clamp(tt / 6, 0, 1);
        sm.position.y = 4 + u.rise * tt * (1 - k * 0.5);
        sm.position.x = u.drift * tt;
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

  /* ---------- crater reveal + measuring ---------- */
  function craterReveal() {
    S.phase = 'crater';
    var crater = S.result.outcome.craterActual || 0;
    var r = Math.max(crater / 2, 1.6);
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
    bowl.position.y = 0.5;
    g.add(bowl);
    // thrown rim
    var rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.04, r * 0.13, 8, 36),
      new THREE.MeshLambertMaterial({ color: 0x63482c }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.55;
    rim.scale.z = 0.3;
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
    range.scene.add(g);
    range.craterG = g;
    // low push-in
    var c = range.camera;
    c.fov = 24;
    c.updateProjectionMatrix();
    var from = V3(r * 6.4, r * 2.6, r * 8.4);
    var to = V3(r * 3.3, r * 1.35, r * 4.4);
    setCaption('SURVEY PASS · PAD A', S.result.outcome.fired ? 'The dust votes last. Measuring…' : 'There is a device-shaped silence on the pad.');
    tween(3800, function (t) {
      c.position.lerpVectors(from, to, t);
      c.lookAt(0, 0.6, 0);
    }, function () { drawMeasure(r); }, easeInOut);
  }
  function drawMeasure(r) {
    var svg = $('measure-svg');
    svg.classList.remove('hidden');
    var pL = worldToScreen(V3(-r, 0.8, 0), range.camera);
    var pR = worldToScreen(V3(r, 0.8, 0), range.camera);
    // svg space maps 1:1 to screen via viewBox reset
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.style.width = W + 'px';
    svg.style.left = '0'; svg.style.top = '0'; svg.style.transform = 'none';
    svg.style.height = H + 'px';
    var y = (pL.y + pR.y) / 2 - 12;
    var crater = S.result.outcome.craterActual || 0;
    var R = rfp();
    svg.innerHTML =
      '<line class="msr-line" x1="' + pL.x + '" y1="' + y + '" x2="' + pL.x + '" y2="' + y + '" id="msr-main"/>' +
      '<line class="msr-line" x1="' + pL.x + '" y1="' + (y - 9) + '" x2="' + pL.x + '" y2="' + (y + 9) + '"/>' +
      '<line class="msr-line" x1="' + pR.x + '" y1="' + (y - 9) + '" x2="' + pR.x + '" y2="' + (y + 9) + '" opacity="0"/>' +
      '<text id="msr-txt" x="' + ((pL.x + pR.x) / 2) + '" y="' + (y - 16) + '" text-anchor="middle" font-size="17">⌀ 0.0 m</text>' +
      '<g id="msr-band"></g>';
    var main = svg.querySelector('#msr-main');
    var endTick = svg.querySelectorAll('line')[2];
    var txt = svg.querySelector('#msr-txt');
    var t0 = performance.now();
    (function anim() {
      var t = clamp((performance.now() - t0) / 1600, 0, 1);
      var e = easeInOut(t);
      main.setAttribute('x2', lerp(pL.x, pR.x, e));
      txt.textContent = '⌀ ' + (crater * e).toFixed(1) + ' m';
      PGAudio.measureTick();
      if (t < 1) requestAnimationFrame(anim);
      else {
        endTick.setAttribute('opacity', '1');
        PGAudio.typeDing();
        // spec band ruler (0–30 m, centered under the measurement)
        var cx = (pL.x + pR.x) / 2;
        var yb = y + 26;
        var rulerW = Math.min(W * 0.7, 260);
        var rx = cx - rulerW / 2;
        var perM = rulerW / R.meterMax;
        var g = svg.querySelector('#msr-band');
        g.innerHTML =
          '<line class="msr-line" x1="' + rx + '" y1="' + yb + '" x2="' + (rx + rulerW) + '" y2="' + yb + '" opacity=".6"/>' +
          '<line class="msr-band" x1="' + (rx + R.craterMin * perM) + '" y1="' + yb + '" x2="' + (rx + R.craterMax * perM) + '" y2="' + yb + '"/>' +
          '<text x="' + (rx + R.craterMin * perM) + '" y="' + (yb + 14) + '" text-anchor="middle" font-size="9">' + R.craterMin + '</text>' +
          '<text x="' + (rx + R.craterMax * perM) + '" y="' + (yb + 14) + '" text-anchor="middle" font-size="9">' + R.craterMax + '</text>' +
          '<circle cx="' + (rx + clamp(crater, 0, R.meterMax) * perM) + '" cy="' + yb + '" r="4" fill="' +
            (S.result.stamps.size.ok ? '#7ed49a' : '#ff7a68') + '"/>';
        window.__pgMeasureDone = true;
        later(3400, showScore);   // let the measurement breathe
      }
    })();
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
    showUI(null);
    $('measure-svg').classList.add('hidden');
    var r = S.result;
    var R = rfp();
    if (r.win) PGAudio.fanfare(); else PGAudio.sadDrone();
    // per-contract bests, worn with pride
    if (!S.best[S.contract]) S.best[S.contract] = { stars: 0, net: -Infinity, wonOn: null };
    var b = S.best[S.contract];
    b.stars = Math.max(b.stars, r.stars);
    b.net = Math.max(b.net, r.payout.net);
    if (r.win && b.wonOn == null) b.wonOn = S.attempt;
    var el = $('score-scroll');
    function stampCard(lbl, st) {
      return '<div class="stamp-card"><div class="sc-lbl">' + lbl + '</div>' +
        '<div class="sc-val">' + st.value + '</div>' +
        '<div><span class="stamp-big ' + (st.ok ? 'pass' : 'fail') + '">' + (st.ok ? 'IN SPEC' : 'OUT') + '</span></div>' +
        '<div class="sc-spec">SPEC: ' + st.spec + '</div></div>';
    }
    var stars = '';
    for (var i = 0; i < 3; i++) stars += '<span class="' + (i < r.stars ? '' : 'dim') + '">★</span>';
    var nextIsC2 = r.win && S.contract === 0;
    el.innerHTML =
      '<div class="score-sheet">' +
        '<div class="score-head">REPUBLIC PROVING AUTHORITY · ADJUDICATION</div>' +
        '<div class="score-title">RANGE DAY RESULTS</div>' +
        '<div class="score-sub">' + R.id + ' · TEST #' + S.attempt + ' · SERIES ' + S.seed + '</div>' +
        '<div class="stamp-row">' +
          stampCard('SIZE', r.stamps.size) +
          stampCard('TIMING', r.stamps.timing) +
          stampCard('CLEAN', r.stamps.clean) +
        '</div>' +
        (r.hint ? '<div class="hint-callout"><span class="hc-kicker">TEST #' + S.attempt +
          (r.win ? ' — VERDICT' : ' — WHAT TO TWEAK') + '</span>' + r.hint + '</div>' : '') +
        '<div class="award-banner ' + (r.win ? 'win' : 'lose') + '">' +
          '<div class="ab-kicker">' + (r.win ? 'CONTRACT AWARDED' : 'CONTRACT NOT AWARDED') + '</div>' +
          '<div class="ab-title">' + (r.win ? 'REDLINE ORDNANCE WORKS' : (r.vantage.ok ? 'VANTAGE DYNAMICS' : 'NO AWARD MADE')) + '</div>' +
          '<div class="ab-stars">' + stars + '</div>' +
        '</div>' +
        '<table class="pay-table">' +
          '<tr><td>DEVELOPMENT AWARD</td><td>' + (r.payout.award ? fmt$(r.payout.award) : '—') + '</td></tr>' +
          '<tr><td>CLEAN-DETONATION BONUS</td><td>' + (r.payout.bonus ? '+' + fmt$(r.payout.bonus) : '—') + '</td></tr>' +
          '<tr><td>PARTS &amp; REFINING (AS BUILT)</td><td>−' + fmt$(r.payout.cost) + '</td></tr>' +
          '<tr class="net"><td>NET TO REDLINE</td><td class="' + (r.payout.net >= 0 ? 'pos' : 'neg') + '">' +
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
          (nextIsC2
            ? '<button id="btn-newcontract" type="button">NEXT CONTRACT<span class="sub">RFP-048 · DOUBLE-WIDE</span></button>'
            : '<button id="btn-newcontract" type="button">NEW CONTRACT<span class="sub">FRESH SERIES</span></button>') +
        '</div>' +
        '<div class="score-best">BEST ON ' + R.id + ' — <b>' + b.stars + '★</b>' +
          (b.net > -Infinity ? ' · NET ' + (b.net < 0 ? '−' : '') + fmt$(Math.abs(b.net)) : '') +
          (b.wonOn ? ' · FIRST WIN ON TEST #' + b.wonOn : '') + '</div>' +
        '<div class="score-seed">SERIES ' + S.seed + ' · SAME BUILD + SAME SERIES = SAME RESULT · ALL SCIENCE INVENTED</div>' +
      '</div>';
    showScreen('scr-score');
    if (r.incident) $('btn-incident').addEventListener('click', showIncident);
    $('btn-retry').addEventListener('click', function () {
      PGAudio.tap();
      enterBuild(true);       // the whole build, untouched — tweak one thing
    });
    $('btn-newcontract').addEventListener('click', function () {
      PGAudio.tap();
      if (nextIsC2) S.contract = 1;
      S.seed = PG2.makeSeed();
      S.attempt = 0;
      S.assembly = PG2.makeAssembly();
      startContract();
    });
  }
  function showIncident() {
    PGAudio.tap();
    var inc = S.result.incident;
    var doc = $('incident-doc');
    doc.innerHTML =
      '<div class="ir-agency">REPUBLIC PROVING AUTHORITY</div>' +
      '<div class="ir-form">' + inc.form + ' · RANGE INCIDENT REPORT</div>' +
      '<div class="ir-title">INCIDENT REPORT</div>' +
      '<div class="ir-row">' +
        '<div class="ir-field"><div class="ir-lbl">SERIES</div><div class="ir-val">' + inc.series + '</div></div>' +
        '<div class="ir-field"><div class="ir-lbl">CONTRACTOR</div><div class="ir-val">REDLINE ORDNANCE WORKS</div></div>' +
      '</div>' +
      '<div class="ir-row">' +
        '<div class="ir-field"><div class="ir-lbl">OUTCOME</div><div class="ir-val" id="ir-outcome"></div></div>' +
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
      // idle spin on the work stand (build only)
      if (S.phase === 'build') {
        if (!dragPart && bay.spinEnabled !== false && now - bay.lastTouch > 3500 && Object.keys(pointers).length === 0) {
          bay.device.rotation.y += dt * 0.22;
        }
        bayCam();
      }
      // stand bounce on part snap
      if (bay.bounce > 0.01) {
        bay.bounce *= Math.pow(0.0018, dt);
        var by = 1.32 - Math.sin(performance.now() * 0.03) * 0.016 * bay.bounce;
        bay.device.position.y = by;
      }
      // node marker pulse
      var pulse = 1 + Math.sin(now * 0.007) * 0.18;
      nodeMarkers.forEach(function (mk) { mk.scale.set(pulse, pulse, pulse); });
      renderer.render(bay.scene, bay.camera);
      return;
    }

    /* range phases */
    if (range) {
      // heat shimmer
      range.shimmer.forEach(function (sm, i) {
        sm.position.y = 9 + i * 12 + Math.sin(now * 0.0011 + i * 2.2) * 2.4;
        sm.material.opacity = 0.035 + 0.03 * (0.5 + 0.5 * Math.sin(now * 0.0017 + i));
      });
      range.mesas.forEach(function (m, i) {
        m.position.y = Math.sin(now * 0.0021 + i * 1.4) * 0.55;
      });
      if (S.phase === 'truck') {
        range.truckT += dt;
        var tx2 = lerp(-90, 0, easeInOut(clamp(range.truckT / 6.4, 0, 1)));
        range.truck.position.x = tx2;
        range.truck.position.z = 34;
        range.camera.position.set(tx2 + 16, 4.5, 62);
        range.camera.lookAt(tx2, 2.5, 34);
      }
      if (S.phase === 'counting') {
        rangeT.camT = (now - rangeT.t0) / 1000;   // wall clock — never drifts on slow frames
        updateCamClock();
        var tMinus = 5 - rangeT.camT;
        var whole = Math.ceil(tMinus);
        if (!rangeT.detDone && whole >= 0 && whole <= 4 && whole !== rangeT.lastBeep && tMinus > -0.05) {
          rangeT.lastBeep = whole;
          PGAudio.beep(whole === 0);
        }
        if (rangeT.detAt != null && !rangeT.detDone && rangeT.camT >= rangeT.detAt) {
          rangeT.detDone = true;
          igniteFX();
          if (S.result.outcome.type === 'early') {
            $('cam-tick').textContent = 'OFF-CUE EVENT — T−' + Math.abs(5 - rangeT.camT).toFixed(1) + ' s';
            $('cam-tick').classList.remove('hidden');
          } else if (S.result.outcome.type === 'misfire' && rangeT.detAt > 5.2) {
            $('cam-tick').textContent = 'LATE EVENT — T+' + (rangeT.camT - 5).toFixed(1) + ' s';
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
        if (rangeT.detAt == null && rangeT.camT > 6.2 && !rangeT.dudHandled) {
          rangeT.dudHandled = true;
          PGAudio.wind();
          dudHold();
        }
      }
      stepFX(dt);
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
  $('btn-start').addEventListener('click', function () {
    PGAudio.init(); PGAudio.tap();
    startContract();
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
    stationSeven();
  });

  /* ================= THE STILL (REFINERY) ================= */
  var REF_BAND = { lo: 0.58, hi: 0.78 };    // needle band (matches gauge CSS)
  var ref = {
    open: false, running: false, heating: false, scorched: false,
    T: 0, prog: 0, scorch: 0, batchNum: 0, wobbleT: 0, walk: 0, walkTarget: 0, rng: null
  };
  function refStatus(html) { $('ref-status').innerHTML = html; }
  function refStockLine() {
    var st = S.assembly.refine.stock;
    $('ref-stock').innerHTML = 'STOCK — EMBER-X <b>×' + st.emberx + '</b> · SCORCHED <b>×' + st.emberxs + '</b> · SPENT <b>' + fmt$(S.assembly.refine.spend) + '</b>';
  }
  function updateRefStart() {
    var d = PG2.derive(S.assembly, rfp());
    var over = d.cost + PG2.REFINERY.batchCost > rfp().budget;
    var btn = $('ref-start');
    btn.disabled = ref.running || over;
    btn.textContent = over ? 'BUDGET WON’T COVER ANOTHER BATCH'
      : 'START BATCH — $' + PG2.REFINERY.batchCost + ' · ' + PG2.REFINERY.batchYield + ' CANISTERS';
  }
  function openRefinery() {
    ref.open = true;
    ref.running = false; ref.heating = false;
    ref.T = 0; ref.prog = 0; ref.scorch = 0; ref.scorched = false;
    $('ref-needle').style.top = '96%';
    $('ref-prog-fill').style.width = '0%';
    refStatus('The kettle is cold. EMBER goes in ordinary; it comes out with ambitions.');
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
    PGAudio.batchDone(!ref.scorched);
    refStatus(ref.scorched
      ? '<b class="scorch">SCORCHED.</b> Two canisters of weaker, angrier X. They still count. Barely.'
      : 'Beautiful. Two canisters of <b>EMBER-X</b>, glowing politely.');
    refStockLine();
    refreshHUD();
    updateRefStart();
  }
  function stepRefinery(dt, now) {
    if (!ref.open || !ref.running) return;
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
  $('ref-start').addEventListener('click', function () { PGAudio.tap(); startBatch(); });
  $('ref-close').addEventListener('click', function () {
    PGAudio.tap();
    PGAudio.boilStop();
    ref.open = false; ref.running = false; ref.heating = false;
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
    wireAnchors: function () {
      if (!bay.wiring) return null;
      var out = { posts: {}, terms: {} };
      PG2.WIRES.forEach(function (c) { out.posts[c] = screenOfLocal(bay.wiring.posts[c].local); });
      Object.keys(bay.wiring.terms).forEach(function (t) { out.terms[t] = screenOfLocal(bay.wiring.terms[t].local); });
      out.layout = PG2.panelLayout(S.seed);
      return out;
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
  initGL();
  bay = initBay();
  makeIcons();
  buildShelf();
  bayCam();
  requestAnimationFrame(loop);

})();
