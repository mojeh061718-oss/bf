# DEEP DIVE 04 — THE BRACELET
### A Poker Career From Kitchen Tables to the Main Event — Full Design Treatment
*Expands [concepts/04-the-bracelet.md](../04-the-bracelet.md)*

---

## 1. Design Pillars

1. **The AI must be respected.** A poker-literate player should lose to it, learn from it, and never catch it playing nonsense. This is the product; everything else is packaging.
2. **Opponents are people, not difficulty settings.** Persistent characters with learnable styles and honest leaks. Beating someone *because you know them* is our signature emotion.
3. **The bankroll is the campaign.** Risk management is the strategic layer poker apps ignore. Going broke matters; shot-taking is drama.
4. **Poker's culture, not its casino.** No real money, no chip stores, ever. The fantasy is competence, nerve, and the climb.

## 2. The AI — Architecture & Honest Scope

### 2.1 Three-layer design (Sam's spec)
- **Layer 1 — Baseline strategy:** precomputed near-equilibrium strategies for the state-space backbone: preflop charts by position/stack-depth/action (solved offline, shipped as compressed lookup ~2–4MB), plus postflop **bucketed-abstraction policies** (board texture × hand-strength bucket × pot geometry) trained offline via CFR self-play, shipped as a compact policy table. Not GTO-perfect — *coherently strong*, which is the actual bar.
- **Layer 2 — Personality bias:** each character owns a parameter vector distorting the baseline: VPIP/PFR shift, aggression multipliers by street, positional discipline, stack-pressure response, tilt susceptibility, plus 1–3 **authored leaks** chosen from a library (over-folds to river raises; can't fold overpairs; c-bets 100%; chases flushes badly priced; plays scared at pay jumps). Leaks are *directional and consistent* — learnable, therefore exploitable, therefore fun.
- **Layer 3 — Live adaptation:** characters track *the player's* observable stats (VPIP, aggression, showdown honesty) within and across sessions and shift their parameters believably slowly. Low-stakes villains barely adapt (their charm); high-stakes regs adapt within a session (their menace).
- **Novel-spot fallback:** where tables thin out (weird stacks, multiway rivers), a Web-Worker Monte Carlo rollout (200–800 samples vs. modeled ranges, ~30–60ms) decides — bounded by the personality layer so characters stay in character even when "thinking."

### 2.2 Tells & the Notebook
- At low/mid stakes, characters emit **behavioral tells**: bet-timing patterns (snap-call = drawing; long-pause-then-raise = monster for *this* guy), sizing habits, table-chat patterns. Tells are per-character truths with noise — real signal, never a cheat sheet. High-stakes players are near-tell-less; the game migrates you from people-reading to range-reading exactly like the real climb.
- **The Notebook (auto-scout):** per-villain running stats (hands seen, VPIP/PFR/AF, showdowns logged with hole cards when revealed) + a freeform pinned-notes slot + system-surfaced observations after sufficient sample ("Rosa has folded to every river raise you've shown her — 7 for 7"). The Notebook is the player's crafted weapon; it persists across the entire career and is the reason familiar villains matter.

### 2.3 Difficulty honesty
Difficulty rises by *population quality*, never by rigging cards. Deck RNG is seeded, auditable, and identical in spirit at every stake. We will publish this stance in-app: **"The deck doesn't know who you are."** Non-negotiable — poker games live or die on perceived fairness.

## 3. Career Mode — Structure & Systems

### 3.1 The ladder
| Tier | Venues | Buy-ins | Field | Texture |
|---|---|---|---|---|
| 1. Kitchen | Marco's garage, the firehouse game | $20–$50 | 6–9 | Loose, chatty, heavy tells |
| 2. Cardroom | The Palm (local club) | $60–$150 dailies | 20–60 | First regs, first sharks |
| 3. Casino circuit | 3 regional casinos | $250–$600 | 80–300 | Structured MTTs, satellites live here |
| 4. The Tour | Televised stops | $1.5k–$5k | 300–800 | Regs adapt; tells vanish |
| 5. The Series | 6-week festival, many events | $1k–$10k + the $10k Main | 500–2,000+ | The destination |

- **Bankroll doctrine surfaced in-fiction:** a mentor character teaches shot-taking math ("20 buy-ins minimum, kid"). The UI shows risk-of-ruin *as color*, not homework. Busting a tier drops you a tier — with your Notebook intact, which makes the re-climb *faster*, a beautiful accidental rubber-band.
- **Satellites** are the poor-player's ladder and the game's best drama: win a $60 satty into a $600 seat you have *no roll* to re-enter — now play it.
- **Staking:** impress characters and they offer markup-free stakes for shots (they take 30–50%); later, *you* can stake villains you believe in (passive income with personality attached — and they remember).

### 3.2 Tournament engine
- Full MTT simulation: blind structures, antes, table breaks/balancing, bubble dynamics, pay-jump ICM pressure (surfaced as optional equity hints at lower stakes — a teaching tool that fades by tier 4).
- **Field simulation between your hands:** background tables resolve via fast statistical simulation (personality-weighted outcomes, not full hand-by-hand AI) so 800-player fields collapse realistically in real time without melting the phone. Named rivals get higher-fidelity sim so their runs feel followable ("Rosa just busted the feature table").
- **Feature-table presentation:** final tables and Main Event days get broadcast dressing — hole-card graphics, a commentary text ticker riffing on Notebook history ("These two have tangled 47 times…").

### 3.3 A career session (concrete)
Tuesday, 11 minutes: player opens mid-Day-2 of a $600 casino MTT (34 of 61 left, roll: $4,120 — this shot is 15% of it). Blinds up in 3 minutes. UTG villain "Deke the Rock" (Notebook: 9% VPIP, hasn't bluffed a river in 212 logged hands) opens 2.5x. Player looks down at JJ, 42bb. Flat (vs. the Rock, JJ is a set-mine — *the Notebook made this decision*). Flop 9-6-2 rainbow; Rock c-bets small; player raises; Rock instant-folds (timing tell noted, auto-logged). Two orbits later the pay-jump hand arrives: shove-or-fold at the stone bubble with A9s vs. the table's maniac. ICM ghost-text: "folding = keep $0 equity vs. ~$380 bubble equity at risk." Player tanks, shoves, holds. Cashes minimum $840 an orbit later — banks the session at a natural break (next blind level), roll now $4,340, one new Notebook page richer.

## 4. Beyond the Career — Dailies & Live Systems

- **Hand of the Day:** one authored tough spot (real hand histories re-dressed), everyone decides, then the reveal: community decision split, the "solver-ish" note, and what actually happened. Wordle-shaped, argument-generating, 90 seconds. *The single cheapest high-retention feature in the whole four-concept portfolio.*
- **The calendar:** venues run schedules synced to real time (Tuesday $250 Deepstack, Sunday Major, first-Friday satellites). Push: "Cards in the air in 2 hours." Missing an event costs nothing but the event — appointment pull without punishment.
- **Season = a poker year** culminating in the Series; season leaderboards for earnings, titles, and *Notebook depth* (most-scouted). Off-season resets the calendar with a new rival class promoted into your stakes.
- **Rival arcs:** 6–8 authored characters per tier climb alongside you across a season, with light story beats at shared final tables. Your nemesis is chosen by the sim from actual history (most money lost to / most times bubbled by) — the game *finds* your villain from the data.
- **Prestige (post-Main):** new career; population plays 10% sharper; legacy = your framed Notebook page on the wall of Marco's garage.

## 5. Screen Flow

`Career hub (calendar + roll + venue map) → Lobby (structure, field preview incl. known villains) → Table (play) → Break screens (Notebook, field status) → Cash/bust epilogue`
Meta: Notebook browser / Hand of the Day / Season standings / Staking desk. Table screen gets 80% of the polish budget — it's where players live.

## 6. Technical Architecture

- **Stack:** TypeScript; UI-layer framework + PixiJS for the table scene; **all poker logic in a shared deterministic core** (hand eval via bitwise lookup — commodity; dealing via seeded, auditable RNG). AI runs in a Web Worker (policy lookups ~1ms; MC rollouts 30–60ms budgeted inside natural "thinking" pauses — latency becomes *characterization*).
- **Offline strategy pipeline (the real engineering):** CFR self-play training rig (runs on our machines, not the phone) → compressed policy tables + preflop charts shipped as versioned static assets. Policy iteration continues post-launch and ships as data updates, not app updates.
- **Persistence:** career = event-sourced hand/decision log in IndexedDB (enables Notebook analytics, hand-history review, and cloud backup as a flat log). Full offline play; backend only for Hand of the Day, seasons/boards, and backup sync.
- **Fairness audit:** deck seeds derivable/verifiable per hand (client-shown hash pre-deal, revealable post-hand) — cheap to build now, priceless against "it's rigged" forever.
- **Perf:** trivial rendering load; the only budget line that matters is AI decision latency and background-field sim ticks (both worker-side, both bounded).

## 7. MVP → v1.0 → Post-launch (honest sequencing for the L-sized build)

- **Prototype (3–4 weeks, the longest of the four — the AI *is* the test):** single 9-max table, 6 personalities on the full 3-layer stack (baseline can be chart-based pre-CFR), Notebook v0, no career shell. *Kill criterion: a competent poker player plays 200 hands and says "these opponents are real." If not, iterate here — do not build the career around a hollow table.*
- **MVP:** Tiers 1–2, 20 characters, bankroll + basic calendar, sit-n-gos + small MTTs.
- **v1.0:** all 5 tiers, full MTT engine + satellites + staking, 60+ characters, Hand of the Day, season 1, push, fairness audit UI.
- **Post-launch:** new formats as event types (PLO, bounty, heads-up championship brackets), new venues/rival classes per season, policy-quality updates as data drops.

## 8. Open Questions for the Founder

1. **Naming/IP:** "WSOP" is trademarked (Caesars). We build our own circuit — *the Series*, *the Bracelet* as our own artifact. Licensing is theoretically pursuable but slow/expensive. Confirm you're happy owning an original circuit identity.
2. **Teaching stance:** ICM/equity hints at low tiers (our lean — it grows players who then stay) vs. purist no-hints-ever?
3. **Multiplayer ambition:** v1 is deliberately 100% single-player-vs-AI (it's the moat, and PWA real-time poker is a different, much heavier product). Hand of the Day + boards is our only "social" at launch. Aligned?

## 9. The Team's Bottom Line

The biggest build and the deepest moat: nobody in the casual space ships opponents worth scouting, and the Notebook-plus-persistent-villains loop converts poker's infinite hand-space into *relationships* — which is what retains at day 30, 60, 90. Sam's three-layer AI is ambitious but staged so we validate the hard part first with a 3–4 week table prototype before a dollar goes into the career shell. If the prototype table earns a poker player's respect, this is the four's franchise player.
