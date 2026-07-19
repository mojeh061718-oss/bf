# Concept 08 — HEXEN DRAFT
### A Run-Based Roguelite Builder With Original Mechanics
*Team original — the retention-proven genre, with our own core*

---

## 1. Elevator Pitch

A 20-minute run: draft hex tiles into a small board that *is* your character — each tile a spell, a trigger, or a mutator, and adjacency is everything. Enemies attack the board itself, breaking tiles and forcing mid-fight rebuilds. Every run reshuffles what's draftable; every loss teaches; every unlock bends the next run sideways. It's the deckbuilder itch — but your "deck" is a living mosaic you can see, and position is power.

## 2. Fantasy & Tone

The player is a hexmage assembling a working spell-engine from scavenged fragments. Tone: arcane-workshop cozy-with-teeth — inviting art, ruthless decisions. Visual identity: the hex board *is* the screen's centerpiece; tiles glow and chain visibly when they trigger, so a good engine *looks* like a pinball machine paying out. Audio: chimes and cascades that make combo chains audibly addictive (the Balatro lesson: the sound of synergy is half the drug).

## 3. Core Loop (minute to minute)

1. **Fight** — turn-based rounds. Enemies telegraph attacks that target *specific board tiles*. You cast by tapping tiles; casting a tile triggers its neighbors' passive effects (the adjacency engine). Positioning tiles well = free value every turn.
2. **Take damage structurally** — hits crack tiles (weakened) then break them (a hole in your engine). Mid-run repair vs. replace vs. build-around is the constant tension. Your health *is* your machine.
3. **Draft** — after each fight, pick 1 of 3 tiles and choose *where it goes* — every draft is simultaneously a card pick and a positional puzzle.
4. **Route** — node map between fights: elites (better tiles, structural risk), forges (fuse two adjacent tiles into a hybrid — the build-defining moments), events, shops.
5. **Boss** — bosses attack in patterns that stress specific board shapes; a build that cruised the act can be structurally countered, demanding adaptation, not just scaling.

**The original mechanics, stated plainly:** (a) adjacency-triggered engine on a spatial board, (b) damage breaks the board itself, (c) drafting is placement. No mana curve, no hand, no discard pile — this is not a card game wearing a costume.

## 4. Session Shape

A run: 20–30 minutes, but cleanly segmented — save-anywhere between nodes makes 3-minute nibbles viable. A run is the natural session; the post-run unlock screen is the natural close.

## 5. Progression & Retention (the day-14 answer)

This genre owns day-14+ retention; we inherit the full stack:

- **Day 1–3:** First wins on the base tile pool; unlock cadence delivers a new tile or mechanic every run or two.
- **Day 4–7:** New **Frames** (starting board shapes + signature tile = classes) that force different archetypes; harder difficulty ranks (ascension-style modifiers) for each Frame.
- **Day 7–14:** **Daily Seed** — same draft offerings for everyone, one attempt, score leaderboard; **Weekly Gauntlet** with a build-warping modifier ("all tiles are cracked," "board is a ring"). Run-history codex tracks your best engines.
- **Day 14+:** Rank climbing per Frame (the "20 wins × 12 Frames × rank ladder" goal lattice = hundreds of hours), seasonal tile-set rotations, and challenge runs. Deke's note: this genre's day-30 retention curves are the best in premium mobile — that's *why* it's on the list despite being furthest from the seed ideas.

## 6. Content Ceiling

Very high per authoring dollar: one new tile interacts with every existing tile (combinatorial content). Frames, bosses, events, and seasonal sets are the drip. The risk is not ceiling but *balance debt* — every addition multiplies test surface.

## 7. Monetization Notes

Out of scope. Genre norm is premium/cosmetic; anything selling power in a leaderboard roguelite is disqualifying.

## 8. PWA Feasibility

- **Excellent.** Turn-based, 2D, deterministic by construction (seeded RNG is a genre requirement, not a chore). Fully offline runs; tiny backend for daily seeds/leaderboards.
- Web push: daily seed + weekly gauntlet.
- The one technical demand is *juice* — the trigger-cascade VFX/audio must be lush at 60fps; PixiJS/WebGL territory, entirely manageable.

## 9. Development Complexity

**M.** No hard tech. The hardest problem is **design originality under the shadow of giants** — the adjacency/structural-damage core must prove in prototype that it generates "one more run" pull on its own, not as a Slay-the-Spire homage. Second: balance across the combinatorial tile space (mitigation: aggressive telemetry from day one). Content pipeline is the long-term cost, but it's the genre's cheapest.

## 10. The Team's Verdict

**Deke:** "Highest-confidence day-14 retention on the list, full stop — the genre's loops are load-tested by the whole industry." **Mara:** the spatial/structural core is genuinely fresh, and 'your health is your machine' is a one-sentence hook that designers will envy; her caution is that it's the least connected to the user's own seed ideas, and founder passion matters at 2 a.m. **Sam:** enemy AI that reads board shapes and targets structural weaknesses is a delicious, tractable problem. Weakness: crowded prestige genre — we win on the core mechanic or not at all. The team's pick for "safest retention bet, boldest design bar."
