# Concept 03 — FROM NOTHING
### Rags-to-Riches Life Simulation
*Built from seed idea #2: "simulation of a rags-to-riches kind of thing where all the user's own decisions make each user's path different"*

---

## 1. Elevator Pitch

You step off a bus with $40, a duffel bag, and no plan. From there, everything is a decision: where you sleep tonight, which job you grind, who you trust, what corners you cut. The city is a living simulation — jobs, rents, people, and opportunities that exist whether or not you touch them — and every run writes a different life. Some end in a penthouse. Most don't. All of them are *yours*.

## 2. Fantasy & Tone

The player is nobody, becoming somebody. Tone: grounded but warm — closer to a great HBO character drama than a grim survival sim. Money is tight, choices have teeth, but the game respects hustle and never punishes without telling you why. Art: stylish text-forward UI with strong illustration moments (think card-based scenes, not walking around a 3D city). The phone *is* the fiction: your in-game life runs through a diegetic phone interface — bank app, job board, messages from characters. Audio: city ambience shifting by neighborhood and by how far you've climbed.

## 3. Core Loop (minute to minute)

Turn-based days, three time blocks each (morning/afternoon/night):

1. **Spend a block** — work a shift, hit the job board, network at a bar, study, sleep somewhere safe (or don't), chase an opportunity card.
2. **Handle events** — the simulation interjects: your landlord raises rent, a coworker offers a side hustle, your car dies, a stranger you helped in week one resurfaces with a proposition. Choices are 2–4 options with visible-but-incomplete information.
3. **Balance the meters** — cash, energy, health, reputation (per social circle), and heat (if you're cutting corners). Meters interact: exhaustion tanks job performance; reputation opens doors money can't.
4. **End of week: the Ledger** — a beautiful weekly summary of net worth, relationships, and the fork-in-the-road choices you made. This screen is the shareable artifact.

The critical design law: **events are consequences, not dice.** The coworker offers the hustle *because* you covered his shift. Players must be able to trace their story backward.

## 4. Session Shape

A day takes 2–4 minutes; a run (one "life," ~2 in-game years) spans 3–6 hours across many sessions. Save-anywhere, instantly resumable — ideal commute/couch play. Runs end (bankruptcy, burnout, arrest, retirement... or making it), and ending a run is a feature, not a failure: it mints your **Life Card** — a shareable one-screen summary of that life's path.

## 5. Progression & Retention (the day-14 answer)

- **Day 1–3:** First life. Learning the city, dying poor, immediately understanding what to do differently — the roguelike hook applied to biography.
- **Day 4–7:** **Legacy system**: each completed life earns Perks for the next start (a relative in the city, a vocational certificate, $200 in a shoebox) and unlocks new **Origins** (single parent, undocumented, disgraced ex-banker) that meaningfully reshape the possibility space.
- **Day 7–14:** **Weekly Seed** — everyone plays the same city, same starting hand, same event deck for one scored week. Leaderboard on net worth *and* on "story score" (a composite that rewards interesting lives, not just optimal grinding). Compare Life Cards with friends: same start, wildly different biographies — this is the social engine.
- **Day 14+:** Content drops as **Districts** (a port, a university quarter, a tech corridor) each carrying new careers, characters, and event chains; seasonal Origins; endless build-variety chasing ("the no-crime speedrun," "the union path," "the landlord run").

## 6. Content Ceiling

Effectively unbounded, but **authored**: this game eats event-writing. The simulation systems (economy, relationships, careers) are finite engineering; the event/character content is a permanent writers'-room commitment. Mitigation: events are systemic templates (variables filled from sim state) so one authored event replays differently across lives.

## 7. Monetization Notes

Out of scope. Natural future fit: district/origin expansions. Anything that sells *progress* would poison the "your decisions made this" premise — flagged as a hard never.

## 8. PWA Feasibility

- **Excellent** — the best PWA fit on the list. Text/UI-forward, no physics, no real-time demands, tiny asset weight, fully offline runs via IndexedDB.
- **Backend:** weekly seed distribution + leaderboards + Life Card sharing. All lightweight.
- **Web push:** weekly seed launch; optionally a single respectful mid-run hook ("Your life is on day 340...").
- Deterministic seeded simulation is straightforward here (no physics float drift).

## 9. Development Complexity

**M engineering, L content.** Hardest problem: **the event economy** — writing and systematizing enough consequence-driven content that run #6 still surprises. Second: tuning the economy so "rags" is hard without being miserable. The sim engine itself is honest, well-understood work.

## 10. The Team's Verdict

**Mara:** "The strongest emotional premise we have — nobody else on this list makes players *tell stories about their run* to friends, and that's the rarest kind of retention." **Deke:** legacy + weekly seed + origins is a proven roguelike retention stack transplanted into an underserved genre. **Priya:** flags honestly that day-14 retention lives or dies on content volume at launch — she wants 400+ systemic events before we ship. Weakness: content treadmill is real and permanent. This is the best fit for seed idea #2 and the team's pick for "highest ceiling if we commit to the writing."
