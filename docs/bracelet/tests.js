/* THE BRACELET — engine unit tests. Run: node tests.js */
'use strict';
const E = require('./engine.js');

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('FAIL: ' + msg); }
}
function eq(a, b, msg) { ok(a === b, msg + ' (got ' + a + ', want ' + b + ')'); }

const v = (s) => E.evaluateN(E.parseCards(s));
const cat = (val) => Math.floor(val / 0x100000);

// ---------- evaluator: categories ----------
eq(cat(v('As Ks Qs Js Ts')), E.CAT.STRAIGHT_FLUSH, 'royal flush');
eq(cat(v('5h 4h 3h 2h Ah')), E.CAT.STRAIGHT_FLUSH, 'steel wheel');
eq(cat(v('9c 9d 9h 9s 2c')), E.CAT.QUADS, 'quads');
eq(cat(v('9c 9d 9h 2s 2c')), E.CAT.FULL_HOUSE, 'full house');
eq(cat(v('Ks Qs 9s 5s 2s')), E.CAT.FLUSH, 'flush');
eq(cat(v('9c 8d 7h 6s 5c')), E.CAT.STRAIGHT, 'straight');
eq(cat(v('5c 4d 3h 2s Ac')), E.CAT.STRAIGHT, 'wheel straight');
eq(cat(v('9c 9d 9h Ks 2c')), E.CAT.TRIPS, 'trips');
eq(cat(v('9c 9d Kh Ks 2c')), E.CAT.TWO_PAIR, 'two pair');
eq(cat(v('9c 9d Kh Qs 2c')), E.CAT.PAIR, 'pair');
eq(cat(v('9c 8d Kh Qs 2c')), E.CAT.HIGH, 'high card');

// ---------- evaluator: orderings ----------
ok(v('9c 8d 7h 6s 5c') > v('5c 4d 3h 2s Ac'), 'nine-high straight beats wheel');
ok(v('6c 5d 4h 3s 2c') > v('5c 4d 3h 2s Ac'), 'six-high straight beats wheel');
ok(v('Ks Qs 9s 5s 2s') > v('Ac Kd Qh Js Tc'), 'flush beats straight (broadway)');
ok(v('2c 2d 2h 3s 3c') > v('As Ks Qs 9s 5s'), 'full house beats ace-high flush');
ok(v('2c 2d 2h 2s 3c') > v('Ac Ad Ah Ks Kc'), 'quads beat aces-full');
ok(v('5h 4h 3h 2h Ah') > v('Ac Ad Ah As Kc'), 'straight flush beats quad aces');
ok(v('As Ad Kh Ks Qc') > v('As Ad Qh Qs Kc'), 'AAKK beats AAQQ');
ok(v('As Ad Kh Qs Jc') > v('As Ad Kh Qs Tc'), 'kicker: AKQJ beats AKQT');
ok(v('As Ks Qs Js 9s') > v('Ks Qs Js Ts 8s'), 'flush high-card compare');
ok(v('Ah Kd Qc Js 9h') > v('Ah Kd Qc Jс 8h'.replace('с', 's')), 'high card kicker');
eq(v('9c 8d 7h 6s 5c'), v('9s 8h 7d 6c 5h'), 'identical straights tie');
eq(v('Ac Kd 9h 5s 2c'), v('As Kh 9d 5c 2h'), 'identical high cards tie');
ok(v('Tc Td 2h 2s Ac') > v('9c 9d 8h 8s Kc'), 'two pair: high pair dominates');
ok(v('Tc Td 9h 9s 2c') > v('Tc Td 8h 8s Ac'), 'two pair: second pair before kicker');

// ---------- evaluator: best 5 of 7 ----------
{
  // board pairs; hole makes full house
  const val = E.evaluate7(E.parseCards('Ah Ad 8c 8d 8h 2s 3c'));
  eq(cat(val), E.CAT.FULL_HOUSE, '7-card full house');
  // straight on board + flush in hole+board
  const val2 = E.evaluate7(E.parseCards('9h 8h 7c 6c 5c Ac 2c'));
  eq(cat(val2), E.CAT.FLUSH, 'flush found over straight in 7');
  // wheel using ace from hole
  const val3 = E.evaluate7(E.parseCards('Ah Kd 2c 3d 4s 5h 9c'));
  eq(cat(val3), E.CAT.STRAIGHT, 'wheel in 7 cards');
  eq((val3 >> 16) & 0xF, 5, 'wheel is five-high');
  // two trips -> full house
  const val4 = E.evaluate7(E.parseCards('7h 7d 7c 4s 4d 4c Ah'));
  eq(cat(val4), E.CAT.FULL_HOUSE, 'trips+trips = full house');
  eq((val4 >> 16) & 0xF, 7, 'sevens full');
  // six-card straight: pick highest
  const val5 = E.evaluate7(E.parseCards('4h 5d 6c 7s 8d 9c Kh'));
  eq((val5 >> 16) & 0xF, 9, 'nine-high straight from 6-run');
  // counterfeit: board two pair higher
  const val6 = E.evaluate7(E.parseCards('2h 2d Kc Ks Qd Qc 9h'));
  eq(cat(val6), E.CAT.TWO_PAIR, 'best two pair from three pairs');
  eq((val6 >> 16) & 0xF, 13, 'kings up');
  eq((val6 >> 12) & 0xF, 12, 'and queens');
  eq((val6 >> 8) & 0xF, 9, 'nine kicker not the deuce');
}

// ---------- hand names ----------
eq(E.handName(v('Kc Kd 4h 4s 9c')), 'Two Pair, Kings and Fours', 'name: two pair');
eq(E.handName(v('As Ks Qs Js Ts')), 'Royal Flush', 'name: royal');
eq(E.handName(v('5c 4d 3h 2s Ac')), 'Straight, Five high', 'name: wheel');

// ---------- side pots ----------
{
  // simple: 2 players, equal
  const { pots, refund } = E.buildPots([
    { seat: 0, total: 50, folded: false },
    { seat: 1, total: 50, folded: false }]);
  eq(pots.length, 1, '1 pot');
  eq(pots[0].amount, 100, 'pot 100');
  ok(!refund, 'no refund');
}
{
  // uncalled bet refunded
  const { pots, refund } = E.buildPots([
    { seat: 0, total: 80, folded: false },
    { seat: 1, total: 50, folded: false }]);
  eq(refund.seat, 0, 'refund to overbettor');
  eq(refund.amount, 30, 'refund 30');
  eq(pots[0].amount, 100, 'pot 100 after refund');
}
{
  // three-way all-in, different stacks
  const { pots } = E.buildPots([
    { seat: 0, total: 25, folded: false },
    { seat: 1, total: 100, folded: false },
    { seat: 2, total: 60, folded: false }]);
  // refund: seat1 gets 40 back -> totals 25/60/60
  eq(pots.length, 2, 'main + 1 side');
  eq(pots[0].amount, 75, 'main = 25*3');
  eq(pots[0].eligible.length, 3, 'all eligible for main');
  eq(pots[1].amount, 70, 'side = 35*2');
  eq(pots[1].eligible.join(','), '1,2', 'side pot eligibility');
}
{
  // three-way all-in exact + dead money from folder
  const { pots, refund } = E.buildPots([
    { seat: 0, total: 30, folded: false },
    { seat: 1, total: 90, folded: false },
    { seat: 2, total: 90, folded: false },
    { seat: 3, total: 10, folded: true }]);
  ok(!refund, 'no refund when two match top');
  eq(pots.length, 2, 'two pots');
  eq(pots[0].amount, 100, 'main = 30*3 + 10 dead');
  eq(pots[1].amount, 120, 'side = 60*2');
  eq(pots[1].eligible.join(','), '1,2', 'side eligibility excludes short stack');
}
{
  // folder committed more than an all-in layer
  const { pots } = E.buildPots([
    { seat: 0, total: 50, folded: false },   // all-in short
    { seat: 1, total: 100, folded: false },
    { seat: 2, total: 100, folded: true }]); // folded after committing 100
  eq(pots.length, 2, 'main + side with dead money');
  eq(pots[0].amount, 150, 'main = 50*3');
  eq(pots[1].amount, 100, 'side = 50 (p1) + 50 dead (p2)');
  eq(pots[1].eligible.join(','), '1', 'only p1 eligible for side');
}

// ---------- award pots: split + odd chip ----------
{
  const pots = [{ amount: 101, eligible: [0, 2, 4] }];
  const hands = { 0: 500, 2: 500, 4: 100 };
  const awards = E.awardPots(pots, hands, 1, 6); // button seat 1 -> first left is 2
  const bySeat = {}; awards.forEach(a => bySeat[a.seat] = (bySeat[a.seat] || 0) + a.amount);
  eq(bySeat[2], 51, 'odd chip to first seat left of button');
  eq(bySeat[0], 50, 'other winner gets 50');
  ok(!bySeat[4], 'loser gets nothing');
}
{
  // side pots to different winners
  const pots = [
    { amount: 75, eligible: [0, 1, 2] },
    { amount: 70, eligible: [1, 2] }];
  const hands = { 0: 900, 1: 300, 2: 500 };
  const awards = E.awardPots(pots, hands, 0, 6);
  const bySeat = {}; awards.forEach(a => bySeat[a.seat] = (bySeat[a.seat] || 0) + a.amount);
  eq(bySeat[0], 75, 'short stack wins main');
  eq(bySeat[2], 70, 'best of remaining wins side');
  ok(!bySeat[1], 'seat1 wins nothing');
}

// ---------- full hand integration: chip conservation ----------
function playRandomHand(seedNum) {
  const rng = E.mulberry32(seedNum);
  const players = [0, 1, 2, 3, 4, 5].map(s => ({ seat: s, stack: 100 + Math.floor(rng() * 300) }));
  const startTotal = players.reduce((a, p) => a + p.stack, 0);
  const h = new E.Hand({ numSeats: 6, sb: 1, bb: 2, button: seedNum % 6, players, rng });
  let guard = 0;
  while (!h.finished && guard++ < 200) {
    const s = h.currentActor();
    const la = h.legalActions(s);
    const r = rng();
    try {
      if (la.canCheck) {
        if (r < 0.55 || !la.canRaise) h.act(s, { type: 'check' });
        else h.act(s, { type: 'raise', amount: Math.min(la.maxRaiseTo, la.minRaiseTo + Math.floor(rng() * 20)) });
      } else {
        if (r < 0.30) h.act(s, { type: 'fold' });
        else if (r < 0.80 || !la.canRaise) h.act(s, { type: 'call' });
        else {
          const amt = rng() < 0.15 ? la.maxRaiseTo : Math.min(la.maxRaiseTo, la.minRaiseTo + Math.floor(rng() * 30));
          h.act(s, { type: 'raise', amount: amt });
        }
      }
    } catch (e) {
      failed++; console.error('FAIL: illegal action in seeded hand ' + seedNum + ': ' + e.message);
      return;
    }
  }
  ok(h.finished, 'hand ' + seedNum + ' finishes');
  const endTotal = [0, 1, 2, 3, 4, 5].reduce((a, s) => a + h.players[s].stack, 0);
  eq(endTotal, startTotal, 'chips conserved in hand ' + seedNum);
  // winners' awards sum equals losers' losses
  if (h.result && h.result.type === 'showdown') {
    ok(h.result.awards.length >= 1, 'showdown has awards (hand ' + seedNum + ')');
  }
}
for (let i = 1; i <= 400; i++) playRandomHand(i);

// ---------- heads-up hand ----------
{
  const rng = E.mulberry32(7);
  const h = new E.Hand({
    numSeats: 6, sb: 1, bb: 2, button: 0, rng,
    players: [{ seat: 0, stack: 200 }, { seat: 3, stack: 200 }]
  });
  eq(h.sbSeat, 0, 'HU: button is SB');
  eq(h.bbSeat, 3, 'HU: other is BB');
  eq(h.currentActor(), 0, 'HU: button acts first preflop');
  h.act(0, { type: 'call' });
  h.act(3, { type: 'check' });
  eq(h.street, 'flop', 'HU: flop dealt');
  eq(h.currentActor(), 3, 'HU: BB acts first postflop');
}

// ---------- min-raise & short all-in reopen rules ----------
{
  const rng = E.mulberry32(11);
  const h = new E.Hand({
    numSeats: 6, sb: 1, bb: 2, button: 5, rng,
    players: [
      { seat: 0, stack: 200 }, { seat: 1, stack: 200 }, { seat: 2, stack: 200 },
      { seat: 3, stack: 200 }, { seat: 4, stack: 7 }, { seat: 5, stack: 200 }]
  });
  // sb=0, bb=1, first actor = 2
  eq(h.currentActor(), 2, 'UTG first');
  let la = h.legalActions(2);
  eq(la.minRaiseTo, 4, 'preflop min raise-to = 4');
  h.act(2, { type: 'raise', amount: 6 });     // full raise, size 4
  la = h.legalActions(3);
  eq(la.minRaiseTo, 10, 'min re-raise-to = 10');
  h.act(3, { type: 'call' });
  h.act(4, { type: 'raise', amount: 7 });     // short all-in (raise size 1 < 4)
  la = h.legalActions(5);
  ok(la.canRaise, 'unacted player may still raise after short all-in');
  eq(la.minRaiseTo, 11, 'min raise after short all-in = 7+4');
  h.act(5, { type: 'fold' });
  h.act(0, { type: 'fold' });
  h.act(1, { type: 'fold' });
  la = h.legalActions(2);
  ok(!la.canRaise, 'original raiser cannot re-raise after short all-in only');
  eq(la.toCall, 1, 'facing 1 more');
  h.act(2, { type: 'call' });
  la = h.legalActions(3);
  ok(!la.canRaise, 'caller cannot raise after short all-in only');
  h.act(3, { type: 'call' });
  ok(!h.finished || h.finished, 'progressed');
  eq(h.street === 'preflop' ? 'no' : 'yes', 'yes', 'street advanced after calls');
}

// ---------- three-way all-in through engine ----------
{
  const deck = E.freshDeck(); // deterministic deck: deal order known? use explicit deck
  // Construct explicit deck so we control holes+board.
  // Deal order: seats after button(5): 0,1,2 then repeat; pops from END of deck array.
  // players seats 0,1,2; button 2 => HU? no, 3 players, button=2, sb=0, bb=1, first=2
  // Hole deal order: ring from button+1 = [0,1,2] then again.
  // deck.pop() gives last element: build stack so pops yield desired.
  const want = {
    holes: { 0: E.parseCards('As Ad'), 1: E.parseCards('Ks Kd'), 2: E.parseCards('Qs Qd') },
    board: E.parseCards('2c 7d 9h Jc 3s')
  };
  const pops = [want.holes[0][0], want.holes[1][0], want.holes[2][0],
                want.holes[0][1], want.holes[1][1], want.holes[2][1],
                ...want.board];
  const stack = pops.slice().reverse(); // pop() returns last
  const h = new E.Hand({
    numSeats: 6, sb: 1, bb: 2, button: 2, rng: Math.random, deck: stack,
    players: [{ seat: 0, stack: 40 }, { seat: 1, stack: 100 }, { seat: 2, stack: 160 }]
  });
  eq(h.currentActor(), 2, 'button acts first 3-way preflop');
  h.act(2, { type: 'raise', amount: 160 }); // shove covering
  h.act(0, { type: 'call' });               // all-in 40
  h.act(1, { type: 'call' });               // all-in 100
  ok(h.finished, 'runout to showdown');
  eq(h.result.type, 'showdown', 'showdown result');
  eq(h.result.refund.seat, 2, 'seat2 uncalled 60 back');
  eq(h.result.refund.amount, 60, 'refund amount 60');
  eq(h.result.pots.length, 2, 'main + side');
  eq(h.result.pots[0].amount, 120, 'main 40*3');
  eq(h.result.pots[1].amount, 120, 'side 60*2');
  // AA wins main, KK wins side
  eq(h.players[0].stack, 120, 'AA: wins main 120');
  eq(h.players[1].stack, 120, 'KK: wins side 120');
  eq(h.players[2].stack, 60, 'QQ: refund only');
  const total = h.players[0].stack + h.players[1].stack + h.players[2].stack;
  eq(total, 300, 'chips conserved 3-way all-in');
}

// ---------- split pot through engine ----------
{
  const want = {
    holes: { 0: E.parseCards('Ah Kh'), 1: E.parseCards('Ac Kc') },
    board: E.parseCards('As Kd 9h 3c 2s')
  };
  const pops = [want.holes[0][0], want.holes[1][0],
                want.holes[0][1], want.holes[1][1], ...want.board];
  const stack = pops.slice().reverse();
  const h = new E.Hand({
    numSeats: 6, sb: 1, bb: 2, button: 1, rng: Math.random, deck: stack,
    players: [{ seat: 0, stack: 200 }, { seat: 1, stack: 200 }]
  });
  // HU: button(1)=SB acts first. Deal ring from button+1: [0,1] — holes as wanted.
  h.act(1, { type: 'raise', amount: 20 });
  h.act(0, { type: 'call' });
  h.act(0, { type: 'check' }); h.act(1, { type: 'check' }); // flop
  h.act(0, { type: 'check' }); h.act(1, { type: 'check' }); // turn
  h.act(0, { type: 'check' }); h.act(1, { type: 'check' }); // river
  ok(h.finished, 'split hand finished');
  eq(h.players[0].stack, 200, 'split: p0 even');
  eq(h.players[1].stack, 200, 'split: p1 even');
}

// ---------- equity sanity ----------
{
  const rng = E.mulberry32(42);
  const eqAA = E.equity(E.parseCards('As Ad'), [], 1, 400, rng);
  ok(eqAA > 0.78 && eqAA < 0.92, 'AA preflop HU equity ~85% (got ' + eqAA.toFixed(3) + ')');
  const eq72 = E.equity(E.parseCards('7s 2d'), [], 1, 400, rng);
  ok(eq72 > 0.25 && eq72 < 0.45, '72o preflop HU equity ~35% (got ' + eq72.toFixed(3) + ')');
  const nutFlop = E.equity(E.parseCards('As Ks'), E.parseCards('Qs Js Ts'), 2, 300, rng);
  ok(nutFlop > 0.9, 'royal on flop ~100% (got ' + nutFlop.toFixed(3) + ')');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
