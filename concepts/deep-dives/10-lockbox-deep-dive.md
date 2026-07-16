# DEEP DIVE 10 — LOCKBOX
### Storage-Auction Appraisal & Flipping — Full Design Treatment
*Expands [concepts/10-lockbox.md](../10-lockbox.md)*

---

## 1. Design Pillars

1. **Knowledge is the character sheet.** The game never levels you up — *you* level up. Everything the player earns is earned by genuinely knowing more than they did last week.
2. **Information is always partial.** Thirty seconds from the doorway, edges of boxes, a corner of brass under a blanket. The game deals in maybes; certainty is what you're buying.
3. **Every unit tells a story.** Someone packed these boxes. The best units read like short fiction told in objects — treated warmly, never cruelly.
4. **Rivals are the difficulty.** No timers-of-doom, no rigged luck: the pressure is four other buyers who want it too and know things you don't.

## 2. Core Systems — Detailed Spec

### 2.1 The Look (skill #1: reading containers)
- 30 seconds, flashlight sweep from the doorway (drag to aim the beam; the cone is the fog-of-war reveal). No touching, no entering.
- **Tell grammar** (the learnable language): box brands (a "Meridian Movers" box = professional move = decent goods; liquor-store boxes = hasty pack), dust gradients (undisturbed 10 years vs. recently rummaged — rummaged means the good stuff may be gone), stack logic (heavy-on-bottom careful stacks vs. dumped), furniture era silhouettes, case shapes (guitar? rifle? sewing machine?), climate damage (water stains on cardboard kill paper/photo/electronics value below that line).
- The player's **Field Guide** auto-logs every tell they've *confirmed* (bought the unit, dug it, learned the truth) — so the tell system teaches itself through play.

### 2.2 The Auction (skill #2: reading people, managing fever)
- Live ascending auction against 3–4 AI rivals from a rotating cast of ~10 characters. Each has: **specialty** (Marlene wants furniture; Tycho chases electronics; Ba wants anything sealed), **bankroll** (visible-ish through behavior — a rival who just won two units is thin), **valuation model** (they saw the same look you did, and value what *they* saw through their specialty), and **tells** (Tycho re-bids fast when bluffing past his number; Marlene goes quiet-then-jumps when she's serious; Ruth's cap always ends in $25).
- Bidding UI: big BID button (+increment), press-and-hold to jump-bid (slider). Heart-rate style **Fever meter** rises as you chase past your pre-set budget line — purely informational, but it teaches bankroll discipline the way poker teaches tilt.
- **Auctioneer patter** is the pacing engine (synthesized rhythmic chant, accelerating) — going-once/going-twice windows create genuine snap decisions.

### 2.3 The Dig (the tactile payoff)
- Won units excavate in layers: tap-drag to lift/shift items with weighty, physical animation. Items emerge as **unknowns** ("heavy small box," "framed something") until handled.
- Dig order matters lightly: fragile-under-heavy (pull the heavy crate first or risk crunch), locked containers within the unit (footlockers, safes — keys sometimes elsewhere in the unit; unopened safes sellable as-is to gamblers, or cracked via locksmith cost).
- **Story beats:** ~15% of units carry an authored narrative thread (the wedding dress with the unsent letters; decades of numbered postcards). Handled with dignity — some threads offer a **Return It** choice (find the family) that pays reputation instead of cash. Reputation opens estate-sale invitations (premium content).

### 2.4 The Appraisal (skill #3, the heart)
- Inspection view: rotate/zoom an item, directed by *your own suspicion* — check the bottom for maker's marks, raise the lid, look for repairs. Verbs: **flip / open / test / weigh / blacklight** (tools expand verbs).
- **A fictional-but-coherent object universe:** ~40 collecting domains at v1.0 (fictional brands with consistent internal logic — "Halcyon" radios, "Brandt & Vogel" watches, "Kestrel" guitars — each with era markers, fake-detection cues, condition grammar, and price bands). Fictional keeps us legally clean *and* lets us design the knowledge tree with perfect difficulty curves: every domain has 3 tiers (spot the category → spot the model/era → spot the fake/rarity).
- **The Grade:** player commits an appraisal (category, era, condition, authenticity) *before* seeing truth. Accuracy is tracked per domain — the game's real XP bar. High accuracy in a domain unlocks *faster* recognition UI (veteran eyes see the maker's mark tooltip instantly): expertise literally changes the interface.

### 2.5 The Flip (closing the loop)
- Channels with personalities: **Pawn** (instant, 45–60%, no questions), **Market stall** (weekend, volume, haggling mini-reads: counter the lowball, read the walk-away bluff), **Collectors** (patient, picky, 110–140% for *exactly* what they want — a want-board makes holding inventory strategic), **Auction house** (consignment; big fees, big ceilings, weeks of delay).
- **Restoration workshop:** time + parts + a risk roll informed by *your* condition appraisal (misjudge the water damage and the restoration reveals it, tanking value). Restores complete across real sessions — the gentle comeback hook.

## 3. Example Play Session (11 minutes)

Daily circuit, unit 2 of 3. The look: Meridian boxes (careful pack), a dust-free lane to the back (rummaged — bad sign), one guitar-case silhouette under moving blankets, water stain on the bottom-left cardboard.

1. Player's read: rummaged lane says the obvious gems are gone, but the case is *behind* the rummage line — missed? Sets budget $260.
2. Auction: Tycho opens fast (bluff pattern), Marlene silent... then jumps at $180 (serious). Player rides to $240; Marlene's cap breaks at $250— player wins at $250, fever meter kissed the line but held.
3. Dig: top layers confirm rummage — cables gone, boxes lighter. But the case: a "Kestrel Courier" flat-top guitar. Inspection: headstock logo font is the pre-'62 slant (Field Guide pings — player *confirmed* this tell two weeks ago), but the finish is suspiciously glossy → blacklight → overspray. Refinished: real, early, but not collector-grade.
4. Appraisal committed: authentic, early era, refinished/good. TRUTH: exact — accuracy streak +1, Kestrel domain hits Tier 2 (era-marks now auto-tooltip).
5. Flip: the want-board shows a collector seeking "player-grade vintage Kestrel" — 125%: $410. Net +$142 on the unit, and the *knowledge* gained outlasts the cash.
6. Session close: circuit summary, profit leaderboard percentile, one Field Guide page visibly more complete.

## 4. Content Map, Meta & Retention

- **Career:** local lot → 5 regional circuits (suburban, urban, coastal estate, industrial, the legendary Airport Impound) — each region skews domains (coastal = nautical antiques; industrial = tools/machinery) so *regional expertise* becomes a thing.
- **Daily Circuit:** 3 seeded units, same for everyone, one attempt, profit leaderboard — identical information, different reads; post-run reveal shows what the top players saw that you didn't (the teaching loop).
- **Collections meta:** themed sets assembled across many units (the complete Halcyon radio line) feed a **Museum** — prestige display + permanent small perks (the radio wing = +1 electronics tell).
- **Seasonal leagues** per region; weekly special formats (blind-bid sealed units, everything-must-go liquidations, "estate day" invitationals gated by reputation).
- **White whales:** 6–8 legendary items per season with rumor trails ("someone in the coastal circuit found the case but not the violin").
- Post-launch drip: a domain pack (fictional brand universe + tells) every 4–6 weeks — cheap, parallelizable authoring; new rival characters; new regions.

## 5. Screen Flow

`Circuit map → The Look (timed) → Auction → (won) Dig → Item inspection/appraisal → Inventory/Flip channels → Circuit summary`
Meta: Field Guide / Museum / Want-board / League standings / Workshop. The inspection view is the polish centerpiece.

## 6. Technical Architecture

- **Stack:** TypeScript + Canvas/WebGL (PixiJS) for the look/dig scenes; DOM UI for auction/appraisal/meta. No physics engine (dig weight is animation craft). Smallest tech footprint in the portfolio.
- **Item system:** items = domain + model + era + condition-vector + authenticity flags, rendered from layered vector sprite parts (era marks, wear decals, damage overlays) — one guitar model yields hundreds of visually-distinct instances; the *marks are actually on the art*, so inspection is honest looking, not menu-reading.
- **Unit generator:** seeded, grammar-based packing (an authored "household profile" — musician, seamstress, contractor — stuffs a unit coherently). Deterministic seeds for daily circuits.
- **Rival AI:** valuation = their specialty-weighted read of the same look-data + bankroll state + personality bidding curve; tells are honest emissions with noise. Fully local.
- **Backend:** daily seeds, profit submission (validated by replaying the seed + decision log — same input-log anti-cheat pattern as the rest of the portfolio), league standings, reveal-comparisons.
- **Offline:** full career offline; asset packs lazy-loaded per region to keep first-load slim.

## 7. MVP → v1.0 → Post-launch

- **Prototype (2 weeks):** one unit, look → auction vs. 2 rivals → dig → appraise 8 items across 3 domains → pawn/collector flip. *Kill criterion: does the moment of committing an appraisal before the reveal produce a visible lean-in? That tension is the whole game.*
- **MVP:** local + 1 region, 15 domains, 6 rivals, Field Guide, workshop.
- **v1.0:** 3 regions, 40 domains, daily circuit + league backend, museum, want-board, push.
- **Post-launch:** domain packs, regions, white-whale seasons, estate invitationals.

## 8. Open Questions for the Founder

1. **Story-thread tone:** the human traces in units (letters, keepsakes) — lean in (with the Return It mechanic) or keep it light-comedy? We recommend leaning in; it's the memorable 15%.
2. **Real-knowledge flavor:** domains are fictional brands, but tells can echo real appraisal logic (dovetail joints, patina honesty). How "genuinely educational" do you want it to feel?
3. **Auction speed:** authentic rapid-chant (tense, but stressful for some players) vs. relaxed turn-based bidding? We propose chant with an accessibility "calm auction" toggle.

## 9. The Team's Bottom Line

Lockbox is the portfolio's quiet compounder: the lightest build after Trickshot, no exotic tech, and a retention engine — knowledge-as-progression — that mobile almost never does honestly. Its risk was never buildability; it's marketing a game whose depth is invisible in screenshots. The daily circuit's "same units, different reads, then see what the winner saw" reveal is our answer: it makes the invisible skill *visible* every single day. If the appraisal-commit moment tests well, this is the sleeper hit candidate.
