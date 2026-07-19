# DEEP DIVE 01 — BRING IT DOWN
### Controlled-Demolition Physics Puzzles — Full Design Treatment
*Expands [concepts/01-bring-it-down.md](../01-bring-it-down.md)*

---

## 1. Design Pillars

1. **Physics is the puzzle.** No move counters, no arbitrary rules — every solution works because the simulation says so.
2. **Every death of a building is legible.** Stress visualization, slow-mo autopsy, and honest material behavior mean the player always learns something from a botched drop.
3. **The payoff is sacred.** The 10 seconds of collapse are the product. Everything (audio, camera, slow-mo, dust) serves that moment.
4. **Retry costs nothing.** One tap, sub-second reset, plan preserved.

## 2. Core Systems — Detailed Spec

### 2.1 Structural simulation
- Structures are node-and-member graphs: **members** (beams, columns, slabs, cables) connect at **joints** with breakable constraints. Each member has material (wood / steel / reinforced concrete / masonry / glass), cross-section class (light/medium/heavy), and a computed load state.
- **Pre-stress solve:** on level load, a static solver distributes gravity loads through the graph so the intact building stands with realistic internal forces. This is the key tech: when the player cuts a column, its load *visibly re-routes* to neighbors — and overloaded neighbors begin to fail. Cascading collapse falls out of the simulation naturally.
- **Material personalities** (the design content of the physics):
  - *Steel* — bends before breaking; absorbs hits; hinges dramatically.
  - *Concrete* — strong until it isn't; shears suddenly; heavy debris.
  - *Wood* — splinters, light debris, weak in shear, cheap to cut.
  - *Masonry* — no tensile strength at all; walls peel and rain bricks.
  - *Glass* — decorative hazard; shatter radius threatens neighbors' scoring.
- Debris is real physics for ~4 seconds then settles/sleeps into the footprint-scoring pass.

### 2.2 The toolkit (player verbs)
| Tool | Effect | Budget feel |
|---|---|---|
| **Torch cut** | Sever one member, silent, instant | Cheap, plentiful |
| **Small charge** | Breaks members in a tight radius | The workhorse |
| **Large charge** | Big radius + impulse (kicks debris directionally) | Expensive, 1–2 per level |
| **Cable pull** | Attach winch: applies sustained directional force on detonation timeline | The precision tool — controls *which way* things lean |
| **Kicker charge** | Pure impulse, no break — shoves a falling section mid-collapse | Late-game; enables mid-air steering |

Tools are budgeted per level in dollars, not counts — a unified economy that lets levels tune freedom precisely.

### 2.3 The detonation timeline
- Bottom-screen strip, 0–5 seconds, tick marks at 0.1s. Charges/pulls are chips the player drags onto it. Torch cuts always execute at t=0 (pre-weakening).
- This is where mastery lives: dropping the *east wing first* so the tower falls into its hole; a kicker at t=1.8s to punch a leaning slab back inside the line.
- **Preview scrubber:** a dashed "intent" overlay shows detonation order — never the outcome. Predicting the outcome is the game.

### 2.4 Scoring
- **Footprint accuracy** (% of debris mass inside the chalk line) — primary.
- **Collateral** (any contact with protected structures = instant grade cap).
- **Budget efficiency** (unspent budget converts to score).
- **Style bonuses** (surfaced post-hoc, never required): *Pancake* (floors land stacked), *Domino*, *Threading the Needle* (debris passes between two protected buildings).
- Grades: 1–3 stars; **Inspector's Medal** = 3 stars + under strict budget + zero collateral. Campaign gates on stars; medals gate the prestige district.

## 3. Example Play Session (Level: "The Corner Office," District 3)

An L-shaped 8-story office wraps around a protected diner. Footprint: the L's own courtyard. Budget: $2,400.

1. Player surveys — load view shows the corner core column carrying both wings (glows deep orange).
2. First instinct: blow the core. Result: both wings fall *outward*, flattening the diner. Grade F, but the slow-mo replay clearly shows the east wing hinging the wrong way — the player sees *why*.
3. Attempt 2: torch-cut the east wing's outer columns (t=0), cable-pull anchored to the courtyard side, small charge on the core at t=0.8s. The east wing folds inward first; the core drop pulls the north wing after it. 84% footprint. 2 stars.
4. Attempt 5 (nine minutes in): reordered timeline + one kicker to correct a slab that kept bouncing off the pile. 96%, under budget, diner untouched — 3 stars, *Pancake* bonus, and one perfect vertical collapse worth screenshotting.

Design intent demonstrated: failure taught, iteration was fast, and mastery was *timing and reading loads*, not pixel-hunting.

## 4. Content Map & Progression

**Campaign: 8 districts × 18 contracts = 144 authored levels at v1.0.**

| District | Theme | New element |
|---|---|---|
| 1. Old Town | 2–4 story wood/masonry | Torch, small charge, footprint basics |
| 2. Warehouse Row | Wide steel spans | Cable pulls, directional lean |
| 3. Downtown | Mid-rise concrete, tight neighbors | Timeline sequencing, collateral pressure |
| 4. The Docks | Cranes, gantries, water edges | Large charge, debris-in-water rules |
| 5. Industrial Park | Silos, smokestacks, tanks | Kicker charges, cylindrical collapse |
| 6. Uptown | High-rise cores | Vertical implosion technique |
| 7. The Landmarks | Bridges, stadium, cooling tower | Everything, plus multi-structure contracts |
| 8. Condemned Row *(medal-gated)* | Remix gauntlet | Strictest budgets, prestige medals |

- **Daily Contract:** procedurally assembled from a structure grammar (validated stable by auto-solving pre-stress; auto-rejected if degenerate). One scored attempt; unlimited practice on yesterday's.
- **Wrecking League seasons:** 4-week ladders on cumulative daily scores; divisions of ~50 players.
- **Blueprint Editor (v1.1, committed not aspirational):** same node-and-member toolkit the designers use; publish requires the author's own 3-star clear (quality + solvability filter). Browse feed: Trending / New / Inspector's Choice (curated weekly).

## 5. Screen Flow

`City map (districts) → Contract briefing (client memo, budget, protected zones) → Plan view (survey/tools/timeline) → DROP (hold-button) → Collapse + instant replay w/ scrubber → Grade card → Next / Retry`
Meta screens: Daily Contract lobby, League standings, Editor/Workshop (v1.1). Total v1.0 screen count: ~9. Deliberately shallow — the plan view is 90% of the game.

## 6. Technical Architecture

- **Stack:** TypeScript, **Rapier2D (WASM)** for rigid bodies + joint constraints, custom static pre-stress solver (sparse linear solve over the member graph — small, ~hundreds of members), **PixiJS/WebGL** rendering (dust/particles matter here), Web Worker for simulation, main thread for UI.
- **Determinism:** fixed timestep (120Hz sim, 60fps render), seeded, single-threaded sim in the worker. Needed for replay scrubbing and daily-contract fairness. Cross-device float drift risk is real → leaderboards verify by **server re-simulation of submitted input plans** (a plan is <1KB: tool placements + timeline), not by trusting client scores. This kills cheating *and* the determinism problem in one move.
- **Backend (small):** static daily-contract JSON on a CDN; score submission endpoint (re-sims plans); league standings; v1.1 adds Workshop CRUD + moderation queue.
- **Offline:** full campaign cached via service worker; IndexedDB saves. Dailies require network by nature.
- **Perf budget:** ≤300 active bodies mid-collapse, debris despawn/merge at 4s, target 60fps on iPhone 12 and newer, graceful 30fps floor on older.

## 7. MVP → v1.0 → Post-launch

- **Prototype (the truth test, ~2 weeks of build):** one district's toolkit, 5 levels, pre-stress solver + stress view, the hold-to-drop moment. *Kill criterion: if watching the collapse isn't delightful by itself, stop.*
- **MVP (soft launch):** Districts 1–3 (54 levels), full scoring/medals, no backend (dailies stubbed local).
- **v1.0:** all 8 districts, Daily Contract + league backend, web push.
- **v1.1:** Blueprint Editor + Workshop. **v1.x cadence:** a district pack or tool per 6–8 weeks.

## 8. Open Questions for the Founder

1. **Tone check:** dry workplace comedy (our lean) vs. straight-faced sim seriousness?
2. **Failure friction:** should collateral damage *cost* anything beyond the grade (e.g., repair fees from your winnings), or stay pure-score? (Deke leans pure-score; Mara wants light fiction around it.)
3. Editor at v1.1 is a real budget commitment (~30% of post-launch capacity) — confirm appetite before we architect for it (we should know *now*; it affects the level format).

## 9. The Team's Bottom Line

The pre-stress solver is the whole ballgame: it's what separates "honest structural puzzle" from "Angry Birds with scaffolding," and Lin rates it very buildable (small sparse solve, well-known methods). The collapse moment will carry short-term joy; the editor carries year-two. Prototype-first recommendation stands: build the drop, feel the drop, then decide.
