# Concept 09 — SOUTHPAW
### Boxing Manager: Club Fighter to Champion
*Team original — the rags-to-riches arc of seed idea #2, told through one career in the fight game*

---

## 1. Elevator Pitch

You're not the fighter — you're the corner. Take a raw club fighter nobody wants, and manage every decision of a career: training camps, weight cuts, sparring partners, which fights to take and which paydays to walk away from, promoters who smile while they rob you. Fights resolve through a live, stats-driven simulation you influence between rounds from the stool. Build a champion, retire a legend — then find the next kid in the gym, carrying everything your name now means.

## 2. Fantasy & Tone

The player is the trainer-manager from every great boxing story — equal parts strategist, negotiator, and surrogate parent. Tone: warm, weathered, human; the sport's brutality is respected, the business's cynicism is the antagonist. Art: painterly 2D — gym mornings, smoky club shows, arena nights; fighters visibly age and scar across careers. Audio: speed bags, corner chatter, crowd tides that swell when the sim turns. The fantasy peak: your kid, hand raised, under the big lights — because of a thousand choices you made.

## 3. Core Loop (minute to minute)

1. **Run the camp (between fights)** — allocate weeks across training focuses (engine, power, chin, ring IQ), choose sparring (better partners = better prep, injury risk), manage weight and morale. Camps are a compact drag-slider puzzle, 2–3 minutes each.
2. **Do the business** — offers arrive with visible and hidden terms: purse, opponent style matchup, TV exposure, promoter reputation. Matchmaking *is* the strategy: pad the record vs. take the leap; a bad style matchup can end more than a win streak.
3. **Fight night** — the sim plays out in stylized real time (2–4 minutes per fight, skippable rounds). You read the flow via corner-eye stats (output, damage absorbed, gas tank) and make between-round calls: press, box, protect the eye, gamble the knockout. Cutman mini-decisions under a countdown when it gets bad.
4. **Live with it** — wins open doors; losses reroute careers rather than ending them (a gatekeeper loss to a contender run is a classic arc); injuries and age make the clock the true opponent.

## 4. Session Shape

One camp + fight night = a satisfying 8–12 minute session; quick sessions handle offers and gym business in 2 minutes. A career (40–60 fights) spans weeks of real play — a run-based game wearing a saga's clothes.

## 5. Progression & Retention (the day-14 answer)

- **Day 1–3:** First prospect, club circuit, learning that styles make fights. First hard offer ("step up on two weeks' notice for triple money?") teaches the real game.
- **Day 4–7:** The division opens: ranked ladders, rival prospects rising on their own AI-simulated careers (the kid you beat in fight 3 becomes a champion you meet again in fight 31), title eliminators.
- **Day 7–14:** **The gym meta**: your gym gains reputation, unlocking better facilities, assistant coaches, and *multiple fighters in the stable* — a second prospect's career interleaves with your champion's title run. Weekly **Fight Card** events: a real-world-synced calendar of special opportunity bouts.
- **Day 14+:** Retirement mints a **Legacy Card** (career record, titles, signature wins — shareable), and legacy perks (gym reputation, coaching tree) carry to the next prospect: the roguelike loop at biography scale. Seasonal **Prospect Draft**: everyone worldwide gets the same generated prospect class for a scored ladder season — same raw kid, whose career did it better. Divisional weight classes = parallel content lanes.

## 6. Content Ceiling

High: fighters, rivals, and careers are procedurally generated over hand-authored personality/arc templates, so the simulation manufactures its own stories. Authored content = promoters, arcs, eras, weight classes, event scripts — steady drip, not a treadmill. The fight engine's depth (styles, attributes, condition) is the real content.

## 7. Monetization Notes

Out of scope. Expansion-shaped future (eras, weight classes). Selling training boosts would gut the fantasy — never.

## 8. PWA Feasibility

- **Excellent.** Turn-based management + a deterministic seeded fight sim; 2D presentation; fully offline careers. Light backend for the seasonal Prospect Draft leaderboard + weekly cards.
- **Web push:** fight-night reminders and "an offer came in for the vacant belt" — appointment fiction that pushes well.
- The fight visualization can start abstract (stat-driven momentum bars + illustrated key moments) and grow toward animated fighters later — the sim, not the animation, is the product. This de-risks art scope massively.

## 9. Development Complexity

**M.** Hardest problem: **the fight engine's believability** — styles, momentum, damage, and aging must produce fights that boxing-literate players nod at, and upsets that feel earned rather than random. Second: the offer/negotiation AI (promoters with memory and agendas — Sam's problem, and he's grinning). No exotic tech anywhere.

## 10. The Team's Verdict

**Mara:** "Of all the rags-to-riches framings, this one has the strongest built-in dramatic engine — careers have acts, rivals, and endings *by nature*; the sim writes the stories #03 has to hand-author." **Deke:** legacy-loop plus seasonal shared-prospect ladder is a genuinely fresh retention stack; sports-management retention (proven for decades on desktop) is underserved on mobile. **Priya:** narrower audience than the physics games, but deeply loyal; boxing's cultural moment is real. Weakness: fight-sim tuning is a taste-and-iteration pit, and players who want to *be* the fighter (not the corner) may bounce — the concept must sell the manager fantasy in its first screenshot.
