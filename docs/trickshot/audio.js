/* ============================================================
   TRICKSHOT OPEN — synthesized WebAudio SFX. No assets.
   Initialized on first user gesture (unlock()).
   ============================================================ */
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var rollSrc = null, rollGain = null, rollFilter = null;

  function unlock() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);

      // shared noise buffer (deterministic seed, render-side only)
      var len = ctx.sampleRate | 0;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      var s = 1234567;
      for (var i = 0; i < len; i++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        d[i] = (s / 0x3fffffff) - 1;
      }

      // rolling loop: filtered white noise, gain driven per frame
      rollSrc = ctx.createBufferSource();
      rollSrc.buffer = noiseBuf; rollSrc.loop = true;
      rollFilter = ctx.createBiquadFilter();
      rollFilter.type = 'lowpass'; rollFilter.frequency.value = 400;
      rollGain = ctx.createGain(); rollGain.gain.value = 0;
      rollSrc.connect(rollFilter); rollFilter.connect(rollGain); rollGain.connect(master);
      rollSrc.start();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function env(node, t0, peak, attack, decay) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.linearRampToValueAtTime(peak, t0 + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  function tone(type, f0, f1, peak, attack, decay, when) {
    if (!ctx) return;
    var t0 = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + attack + decay);
    env(g, t0, peak, attack, decay);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + attack + decay + 0.05);
  }

  function noise(filterType, freq, q, peak, decay, when) {
    if (!ctx) return;
    var t0 = ctx.currentTime + (when || 0);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 1;
    var f = ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    var g = ctx.createGain();
    env(g, t0, peak, 0.004, decay);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0, (Math.random() * 0.4)); src.stop(t0 + decay + 0.1);
  }

  /* strike thwack — scaled with power 0..1 */
  function thwack(p) {
    if (!ctx) return;
    var v = 0.25 + 0.75 * p;
    noise('highpass', 1200, 0.8, 0.5 * v, 0.05);
    noise('bandpass', 300, 1.5, 0.6 * v, 0.08);
    tone('sine', 170 + 120 * p, 55, 0.8 * v, 0.005, 0.09);
  }

  /* per-material bounce tones */
  function bounce(mat, impact) {
    if (!ctx) return;
    var v = Math.min(1, impact / 13);
    if (v < 0.06) return;
    switch (mat) {
      case 'concrete':
        noise('bandpass', 900, 2, 0.5 * v, 0.05);
        tone('square', 190, 130, 0.22 * v, 0.004, 0.05);
        break;
      case 'grass':
        noise('lowpass', 260, 0.7, 0.6 * v, 0.09);
        break;
      case 'gravel':
        noise('bandpass', 1600, 0.6, 0.65 * v, 0.12);
        noise('bandpass', 500, 1, 0.4 * v, 0.09, 0.02);
        break;
      case 'dumpster': // the boing
        tone('sine', 95, 210, 0.7 * v, 0.008, 0.28);
        tone('sine', 190, 420, 0.25 * v, 0.008, 0.2);
        noise('bandpass', 350, 2, 0.3 * v, 0.06);
        break;
      case 'rail': // true metallic ting
        tone('sine', 1245, 1240, 0.5 * v, 0.002, 0.5);
        tone('sine', 1865, 1860, 0.28 * v, 0.002, 0.35);
        tone('sine', 3110, 3100, 0.12 * v, 0.002, 0.2);
        break;
      case 'container': // hollow clang
        tone('triangle', 220, 170, 0.5 * v, 0.004, 0.28);
        tone('triangle', 331, 300, 0.3 * v, 0.004, 0.2);
        noise('bandpass', 700, 3, 0.35 * v, 0.1);
        break;
      case 'awning': // fabric whump
        noise('lowpass', 180, 0.7, 0.75 * v, 0.14);
        tone('sine', 90, 60, 0.3 * v, 0.01, 0.12);
        break;
      case 'crate':
        tone('triangle', 140, 90, 0.5 * v, 0.005, 0.1);
        noise('lowpass', 500, 1, 0.4 * v, 0.07);
        break;
      default:
        noise('bandpass', 600, 1, 0.4 * v, 0.06);
    }
  }

  /* rolling white noise — call every frame with ground speed (0 = quiet) */
  function setRoll(speed, mat) {
    if (!ctx || !rollGain) return;
    var g = Math.min(0.28, speed * 0.028);
    if (mat === 'grass' || mat === 'awning') g *= 0.5;
    if (mat === 'gravel') g *= 1.8;
    rollGain.gain.setTargetAtTime(g, ctx.currentTime, 0.06);
    rollFilter.frequency.setTargetAtTime(240 + speed * 90, ctx.currentTime, 0.08);
  }

  function cupDrop() {
    if (!ctx) return;
    tone('sine', 620, 220, 0.5, 0.004, 0.12);
    tone('sine', 300, 140, 0.5, 0.004, 0.16, 0.07);
    noise('lowpass', 700, 1, 0.35, 0.1, 0.06);
    tone('sine', 880, 870, 0.25, 0.004, 0.4, 0.16); // rattle ring
  }

  function medal(tier) { // 1 bronze, 2 silver, 3 gold
    if (!ctx) return;
    var seq = tier >= 3 ? [523, 659, 784, 1047, 1319] :
              tier === 2 ? [523, 659, 784, 1047] : [523, 659, 784];
    for (var i = 0; i < seq.length; i++) {
      tone('triangle', seq[i], seq[i], 0.32, 0.01, 0.35, i * 0.11);
      tone('sine', seq[i] * 2, seq[i] * 2, 0.1, 0.01, 0.3, i * 0.11);
    }
  }

  function uiTick() { tone('sine', 700, 700, 0.12, 0.003, 0.05); }
  function penalty() {
    tone('sawtooth', 220, 110, 0.25, 0.01, 0.25);
    tone('sawtooth', 165, 82, 0.22, 0.01, 0.3, 0.12);
  }

  window.TSAudio = {
    unlock: unlock, thwack: thwack, bounce: bounce, setRoll: setRoll,
    cupDrop: cupDrop, medal: medal, uiTick: uiTick, penalty: penalty
  };
})();
