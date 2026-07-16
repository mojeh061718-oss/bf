# Concept 05 — THRESHOLD
### Hard, Hand-Crafted One-Thumb Skill Gauntlets
*Built from seed idea #4: "a skilled game where it's difficult to complete levels... played like Candy Crush's level structure but its own concept, takes real user skill"*

---

## 1. Elevator Pitch

Four hundred levels. Each one is a 20–40 second gauntlet of moving hazards, and each one is beatable only by *you getting better* — no boosters, no RNG, no pay-to-skip. You guide a mote of light with one thumb through spaces that demand timing, nerve, and line-reading. The map looks like a casual puzzle game. The game behind it has the soul of Super Hexagon.

## 2. Fantasy & Tone

The player is precision itself — no character, no story in the way, just you versus the room. Tone: minimal, electric, a little sacred. Neon geometry on deep dark backgrounds; hazards read instantly by shape-language (rotating = blades, pulsing = timed, breathing = safe-window). Audio is load-bearing: each level's hazards move *on the beat* of its track, so learning a level feels like learning a song. Death is instant, silent, and restarts in under half a second — the Celeste rule: the game never scolds, it just deals again.

## 3. Core Loop (minute to minute)

1. **Enter a level** — see the whole gauntlet at a glance (one to three screens, camera leads your movement).
2. **Move** — one thumb, relative-drag control: the mote mirrors your thumb's movement with tuned smoothing (finger never covers the action). No buttons. The entire skill expression is movement quality.
3. **Thread it** — hazard grammar recombines: rotating blades, sweep lasers, crushers on rhythm, gravity wells that bend your movement, dash gates that demand a flick, mirror zones that invert your input (late worlds, cruel, fair).
4. **Touch the exit** — clear time recorded. Medals: **Clear** (finish), **Flawless** (no near-miss grazes), **Gold** (beat the dev time).
5. Die → instant retry. Attempt counts are worn with pride, not shame ("Cleared in 41 attempts").

**Design law: every death is legible.** The player must always know what clipped them — replay ghost-flash shows your last half-second on death.

## 4. Session Shape

An attempt is seconds; a level falls in 2–15 minutes of attempts. The map structure (worlds of 20 levels, boss gauntlets every 20) gives clean stopping points. This is the purest "one more try" architecture on the list — sessions self-select from 3 minutes to an hour.

## 5. Progression & Retention (the day-14 answer)

- **Day 1–3:** Worlds 1–3 teach the hazard grammar. Difficulty curve is honest early and steep fast — the target player *wants* the wall.
- **Day 4–7:** Medal mastery re-opens beaten levels; Gold times are tuned to demand near-optimal lines. Boss gauntlets (90-second multi-phase levels) are the prestige clears.
- **Day 7–14:** **The Daily Threshold** — one new gauntlet daily, one scored attempt (practice unlimited), global + friends leaderboard on time. **Ghost racing:** run any level against translucent ghosts of friends or the world record.
- **Day 14+:** Weekly **Trial** (a remix gauntlet stitched from campaign rooms with a modifier: double speed, invisible hazards on beat 4, mirrored). Seasonal ladders by division. New worlds ship as free drops — 20 levels per drop is a sustainable authoring cadence. Endgame: **speedrun mode** with per-world timing splits, because this genre's whales are speedrunners.
- Retention math (Deke): completion isn't the retention target — *mastery depth* is. A 400-level game with three medal tiers and ghosts is a 1200-goal game.

## 6. Content Ceiling

High but strictly authored. Hazard grammar makes levels fast to build and test (a good designer ships 2–3 finished levels/day once the toolkit exists). Procedural dailies possible from room-grammar stitching. Level editor is a natural v2 — this genre's communities (Geometry Dash proves it) will out-produce us a hundredfold if we hand them the tools.

## 7. Monetization Notes

Out of scope. Hard rule regardless: **nothing purchasable may touch difficulty** — no skips, no slow-mo, no extra lives. Cosmetic motes/trails only, ever. The audience for this game detects pay-to-win from orbit and never returns.

## 8. PWA Feasibility

- **Trivially strong.** No physics engine needed (hand-tuned kinematics — deliberate; game-feel demands bespoke movement code). Canvas2D/WebGL at locked 60fps is comfortable; input latency is the one thing to obsess over (pointer events, no passive-listener jank, `touch-action: none`).
- Fully offline campaign; tiny backend for dailies/ghosts/leaderboards (ghosts are input recordings — kilobytes).
- **Web push:** daily gauntlet + "your rival took your world record" — the single most provocative push on this list.
- Audio-sync via WebAudio clock (not setTimeout) — solved, but must be built right.

## 9. Development Complexity

**S–M engineering, M content.** The engine is small. The hardest problem is **feel** — the drag-control smoothing, camera, and death/retry cadence must be perfect, and that's taste-driven iteration, not architecture. Second: sustaining level-design quality across 400 levels without formula fatigue.

## 10. The Team's Verdict

**Mara:** "The purest game on the list — nothing between the player and getting better. That purity is the brand." **Priya:** skill games retain a *narrower* audience *harder* — day-14 retention of the hooked cohort will be the best of anything here, but the top of funnel is smaller and churn at the first wall is real (mitigation: a perfectly-tuned first 40 levels). **Lin:** lowest technical risk on the list. Weakness: content is founder-taste-dependent; a level editor and community is the long-term answer. The team's pick for "fastest to prototype, and we'll know in two weeks of playtesting if it's special."
