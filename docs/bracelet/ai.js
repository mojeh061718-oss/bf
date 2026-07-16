/* ============================================================
   THE BRACELET — villain AI
   Layer 1: position-aware preflop tiers + MC-equity postflop
   Layer 2: personality bias + authored leaks
   Layer 3: Rosa adapts to the player's observed aggression
   Timing is characterization: every decision returns thinkMs.
   ============================================================ */
(function (global) {
  'use strict';
  const E = (typeof module !== 'undefined' && module.exports)
    ? require('./engine.js') : global.Engine;

  // ---------- preflop hand tiers (1 = premium ... 9 = junk) ----------
  function handTier(c1, c2) {
    let r1 = E.rankOf(c1), r2 = E.rankOf(c2);
    if (r1 < r2) { const t = r1; r1 = r2; r2 = t; }
    const suited = E.suitOf(c1) === E.suitOf(c2);
    const gap = r1 - r2;

    if (r1 === r2) { // pairs
      if (r1 >= 12) return 1;        // QQ+
      if (r1 >= 10) return 2;        // TT JJ
      if (r1 >= 8) return 3;         // 88 99
      if (r1 >= 6) return 4;         // 66 77
      return 5;                      // 22-55
    }
    if (r1 === 14) { // ace-high
      if (r2 === 13) return suited ? 1 : 2;             // AK
      if (r2 === 12) return suited ? 2 : 3;             // AQ
      if (r2 === 11) return suited ? 3 : 4;             // AJ
      if (r2 === 10) return suited ? 3 : 5;             // AT
      return suited ? 5 : 7;                            // Ax
    }
    if (r1 === 13) { // king-high
      if (r2 === 12) return suited ? 3 : 4;             // KQ
      if (r2 === 11) return suited ? 4 : 5;             // KJ
      if (r2 === 10) return suited ? 5 : 6;             // KT
      return suited ? 6 : 8;
    }
    if (r1 === 12) {
      if (r2 === 11) return suited ? 4 : 5;             // QJ
      if (r2 === 10) return suited ? 5 : 6;             // QT
      return suited ? 7 : 8;
    }
    if (r1 === 11 && r2 === 10) return suited ? 4 : 6;  // JT
    // suited connectors / one-gappers
    if (suited && gap === 1 && r1 >= 6) return 5;       // 98s..54s-ish
    if (suited && gap === 1) return 6;
    if (suited && gap === 2 && r1 >= 8) return 6;
    if (!suited && gap === 1 && r1 >= 10) return 7;     // JTo T9o
    if (suited) return 8;
    return 9;
  }

  // position labels around a 6-max ring given button seat and active seats
  // returns map seat -> 'EP'|'MP'|'CO'|'BTN'|'SB'|'BB'
  function positions(hand) {
    const map = {};
    const order = hand._ringFrom(hand.button, 1); // sb, bb, ..., btn (last)
    const n = order.length;
    if (n === 2) { map[hand.sbSeat] = 'BTN'; map[hand.bbSeat] = 'BB'; return map; }
    map[hand.sbSeat] = 'SB'; map[hand.bbSeat] = 'BB';
    const rest = order.filter(s => s !== hand.sbSeat && s !== hand.bbSeat);
    // rest runs UTG..BTN
    const labels = { 1: ['BTN'], 2: ['CO', 'BTN'], 3: ['MP', 'CO', 'BTN'], 4: ['EP', 'MP', 'CO', 'BTN'] };
    const ls = labels[rest.length] || rest.map(() => 'MP');
    rest.forEach((s, i) => map[s] = ls[i]);
    return map;
  }

  const POS_OPEN = { EP: 3, MP: 4, CO: 5, BTN: 6, SB: 5, BB: 5 };   // max tier to open-raise
  const POS_CALL = { EP: 4, MP: 5, CO: 5, BTN: 6, SB: 5, BB: 6 };   // max tier to call a raise
  const POS_3BET = { EP: 1, MP: 1, CO: 2, BTN: 2, SB: 1, BB: 2 };   // max tier to 3-bet

  // ---------- personalities ----------
  // tierShift: + = looser. agg: postflop aggression multiplier.
  const PERSONALITIES = {
    deke: {
      key: 'deke', name: 'Deke the Rock', short: 'Deke',
      blurb: 'Retired mailman. Owns one facial expression.',
      tierShift: { open: -1.6, call: -2, threebet: 0 },
      agg: 0.45, bluffFreq: 0.01, cbetFreq: 0.45,
      callLoose: 0.85,           // <1 = folds more than pot odds say
      sizings: [0.5, 0.65],
      limpy: 0.15,
      leaks: ['foldsRiverRaise', 'tanksWithMonsters'],
      timing: (ctx, rnd) => {
        // TELL: tanks long before betting big hands; folds/checks fast
        if ((ctx.action === 'raise' || ctx.action === 'bet') && ctx.strong) return 2100 + rnd() * 500;
        if (ctx.action === 'fold') return 350 + rnd() * 300;
        return 750 + rnd() * 450;
      }
    },
    tilly: {
      key: 'tilly', name: 'Tilly', short: 'Tilly',
      blurb: 'Runs a food truck. Raises like she’s double-parked.',
      tierShift: { open: 3, call: 2.5, threebet: 3 },
      agg: 2.1, bluffFreq: 0.34, cbetFreq: 0.92,
      callLoose: 1.15,
      sizings: [0.66, 1.0, 1.5],  // pot and overbets
      limpy: 0,
      leaks: ['tripleBarrels', 'snapBluffs'],
      timing: (ctx, rnd) => {
        // TELL: snap-raises when bluffing, pauses with monsters
        if ((ctx.action === 'raise' || ctx.action === 'bet') && ctx.bluffing) return 260 + rnd() * 180;
        if ((ctx.action === 'raise' || ctx.action === 'bet') && ctx.strong) return 1700 + rnd() * 600;
        return 480 + rnd() * 350;
      }
    },
    stan: {
      key: 'stan', name: 'Stan the Station', short: 'Stan',
      blurb: 'Firehouse cook. Has never met a draw he didn’t like.',
      tierShift: { open: 0.5, call: 3, threebet: -1 },
      agg: 0.25, bluffFreq: 0.0, cbetFreq: 0.35,
      callLoose: 1.7,             // calls way too wide
      sizings: [0.5],
      limpy: 0.8,
      leaks: ['neverRaisesWithoutNuts', 'callsAnyPair'],
      timing: (ctx, rnd) => {
        // Calls quickly; the rare raise comes slower (it's the nuts)
        if (ctx.action === 'raise' || ctx.action === 'bet') return 1150 + rnd() * 500;
        if (ctx.action === 'call') return 420 + rnd() * 300;
        return 650 + rnd() * 400;
      }
    },
    rosa: {
      key: 'rosa', name: 'Rosa', short: 'Rosa',
      blurb: 'Night-shift nurse. Counts your bets while you talk.',
      tierShift: { open: 0.5, call: 0, threebet: 0.5 },
      agg: 1.0, bluffFreq: 0.12, cbetFreq: 0.68,
      callLoose: 1.0,
      sizings: [0.5, 0.66, 0.75],
      limpy: 0,
      leaks: [],
      adapts: true,
      timing: (ctx, rnd) => 700 + rnd() * 600 // balanced — no timing tell
    },
    nick: {
      key: 'nick', name: 'Nervous Nick', short: 'Nick',
      blurb: 'Marco’s nephew. Playing with rent money, probably.',
      tierShift: { open: -0.5, call: -1, threebet: -0.5 },
      agg: 0.5, bluffFreq: 0.03, cbetFreq: 0.5,
      callLoose: 0.6,             // scared money: folds to pressure
      sizings: [0.4, 0.5],
      limpy: 0.65,
      leaks: ['foldsToPressure', 'limpsEverything'],
      timing: (ctx, rnd) => {
        // TELL: visibly reluctant calls; quick folds under pressure
        if (ctx.action === 'call' && ctx.reluctant) return 2200 + rnd() * 400;
        if (ctx.action === 'fold') return 500 + rnd() * 400;
        return 800 + rnd() * 500;
      }
    }
  };

  // ---------- decision ----------
  // ctx: {hand, seat, persona, playerModel, rng}
  // playerModel: {aggRatio, shownBluffs, handsSeen}  (about the human, for Rosa)
  // returns {action:{type, amount?}, thinkMs, tellCtx}
  function decide(hand, seat, persona, playerModel, rng) {
    rng = rng || Math.random;
    const p = hand.players[seat];
    const la = hand.legalActions(seat);
    const street = hand.street;
    const pot = hand.pot;
    const isPre = street === 'preflop';
    const liveOpps = hand.livePlayers().filter(s => s !== seat).length;

    let decision;
    if (isPre) decision = decidePreflop(hand, seat, persona, playerModel, rng, la);
    else decision = decidePostflop(hand, seat, persona, playerModel, rng, la, liveOpps);

    // safety: legality clamp
    decision = clampLegal(decision, la);

    const ctx = {
      action: decision.type === 'raise' ? (la.toCall > 0 ? 'raise' : 'bet') : decision.type,
      strong: decision._strong || false,
      bluffing: decision._bluff || false,
      reluctant: decision._reluctant || false
    };
    const thinkMs = Math.max(250, Math.min(2500, persona.timing(ctx, rng)));
    return { action: { type: decision.type, amount: decision.amount }, thinkMs, tellCtx: ctx };
  }

  function clampLegal(d, la) {
    if (d.type === 'check' && !la.canCheck) return { type: 'fold' };
    if (d.type === 'raise') {
      if (!la.canRaise) return { type: la.toCall > 0 ? 'call' : 'check' };
      let amt = Math.round(d.amount || la.minRaiseTo);
      if (amt >= la.maxRaiseTo) amt = la.maxRaiseTo;
      else if (amt < la.minRaiseTo) amt = la.minRaiseTo;
      return Object.assign({}, d, { amount: amt });
    }
    if (d.type === 'call' && la.toCall === 0) return Object.assign({}, d, { type: 'check' });
    if (d.type === 'fold' && la.canCheck) return { type: 'check' };
    return d;
  }

  function decidePreflop(hand, seat, persona, playerModel, rng, la) {
    const p = hand.players[seat];
    const tier = handTier(p.hole[0], p.hole[1]);
    const pos = positions(hand)[seat] || 'MP';
    const raised = hand.currentBet > hand.bb;               // facing a raise
    const openTh = POS_OPEN[pos] + persona.tierShift.open;
    const callTh = POS_CALL[pos] + persona.tierShift.call;
    const tbTh = POS_3BET[pos] + persona.tierShift.threebet;
    const noise = rng() * 0.9 - 0.45;                        // organic edges

    if (!raised) {
      // unopened (or limps ahead)
      if (tier <= tbTh + 0.2 || tier + noise <= openTh - 1.5) {
        // strong open
        if (persona.limpy > 0.5 && tier > 2 && rng() < persona.limpy) {
          return { type: la.canCheck ? 'check' : 'call' };  // limp
        }
        const to = Math.round(hand.bb * (2.5 + rng() * 1.5) + hand.currentBet - hand.bb);
        return { type: 'raise', amount: Math.max(la.minRaiseTo, to), _strong: tier <= 2 };
      }
      if (tier + noise <= openTh) {
        if (persona.limpy > 0 && rng() < persona.limpy)
          return { type: la.canCheck ? 'check' : 'call' };
        if (rng() < 0.75) {
          const to = Math.round(hand.bb * (2.2 + rng() * 1.3));
          return { type: 'raise', amount: Math.max(la.minRaiseTo, to) };
        }
        return { type: la.canCheck ? 'check' : 'call' };
      }
      // Tilly raise-bluffs junk sometimes
      if (persona.bluffFreq > 0.2 && rng() < persona.bluffFreq * 0.5 && la.canRaise) {
        return { type: 'raise', amount: la.minRaiseTo + Math.round(rng() * 2 * hand.bb), _bluff: true };
      }
      if (la.canCheck) return { type: 'check' };
      // cheap completes from SB with playable stuff
      if (la.toCall <= hand.bb && tier <= callTh + 1) return { type: 'call' };
      return { type: 'fold' };
    }

    // facing a raise
    const toCall = la.toCall;
    const bigRaise = toCall > hand.bb * 4;
    if (tier <= tbTh + (rng() < 0.5 ? 0 : 0.6)) {
      // 3-bet / shove-ish
      if (la.canRaise) {
        const to = Math.round(hand.currentBet * (2.6 + rng() * 0.8));
        return { type: 'raise', amount: Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, to)), _strong: true };
      }
      return { type: 'call', _strong: true };
    }
    let effCallTh = callTh - (bigRaise ? 1.5 : 0);
    // Stan calls anything reasonable; Nick needs real hands vs pressure
    if (persona.key === 'stan' && toCall <= p.stack * 0.2) effCallTh = Math.max(effCallTh, 7);
    if (persona.key === 'nick' && bigRaise) effCallTh -= 1;
    if (tier + noise <= effCallTh) {
      return { type: 'call', _reluctant: persona.key === 'nick' && toCall > hand.bb * 3 };
    }
    // Tilly 3-bet bluff
    if (persona.bluffFreq > 0.2 && rng() < persona.bluffFreq * 0.6 && la.canRaise) {
      const to = Math.round(hand.currentBet * (2.5 + rng()));
      return { type: 'raise', amount: Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, to)), _bluff: true };
    }
    if (la.canCheck) return { type: 'check' };
    return { type: 'fold' };
  }

  function decidePostflop(hand, seat, persona, playerModel, rng, la, liveOpps) {
    const p = hand.players[seat];
    const pot = hand.pot;
    const toCall = la.toCall;

    // Was there a preflop raise by an opponent? tighten modeled range.
    const oppRaisedPre = hand.log.some(e => e.street === 'preflop' && e.type === 'raise' && e.seat !== seat);
    const rangeTier = oppRaisedPre ? 6 : 8;
    const nOpps = Math.min(liveOpps, 3);
    const rolls = 220;
    const eqty = E.equity(p.hole, hand.board, nOpps, rolls, rng, rangeTier, handTier);

    const strong = eqty > 0.78;
    const decent = eqty > 0.55;
    const streetN = hand.streetIdx; // 1 flop 2 turn 3 river

    // Rosa adaptation: if the player has shown bluffs / high aggression, call wider vs THEM
    let callLoose = persona.callLoose;
    if (persona.adapts && playerModel) {
      const lastAggressorSeat = lastAggressor(hand);
      if (lastAggressorSeat === 0) { // human is seat 0 by convention
        if (playerModel.shownBluffs >= 2 || playerModel.aggRatio > 2.2) callLoose *= 1.3;
        else if (playerModel.aggRatio < 0.8 && playerModel.handsSeen > 12) callLoose *= 0.8;
      }
    }

    // ---- no bet to face ----
    if (toCall === 0) {
      // c-bet logic: was I the preflop/last-street aggressor?
      const iWasAggressor = lastAggressor(hand, true) === seat;
      let betChance = 0;
      if (strong) betChance = 0.85 * Math.min(1.6, persona.agg + 0.6);
      else if (decent) betChance = 0.45 * persona.agg;
      else if (iWasAggressor) betChance = persona.cbetFreq * (streetN === 1 ? 1 : streetN === 2 ? 0.75 : 0.55);
      else betChance = persona.bluffFreq;
      // Tilly triple-barrels
      if (persona.leaks.includes('tripleBarrels') && iWasAggressor) betChance = Math.max(betChance, 0.8);
      // Stan almost never bets without the goods
      if (persona.leaks.includes('neverRaisesWithoutNuts') && eqty < 0.85) betChance = Math.min(betChance, 0.12);
      // Deke never bluffs
      if (persona.bluffFreq < 0.05 && !decent) betChance = Math.min(betChance, 0.05);

      if (rng() < betChance && la.canRaise) {
        const isBluff = eqty < 0.45;
        const size = pickSize(persona, rng, strong);
        const amt = Math.round(Math.max(hand.bb, pot * size)) + p.committed;
        return { type: 'raise', amount: amt, _strong: strong, _bluff: isBluff };
      }
      return { type: 'check' };
    }

    // ---- facing a bet ----
    const potOdds = toCall / (pot + toCall);
    const need = potOdds / callLoose;

    // leak: Deke folds rivers to raises/bets when not strong
    if (persona.leaks.includes('foldsRiverRaise') && streetN === 3 && !strong) {
      if (eqty < 0.86) return { type: 'fold' };
    }
    // leak: Nick folds to pressure
    if (persona.leaks.includes('foldsToPressure')) {
      const pressure = toCall > pot * 0.45 || toCall > p.stack * 0.3;
      if (pressure && eqty < 0.72) return { type: 'fold' };
    }
    // leak: Stan calls with any pair or draw
    if (persona.leaks.includes('callsAnyPair')) {
      if (hasPairOrDraw(p.hole, hand.board) && toCall <= p.stack * 0.5 && toCall <= pot * 1.2) {
        if (eqty > 0.88 && la.canRaise && rng() < 0.7) {
          // Stan raise = the nuts
          const amt = Math.round(pot * 0.8) + p.committed + toCall;
          return { type: 'raise', amount: amt, _strong: true };
        }
        return { type: 'call' };
      }
    }

    // raise with strong hands (frequency by aggression)
    if (strong && la.canRaise) {
      let rFreq = 0.35 * persona.agg + (eqty > 0.9 ? 0.3 : 0);
      if (persona.leaks.includes('neverRaisesWithoutNuts')) rFreq = eqty > 0.9 ? 0.6 : 0.05;
      if (rng() < rFreq) {
        const size = pickSize(persona, rng, true);
        const amt = Math.round((pot + toCall) * (0.7 + size * 0.6)) + p.committed + toCall;
        return { type: 'raise', amount: amt, _strong: true };
      }
    }
    // bluff-raise (Tilly)
    if (!decent && persona.bluffFreq > 0.2 && la.canRaise && rng() < persona.bluffFreq * (streetN === 3 ? 0.7 : 1)) {
      const amt = Math.round((pot + toCall) * 1.1) + p.committed + toCall;
      return { type: 'raise', amount: amt, _bluff: true };
    }

    if (eqty >= need || (eqty >= need * 0.85 && rng() < 0.3)) {
      const reluctant = persona.key === 'nick' || (eqty < need * 1.15 && toCall > pot * 0.4);
      return { type: 'call', _strong: strong, _reluctant: reluctant };
    }
    return { type: 'fold' };
  }

  function pickSize(persona, rng, strong) {
    const menu = persona.sizings;
    let s = menu[Math.floor(rng() * menu.length)];
    if (strong && persona.key === 'tilly' && rng() < 0.4) s = 1.4; // overbet monsters too (balanced-ish chaos)
    return s;
  }

  function lastAggressor(hand, includePrevStreets) {
    for (let i = hand.log.length - 1; i >= 0; i--) {
      const e = hand.log[i];
      if (!includePrevStreets && e.street !== hand.street) break;
      if (e.type === 'raise') return e.seat;
    }
    return null;
  }

  function hasPairOrDraw(hole, board) {
    const all = hole.concat(board);
    const v = E.evaluateN(all.length >= 5 ? all : all.concat()); // <5 shouldn't happen postflop
    if (Math.floor(v / 0x100000) >= E.CAT.PAIR) {
      // require hole card involvement OR any pair at all (Stan doesn't care)
      return true;
    }
    // flush draw?
    const suitCount = [0, 0, 0, 0];
    for (const c of all) suitCount[E.suitOf(c)]++;
    if (suitCount.some(n => n === 4)) return true;
    // open-ended-ish straight draw: 4 ranks within a 5-window
    const ranks = [...new Set(all.map(E.rankOf))].sort((a, b) => a - b);
    if (ranks.includes(14)) ranks.unshift(1);
    for (let i = 0; i + 3 < ranks.length; i++)
      if (ranks[i + 3] - ranks[i] <= 4) return true;
    return false;
  }

  const AI = { handTier, positions, PERSONALITIES, decide, POS_OPEN };
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
  else global.AI = AI;
})(typeof window !== 'undefined' ? window : globalThis);
