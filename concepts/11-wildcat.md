# Concept 11 — WILDCAT *(The Wild Card)*
### Oil-Boom Simulation: From Empty Pockets to Oil Baron
*Founder's wildcard — rags-to-riches through an interactive oil rig operation. Reference touchstone: Turmoil (Apple Arcade's Turmoil+) for interactivity and upgrade cadence; our version aims more modern, sleeker, and with a stronger long-arc career.*

---

## 1. Elevator Pitch

You arrive at the oil fields with a rented derrick, a bank loan, and a shovel-hard conviction that there's crude under this dirt. Survey the land, steer the drill around bedrock and gas pockets, strike oil, and sell when the market spikes — then plow every dollar into better bits, bigger tanks, and bolder leases. WILDCAT is a hands-on tycoon game where the drilling is a skill, the market is a rhythm, and every upgrade visibly changes how your operation looks, sounds, and earns.

## 2. Fantasy & Tone

The player is the underdog wildcatter in a boomtown of suits — the one who reads the land better than the geologists. Tone: optimistic frontier hustle with a modern edge; the boomtown grows as you do. Art direction: **sleek flat-modern** — clean geometric terrain cross-sections, luminous oil, crisp UI cards, smooth motion everywhere; think premium fintech app meets frontier sunrise, not dusty sepia. Audio: satisfying mechanical thunks, the rising gurgle of a strike, the cash-register *thrum* of a well-timed sale.

## 3. Core Loop (minute to minute)

1. **Survey** — limited sonar charges ping the underground; readings reveal pocket edges, never the whole truth. Reading the land is the first skill.
2. **Drill** — place your derrick and steer the bit live with your thumb: dodge bedrock (slows/damages), route around gas pockets (blowout risk), thread toward the crude. Drilling is *played*, not watched.
3. **Pump & store** — strikes flow into your tank; multiple wells run simultaneously as you expand. Tank capacity forces decisions.
4. **Sell on a moving market** — the price ticker breathes (waves + news spikes: "Railroad contract! +40% for 20s"). Selling is a timing game with a satisfying commit slider.
5. **Upgrade** — every dollar has three jobs: better equipment (visible on the rig!), more sonar, or the next lease. Upgrades change *how the game plays*, not just numbers: diamond bits ignore rock, blowout preventers turn gas from threat to bonus fuel, horizontal rigs unlock sideways drilling.

## 4. Session Shape

One lease = a 6–10 minute complete arc (survey → drill → drain → cash out). Career sessions chain leases naturally; a single lease is a perfect pocket session. No timers, no energy — the lease clock (your loan interest ticking) provides urgency inside the fiction.

## 5. Progression & Retention (the day-14 answer)

- **Day 1–3:** The first valley: pay off the $1,000 starter loan, learn survey/drill/sell. Rags → first real rig.
- **Day 4–7:** New regions with new geology (shale layers, aquifers that flood wells, permafrost, offshore platforms later) — each region changes drilling strategy, not just difficulty. Auction system: bid against AI wildcatter rivals for leases; rivals have personalities and bankrolls.
- **Day 7–14:** **The market meta deepens** — futures contracts (lock a price now, deliver later), storage arbitrage, refinery ownership (sell gasoline instead of crude at better margins). Company HQ upgrades persist across regions: staff (surveyor, broker, engineer) who automate or improve what you've mastered.
- **Day 14+:** **Weekly Boom** — a seeded competitive lease everyone plays with identical geology and market; leaderboard on net profit. Seasonal regions, prestige ("sell the company," start again with legacy perks and a harder market), and rival-story arcs. The endless chase: the mythical Deep Field mega-pocket rumored in each region.

## 6. Content Ceiling

High: regions × geology mechanics × market instruments multiply; leases are procedurally generated over authored geology grammars so the daily/weekly supply is nearly free. Authored content = regions, rivals, upgrade trees, story beats — steady drip, no writers'-room treadmill.

## 7. Monetization Notes

Out of scope, as with the whole portfolio. If ever: cosmetic rigs/derrick skins and region expansions. Selling sonar or market advantage would gut the skill fantasy — never.

## 8. PWA Feasibility

- **Excellent.** 2D cross-section rendering (Canvas/WebGL), no physics engine needed — drilling is a bespoke kinematic steer, fluids are simple flow-rate math with lush presentation. Fully offline career; light backend only for the Weekly Boom seed + leaderboard.
- **Web push:** market-event fiction pushes beautifully ("Crude just spiked in Red Valley") and the Weekly Boom launch.
- Deterministic seeded generation for fair weekly leaderboards — same architecture as the rest of the portfolio.

## 9. Development Complexity

**M.** No exotic tech. Hardest problem: **the upgrade economy curve** — the "always about to afford something that changes everything" feeling is pure tuning craft (this is where the reference game shines and where we must match it). Second: making drill-steering feel skillful but never fiddly at thumb scale.

## 10. The Team's Verdict

**Deke (systems):** "This is the strongest *progression* game in the portfolio — survey/drill/sell/upgrade is a four-beat loop where every beat feeds the next, and the visible-upgrade rule ('every purchase changes the screen') is the retention psychology done right." **Mara:** the wildcatter fantasy IS rags-to-riches made physical — you literally pull wealth out of the ground; her ask is that the market layer stay readable at a glance. **Priya:** upgrade-driven tycoon loops are among the stickiest day-7-to-14 patterns on mobile; weekly seeded leases give it the competitive spine the genre usually lacks. Weakness: the genre has a beloved incumbent — we win by going *deeper* (career arc, market instruments, regions that change strategy) and *sleeker* (modern presentation), not by imitating. A worthy fourth finalist.
