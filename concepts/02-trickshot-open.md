# Concept 02 — TRICKSHOT OPEN
### Realistic-Physics Trick-Shot Golf
*Built from seed idea #1: "realistic, with real physics to achieve a goal"*

---

## 1. Elevator Pitch

Golf with pool-shark physics in places golf was never meant to be played — rooftops, scrapyards, drainage canals, container ports. Every shot is a real simulation: spin, wind, bounce restitution per material, roll friction, ricochet. No power bars, no aim assists past the first world. The hole is rarely reachable the obvious way; the course is a physics riddle and your ball is the answer.

## 2. Fantasy & Tone

The player is a street-golf hustler on an underground circuit. Tone: laid-back, a little cocky — lo-fi beats, golden-hour light, hand-painted urban courses with personality (a cat naps on the 4th green; hitting the diner sign makes it buzz). The fantasy is *"I see the shot nobody else sees."* When a three-bounce bank shot off a dumpster lid drops in, the game goes quiet for half a beat before the crowd-noise sting — earned swagger.

## 3. Core Loop (minute to minute)

1. **Read the hole** — pinch-zoom overview; material legend shows what's bouncy, dead, or rolling-fast. Wind flag is live.
2. **Address the ball** — drag back from the ball to set direction and power (slingshot feel, one thumb). A second optional touch sets spin: swipe on a small ball-face widget for top/back/side spin. Two inputs, huge expression space.
3. **Commit** — no mid-flight control. Watch physics resolve: bounces, spin kick, roll-out.
4. **Score** — par system per hole; medals for par, birdie, and the authored "Dream Shot" (a hidden intended line that awards a special badge when you find it).

Every hole supports multiple solutions; Dream Shots reward finding *the* line.

## 4. Session Shape

A hole takes 30–90 seconds; a 9-hole course is a 7–10 minute session. The daily course is a tight 5 holes — a 4-minute ritual. Chasing a leaderboard time or a Dream Shot stretches naturally into longer sits.

## 5. Progression & Retention (the day-14 answer)

- **Day 1–3:** Career circuit — themed venues of 9 holes each, unlocked by medal count. Each venue introduces a material/mechanic (chain-link flex, water hazards with skip physics, moving cranes).
- **Day 4–7:** Medal mastery; Dream Shot hunting turns completed courses into puzzle boxes. Unlockable balls with honest physical trade-offs (heavier = wind-immune but short; rubber = wild bounce) — sidegrades, never upgrades.
- **Day 7–14:** **The Daily Open** — same 5 holes for everyone, one scored attempt, global + friends leaderboards, and **ghost replays**: watch the top-10 lines as translucent trails, learn, steal, adapt. Asynchronous multiplayer without any real-time infrastructure.
- **Day 14+:** Weekly Major (18 holes, cumulative over the week), seasonal ladder with relegation/promotion divisions so mid-skill players compete against peers, not the world #1. Head-to-head challenge links: send a friend your ghost, they try to beat it.

## 6. Content Ceiling

High. Holes are cheap to author relative to their replay value (multiple lines + Dream Shot + leaderboard life). Procedural daily assembly from a hole-segment grammar keeps dailies fresh without hand-authoring 365 courses. Community course editor is a plausible v2, though less naturally UGC-friendly than Concept 01.

## 7. Monetization Notes

Out of scope. If ever: cosmetic balls/trails/venue themes. Physics-affecting balls stay earnable-only or the leaderboard integrity dies.

## 8. PWA Feasibility

- **Physics:** 2D side-view (recommended) makes this trivial for Rapier/Planck at 60fps. A ¾-view pseudo-3D is possible but Lin advises against fighting 3D physics in WebKit for v1.
- **Determinism matters more here than any other concept** — ghost replays are just recorded inputs replayed through the sim, which requires fixed-timestep deterministic physics. Solved problem with discipline (integer-ish state, fixed seed wind), but it's a hard requirement from day one.
- **Backend:** small — daily seeds, score submission, ghost input-streams (tiny payloads, a few KB).
- **Offline:** career fully offline; dailies need connectivity by nature.
- **Web push:** "The Daily Open is live" + "Your rival beat your ghost" — the second one is a genuinely potent comeback trigger.

## 9. Development Complexity

**S–M.** The smallest honest build on this list with a real retention engine. Hardest problem: **shot-feel tuning** — the slingshot+spin input must feel expressive within week one of prototyping or the concept is wrong; second: deterministic replay infrastructure. Content authoring is the ongoing cost.

## 10. The Team's Verdict

**Deke (systems):** "Daily course + ghosts + divisions is the most proven comeback loop we can build this cheaply — this is the best retention-per-engineering-dollar on the list." **Mara:** the Dream Shot system elevates it from score-attack to puzzle design. **Lin:** lowest physics risk of the physics concepts. Weakness: the genre has crowded casual-golf company on app stores, so *feel* and personality carry the differentiation — if the flick doesn't feel world-class, nothing else matters. High confidence overall; the team's pick for "fastest route to a great game."
