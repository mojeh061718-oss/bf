/* PROVING GROUNDS v2 — audio.js
   Fully synthesized WebAudio SFX. No files. Init on first gesture.
   Kept from v1: klaxon, countdown beeps, detonation, typewriter, stamps.
   New for v2: part thunks, wire snaps, ratchet clicks, detonator slide/seat,
   guard-cover flick, switch clack, flatbed engine, measuring ticks. */
'use strict';

var PGAudio = (function () {
  var ac = null, master = null, muted = false;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.6;
      master.connect(ac.destination);
    } catch (e) { ac = null; }
  }
  function ok() { return ac && !muted && ac.state === 'running'; }
  function now() { return ac.currentTime; }

  function env(g, t, a, peak, d, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(end || 0.0001, 0.0001), t + a + d);
  }
  function osc(type, f0, t, dur, peak, f1, dest) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    env(g, t, 0.005, peak, dur);
    o.connect(g); g.connect(dest || master);
    o.start(t); o.stop(t + dur + 0.1);
  }
  var noiseBuf = null;
  function noise(t, dur, peak, fLo, fHi, type, dest) {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    var f = ac.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.setValueAtTime(fHi || 1200, t);
    if (fLo && fLo !== (fHi || 1200)) f.frequency.exponentialRampToValueAtTime(fLo, t + dur);
    f.Q.value = 0.8;
    var g = ac.createGain();
    env(g, t, 0.008, peak, dur);
    src.connect(f); f.connect(g); g.connect(dest || master);
    src.start(t); src.stop(t + dur + 0.15);
  }

  /* ---- UI / paper ---- */
  function tick() { // teletype
    if (!ok()) return;
    var t = now();
    noise(t, 0.02, 0.10, 3000, 4200, 'bandpass');
    osc('square', 2400, t, 0.015, 0.03);
  }
  function typeKey() { // incident-report typewriter
    if (!ok()) return;
    var t = now();
    noise(t, 0.03, 0.16, 2000, 3400, 'bandpass');
    osc('square', 1300 + Math.random() * 500, t, 0.02, 0.05);
  }
  function typeDing() {
    if (!ok()) return;
    osc('sine', 1560, now(), 0.5, 0.12, 1550);
  }
  function tap() { // generic button
    if (!ok()) return;
    var t = now();
    osc('triangle', 440, t, 0.06, 0.10, 300);
    osc('square', 1200, t, 0.02, 0.04);
  }
  function stampThud() {
    if (!ok()) return;
    var t = now();
    osc('sine', 120, t, 0.18, 0.5, 55);
    noise(t, 0.06, 0.2, 300, 900, 'lowpass');
  }
  function buzz() { // rejected / warning
    if (!ok()) return;
    var t = now();
    osc('sawtooth', 110, t, 0.22, 0.12, 95);
  }

  /* ---- ASSEMBLY BAY ---- */
  function thunk(w) { // part clicks into a snap node. w = weight 0..1 (or legacy boolean)
    if (!ok()) return;
    if (w === true) w = 0.9; else if (w === false || w == null) w = 0.35;
    w = Math.min(Math.max(w, 0), 1);
    var t = now();
    var k = 0.8 + w * 0.7;                       // loudness with weight
    var f = 175 - w * 95;                        // a Big Shell thunks deeper than a canister
    var jig = 0.95 + Math.random() * 0.1;        // never twice the same
    osc('sine', f * jig, t, 0.10 + w * 0.10, 0.42 * k, f * 0.42);
    osc('square', (430 - w * 160) * jig, t, 0.03, 0.10 * k, 240);
    noise(t, 0.04 + w * 0.03, 0.20 * k, 400 + (1 - w) * 500, 1200 + (1 - w) * 1300, 'bandpass');
    if (w > 0.75) noise(t + 0.05, 0.12, 0.10, 60, 220, 'lowpass');   // heavy: the stand groans
  }
  function pickup() { // lift a part off the shelf
    if (!ok()) return;
    var t = now();
    osc('triangle', 520, t, 0.05, 0.08, 700);
    noise(t, 0.03, 0.05, 2000, 3200, 'bandpass');
  }
  function unsnap() { // remove a placed part
    if (!ok()) return;
    var t = now();
    osc('square', 260, t, 0.05, 0.10, 180);
    noise(t, 0.04, 0.10, 900, 1900, 'bandpass');
  }
  function ghostHum() { // hover over a valid node (soft)
    if (!ok()) return;
    osc('sine', 880, now(), 0.08, 0.045, 990);
  }
  function wireSnap() { // wire lands on a terminal
    if (!ok()) return;
    var t = now();
    osc('square', 1500, t, 0.02, 0.09);
    osc('sine', 340, t + 0.015, 0.07, 0.14, 230);
    noise(t, 0.02, 0.07, 3500, 5200, 'highpass');
  }
  function wireDrop() { // wire released into space, slaps the panel
    if (!ok()) return;
    var t = now();
    noise(t, 0.05, 0.12, 600, 1500, 'bandpass');
    osc('sine', 180, t, 0.06, 0.09, 120);
  }
  /* ---- THE WIRING STATION (M3) ---- */
  function spoolPull() { // wire unwinding off the rack — a ratchety zip
    if (!ok()) return;
    var t = now();
    for (var i = 0; i < 6; i++) {
      noise(t + i * 0.028, 0.02, 0.06 + i * 0.008, 1400 + i * 260, 2400 + i * 380, 'bandpass');
    }
    osc('triangle', 190, t, 0.16, 0.05, 260);
  }
  function wireClip(gauge) { // wire lands on a terminal — pitch per gauge (0 heavy … 2 light)
    if (!ok()) return;
    var g = gauge == null ? 1 : gauge;
    var f = 300 + g * 140;                       // heavier wire clips deeper
    var t = now();
    osc('square', f * 4.4, t, 0.02, 0.08);
    osc('sine', f, t + 0.012, 0.07, 0.15, f * 0.68);
    noise(t, 0.02, 0.06, 3200, 5000, 'highpass');
  }
  function probeClip() { // tester probe bites a terminal
    if (!ok()) return;
    var t = now();
    osc('square', 1900, t, 0.015, 0.07);
    osc('sine', 420, t + 0.012, 0.05, 0.10, 300);
  }
  function needleTone(kind) { // the tester speaks: warm dyad / flat buzz / open blip
    if (!ok()) return;
    var t = now();
    if (kind === 'good') {
      osc('triangle', 523, t + 0.05, 0.4, 0.10);
      osc('triangle', 659, t + 0.10, 0.45, 0.11);
      osc('sine', 1046, t + 0.16, 0.3, 0.04);
    } else if (kind === 'open') {
      osc('sine', 300, t + 0.05, 0.12, 0.09, 290);
      osc('sine', 240, t + 0.24, 0.16, 0.09, 230);
    } else {
      osc('sawtooth', 138, t + 0.05, 0.34, 0.11, 126);
      osc('sawtooth', 92, t + 0.07, 0.3, 0.07, 88);
    }
  }
  function paperFold(open) { // the schematic unfolds / folds away
    if (!ok()) return;
    var t = now();
    noise(t, 0.09, 0.12, 1200, open ? 3200 : 2200, 'bandpass');
    noise(t + 0.11, 0.07, 0.09, 1800, 3600, 'bandpass');
    for (var i = 0; i < 4; i++) noise(t + 0.05 + i * 0.045, 0.012, 0.05, 3600, 5600, 'highpass');
  }

  var lastRatchet = 0;
  function ratchet() { // torque wrench click
    if (!ok()) return;
    var t = now();
    if (t - lastRatchet < 0.035) return;
    lastRatchet = t;
    osc('square', 2100 + Math.random() * 400, t, 0.012, 0.07);
    noise(t, 0.014, 0.10, 3800, 6000, 'highpass');
  }
  function torqueDone() { // terminal fully torqued
    if (!ok()) return;
    var t = now();
    osc('square', 900, t, 0.03, 0.10);
    osc('square', 1350, t + 0.06, 0.05, 0.12);
    osc('sine', 250, t + 0.05, 0.10, 0.16, 180);
  }
  var lastSlide = 0;
  function slide() { // detonator sliding (call per move, throttled)
    if (!ok()) return;
    var t = now();
    if (t - lastSlide < 0.06) return;
    lastSlide = t;
    noise(t, 0.07, 0.035, 700, 2100, 'bandpass');
  }
  function seatClick() { // detonator seats cleanly
    if (!ok()) return;
    var t = now();
    osc('sine', 300, t, 0.09, 0.20, 210);
    osc('square', 1100, t + 0.02, 0.03, 0.09);
    noise(t + 0.04, 0.04, 0.06, 1500, 2400, 'bandpass');
    osc('sine', 640, t + 0.10, 0.16, 0.08, 660);
  }
  function slam() { // detonator slammed home — harsh
    if (!ok()) return;
    var t = now();
    osc('sine', 95, t, 0.20, 0.55, 45);
    noise(t, 0.08, 0.30, 400, 2600, 'lowpass');
    osc('square', 700, t, 0.03, 0.10, 500);
  }
  function coverFlick() { // guard cover flips open
    if (!ok()) return;
    var t = now();
    noise(t, 0.03, 0.14, 1800, 3000, 'bandpass');
    osc('square', 520, t + 0.03, 0.05, 0.12, 700);
    osc('sine', 260, t + 0.07, 0.08, 0.10, 200);
  }
  function switchClack() { // arm switch thrown
    if (!ok()) return;
    var t = now();
    osc('square', 420, t, 0.03, 0.16, 300);
    osc('sine', 150, t + 0.02, 0.12, 0.30, 80);
    noise(t, 0.03, 0.12, 1200, 2600, 'bandpass');
    osc('sine', 1180, t + 0.10, 0.30, 0.06, 1175); // ready tone
  }

  /* ---- THE CONVOY ---- */
  var engineNodes = null;
  function engineStart() {
    if (!ok() || engineNodes) return;
    var t = now();
    var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.10, t + 0.8);
    var o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 46;
    var o2 = ac.createOscillator(); o2.type = 'square'; o2.frequency.value = 92.5;
    var g2 = ac.createGain(); g2.gain.value = 0.35;
    var lfo = ac.createOscillator(); lfo.frequency.value = 9;
    var lg = ac.createGain(); lg.gain.value = 5;
    lfo.connect(lg); lg.connect(o.frequency);
    // slow drift LFO — doppler-ish wander as the trucks work the grade
    var drift = ac.createOscillator(); drift.frequency.value = 0.13;
    var dg = ac.createGain(); dg.gain.value = 3.2;
    drift.connect(dg); dg.connect(o.frequency); dg.connect(o2.frequency);
    var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(master);
    // gravel: washboard road under six tires
    if (!noiseBuf) noise(t, 0.01, 0.0001, 100, 200, 'lowpass'); // ensure buffer
    var gs = ac.createBufferSource(); gs.buffer = noiseBuf; gs.loop = true;
    gs.playbackRate.value = 0.7;
    var gf = ac.createBiquadFilter(); gf.type = 'bandpass'; gf.frequency.value = 950; gf.Q.value = 0.5;
    var gg = ac.createGain(); gg.gain.setValueAtTime(0.0001, t);
    gg.gain.linearRampToValueAtTime(0.045, t + 1.2);
    var glfo = ac.createOscillator(); glfo.frequency.value = 6.5;
    var glg = ac.createGain(); glg.gain.value = 0.018;
    glfo.connect(glg); glg.connect(gg.gain);
    gs.connect(gf); gf.connect(gg); gg.connect(master);
    o.start(t); o2.start(t); lfo.start(t); drift.start(t); gs.start(t); glfo.start(t);
    engineNodes = { o: o, o2: o2, lfo: lfo, drift: drift, g: g, gs: gs, glfo: glfo, gg: gg, baseF: 46 };
  }
  function enginePitch(mult) { // doppler-ish shift as the convoy nears/passes
    if (!ac || !engineNodes) return;
    var t = now();
    engineNodes.o.frequency.cancelScheduledValues(t);
    engineNodes.o.frequency.setTargetAtTime(engineNodes.baseF * mult, t, 0.4);
    engineNodes.o2.frequency.setTargetAtTime(engineNodes.baseF * 2.01 * mult, t, 0.4);
  }
  function engineStop() {
    if (!ac || !engineNodes) return;
    var t = now(), e = engineNodes; engineNodes = null;
    e.g.gain.cancelScheduledValues(t);
    e.g.gain.setValueAtTime(e.g.gain.value, t);
    e.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    e.gg.gain.cancelScheduledValues(t);
    e.gg.gain.setValueAtTime(Math.max(e.gg.gain.value, 0.0001), t);
    e.gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    try {
      e.o.stop(t + 0.8); e.o2.stop(t + 0.8); e.lfo.stop(t + 0.8);
      e.drift.stop(t + 0.8); e.gs.stop(t + 0.8); e.glfo.stop(t + 0.8);
    } catch (err) {}
  }
  function rattle() { // pothole: the load tests its chains
    if (!ok()) return;
    var t = now();
    osc('sine', 70, t, 0.22, 0.5, 34);
    noise(t, 0.09, 0.28, 500, 2400, 'lowpass');
    for (var i = 0; i < 5; i++) {
      noise(t + 0.06 + i * 0.05, 0.03, 0.12 * (1 - i * 0.16), 2200, 4200, 'bandpass');
      osc('square', 900 + Math.random() * 700, t + 0.07 + i * 0.05, 0.02, 0.05);
    }
  }
  function radioBlip() { // squelch break before chatter
    if (!ok()) return;
    var t = now();
    noise(t, 0.05, 0.05, 1800, 2600, 'bandpass');
    osc('square', 1420, t + 0.04, 0.03, 0.03);
  }

  /* ---- REFINERY ---- */
  var boilNodes = null;
  function boilStart() {
    if (!ok() || boilNodes) return;
    var t = now();
    if (!noiseBuf) noise(t, 0.01, 0.0001, 100, 200, 'lowpass'); // ensure buffer
    var src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
    var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.4);
    var lfo = ac.createOscillator(); lfo.frequency.value = 5.5;
    var lg = ac.createGain(); lg.gain.value = 250;
    lfo.connect(lg); lg.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); lfo.start(t);
    boilNodes = { src: src, lfo: lfo, g: g };
  }
  function boilStop() {
    if (!ac || !boilNodes) return;
    var t = now(), b = boilNodes; boilNodes = null;
    b.g.gain.cancelScheduledValues(t);
    b.g.gain.setValueAtTime(b.g.gain.value, t);
    b.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    try { b.src.stop(t + 0.6); b.lfo.stop(t + 0.6); } catch (err) {}
  }
  function batchDone(good) {
    if (!ok()) return;
    var t = now();
    if (good) {
      osc('triangle', 660, t, 0.2, 0.12);
      osc('triangle', 880, t + 0.14, 0.4, 0.14);
      noise(t, 0.3, 0.08, 800, 2400, 'bandpass');
    } else {
      osc('sawtooth', 160, t, 0.5, 0.14, 90);
      noise(t, 0.7, 0.16, 200, 900, 'lowpass');
    }
  }

  /* ---- RANGE ---- */
  function klaxon() {
    if (!ok()) return;
    var t = now();
    for (var i = 0; i < 3; i++) {
      osc('sawtooth', 520, t + i * 0.55, 0.24, 0.16, 500);
      osc('sawtooth', 392, t + i * 0.55 + 0.26, 0.24, 0.16, 380);
    }
  }
  function armLatch() {
    if (!ok()) return;
    var t = now();
    noise(t, 0.05, 0.25, 1500, 2500, 'bandpass');
    osc('square', 320, t + 0.05, 0.08, 0.15, 250);
  }
  function beep(final_) {
    if (!ok()) return;
    var t = now();
    osc('square', final_ ? 1320 : 880, t, final_ ? 0.32 : 0.12, 0.14);
  }
  function detonation(intensity, fizzle) {
    if (!ok()) return;
    var t = now(), k = Math.min(Math.max(intensity, 0.15), 1.3);
    if (fizzle) {
      noise(t, 1.4, 0.28, 150, 900, 'lowpass');
      osc('sine', 90, t, 0.7, 0.25, 45);
      return;
    }
    osc('sine', 52, t, 1.5, 0.9 * k, 26);
    osc('sine', 34, t + 0.03, 2.2, 0.7 * k, 20);
    noise(t, 0.35, 0.85 * k, 3000, 6000, 'lowpass');
    noise(t + 0.08, 2.8, 0.6 * k, 90, 700, 'lowpass');
    noise(t + 1.2, 2.4, 0.22 * k, 60, 220, 'lowpass');
  }
  function seismo() {
    if (!ok()) return;
    var t = now();
    for (var i = 0; i < 7; i++) noise(t + i * 0.07, 0.05, 0.05, 1200, 2400, 'bandpass');
  }
  function wind() {
    if (!ok()) return;
    noise(now(), 3.5, 0.035, 200, 600, 'bandpass');
  }
  var lastMeasure = 0;
  function measureTick() { // crater tape-measure ticks
    if (!ok()) return;
    var t = now();
    if (t - lastMeasure < 0.05) return;
    lastMeasure = t;
    osc('square', 1900, t, 0.012, 0.05);
  }

  /* ---- RESULTS ---- */
  function fanfare() {
    if (!ok()) return;
    var t = now(), seq = [392, 523, 659, 784];
    for (var i = 0; i < seq.length; i++) {
      osc('triangle', seq[i], t + i * 0.13, 0.35, 0.14);
      osc('square', seq[i] * 2, t + i * 0.13, 0.12, 0.03);
    }
    osc('triangle', 1046, t + 0.55, 0.9, 0.16);
  }
  function sadDrone() {
    if (!ok()) return;
    var t = now();
    osc('sawtooth', 196, t, 1.2, 0.07, 185);
    osc('sawtooth', 147, t + 0.15, 1.4, 0.07, 139);
  }

  return {
    init: init,
    setMuted: function (m) { muted = m; },
    tick: tick, typeKey: typeKey, typeDing: typeDing, tap: tap,
    stampThud: stampThud, buzz: buzz,
    thunk: thunk, pickup: pickup, unsnap: unsnap, ghostHum: ghostHum,
    wireSnap: wireSnap, wireDrop: wireDrop, ratchet: ratchet, torqueDone: torqueDone,
    spoolPull: spoolPull, wireClip: wireClip, probeClip: probeClip,
    needleTone: needleTone, paperFold: paperFold,
    slide: slide, seatClick: seatClick, slam: slam,
    coverFlick: coverFlick, switchClack: switchClack,
    engineStart: engineStart, engineStop: engineStop, enginePitch: enginePitch,
    rattle: rattle, radioBlip: radioBlip,
    boilStart: boilStart, boilStop: boilStop, batchDone: batchDone,
    klaxon: klaxon, armLatch: armLatch, beep: beep,
    detonation: detonation, seismo: seismo, wind: wind, measureTick: measureTick,
    fanfare: fanfare, sadDrone: sadDrone
  };
})();
