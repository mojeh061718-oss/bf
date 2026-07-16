/* PROVING GROUNDS — audio.js
   Fully synthesized WebAudio SFX. No files. Init on first gesture. */
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

  /* ---- UI ---- */
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
  function click() { // vernier / small select
    if (!ok()) return;
    var t = now();
    osc('square', 900, t, 0.02, 0.07);
    noise(t, 0.015, 0.05, 4000, 5000, 'highpass');
  }
  function tap() { // generic button
    if (!ok()) return;
    var t = now();
    osc('triangle', 440, t, 0.06, 0.10, 300);
    osc('square', 1200, t, 0.02, 0.04);
  }
  var lastScratch = 0;
  function scratch() { // drafting slider drag
    if (!ok()) return;
    var t = now();
    if (t - lastScratch < 0.045) return;
    lastScratch = t;
    noise(t, 0.05, 0.045, 900, 2600, 'bandpass');
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

  /* ---- QA ---- */
  function benchPop(good) {
    if (!ok()) return;
    var t = now();
    if (good) { noise(t, 0.08, 0.22, 500, 1800, 'bandpass'); osc('sine', 200, t, 0.08, 0.18, 90); }
    else { osc('square', 220, t, 0.12, 0.10, 140); }
  }
  function chamberHum(on) {
    if (!ok()) return;
    var t = now();
    osc('sawtooth', 85, t, 1.6, 0.06, 110);
    noise(t, 1.6, 0.03, 200, 500, 'lowpass');
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
    // sub thump
    osc('sine', 52, t, 1.5, 0.9 * k, 26);
    osc('sine', 34, t + 0.03, 2.2, 0.7 * k, 20);
    // crack + rumble
    noise(t, 0.35, 0.85 * k, 3000, 6000, 'lowpass');
    noise(t + 0.08, 2.8, 0.6 * k, 90, 700, 'lowpass');
    noise(t + 1.2, 2.4, 0.22 * k, 60, 220, 'lowpass');
  }
  function distantRumble(intensity) { // wavefront arrival at Station 7
    if (!ok()) return;
    detonation(intensity, false);
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
    tick: tick, typeKey: typeKey, typeDing: typeDing, click: click, tap: tap,
    scratch: scratch, stampThud: stampThud, buzz: buzz,
    benchPop: benchPop, chamberHum: chamberHum,
    klaxon: klaxon, armLatch: armLatch, beep: beep,
    detonation: detonation, distantRumble: distantRumble, seismo: seismo, wind: wind,
    fanfare: fanfare, sadDrone: sadDrone
  };
})();
