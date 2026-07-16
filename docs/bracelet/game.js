/* ============================================================
   THE BRACELET — The Kitchen Game controller
   ============================================================ */
(function (global) {
  'use strict';
  const E = global.Engine, AI = global.AI, UI = global.UI, SFX = global.SFX;
  const $ = UI.$;

  // seat 0 = the player
  const CHARS = [
    { key: 'you', name: 'You', short: 'You' },
    { key: 'nick', name: 'Nervous Nick', short: 'Nick' },
    { key: 'deke', name: 'Deke the Rock', short: 'Deke' },
    { key: 'stan', name: 'Stan the Station', short: 'Stan' },
    { key: 'rosa', name: 'Rosa', short: 'Rosa' },
    { key: 'tilly', name: 'Tilly', short: 'Tilly' }
  ];
  const VILLAIN_SEATS = [1, 2, 3, 4, 5];
  const START_STACK = 200, GOAL = 400, SB = 1, BB = 2;

  global.GAME_SPEED = 1;

  const G = {
    stacks: [], button: 5, handNum: 0, running: false, over: false,
    seedBase: 0, rng: null,
    notebook: {}, playerModel: null, session: null,
    betsShown: [], shownBoardLen: 0, holesRevealed: new Set(),
    newNote: false
  };

  // ---------------- notebook model ----------------
  function freshNotebook() {
    const nb = {};
    for (const s of VILLAIN_SEATS) {
      nb[s] = {
        seat: s, key: CHARS[s].key,
        hands: 0, vpip: 0, raises: 0, calls: 0,
        riverFoldChances: 0, riverFolds: 0,
        pressureFoldChances: 0, pressureFolds: 0,
        stanRaises: 0, snapRaiseBluffs: 0, snapRaises: 0,
        tankBets: 0, tankBetStrong: 0,
        reluctantCalls: 0,
        showdowns: [], notes: []
      };
    }
    return nb;
  }

  function addNote(seat, id, text, hot) {
    const v = G.notebook[seat];
    if (v.notes.some(n => n.id === id)) {
      const n = v.notes.find(n => n.id === id);
      n.text = text; n.hot = hot;
      return;
    }
    v.notes.push({ id, text, hot: !!hot });
    G.newNote = true;
    $('#btn-book').classList.add('hasnew');
  }

  function refreshAutoNotes() {
    for (const s of VILLAIN_SEATS) {
      const v = G.notebook[s];
      const vp = v.hands ? Math.round(100 * v.vpip / v.hands) : 0;
      if (v.hands >= 12) {
        if (v.key === 'deke') addNote(s, 'vp', 'Plays about ' + vp + '% of hands. Tight as a bank vault. If he’s in, he’s got cards.');
        if (v.key === 'tilly') addNote(s, 'vp', 'In ' + vp + '% of pots. She cannot help herself — wait for a real hand and let her bluff into you.', vp > 45);
        if (v.key === 'stan') addNote(s, 'vp', 'Calls ' + vp + '% of hands and never lets go. Don’t bluff Stan. Value-bet him forever.', true);
        if (v.key === 'rosa') addNote(s, 'vp', 'Solid ' + vp + '%. Plays position, picks spots. She’s watching how I play, too.');
        if (v.key === 'nick') addNote(s, 'vp', 'Limps in ' + vp + '% then wilts. Scared money.');
      }
      if (v.key === 'deke' && v.riverFoldChances >= 2 && v.riverFolds === v.riverFoldChances)
        addNote(s, 'riverfold', 'Deke has folded to every river bet or raise — ' + v.riverFolds + '/' + v.riverFoldChances + '. Fire at him on the end.', true);
      if (v.key === 'deke' && v.tankBetStrong >= 2)
        addNote(s, 'tank', 'When Deke goes quiet for a long time and THEN bets — he’s got it. ' + v.tankBetStrong + ' for ' + v.tankBets + ' at showdown.', true);
      if (v.key === 'tilly' && v.snapRaiseBluffs >= 2)
        addNote(s, 'snap', 'Tilly’s instant raises keep showing up as bluffs (' + v.snapRaiseBluffs + ' so far). When she pauses first — run.', true);
      if (v.key === 'stan' && v.stanRaises >= 1)
        addNote(s, 'nuts', 'Stan has raised ' + v.stanRaises + ' time' + (v.stanRaises > 1 ? 's' : '') + ' all night. Stan raising = the nuts. Just fold.', true);
      if (v.key === 'nick' && v.pressureFoldChances >= 3 && v.pressureFolds / v.pressureFoldChances > 0.65)
        addNote(s, 'pressure', 'Nick folds to big bets — ' + v.pressureFolds + '/' + v.pressureFoldChances + ' when the heat came. Push him off pots.', true);
      if (v.key === 'nick' && v.reluctantCalls >= 2)
        addNote(s, 'reluctant', 'Those long, painful calls of his? He’s never bluffing after one. He has SOMETHING.');
      if (v.key === 'rosa' && v.hands >= 15)
        addNote(s, 'adapt', 'No patterns from Rosa, no timing tells. She adjusts to me — the notebook works both ways with this one.');
    }
  }

  // ---------------- session stats ----------------
  function freshSession() {
    return { hands: 0, vpip: 0, biggestPot: 0, showdownsWon: 0, bestHand: null, bestHandVal: -1 };
  }

  // ---------------- game setup ----------------
  function newGame() {
    G.stacks = [START_STACK, START_STACK, START_STACK, START_STACK, START_STACK, START_STACK];
    G.button = Math.floor(Math.random() * 6);
    G.handNum = 0;
    G.over = false;
    G.seedBase = (Date.now() ^ (Math.random() * 0xFFFFFFF)) >>> 0;
    G.notebook = freshNotebook();
    G.playerModel = { handsSeen: 0, aggActs: 0, callActs: 0, shownBluffs: 0, aggRatio: 1 };
    G.session = freshSession();
    $('#btn-book').classList.remove('hasnew');
    for (let i = 0; i < 6; i++) {
      UI.setStack(i, G.stacks[i]);
      UI.setSeatState(i, 'busted', false);
      UI.setSeatState(i, 'folded', false);
      UI.setHoles(i, 'none');
      UI.setBet(i, 0);
    }
    UI.clearBoard();
    UI.clearHero();
    UI.setPot(0);
    UI.setHandStrength(null);
    UI.ticker('Marco’s garage. Tuesday night. Blinds $1/$2 — first to $' + GOAL + ' walks.');
  }

  function activeSeats() {
    return [0, 1, 2, 3, 4, 5].filter(s => G.stacks[s] > 0);
  }
  function nextButton() {
    for (let i = 1; i <= 6; i++) {
      const s = (G.button + i) % 6;
      if (G.stacks[s] > 0) return s;
    }
    return G.button;
  }

  // ---------------- hand lifecycle ----------------
  async function playHand() {
    const seats = activeSeats();
    G.handNum++;
    G.button = nextButton();
    const seed = (G.seedBase + G.handNum * 7919) >>> 0;
    const rng = E.mulberry32(seed);
    G.rng = rng;
    const hand = new E.Hand({
      numSeats: 6, sb: SB, bb: BB, button: G.button,
      players: seats.map(s => ({ seat: s, stack: G.stacks[s] })),
      rng
    });
    G.hand = hand;
    G.betsShown = [0, 0, 0, 0, 0, 0];
    G.shownBoardLen = 0;
    G.holesRevealed = new Set();
    G.timingObs = [];
    G.playerVpiped = false;
    G.droneOn = false;

    // --- UI reset ---
    UI.clearSeatStates();
    UI.clearBoard();
    UI.clearHero();
    UI.setPot(0);
    UI.setHandStrength(null);
    for (let i = 0; i < 6; i++) { UI.setBet(i, 0); UI.setHoles(i, 'none'); }
    UI.moveDealer(G.button);
    $('#hand-num').textContent = 'Hand #' + G.handNum;
    $('#seed-label').textContent = 'seed ' + seed.toString(16);
    await wait(350);

    // --- blinds ---
    for (const s of [hand.sbSeat, hand.bbSeat]) {
      G.betsShown[s] = hand.players[s].committed;
      UI.setBet(s, G.betsShown[s]);
      UI.setStack(s, hand.players[s].stack);
    }
    SFX.chips(BB);
    const postVerb = (s) => s === 0 ? 'You post' : CHARS[s].short + ' posts';
    UI.ticker(postVerb(hand.sbSeat) + ' $' + SB + ', ' + postVerb(hand.bbSeat) + ' $' + BB);
    await wait(250);

    // --- deal animation ---
    const dbtn = $('#dealer-btn');
    for (const s of hand.seats) {
      if (s === 0) continue;
      UI.flyCard(dbtn, $('#seat-' + s + ' .avatar'), 260);
      SFX.cardSlide();
      await wait(110);
      UI.setHoles(s, 'back');
    }
    await UI.dealHero(hand.players[0] ? hand.players[0].hole : []);
    updateHeroStrength();

    // --- action loop ---
    let safety = 0;
    while (!hand.finished && safety++ < 300) {
      await reconcileStreet();
      if (hand.finished) break;
      const actor = hand.currentActor();
      if (actor === null) { await wait(50); continue; }
      if (actor === 0) await humanTurn();
      else await aiTurn(actor);
      if (G.over) return;
    }
    await reconcileStreet(); // sweep last street bets
    await finishHand();
  }

  // sweep bets & deal any newly available board cards
  async function reconcileStreet() {
    const hand = G.hand;
    const target = hand.board.length;
    if (target === G.shownBoardLen && !hand.finished) return;
    // sweep bets into pot if any shown
    if (G.betsShown.some(b => b > 0)) {
      await sweepBets();
    }
    // deal missing board cards (during live play; the all-in runout is handled in finishHand)
    if (!hand.finished) {
      await dealBoardTo(target, false);
    }
  }

  async function sweepBets() {
    const hand = G.hand;
    const potNode = $('#pot-area');
    UI.setPot(potTotalShownSafe());
    const proms = [];
    for (let s = 0; s < 6; s++) {
      if (G.betsShown[s] > 0) {
        proms.push(UI.flyChip($('#bet-' + s), potNode, G.betsShown[s], 380));
        G.betsShown[s] = 0;
        UI.setBet(s, 0);
      }
    }
    SFX.chips(hand.pot);
    await Promise.race([Promise.all(proms), wait(420)]);
    UI.setPot(hand.finished ? potFromResult() : hand.potBeforeStreet);
    UI.bumpPot();
  }
  function potTotalShownSafe() {
    const hand = G.hand;
    return hand.finished ? potFromResult() : hand.potBeforeStreet;
  }
  function potFromResult() {
    const r = G.hand.result;
    if (!r) return 0;
    return r.pots.reduce((a, p) => a + p.amount, 0);
  }

  async function dealBoardTo(n, slow) {
    const hand = G.hand;
    while (G.shownBoardLen < n) {
      const i = G.shownBoardLen;
      // flop: 3 quick; turn/river: single
      await UI.dealBoardCard(i, hand.board[i], true);
      G.shownBoardLen++;
      const isStreetEnd = (G.shownBoardLen === 3 || G.shownBoardLen === 4 || G.shownBoardLen === 5);
      await wait(G.shownBoardLen <= 3 ? 160 : 220);
      if (slow && isStreetEnd && G.shownBoardLen < n) await wait(900);
    }
    updateHeroStrength();
    if (n >= 3 && !hand.finished) {
      const names = ['', '', '', 'Flop', 'Turn', 'River'];
      UI.ticker(names[Math.min(n, 5)] + ': ' + hand.board.slice(0, n).map(E.cardStr).join(' '));
    }
  }

  function updateHeroStrength() {
    const hand = G.hand;
    if (!hand || !hand.players[0] || hand.players[0].folded) { UI.setHandStrength(null); return; }
    const hole = hand.players[0].hole;
    if (!hole) return;
    const board = hand.board.slice(0, G.shownBoardLen);
    if (board.length < 3) {
      const r1 = E.rankOf(hole[0]), r2 = E.rankOf(hole[1]);
      if (r1 === r2) UI.setHandStrength('Pair of ' + E.RANK_PLURAL[r1]);
      else {
        const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
        const suited = E.suitOf(hole[0]) === E.suitOf(hole[1]);
        UI.setHandStrength(E.RANK_NAME[hi] + '-' + E.RANK_NAME[lo] + (suited ? ' suited' : ' offsuit'));
      }
      return;
    }
    const v = E.evaluateN(hole.concat(board));
    UI.setHandStrength(E.handName(v));
  }

  // ---------------- turns ----------------
  async function aiTurn(seat) {
    const hand = G.hand;
    const persona = AI.PERSONALITIES[CHARS[seat].key];
    UI.setSeatState(seat, 'acting', true);
    const { action, thinkMs } = AI.decide(hand, seat, persona, G.playerModel, G.rng);
    UI.think(seat, true);
    await wait(thinkMs);
    UI.think(seat, false);
    UI.setSeatState(seat, 'acting', false);
    if (G.over) return;

    // notebook timing observation
    G.timingObs.push({ seat, street: hand.street, action: action.type, thinkMs, toCall: hand.legalActions(seat).toCall });
    applyAction(seat, action, thinkMs);
  }

  function applyAction(seat, action, thinkMs) {
    const hand = G.hand;
    const la = hand.legalActions(seat);
    const street = hand.street;
    const facingBet = la.toCall > 0;
    const nb = G.notebook[seat];

    // notebook pre-action bookkeeping (villains only)
    if (nb) {
      if (street === 'river' && facingBet) {
        nb.riverFoldChances++;
        if (action.type === 'fold') nb.riverFolds++;
      }
      const pressure = facingBet && (la.toCall > hand.pot * 0.4 || la.toCall > hand.players[seat].stack * 0.3);
      if (pressure && CHARS[seat].key === 'nick') {
        nb.pressureFoldChances++;
        if (action.type === 'fold') nb.pressureFolds++;
      }
      if (action.type === 'raise') {
        nb.raises++;
        if (CHARS[seat].key === 'stan' && street !== 'preflop') nb.stanRaises++;
        if (thinkMs !== undefined && thinkMs < 420) nb.snapRaises++;
        if (thinkMs !== undefined && thinkMs > 1700 && street !== 'preflop') nb.tankBets++;
      }
      if (action.type === 'call') {
        nb.calls++;
        if (thinkMs !== undefined && thinkMs > 1700 && CHARS[seat].key === 'nick') nb.reluctantCalls++;
      }
      if (street === 'preflop' && (action.type === 'call' || action.type === 'raise')) {
        if (!nb._vpipedThisHand) { nb.vpip++; nb._vpipedThisHand = true; }
      }
    }
    // player model for Rosa
    if (seat === 0) {
      if (action.type === 'raise') G.playerModel.aggActs++;
      if (action.type === 'call') G.playerModel.callActs++;
      G.playerModel.aggRatio = (G.playerModel.aggActs + 1) / (G.playerModel.callActs + 1);
      if (street === 'preflop' && (action.type === 'call' || action.type === 'raise')) G.playerVpiped = true;
    }

    const entry = hand.act(seat, action); // engine advances here
    const p = hand.players[seat];
    const name = CHARS[seat].short;

    if (action.type === 'fold') {
      UI.setSeatState(seat, 'folded', true);
      UI.setHoles(seat, 'none');
      UI.bubble(seat, 'Fold', 'fold');
      SFX.muck();
      if (seat === 0) {
        UI.setHandStrength(null);
        $('#hero-cards').style.opacity = '.35';
      }
    } else if (action.type === 'check') {
      UI.bubble(seat, 'Check');
      SFX.knock();
    } else if (action.type === 'call') {
      const total = G.betsShown[seat] + (entry.amount || 0);
      G.betsShown[seat] = total;
      UI.setBet(seat, total);
      UI.flyChip($('#seat-' + seat + ' .avatar'), $('#bet-' + seat), null, 300);
      const allIn = p.allIn;
      UI.bubble(seat, allIn ? 'ALL-IN $' + total : 'Call $' + (entry.amount || 0), allIn ? 'allin' : '');
      SFX.chips(entry.amount || 1);
      if (allIn) tensionCheck();
    } else if (action.type === 'raise') {
      G.betsShown[seat] = entry.amount;
      UI.setBet(seat, entry.amount);
      UI.flyChip($('#seat-' + seat + ' .avatar'), $('#bet-' + seat), null, 300);
      const allIn = p.allIn;
      const isBet = la.toCall === 0;
      UI.bubble(seat, allIn ? 'ALL-IN $' + entry.amount : (isBet ? 'Bet $' + entry.amount : 'Raise to $' + entry.amount), allIn ? 'allin' : 'raise');
      SFX.chips(entry.amount);
      if (allIn) tensionCheck();
    }
    UI.setStack(seat, p.stack);
  }

  function tensionCheck() {
    const hand = G.hand;
    const live = hand.livePlayers();
    const allinCount = live.filter(s => hand.players[s].allIn).length;
    if (allinCount >= 1 && live.includes(0) && !hand.players[0].folded && !G.droneOn) {
      G.droneOn = true;
      SFX.droneStart();
    }
  }

  // ---------------- human input ----------------
  function humanTurn() {
    const hand = G.hand;
    const la = hand.legalActions(0);
    UI.setSeatState(0, 'acting', true);

    const btnFold = $('#btn-fold'), btnCheck = $('#btn-check'), btnRaise = $('#btn-raise');
    const bar = $('#act-buttons');
    bar.classList.add('live');

    // labels
    if (la.canCheck) btnCheck.innerHTML = 'CHECK';
    else if (la.toCall >= hand.players[0].stack + 0) {
      btnCheck.innerHTML = la.toCall >= hand.players[0].stack ? 'CALL ALL-IN<small>$' + la.toCall + '</small>' : 'CALL<small>$' + la.toCall + '</small>';
    } else btnCheck.innerHTML = 'CALL<small>$' + la.toCall + '</small>';
    btnRaise.style.display = la.canRaise ? '' : 'none';
    btnRaise.innerHTML = (la.toCall > 0 ? 'RAISE' : 'BET');
    btnFold.disabled = false;
    btnCheck.disabled = false;

    return new Promise(resolve => {
      const done = (action) => {
        cleanup();
        bar.classList.remove('live');
        closeRaisePanel();
        UI.setSeatState(0, 'acting', false);
        try { applyAction(0, action); } catch (e) { console.error(e); }
        resolve();
      };
      const onFold = () => done({ type: 'fold' });
      const onCheck = () => done({ type: la.canCheck ? 'check' : 'call' });
      const onRaise = () => openRaisePanel(la, (amt) => done({ type: 'raise', amount: amt }));
      function cleanup() {
        btnFold.removeEventListener('click', onFold);
        btnCheck.removeEventListener('click', onCheck);
        btnRaise.removeEventListener('click', onRaise);
      }
      btnFold.addEventListener('click', onFold);
      btnCheck.addEventListener('click', onCheck);
      btnRaise.addEventListener('click', onRaise);
    });
  }

  function openRaisePanel(la, onConfirm) {
    const hand = G.hand;
    const panel = $('#raise-panel');
    panel.classList.add('open');
    const slider = $('#raise-slider');
    const amt = $('#raise-amt');
    const p = hand.players[0];
    const potAfterCall = hand.pot + la.toCall;
    const base = p.committed + la.toCall;

    slider.min = la.minRaiseTo;
    slider.max = la.maxRaiseTo;
    slider.step = 1;
    slider.value = Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, base + Math.round(potAfterCall * 0.5)));
    amt.textContent = '$' + slider.value;

    const presets = [
      { label: '⅓ POT', frac: 1 / 3 },
      { label: '½ POT', frac: 0.5 },
      { label: '⅔ POT', frac: 2 / 3 },
      { label: 'POT', frac: 1 },
      { label: 'ALL-IN', frac: null }
    ];
    const row = $('#raise-presets');
    row.innerHTML = '';
    presets.forEach(pr => {
      const b = UI.el('button', 'preset', pr.label);
      b.addEventListener('click', () => {
        let v = pr.frac === null ? la.maxRaiseTo : base + Math.round(potAfterCall * pr.frac);
        v = Math.max(la.minRaiseTo, Math.min(la.maxRaiseTo, v));
        slider.value = v;
        amt.textContent = '$' + v;
        row.querySelectorAll('.preset').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
      });
      row.appendChild(b);
    });

    const okBtn = $('#btn-raise-ok');
    const updateLabels = () => {
      amt.textContent = '$' + slider.value;
      okBtn.textContent = (la.toCall > 0 ? 'RAISE TO' : 'BET') + ' $' + slider.value;
    };
    slider.oninput = () => {
      row.querySelectorAll('.preset').forEach(x => x.classList.remove('sel'));
      updateLabels();
    };
    row.querySelectorAll('.preset').forEach(b => b.addEventListener('click', updateLabels));
    updateLabels();
    okBtn.onclick = () => onConfirm(parseInt(slider.value, 10));
    $('#btn-raise-cancel').onclick = () => closeRaisePanel();
  }
  function closeRaisePanel() { $('#raise-panel').classList.remove('open'); }

  // ---------------- hand end ----------------
  async function finishHand() {
    const hand = G.hand;
    const r = hand.result;
    if (!r) return;

    if (r.type === 'showdown') {
      const live = hand.livePlayers();
      // all-in runout drama: reveal cards, then slow-roll remaining board
      const runout = G.shownBoardLen < 5;
      if (runout) {
        for (const s of live) revealSeat(s);
        await wait(700);
        await dealBoardTo(5, true);
        await wait(300);
      }
      SFX.droneStop();
      // reveal in showdown order + labels
      for (const sd of r.showdown) {
        revealSeat(sd.seat);
        if (sd.seat !== 0) UI.sdLabel(sd.seat, sd.name);
        logShowdown(sd);
      }
      updateHeroStrength();
      await wait(900);

      // refund
      if (r.refund && r.refund.amount > 0) {
        UI.flyChip($('#pot-area'), $('#seat-' + r.refund.seat + ' .avatar'), r.refund.amount, 420);
        UI.ticker('$' + r.refund.amount + ' uncalled returns to ' + CHARS[r.refund.seat].short);
        await wait(450);
      }
      // award pots (side pots last-to-first feels right visually: main pot last? award in order)
      const byWinner = {};
      for (const a of r.awards) byWinner[a.seat] = (byWinner[a.seat] || 0) + a.amount;
      const multiPot = r.pots.length > 1;
      for (const a of r.awards) {
        UI.setSeatState(a.seat, 'winner', true);
        UI.flyChip($('#pot-area'), $('#seat-' + a.seat + ' .avatar'), a.amount, 550);
        SFX.chips(a.amount);
        const potName = multiPot ? (a.potIndex === 0 ? 'main pot' : 'side pot') : 'pot';
        const winnerName = a.seat === 0 ? 'You' : CHARS[a.seat].short;
        const verb = a.seat === 0 ? 'win' : 'wins';
        const winnersOfPot = r.awards.filter(x => x.potIndex === a.potIndex);
        const split = winnersOfPot.length > 1 ? ' (split)' : '';
        UI.ticker(winnerName + ' ' + verb + ' $' + a.amount + ' ' + potName + split + ' with ' + E.handName(a.value));
        if (a.seat === 0) { SFX.chime(a.amount > 60); G.session.showdownsWon++; }
        await wait(700);
        UI.setStack(a.seat, hand.players[a.seat].stack);
      }
      // session best hand for player
      const mySd = r.showdown.find(sd => sd.seat === 0);
      if (mySd && mySd.value > G.session.bestHandVal) {
        G.session.bestHandVal = mySd.value; G.session.bestHand = mySd.name;
      }
      if (byWinner[0]) G.session.biggestPot = Math.max(G.session.biggestPot, byWinner[0]);
      // correlate timing tells with revealed hands
      correlateTells(r.showdown);
      updatePlayerModelFromShowdown(r.showdown);
    } else {
      // won by folds
      SFX.droneStop();
      const w = r.winnerSeat;
      const amt = r.awards[0].amount;
      // sweep any outstanding bets first happened in reconcile; award:
      UI.setSeatState(w, 'winner', true);
      UI.flyChip($('#pot-area'), $('#seat-' + w + ' .avatar'), amt, 500);
      if (w === 0) SFX.chime(amt > 60); else SFX.chips(amt);
      const nm = w === 0 ? 'You win' : CHARS[w].short + ' wins';
      UI.ticker(nm + ' $' + amt + ' — everyone folded');
      if (w === 0) G.session.biggestPot = Math.max(G.session.biggestPot, amt);
      await wait(650);
      UI.setStack(w, hand.players[w].stack);
      UI.setPot(0);
    }
    UI.setPot(0);
    $('#hero-cards').style.opacity = '';

    // sync stacks & notebook
    for (const s of hand.seats) G.stacks[s] = hand.players[s].stack;
    for (const s of VILLAIN_SEATS) {
      const nb = G.notebook[s];
      if (hand.players[s]) { nb.hands++; nb._vpipedThisHand = false; }
    }
    G.session.hands++;
    G.playerModel.handsSeen = G.session.hands;
    if (G.playerVpiped) G.session.vpip++;
    refreshAutoNotes();
    if (isNotebookOpen()) renderNotebook();

    // busted villains
    for (const s of VILLAIN_SEATS) {
      if (G.stacks[s] <= 0 && hand.players[s]) {
        UI.setSeatState(s, 'busted', true);
        UI.ticker(CHARS[s].short + ' is felted and heads to the fridge for a beer.');
        await wait(600);
      }
    }

    await wait(900);

    // win / lose
    if (G.stacks[0] >= GOAL) return endGame(true);
    if (G.stacks[0] <= 0) return endGame(false);
    if (activeSeats().length < 2) return endGame(G.stacks[0] >= GOAL);

    if (!G.over) playHand();
  }

  function revealSeat(seat) {
    if (seat === 0 || G.holesRevealed.has(seat)) return;
    G.holesRevealed.add(seat);
    UI.setHoles(seat, 'reveal', G.hand.players[seat].hole);
    SFX.cardFlip();
  }

  function logShowdown(sd) {
    if (sd.seat === 0) return;
    const nb = G.notebook[sd.seat];
    const won = G.hand.result.awards.some(a => a.seat === sd.seat);
    nb.showdowns.unshift({
      hole: sd.hole.slice(), name: sd.name, won,
      handNum: G.handNum
    });
    if (nb.showdowns.length > 8) nb.showdowns.pop();
  }

  // player shown-bluff detection for Rosa (player model) — once per showdown
  function updatePlayerModelFromShowdown(showdown) {
    const mySd = showdown.find(x => x.seat === 0);
    if (!mySd) return;
    const cat = Math.floor(mySd.value / 0x100000);
    const iRaised = G.hand.log.some(e => e.seat === 0 && e.type === 'raise' && e.street !== 'preflop');
    if (cat <= E.CAT.PAIR && iRaised) G.playerModel.shownBluffs++;
    G.playerModel.handsSeen = G.session.hands + 1;
  }

  function correlateTells(showdown) {
    for (const sd of showdown) {
      if (sd.seat === 0) continue;
      const nb = G.notebook[sd.seat];
      const cat = Math.floor(sd.value / 0x100000);
      const strong = cat >= E.CAT.TWO_PAIR;
      const obs = G.timingObs.filter(o => o.seat === sd.seat && o.action === 'raise');
      for (const o of obs) {
        if (o.thinkMs > 1700 && strong && CHARS[sd.seat].key === 'deke') nb.tankBetStrong++;
        if (o.thinkMs < 420 && !strong && CHARS[sd.seat].key === 'tilly') nb.snapRaiseBluffs++;
      }
    }
  }

  // ---------------- notebook UI ----------------
  let nbTab = 1;
  function isNotebookOpen() { return $('#notebook').classList.contains('open'); }
  function toggleNotebook(force) {
    const nb = $('#notebook');
    const open = force !== undefined ? force : !nb.classList.contains('open');
    nb.classList.toggle('open', open);
    if (open) {
      $('#btn-book').classList.remove('hasnew');
      renderNotebook();
    }
  }
  function renderNotebook() {
    const tabs = $('#nb-tabs');
    tabs.innerHTML = '';
    for (const s of VILLAIN_SEATS) {
      const b = UI.el('button', 'nb-tab' + (nbTab === s ? ' sel' : ''), CHARS[s].short);
      b.addEventListener('click', () => { nbTab = s; renderNotebook(); });
      tabs.appendChild(b);
    }
    const v = G.notebook[nbTab];
    const persona = AI.PERSONALITIES[CHARS[nbTab].key];
    const vp = v.hands ? Math.round(100 * v.vpip / v.hands) : null;
    const af = v.calls > 0 ? (v.raises / v.calls).toFixed(1) : (v.raises > 0 ? '∞' : '—');
    const body = $('#nb-body');
    let html = '<div class="nb-vheader"><div class="avatar">' + UI.AVATARS[CHARS[nbTab].key] + '</div>' +
      '<div><h3>' + CHARS[nbTab].name + '</h3><div class="blurb">' + persona.blurb + '</div></div></div>';
    html += '<div class="nb-stats">' +
      '<span>hands<br><b>' + v.hands + '</b></span>' +
      '<span>vpip<br><b>' + (vp === null ? '?' : vp + '%') + '</b></span>' +
      '<span>aggression<br><b>' + af + '</b></span>' +
      '<span>raises/calls<br><b>' + v.raises + '/' + v.calls + '</b></span></div>';
    html += '<div class="nb-section-title">Reads</div>';
    if (!v.notes.length) html += '<div class="nb-empty">Nothing yet — keep watching. Reads unlock as the sample grows.</div>';
    else for (const n of v.notes) html += '<div class="nb-note' + (n.hot ? ' hot' : '') + '">' + n.text + '</div>';
    html += '<div class="nb-section-title">Showdowns seen</div>';
    if (!v.showdowns.length) html += '<div class="nb-empty">No cards shown yet.</div>';
    else for (const sd of v.showdowns) {
      html += '<div class="nb-sd">#' + sd.handNum + ' — <span class="cards">' +
        UI.cardHTMLInline(sd.hole[0]) + ' ' + UI.cardHTMLInline(sd.hole[1]) + '</span> — ' +
        sd.name + (sd.won ? ' — <b>won</b>' : ' — lost') + '</div>';
    }
    body.innerHTML = html;
  }

  // ---------------- end game ----------------
  function endGame(won) {
    G.over = true;
    SFX.droneStop();
    setTimeout(() => {
      if (won) SFX.chime(true); else SFX.loseThud();
      const t = $('#end-title');
      t.textContent = won ? 'YOU DOUBLED UP' : 'FELTED';
      t.className = won ? 'win' : 'lose';
      t.id = 'end-title';
      $('#end-sub').textContent = won
        ? 'Marco nods. Word travels. Somewhere across town, a cardroom chair is open.'
        : 'The garage keeps your $200. Deke almost smiles. Almost.';
      const s = G.session;
      const vp = s.hands ? Math.round(100 * s.vpip / s.hands) : 0;
      $('#end-stats').innerHTML =
        '<span>Hands played<b>' + s.hands + '</b></span>' +
        '<span>Biggest pot won<b>$' + s.biggestPot + '</b></span>' +
        '<span>Your VPIP<b>' + vp + '%</b></span>' +
        '<span>Best hand<b>' + (s.bestHand || '—') + '</b></span>';
      // notebook summary
      let notes = '<h3>Notebook — the file so far</h3>';
      for (const seat of VILLAIN_SEATS) {
        const v = G.notebook[seat];
        const top = v.notes.find(n => n.hot) || v.notes[0];
        notes += '<div class="nb-note">' + CHARS[seat].short + ': ' +
          (top ? top.text : 'unread. ' + v.hands + ' hand' + (v.hands === 1 ? '' : 's') + ' observed.') + '</div>';
      }
      $('#end-notes').innerHTML = notes;
      // best session in localStorage
      try {
        const prev = JSON.parse(localStorage.getItem('bracelet-best') || 'null');
        const cur = { stack: G.stacks[0], hands: s.hands };
        if (!prev || cur.stack > prev.stack) {
          localStorage.setItem('bracelet-best', JSON.stringify(cur));
          $('#end-best').textContent = cur.stack > START_STACK ? 'New best session: $' + cur.stack : '';
        } else {
          $('#end-best').textContent = 'Best session: $' + prev.stack + ' over ' + prev.hands + ' hands';
        }
      } catch (e) { /* private mode */ }
      show('scr-end');
    }, won ? 600 : 900);
  }

  // ---------------- screens & controls ----------------
  function show(id) {
    document.querySelectorAll('.screen').forEach(sc => sc.classList.remove('active'));
    $('#' + id).classList.add('active');
  }

  function boot() {
    UI.buildLights();
    UI.buildSeats(CHARS);
    UI.clearBoard();

    const initAudio = () => { SFX.init(); };
    document.addEventListener('pointerdown', initAudio, { once: true });

    $('#btn-start').addEventListener('click', () => {
      SFX.init();
      show('scr-table');
      newGame();
      setTimeout(() => playHand(), 500);
    });
    $('#btn-again').addEventListener('click', () => {
      show('scr-table');
      newGame();
      setTimeout(() => playHand(), 400);
    });
    $('#btn-book').addEventListener('click', () => toggleNotebook());
    $('#nb-close').addEventListener('click', () => toggleNotebook(false));
    $('#btn-speed').addEventListener('click', () => {
      global.GAME_SPEED = global.GAME_SPEED === 1 ? 2 : 1;
      $('#btn-speed').textContent = global.GAME_SPEED + '×';
    });
    $('#btn-sound').addEventListener('click', () => {
      SFX.setEnabled(!SFX.enabled);
      $('#btn-sound').textContent = SFX.enabled ? '🔊' : '🔇';
    });
    // show best session on title
    try {
      const prev = JSON.parse(localStorage.getItem('bracelet-best') || 'null');
      if (prev && prev.stack) $('#title-best').textContent = 'Best session: $' + prev.stack;
    } catch (e) { /* ignore */ }

    show('scr-title');
  }

  document.addEventListener('DOMContentLoaded', boot);
  global.Game = G; // debug/tests
})(window);
