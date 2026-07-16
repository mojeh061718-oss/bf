# Concept 04 — THE BRACELET
### A Poker Career, From Kitchen Tables to the Main Event
*Built from seed idea #3: "a top poker app replicating the WSOP with AI smart enough to play and understand poker... starting from a low tournament and making your way up"*

---

## 1. Elevator Pitch

Not a poker app — a poker *career*. You start in $20 kitchen-table games against people with names, faces, and habits, and grind a bankroll through casino dailies, circuit stops, and satellites toward the Main Event and the bracelet. The AI genuinely plays poker — ranges, position, pot odds, adaptation — and every opponent is a persistent character whose game you learn across months. Bankroll management is the meta-game: go broke chasing a shot you couldn't afford, and you're back dealing with the kitchen crew.

## 2. Fantasy & Tone

The player is the grinder from every poker memoir: sleeping bad, running worse, one heater away. Tone: authentic poker culture — the patter, the superstition, the bad-beat stories — warm and human at the low stakes, colder and sharper as the buy-ins climb. Art: characterful 2D portraits at a clean top-down table; the visual journey from folding-chairs-and-beer to the cavernous hush of a Main Event feature table *is* the progression fantasy. Audio: chip riffles, felt, table talk that thins out as stakes rise.

## 3. Core Loop (minute to minute)

1. **Play hands** — full no-limit hold'em, one-thumb bet slider with preset sizings (⅓, ½, ⅔ pot, shove). Fast-fold pacing controls so a tournament level moves briskly.
2. **Read opponents** — every character has a persistent style (tight/loose × passive/aggressive), leaks (calls too wide on rivers, can't fold overpairs), tilt behavior, and *tells* at lower stakes (bet-timing patterns, chat behavior). Your in-game **Notebook** auto-accumulates observed stats per villain — your scouting file grows across your whole career.
3. **Between sessions: run the career** — bankroll decisions (shot-take or grind?), which events to enter, satellites vs. direct buy-ins, staking offers from characters you've impressed.
4. **Tournament arcs** — bubbles, pay jumps, final tables. The game surfaces ICM pressure honestly ("folding here is worth $210 in equity").

## 4. Session Shape

A single tournament level or cash session is 5–10 minutes; save-anywhere mid-tournament (it's all local sim). Deep events span multiple sessions across days — a Main Event run should take a week of real time and feel like one.

## 5. Progression & Retention (the day-14 answer)

- **Day 1–3:** Kitchen games → first casino daily. Learning villains' names and leaks; first bankroll decisions.
- **Day 4–7:** Circuit structure opens: multiple venues, event calendars, satellite chains. The Notebook starts paying off — beating a familiar villain *because you know him* is the signature dopamine of this game.
- **Day 7–14:** **The calendar is the retention engine**: events run on a real-world-synced schedule (tonight's $250 Deepstack, Sunday's Major), giving natural appointment play. Career milestones (first cash, first final table, first bracelet-event entry) pace the fantasy.
- **Day 14+:** Season structure mirrors a real poker year culminating in the Main Event; leaderboards for career earnings and season points; **Hand of the Day** (everyone gets the same tough spot, community results shown after you decide — a Wordle-shaped poker ritual); rival arcs where specific villains climb stakes alongside you.
- Prestige: after a Main Event, start a new career with legacy perks and tougher AI populations.

## 6. Content Ceiling

High and unusually *cheap*: poker generates its own situations forever. Content = new venues, event formats (PLO, short-deck, bounty, heads-up brackets), character populations, and rival storylines. The simulation does the daily work; writers add texture, not levels.

## 7. Monetization Notes

Out of scope — and one hard rule regardless: **no real money, ever, and chips are never purchasable in any form that touches competitive play.** The entire premise ("your bankroll = your skill history") dies otherwise. WSOP is a trademark — we build an original circuit with its own identity (venue names, "the Bracelet" as our own artifact) rather than licensing.

## 8. PWA Feasibility

- **AI is the crown jewel and it's buildable in the browser.** Architecture: precomputed baseline strategies (offline-solved for common stack/position spots) + Monte Carlo rollouts in a Web Worker for novel spots + a persistent per-character "style layer" that biases the baseline into personalities and honest leaks. Sam's estimate: clearly-better-than-typical-app AI at ~50ms/decision on an iPhone. Not GTO-perfect — *believably good*, with exploitable humanity at low stakes tightening as stakes rise (this is also the difficulty curve).
- **Everything runs local**; offline-complete. Backend only for Hand of the Day + leaderboards.
- **Web push:** event calendar ("The Sunday Major starts in 2 hours") — appointment mechanics fit push perfectly.
- Rendering trivial (2D UI); asset weight small.

## 9. Development Complexity

**L.** Hardest problem by far: **the AI quality bar the pitch promises.** Second: honest tournament/ICM simulation at scale (simming 800-player fields between your hands, cheaply). Third: making low-stakes AI *badly* in human ways rather than randomly. All tractable; none quick. Poker rules/eval engines are commodity.

## 10. The Team's Verdict

**Sam (AI):** "This is the one where engineering *is* the product. The bar is high but the moat is real — nobody in the casual space ships opponents you can actually scout." **Deke:** bankroll-as-meta-game is a brilliant frame; the calendar + Hand of the Day gives it true dailiness. **Priya:** poker demand on mobile is proven and evergreen; career framing is the underserved angle. Weaknesses: longest build on the list before it's *good* (a mediocre-AI version is worse than not shipping), and trademark discipline required around WSOP framing. The team's pick for "biggest moat if we go long."
