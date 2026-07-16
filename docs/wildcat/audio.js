/* ============================================================
   WILDCAT — audio.js
   Fully synthesized WebAudio SFX. No assets. Init on first
   user gesture via unlock().
   ============================================================ */
(function () {
  'use strict';

  var ctx = null, master = null, noiseBuf = null;
  var humOsc = null, humGain = null, humFilt = null;
  var grindSrc = null, grindGain = null, grindFilt = null;
  var pumpLfo = null, pumpGain = null, pumpSrc = null, pumpFilt = null;

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    // shared noise buffer
    var len = ctx.sampleRate | 0;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0), s = 987654321;
    for (var i = 0; i < len; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (s / 0x3fffffff) - 1;
    }

    // drill hum: saw through lowpass, gain driven per-frame
    humOsc = ctx.createOscillator();
    humOsc.type = 'sawtooth';
    humOsc.frequency.value = 52;
    humFilt = ctx.createBiquadFilter();
    humFilt.type = 'lowpass'; humFilt.frequency.value = 220; humFilt.Q.value = 2;
    humGain = ctx.createGain(); humGain.gain.value = 0;
    humOsc.connect(humFilt); humFilt.connect(humGain); humGain.connect(master);
    humOsc.start();

    // bedrock grind: bandpassed noise
    grindSrc = ctx.createBufferSource();
    grindSrc.buffer = noiseBuf; grindSrc.loop = true;
    grindFilt = ctx.createBiquadFilter();
    grindFilt.type = 'bandpass'; grindFilt.frequency.value = 1900; grindFilt.Q.value = 1.4;
    grindGain = ctx.createGain(); grindGain.gain.value = 0;
    grindSrc.connect(grindFilt); grindFilt.connect(grindGain); grindGain.connect(master);
    grindSrc.start();

    // pump chug: lowpassed noise with slow AM
    pumpSrc = ctx.createBufferSource();
    pumpSrc.buffer = noiseBuf; pumpSrc.loop = true; pumpSrc.playbackRate.value = 0.4;
    pumpFilt = ctx.createBiquadFilter();
    pumpFilt.type = 'lowpass'; pumpFilt.frequency.value = 160;
    pumpGain = ctx.createGain(); pumpGain.gain.value = 0;
    var am = ctx.createGain(); am.gain.value = 0;
    pumpLfo = ctx.createOscillator(); pumpLfo.type = 'sine'; pumpLfo.frequency.value = 1.2;
    var lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.5;
    pumpLfo.connect(lfoDepth); lfoDepth.connect(pumpGain.gain);
    pumpSrc.connect(pumpFilt); pumpFilt.connect(pumpGain); pumpGain.connect(master);
    pumpSrc.start(); pumpLfo.start();
  }

  function now() { return ctx.currentTime; }

  function env(g, t0, a, peak, dec, end) {
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, end || 0.0001), t0 + a + dec);
  }

  function blip(type, f0, f1, t0, dur, vol, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    env(g, t0, 0.006, vol, dur);
    o.connect(g); g.connect(dest || master);
    o.start(t0); o.stop(t0 + dur + 0.08);
  }

  function noiseBurst(t0, dur, vol, filtType, freq, q, rate) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    if (rate) src.playbackRate.value = rate;
    var f = ctx.createBiquadFilter();
    f.type = filtType || 'lowpass'; f.frequency.value = freq || 800; f.Q.value = q || 1;
    var g = ctx.createGain();
    env(g, t0, 0.01, vol, dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.1);
    return f;
  }

  var A = {
    unlock: unlock,
    get ready() { return !!ctx; },

    /* continuous layer — call each frame */
    update: function (dt, st) {
      if (!ctx) return;
      var t = now();
      var humT = st.drilling ? (st.grinding ? 0.05 : 0.11) : 0;
      humGain.gain.setTargetAtTime(humT, t, 0.08);
      humFilt.frequency.setTargetAtTime(st.grinding ? 140 : 200 + 160 * (st.speedN || 0), t, 0.1);
      humOsc.frequency.setTargetAtTime(st.grinding ? 38 : 48 + 22 * (st.speedN || 0), t, 0.1);
      grindGain.gain.setTargetAtTime(st.grinding ? 0.05 + Math.random() * 0.05 : 0, t, 0.05);
      pumpGain.gain.setTargetAtTime(st.pumping ? 0.07 : 0, t, 0.25);
      if (st.pumpRate) pumpLfo.frequency.setTargetAtTime(0.8 + st.pumpRate, t, 0.3);
    },

    ping: function () {
      if (!ctx) return;
      var t0 = now();
      blip('sine', 1350, 620, t0, 0.28, 0.22);
      blip('sine', 1350, 620, t0 + 0.26, 0.22, 0.09);   // echo
      blip('sine', 1350, 620, t0 + 0.52, 0.2, 0.035);   // fainter echo
    },

    spud: function () {
      if (!ctx) return;
      var t0 = now();
      blip('triangle', 130, 60, t0, 0.16, 0.3);
      noiseBurst(t0, 0.12, 0.12, 'lowpass', 500);
    },

    strike: function () {
      if (!ctx) return;
      var t0 = now();
      // whoosh
      var f = noiseBurst(t0, 1.1, 0.28, 'bandpass', 300, 0.8);
      f.frequency.setValueAtTime(250, t0);
      f.frequency.exponentialRampToValueAtTime(1400, t0 + 0.9);
      // rising gurgle: bubbling blips climbing in pitch
      for (var i = 0; i < 14; i++) {
        var bt = t0 + 0.08 + i * 0.075 + Math.random() * 0.03;
        var fq = 160 + i * 55 + Math.random() * 60;
        blip('sine', fq, fq * 1.6, bt, 0.09, 0.12);
      }
      blip('triangle', 70, 240, t0 + 0.1, 0.9, 0.16);
    },

    drained: function () {
      if (!ctx) return;
      var t0 = now();
      for (var i = 0; i < 5; i++) {
        var fq = 400 - i * 55;
        blip('sine', fq, fq * 0.7, t0 + i * 0.09, 0.1, 0.08);
      }
    },

    blowout: function () {
      if (!ctx) return;
      var t0 = now();
      noiseBurst(t0, 1.4, 0.4, 'lowpass', 300, 1, 0.6);
      noiseBurst(t0, 0.25, 0.3, 'highpass', 2500);
      blip('sine', 90, 26, t0, 1.2, 0.4);
      blip('sawtooth', 160, 40, t0 + 0.05, 0.7, 0.14);
    },

    capture: function () {
      if (!ctx) return;
      var t0 = now();
      var f = noiseBurst(t0, 0.5, 0.14, 'bandpass', 900, 2);
      f.frequency.exponentialRampToValueAtTime(2400, t0 + 0.45);
      blip('sine', 620, 990, t0 + 0.18, 0.22, 0.16);
    },

    broken: function () {
      if (!ctx) return;
      var t0 = now();
      noiseBurst(t0, 0.35, 0.2, 'highpass', 1800);
      blip('square', 220, 55, t0, 0.4, 0.14);
    },

    dry: function () {
      if (!ctx) return;
      var t0 = now();
      blip('sine', 330, 160, t0, 0.3, 0.12);
      blip('sine', 240, 110, t0 + 0.18, 0.35, 0.1);
    },

    /* selling: small coin tick, pitch climbs with streak */
    coin: function (k) {
      if (!ctx) return;
      var t0 = now();
      var f = 1150 * Math.pow(1.028, Math.min(k, 30));
      blip('triangle', f, f * 1.02, t0, 0.05, 0.11);
      blip('sine', f * 1.5, f * 1.52, t0 + 0.012, 0.05, 0.06);
    },

    saleEnd: function (total) {
      if (!ctx) return;
      var t0 = now();
      var big = Math.min(1, total / 900);
      blip('triangle', 90, 55, t0, 0.13, 0.22 + big * 0.15);            // register thunk
      blip('sine', 1320, 1320, t0 + 0.06, 0.3 + big * 0.25, 0.14 + big * 0.12); // bell
      blip('sine', 1980, 1980, t0 + 0.09, 0.28 + big * 0.22, 0.07 + big * 0.09);
      if (total > 400) blip('sine', 2640, 2640, t0 + 0.12, 0.4, 0.05 + big * 0.06);
    },

    buy: function () {
      if (!ctx) return;
      var t0 = now();
      blip('triangle', 190, 70, t0, 0.12, 0.28);      // heavy thunk
      blip('square', 720, 720, t0 + 0.07, 0.05, 0.07); // metallic click
      noiseBurst(t0, 0.06, 0.07, 'highpass', 3000);
    },

    deny: function () {
      if (!ctx) return;
      var t0 = now();
      blip('square', 190, 150, t0, 0.09, 0.07);
      blip('square', 150, 120, t0 + 0.1, 0.11, 0.07);
    },

    loanPaid: function () {
      if (!ctx) return;
      var t0 = now();
      var seq = [392, 523, 659, 784];
      for (var i = 0; i < seq.length; i++) blip('triangle', seq[i], seq[i], t0 + i * 0.09, 0.22, 0.14);
    },

    interest: function () {
      if (!ctx) return;
      var t0 = now();
      blip('sine', 480, 430, t0, 0.08, 0.05);
    },

    win: function () {
      if (!ctx) return;
      var t0 = now();
      var seq = [523, 659, 784, 1046, 784, 1046, 1318];
      for (var i = 0; i < seq.length; i++) {
        blip('triangle', seq[i], seq[i], t0 + i * 0.13, 0.34, 0.16);
        blip('sine', seq[i] * 2, seq[i] * 2, t0 + i * 0.13 + 0.02, 0.3, 0.05);
      }
      noiseBurst(t0 + 0.8, 1.2, 0.06, 'highpass', 5000);
    },

    lose: function () {
      if (!ctx) return;
      var t0 = now();
      var seq = [330, 294, 262, 196];
      for (var i = 0; i < seq.length; i++) blip('triangle', seq[i], seq[i] * 0.98, t0 + i * 0.22, 0.4, 0.13);
      blip('sine', 65, 40, t0 + 0.6, 1.0, 0.14);
    },

    tick: function () {
      if (!ctx) return;
      blip('sine', 900, 880, now(), 0.03, 0.05);
    }
  };

  window.WildAudio = A;
})();
