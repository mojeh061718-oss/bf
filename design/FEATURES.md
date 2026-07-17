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

## 📋 NEXT — M3b wave 2 (remainder)

- More target objects (the decommissioned bunker, stacked containers), per-object range scarring, richer auction drama, production-run vignettes.

## 🗺 THE ROAD BEYOND (M4–M6, planned in FULL_GAME_PLAN.md)

- **M4 — The Living Game:** Weekly RFP (same seeded contract for everyone, leaderboard), free-build sandbox with shareable replay links, season 1.
- **M5 — Act II "The Works":** precision era — proximity/airburst contracts, weather (wind drift, cold-glove close-outs), staff hires, deeper Vantage adaptation, catalog toward 40+.
- **M6 — Act III "The Program" + 1.0:** the **Long Shot Program** — hand-aligned gyros, paper-map flight planning, star-tracker calibration, then a missile flight to an instrumented target *thousands of miles away*, watched live from Mission Control with tracking-station handoffs and a real-time mode where the terminal phase arrives as a push notification. Multi-test campaigns, the Centennial Demonstration finale, prestige.

---
*Standing rules across all of it: all science invented; outcomes trace to the player's hands; failure always names its cause; challenging never means confusing — the player must always know what to try next.*
