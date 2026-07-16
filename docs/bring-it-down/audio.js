/* Bring It Down — WebAudio SFX, all synthesized. Init on first user gesture. */
'use strict';
var AudioFX = (function () {
  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var rumbleGain = null, rumbleTarget = 0;
  var lastSnap = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ctx.destination);

    // shared noise buffer (2s)
    var len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // collapse rumble: looped noise -> lowpass -> gain(0)
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 90; lp.Q.value = 0.8;
    rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0;
    src.connect(lp); lp.connect(rumbleGain); rumbleGain.connect(master);
    src.start();
  }

  function env(g, t0, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
  }

  function noiseHit(opts) {
    if (!ctx) return;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = opts.rate || 1;
    var f = ctx.createBiquadFilter();
    f.type = opts.type || 'lowpass';
    f.frequency.setValueAtTime(opts.f0 || 800, t0);
    if (opts.f1) f.frequency.exponentialRampToValueAtTime(opts.f1, t0 + (opts.a || 0.005) + opts.dec);
    f.Q.value = opts.q || 0.8;
    var g = ctx.createGain();
    env(g, t0, opts.a || 0.005, opts.peak, opts.dec);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0, Math.random() * 1.2);
    src.stop(t0 + (opts.a || 0.005) + opts.dec + 0.05);
  }

  function tone(opts) {
    if (!ctx) return;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var o = ctx.createOscillator();
    o.type = opts.wave || 'sine';
    o.frequency.setValueAtTime(opts.f0, t0);
    if (opts.f1) o.frequency.exponentialRampToValueAtTime(opts.f1, t0 + (opts.a || 0.004) + opts.dec);
    var g = ctx.createGain();
    env(g, t0, opts.a || 0.004, opts.peak, opts.dec);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + (opts.a || 0.004) + opts.dec + 0.05);
  }

  return {
    init: init,
    ready: function () { return !!ctx; },

    tick: function () { tone({ wave: 'square', f0: 1700, peak: 0.05, dec: 0.045 }); },
    select: function () { tone({ wave: 'square', f0: 900, f1: 1500, peak: 0.06, dec: 0.07 }); },
    deny: function () { tone({ wave: 'sawtooth', f0: 160, f1: 90, peak: 0.09, dec: 0.16 }); },
    refund: function () { tone({ wave: 'square', f0: 1200, f1: 620, peak: 0.05, dec: 0.09 }); },

    torch: function () {
      noiseHit({ type: 'bandpass', f0: 3400, q: 1.4, peak: 0.16, a: 0.01, dec: 0.3 });
      tone({ wave: 'sawtooth', f0: 90, peak: 0.03, dec: 0.24 });
    },
    cable: function () {
      tone({ wave: 'triangle', f0: 520, f1: 300, peak: 0.09, dec: 0.14 });
      noiseHit({ type: 'highpass', f0: 2400, peak: 0.05, dec: 0.1, delay: 0.05 });
    },
    place: function () { tone({ wave: 'triangle', f0: 340, f1: 220, peak: 0.1, dec: 0.09 }); },

    boom: function () {
      if (!ctx) return;
      // low thump
      tone({ wave: 'sine', f0: 88, f1: 30, peak: 0.85, a: 0.006, dec: 0.75 });
      // body
      noiseHit({ f0: 900, f1: 90, peak: 0.7, a: 0.004, dec: 0.6, q: 0.6 });
      // crack transient
      noiseHit({ type: 'highpass', f0: 1400, peak: 0.28, a: 0.001, dec: 0.09 });
    },
    winchRun: function () {
      noiseHit({ type: 'bandpass', f0: 700, q: 3, peak: 0.06, a: 0.06, dec: 1.4 });
      tone({ wave: 'sawtooth', f0: 60, f1: 84, peak: 0.05, a: 0.08, dec: 1.6 });
    },
    snap: function () {
      var now = performance.now();
      if (now - lastSnap < 70) return;
      lastSnap = now;
      noiseHit({ type: 'bandpass', f0: 500 + Math.random() * 900, q: 2.5, peak: 0.11, dec: 0.09 });
    },
    thud: function (k) {
      var v = Math.min(0.5, 0.1 + k * 0.4);
      tone({ wave: 'sine', f0: 62 + Math.random() * 22, f1: 34, peak: v, dec: 0.22 });
      noiseHit({ f0: 300, peak: v * 0.5, dec: 0.12 });
    },
    rumble: function (level) { rumbleTarget = Math.min(0.5, level); },
    updateRumble: function (dt) {
      if (!rumbleGain) return;
      var cur = rumbleGain.gain.value;
      rumbleGain.gain.value = cur + (rumbleTarget - cur) * Math.min(1, dt * 7);
    },

    drumroll: function () { noiseHit({ type: 'bandpass', f0: 200, q: 1.2, peak: 0.07, a: 0.25, dec: 0.4 }); },
    star: function (n) {
      var f = [660, 880, 1174][n] || 660;
      tone({ wave: 'triangle', f0: f, peak: 0.16, dec: 0.5 });
      tone({ wave: 'sine', f0: f * 2, peak: 0.05, dec: 0.6, delay: 0.03 });
    },
    fanfare: function (good) {
      if (good) {
        [523, 659, 784, 1046].forEach(function (f, i) {
          tone({ wave: 'triangle', f0: f, peak: 0.12, dec: 0.4, delay: i * 0.09 });
        });
      } else {
        tone({ wave: 'sawtooth', f0: 220, f1: 180, peak: 0.08, dec: 0.5 });
        tone({ wave: 'sawtooth', f0: 277, f1: 210, peak: 0.08, dec: 0.55, delay: 0.05 });
      }
    }
  };
})();
