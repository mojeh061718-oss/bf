# REDSKY INC — Full Game Plan
*(game title: REDSKY INC; formerly working-titled Proving Grounds — the proving ground remains the fiction's stage, Redsky Inc is the company you build)*
### The design of record for taking the winning demo to a complete, retention-grade iPhone PWA

*Status: approved direction. The demo (v2) is the seed; this plan is the tree.*

---

## 1. Vision Statement

The player is a hands-on engineer building a company. Every device is assembled by *their* hands in 3D, every test outcome traces to *their* choices, and every failure names its cause. Difficulty comes from **convergence under pressure** — tighter spec bands, twitchier materials, richer devices — never from more complicated UI. The fantasy at minute one ("I built that and it worked") is the same fantasy at hour forty ("I built THAT and it worked") — only the *that* grows.

**The four pillars (unchanged from the bake-off, now load-bearing):**
1. **Your hands are the physics.** Outcomes derive from physical player actions — loading, wiring, torquing, seating, arming. No hidden stats.
2. **Tinker to converge.** Test → read → tweak one thing → refire. Retry friction ~zero. Attempt counts worn with pride.
3. **Failure has a name.** Every miss produces a plain-language cause and an adjustable next step. The Incident Report is a beloved artifact, not a punishment.
4. **Invented science, honest process.** Fictional compounds and physics; real-feeling procedure, instrumentation, and bureaucracy. Comedy targets budgets and lunch tents, never people.

## 2. The Core Loops (three nested rings)

- **Ring 1 — The Test (minutes):** Assembly Bay → close-out → Range Day → scorecard/incident → tweak & refire. *The demo already proves this ring.*
- **Ring 2 — The Contract (sessions):** read RFP → bid → converge through tests within budget → adjudication vs. a rival bid → payout, reputation, and unlocks.
- **Ring 3 — The Company (weeks):** grow Redsky Inc from a shed to a program office: facilities, staff, refinery capacity, part catalog, regions, and the season ladder against Vantage Dynamics.

## 3. The Assembly Bay — "refine it to make it amazing" (founder directive)

The building process is the product. Full-game refinements, in priority order:

### 3.1 Feel upgrades (M1 — see roadmap)
- **Part physicality:** parts have weight in the hand — subtle drag inertia, a settle-wobble on snap, the stand dips under heavy shells. Sound design per material (steel clang, polymer click, canister slosh).
- **Snap intelligence:** nodes highlight progressively as the dragged part approaches (glow → ring → magnetic pull at close range); wrong-category nodes never light. A gentle ghost-preview shows final orientation before release.
- **Orbit polish:** inertial orbit with soft clamps, double-tap to focus a part, long-press for part info card (cost, weight, one flavor line).
- **The stand is a character:** a work-light rig that repositions to your camera, chalk markings that accumulate per attempt, coffee ring decals after test #3 — the bay quietly tells the story of your convergence.
- **Undo/redo timeline** (three steps) — tinkering demands safe experimentation.

### 3.2 Depth without complexity (M2+)
New part categories arrive **one contract at a time**, each introducing one new hands-on interaction, never a menu:
- **Fuse timers → mechanical dial** (rotate to set T+ time by hand; misread the vernier and you're 0.3s off — the RFP timing spec becomes a hands-on skill).
- **Multi-cell payload bays** (arrangement matters: symmetric loads detonate clean; lopsided loads pull the blast off-axis — visible in the crater's shape).
- **Boosters/altitude packages** for airburst contracts (assembly gains a second axis: the delivery stack under the device — this is where the KSP resemblance pays off fully).
- **Instrument packages** (accelerometers, cameras) — optional paid sub-specs on RFPs ("Authority requests onboard footage: +$800").
- **Aesthetics bay:** paint, stencils, fin styles — zero mechanical effect, pure ownership. ("Government Grey No. 2 or nearest available regret.")

### 3.2a The Parts Drawer (founder directive: no bottom scroll — KSP's grammar)
The bottom scroll strip is retired. Parts live in a **KSP-style side drawer**: a slide-out panel on the left edge with **category tabs down its spine** (Shells · Payload · Fuzing · Power · Guidance · Trim), each tab opening a **2-column grid of part tiles** (3D-rendered icons, name, cost) that scrolls vertically. One-handed reach: the drawer opens from a thumb-edge tab, collapses when a part is grabbed (the build zone gets the whole screen back during the drag), and remembers your last category. Locked parts show as silhouettes with their unlock contract number — the catalog *is* the progression brochure.

### 3.2b The Parts Catalog (founder directive: "tons of new parts" — realistic-feeling, fully invented)
Target: **40+ parts by Act II's end**, every one earning its place with a legible effect, arriving one or two per contract so the drawer grows with the player. All fictional under authentic-feeling names and looks (the realism is industrial-design realism — stampings, decals, hex bolts — never real-weapons data). Categories:
- **Shells & structure:** compact/standard/heavy casings, thin-wall (light, fragile), hardened penetrator nose, segmented casing (frag pattern), demolition slab frame.
- **Payload:** EMBER / FROST / EMBER-X / GLAZE canisters (existing), quarter-size trim cells, dense-pack cells (heavy, potent), inert ballast (weight/CoM trim).
- **Fuzing & timing:** the timer dial family (clockwork → precision), impact fuze nose, proximity ring (unlocks airburst RFPs), delay relay, redundant dual-fuze block.
- **Power & wiring:** battery packs (S/L), capacitor bank, junction block, safety switch, relay, shielded harness (widens wrong-color tolerance).
- **Guidance & stabilization (Act II→III):** fin sets (drag vs. stability trade), spin band, gyro unit, seeker/beacon terminal packages, booster stage (the Long Shot stack).
- **Instrumentation & trim:** accelerometer pack, camera pod (footage sub-specs), paint/stencils/decals (pure ownership).
Every part states three plain numbers max on its tile (cost, weight, one effect) — depth from combinatorics, never from stat sheets.

### 3.2c Build Phases (founder directive: multiple phases, each with direct impact)
Assembly formalizes into **four phases with a visible phase rail** at the top of the bay — each phase's choices land on a different axis of the test result, so impact is direct and legible:
1. **STRUCTURE** — shell, nose, frame: sets crater *shape language*, weight class, and what the later phases can mount.
2. **PAYLOAD** — cells and arrangement: sets yield and center-of-mass (crater size and placement).
3. **SYSTEMS** — fuzing, power, guidance mounts: sets *when and whether* it works (timing spec, reliability paths).
4. **CLOSE-OUT** — wiring, detonator, arm (the hands-on trilogy): sets *whether your intent survives your workmanship*.
Phases are freely revisitable before the truck rolls (the rail is navigation, not a lock), but the scorecard attributes outcomes to phases ("PLACEMENT — Payload phase"), teaching the map from decision to consequence.

### 3.2d Nomenclature (founder directive: real-feeling designations, fictional substance)
Whimsical names (EMBER/FROST) retire in favor of **stockroom mil-spec designations** — the fiction of a real supply chain, with zero real-world referents. House rules:
- **Fills:** `FILLER 1A` (`F-1A` on the canister stencil) = the workhorse; `F-2S` = the stabilized fill; `F-1X` = the refined high-output grade; `ADDITIVE G-3` = the stabilizing glaze. Lot numbers on every canister (`LOT 214-C`) purely for flavor.
- **Propellants (missile era):** `PROPELLANT 1A / 1B / 2A` — grades trade thrust curve vs. burn stability vs. temperature sensitivity, all invented.
- **Designation grammar:** family word + number + letter suffix (variant), stenciled type plates, Authority paperwork referring to everything by its full designation while the crew abbreviates ("run the one-alpha"). Color-coding on canisters/spools stays (amber/blue/violet bands) so accessibility never depends on reading a stencil.
- **Hard rule preserved:** no real compound, designation, or recipe — collision-checked against real nomenclature; when in doubt, invent harder. The names *feel* like a warehouse, the science stays ours.

### 3.2e Precision doctrine (founder directive: finely-tuned, make-or-break — "builds that work and stay true")
The game's skill ceiling is **fine tuning with legible consequences**. Placement isn't just snapping — it's *adjustment*:
- **Micro-adjust after snap:** placed parts (fins especially) accept nudge handles — position along the body, cant angle in fractional degrees — with a machinist's readout appearing during adjustment. A fin set 2° off-cant flies; it just *spirals* — and the tracking footage shows it.
- **Make-or-break, fairly:** high-performance envelopes are narrow (the missile that flies true is a genuinely tuned artifact), but every miss diagnoses itself in flight footage + incident language ("roll developed at T+2.1 — check fin cant, port side"). The tinker loop is the safety net that makes razor-edge tuning fun rather than cruel: converging on true flight IS the game.
- **Propellant as recipe:** grade choice + load mass + (later) nozzle pairing set the thrust profile; the wrong pairing doesn't refuse to fly — it flies *wrong*, visibly and diagnosably.
- **"Stays true" as a stat:** certified types carry a measured CONSISTENCY grade from their certification series — the number production buyers pay premiums for. Precision work literally converts to money.

### 3.3 The close-out grows a spine
Wiring/detonator/arm remains the trilogy, deepened by device class: more terminals with a printed wiring diagram to *read* (the diagram is the difficulty), dual-detonator devices needing two clean seats, cold-weather contracts where gloves widen your steadiness tolerance but slow you down. One new wrinkle per act — the verbs never change, the stakes do.

## 4. The Refinery — from mini-game to system (founder's idea, now a pillar)

- **The Still (demo, kept):** temperature-band hold converts EMBER → EMBER-X.
- **Full game:** a refinery room that grows: **Grades** (EMBER-X → EMBER-XX ceiling per facility tier), **FROST derivatives** (stability boosters that widen your close-out error margins — buy safety with skill), **batch economics** (refined stock persists between contracts; a stocked shelf is a war chest), and **refinery upgrades** (better condensers widen the band; automation staff run batches at 90% quality while you're testing).
- **The refinery interaction family grows like the bay's:** distilling (band-hold), blending (pour-to-ratio), curing (timed batches across real sessions — the gentle comeback hook). Each is 10–20 seconds of hands-on skill, never a progress bar alone.

## 5. Contracts, Acts & Content Map

**Act I — THE SHED (tutorialized mastery, ~8 contracts):** demolition-grade charges. Teaches shell/load/wire/seat/arm, the tinker loop, the Still. Boss: first fly-off vs. Vantage.
**Act II — THE WORKS (~14 contracts):** precision era. Timers set by hand, shaped loads, airbursts, instrument sub-specs, weather (wind drift, heat vs. stability, cold-glove close-outs). Facility buildout, first staff hires. Boss: the Authority's "Perfect Ten" — ten spec lines, one test article.
**Act III — THE PROGRAM (~10 contracts + finale):** systems engineering at scale. Multi-stage devices, delivery stacks, multi-test campaigns where one article must pass three range days (design for repeatability, not one lucky shot). The finale: the **Centennial Demonstration** — a nation-watching test with every mechanic on the table. *Deterrence-flavored: demonstrations, never deployment.*
**Contract anatomy everywhere:** 3 headline numbers + 0–2 optional sub-specs. Bureaucratic comedy lives in the paperwork; the bay stays plain-spoken.

## 5.5 The Long Shot Program (founder directive: guided flight to targets thousands of miles away, watched live)

Act III's centerpiece, expanding the delivery-stack idea into a full guided-missile program. Everything stays invented-science and demonstration-framed: targets are always *instrumented test sites* — a painted bullseye on a salt flat, a derelict barge at the Pacific Test Annex, a concrete grid on a leased atoll — never anything inhabited, ever.

### Guidance is tinkering (the same loved loop, new organ)
The guidance bay adds one hands-on station at a time across Act III:
- **The Gyro Bench:** spin up and align the inertial gyro by hand — a two-thumb leveling interaction against a drifting bubble level. Sloppy alignment = accumulating drift per 100 miles; the miss distance at the target *is your alignment error, amplified by range*. (Tolerance stack-up made visceral: 0.1° here is 3 miles there.)
- **The Flight Plan Table:** a paper-map waypoint plot — place the ascent, cruise altitude, and terminal dive point with draggable pins; range vs. fuel vs. wind aloft (shown as forecast arrows) is the puzzle.
- **The Star Tracker (late Act III):** a mid-course correction instrument you calibrate pre-flight through a small telescope-alignment interaction; better calibration = a bigger correction budget in flight.
- **Terminal package choice:** camera seeker vs. beacon homing vs. pure ballistic — different budgets, different failure comedy.

### The flight is the show ("watch it in real time")
Two presentation modes, both from Mission Control — a new scene: the wall map, the plotting table, headset chatter, your telemetry strip:
- **Mission Control mode (default):** the full flight compressed to 3–5 minutes of continuous live coverage with no dead air: launch pad cam (the silent-flash/delayed-roar treatment at launch scale) → staging seen from a chase plane → the wall-map plot crawling across the ocean with station handoffs ("Tracking handoff: Station 11 has the article") → **the mid-course beat: YOUR correction burn**, performed live with the budget your star-tracker calibration earned (a 10-second thumb-steady interaction — the whole flight funnels through your hands one more time) → terminal dive from the target-side long-lens camera — the same Station 7 language the player already loves, now pointed at an empty atoll — impact, measurement overlay drawing your miss distance against the contract's CEP ring.
- **Real-Time Range Day (opt-in, the PWA flex):** the flight takes its true duration — 35, 50, 90 minutes for the longest shots. You launch, you pocket the phone, and **a push notification arrives when the article goes terminal**: "STATION 19: article inbound, T−90 seconds." Open the app, watch the terminal phase live, see the plot. Nobody else on mobile does this; it turns the longest contracts into appointment drama and makes the installed-PWA push permission feel *earned by the fiction*.
- Both modes resolve from the same deterministic sim (gyro error + waypoints + winds + correction input); the replay/decision-log architecture covers flights, so a Long Shot is shareable like any test.

### Contract shape
Long Shot RFPs score on **CEP at range** (miss distance rings), time-on-target windows, and optional instrument sub-specs ("terminal footage required"). The Weekly RFP rotates Long Shot weeks in at season milestones — the leaderboard becomes "closest to the pin at 2,400 miles," which is the most screenshot-able number in the game.

### Feasibility note (engineering sign-off)
All of it is squarely buildable in the existing stack: the wall map and ocean plot are three.js/canvas 2D work, the flight sim is a few hundred lines of deterministic invented physics, camera cuts reuse the Station-N grammar, and real-time mode is a timestamp + one push notification — no server flight simulation needed (the outcome is sealed deterministically at launch; the drama is revelation, not computation).

## 5.6 R&D → Certification → Production (founder directive: the Weapons Assembly economy)

The game's structure reorganizes around a **company HQ menu** with two front doors, making R&D a first-class mode rather than a per-contract errand. (All of it fiction, demonstration-framed as ever — the "products" only ever meet test ranges and instrumented targets.)

### The HQ (new main menu)
A single establishing shot of the Redline compound with doors, replacing the bare title flow:
- **CONTRACT OFFICE** — the corkboard: authored RFPs and the Weekly, as today.
- **WEAPONS ASSEMBLY** — the free R&D workshop: build anything from your unlocked catalog on your own dime, no spec sheet over your shoulder.
- **THE RANGE** (from Weapons Assembly) — test R&D builds **against varied test objects**, not just open desert: derelict trucks, concrete wall sections, a decommissioned bunker, glass instrumentation arrays, stacked container targets. Each object measures differently (penetration, wall breach %, overpressure at distance) and each gives its own gorgeous long-lens payoff.
- **THE STILL / MUSEUM / ORDNANCE WEEKLY** — side doors, as built.

### The certification-and-production loop (the new money game)
1. **Prototype** in Weapons Assembly — iterate on the range against the objects that match your design's intent. This is pure tinker loop, self-directed.
2. **Certify** — when a design performs, submit it to the Authority's **Type Certification**: a standards series (three consecutive range tests: one performance, one consistency repeat, one abuse test like the hot-soak or the washboard transport) with the design *frozen* — no tweaks mid-series. Passing stamps it **PRODUCTION READY** with a type plate (RSK-7 "Sledge") and a certified spec card generated from its *measured* results.
3. **The Auction** — certified types go to a **production bid board**: buyers (the Authority, allied programs, the Navy's test directorate — all fictional) post orders ("48 units of a Type II breach charge, delivery in 30 days") and *bid on your certified types*; multiple interested buyers push the price up in a short, tense, watchable auction beat. Better measured specs, cleaner incident history, and reputation pull bigger bids.
4. **Production run** — accepting an order books your workshop for its duration (real-ish time drip like batch curing) and pays out on delivery, with a small chance of a **field QA callback** (an incident report from the customer's acceptance testing — root-caused to your certified design's actual weak point, feeding the next design generation).
This gives money three sources with three feels: contract prizes (sprints), production royalties (investments), and the Weekly (competition) — and makes "landing the big order" the mid-game fantasy, exactly per the founder's note.

### Difficulty posture (founder directive: challenging, never focus-losing)
The certification series is where difficulty concentrates — repeatability punishes lucky builds, which is fair and legible. Everywhere else the tinker-loop guarantees (2–5 test convergence, plain-language causes, zero retry friction) hold. Rule of thumb across all modes: **the player should always know what to try next**; if a playtest note ever reads "I don't know what to do," that's a defect, not difficulty.

## 6. The Rival & The World

- **Vantage Dynamics** bids on your contracts with era-appropriate results (statistically simulated in Act I, genuinely design-resolved by Act III — their failures obey the same physics). They adapt to your track record: undercut your costs, poach a supplier (a part gets pricier for a while), and occasionally suffer a public disaster that shifts the next RFP's paranoia ("interlock clauses doubled this season").
- ***Ordnance Weekly***, the trade paper, is the narrative wrapper: your wins, their stumbles, procurement gossip, season standings. One screen, one minute, pure flavor.
- **Staff (Act II+):** a surveyor, a chemist, a QA hand — each automates or improves a loop the player has *already mastered* (never gates one they haven't). Hiring is characterful (one-paragraph résumés with a tell).

## 7. Difficulty, Retention & Live Systems

- **Difficulty dial = spec bands + material temper + device complexity.** Never more UI. Target: first-attempt win rate ~25% early, ~10% late; convergence within 2–5 tests always feels available.
- **The Weekly RFP:** one seeded contract, identical for all players, one submitted result (practice free), leaderboard on adjudication score. The portfolio's input-log/replay validation pattern applies: submissions are decision logs, re-simulated server-side. Push: "RFP window closes tonight."
- **Test Range Sandbox:** free-build, no budget, all unlocked parts — the toy box and the clip generator (shareable replay links of your best/funniest tests, rendered from decision logs like Trickshot's ghosts).
- **Incident Report Museum:** your framed disasters. Players will screenshot these; the museum makes it a feature.
- **Season ladder** vs. Vantage difficulty tiers; prestige = "sell the company," restart with a legacy perk and a harder market.
- **Daily texture:** batch curing completes, Ordnance Weekly publishes, one rotating "quick contract" (a 5-minute known-quantity job for pocket money). Enough to visit; never a chore-list.

## 8. Presentation Roadmap ("desert scenes and the truck scene should be better")

- **M1 targets (with the assembly refinements):** the **convoy sequence** replaces the flatbed vignette — a proper dawn drive: your device chained on the bed, escort truck ahead, long shadows, radio-chatter captions, washboard-road dust, one held wide shot that lets the moment breathe (skippable always). **Desert range v2:** layered mesa parallax with atmospheric depth fog, time-of-day per contract (dawn/noon/dusk palettes), heat shimmer strengthened near the ground, wildlife beat (a jackrabbit clears the frame pre-countdown), richer pad dressing (cable runs, sandbags, the volunteer's helmet on a post).
- **M2:** detonation fidelity pass — layered fireball with core/mantle/smoke-column stages, terrain scarring that persists in the scene, crater aftermath walk-around (slow orbit during measurement), weather (wind sock, drifting dust) that visibly affects the smoke column.
- **Constant:** 60fps on iPhone 12+, graceful degradation below; low-poly flat-shaded language throughout — fidelity via lighting, motion, and staging, not asset weight.

## 9. Technical Architecture (full game)

- **Stack (unchanged, hardened):** three.js + vanilla JS, no build step as long as feasible (revisit at >10k lines: optional esbuild step, still zero-framework). `sim.js` stays DOM-free and deterministic — every outcome unit-testable; every content addition ships with sweep tests (the 43-test demo suite becomes a 400+ test suite).
- **Save system:** IndexedDB event-sourced career log (every assembly action + outcome) → enables replays, the museum, cloud backup as a flat log, and decision-log leaderboard submission. `?seed=` remains for debugging/sharing.
- **PWA:** full offline career; service-worker asset caching with versioned part packs (lazy-load per act); web push (iOS 16.4+ installed) for Weekly RFP + batch completion only. Add-to-Home-Screen prompt after first contract win (the earned moment).
- **Backend (small, phase-in at M3):** weekly RFP seeds (static JSON), score submission + server re-sim validation, season standings, shareable replay links. Nothing else server-side; the game never requires an account for the campaign.
- **Content pipeline:** contracts and parts are data files (JSON) with a validation harness (auto-sweep every new contract for winnable/too-easy/degenerate before it ships) — the content treadmill is spec sheets, which is why this game's drip is cheap.

## 10. Milestones

| Milestone | Scope | Exit criterion |
|---|---|---|
| **M1 — The Amazing Bay** *(starts now)* | Assembly feel upgrades (3.1), convoy sequence, desert range v2, PWA manifest + offline, save/persistence, settings (audio/skip/handedness) | A stranger hands back the phone saying "the building part feels great"; presentation beats screenshot-worthy |
| **M2 — Act I complete** | 8 contracts + refinery system v1 + timer dial + payload arrangement + detonation fidelity pass + Incident Museum | Act I playtests at 2–4 hour completion with <5% quit-on-frustration; sweep suite green |
| **M2.5 — The Wiring Bench** *(in flight)* | Schematic-card wiring puzzle, component board, continuity tester, CC0 texture pass | Wiring reads as "thinking, not guessing" in playtest |
| **M3 — The Workshop** | HQ menu, KSP-style parts drawer, catalog expansion toward 40+ parts, four build phases with phase rail, Weapons Assembly + target-object range, Type Certification + production bid board | A playtester lands a production order and calls it the best moment in the game |
| **M4 — The Living Game** | Weekly RFP + backend + sandbox replay links + season 1 | 100 external testers; D7 retention >25% of D1 |
| **M5 — Act II** | Precision era content, staff, weather, airburst/proximity RFPs, Vantage adaptation | Full act ships; Weekly RFP participation >40% of actives |
| **M6 — Act III + 1.0** | Long Shot program, delivery stacks, Centennial finale, prestige | 1.0 launch |

## 11. Open Questions (founder's desk)

1. **Session length bias:** Act III multi-test campaigns — cap a campaign at ~3 sessions, or let them sprawl epic (5+)?
2. **Monetization posture** (still parked): premium unlock after Act I vs. fully free portfolio piece? Decision needed by M3 (affects backend).
3. **A second interactive biome** (coastal barge tests? arctic range?) — M4 stretch or 1.1?

---
*Next action: M2.5 (wiring bench) is in flight; M3 — The Workshop — follows immediately: HQ menu, KSP parts drawer, catalog expansion, build phases, Weapons Assembly R&D, target-object range, certification and the production bid board.*
