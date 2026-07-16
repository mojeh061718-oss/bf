/* THE BRACELET — WebAudio SFX, all synthesized, init on first gesture */
(function (global) {
  'use strict';
  let ctx = null, master = null, enabled = true, droneNodes = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }
  function on() { return ctx && enabled; }
  function now() { return ctx.currentTime; }

  function noiseBuffer(dur) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // card slide: filtered noise swish
  function cardSlide() {
    if (!on()) return;
    const t = now();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.14);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.12);
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + 0.15);
  }

  // card flip: short snap
  function cardFlip() {
    if (!on()) return;
    const t = now();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.05);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + 0.06);
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.setValueAtTime(660, t);
    o.frequency.exponentialRampToValueAtTime(330, t + 0.04);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.12, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g2); g2.connect(master);
    o.start(t); o.stop(t + 0.06);
  }

  function clinkOnce(t, vol) {
    const o = ctx.createOscillator();
    const freq = 2200 + Math.random() * 1800;
    o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.82, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.1);
    const o2 = ctx.createOscillator();
    o2.type = 'sine'; o2.frequency.value = freq * 1.53;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.004);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o2.connect(g2); g2.connect(master);
    o2.start(t); o2.stop(t + 0.07);
  }

  // chips: clink count scales with bet size
  function chips(amount) {
    if (!on()) return;
    const n = Math.max(1, Math.min(7, Math.round(Math.log2((amount || 1) + 1))));
    const t = now();
    for (let i = 0; i < n; i++) clinkOnce(t + i * 0.045 + Math.random() * 0.012, 0.16);
  }

  // check: knuckle knock on wood
  function knock() {
    if (!on()) return;
    const t = now();
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.1);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.02);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.25, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    src.connect(f); f.connect(g2); g2.connect(master);
    src.start(t); src.stop(t + 0.03);
  }

  // fold: soft muck thud
  function muck() {
    if (!on()) return;
    const t = now();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.08);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + 0.09);
  }

  // win chime: warm little arpeggio
  function chime(big) {
    if (!on()) return;
    const t = now();
    const notes = big ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [523.25, 659.25, 783.99];
    notes.forEach((f0, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = f0;
      const g = ctx.createGain();
      const tt = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.2, tt + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.55);
      o.connect(g); g.connect(master);
      o.start(tt); o.stop(tt + 0.6);
    });
  }

  // all-in tension drone (start/stop)
  function droneStart() {
    if (!on() || droneNodes) return;
    const t = now();
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55.7;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; f.Q.value = 4;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.5;
    const lfoG = ctx.createGain(); lfoG.gain.value = 120;
    lfo.connect(lfoG); lfoG.connect(f.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.10, t + 1.2);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o1.start(t); o2.start(t); lfo.start(t);
    droneNodes = { o1, o2, lfo, g };
  }
  function droneStop() {
    if (!ctx || !droneNodes) return;
    const t = now();
    const d = droneNodes; droneNodes = null;
    try {
      d.g.gain.cancelScheduledValues(t);
      d.g.gain.setValueAtTime(Math.max(d.g.gain.value, 0.0001), t);
      d.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      d.o1.stop(t + 0.6); d.o2.stop(t + 0.6); d.lfo.stop(t + 0.6);
    } catch (e) { /* already stopped */ }
  }

  // sad losing thump
  function loseThud() {
    if (!on()) return;
    const t = now();
    [110, 104].forEach((f0, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle'; o.frequency.setValueAtTime(f0, t + i * 0.3);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + i * 0.3 + 0.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.3);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.3 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.3 + 0.55);
      o.connect(g); g.connect(master);
      o.start(t + i * 0.3); o.stop(t + i * 0.3 + 0.6);
    });
  }

  global.SFX = {
    init, cardSlide, cardFlip, chips, knock, muck, chime, droneStart, droneStop, loseThud,
    setEnabled(v) { enabled = v; if (!v) droneStop(); },
    get enabled() { return enabled; }
  };
})(window);
