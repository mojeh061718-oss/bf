# DEEP DIVE 02 — TRICKSHOT OPEN
### Realistic-Physics Trick-Shot Golf — Full Design Treatment
*Expands [concepts/02-trickshot-open.md](../02-trickshot-open.md)*

---

## 1. Design Pillars

1. **The flick is the game.** If the shot input isn't the best-feeling thing the player touched that day, nothing else matters.
2. **Committed shots.** No mid-air steering, ever. Tension comes from full commitment to a physical prediction.
3. **Many lines, one Dream.** Every hole solvable multiple ways; one authored masterpiece line rewards the visionary.
4. **You compete against people, asynchronously.** Ghosts and leaderboards make it multiplayer without servers-in-the-loop.

## 2. Core Systems — Detailed Spec

### 2.1 Shot input (the make-or-break interaction)
- **Aim/power:** touch anywhere near the ball, drag back — slingshot vector with a fixed max-draw radius (thumb-scale, ~40% of screen width). A thin predicted line shows the *first 0.5 seconds only* of flight (pre-bounce) — enough to aim, never enough to solve.
- **Spin:** after setting draw (finger still down), a second finger — or releasing and tapping the spin widget — sets spin via a small ball-face dial: vertical swipe = top/backspin, horizontal = side. Spin magnitude is capped per ball type.
- **Commit:** release. A subtle 80ms anticipation freeze, then launch. Haptics (where the OS allows) on strike and every bounce.
- **Feel targets (tuned in prototype, non-negotiable):** input→launch latency under 50ms; drag-vector visual tracks the finger 1:1 with zero smoothing lag; a duffed 5% draw still *does something* readable.

### 2.2 Ball physics
2D side-view simulation: gravity, drag, Magnus lift from spin, per-material restitution & friction, rolling resistance, spin decay on each bounce (backspin can *bite* and pull back on grippy surfaces — the signature expert tool).

**Material table (the level-design alphabet):**
| Material | Bounce | Roll | Notes |
|---|---|---|---|
| Concrete | High | Fast | The trick-shot workhorse |
| Grass | Low | Medium | Kills pace; safe landings |
| Dumpster lid | Very high, springy | — | The banked-shot star; slight random *visual* wobble, deterministic physics |
| Chain-link | Absorbs, drops dead | — | Vertical catch-nets; expert route-enders |
| Sand/gravel | Dead | Dead | Punishment & precision landings |
| Water | Kill (or **skip** if incoming angle < 12° at speed) | — | The skip is a discoverable expert move |
| Metal rail | High, true | Fast | Grind-adjacent rail runs on angled rails |
| Awning | Trampoline w/ absorb ratio | — | Soft redirect |

- **Wind:** constant per-hole (flag + particle streaks), affects airborne flight only. Daily courses may gust on a *fixed, displayed* schedule — deterministic, learnable.
- **Moving elements** (late venues): swinging cranes, conveyors, timed vents — all on fixed visible cycles synced to the sim clock (never random).

### 2.3 Holes, pars, and medals
- Par = designer's honest expected strokes. Medals per hole: **Par** (bronze), **Birdie-or-better** (silver), **Dream Shot** (gold badge — hole out or complete the hole via the authored signature line; detected by trigger-zone sequence, generous ±tolerances).
- **Stroke ceiling:** 3× par auto-completes the hole (no infinite misery on leaderboard days).

### 2.4 Ghosts & leaderboards
- Every scored run records the input stream (draw vectors, spin, timestamps) — ~200 bytes/hole. Replays are re-simulated locally: perfect fidelity, tiny payloads.
- **Ghost racing:** up to 3 translucent ghosts render simultaneously (friends / world top-10 / your best). Watching the #1 ghost bank the impossible line *is the content* — and the tutorial.
- Anti-cheat inherits Concept 01's pattern: server re-simulates submitted input streams. Same deterministic core requirement, same clean solution.

## 3. Example Play Session (Daily Open, Hole 3: "Loading Bay")

Par 3. Tee on a rooftop; pin inside an open shipping container across an alley, guarded by an awning overhang. Wind 2 m/s left.

1. Player reads: direct lob dies on the awning. The dumpster in the alley is the obvious bank — but the container mouth faces *away*.
2. Shot 1: hard low drive off the far wall, hoping to ricochet in. Ball rattles the container roof, drops in the alley. Lie: gravel, dead.
3. Shot 2: from gravel, high flop with heavy backspin onto the container roof — bites, trickles off the lip... stops on the edge. Groan.
4. Shot 3: tap-in dink. Par. Bronze — but the leaderboard shows #1 did it in one: the ghost shows a *skip off the awning's support rail* through the mouth. Player rewatches it twice, files it away, and will absolutely try it tomorrow on practice.

That final beat — *seeing the better line exists* — is the retention loop in one screenshot.

## 4. Content Map & Progression

**v1.0 campaign: 8 venues × 9 holes = 72 authored holes.**

| Venue | Identity | New element |
|---|---|---|
| 1. The Lot | Parking structure | Basics: concrete, dumpsters |
| 2. Scrapyard | Junk stacks, magnets-off cranes (static) | Rails, springy wrecks |
| 3. Canal District | Water everywhere | The water skip |
| 4. Rooftops | Vertical descent holes | Awnings, chain-link catches |
| 5. Container Port | Moving cranes on cycles | Timed shots |
| 6. The Underpass | Low ceilings | Forced low-ball play, spin mastery |
| 7. Fairground *(night)* | Bumpers, chutes | Pinball physics celebration |
| 8. The Championship | All elements, tight pars | Medal-gated |

- **Unlockable balls (sidegrades, earned only):** Standard / Heavy (wind-immune, −15% distance) / Rubber (+bounce, harder to stop) / Tour (higher spin cap, unforgiving off-center draws). Ball choice per hole is strategy, not power.
- **Daily Open:** 5 holes assembled from a validated hole-segment grammar + 1 rotating authored "feature hole." One scored attempt (practice unlimited *after* submitting). Global/friends/division boards.
- **Weekly Major:** 18 authored holes, cumulative best-per-hole across the week — the grind-friendly format.
- **Seasonal divisions:** 10-tier promotion/relegation ladders on Daily Open points; ~100 players per division so mid-skill players see movement weekly.
- **Challenge links:** send any run's ghost as a URL — recipient plays against it instantly, no account needed (the PWA growth loop).

## 5. Screen Flow

`Venue map → Hole (play) → Scorecard → next hole` · `Daily Open lobby (board + countdown) → run → results vs. ghosts` · `Ghost theater (any hole, pick ghosts)` · Settings/locker (balls, trails).
Six screens. The hole view is the game.

## 6. Technical Architecture

- **Stack:** TypeScript; physics is a **bespoke 2D ball simulator** (~600 lines: one dynamic circle vs. static geometry — Lin's call: a full engine is overkill and bespoke gives us total feel control and easy determinism). Fixed-point or carefully-managed float math, 240Hz sim / 60fps render. PixiJS rendering. No worker needed — the sim is trivial.
- **Determinism:** the entire architecture leans on it (ghosts, re-sim anti-cheat, challenge links). One ball + static/cyclic geometry makes this the *easiest* determinism story of all four deep-dives.
- **Backend:** daily seed JSON on CDN; input-stream submission + server re-sim; division standings; ghost fetch by hole ID. All tiny payloads.
- **Offline:** full campaign offline; ghosts cached per hole.
- **Asset plan:** hand-painted venue backdrops (the big art cost) over reusable collision geometry; holes are data files (geometry + pin + par + dream-shot triggers) — designers author in an internal web editor from day one (which becomes the community editor someday).

## 7. MVP → v1.0 → Post-launch

- **Prototype (1–2 weeks):** one gray-boxed hole, full flick+spin input, material bounces, ghost replay of your own last run. *Kill criterion: if three team members don't fight over the phone, the feel isn't there yet.*
- **MVP:** Venues 1–3 (27 holes), medals, local ghosts.
- **v1.0:** 8 venues, Daily Open + divisions + challenge links, web push.
- **Post-launch cadence:** a venue (9 holes) every 4–6 weeks; seasonal cosmetics; community hole editor as the v2 flagship.

## 8. Open Questions for the Founder

1. **Perspective lock:** we've committed to 2D side-view for feel + determinism. Comfortable? (A ¾-view reads flashier in screenshots but Lin estimates 3× physics risk and worse one-thumb aim.)
2. **Daily attempt rule:** one scored attempt (tension, integrity — our lean) vs. best-of-three (friendlier, softer boards)?
3. **Tone of the world:** underground-hustler flavor with named rival characters on the boards, or keep it clean and abstract?

## 9. The Team's Bottom Line

Cheapest build of the four with the most proven comeback loop, and the input-stream/re-sim architecture makes ghosts, anti-cheat, and viral challenge links fall out of one design decision. The entire bet compresses into week one: does the flick feel *incredible*? Everything else is execution we know how to do.
