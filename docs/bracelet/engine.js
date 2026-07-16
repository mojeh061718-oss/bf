/* ============================================================
   THE BRACELET — poker engine (deterministic core)
   Cards are ints: c = rank*4 + suit, rank 2..14, suit 0..3
   Works in browser (window.Engine) and node (module.exports).
   ============================================================ */
(function (global) {
  'use strict';

  // ---------- RNG (mulberry32, seeded & auditable) ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const RANKS = '23456789TJQKA';           // index 0 => rank 2
  const SUITS = ['♠', '♥', '♦', '♣']; // ♠ ♥ ♦ ♣
  const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];

  function card(rank, suit) { return rank * 4 + suit; }
  function rankOf(c) { return c >> 2; }
  function suitOf(c) { return c & 3; }
  function cardStr(c) { return RANKS[rankOf(c) - 2] + SUITS[suitOf(c)]; }
  function parseCard(s) { // e.g. "As" "Td" "9h" "2c"
    const r = RANKS.indexOf(s[0].toUpperCase()) + 2;
    const su = { s: 0, h: 1, d: 2, c: 3 }[s[1].toLowerCase()];
    return card(r, su);
  }
  function parseCards(str) { return str.trim().split(/\s+/).map(parseCard); }

  function freshDeck() {
    const d = [];
    for (let r = 2; r <= 14; r++) for (let s = 0; s < 4; s++) d.push(card(r, s));
    return d;
  }
  function shuffled(deck, rng) {
    const d = deck.slice();
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = d[i]; d[i] = d[j]; d[j] = t;
    }
    return d;
  }

  // ---------- 5-card evaluator ----------
  // Returns comparable integer. Higher = better.
  // value = cat * 0x100000 + t1*0x10000 + t2*0x1000 + t3*0x100 + t4*0x10 + t5
  const CAT = {
    HIGH: 0, PAIR: 1, TWO_PAIR: 2, TRIPS: 3, STRAIGHT: 4,
    FLUSH: 5, FULL_HOUSE: 6, QUADS: 7, STRAIGHT_FLUSH: 8
  };

  function evaluate5(c0, c1, c2, c3, c4) {
    const r0 = c0 >> 2, r1 = c1 >> 2, r2 = c2 >> 2, r3 = c3 >> 2, r4 = c4 >> 2;
    const isFlush = ((c0 & 3) === (c1 & 3)) && ((c1 & 3) === (c2 & 3)) &&
                    ((c2 & 3) === (c3 & 3)) && ((c3 & 3) === (c4 & 3));
    // counts per rank
    const cnt = new Array(15).fill(0);
    cnt[r0]++; cnt[r1]++; cnt[r2]++; cnt[r3]++; cnt[r4]++;
    // group ranks: sort by (count desc, rank desc)
    const groups = [];
    for (let r = 14; r >= 2; r--) if (cnt[r]) groups.push(r);
    groups.sort((a, b) => cnt[b] - cnt[a] || b - a);
    const g0 = groups[0], n0 = cnt[g0];
    const g1 = groups[1], n1 = groups.length > 1 ? cnt[g1] : 0;

    // straight detection (only possible when 5 distinct ranks)
    let straightHigh = 0;
    if (groups.length === 5) {
      const sorted = [r0, r1, r2, r3, r4].sort((a, b) => b - a);
      if (sorted[0] - sorted[4] === 4) straightHigh = sorted[0];
      else if (sorted[0] === 14 && sorted[1] === 5 && sorted[2] === 4 &&
               sorted[3] === 3 && sorted[4] === 2) straightHigh = 5; // wheel
    }

    let cat, t = [0, 0, 0, 0, 0];
    if (isFlush && straightHigh) { cat = CAT.STRAIGHT_FLUSH; t[0] = straightHigh; }
    else if (n0 === 4)           { cat = CAT.QUADS; t[0] = g0; t[1] = g1; }
    else if (n0 === 3 && n1 === 2) { cat = CAT.FULL_HOUSE; t[0] = g0; t[1] = g1; }
    else if (isFlush)            { cat = CAT.FLUSH; t = groups.slice(); }
    else if (straightHigh)       { cat = CAT.STRAIGHT; t[0] = straightHigh; }
    else if (n0 === 3)           { cat = CAT.TRIPS; t[0] = g0; t[1] = groups[1]; t[2] = groups[2]; }
    else if (n0 === 2 && n1 === 2) { cat = CAT.TWO_PAIR; t[0] = g0; t[1] = g1; t[2] = groups[2]; }
    else if (n0 === 2)           { cat = CAT.PAIR; t[0] = g0; t[1] = groups[1]; t[2] = groups[2]; t[3] = groups[3]; }
    else                         { cat = CAT.HIGH; t = groups.slice(); }

    return cat * 0x100000 +
      (t[0] || 0) * 0x10000 + (t[1] || 0) * 0x1000 +
      (t[2] || 0) * 0x100 + (t[3] || 0) * 0x10 + (t[4] || 0);
  }

  // 21 combos of choose-5-from-7
  const COMBOS7 = [];
  for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++)
    for (let c = b + 1; c < 7; c++) for (let d = c + 1; d < 7; d++)
      for (let e = d + 1; e < 7; e++) COMBOS7.push([a, b, c, d, e]);

  function evaluate7(cards) { // array of 7 ints
    let best = -1;
    for (let i = 0; i < 21; i++) {
      const ix = COMBOS7[i];
      const v = evaluate5(cards[ix[0]], cards[ix[1]], cards[ix[2]], cards[ix[3]], cards[ix[4]]);
      if (v > best) best = v;
    }
    return best;
  }
  function evaluateN(cards) { // 5, 6 or 7 cards
    if (cards.length === 5) return evaluate5(cards[0], cards[1], cards[2], cards[3], cards[4]);
    if (cards.length === 7) return evaluate7(cards);
    // 6 cards: choose 5 of 6
    let best = -1;
    for (let skip = 0; skip < 6; skip++) {
      const sub = [];
      for (let i = 0; i < 6; i++) if (i !== skip) sub.push(cards[i]);
      const v = evaluate5(sub[0], sub[1], sub[2], sub[3], sub[4]);
      if (v > best) best = v;
    }
    return best;
  }

  const RANK_NAME = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
  const RANK_PLURAL = { 2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens', 8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces' };

  function handName(value) {
    const cat = Math.floor(value / 0x100000);
    const t1 = (value >> 16) & 0xF, t2 = (value >> 12) & 0xF;
    switch (cat) {
      case CAT.STRAIGHT_FLUSH:
        return t1 === 14 ? 'Royal Flush' : 'Straight Flush, ' + RANK_NAME[t1] + ' high';
      case CAT.QUADS: return 'Four of a Kind, ' + RANK_PLURAL[t1];
      case CAT.FULL_HOUSE: return 'Full House, ' + RANK_PLURAL[t1] + ' over ' + RANK_PLURAL[t2];
      case CAT.FLUSH: return 'Flush, ' + RANK_NAME[t1] + ' high';
      case CAT.STRAIGHT: return 'Straight, ' + RANK_NAME[t1] + ' high';
      case CAT.TRIPS: return 'Three of a Kind, ' + RANK_PLURAL[t1];
      case CAT.TWO_PAIR: return 'Two Pair, ' + RANK_PLURAL[t1] + ' and ' + RANK_PLURAL[t2];
      case CAT.PAIR: return 'Pair of ' + RANK_PLURAL[t1];
      default: return RANK_NAME[t1] + ' High';
    }
  }

  // ---------- Side pots ----------
  // players: [{seat, total (chips committed to hand), folded}]
  // Returns { pots: [{amount, eligible:[seat,...]}], refund: {seat, amount} | null }
  // Refund = uncalled portion of the largest commitment.
  function buildPots(playersIn) {
    const players = playersIn.map(p => ({ seat: p.seat, total: p.total, folded: !!p.folded }));
    let refund = null;
    // uncalled bet: single highest committer gets back the excess over 2nd highest
    const sorted = players.slice().sort((a, b) => b.total - a.total);
    if (sorted.length >= 2 && sorted[0].total > sorted[1].total) {
      const excess = sorted[0].total - sorted[1].total;
      sorted[0].total -= excess;
      refund = { seat: sorted[0].seat, amount: excess };
    }
    const alive = players.filter(p => !p.folded && p.total > 0);
    const levels = [...new Set(alive.map(p => p.total))].sort((a, b) => a - b);
    const pots = [];
    let prev = 0;
    for (const lv of levels) {
      let amt = 0;
      for (const p of players) amt += Math.max(0, Math.min(p.total, lv) - prev);
      const eligible = alive.filter(p => p.total >= lv).map(p => p.seat);
      pots.push({ amount: amt, eligible });
      prev = lv;
    }
    // residual dead money above the highest alive level (pathological open-folds)
    let residual = 0;
    for (const p of players) residual += Math.max(0, p.total - prev);
    if (residual > 0 && pots.length) pots[pots.length - 1].amount += residual;
    // merge consecutive pots with identical eligibility (cosmetic)
    const merged = [];
    for (const pot of pots) {
      const last = merged[merged.length - 1];
      if (last && last.eligible.length === pot.eligible.length &&
          last.eligible.every((s, i) => s === pot.eligible[i])) last.amount += pot.amount;
      else merged.push(pot);
    }
    return { pots: merged, refund };
  }

  // Award pots at showdown.
  // handsBySeat: {seat: value}; buttonSeat used for odd-chip order.
  // Returns [{seat, amount, potIndex, value}]
  function awardPots(pots, handsBySeat, buttonSeat, numSeats) {
    const awards = [];
    pots.forEach((pot, pi) => {
      let best = -1;
      for (const s of pot.eligible) if (handsBySeat[s] > best) best = handsBySeat[s];
      const winners = pot.eligible.filter(s => handsBySeat[s] === best);
      // order winners starting left of button for odd chips
      const ordered = winners.slice().sort((a, b) => {
        const da = (a - buttonSeat - 1 + numSeats * 2) % numSeats;
        const db = (b - buttonSeat - 1 + numSeats * 2) % numSeats;
        return da - db;
      });
      const share = Math.floor(pot.amount / winners.length);
      let rem = pot.amount - share * winners.length;
      for (const s of ordered) {
        let amt = share;
        if (rem > 0) { amt += 1; rem -= 1; }
        if (amt > 0) awards.push({ seat: s, amount: amt, potIndex: pi, value: best });
      }
    });
    return awards;
  }

  // ---------- Hand state machine ----------
  const STREETS = ['preflop', 'flop', 'turn', 'river'];

  // players: array of {seat, stack} — only players dealt in. Seats are table indices.
  class Hand {
    constructor(opts) {
      this.numSeats = opts.numSeats || 6;
      this.sb = opts.sb; this.bb = opts.bb;
      this.button = opts.button;               // seat index
      this.rng = opts.rng || Math.random;
      this.players = {};                        // seat -> state
      this.seats = opts.players.map(p => p.seat); // ordered ring
      for (const p of opts.players) {
        this.players[p.seat] = {
          seat: p.seat, stack: p.stack, committed: 0, total: 0,
          folded: false, allIn: false, acted: false,
          betFacedWhenActed: -1, hole: null
        };
      }
      this.deck = opts.deck ? opts.deck.slice() : shuffled(freshDeck(), this.rng);
      this.board = [];
      this.streetIdx = 0;
      this.currentBet = 0;
      this.lastRaiseSize = this.bb;
      this.lastFullRaisePoint = 0;
      this.finished = false;
      this.result = null;
      this.headsUp = this.seats.length === 2;
      this.log = [];

      // blinds
      const order = this._ringFrom(this.button, 1);
      this.sbSeat = this.headsUp ? this.button : order[0];
      this.bbSeat = this.headsUp ? order[0] : order[1];
      this._post(this.sbSeat, this.sb);
      this._post(this.bbSeat, this.bb);
      this.currentBet = this.bb;
      this.lastFullRaisePoint = this.bb;

      // deal holes: 2 cards each starting left of button (ring ends on the button)
      const dealOrder = this._ringFrom(this.button, 1);
      for (let round = 0; round < 2; round++)
        for (const s of dealOrder) {
          if (!this.players[s].hole) this.players[s].hole = [];
          this.players[s].hole.push(this.deck.pop());
        }

      // first to act preflop
      this.toActPtr = this.headsUp ? this.button : this._nthAfter(this.bbSeat, 1);
      this._maybeAutoAdvance();
    }

    _ringFrom(seat, offset) { // active seats in order after `seat`
      const out = [];
      for (let i = 1; i <= this.numSeats; i++) {
        const s = (seat + i) % this.numSeats;
        if (this.players[s]) out.push(s);
      }
      return out.slice(offset - 1);
    }
    _nthAfter(seat, n) {
      let s = seat, count = 0;
      for (let i = 1; i <= this.numSeats * 2; i++) {
        s = (s + 1) % this.numSeats; // wrap
        s = s % this.numSeats;
        if (this.players[s]) { count++; if (count === n) return s; }
      }
      return seat;
    }
    _post(seat, amt) {
      const p = this.players[seat];
      const pay = Math.min(amt, p.stack);
      p.stack -= pay; p.committed += pay; p.total += pay;
      if (p.stack === 0) p.allIn = true;
    }

    get street() { return STREETS[this.streetIdx]; }
    get pot() { // total chips in the middle (all totals)
      let sum = 0;
      for (const s of this.seats) sum += this.players[s].total;
      return sum;
    }
    get potBeforeStreet() { // pot excluding current-street commits
      let sum = 0;
      for (const s of this.seats) sum += this.players[s].total - this.players[s].committed;
      return sum;
    }
    livePlayers() { return this.seats.filter(s => !this.players[s].folded); }
    actionablePlayers() {
      return this.seats.filter(s => {
        const p = this.players[s];
        return !p.folded && !p.allIn;
      });
    }

    _needsAction(seat) {
      const p = this.players[seat];
      if (!p || p.folded || p.allIn) return false;
      return !p.acted || p.committed < this.currentBet;
    }

    currentActor() {
      if (this.finished || this.awaitingRunout) return null;
      // scan from pointer
      let s = this.toActPtr;
      for (let i = 0; i < this.numSeats; i++) {
        const seat = (s + i) % this.numSeats;
        if (this._needsAction(seat)) return seat;
      }
      return null;
    }

    legalActions(seat) {
      const p = this.players[seat];
      const toCall = Math.min(this.currentBet - p.committed, p.stack);
      const canCheck = toCall === 0;
      const canRaise = (p.stack > toCall) &&
        (p.betFacedWhenActed < this.lastFullRaisePoint || !p.acted);
      const minRaiseTo = Math.min(this.currentBet + this.lastRaiseSize, p.committed + p.stack);
      const maxRaiseTo = p.committed + p.stack;
      return { toCall, canCheck, canRaise, minRaiseTo, maxRaiseTo };
    }

    // action: {type: 'fold'|'check'|'call'|'raise', amount?: raise-to total for street}
    act(seat, action) {
      if (this.finished) throw new Error('hand finished');
      const actor = this.currentActor();
      if (actor !== seat) throw new Error('not your turn: ' + seat + ' vs ' + actor);
      const p = this.players[seat];
      const la = this.legalActions(seat);
      const entry = { seat, street: this.street, type: action.type };

      if (action.type === 'fold') {
        p.folded = true; p.acted = true;
      } else if (action.type === 'check') {
        if (!la.canCheck) throw new Error('cannot check');
        p.acted = true; p.betFacedWhenActed = this.currentBet;
      } else if (action.type === 'call') {
        const pay = la.toCall;
        p.stack -= pay; p.committed += pay; p.total += pay;
        if (p.stack === 0) p.allIn = true;
        p.acted = true; p.betFacedWhenActed = this.currentBet;
        entry.amount = pay;
      } else if (action.type === 'raise') { // covers bet
        if (!la.canRaise) throw new Error('raise not allowed');
        let to = Math.floor(action.amount);
        if (to > la.maxRaiseTo) to = la.maxRaiseTo;
        const allInShort = (to < la.minRaiseTo);
        if (allInShort && to !== la.maxRaiseTo) throw new Error('raise below minimum');
        if (to <= this.currentBet) throw new Error('raise must exceed current bet');
        const pay = to - p.committed;
        if (pay > p.stack) throw new Error('insufficient stack');
        p.stack -= pay; p.committed += pay; p.total += pay;
        if (p.stack === 0) p.allIn = true;
        const fullRaise = (to - this.currentBet) >= this.lastRaiseSize;
        if (fullRaise) {
          this.lastRaiseSize = to - this.currentBet;
          this.lastFullRaisePoint = to;
        }
        this.currentBet = to;
        p.acted = true; p.betFacedWhenActed = to;
        entry.amount = to;
      } else throw new Error('unknown action ' + action.type);

      this.log.push(entry);
      this.toActPtr = (seat + 1) % this.numSeats;
      this._maybeAutoAdvance();
      return entry;
    }

    _maybeAutoAdvance() {
      // hand over by folds?
      const live = this.livePlayers();
      if (live.length === 1) { this._finishByFold(live[0]); return; }
      // betting round complete?
      if (this.currentActor() !== null) return;
      // advance street(s)
      this._closeStreet();
    }

    _closeStreet() {
      for (const s of this.seats) {
        const p = this.players[s];
        p.committed = 0; p.acted = false; p.betFacedWhenActed = -1;
      }
      this.currentBet = 0;
      this.lastRaiseSize = this.bb;
      this.lastFullRaisePoint = 0;

      if (this.streetIdx === 3) { this._showdown(); return; }
      this.streetIdx++;
      // burn-free deal (demo): flop 3, turn 1, river 1
      const n = this.streetIdx === 1 ? 3 : 1;
      for (let i = 0; i < n; i++) this.board.push(this.deck.pop());
      this.toActPtr = this._firstPostflopActor();
      // If fewer than 2 players can act, keep dealing (runout)
      if (this.actionablePlayers().length < 2 || this.currentActor() === null) {
        if (this.streetIdx === 3) { this._showdown(); }
        else this._closeStreetRunout();
      }
    }
    _closeStreetRunout() {
      // continue dealing until river then showdown, no betting possible
      while (this.streetIdx < 3) {
        this.streetIdx++;
        const n = this.streetIdx === 1 ? 3 : 1;
        for (let i = 0; i < n; i++) this.board.push(this.deck.pop());
      }
      this._showdown();
    }
    _firstPostflopActor() {
      // first live-actionable seat after button (heads-up: non-button acts first postflop)
      const order = this._ringFrom(this.button, 1);
      for (const s of order) if (this._needsAction(s) || (!this.players[s].folded && !this.players[s].allIn)) return s;
      return this.button;
    }

    _finishByFold(winnerSeat) {
      const contribs = this.seats.map(s => ({
        seat: s, total: this.players[s].total, folded: this.players[s].folded
      }));
      const { pots, refund } = buildPots(contribs);
      if (refund) this.players[refund.seat].stack += refund.amount;
      let won = 0;
      for (const pot of pots) won += pot.amount;
      this.players[winnerSeat].stack += won;
      this.finished = true;
      this.result = {
        type: 'fold', winnerSeat, refund,
        awards: [{ seat: winnerSeat, amount: won, potIndex: 0, value: null }],
        pots, showdown: null
      };
    }

    _showdown() {
      const contribs = this.seats.map(s => ({
        seat: s, total: this.players[s].total, folded: this.players[s].folded
      }));
      const { pots, refund } = buildPots(contribs);
      if (refund) this.players[refund.seat].stack += refund.amount;
      const live = this.livePlayers();
      const handsBySeat = {};
      const showdown = [];
      for (const s of live) {
        const v = evaluate7(this.players[s].hole.concat(this.board));
        handsBySeat[s] = v;
        showdown.push({ seat: s, hole: this.players[s].hole.slice(), value: v, name: handName(v) });
      }
      const awards = awardPots(pots, handsBySeat, this.button, this.numSeats);
      for (const a of awards) this.players[a.seat].stack += a.amount;
      this.finished = true;
      this.result = { type: 'showdown', refund, pots, awards, showdown };
    }
  }

  // ---------- Monte Carlo equity ----------
  // hero: [c,c]; board: 0..5 cards; nOpps >= 1
  // oppTierMax: if set, first opponent's hole must be tier <= oppTierMax (rejection sampled)
  function equity(hero, board, nOpps, rollouts, rng, oppTierMax, tierFn) {
    rng = rng || Math.random;
    const known = new Set(hero.concat(board));
    const base = [];
    for (let r = 2; r <= 14; r++) for (let s = 0; s < 4; s++) {
      const c = r * 4 + s;
      if (!known.has(c)) base.push(c);
    }
    const need = 5 - board.length;
    let score = 0;
    const deck = base.slice();
    for (let t = 0; t < rollouts; t++) {
      // partial Fisher-Yates: draw nOpps*2 + need cards
      const drawn = nOpps * 2 + need;
      for (let i = 0; i < drawn; i++) {
        const j = i + Math.floor(rng() * (deck.length - i));
        const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
      }
      // range rejection for opponent 0 (cheap: re-pick within drawn set is biased; instead resample whole draw)
      if (oppTierMax && tierFn) {
        let tries = 0;
        while (tierFn(deck[0], deck[1]) > oppTierMax && tries < 12) {
          for (let i = 0; i < drawn; i++) {
            const j = i + Math.floor(rng() * (deck.length - i));
            const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
          }
          tries++;
        }
      }
      const fullBoard = board.concat(deck.slice(nOpps * 2, nOpps * 2 + need));
      const heroV = evaluate7(hero.concat(fullBoard));
      let beats = true, ties = 0;
      for (let o = 0; o < nOpps; o++) {
        const ov = evaluate7([deck[o * 2], deck[o * 2 + 1]].concat(fullBoard));
        if (ov > heroV) { beats = false; break; }
        if (ov === heroV) ties++;
      }
      if (beats) score += ties > 0 ? 1 / (ties + 1) : 1;
    }
    return score / rollouts;
  }

  const Engine = {
    mulberry32, RANKS, SUITS, SUIT_NAMES,
    card, rankOf, suitOf, cardStr, parseCard, parseCards,
    freshDeck, shuffled,
    CAT, evaluate5, evaluate7, evaluateN, handName,
    buildPots, awardPots, Hand, equity,
    RANK_NAME, RANK_PLURAL
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else global.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
