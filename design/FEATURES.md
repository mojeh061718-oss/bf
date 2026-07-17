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

## 📋 NEXT — M3b: The Workshop (starts when M3a ships)

- **The HQ:** an establishing shot of the Redsky compound as the main menu — Contract Office, Weapons Assembly, the Still, the Museum.
- **Weapons Assembly (free R&D):** build anything from your unlocked catalog on your own dime — no spec sheet watching.
- **The Target Range:** test R&D builds against **objects** — derelict trucks, concrete wall sections, a decommissioned bunker, glass instrumentation arrays — each measuring differently (breach %, penetration, overpressure), each with its own long-lens payoff.
- **Type Certification:** freeze a design and pass a 3-test standards series (performance, consistency repeat, abuse test) → stamped **PRODUCTION READY** with a type plate (RSK-7 "Sledge") and a spec card of *measured* results.
- **The Production Bid Board:** fictional buyers post orders and bid on your certified types — a short, tense auction; better measured specs and cleaner incident history pull bigger money. Production runs book the workshop and pay on delivery, with occasional field-QA callbacks that feed the next design generation.

## 🗺 THE ROAD BEYOND (M4–M6, planned in FULL_GAME_PLAN.md)

- **M4 — The Living Game:** Weekly RFP (same seeded contract for everyone, leaderboard), free-build sandbox with shareable replay links, season 1.
- **M5 — Act II "The Works":** precision era — proximity/airburst contracts, weather (wind drift, cold-glove close-outs), staff hires, deeper Vantage adaptation, catalog toward 40+.
- **M6 — Act III "The Program" + 1.0:** the **Long Shot Program** — hand-aligned gyros, paper-map flight planning, star-tracker calibration, then a missile flight to an instrumented target *thousands of miles away*, watched live from Mission Control with tracking-station handoffs and a real-time mode where the terminal phase arrives as a push notification. Multi-test campaigns, the Centennial Demonstration finale, prestige.

---
*Standing rules across all of it: all science invented; outcomes trace to the player's hands; failure always names its cause; challenging never means confusing — the player must always know what to try next.*
