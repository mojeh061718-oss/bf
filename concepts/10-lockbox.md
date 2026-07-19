# Concept 10 — LOCKBOX
### Storage-Auction Appraisal & Flipping
*Team original — knowledge-as-skill, wrapped in an auction thriller*

---

## 1. Elevator Pitch

The roller door rattles up. You get one look — thirty seconds, from the doorway, no touching — at a storage unit full of shadows and maybes. Is that a vintage amp or a fire hazard? Then the auction starts, and four rivals who want it as badly as you do start pushing the price. Lockbox is a game about *knowing what things are worth*: win units, dig through them, appraise, restore, and flip your finds — and get genuinely, measurably better at it with every unit you open.

## 2. Fantasy & Tone

The player is the sharp-eyed picker every auction crowd fears — part appraiser, part gambler, part archaeologist of other people's lives. Tone: treasure-hunt warmth with a hustler's edge; units occasionally tell quiet human stories (a boxed wedding dress, decades of postcards) that the game treats with a light, respectful touch. Art: rich illustrated clutter you *want* to dig through; the flashlight-sweep reveal is the signature visual. Audio: the door rattle, auctioneer patter, the papery rustle of digging, the ka-ching restraint of a good flip.

## 3. Core Loop (minute to minute)

1. **The Look** — 30 seconds, pan a flashlight across the unit from the doorway. Skill #1: *reading tells* — box brands, dust patterns, how things are stacked. A water stain on cardboard means something. You learn what.
2. **The Auction** — live bidding against AI rivals with persistent personalities, budgets, specialties, and tells (Marlene always wants furniture; Tycho bids fast when he's bluffing). Skill #2: *reading people* — and managing your own bankroll fever.
3. **The Dig** — won a unit? Excavate it layer by layer (tap/drag clearing with tactile physicality). Finds surface: obvious junk, obvious gems, and the deep middle of *maybes*.
4. **The Appraisal** — Skill #3, the heart of the game: inspect items (zoom, flip, check marks and serials), consult your growing **Field Guide**, spot fakes and damage, decide: quick-flip cheap, restore (time + cost + risk), or hold for the right buyer.
5. **The Flip** — sell through channels with different personalities: pawn (instant, lowball), collectors (patient, picky, pay premiums), market stalls (volume). Haggling is a light read-and-counter interaction.

## 4. Session Shape

One auction-and-dig cycle: 5–8 minutes — a perfect pocket loop. A daily circuit (3 units) is a 15-minute ritual. Restorations complete across sessions, giving gentle return hooks without idle-game rot.

## 5. Progression & Retention (the day-14 answer)

- **Day 1–3:** Local circuit, small units, forgiving rivals. The Field Guide starts filling in — and the player starts *actually learning* (real-ish appraisal knowledge: maker's marks, materials, condition grading of fictional-but-consistent brands).
- **Day 4–7:** Regional circuits with themed units (estate clears, business liquidations, the legendary "musician's locker"); rival cast deepens; restoration workshop unlocks; collector relationships open (know *who wants what* = second knowledge layer).
- **Day 7–14:** **The knowledge meta is the retention engine** — this is a game where day-10 you is measurably better than day-1 you, and the game proves it (appraisal accuracy stats, profit-per-unit trends). **Daily Circuit**: same three units for everyone, one attempt, profit leaderboard — identical information, different reads.
- **Day 14+:** Seasonal leagues across new regions; **Collection meta** (complete themed sets across many units for prestige and museum displays); rare "white whale" items with hunt-arcs; weekly special auctions (blind-bid formats, everything-must-go liquidations). New item-lore packs are the cheap, steady content drip.

## 6. Content Ceiling

High: content = item catalogs with lore (cheap, parallelizable authoring), unit archetypes, rival characters, auction formats, regions. Procedural unit-stuffing over authored item pools means dailies are near-free. The Field Guide's expanding depth *is* the content players consume.

## 7. Monetization Notes

Out of scope. Hard rule: never sell information (appraisal hints) or bankroll — knowledge is the product. Cosmetic van/flashlight/museum themes fit if ever needed.

## 8. PWA Feasibility

- **Excellent.** 2D illustrated scenes, light tap/drag interactions, no physics engine, no real-time multiplayer — AI rivals give the auction tension locally. Fully offline core; small backend for daily circuits/leaderboards.
- **Web push:** "Daily circuit is live" + restoration-complete notices — gentle and native to the fiction.
- Asset weight is the one watch-item (lots of item illustrations); mitigated by vector-style art and lazy-loaded packs.

## 9. Development Complexity

**S–M.** The gentlest build on the list. Hardest problem: **the appraisal knowledge system** — designing a fictional-but-coherent object universe deep enough that expertise is real, learnable, and satisfying to wield (this is content design, not engineering). Second: auction AI that's fun to read without being exploitable in one session.

## 10. The Team's Verdict

**Priya:** "Knowledge-based mastery is the most underrated retention mechanic in mobile — players stay where they feel themselves getting smarter, and the daily same-units-different-reads leaderboard is a beautiful proof of skill." **Mara:** the moment-to-moment loop (look → bid → dig → appraise) has four distinct thrills in eight minutes — exceptional pacing density. **Deke:** lightest engineering on the list with a real endgame. Weakness: broad-casual on the surface but its depth is quiet — marketing must show the *knowledge* fantasy or it reads as a minigame collection. Also the least "big-game" prestige of the ten; it wins by charm and stickiness, not spectacle.
