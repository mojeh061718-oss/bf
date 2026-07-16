# Concept 06 — DEAD LOAD
### Engineering Construction Puzzles With Honest Physics
*Built from seed idea #1 (real physics) with the level-mastery spirit of seed idea #4*

---

## 1. Elevator Pitch

Build the bridge. Then watch the truck cross it — or watch it fold like wet cardboard, because the physics doesn't care about your feelings. Dead Load is an engineering puzzle game where every level hands you a gap, a budget, and a load to survive: convoys, trains, a rocket test-stand, a whale being craned onto a truck. Success is engineering. Failure is physics comedy. Both are worth the price of admission.

## 2. Fantasy & Tone

The player is a freelance engineer taking increasingly unhinged municipal contracts. Tone: deadpan bureaucratic comedy over dead-serious simulation — the client memos are funny, the beam stress is not. Art: clean 2D blueprint aesthetic that "renders" into a warm, toy-like world when you hit TEST — the blueprint→reality flip is the signature moment. Audio: pencil scratches and paper in build mode; wood groans, steel shrieks, and glorious multi-stage collapses in test mode.

## 3. Core Loop (minute to minute)

1. **Read the contract** — gap, anchor points, load spec ("three garbage trucks, then one very fast ambulance"), and budget.
2. **Build** — snap-grid node-and-beam construction, one thumb: tap-drag between nodes to place wood/steel/cable/road. Pinch-zoom generous, magnified cursor offset from finger. Material palette grows across the campaign (hydraulic pistons, springs, counterweights unlock whole new solution families).
3. **Stress-check** — optional pre-test static analysis tints members by load (the "am I an idiot?" button).
4. **TEST** — physics runs live. Slow-mo scrub on failure to autopsy exactly which joint went first.
5. **Iterate** — edit and re-test in seconds. Pass = graded on budget efficiency; the leaderboard axis is **cheapest working solution**.

## 4. Session Shape

Simple contracts: 3–6 minutes. Gnarly ones: a delicious 20-minute obsession. Save-state per level means half-finished bridges wait patiently — good pocket architecture. Natural session close at each contract's stamp of approval.

## 5. Progression & Retention (the day-14 answer)

- **Day 1–3:** Campaign districts teach materials and load types. Early wins are generous; the difficulty knee arrives with dynamic loads (things that *swing*).
- **Day 4–7:** Budget-mastery reruns — every solved level becomes an optimization puzzle ("passed at $14,200... world median is $9,800"). Percentile feedback per level is the quiet retention hook: everyone has *one* bridge they can't stop shaving dollars off.
- **Day 7–14:** **Daily Contract** with a global cheapest-solution leaderboard and gallery — after solving, browse the top-10 solutions as replays. Seeing a stranger's absurd cable-stayed monstrosity solve your problem for half the cost is the social loop.
- **Day 14+:** **Workshop:** player-authored contracts with a browse/rate feed — the definitive infinite-content engine for this genre (established by precedent; these communities run for years). Weekly featured community contracts; seasonal engineering leagues; challenge modifiers (earthquake week, budget-halved week).

## 6. Content Ceiling

Very high. Materials × load types × terrain multiply; authored contracts are cheap once the toolkit exists; and UGC is not speculative for this genre — it is the historically proven endgame. Solution-gallery browsing means even *old* levels generate new content (other people's answers).

## 7. Monetization Notes

Out of scope. Clean future fits: material-pack expansions, cosmetic blueprint themes. Nothing may touch budget/physics or the leaderboard dies.

## 8. PWA Feasibility

- **Physics:** 2D constraint/joint simulation with breakable joints — squarely in Rapier's (WASM) wheelhouse; simulation stability under big player-built structures needs a beam/joint cap and careful solver iteration tuning. 60fps safe within sane caps on modern iPhones.
- **Determinism:** needed for solution replays/galleries — fixed timestep, versioned physics (a solver change must not invalidate old solutions silently; we version-stamp solutions).
- **Editor UX on a phone is the real risk** — node-and-beam building with a thumb demands excellent snapping, magnifier, and undo. This is a design problem, not a tech problem, and it's the one to prototype first.
- Offline campaign complete; light backend for dailies/galleries/Workshop.
- **Web push:** daily contract + "your solution was undercut."

## 9. Development Complexity

**M.** Hardest problem: **touch-first construction UX** — desktop precedents lean on mouse precision we don't have. Second: physics stability/determinism under adversarial player constructions. The simulation itself is well-charted territory.

## 10. The Team's Verdict

**Lin:** "Engineering-honest physics with breakable joints is exactly what 2D WASM engines are great at — my only red flag is thumb-precision building, and I want that prototyped in week one." **Priya:** solution-gallery + cheapest-solution percentiles is sneaky-strong retention — optimization communities never log off. **Mara:** failure-as-comedy gives it broad appeal beyond engineering nerds. Weakness: overlaps Concept 01's audience (both are "physics contractor" fantasies) — the team recommends shipping at most one of #01/#06. Between them: #01 has the better *moment* (the collapse), #06 has the better *endgame* (optimization + UGC precedent).
