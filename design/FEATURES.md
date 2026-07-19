# REDSKY INC — Feature Overview
*A living document: what's live, what's building, what's next. Companion to FULL_GAME_PLAN.md.*

---

## ✅ LIVE NOW (playable at https://mojeh061718-oss.github.io/bf/)

### The Core Loop
- **Assembly Bay (3D):** KSP-style snap-together building on a rotating work stand — magnetic snap nodes with ghost previews, weight-scaled part physics (the stand dips under a heavy shell), inertial orbit camera, double-tap part focus, long-press info cards, 3-step undo/redo, chalk-tally attempt marks and coffee-ring decals that accumulate as you tinker.
- **The Close-Out (your hands are the physics):**
  - **Wiring Bench** — every device ships a printed schematic card whose tidy drawing never matches the shuffled physical panel; trace runs across a textured component board (battery, timer, relay, safety switch, detonator block — stamped labels, lot numbers, numbered screw terminals), pull wire from three AWG spools, torque every terminal. Wrong terminals are silently accepted and fail later, traceably. Wrong colors work but draw a dry inspector's aside.
  - **Continuity Tester** — clip two probes to any terminals; an analog needle tells the truth about that run. Certainty costs a minute; the range costs a morning.
  - **Detonator seating** — slow steady drag under a steadiness meter; slam it and the device remembers.
  - **Timer dial** — a hand-rotated vernier dial with detents, no digital readout; misread it and you're 0.3s off spec.
  - **Arm switch + checklist** that stamps ✓ / UNVERIFIED against your actual work — never telling you what's wrong.
- **Range Day:** dawn/noon/dusk desert with mesa depth-fog, wind, heat shimmer, pad dressing, a jackrabbit; skippable convoy cinematic hauling *your actual build* (with a pothole beat if you slammed the detonator); hold-to-arm, klaxon, countdown; **Station 7 long-lens camera** — silent flash, shock ring racing the desert floor, the boom arriving seconds later; crater aftermath slow-orbit with measured diameter drawn against the spec ruler.
- **Scorecard & Incident Reports:** three stamps (SIZE / TIMING / CLEAN), plain-language causes with a named physical root ("Run 4 landed on Terminal 6, not 5"), and one-tap TWEAK & REFIRE that restores your entire build. Convergence is the game: first wins take 2–4 honest attempts.

### Act I — The Shed (8 contracts, all live)
A teaching ladder where every RFP adds one idea: restraint on a mean budget (FIRECRACKER), the refinery (the Still), hand-set timing (EGG TIMER), heat that cooks off unstable loads (HOT PLATE), off-center crater placement via lopsided loading (SHAPED), a hard weight cap (FEATHERWEIGHT) — capped by **THE FLY-OFF**: side-by-side against Vantage Dynamics at dusk, line-by-line adjudication, and the Ordnance Weekly front page if you win.

### Systems & Meta (live)
- **The Refinery:** DISTIL (hold the temperature band — overcook and the batch scorches) and BLEND (pour with momentum to a line) stations; refined stock persists across contracts as a war chest.
- **Contract Board:** a corkboard of pinned RFP folders, locked ones redacted "CLEARANCE PENDING."
- **Incident Report Museum:** your framed disasters, a brass Wall of Firsts, best-crater plaques.
- **Vantage Dynamics:** the rival bids your contracts, usually over-engineered and over-priced, occasionally a public disaster — reported by the trade paper.
- **PWA:** installable (Add to Home Screen), offline after first load, save persistence with contract unlocks, settings (sound / skip cinematics / left-handed layout), seeded determinism (`?seed=`).
- **Fair by construction:** every outcome resolves deterministically from your build + seed; the full test suite (200+ assertions) runs headless on the same code the game ships.

---

## ✅ SHIPPED — M3a (all 5 stages + verification complete)

| Stage | Feature | Status |
|---|---|---|
| 1 | **Nomenclature:** FILLER 1A / F-1A, F-2S, F-1X, ADDITIVE G-3 — stockroom mil-spec designations with lot stencils; color bands stay | ✅ done |
| 2 | **Parts Drawer:** KSP-style left-edge drawer — category tabs (SHELLS · PAYLOAD · FUZING · POWER · TRIM + a sealed GUIDANCE tease), 2-column tile grid, auto-collapse on grab, silhouette-locked parts showing their unlock contract | ✅ done |
| 3 | **Build-Phase Rail:** STRUCTURE → PAYLOAD → SYSTEMS → CLOSE-OUT across the top of the bay; camera focus + drawer filtering per phase; scorecards attribute causes to phases | ✅ done |
| 4 | **Catalog Wave 1 (~10 new parts):** thin-wall shell, segmented casing (visible frag spray), ¼-size trim cells (the precision workhorse), dense-pack cell, inert ballast, large battery, shielded harness, delay relay, impact fuze nose, paint locker (incl. "Government Grey No. 2") | ✅ done |
| 5 | **RFP-066 "SKIPSTONE":** 9th contract — impact-fuze drop test onto a marked plate; placement band replaces the timing spec | ✅ done |
| — | Full verification: extended headless suite + browser regression on everything above | ✅ done |

---

## ✅ SHIPPED — M3b: The Workshop

- **The HQ:** the Redsky compound at dusk is the main menu — CONTRACT OFFICE, WEAPONS ASSEMBLY (unlocks with your first won contract), PRODUCTION BID BOARD (certified types only), THE MUSEUM — with the **company account** on the wall and a live production ticker when the floor is booked.
- **The company account:** development awards bank once per contract win; R&D shots and certification fees draw it down; production runs feed it. Old saves migrate with everything they ever banked.
- **Weapons Assembly (free R&D):** your bench, your dime, no spec sheet — the full bay + close-out, a persistent workbench that survives reload, and every shot expends the article at its as-built cost.
- **The Target Range (wave 1 — 3 objects):** DERELICT HAULER (penetration, mm-e — holes, tilts, and at full pen *leaves the ground*), WALL SECTION (breach % — off-centre opens less door; the lintel holds, embarrassed), INSTRUMENT ARRAY (overpressure in brandt, 12 panels shattering in order of honesty). No convoy — out the back gate, after hours, straight to Station 7.
- **Type Certification:** freeze the design, three tests (performance vs. the object's floor, consistency repeat graded A/B/C, a seeded abuse test — hot soak or washboard), stamped **PRODUCTION READY** on a brass type plate (RSK-1 "MULE") with a spec card of *measured* results. Calm builds certify ~90% mostly grade A; hot twitchy builds ~37% — repeatability punishes lucky builds, as contracted.
- **The Production Bid Board:** weekly seeded orders per certified type; a sealed-bid opening where the number climbs (grade, measured specs, reputation, and incident history set the ceiling); accepting books the workshop in real time and pays on delivery — with seeded **field-QA callbacks** root-caused to the design's true weak point, framed in the museum, and priced into the next auction.

## ✅ SHIPPED — The Gate & the premium survey (M3b wave 2, part 1)

- **Two worlds at the gate:** the title screen now offers **CAREER** (the ladder, real money) and the **SANDBOX LOT** — unlimited funds, the whole catalog unlocked from shot one, and the full R&D → certification → bid-board loop on its own save slice. Career progress is never touched by sandbox play; the buyers still have standards either way.
- **Premium detonation:** the blast owns the light — a point-light flare that washes the terrain, pad and target objects, decaying to ember red; ballistic ember arcs that land in their own dust.
- **Blast survey contours:** every crater now plots its **SCORCH** and **OVERPRESSURE** radii as animated rings on the dirt, labeled live during the measuring pass (career) and read out by the smug plotter (R&D).

## ✅ SHIPPED — GUIDANCE unsealed + interactive test cards (M3b wave 2, part 2)

- **The GUIDANCE drawer opens:** the **GYRO CORE G-7** (unlocks with THE FLY-OFF; free in sandbox) — a caged rotor in gimbal rings that multiplies every spatial error the load produces. Aligned well, it cancels drift (measured: mean off-centre 4.4 m → 1.0 m); left **uncaged, it argues with the fins and wins** (drift ×1.28). It tightens SHAPED breaches, SKIPSTONE drops, and every wall shot.
- **The Alignment Bench:** a real instrument — phosphor scope, wandering rotor dot, an amber trim crosshair you drag to hold the wander in-ring through a 6-second capture that gets meaner as it runs. Your in-ring percentage IS the calibration quality, stamped on the close-out checklist (✓ ALIGNED 95% / UNCAGED — UNVERIFIED).
- **Interactive test cards per object:** every range object now has a test setup chosen at the picker and *frozen into certification*:
  - HAULER — **CHARGE MOUNT**: CONTACT (deepest hole) vs STANDOFF (shallower, the hauler travels).
  - WALL — **AIM POINT**: BASE (honest), CENTRE (bigger door, lean punished double), LINTEL (less breach, but past 70% the whole panel comes down).
  - ARRAY — **STANDOFF**: 40/60/80 m — closer reads hotter, but **peg the gauges past 62 br and the data dies with the glass** (a pegged shot fails certification performance).
  Type plates and the bid board carry the test card (e.g. "STANDOFF CARD").

## ✅ SHIPPED — RECON 2: the aerial rig (M3b wave 2, part 3)

- **Fly the range:** a ✈ RECON 2 toggle during the pre-shot, countdown and aftermath swaps the fixed long lens for a **45° overhead camera you fly by touch** — one finger orbits and tilts, pinch zooms (26–320 m), the HUD reads your altitude. Watch the detonation from directly above: the flash washing the desert, the shock ring racing outward, embers arcing below you.
- **The survey is yours now:** while flying the aftermath, the auto-advance waits. **Tap the ground to drop survey stakes** — dashed range lines plot live from ground zero with distances — then **FILE THE SURVEY →** when you're done. The long lens remains the default; the plane is one tap away.
- **A desert worth flying over:** seeded ground dressing — creosote scrub, rock scatter, and red-flag survey stakes at 25/50/75/100 m on the cardinal lines (the aerial ruler).

## ✅ SHIPPED — THE LONG SHOT PROGRAM (strategic range)

A whole new mode from the compound's Far Gate: put a target 1–5,000 miles out and thread it.
- **Mission — the tactical map:** a radar plot with log-scale range rings and a compass; drag the target blip to set range + bearing. Difficulty (and flight time) scale with distance.
- **Build — a clean stepped stack:** pick AIRFRAME → PROPULSION → GUIDANCE → WARHEAD as cards, with a live capability readout (max range, accuracy class, mass, cost) and a hard reach check — a single-stage motor simply cannot make 5,000 miles.
- **Dial-in — the firing solution, by hand:** the pad hands you a deliberately *wrong* solution. Dial ELEVATION (loft), AZIMUTH (to a tenth of a degree), BURN CUTOFF (range set), and align the GUIDANCE GYRO on the bench. A nav computer rates the solution coarse → close → nominal, but never gives the answer.
- **Flight — real-time mission control:** a live trajectory plot with the article arcing to the target, telemetry (altitude / downrange / velocity), tracking-station handoffs, and a WARP button. Duration is honest to distance — ~5 s at 5 miles, ~47 s at 1,000, ~93 s at 5,000.
- **The skill is everything:** careless dialing misses by tens of miles (worse the farther out); a tight solution + the right guidance can bullseye any range. Verified — random launch missed by 71 mi, a dialed-in launch hit at 0.29 mi.
- **Three target types:** a **FIXED INSTALLATION** (any warhead), a **HARDENED BUNKER** (shrugs off a light warhead — bring a HEAVY, or score a direct hit to penetrate), and a **MOVING CONVOY** that drifts through the flight — the map draws a LEAD marker at the predicted intercept and you must aim there, not where it sits now. Verified: fail-to-lead misses 20/20, a led shot hits 20/20; a light warhead never cracks the bunker (0/20) while a heavy destroys it (20/20).
- **The 3D terminal descent:** the last seconds play as a real 45°-down 3D view of the target — concentric hit rings and a bull on a lit desert floor, the article reentering nose-first with a fire trail, a live T− countdown, then a detonation with expanding shock ring and camera shake. Framerate-independent (wall-clock), so it plays in real seconds at 120 fps on device.
- **Record board + saved firing solutions:** every hit is scored (range × accuracy × target difficulty) and ranked on a top-15 board; you can name and save a firing solution and re-LOAD it later straight onto the dial. A hit also pays a Program bounty in career.
- **The cinematic strike (rework):** the terminal descent is now a real movie. A keyframed camera sits downrange and looks back up the trajectory so the article visibly **grows as it screams in** — nose glowing, wrapped in a plasma sheath, a hot reentry trail and a smoke contrail behind it — over a textured desert floor with glowing target rings under a dusk sky. The final approach ramps into **slow-motion**, freezes for a **hitstop** on contact, then a **flash that lights the whole desert** (a real point-light), an expanding shockwave dust ring, a rising smoke column, a burn scar, camera shake and a screen-punch. The mission-control arc **auto-warps** the boring mid-course to a tight montage (with a SKIP), so the descent is the event, not the wait. The program is **ungated** — open from the start and front-and-centre in the compound, with on-screen direction on the mission screen.

## ✅ SHIPPED — The full graphics rework (three-artist pass)

A ground-up visual rebuild by three specialists working in parallel, integrated and re-verified:
- **The Assembly Bay is a workshop now** — painted concrete floor with saw-cut joints, an amber "ASSEMBLY ZERO · KEEP CIRCLE CLEAR" work circle, hazard-striped roll-up door, workbench with a shadow-board (one spanner missing), stores rack, waste-oil drum, traffic cones; a real hydraulic work stand (barrel, polished ram, cradle pads, hanging pendant control); tungsten cage lamps with dust motes drifting in the key light. (~6k tris, 2048px floor.)
- **The desert is a surveyed test range** — a 2048px macro terrain skin (bleached playa disc, mud-crack polygons, a braided dry wash, tire-track history, chalk datum circles at 25/50/75/100 m, "RANGE 7" ground stencil); a full pad complex (concrete apron with expansion joints + stencils, blockhouse, lattice camera tower, sandbag ring, cable runs, light poles that glow at dusk, wind sock); strata-banded mesas; three genuinely cinematic hours (dawn pale-gold, noon bleached, dusk ember-violet). (~5k tris.)
- **Every part is a crafted product** — canvas texture skins on the shells (rolled-steel panel lines, rivets, stenciled designations + lot numbers, hazard bands, edge-wear AO), embossed ribbed canisters, machined system parts (dials, terminal blocks, brass gimbal), and the targets rebuilt (a real truck silhouette with rust patina, board-formed concrete wall with rebar stubs, proper instrument racks); layered crater rim. (~4k tris.)

Determinism preserved bit-identical (RFP-041 crater 21.744239379489592); zero page errors across bay-build, career range-day, and aerial-survey harnesses.

## ✅ SHIPPED — The premium rendering pass (M3b wave 2, part 4)

- **Real shadows on the range:** the sun casts a 2048 PCF-soft shadow map over the play area — walls throw long dusk shadows, the article shades the pad, scrub and stakes anchor to the dirt. The aerial view earns it most.
- **A real sky:** a gradient dome per hour (not a flat backdrop), a sun with a disc and halo that moves with the palette, and seven patient seeded clouds tinted dawn-gold / noon-white / dusk-ember. The recon plane can look up now.
- **The desert reads like dirt:** a 1024px seeded speckle-and-strata detail texture, anisotropically filtered, repeated under the vertex shading.
- **Filmic pipeline:** ACES tone mapping (exposure 1.32), native pixel ratio up to 3× on modern phones, doubled FX texture resolution (fireball/smoke/dust sprites 256px, scorch decal 512px).

## 📋 NEXT — M3b wave 2 (remainder)

- More target objects (the decommissioned bunker, stacked containers), per-object range scarring, richer auction drama, production-run vignettes.

## 🗺 THE ROAD BEYOND (M4–M6, planned in FULL_GAME_PLAN.md)

- **M4 — The Living Game:** Weekly RFP (same seeded contract for everyone, leaderboard), free-build sandbox with shareable replay links, season 1.
- **M5 — Act II "The Works":** precision era — proximity/airburst contracts, weather (wind drift, cold-glove close-outs), staff hires, deeper Vantage adaptation, catalog toward 40+.
- **M6 — Act III "The Program" + 1.0:** the **Long Shot Program** — hand-aligned gyros, paper-map flight planning, star-tracker calibration, then a missile flight to an instrumented target *thousands of miles away*, watched live from Mission Control with tracking-station handoffs and a real-time mode where the terminal phase arrives as a push notification. Multi-test campaigns, the Centennial Demonstration finale, prestige.

---
*Standing rules across all of it: all science invented; outcomes trace to the player's hands; failure always names its cause; challenging never means confusing — the player must always know what to try next.*
