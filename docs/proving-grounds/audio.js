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
  function thunk(big) { // part clicks into a snap node
    if (!ok()) return;
    var t = now(), k = big ? 1.35 : 1;
    osc('sine', 130 * (big ? 0.8 : 1), t, 0.14, 0.45 * k, 60);
    osc('square', 320, t, 0.03, 0.10 * k, 240);
    noise(t, 0.05, 0.22 * k, 500, 1600, 'bandpass');
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

  /* ---- FLATBED ---- */
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
    var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(master);
    o.start(t); o2.start(t); lfo.start(t);
    engineNodes = { o: o, o2: o2, lfo: lfo, g: g };
  }
  function engineStop() {
    if (!ac || !engineNodes) return;
    var t = now(), e = engineNodes; engineNodes = null;
    e.g.gain.cancelScheduledValues(t);
    e.g.gain.setValueAtTime(e.g.gain.value, t);
    e.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    try { e.o.stop(t + 0.8); e.o2.stop(t + 0.8); e.lfo.stop(t + 0.8); } catch (err) {}
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
    slide: slide, seatClick: seatClick, slam: slam,
    coverFlick: coverFlick, switchClack: switchClack,
    engineStart: engineStart, engineStop: engineStop,
    klaxon: klaxon, armLatch: armLatch, beep: beep,
    detonation: detonation, seismo: seismo, wind: wind, measureTick: measureTick,
    fanfare: fanfare, sadDrone: sadDrone
  };
})();
