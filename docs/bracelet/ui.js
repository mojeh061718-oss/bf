/* ============================================================
   THE BRACELET — table UI: DOM, avatars, cards, chip/card FX
   ============================================================ */
(function (global) {
  'use strict';
  const E = global.Engine;

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  };

  // ---------- avatars (inline SVG, one per character) ----------
  function av(body) {
    return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';
  }
  const AVATARS = {
    // hero: hoodie kid
    you: av(`
      <rect width="64" height="64" fill="#31435a"/>
      <path d="M10 64 Q10 44 32 44 Q54 44 54 64 Z" fill="#5a7d5a"/>
      <circle cx="32" cy="28" r="13" fill="#e8b98c"/>
      <path d="M19 26 Q22 14 32 15 Q42 14 45 26 L45 22 Q42 10 32 10 Q22 10 19 22 Z" fill="#3a2c20"/>
      <path d="M22 46 Q32 40 42 46 L42 50 Q32 45 22 50 Z" fill="#4a6b4a"/>
      <circle cx="27" cy="28" r="1.7" fill="#241c14"/><circle cx="37" cy="28" r="1.7" fill="#241c14"/>
      <path d="M28 34 Q32 36.5 36 34" stroke="#a97c52" stroke-width="1.4" fill="none" stroke-linecap="round"/>`),
    deke: av(`
      <rect width="64" height="64" fill="#4a453c"/>
      <path d="M10 64 Q10 46 32 46 Q54 46 54 64 Z" fill="#6d6154"/>
      <circle cx="32" cy="29" r="13" fill="#d9a878"/>
      <path d="M17 24 Q18 15 32 14 Q46 15 47 24 L48 26 Q32 22 16 26 Z" fill="#8a8378"/>
      <rect x="16" y="23" width="32" height="3.6" rx="1.8" fill="#736c60"/>
      <rect x="24" y="35.5" width="16" height="3.4" rx="1.7" fill="#8c8c8c"/>
      <circle cx="26.5" cy="28.5" r="1.6" fill="#241c14"/><circle cx="37.5" cy="28.5" r="1.6" fill="#241c14"/>
      <path d="M25 25.8 L29 25.8 M35 25.8 L39 25.8" stroke="#7d7468" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M27 41 L37 41" stroke="#a3764e" stroke-width="1.6" stroke-linecap="round"/>`),
    tilly: av(`
      <rect width="64" height="64" fill="#8f3b2c"/>
      <path d="M10 64 Q10 46 32 46 Q54 46 54 64 Z" fill="#c9603e"/>
      <circle cx="32" cy="20" r="8" fill="#b3402e"/>
      <circle cx="32" cy="30" r="13" fill="#e8ac7e"/>
      <path d="M19 27 Q19 16 32 16 Q45 16 45 27 L45 24 Q42 20 32 20 Q22 20 19 24 Z" fill="#b3402e"/>
      <rect x="18" y="16" width="28" height="5" rx="2.5" fill="#e8b64c" transform="rotate(-4 32 18)"/>
      <circle cx="26.5" cy="29" r="1.9" fill="#241c14"/><circle cx="37.5" cy="29" r="1.9" fill="#241c14"/>
      <path d="M24.5 25.5 Q26.5 24 28.5 25.2 M35.5 25.2 Q37.5 24 39.5 25.5" stroke="#8a5a34" stroke-width="1.3" fill="none"/>
      <path d="M26 35 Q32 41 38 35 Q35 38.5 32 38.5 Q29 38.5 26 35 Z" fill="#7c2a1c"/>
      <circle cx="22" cy="33" r="2.3" fill="#e77d5f" opacity=".7"/><circle cx="42" cy="33" r="2.3" fill="#e77d5f" opacity=".7"/>`),
    stan: av(`
      <rect width="64" height="64" fill="#37505f"/>
      <path d="M10 64 Q10 45 32 45 Q54 45 54 64 Z" fill="#88332b"/>
      <path d="M24 46 L40 46 L40 64 L24 64 Z" fill="#d9d2c0"/>
      <circle cx="32" cy="29" r="14" fill="#ebbd93"/>
      <path d="M18 24 Q20 13 32 13 Q44 13 46 24 L46 22 Q44 18 32 18 Q20 18 18 22 Z" fill="#5b4a38"/>
      <circle cx="26" cy="28" r="1.6" fill="#241c14"/><circle cx="38" cy="28" r="1.6" fill="#241c14"/>
      <path d="M24 36 Q28 33.5 32 33.8 Q36 33.5 40 36 L40 38.5 Q36 36.5 32 36.6 Q28 36.5 24 38.5 Z" fill="#4a3a2a"/>
      <circle cx="32" cy="31.5" r="2.2" fill="#d9975f"/>
      <path d="M20 30 Q19 33 20.5 35 M44 30 Q45 33 43.5 35" stroke="#c98d5e" stroke-width="1.2" fill="none"/>`),
    rosa: av(`
      <rect width="64" height="64" fill="#3f5a52"/>
      <path d="M10 64 Q10 45 32 45 Q54 45 54 64 Z" fill="#4e8378"/>
      <path d="M27 47 L37 47 L36 53 L28 53 Z" fill="#3d6b61"/>
      <circle cx="32" cy="29" r="13" fill="#caa27e"/>
      <path d="M18 30 Q17 13 32 13 Q47 13 46 30 L44 32 Q45 18 32 17 Q19 18 20 32 Z" fill="#241c18"/>
      <path d="M18 30 Q18 38 21 40 L21 30 Z M46 30 Q46 38 43 40 L43 30 Z" fill="#241c18"/>
      <circle cx="26.5" cy="28.5" r="1.7" fill="#1d150f"/><circle cx="37.5" cy="28.5" r="1.7" fill="#1d150f"/>
      <path d="M24.5 25.2 L29 25.2 M35 25.2 L39.5 25.2" stroke="#1d150f" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M28.5 35.5 L35.5 35.5" stroke="#8a5c3c" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="43" cy="21" r="2.6" fill="#e8b64c"/>`),
    nick: av(`
      <rect width="64" height="64" fill="#54524a"/>
      <path d="M10 64 Q10 46 32 46 Q54 46 54 64 Z" fill="#7d8b57"/>
      <circle cx="32" cy="29" r="12.5" fill="#f0c9a0"/>
      <path d="M20 24 Q21 15 32 14 Q43 15 44 24 L44 21 Q40 16 32 16 Q24 16 20 21 Z" fill="#8a6b42"/>
      <path d="M22 18 Q26 13 32 14 L30 17 Z" fill="#8a6b42"/>
      <circle cx="26.5" cy="28" r="2.4" fill="#fff"/><circle cx="37.5" cy="28" r="2.4" fill="#fff"/>
      <circle cx="27" cy="28.5" r="1.4" fill="#241c14"/><circle cx="38" cy="28.5" r="1.4" fill="#241c14"/>
      <path d="M24 24.5 Q26 23 28.5 24.5 M35.5 24.5 Q38 23 40 24.5" stroke="#6d5330" stroke-width="1.3" fill="none"/>
      <path d="M28.5 36.5 Q32 34.8 35.5 36.5" stroke="#a97c52" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M44 31 Q45.5 34 44 35.5 Q42.5 34 44 31 Z" fill="#7fb2d9"/>`)
  };

  // ---------- cards ----------
  function cardEl(c, flipped) {
    const d = el('div', 'card');
    const back = el('div', 'face back');
    const front = el('div', 'face front');
    if (c !== null && c !== undefined) {
      const suit = E.suitOf(c);
      const red = (suit === 1 || suit === 2);
      d.classList.add(red ? 'red' : 'black');
      const r = E.RANKS[E.rankOf(c) - 2];
      front.innerHTML =
        '<span class="rank">' + (r === 'T' ? '10' : r) +
        '<span class="suit-sm">' + E.SUITS[suit] + '</span></span>' +
        '<span class="suit-big">' + E.SUITS[suit] + '</span>';
    }
    d.appendChild(back); d.appendChild(front);
    if (flipped) d.classList.add('flipped');
    return d;
  }
  function cardHTMLInline(c) { // for notebook text
    const suit = E.suitOf(c);
    const red = (suit === 1 || suit === 2);
    const r = E.RANKS[E.rankOf(c) - 2];
    return '<span class="' + (red ? 'redcard' : '') + '">' + (r === 'T' ? '10' : r) + E.SUITS[suit] + '</span>';
  }

  // ---------- fly animations (WAAPI) ----------
  const fxLayer = () => $('#fx-layer');
  function rectOf(node) { return node.getBoundingClientRect(); }
  function appRect() { return $('#app').getBoundingClientRect(); }

  // animate a clone/element from rectA center to rectB center
  function fly(node, from, to, ms, easing) {
    const layer = fxLayer();
    const ar = appRect();
    node.classList.add('fly');
    node.style.left = (from.left + from.width / 2 - ar.left) + 'px';
    node.style.top = (from.top + from.height / 2 - ar.top) + 'px';
    layer.appendChild(node);
    const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    const dy = (to.top + to.height / 2) - (from.top + from.height / 2);
    const anim = node.animate(
      [{ transform: 'translate(-50%,-50%) translate(0,0)' },
       { transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px)' }],
      { duration: ms, easing: easing || 'cubic-bezier(.3,.9,.35,1)', fill: 'forwards' });
    return anim.finished.catch(() => {}).then(() => node.remove());
  }

  function flyChip(fromNode, toNode, amount, ms) {
    if (!fromNode || !toNode) return Promise.resolve();
    const n = el('div', 'flychip');
    n.innerHTML = chipStackHTML(amount) + (amount ? '<span>$' + amount + '</span>' : '');
    return fly(n, rectOf(fromNode), rectOf(toNode), ms || 420);
  }
  function flyCard(fromNode, toNode, ms) {
    if (!fromNode || !toNode) return Promise.resolve();
    const n = el('div', '');
    n.style.setProperty('--cw', '30px');
    const c = cardEl(null, false);
    n.appendChild(c);
    return fly(n, rectOf(fromNode), rectOf(toNode), ms || 300, 'cubic-bezier(.2,.8,.4,1)');
  }

  function chipStackHTML(amount) {
    const cls = amount >= 60 ? 'c4' : amount >= 25 ? 'c3' : amount >= 8 ? 'c2' : 'c1';
    const n = Math.max(1, Math.min(4, Math.ceil(Math.log10((amount || 1) + 1))));
    let html = '<span class="chipstack" style="height:' + (18 + (n - 1) * 3) + 'px">';
    for (let i = 0; i < n; i++)
      html += '<span class="chip ' + cls + '" style="bottom:' + (i * 3) + 'px"></span>';
    return html + '</span>';
  }

  // ---------- UI object ----------
  const UI = {
    AVATARS, cardEl, cardHTMLInline, el, $, flyChip, flyCard, chipStackHTML, fly, rectOf,

    buildSeats(chars) { // chars: array of {key,name} by seat
      const felt = $('#felt');
      chars.forEach((ch, i) => {
        const s = el('div', 'seat');
        s.id = 'seat-' + i;
        s.innerHTML =
          '<div class="holecards"></div>' +
          '<div class="avatar">' + AVATARS[ch.key] + '</div>' +
          '<div class="nameplate"><span class="pname">' + ch.short + '</span><span class="pstack">$200</span></div>' +
          '<div class="bubble"></div>' +
          '<div class="think"><i></i><i></i><i></i></div>' +
          '<div class="sd-label"></div>';
        felt.appendChild(s);
        const bet = el('div', 'seat-bet');
        bet.id = 'bet-' + i;
        felt.appendChild(bet);
      });
      const dbtn = el('div', 'dealer-btn', 'D');
      dbtn.id = 'dealer-btn';
      felt.appendChild(dbtn);
    },

    setStack(seat, amount) {
      const n = $('#seat-' + seat + ' .pstack');
      if (n) n.textContent = '$' + amount;
    },
    setSeatState(seat, cls, on) {
      const n = $('#seat-' + seat);
      if (n) n.classList.toggle(cls, !!on);
    },
    clearSeatStates() {
      document.querySelectorAll('.seat').forEach(s => s.classList.remove('acting', 'folded', 'winner'));
      document.querySelectorAll('.sd-label').forEach(n => { n.classList.remove('show'); n.textContent = ''; });
    },
    moveDealer(seat) {
      const btn = $('#dealer-btn');
      const seatEl = $('#seat-' + seat);
      if (!btn || !seatEl) return;
      // place near the seat, pulled toward table center
      const felt = $('#felt');
      const fr = felt.getBoundingClientRect();
      const sr = seatEl.getBoundingClientRect();
      const cx = (sr.left + sr.width / 2 - fr.left) / fr.width;
      const cy = (sr.top + sr.height / 2 - fr.top) / fr.height;
      const tx = cx + (0.5 - cx) * 0.28, ty = cy + (0.44 - cy) * 0.30;
      btn.style.left = 'calc(' + (tx * 100) + '% - 10px)';
      btn.style.top = 'calc(' + (ty * 100) + '% - 10px)';
    },

    setBet(seat, amount) {
      const b = $('#bet-' + seat);
      if (!b) return;
      if (!amount) { b.classList.remove('show'); b.innerHTML = ''; return; }
      b.innerHTML = chipStackHTML(amount) + '<span>$' + amount + '</span>';
      b.classList.add('show');
    },

    setPot(amount) {
      const p = $('#pot-area');
      if (!amount) { p.classList.remove('show'); return; }
      p.classList.add('show');
      $('#pot-label').textContent = 'POT $' + amount;
    },
    bumpPot() {
      const p = $('#pot-area');
      p.style.animation = 'none';
      void p.offsetWidth;
      p.style.animation = 'potpush .45s ease';
    },

    bubble(seat, text, cls) {
      const b = $('#seat-' + seat + ' .bubble');
      if (!b) return;
      b.textContent = text;
      b.className = 'bubble show' + (cls ? ' ' + cls : '');
      clearTimeout(b._t);
      b._t = setTimeout(() => b.classList.remove('show'), 1600);
    },
    think(seat, on) {
      const t = $('#seat-' + seat + ' .think');
      if (t) t.classList.toggle('show', !!on);
    },

    // villain hole cards: two mini backs; reveal replaces with faces
    setHoles(seat, state, cards) { // state: 'none'|'back'|'reveal'
      const h = $('#seat-' + seat + ' .holecards');
      if (!h) return;
      h.classList.toggle('revealed', state === 'reveal');
      h.innerHTML = '';
      if (state === 'none') return;
      if (state === 'back') { h.appendChild(cardEl(null, false)); h.appendChild(cardEl(null, false)); return; }
      cards.forEach(c => {
        const cel = cardEl(c, false);
        h.appendChild(cel);
        requestAnimationFrame(() => requestAnimationFrame(() => cel.classList.add('flipped')));
      });
    },
    sdLabel(seat, text) {
      const n = $('#seat-' + seat + ' .sd-label');
      if (!n) return;
      n.textContent = text;
      n.classList.add('show');
    },

    // board
    clearBoard() {
      const b = $('#board');
      b.innerHTML = '';
      for (let i = 0; i < 5; i++) b.appendChild(el('div', 'bslot'));
    },
    async dealBoardCard(idx, c, sfx) {
      const b = $('#board');
      const slot = b.children[idx];
      const cel = cardEl(c, false);
      slot.replaceWith(cel);
      cel.animate(
        [{ transform: 'translateY(-26px) scale(.7)', opacity: 0 },
         { transform: 'translateY(0) scale(1)', opacity: 1 }],
        { duration: 220, easing: 'ease-out' });
      if (sfx) SFX.cardSlide();
      await wait(150);
      cel.classList.add('flipped');
      if (sfx) SFX.cardFlip();
    },

    // hero cards
    clearHero() { $('#hero-cards').innerHTML = ''; },
    async dealHero(cards) {
      const hc = $('#hero-cards');
      hc.innerHTML = '';
      for (const c of cards) {
        const cel = cardEl(c, false);
        hc.appendChild(cel);
        cel.animate(
          [{ transform: 'translateY(-40px) rotate(8deg)', opacity: 0 },
           { transform: 'translateY(0)', opacity: 1 }],
          { duration: 240, easing: 'ease-out' });
        SFX.cardSlide();
        await wait(140);
        cel.classList.add('flipped');
        SFX.cardFlip();
      }
    },

    setHandStrength(text) {
      const n = $('#hand-strength');
      if (!text) { n.classList.remove('show'); return; }
      n.textContent = text;
      n.classList.add('show');
    },

    ticker(text) {
      const t = $('#ticker');
      t.textContent = text;
      t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    },

    buildLights() {
      document.querySelectorAll('.lights').forEach(l => {
        l.innerHTML = '<div class="wire"></div>';
        for (let i = 0; i < 9; i++) {
          const b = el('div', 'bulb');
          const x = 4 + i * 11.5;
          const sag = Math.sin((i / 8) * Math.PI) * 22;
          b.style.left = x + '%';
          b.style.top = (8 + sag) + 'px';
          b.style.animationDelay = (i * 0.37) + 's';
          l.appendChild(b);
        }
      });
    }
  };

  // shared wait, scaled by game speed
  function wait(ms) {
    const sp = global.GAME_SPEED || 1;
    return new Promise(r => setTimeout(r, ms / sp));
  }
  global.wait = wait;
  global.UI = UI;
})(window);
