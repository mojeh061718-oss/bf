# PROVING GROUNDS — Full Game Plan
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
- **Ring 3 — The Company (weeks):** grow Redline from a shed to a program office: facilities, staff, refinery capacity, part catalog, regions, and the season ladder against Vantage Dynamics.

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
| **M3 — The Living Game** | Weekly RFP + backend + sandbox + replay links + Ordnance Weekly + season 1 | 100 external testers; D7 retention >25% of D1 |
| **M4 — Act II** | Precision era content, staff, weather, fly-offs, Vantage adaptation | Full act ships; Weekly RFP participation >40% of actives |
| **M5 — Act III + 1.0** | Program-scale devices, delivery stacks, Centennial finale, prestige | 1.0 launch |

## 11. Open Questions (founder's desk)

1. **Session length bias:** Act III multi-test campaigns — cap a campaign at ~3 sessions, or let them sprawl epic (5+)?
2. **Monetization posture** (still parked): premium unlock after Act I vs. fully free portfolio piece? Decision needed by M3 (affects backend).
3. **A second interactive biome** (coastal barge tests? arctic range?) — M4 stretch or 1.1?

---
*Next action: M1 is underway — assembly-feel refinements and the convoy/desert presentation pass.*
