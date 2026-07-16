# Concept 07 — ANTE UP CITY
### A Street-Trader Economy Sim
*Team original, in the spirit of seed idea #2's rags-to-riches arc — but purely economic*

---

## 1. Elevator Pitch

Start with $100 and a backpack. End the season owning the city's supply chains — or broke behind the flea market, again. Ante Up City is a pure trading game across a living urban economy: buy low in the pawn shops of the east side, sell high to the vintage boutiques uptown, learn what moves prices, and graduate from flipping sneakers out of a bag to running warehouses, crews, and market corners. Every price you see moved because of something — and eventually, because of *you*.

## 2. Fantasy & Tone

The player is a hustler with an eye — the person who knows what a thing is worth before the seller does. Tone: quick, streetwise, optimistic; the con is knowledge, never cruelty. Art: bold graphic city map with characterful district identities; goods rendered as satisfying card-objects with condition states. The diegetic phone returns (market app, tip-line texts, ledger). Audio: market chatter, cash-register percussion, a soundtrack that upgrades with your net worth.

## 3. Core Loop (minute to minute)

1. **Read the market** — district price boards for goods categories (electronics, vintage, parts, collectibles, produce...). Prices move on a simulated supply/demand engine plus **news events** ("port strike — electronics up citywide," "festival this weekend — vintage demand spikes uptown").
2. **Move & trade** — travel between districts costs time blocks (the core scarcity). Buy inventory up to your carry capacity; haggle mini-interactions with characterful vendors (reads and timing, not RNG).
3. **Work the angles** — tip-line rumors (sometimes wrong), quality appraisal (spot the cracked casing before you pay), short-term arbitrage vs. holding for the event you *know* is coming.
4. **Scale** — capacity upgrades (bike → van → storage unit → warehouse), hire runners to execute trades in districts you're not in, eventually *make* markets (corner enough supply and the price engine responds to you).

## 4. Session Shape

A day of in-game trading = 3–5 minutes. Runs are season-length (see below) but built from pocket-sized decisions; nothing real-time, everything resumable. Runners give a light "check what happened" cadence between sessions without idle-game rot.

## 5. Progression & Retention (the day-14 answer)

- **Day 1–3:** Solo career mode teaches the price engine, districts, and appraisal. First van purchase is the "I'm somebody now" beat.
- **Day 4–7:** Deeper systems open: credit (leverage with teeth), rival traders (AI characters competing for the same arbitrage — beat them to the tip or eat their price impact), reputation per district unlocking back-room inventory.
- **Day 7–14:** **Seasons are the engine**: a 4-week ladder where everyone starts a fresh $100 run on the same seeded economy. Global + friends leaderboards on net worth, plus title tracks ("Most Made From One Flip," "Cleanest Season" — no credit used). Mid-season shocks (announced storms, unannounced crashes) reshuffle strategies.
- **Day 14+:** Season-end reveals, prestige badges, and a new season with a mutator ("cash-only season," "the port is closed"). Legacy meta: permanent cosmetic prestige + new starting *origins*, never economic advantages. Weekly one-day sprint events ("$50 to the moon Saturday") between seasons.

## 6. Content Ceiling

High and cheap: the simulation generates the daily texture; content = new districts, goods categories, event scripts, rival characters, season mutators. Balancing the economy is the ongoing work, not authoring levels — a systems-designer's game, not a content mill (the counterpoint to Concept 03's writers'-room appetite).

## 7. Monetization Notes

Out of scope. Hard rule: nothing purchasable touches the economy or seasons. Cosmetic prestige only.

## 8. PWA Feasibility

- **Excellent.** UI-forward, no physics, tiny assets, fully offline-capable career; the seasonal seeded economy syncs a seed + event schedule (small JSON) and submits scores. Simulation is trivially cheap compute.
- **Web push:** season shocks ("Port strike just hit — electronics markets moving") are *fictionally native* push notifications — the best push-story on the list.
- IndexedDB for deep local save; deterministic seeded engine for fair leaderboards.

## 9. Development Complexity

**S–M.** The lightest honest build on the list next to #02. Hardest problem: **economy tuning** — the price engine must be learnable-but-deep, and rubber-banding rivals without faking it. Second: making late-game market-making feel earned rather than spreadsheet-y. Zero exotic tech.

## 10. The Team's Verdict

**Deke:** "This is *my* genre bias, admitted — but seeded seasonal economies are criminally underused on mobile, and the push-notification fiction alone ('the port just closed') is worth the build." **Priya:** season-ladder retention is proven; her caution is first-session appeal — trading games open slower than action games, so the first 10 minutes need a scripted heater. **Mara:** wants the haggle interaction prototyped early; if vendor interactions feel human, the game has a soul, not just a spreadsheet. Weakness: shares the rags-to-riches lane with #03 and #09 — differentiate by being the *systems-mastery* entry (leaderboard brain) versus #03's *story* entry (biography heart).
