# Concept 12 — PROVING GROUNDS
### Defense-Contractor Engineering Sim: Build It, Test It, Win the Contract
*Founder request: a science/engineering simulation of designing and testing fictional ordnance — precision engineering, government-style contracts, a rival AI company, and failure cascades where one small oversight can sink the whole project. Written in-depth from the start.*

> **Design stance, stated once and enforced everywhere:** all science in this game is invented. Fictional compounds, fictional materials, fictional physics constants. What's *real* is the **process** — tolerances, telemetry, test protocols, budgets, deadlines, review boards. The game feels rigorous because engineering discipline is simulated honestly; it teaches nothing about actual weapons because every number is ours. (This is also better design: we control the whole possibility space, so difficulty curves are engineered, not inherited.)

---

## 1. Elevator Pitch

You run Aperture-nobody defense startup **Redline Ordnance Works** out of a desert hangar, bidding against the smug industry giant **Vantage Dynamics** for government contracts. Read the RFP, design the device — casing, fill, fuse, guidance, every tolerance yours to set — then take it to the proving ground and watch the telemetry tell the truth in front of a review board with clipboards. A 0.2mm tolerance you cheaped out on is now a crater in the wrong place and a contract in Vantage's pocket. From firecracker-grade demolition charges to the nation's (fictional) strategic deterrent: precision is the product, and the graph doesn't lie.

## 2. Fantasy & Tone

The player is the underdog chief engineer-slash-CEO: part scientist, part gambler, part government-forms whisperer. Tone: **deadpan bureaucratic comedy wrapped around dead-serious engineering tension** — think mid-century atomic-age aesthetic (clipboards, slide rules, CONFIDENTIAL stamps, men in hats standing too close to test sites) rendered in a clean modern style. The government is an absurd, exacting client ("Specification 7.4.1(c): the device shall not exceed 40 decibels *while being transported*"). Vantage Dynamics is the villain you love to beat: slick brochures, bottomless budget, occasionally hilarious public failures. Art: blueprint-and-desert palette — crisp technical drawings that "render" into warm test-range reality when you hit TEST (the same blueprint→world flip that made Dead Load's identity, escalated). Audio: teletype, range klaxons, the long silence after the countdown, and telemetry pens scratching.

## 3. Core Loop (minute to minute)

Four beats, ~10–15 minutes per contract at campaign start:

### Beat 1 — THE RFP (choose your battle)
Contracts arrive as government request-for-proposal documents — beautifully bureaucratic cards with hard specs: *effect target* (fictional yield units, crater diameter, penetration depth, airburst altitude), *precision requirement* (CEP — circular error probable — in meters), *constraints* (max weight, max cost/unit, storage safety rating, "must survive rail transport"), *deadline*, and *payout structure* (development stipend + production contract + performance bonuses). Choosing means reading: a fat payout with a vicious precision spec might be a trap for your current equipment. Vantage bids on the same contracts — sometimes you're head-to-head (fly-off!), sometimes you concede one to bid smarter elsewhere.

### Beat 2 — THE DESIGN BENCH (the engineering game)
A component-graph workbench, drag-and-connect, thumb-friendly:
- **Payload chemistry:** blend fictional compounds (Ammonite-4: cheap, unstable over 30°C; Cerulex: stable, weak, dense; Vex-7: brilliant and terrifyingly sensitive to shock) on a mixing triangle — energy vs. stability vs. sensitivity. Every blend has a *storage life* and a *temperature envelope* that WILL matter later.
- **Casing & structure:** material (fictional alloys with real-feeling trade sheets: tensile, brittleness, weight, cost), wall thickness, fragmentation scoring pattern. Thickness fights weight fights cost.
- **Fuse chain:** the game's soul. Arming mechanism → safety interlocks → trigger (impact / timer / proximity / altimeter) → detonation train. Each stage has a **tolerance slider**: precision-machined ($$$, reliable) down to war-surplus ($, "97% reliable" — and 97% across a 6-stage chain is not 97%, a lesson the game teaches viciously and visibly with a live chain-reliability readout).
- **Guidance & delivery** (unlocks mid-campaign): fins, gyros, seeker heads, parachute retard, rocket motors — each adding failure modes and precision.
- The bench shows **live predicted envelopes, not answers**: yield range, CEP estimate, reliability band — with confidence intervals that *narrow only if you pay for bench testing*. Uncertainty is a resource you buy down.

### Beat 3 — BENCH TEST & QA (buy down your ignorance)
Before the range, spend budget on: component bench tests (fire one fuse batch: reveals its true failure rate ± margin), environmental chamber (does the blend survive the desert truck ride?), and **inspection minigames** — a micrometer reading here, a solder-joint magnifier check there: 10-second skill interactions where *you* are the QA department. Skipping QA is always possible and sometimes correct (deadline math) — but the game remembers what you didn't check, and Beat 4 is where uninspected sins live.

### Beat 4 — RANGE DAY (the payoff and the truth)
Load onto the tower/sled/drop-rig. Countdown. Board members raise binoculars. **The test resolves from your actual design state** — every tolerance, every skipped inspection, every degree of that morning's (displayed!) weather rolls up into the outcome: perfect bloom on target… or the fuse chain's cheap third stage no-fires and the device lawn-darts into the sand (a dud you must now *approach and disarm* — a tense, darkly funny bomb-squad vignette)… or Vex-7's shock sensitivity triggers on rail-jolt and the review board's tent is *no longer there* (nobody's hurt — this game's violence is against terrain, budgets, and dignity only).
Telemetry replay: overlay graphs (pressure trace, trajectory, frag pattern) against the RFP spec lines. **Contract scoring is spec-line adjudication** — the board literally holds your graph against their graph. Partial credit, performance bonuses, or a stern letter.

### The failure-cascade rule (the founder's "one little thing" requirement, systematized)
Every failure traces to a **named cause** shown in the post-test *Incident Report*: "Stage-3 fuse (war-surplus batch, uninspected) failed to arm — root cause: cost decision, Design Bench, Day 12." Failures are never dice; they're receipts. The Incident Report is the game's teaching document and its dark-comedy engine — a bureaucratic form that roasts you politely.

## 4. The Rival: Vantage Dynamics (the pressure system)

- Vantage bids, designs, and tests on the same contracts under the same physics — simulated with its own corporate personality: over-engineered, over-budget, brochure-first. Their test results appear in the trade paper (*Ordnance Weekly*, the game's news wrapper and comic voice).
- **Fly-offs:** marquee contracts culminate in side-by-side demonstrations — alternating tests in front of the board, scored line-by-line. Beating Vantage in a fly-off is the campaign's signature high.
- Vantage adapts: lose to their precision, they'll flaunt it; beat them on cost and their next bid undercuts. Occasionally they poach your suppliers (the same parts catalog gets a "Vantage exclusive" sticker), forcing sourcing improvisation.
- They also fail — publicly, gloriously — and their disasters shift the government's mood (a Vantage safety scandal makes the next RFP obsess over interlocks: the *meta* reads like a living procurement politics sim).

## 5. Campaign Arc & Content Map (small bombs → the strategic program)

**Act I — The Shed (demolition-grade):** quarry charges, breaching devices, seismic survey pops. Teach the chemistry triangle, fuse chains, tolerance economics. Contracts worth thousands.
**Act II — The Works (precision ordnance):** artillery shells, guided bombs, penetrators; guidance unlocks; environmental specs bite; first fly-offs. Contracts worth millions; facility upgrades (better machine shop = tighter tolerance floor; wind tunnel = better CEP prediction).
**Act III — The Program (the big leagues):** rocketry, staged systems, and the fictional strategic program — enormous multi-test campaigns where a single device is a *project* (sub-contracts, review gates, test series) and "one little thing" has national-headline consequences (fictional, comedic-grave). Yield units go abstract-huge; the tension goes bureaucratic-epic: the final act is less about bigger booms and more about **managing certainty at scale** — the systems-engineering fantasy, honestly gamified.
**Endgame/retention systems:** weekly seeded RFP (same spec, same parts catalog, global leaderboard on adjudication score), Test Range sandbox (free-build, no budget, pure toy joy — the shareable-clip generator), contract ladder seasons vs. escalating Vantage AI, incident-report museum (your best disasters, framed).

## 6. Session Shape

One contract beat (a design pass, a QA session, a range day) = 3–8 minutes; a full small contract = 10–15; Act III projects span many sessions with clean save-gates at review boards. Range Day is the natural session climax; the RFP stack is the natural re-entry point.

## 7. PWA Feasibility

**Excellent.** The workbench is DOM/canvas UI; range-day simulation is bespoke deterministic math (trajectory + fragmentation + blast-radius shading — invented physics, cheap to compute) with lush presentation, not a physics engine problem. Seeded determinism everywhere (weekly leaderboard = replay-validated decision logs, the portfolio's standard anti-cheat). Fully offline campaign; tiny backend for weekly seeds/boards. Web push: "RFP window closes tonight" + *Ordnance Weekly* headlines ("VANTAGE TEST SCATTERS LUNCH TENT — read more"). Asset weight modest (vector-technical art).

## 8. Development Complexity

**M, leaning M+.** No exotic tech; the hard problems are design problems:
1. **The tolerance/uncertainty economy** — making "buying down ignorance" feel strategic, not spreadsheet-y (the live confidence-interval UI is the key invention to prototype first).
2. **Failure legibility** — the Incident Report system must always produce a true, readable causal chain; that's an architecture commitment (every component decision logged as a causal node) from day one.
3. **Tone discipline** — atomic-age comedy that stays comedy: style-guide work (no human casualties ever; property, careers, and lunch tents only).

## 9. Open Questions for the Founder

1. **Comedy dial:** deadpan-bureaucratic (our lean — Papers-Please-meets-Mythbusters) vs. broader slapstick? It changes the writing voice everywhere.
2. **The strategic program's framing:** keep the Act III mega-weapons *deterrence-flavored* (test demonstrations, never deployment — the fantasy is engineering scale, not warfare) — we feel strongly this is right, but want your sign-off since it shapes the ending.
3. Multiplayer ambition: weekly seeded RFP is async-competitive already; do you want head-to-head fly-offs vs. *friends'* replay ghosts (very buildable with our decision-log architecture)?

## 10. v2 Direction (founder feedback, post-demo-v1)

Demo v1 validated the fantasy but was too complicated for a general audience. The revised design, now the design of record:

- **KSP-style 3D assembly.** The workbench of sliders becomes a hangar: drag parts from a shelf onto the device, snap-nodes glow, parts click in. Building is spatial and physical, exactly like assembling a rocket in Kerbal Space Program.
- **Hands-on close-out.** The player personally wires the terminals (drag each colored wire, twist-tighten), seats the detonator with a slow steady hand, and flips the arm switch. **Outcomes derive from what the player's hands actually did** — crossed wires no-fire, loose terminals fizzle, a slammed detonator risks early detonation, forgetting to arm produces a dud. No stats decide anything the player didn't do.
- **Difficulty = the tinker loop, not complexity.** Test → read the crater and the plain-language incident note → adjust one thing → refire, with zero retry friction (the build persists between tests). Spec bands are tight enough that the first win honestly takes a few attempts; the attempt counter is worn with pride. Hard, fun, and replayable come from convergence, not from UI depth.
- **Friendly naming.** Technical jargon is banished from everything the player touches (compounds are EMBER and FROST; parts are Shell, Timer, Battery, Detonator). The bureaucratic voice survives only in the RFP and the incident report, where the contrast is the comedy.
- **The Refinery (founder's idea — the progression spine).** Bigger contracts demand blasts raw materials can't reach; the player refines compounds at an interactive station (hold the temperature dial in the band; slip and the batch degrades) to unlock higher grades — which are also twitchier, so careful assembly matters more as you climb. Refining + contract ladder = the long-arc difficulty curve and the "played a lot" retention engine: every tier is the same trusted loop with higher stakes and new materials.

## 11. The Team's Verdict

**Lin:** "The precision fantasy is real and rare — nobody has gamified *tolerance stack-up* and I've wanted someone to for twenty years. The invented-physics stance makes it buildable AND publishable." **Deke:** the loop is a beautiful risk-economy: every beat converts money into certainty or certainty into results; and the RFP structure means content = spec sheets, which are *cheap*. **Mara:** the Incident Report is the star — failure that names its cause is failure players screenshot and share; her flag: App-store-adjacent content policy is friendlier to us than expected *because* everything is fictional and consequence-comedy, but the tone style-guide is mandatory work, not optional. **Priya:** weekly seeded RFPs + a rival who adapts + a sandbox clip-generator is a solid day-14 stack; the audience overlaps Dead Load/Bring It Down engineering-brains but the contract/rivalry wrapper is a fresher retention fiction. Consensus: the strongest *new* systems idea since the original ten — it would slot into the portfolio as the engineering-sim flagship.
