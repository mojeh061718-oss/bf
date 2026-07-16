# Concept 01 — BRING IT DOWN
### Controlled-Demolition Physics Puzzles
*Built from seed idea #1: "realistic, with real physics to achieve a goal"*

---

## 1. Elevator Pitch

You run a demolition company. Every level is a real standing structure with genuinely simulated structural physics — load-bearing walls, stressed beams, tension cables. Cut the right supports, place your limited charges, time the detonation sequence, and drop the whole building cleanly inside a chalk-outlined footprint without touching the pizzeria next door. Physics is the puzzle, gravity is your only employee, and collapse never plays out the same way twice.

## 2. Fantasy & Tone

The player is a demolition foreman with a clipboard and a detonator — a blue-collar surgeon. Tone is dry, workmanlike humor: safety-briefing flavor text, a grumpy inspector who grades your work, clients with absurd requests ("drop the silo *between* the two barns"). Art direction: clean 2D cutaway side-view structures, flat-shaded with strong silhouettes so stress states read instantly (beams flush yellow → orange → red under load). Audio is the star: creaks, groans, the held-breath silence after the last charge, then the roar. A great collapse should feel like a standing ovation.

## 3. Core Loop (minute to minute)

1. **Survey** — pan/pinch around the structure. Tap any member to see what it's carrying (live load visualization).
2. **Plan** — spend a limited toolkit: torch cuts, small/large charges, cable pulls. Drag-place with one thumb; a magnified offset cursor keeps your finger off the target.
3. **Sequence** — arrange detonation timing on a simple timeline strip at the bottom (charge A at 0.0s, B at 0.4s...).
4. **Blow it** — hold the big red button (holding it is deliberately tactile), watch the collapse in real time, with an instant slow-mo replay.
5. **Grade** — scored on footprint accuracy, debris scatter, budget used, and collateral damage. 1–3 stars plus hidden "Inspector's Medal" for under-budget perfection.

Failure is fast and funny — retry is one tap, and the physics guarantees the retry looks different.

## 4. Session Shape

Levels run 60–180 seconds of planning plus a 10-second payoff. Perfect for 3–5 minute sessions; chasing a third star turns any level into a 15-minute rabbit hole. No timers, no energy — the phone-native shape is "one more building."

## 5. Progression & Retention (the day-14 answer)

- **Day 1–3:** Campaign of authored contracts across districts (residential → industrial → landmarks), each district introducing one new tool or material (steel flexes, concrete shears, wood splinters, glass rains).
- **Day 4–7:** Star-gating opens harder districts; Inspector's Medals introduce mastery play — the same level with tighter budget and stricter footprint.
- **Day 7–14:** **Daily Contract** — one procedurally assembled structure, global leaderboard on demolition score, one attempt counts (practice attempts unlimited). Web-push: "Today's contract: the old grain elevator."
- **Day 14+:** **Blueprint Editor.** Players build structures and publish them as contracts; a browse/rate feed surfaces the best. UGC is this game's infinite-content engine — demolition levels are *easy and fun to author* because the builder is just placing beams.
- Seasonal "Wrecking League": 4-week ladders scored on cumulative daily contracts.

## 6. Content Ceiling

Very high. Three independent content engines: authored campaign packs (cheap to produce once the material set exists), procedural daily structures (a grammar of building parts), and UGC. Tools/materials expand the possibility space multiplicatively — every new material re-freshes every old mechanic.

## 7. Monetization Notes

Out of scope for now per direction; nothing in the design depends on it. If ever needed: cosmetic crew/detonator skins and campaign expansion packs fit cleanly. No energy systems — they would kill the retry loop.

## 8. PWA Feasibility

- **Physics:** 2D rigid-body with breakable joints — Rapier (WASM) or Planck.js handles this comfortably at 60fps on any iPhone from the last 6 years. Structures of 100–300 bodies are safe territory; we cap debris lifetime and sleep settled bodies.
- **Rendering:** Canvas2D is likely sufficient; WebGL (PixiJS) if we want dust/particles at scale.
- **Offline:** Fully offline-capable for campaign via service worker; dailies and UGC need a light backend (static JSON for dailies + a small API for UGC/leaderboards).
- **Web push:** iOS 16.4+ installed-PWA push for daily contract — a strong fit.
- **Determinism risk:** replays/leaderboards want deterministic physics; Rapier offers determinism with care (fixed timestep, no float drift across devices needs validation). Fallback: score-attestation rather than replay verification.

## 9. Development Complexity

**M.** Physics integration is well-trodden; the hardest problem is **structural "pre-stress" simulation** — making an intact building stand convincingly under load *before* the player touches it, and making stress visualization honest. Second hardest: procedural daily structures that are stable-until-provoked. Editor ships post-launch.

## 10. The Team's Verdict

**Lin (physics):** "The most honest expression of 'real physics to achieve a goal' on this list — physics isn't decoration, it's the entire puzzle." **Priya (retention):** strong daily loop and best-in-class UGC story; her concern is that pure-puzzle games can plateau at day 10 *until* the editor lands, so the editor cannot be a someday feature. **Mara (creative):** the payoff moment is inherently shareable — slow-mo collapse replays are free marketing. Weakness: authored campaign content is the schedule's long pole before procedural/UGC engines come online. Overall: top-tier fit for seed idea #1, high confidence in fun, medium confidence in week-3 retention pre-editor.
