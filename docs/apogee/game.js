/* APOGEE — tactical article program. Ground-up build on modern three.js.
   Engine + state machine + juice + procedural audio + parametric article + strike cinematic. */
(function () {
  var T = window.THREE, X = window.TX;
  var $ = function (id) { return document.getElementById(id); };
  var showErr = function (m) { var e = $('err'); if (e) e.textContent = String(m); };
  window.addEventListener('error', function (e) { showErr(e.message + '\n' + (e.error && e.error.stack || '')); });

  try {
  // ============================================================ helpers / math
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  // frame-rate independent damping (maath-style)
  var damp = function (cur, tgt, lambda, dt) { return lerp(cur, tgt, 1 - Math.exp(-lambda * dt)); };
  var dampV = function (v, tx, ty, tz, lambda, dt) { v.x = damp(v.x, tx, lambda, dt); v.y = damp(v.y, ty, lambda, dt); v.z = damp(v.z, tz, lambda, dt); };

  // ============================================================ renderer / scene
  var canvas = $('gl');
  var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = T.NeutralToneMapping || T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78; // device over-exposes; keep tone in the metal instead of clipping to white
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  var isP3 = false; try { isP3 = !!(window.matchMedia && window.matchMedia('(color-gamut: p3)').matches); } catch (e) {}
  try { if (isP3 && T.DisplayP3ColorSpace) renderer.outputColorSpace = T.DisplayP3ColorSpace; } catch (e) {}
  if (X.RectAreaLightUniformsLib) X.RectAreaLightUniformsLib.init();

  var scene = new T.Scene();
  var pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new X.RoomEnvironment(), 0.05).texture;

  // gradient sky backdrop
  var skyTex = (function () {
    var c = document.createElement('canvas'); c.width = 8; c.height = 512; var g = c.getContext('2d');
    var grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#04060c'); grd.addColorStop(0.6, '#070a13'); grd.addColorStop(0.9, '#0c1220'); grd.addColorStop(1, '#141b2c');
    g.fillStyle = grd; g.fillRect(0, 0, 8, 512);
    var tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; return tx;
  })();
  scene.background = skyTex;
  scene.fog = new T.Fog(0x0a0e18, 40, 140);

  var W = window.innerWidth, H = window.innerHeight;
  // near plane kept well off 0 — a 0.1:400 ratio wrecks depth precision and causes z-fighting on device
  var camera = new T.PerspectiveCamera(33, W / H, 0.6, 260);
  var camPos = new T.Vector3(), camLook = new T.Vector3(0, 2.2, 0);   // spring targets
  camera.position.set(6, 4, 10);

  // ============================================================ lighting
  var key = new T.RectAreaLight(0xfff2e6, 3.2, 7, 11); key.position.set(-5.5, 6.5, 6); key.lookAt(0, 2, 0); scene.add(key);
  var rim = new T.DirectionalLight(0xbcd4ff, 0.85); rim.position.set(6, 4, -6); scene.add(rim);
  scene.add(new T.HemisphereLight(0x2a3446, 0x05070c, 0.3));
  var sh = new T.DirectionalLight(0xffffff, 0.0); sh.position.set(-3, 12, 4); sh.castShadow = true;
  sh.shadow.mapSize.set(2048, 2048); sh.shadow.camera.near = 1; sh.shadow.camera.far = 40;
  sh.shadow.camera.left = -8; sh.shadow.camera.right = 8; sh.shadow.camera.top = 10; sh.shadow.camera.bottom = -4;
  sh.shadow.bias = -0.0006; sh.shadow.normalBias = 0.04; sh.shadow.radius = 5; scene.add(sh);

  // ============================================================ ground / bench floor
  var floorTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 512; var g = c.getContext('2d');
    g.fillStyle = '#10131c'; g.fillRect(0, 0, 512, 512);
    var rg = g.createRadialGradient(256, 256, 20, 256, 256, 250);
    rg.addColorStop(0, '#252a36'); rg.addColorStop(0.45, '#161a24'); rg.addColorStop(1, '#0a0c12'); g.fillStyle = rg; g.fillRect(0, 0, 512, 512);
    var tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; return tx;
  })();
  var floor = new T.Mesh(new T.CircleGeometry(120, 96), new T.MeshStandardMaterial({ map: floorTex, metalness: 0.5, roughness: 0.45, envMapIntensity: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; floor.receiveShadow = true; scene.add(floor);

  // soft contact-shadow blob under the article (a dark radial sprite on the ground)
  var contactTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
    var rg = g.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, 'rgba(0,0,0,0.55)'); rg.addColorStop(0.6, 'rgba(0,0,0,0.25)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128); var tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; return tx;
  })();
  var contact = new T.Mesh(new T.PlaneGeometry(4, 4), new T.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = 0.005; scene.add(contact);

  // ============================================================ materials
  function titanium() { return new T.MeshPhysicalMaterial({ color: 0x6d7480, metalness: 1, roughness: 0.52, anisotropy: 0.5, anisotropyRotation: Math.PI / 2, clearcoat: 0.2, clearcoatRoughness: 0.6, envMapIntensity: 0.7, dithering: true }); }
  function carbon() { return new T.MeshPhysicalMaterial({ color: 0x121418, metalness: 0.25, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 1, dithering: true }); }
  function brass() { return new T.MeshStandardMaterial({ color: 0xbf9d63, metalness: 1, roughness: 0.28, envMapIntensity: 1.1, dithering: true }); }
  function ceramic() { return new T.MeshPhysicalMaterial({ color: 0x322e2b, metalness: 0, roughness: 0.74, clearcoat: 0.12, clearcoatRoughness: 0.6, envMapIntensity: 0.6, dithering: true }); }
  function darkMetal() { return new T.MeshStandardMaterial({ color: 0x2e3238, metalness: 1, roughness: 0.5, envMapIntensity: 0.9, dithering: true }); }
  function signal() { return new T.MeshPhysicalMaterial({ color: 0x1f6f7e, metalness: 0.7, roughness: 0.28, clearcoat: 0.5, emissive: 0x0a3540, emissiveIntensity: 0.3, envMapIntensity: 1, dithering: true }); }

  // ============================================================ the article (parametric)
  var WARHEADS = [
    { key: 'CONV',  name: 'CONVENTIONAL', yield: 0.5,  unit: 'KT', blast: 1.0, band: 0x1f6f7e },
    { key: 'HEAVY', name: 'HEAVY',        yield: 12,   unit: 'KT', blast: 1.6, band: 0xbf9d63 },
    { key: 'THERM', name: 'THERMOBARIC',  yield: 44,   unit: 'KT', blast: 2.2, band: 0xd06a2a },
    { key: 'NUKE',  name: 'THERMONUCLEAR',yield: 1.4,  unit: 'MT', blast: 3.4, band: 0xe23b08 }
  ];
  var NOSES = [ { key: 'OGIVE', name: 'OGIVE', prec: 3, len: 1.25 }, { key: 'BLUNT', name: 'BLUNT', prec: 1, len: 0.8 }, { key: 'SPIKE', name: 'SPIKE', prec: 2, len: 1.7 } ];
  var FINSET = [ { key: 'X4', name: '4 · SWEPT', n: 4, prec: 2 }, { key: 'X3', name: '3 · CLIPPED', n: 3, prec: 1 }, { key: 'GRID', name: 'GRID', n: 4, prec: 3 } ];
  var BODY = [ { key: 'S', name: 'SHORT', len: 2.6, reach: 900 }, { key: 'M', name: 'STANDARD', len: 3.35, reach: 1650 }, { key: 'L', name: 'EXTENDED', len: 4.2, reach: 2600 } ];

  var spec = { nose: 0, body: 1, warhead: 0, fins: 0 };

  var turntable = new T.Group(); scene.add(turntable);   // holds the article, rotates in bench
  var article = null, markerLED = null;

  function ogiveR(x, R, L) { var rho = (R * R + L * L) / (2 * R); return Math.sqrt(rho * rho - (L - x) * (L - x)) - (rho - R); }

  function buildArticle() {
    if (article) { turntable.remove(article); article.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
    article = new T.Group();
    var R = 0.34, bodyTop = BODY[spec.body].len, noseK = NOSES[spec.nose], noseLen = noseK.len;
    var wh = WARHEADS[spec.warhead];

    // radius along the nose (frac 0..1); blunt tips avoid degenerate apex slivers that flicker
    function noseRad(frac) {
      if (noseK.key === 'BLUNT') return Math.max(R * (1 - frac * frac * 0.82), 0.055);
      if (noseK.key === 'SPIKE') return Math.max(R * Math.pow(1 - frac, 1.4), 0.02);
      return Math.max(ogiveR((1 - frac) * noseLen, R, noseLen), 0.02); // full radius at base -> point at tip
    }
    // ONE-PIECE titanium airframe: base chamfer -> body -> ogive up to 80% of the nose. No overlapping caps.
    var capFrac = 0.80;
    var prof = [ new T.Vector2(0.02, 0), new T.Vector2(R * 0.72, 0), new T.Vector2(R, 0.22), new T.Vector2(R, bodyTop) ];
    for (var i = 1; i <= 44; i++) { var fr = i / 44 * capFrac; prof.push(new T.Vector2(noseRad(fr), bodyTop + fr * noseLen)); }
    var body = new T.Mesh(new T.LatheGeometry(prof, 160), titanium()); body.castShadow = true; body.receiveShadow = true; article.add(body);

    // ceramic tip: continues the SAME curve 80%->100%, sharing the boundary ring (edge-shared, never overlapping)
    var capProf = [];
    for (var j = 0; j <= 20; j++) { var fr2 = capFrac + j / 20 * (1 - capFrac); capProf.push(new T.Vector2(noseRad(fr2), bodyTop + fr2 * noseLen)); }
    var cap = new T.Mesh(new T.LatheGeometry(capProf, 160), ceramic()); cap.castShadow = true; article.add(cap);

    // raised service bands — open-ended cylinders sitting clearly PROUD of the skin so they can't z-fight
    var bandMat = signal(); bandMat.color.setHex(wh.band); bandMat.emissive.setHex(wh.band); bandMat.emissiveIntensity = 0.22;
    var band = new T.Mesh(new T.CylinderGeometry(R * 1.06, R * 1.06, 0.1, 160, 1, true), bandMat); band.position.y = bodyTop * 0.76; band.castShadow = true; article.add(band);
    var br = new T.Mesh(new T.CylinderGeometry(R * 1.05, R * 1.05, 0.055, 160, 1, true), brass()); br.position.y = bodyTop * 0.42; article.add(br);

    // nozzle bell hanging below the base, well clear of the airframe
    var bellProf = []; for (var b = 0; b <= 20; b++) { var tb = b / 20; bellProf.push(new T.Vector2(0.13 + Math.pow(tb, 1.7) * 0.23, -0.05 - tb * 0.4)); }
    var bell = new T.Mesh(new T.LatheGeometry(bellProf, 128), darkMetal()); article.add(bell);

    // fins: authored (radial x, axial y), thin in z, rooted INTO the body (solid overlap -> no gap, no coplanar z-fight)
    var fk = FINSET[spec.fins], nf = fk.n;
    for (var f = 0; f < nf; f++) {
      var shape = new T.Shape();
      if (fk.key === 'GRID') { shape.moveTo(0, 0); shape.lineTo(0, 0.6); shape.lineTo(0.4, 0.6); shape.lineTo(0.4, 0); shape.lineTo(0, 0); }
      else { var span = fk.key === 'X3' ? 0.46 : 0.52; shape.moveTo(0, 0); shape.lineTo(0, 0.66); shape.lineTo(span, 0.34); shape.lineTo(span, 0.06); shape.lineTo(0, 0); }
      var fin = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.016, bevelSegments: 2 }), carbon());
      fin.geometry.translate(0, 0, -0.025);
      fin.rotation.y = f * (Math.PI * 2 / nf); fin.translateX(R - 0.06); fin.position.y = 0.05;
      fin.castShadow = true; article.add(fin);
    }

    // status LED near the nose (breathes)
    markerLED = new T.Mesh(new T.SphereGeometry(0.028, 16, 16), new T.MeshStandardMaterial({ color: 0x0a3540, emissive: wh.band, emissiveIntensity: 2 }));
    markerLED.position.set(R + 0.005, bodyTop * 0.62, 0); article.add(markerLED);

    article.traverse(function (o) { if (o.material && 'dithering' in o.material) o.material.dithering = true; });
    turntable.add(article);
    article._top = bodyTop + noseLen;
    return article;
  }

  // ---- stats derived from spec ----
  function stats() {
    var reach = BODY[spec.body].reach + (spec.nose === 0 ? 120 : 0);
    var precScore = NOSES[spec.nose].prec + FINSET[spec.fins].prec;   // 2..6
    var grade = precScore >= 6 ? 'AAA' : precScore >= 5 ? 'AA' : precScore >= 4 ? 'A' : precScore >= 3 ? 'B' : 'C';
    var wh = WARHEADS[spec.warhead];
    return { reach: reach, grade: grade, yield: wh.yield, unit: wh.unit, blast: wh.blast };
  }

  // ============================================================ EXPLOSION system (from strike proof, yield-scaled)
  var SNOISE = ['vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}','vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}','vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}','vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}','float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);','vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);','vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);','vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;','i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));','float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);','vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);','vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh2=-step(h,vec4(0.0));','vec4 a0=b0.xzyw+s0.xzyw*sh2.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh2.zzww;','vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);','vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;','vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;','return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}','float fbm(vec3 p){float f=0.0;float a=0.5;for(int i=0;i<5;i++){f+=a*snoise(p);p*=2.02;a*=0.5;}return f;}'].join('\n');

  var rampTex = (function () {
    var c = document.createElement('canvas'); c.width = 256; c.height = 1; var g = c.getContext('2d');
    var grd = g.createLinearGradient(0, 0, 256, 0);
    grd.addColorStop(0, '#1a1008'); grd.addColorStop(0.15, '#7a1500'); grd.addColorStop(0.3, '#e23b08'); grd.addColorStop(0.45, '#ff7a18'); grd.addColorStop(0.65, '#ffc24b'); grd.addColorStop(0.85, '#fff3b0'); grd.addColorStop(1, '#ffffff');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 1); var tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; tx.minFilter = T.LinearFilter; tx.generateMipmaps = false; return tx;
  })();
  function radialTex(stops) { var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d'); var rg = g.createRadialGradient(32, 32, 0, 32, 32, 32); stops.forEach(function (s) { rg.addColorStop(s[0], s[1]); }); g.fillStyle = rg; g.fillRect(0, 0, 64, 64); var tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; return tx; }
  var sparkTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,200,120,0.8)'], [1, 'rgba(255,140,60,0)']]);
  var flashTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,240,210,0.9)'], [0.55, 'rgba(255,150,60,0.35)'], [1, 'rgba(255,120,40,0)']]);
  var puffTex = (function () { var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d'); for (var k = 0; k < 5; k++) { var px = 40 + Math.random() * 48, py = 40 + Math.random() * 48, pr = 26 + Math.random() * 26; var rg = g.createRadialGradient(px, py, 0, px, py, pr); rg.addColorStop(0, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 128, 128); } var tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; return tx; })();

  function Explosion() {
    var self = this; var grp = new T.Group(); scene.add(grp); this.group = grp; this.active = false; this.e = 0; this.scale = 1;
    var fireMat = new T.ShaderMaterial({ transparent: true, depthWrite: true,
      uniforms: { uTime: { value: 0 }, uTemp: { value: 1 }, uGrow: { value: 0 }, uEmissive: { value: 6 }, uOpacity: { value: 1 }, uRamp: { value: rampTex } },
      vertexShader: SNOISE + '\nuniform float uTime;uniform float uGrow;varying vec3 vN;varying vec3 vView;varying float vNoise;void main(){float n=fbm(normalize(position)*2.3+vec3(0.0,-uTime*0.7,0.0));float n2=fbm(normalize(position)*5.0+vec3(uTime*0.4,uTime*0.5,0.0));vNoise=clamp(n*0.5+0.5+n2*0.12,0.0,1.0);float disp=(0.25+0.55*uGrow)*(0.5+0.7*vNoise);vec3 pos=position*(0.9+disp);vec4 wp=modelMatrix*vec4(pos,1.0);vN=normalize(mat3(modelMatrix)*normal);vView=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}',
      fragmentShader: 'uniform sampler2D uRamp;uniform float uTemp;uniform float uEmissive;uniform float uOpacity;varying vec3 vN;varying vec3 vView;varying float vNoise;void main(){float fres=pow(1.0-max(dot(normalize(vN),normalize(vView)),0.0),1.6);float temp=clamp(uTemp*(0.55+0.75*vNoise)-fres*0.2,0.0,1.0);vec3 col=texture2D(uRamp,vec2(temp,0.5)).rgb;vec3 outc=col*(0.42+uEmissive*temp*temp);gl_FragColor=vec4(outc,uOpacity);}' });
    this.fireMat = fireMat;
    var fireball = new T.Mesh(new T.IcosahedronGeometry(1, 5), fireMat); fireball.visible = false; grp.add(fireball); this.fireball = fireball;
    var flash = new T.Sprite(new T.SpriteMaterial({ map: flashTex, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); flash.visible = false; grp.add(flash); this.flash = flash;
    var light = new T.PointLight(0xffb060, 0, 40, 2); grp.add(light); this.light = light;
    // sparks
    var N = 150; var sg = new T.BufferGeometry(); this.spos = new Float32Array(N * 3); this.scol = new Float32Array(N * 3); this.svel = new Float32Array(N * 3); this.slife = new Float32Array(N); this.sttl = new Float32Array(N); this.N = N;
    sg.setAttribute('position', new T.BufferAttribute(this.spos, 3)); sg.setAttribute('color', new T.BufferAttribute(this.scol, 3));
    var sparks = new T.Points(sg, new T.PointsMaterial({ size: 0.14, map: sparkTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); sparks.visible = false; grp.add(sparks); this.sparks = sparks; this.sg = sg;
    // smoke puffs
    function pool(n, base) { var g2 = new T.Group(); g2.visible = false; grp.add(g2); var items = []; for (var i = 0; i < n; i++) { var m = new T.Sprite(new T.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0, rotation: Math.random() * 6.28 })); m.scale.setScalar(base); g2.add(m); items.push(m); } return { g: g2, items: items }; }
    this.smoke = pool(22, 1.6); this.dust = pool(14, 1.4); this.smokeSt = []; this.dustSt = [];
    // shockwave ring
    var ringMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: { uRadius: { value: 0 }, uThick: { value: 0.1 }, uOpacity: { value: 0 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'varying vec2 vUv;uniform float uRadius;uniform float uThick;uniform float uOpacity;void main(){float d=length(vUv-0.5)*2.0;float ring=1.0-clamp(abs(d-uRadius)/uThick,0.0,1.0);ring=pow(ring,2.2);vec3 col=mix(vec3(1.0,0.55,0.25),vec3(1.0,0.9,0.7),ring);gl_FragColor=vec4(col,ring*uOpacity);}' });
    this.ringMat = ringMat; var ring = new T.Mesh(new T.PlaneGeometry(24, 24), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.visible = false; grp.add(ring); this.ring = ring;
    // debris
    var ND = 18; var debris = new T.InstancedMesh(new T.BoxGeometry(0.18, 0.18, 0.18), new T.MeshStandardMaterial({ color: 0x33363c, metalness: 0.1, roughness: 0.8, emissive: 0x180a04, emissiveIntensity: 1 }), ND); debris.visible = false; grp.add(debris); this.debris = debris; this.ND = ND; this.debSt = [];
    this._m = new T.Matrix4(); this._q = new T.Quaternion(); this._e = new T.Euler(); this._s = new T.Vector3(); this._p = new T.Vector3();
  }
  Explosion.prototype.fire = function (center, scl) {
    var self = this; this.active = true; this.e = 0; this.scale = scl; this.center = center.clone(); this.group.position.copy(center); this.group.scale.setScalar(scl);
    var rnd = function (a, b) { return a + Math.random() * (b - a); };
    this.fireball.visible = true; this.fireMat.uniforms.uTemp.value = 1;
    this.flash.visible = true; this.flash.material.opacity = 1; this.flash.scale.setScalar(1.2);
    this.light.intensity = 16 * scl;
    this.sparks.visible = true;
    for (var i = 0; i < this.N; i++) { var d = new T.Vector3(rnd(-1, 1), rnd(-0.1, 1.2), rnd(-1, 1)).normalize(); var sp = rnd(4, 13); this.svel[i * 3] = d.x * sp; this.svel[i * 3 + 1] = d.y * sp + rnd(1, 4); this.svel[i * 3 + 2] = d.z * sp; this.spos[i * 3] = 0; this.spos[i * 3 + 1] = 0; this.spos[i * 3 + 2] = 0; this.sttl[i] = rnd(0.6, 1.5); this.slife[i] = this.sttl[i]; }
    this.smoke.g.visible = true; this.smokeSt.length = 0;
    for (var s = 0; s < this.smoke.items.length; s++) this.smokeSt.push({ pos: new T.Vector3(rnd(-0.4, 0.4), rnd(-0.2, 0.7), rnd(-0.4, 0.4)), vel: new T.Vector3(rnd(-0.25, 0.25), rnd(1.5, 3.0), rnd(-0.25, 0.25)), delay: rnd(0.15, 0.7), ttl: rnd(2.2, 3.4), age: 0, size0: rnd(1.2, 2.0), spin: rnd(-0.4, 0.4) });
    this.dust.g.visible = true; this.dustSt.length = 0;
    for (var dd = 0; dd < this.dust.items.length; dd++) { var ang = Math.random() * 6.28, rad = rnd(0.5, 2.5); this.dustSt.push({ pos: new T.Vector3(Math.cos(ang) * rad, rnd(0.1, 0.5), Math.sin(ang) * rad), vel: new T.Vector3(Math.cos(ang) * rnd(2, 5), rnd(0.3, 1), Math.sin(ang) * rnd(2, 5)), delay: rnd(0.03, 0.2), ttl: rnd(1.6, 2.8), age: 0, size0: rnd(1.3, 2), spin: rnd(-0.3, 0.3) }); }
    this.ring.visible = true; this.ringMat.uniforms.uRadius.value = 0; this.ringMat.uniforms.uOpacity.value = 1; this.ring.scale.set(1, 1, 1);
    this.debris.visible = true; this.debSt.length = 0;
    for (var k = 0; k < this.ND; k++) { var dv = new T.Vector3(rnd(-1, 1), rnd(0.3, 1.4), rnd(-1, 1)).normalize(), spd = rnd(5, 11); this.debSt.push({ pos: new T.Vector3(0, 0, 0), vel: new T.Vector3(dv.x * spd, dv.y * spd + rnd(2, 5), dv.z * spd), rot: new T.Euler(rnd(0, 6), rnd(0, 6), rnd(0, 6)), spin: new T.Vector3(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)), ttl: rnd(0.9, 1.6), age: 0, scl: rnd(0.5, 1.4) }); }
  };
  Explosion.prototype.update = function (dt, now) {
    if (!this.active) return;
    this.e += dt; var e = this.e; this.fireMat.uniforms.uTime.value = now * 0.001;
    var fl = Math.exp(-e / 0.045); this.flash.material.opacity = fl; this.flash.scale.setScalar(1.2 + (1 - fl) * 1.4);
    this.light.intensity = (16 * Math.exp(-e / 0.09) + 3.5 * Math.exp(-e / 0.4)) * this.scale; if (e > 0.28) this.flash.visible = false;
    var grow = 1 - Math.pow(1 - Math.min(e / 0.18, 1), 3); this.fireball.scale.setScalar((0.45 + grow * 0.62) * (1 + Math.max(0, e - 0.5) * 0.35)); this.fireMat.uniforms.uGrow.value = grow;
    this.fireMat.uniforms.uTemp.value = Math.max(0, 1 - e / 1.0); this.fireMat.uniforms.uOpacity.value = e < 0.85 ? 1 : Math.max(0, 1 - (e - 0.85) / 0.75); if (e > 1.62) this.fireball.visible = false;
    var anyS = false;
    for (var i = 0; i < this.N; i++) { if (this.slife[i] <= 0) { this.scol[i * 3] = this.scol[i * 3 + 1] = this.scol[i * 3 + 2] = 0; continue; } anyS = true; this.slife[i] -= dt; this.svel[i * 3 + 1] -= 9 * dt; var dr = Math.exp(-1.6 * dt); this.svel[i * 3] *= dr; this.svel[i * 3 + 1] *= dr; this.svel[i * 3 + 2] *= dr; this.spos[i * 3] += this.svel[i * 3] * dt; this.spos[i * 3 + 1] += this.svel[i * 3 + 1] * dt; this.spos[i * 3 + 2] += this.svel[i * 3 + 2] * dt; if (this.spos[i * 3 + 1] < 0.02) { this.spos[i * 3 + 1] = 0.02; this.svel[i * 3 + 1] *= -0.3; } var lf = this.slife[i] / this.sttl[i], fk = 0.7 + 0.3 * Math.sin(e * 40 + i); this.scol[i * 3] = 1.6 * (0.5 + 0.5 * lf) * fk; this.scol[i * 3 + 1] = (0.7 * lf + 0.15) * fk; this.scol[i * 3 + 2] = 0.2 * lf * fk; }
    this.sg.attributes.position.needsUpdate = true; this.sg.attributes.color.needsUpdate = true; if (!anyS && e > 1) this.sparks.visible = false;
    for (var s = 0; s < this.smokeSt.length; s++) { var st = this.smokeSt[s], sp = this.smoke.items[s]; if (e < st.delay) { sp.material.opacity = 0; continue; } st.age += dt; st.vel.y += 0.5 * dt; st.vel.multiplyScalar(Math.exp(-0.55 * dt)); st.pos.addScaledVector(st.vel, dt); sp.position.copy(st.pos); var lf2 = st.age / st.ttl; sp.scale.setScalar(st.size0 * (1 + lf2 * 1.9)); sp.material.rotation += st.spin * dt; sp.material.opacity = Math.min(1, st.age / 0.3) * Math.max(0, 1 - lf2) * 0.58; var wm = Math.max(0, 1 - lf2 * 3); sp.material.color.setRGB(0.32 + 0.55 * wm, 0.3 + 0.24 * wm, 0.3 + 0.06 * wm); }
    for (var d = 0; d < this.dustSt.length; d++) { var dt2 = this.dustSt[d], dp = this.dust.items[d]; if (e < dt2.delay) { dp.material.opacity = 0; continue; } dt2.age += dt; dt2.vel.multiplyScalar(Math.exp(-1.4 * dt)); dt2.pos.addScaledVector(dt2.vel, dt); dp.position.copy(dt2.pos); var lf3 = dt2.age / dt2.ttl; dp.scale.setScalar(dt2.size0 * (1 + lf3 * 2)); dp.material.rotation += dt2.spin * dt; dp.material.opacity = Math.min(1, dt2.age / 0.2) * Math.max(0, 1 - lf3) * 0.4; dp.material.color.setRGB(0.3, 0.27, 0.24); }
    if (e < 0.5) { var rr = e / 0.44; this.ringMat.uniforms.uRadius.value = rr * (2 - rr); this.ringMat.uniforms.uOpacity.value = Math.max(0, 1 - e / 0.44); this.ring.scale.set(1 + e * 26, 1 + e * 26, 1); } else this.ring.visible = false;
    var anyD = false;
    for (var k = 0; k < this.ND; k++) { var db = this.debSt[k]; if (db.age >= db.ttl) { this._m.makeScale(0, 0, 0); this.debris.setMatrixAt(k, this._m); continue; } anyD = true; db.age += dt; db.vel.y -= 9.5 * dt; db.pos.addScaledVector(db.vel, dt); if (db.pos.y < 0.09) { db.pos.y = 0.09; db.vel.y *= -0.35; } db.rot.x += db.spin.x * dt; db.rot.y += db.spin.y * dt; db.rot.z += db.spin.z * dt; this._e.copy(db.rot); this._q.setFromEuler(this._e); this._p.copy(db.pos); this._s.setScalar(db.scl); this._m.compose(this._p, this._q, this._s); this.debris.setMatrixAt(k, this._m); }
    this.debris.instanceMatrix.needsUpdate = true; if (!anyD) this.debris.visible = false;
    if (e > 2.4 && this.onDone) { var cb = this.onDone; this.onDone = null; cb(); }
    if (e > 3.8) { this.active = false; this.smoke.g.visible = false; this.dust.g.visible = false; }
  };
  Explosion.prototype.reset = function () { this.active = false; this.onDone = null; this.fireball.visible = false; this.flash.visible = false; this.sparks.visible = false; this.ring.visible = false; this.debris.visible = false; this.smoke.g.visible = false; this.dust.g.visible = false; this.light.intensity = 0; };
  var explosion = new Explosion();

  // ============================================================ target / world for strike
  var world = new T.Group(); world.visible = false; scene.add(world);
  var target = new T.Group(); world.add(target);
  var conc = new T.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.85, metalness: 0, envMapIntensity: 0.4, dithering: true });
  var bunker = new T.Mesh(new T.BoxGeometry(2, 1.15, 2), conc); bunker.position.y = 0.575; bunker.castShadow = true; bunker.receiveShadow = true; target.add(bunker);
  var roof = new T.Mesh(new T.BoxGeometry(2.2, 0.2, 2.2), new T.MeshStandardMaterial({ color: 0x2c2f34, roughness: 0.8, dithering: true })); roof.position.y = 1.18; target.add(roof);
  var tmast = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1.1, 12), new T.MeshStandardMaterial({ color: 0x54585f, metalness: 1, roughness: 0.5 })); tmast.position.set(0.7, 1.85, 0.7); target.add(tmast);
  var tled = new T.Mesh(new T.SphereGeometry(0.05, 12, 12), new T.MeshStandardMaterial({ color: 0xff5a3c, emissive: 0xff3a1e, emissiveIntensity: 3 })); tled.position.set(0.7, 2.42, 0.7); target.add(tled);
  // scorch decal (permanence)
  var scorch = new T.Mesh(new T.CircleGeometry(3, 48), new T.MeshBasicMaterial({ map: radialTex([[0, 'rgba(0,0,0,0.85)'], [0.5, 'rgba(10,6,4,0.6)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false })); scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.02; scorch.visible = false; world.add(scorch);
  var TARGET_DIST = 26;
  function apexFor(d) { return 5 + d * 0.13; }
  function placeTarget(range, bearing) { var d = 14 + (range - 12) * 0.5; var a = (bearing - 90) * Math.PI / 180; world.position.set(0, 0, 0); target.position.set(Math.sin(a) * d, 0, -Math.cos(a) * d); scorch.position.set(target.position.x, 0.02, target.position.z); TARGET_DIST = d; }

  // trajectory arc line
  var arcGeo = new T.BufferGeometry(); var arcPts = new Float32Array(60 * 3); arcGeo.setAttribute('position', new T.BufferAttribute(arcPts, 3));
  var arc = new T.Line(arcGeo, new T.LineBasicMaterial({ color: 0x38e6f0, transparent: true, opacity: 0.55 })); arc.visible = false; scene.add(arc);
  function updateArc() { var a = target.position.clone(); var apexY = apexFor(TARGET_DIST); for (var i = 0; i < 60; i++) { var t = i / 59; var x = lerp(0, a.x, t), z = lerp(0, a.z, t); var y = Math.sin(t * Math.PI) * apexY; arcPts[i * 3] = x; arcPts[i * 3 + 1] = y; arcPts[i * 3 + 2] = z; } arcGeo.attributes.position.needsUpdate = true; }

  // launch plume (for the article on ascent)
  var plume = new T.Sprite(new T.SpriteMaterial({ map: flashTex, blending: T.AdditiveBlending, transparent: true, depthWrite: false, color: 0xffcaa0, opacity: 0 })); plume.scale.setScalar(1.4); scene.add(plume);

  // ============================================================ AUDIO (procedural)
  var Audio2 = (function () {
    var ctx = null, master = null, noiseBuf = null, unlocked = false;
    function ensure() { if (ctx) return; var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.85; master.connect(ctx.destination); var len = ctx.sampleRate * 1.2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate); var dd = noiseBuf.getChannelData(0); for (var i = 0; i < len; i++) dd[i] = Math.random() * 2 - 1; }
    function unlock() { ensure(); if (!ctx) return; if (ctx.state === 'suspended') ctx.resume(); var b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); b.connect(master); b.start(0); unlocked = true; }
    function noise(dur, lp, hp, gain, ramp) { if (!ctx) return; var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 4000; var g = ctx.createGain(); var t = ctx.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + (ramp || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(); s.stop(t + dur + 0.05); return { s: s, f: f, g: g }; }
    function tone(freq, dur, type, gain, glideTo) { if (!ctx) return; var o = ctx.createOscillator(); o.type = type || 'sine'; var g = ctx.createGain(); var t = ctx.currentTime; o.frequency.setValueAtTime(freq, t); if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(); o.stop(t + dur + 0.05); }
    return {
      unlock: unlock,
      tick: function () { noise(0.03, 6000, 0, 0.18); tone(2200, 0.03, 'square', 0.04); },
      servo: function () { tone(180, 0.16, 'sawtooth', 0.05, 420); noise(0.16, 1200, 0, 0.05); },
      thunk: function () { tone(90, 0.14, 'sine', 0.25, 55); noise(0.05, 500, 0, 0.1); },
      boot: function () { tone(120, 0.5, 'sine', 0.15, 300); noise(0.5, 2000, 0, 0.06, 0.2); },
      ignite: function () { tone(60, 1.6, 'sine', 0.4, 40); var n = noise(2.2, 900, 0, 0.4, 0.05); if (n) { setTimeout(function () { try { n.f.frequency.linearRampToValueAtTime(1600, ctx.currentTime + 0.8); } catch (e) {} }, 10); } tone(240, 0.2, 'sawtooth', 0.12, 120); },
      boom: function (scl) { if (!ctx) return; var g = 0.5 * clamp(scl, 0.6, 1.6); tone(38, 1.4, 'sine', g, 24); tone(70, 0.5, 'sine', g * 0.6, 40); noise(0.9, 700, 0, g * 0.7); noise(1.6, 250, 0, g * 0.4, 0.02); }
    };
  })();

  // ============================================================ HAPTICS (native switch tick on genuine taps)
  function hapticize(el) {
    if (!el) return; if (el.querySelector && el.querySelector('input.sw')) return;
    // only fires the Taptic tick if el is a <label> containing a switch input; safe no-op otherwise
    var inp = document.createElement('input'); inp.type = 'checkbox'; inp.className = 'sw'; try { inp.setAttribute('switch', ''); } catch (e) {}
    inp.style.position = 'absolute'; inp.style.opacity = '0'; inp.style.pointerEvents = 'none'; inp.style.width = '1px'; inp.style.height = '1px';
    if (el.tagName === 'LABEL') el.appendChild(inp);
  }

  // ============================================================ JUICE (shake / hitstop)
  var trauma = 0, timeScale = 1, hitStopT = 0;
  function addTrauma(v) { trauma = clamp(trauma + v, 0, 1); }
  function hitStop(ms) { hitStopT = ms / 1000; timeScale = 0.02; }

  // ============================================================ POST
  var composer = new X.EffectComposer(renderer);
  composer.addPass(new X.RenderPass(scene, camera));
  var bloom = new X.UnrealBloomPass(new T.Vector2(W, H), 0.35, 0.5, 1.05); composer.addPass(bloom);
  var grade = new X.ShaderPass({ uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new T.Vector2(W, H) }, uVig: { value: 0.5 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv;uniform sampler2D tDiffuse;uniform float uTime;uniform vec2 uRes;uniform float uVig;float rnd(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;vec2 q=vUv-0.5;float vig=smoothstep(1.1,0.3,length(q)*1.35);c*=mix(1.0-uVig,1.0,vig);c=(c-0.5)*1.05+0.5;float g=rnd(vUv*uRes+uTime)-0.5;c+=g*0.010;float d=(rnd(gl_FragCoord.xy)-0.5)/255.0;c+=d;gl_FragColor=vec4(c,1.0);}' });
  composer.addPass(grade);
  composer.addPass(new X.OutputPass());
  try { composer.addPass(new X.SMAAPass(W, H)); } catch (e) {}

  function resize() { W = window.innerWidth; H = window.innerHeight; renderer.setSize(W, H); composer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); grade.uniforms.uRes.value.set(W, H); }
  window.addEventListener('resize', resize); resize();

  // ============================================================ camera rigs per state
  var camRig = { bench: { r: 12.6, theta: -0.7, phi: 0.12, look: [0, 2.35, 0] }, aim: { r: 24, theta: -0.5, phi: 0.3, look: [0, 3, -14] } };
  var benchTheta = camRig.bench.theta, benchPhi = camRig.bench.phi;
  var camTarget = { pos: new T.Vector3(), look: new T.Vector3() };
  function setCamFromBench() { var rg = camRig.bench; camTarget.pos.set(Math.sin(benchTheta) * rg.r * Math.cos(benchPhi), rg.look[1] + Math.sin(benchPhi) * rg.r, Math.cos(benchTheta) * rg.r * Math.cos(benchPhi)); camTarget.look.set(rg.look[0], rg.look[1], rg.look[2]); }
  // aim: look down the firing line — pad in foreground, target ahead, arc between
  function setAimCam() { var d = TARGET_DIST; camTarget.pos.set(target.position.x * 0.2 + 5, 13 + d * 0.14, 20); camTarget.look.set(target.position.x * 0.42, 2.4, target.position.z * 0.5); }

  // ============================================================ STATE MACHINE
  var state = 'boot', tState = 0, camSnap = false;
  var States = {};
  function setState(s) { if (States[state] && States[state].exit) States[state].exit(); state = s; tState = 0; if (States[s] && States[s].enter) States[s].enter(); }

  // ---- UI refs
  var ui = { hud: $('hud'), bench: $('bench'), aim: $('aim'), armbox: $('armbox'), ctaBench: $('cta-bench'), ctaLaunch: $('cta-launch'), ctaBack: $('cta-back'), results: $('results'), ctaReplay: $('cta-replay'), hint: $('hint'), boot: $('boot') };
  function show(el) { el.classList.remove('gone'); requestAnimationFrame(function () { el.classList.remove('hide'); }); }
  function hideEl(el) { el.classList.add('hide'); setTimeout(function () { el.classList.add('gone'); }, 320); }

  // tweened stat counters
  var shown = { reach: 0, yield: 0 };
  function refreshStats(instant) { var st = stats(); $('s-prec').textContent = st.grade; $('s-yield-u').textContent = st.unit; if (instant) { shown.reach = st.reach; shown.yield = st.yield; $('s-reach').textContent = Math.round(st.reach).toLocaleString(); $('s-yield').textContent = st.unit === 'MT' ? st.yield.toFixed(1) : Math.round(st.yield); } statTarget = st; }
  var statTarget = stats();
  function tickStats(dt) { shown.reach = damp(shown.reach, statTarget.reach, 8, dt); shown.yield = damp(shown.yield, statTarget.yield, 8, dt); $('s-reach').textContent = Math.round(shown.reach).toLocaleString(); $('s-yield').textContent = statTarget.unit === 'MT' ? shown.yield.toFixed(1) : Math.round(shown.yield); }

  // ---- BENCH state ----
  var BENCH_TABS = [ { k: 'nose', label: 'NOSE', opts: NOSES }, { k: 'body', label: 'BODY', opts: BODY }, { k: 'warhead', label: 'WARHEAD', opts: WARHEADS }, { k: 'fins', label: 'FINS', opts: FINSET } ];
  var activeTab = 0;
  function renderTabs() { var host = $('bench-tabs'); host.innerHTML = ''; BENCH_TABS.forEach(function (tb, i) { var d = document.createElement('div'); d.className = 'tab' + (i === activeTab ? ' on' : ''); d.textContent = tb.label; d.onclick = function () { activeTab = i; Audio2.tick(); renderTabs(); renderChips(); }; host.appendChild(d); }); }
  function renderChips() { var host = $('bench-chips'); host.innerHTML = ''; var tb = BENCH_TABS[activeTab]; tb.opts.forEach(function (op, i) { var lab = document.createElement('label'); lab.className = 'chip' + (spec[tb.k] === i ? ' on' : ''); lab.textContent = op.name; hapticize(lab); lab.onclick = function () { if (spec[tb.k] === i) return; spec[tb.k] = i; Audio2.servo(); buildArticle(); snapArticle(); renderChips(); refreshStats(); }; host.appendChild(lab); }); }
  var snapT = -1;
  function snapArticle() { snapT = 0; }

  States.bench = {
    enter: function () { $('hud-sub').textContent = 'BENCH · TITAN-IX ARTICLE'; world.visible = false; arc.visible = false; turntable.visible = true; contact.visible = true; setCamFromBench(); camera.position.copy(camTarget.pos); camLook.copy(camTarget.look); show(ui.hud); show(ui.bench); show(ui.ctaBench); show(ui.hint); refreshStats(true); renderTabs(); renderChips(); },
    exit: function () { hideEl(ui.bench); hideEl(ui.ctaBench); hideEl(ui.hint); },
    update: function (dt, now) {
      if (!drag && now - lastTouch > 2600) benchTheta += dt * 0.14; setCamFromBench();
      // idle micro-motion + breathing LED
      if (article) { article.position.y = Math.sin(now * 0.0011) * 0.01; }
      if (markerLED) markerLED.material.emissiveIntensity = 1.5 + Math.sin(now * 0.0032) * 0.4;
      if (snapT >= 0) { snapT += dt; var s = Math.min(snapT / 0.32, 1); var pop = 1 + Math.sin(s * Math.PI) * 0.06 * (1 - s); if (article) article.scale.setScalar(pop); if (s >= 1) { snapT = -1; if (article) article.scale.setScalar(1); } }
    }
  };

  // ---- AIM state ----
  var aimRange = 37, aimBearing = 90, armed = false;
  States.aim = {
    enter: function () { $('hud-sub').textContent = 'FIRE CONTROL · SOLUTION'; world.visible = true; turntable.visible = true; contact.visible = true; armed = false; setArm(false); placeTarget(aimRange, aimBearing); updateArc(); arc.visible = true; $('aim-range').textContent = aimRange; $('aim-bearing').textContent = ('00' + aimBearing).slice(-3); setAimCam(); show(ui.aim); show(ui.armbox); show(ui.ctaBack); $('launch').setAttribute('disabled', ''); },
    exit: function () { hideEl(ui.aim); hideEl(ui.armbox); hideEl(ui.ctaBack); hideEl(ui.ctaLaunch); arc.visible = false; },
    update: function (dt, now) { if (tled) tled.material.emissiveIntensity = 2.5 + Math.sin(now * 0.006) * 1.2; setAimCam(); }
  };
  function setArm(on) { armed = on; var sw = $('arm-switch'); if (on) sw.classList.add('on'); else sw.classList.remove('on'); var l = $('launch'); if (on) { l.removeAttribute('disabled'); l.classList.add('armed'); show(ui.ctaLaunch); } else { l.setAttribute('disabled', ''); l.classList.remove('armed'); hideEl(ui.ctaLaunch); } }

  // ---- STRIKE state ----
  var flight = null;
  States.strike = {
    enter: function () {
      $('hud-sub').textContent = 'TERMINAL · TRACKING'; hideEl(ui.hud); document.body.classList.add('cine');
      // build flight path from origin to target apex
      var tp = target.position.clone(); var apexY = apexFor(TARGET_DIST) + 4;
      flight = { t: 0, dur: 2.6, from: new T.Vector3(0, 0.2, 0), to: tp.clone().setY(1.35), apexY: apexY, launched: false, detonated: false };
      // detach the article to fly (reparent to world space via scene) — scale to projectile size vs. the target
      turntable.remove(article); scene.add(article); article.position.set(0, 0, 0); article.scale.setScalar(0.4); article.rotation.set(0, 0, 0);
      Audio2.ignite(); addTrauma(0.6);
      plume.material.opacity = 1;
    },
    exit: function () { document.body.classList.remove('cine'); },
    update: function (dt, now) {
      if (!flight) return; var f = flight; f.t += dt; var p = clamp(f.t / f.dur, 0, 1);
      // position along parabola
      var pos = new T.Vector3(lerp(f.from.x, f.to.x, p), lerp(f.from.y, f.to.y, p) + Math.sin(p * Math.PI) * f.apexY, lerp(f.from.z, f.to.z, p));
      // orient nose along velocity
      var ahead = p + 0.02; var pos2 = new T.Vector3(lerp(f.from.x, f.to.x, ahead), lerp(f.from.y, f.to.y, ahead) + Math.sin(ahead * Math.PI) * f.apexY, lerp(f.from.z, f.to.z, ahead));
      article.position.copy(pos); article.lookAt(pos2); article.rotateX(Math.PI / 2);
      plume.position.copy(pos).addScaledVector(new T.Vector3().subVectors(pos, pos2).normalize(), 0.5); plume.material.opacity = p < 0.55 ? 0.9 : Math.max(0, 0.9 - (p - 0.55) * 4); plume.scale.setScalar(1.2 + Math.sin(now * 0.05) * 0.2);
      // camera: hero low angle tracking, easing toward target on terminal
      var camWide = new T.Vector3(target.position.x * 0.5 + 7, 6 + f.apexY * 0.25, target.position.z * 0.5 + 13);
      var camClose = new T.Vector3(target.position.x + 8, 5, target.position.z + 13);
      var cb = easeInOut(p); camTarget.pos.lerpVectors(camWide, camClose, cb); camTarget.look.copy(pos);
      // terminal bullet-time (brief, so wall-clock stays ~3s)
      if (p > 0.9 && !f.slow) { f.slow = true; }
      timeScale = f.slow && !f.detonated ? damp(timeScale, 0.42, 8, dt) : timeScale;
      // detonation
      if (p >= 1 && !f.detonated) {
        f.detonated = true; timeScale = 1; hitStop(160); addTrauma(1.0); Audio2.boom(stats().blast);
        article.visible = false; plume.material.opacity = 0; scorch.visible = true; scorch.material.opacity = 0;
        var scl = 0.6 + stats().blast * 0.35; explosion.fire(target.position.clone().setY(1.2), scl);
        // dolly the camera back to FRAME the blast (bigger yield -> further back)
        var bc = target.position.clone().setY(1.2);
        f.detCam = bc.clone().add(new T.Vector3(6 + scl * 5, 5 + scl * 5, 10 + scl * 8)); f.detLook = bc;
        scorch.scale.setScalar(scl * 1.3);
        explosion.onDone = function () { setState('results'); };
        bombRoof();
      }
      if (f.detonated) { camTarget.pos.copy(f.detCam); camTarget.look.copy(f.detLook); if (scorch.material.opacity < 0.9) scorch.material.opacity += dt * 0.8; }
    }
  };
  var roofFall = null;
  function bombRoof() { roofFall = { t: 0, v: new T.Vector3((Math.random() - 0.5) * 3, 4, (Math.random() - 0.5) * 3), spin: new T.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4) }; }

  // ---- RESULTS ----
  States.results = {
    enter: function () {
      show(ui.results); var st = stats(); var crater = Math.round(8 * st.blast + 4); var miss = Math.round(Math.random() * (st.grade === 'AAA' ? 3 : st.grade === 'AA' ? 8 : 18));
      $('res-yield').textContent = (st.unit === 'MT' ? st.yield.toFixed(1) : Math.round(st.yield)) + ' ' + st.unit;
      $('res-crater').textContent = crater; $('res-miss').textContent = miss;
      var big = ui.results.querySelector('.big'), met = ui.results.querySelector('.met');
      big.style.transition = 'opacity .6s .1s, transform .6s .1s'; big.style.transform = 'translateY(8px)'; big.style.opacity = 0; met.style.transition = 'opacity .6s .35s'; met.style.opacity = 0;
      requestAnimationFrame(function () { big.style.opacity = 1; big.style.transform = 'none'; met.style.opacity = 1; });
      show(ui.ctaReplay);
    },
    exit: function () { hideEl(ui.results); hideEl(ui.ctaReplay); },
    update: function (dt, now) { }
  };

  // ============================================================ input
  var drag = false, lx = 0, ly = 0, lastTouch = 0;
  canvas.addEventListener('pointerdown', function (e) { if (state !== 'bench') return; drag = true; lx = e.clientX; ly = e.clientY; lastTouch = performance.now(); });
  canvas.addEventListener('pointermove', function (e) { if (!drag) return; var dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; benchTheta -= dx * 0.008; benchPhi = clamp(benchPhi + dy * 0.005, -0.05, 0.85); lastTouch = performance.now(); });
  window.addEventListener('pointerup', function () { drag = false; });

  // button wiring
  $('begin').addEventListener('click', function () { Audio2.unlock(); Audio2.boot(); hideEl(ui.boot); setTimeout(function () { setState('bench'); }, 200); });
  $('to-aim').addEventListener('click', function () { Audio2.thunk(); setState('aim'); });
  $('back-bench').addEventListener('click', function () { Audio2.tick(); setState('bench'); });
  hapticize($('arm-switch')); // label already contains #arm-input
  $('arm-switch').addEventListener('click', function () { setTimeout(function () { var on = $('arm-input').checked; setArm(on); Audio2.tick(); if (on) Audio2.thunk(); }, 0); });
  $('launch').addEventListener('click', function () { if (!armed) return; Audio2.tick(); setState('strike'); });
  $('replay').addEventListener('click', function () { Audio2.tick(); // reset world
    explosion.reset(); article.visible = true; scene.remove(article); turntable.add(article); article.position.set(0, 0, 0); article.rotation.set(0, 0, 0); article.scale.setScalar(1); scorch.visible = false; scorch.scale.setScalar(1); roof.position.set(0, 1.24, 0); roof.rotation.set(0, 0, 0); roofFall = null; setState('bench'); });

  // ============================================================ MAIN LOOP (fixed sim + interpolated render)
  buildArticle(); refreshStats(true);
  var last = performance.now(); var accum = 0, FIXED = 1 / 120;
  var shakeSeed = Math.random() * 1000;
  renderer.setAnimationLoop(function (now) {
    var raw = Math.min((now - last) / 1000, 0.1); last = now;
    // hit-stop recovery
    if (hitStopT > 0) { hitStopT -= raw; if (hitStopT <= 0) timeScale = 1; }
    var dt = raw * timeScale;

    // state update
    if (States[state] && States[state].update) States[state].update(dt, now);
    explosion.update(dt, now);
    tickStats(raw);
    if (roofFall) { roofFall.t += dt; roofFall.v.y -= 9.5 * dt; roof.position.addScaledVector(roofFall.v, dt); if (roof.position.y < 0.2) { roof.position.y = 0.2; roofFall.v.multiplyScalar(0.3); } roof.rotation.x += roofFall.spin.x * dt; roof.rotation.z += roofFall.spin.z * dt; }

    // camera spring toward target + trauma shake
    camera.position.x = damp(camera.position.x, camTarget.pos.x, camSnap ? 30 : 4, raw);
    camera.position.y = damp(camera.position.y, camTarget.pos.y, camSnap ? 30 : 4, raw);
    camera.position.z = damp(camera.position.z, camTarget.pos.z, camSnap ? 30 : 4, raw);
    camLook.x = damp(camLook.x, camTarget.look.x, 5, raw); camLook.y = damp(camLook.y, camTarget.look.y, 5, raw); camLook.z = damp(camLook.z, camTarget.look.z, 5, raw);
    trauma = Math.max(0, trauma - raw * 1.3); var shk = trauma * trauma;
    var tt = now * 0.001;
    var ox = (Math.sin(tt * 47 + shakeSeed) + Math.sin(tt * 31.7)) * 0.5 * shk * 0.35;
    var oy = (Math.sin(tt * 43 + shakeSeed) + Math.sin(tt * 59.3)) * 0.5 * shk * 0.3;
    camera.position.x += ox; camera.position.y += oy;
    camera.lookAt(camLook.x + ox * 0.4, camLook.y + oy * 0.4, camLook.z);

    // contact shadow tracks article on the bench
    if (state === 'bench' && article) { contact.position.set(0, 0.005, 0); contact.scale.setScalar(1); }

    grade.uniforms.uTime.value = now * 0.001;
    composer.render();
  });

  window.__ready = true;
  } catch (e) { showErr(e.message + '\n' + (e.stack || '')); }
})();
