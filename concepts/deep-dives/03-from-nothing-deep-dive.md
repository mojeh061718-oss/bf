# DEEP DIVE 03 — FROM NOTHING
### Rags-to-Riches Life Simulation — Full Design Treatment
*Expands [concepts/03-from-nothing.md](../03-from-nothing.md)*

---

## 1. Design Pillars

1. **Consequences, not dice.** Every event traces to a decision the player can remember. Luck exists, but luck only *knocks* — decisions answer the door.
2. **The climb is systemic, the story is yours.** We author systems and situations; the player's sequence of choices authors the biography.
3. **Losing is a story too.** A bankruptcy run that produced a great tale is a successful session. Life Cards celebrate *interesting*, not just *rich*.
4. **Respect the subject.** Poverty is hard in-game because it's hard, not as flavor cruelty. Hustle, luck, and help all exist; sneering at any of them doesn't.

## 2. Core Systems — Detailed Spec

### 2.1 Time & turn structure
- A run = one life-attempt, targeting **~104 in-game weeks** (2 years) ≈ 4–6 hours of play.
- Each day = 3 blocks (morning / afternoon / night). Most actions cost 1 block; shifts cost 2; sleep quality depends on where night is spent.
- **Week cadence:** 7 days then **the Ledger** — rent due, recurring bills, relationship drift, and the weekly summary screen (net worth curve, key choices, foreshadow hooks: "Dee hasn't texted back in 9 days").

### 2.2 The five meters (and the rule that they push, never gate)
| Meter | Range | What it does |
|---|---|---|
| **Cash** | $ | The scoreboard and the oxygen |
| **Energy** | 0–100 | Low energy degrades action *outcomes* (quality tiers), never blocks actions |
| **Health** | 0–100 | Slow-moving; crises at thresholds (collapse, ER bill); recovers with sleep/food/care |
| **Reputation** | per-circle | Separate standing with each social circle (see 2.4) — opens/closes their opportunity decks |
| **Heat** | 0–100 | Only exists if you cut corners; decays slowly; drives police/creditor/underworld event pressure |

Design law: meters *modify* outcomes and *unlock pressure events* — they never simply forbid ("too tired" grays nothing out; working exhausted just goes badly, visibly).

### 2.3 Careers & money systems (the ladders)
Seven ladder families at v1.0, each 4–6 rungs, each rung with distinct play texture:
1. **Service** (dish pit → shift lead → assistant manager → franchise) — steady, energy-hungry, honest.
2. **Gig/hustle** (flyering, moving jobs, reselling, food cart) — flexible, spiky income, feeds the trade skill.
3. **Trades** (site labor → apprenticeship → licensed → contractor) — gated by certs (study blocks + fees), best mid-game slope.
4. **Office** (temp → admin → coordinator) — requires wardrobe/address respectability investments upfront.
5. **Underworld** (lookout → runner → operator) — fastest cash, Heat engine, one-way doors and the game's hardest exits.
6. **Ownership** (any ladder's top rungs convert to equity: buy the cart, the van, the diner, the building) — where rags formally becomes riches.
7. **Markets** (stocks/crypto via the in-fiction phone app; a small, volatile, seeded sim) — optional, dangerous, famous for wrecking speedruns.

Money climbs by **slope changes**, not grinding: the game is about maneuvering into positions where time converts to money at better rates.

### 2.4 People (the soul of the sim)
- ~40 recurring **characters** per city seed, each belonging to circles (work crew, block, church, gym, scene, family-by-origin). Characters have: disposition, memory flags, a personal arc, and an **opportunity deck** they can deal from ("my cousin's moving company needs a second guy Saturdays").
- **Relationship model:** favor-ledger + warmth. Doing things *costs blocks now* and *pays in doors later*. The landlord who's seen you shovel the walk carries you a week on rent; the coworker you covered for becomes the hustle partner.
- Every character interaction is a potential **thread** — the event system's fuel (see 2.5).

### 2.5 The event engine (the core tech-design asset)
- Events are **systemic templates** with requirement predicates over sim state + memory flags, weighted by pressure sources (low cash, high heat, neglected friend), with 2–4 choices writing new state + flags.
- **The Callback rule:** ≥30% of fired events must reference a specific past player action by name ("Because you covered Marcus's shift in March —"). This single authoring constraint produces the "my run is a story" feeling.
- **Foreshadow queue:** big events pre-announce softly 1–2 weeks out (a cough before the illness; grumbling before the layoff) so consequences feel fair, and dread/hope become play.
- v1.0 target: **450 event templates** (~150 per act tier), each replay-variable via slot-filled characters/amounts/locations. Writers'-room math: ~6 polished templates/writer-week → ~2 writer-years → mitigations: template families, systemic slot reuse, and cutting for depth-over-breadth in Act 1 where replay traffic is highest.

### 2.6 Run structure & endings
- **Act I — Survive** (weeks 1–20): housing insecurity, first ladder rungs. **Act II — Stabilize** (20–60): ladder choice hardens, people deepen, first ownership shots. **Act III — Ascend** (60–104): equity, leverage, legacy-defining choices.
- **Endings:** timeout (week 104 → "Where They Ended Up" epilogue), bankruptcy spiral, health collapse, prison, **early retirement** (net worth + stability threshold), and rare authored endings (walk away from it all; the one-way underworld exit).
- Every ending mints the **Life Card**: seed, origin, path sparkline (net worth over time with choice-markers), 3 defining moments (auto-selected from callback flags), title ("The Union Path," "Icarus, Crypto Division"). Shareable image + replayable seed.

## 3. Example Play Session (12 minutes, mid–Act I)

Week 9. Player has $410, works the dish pit, sleeps in a weekly-rate motel, walks everywhere since the bus pass lapsed.

1. **Mon AM:** shift. Quality roll lands "good" (energy 71) → +$68, +work-crew rep tick.
2. **Mon PM:** the foreshadowed event fires: *the motel's being sold — two weeks to vacate.* Options: scramble for an apartment (needs $900 deposit — doesn't have it), ask Dee about her uncle's basement room (spends relationship capital), or the coworker's offer: cash-in-hand demolition weekends, off the books (+$$, +Heat, torched Sundays).
3. Player texts Dee. Because the player showed up to her show in week 4 (callback), she says yes — $260/mo, but her uncle *notices things* (new pressure source: curfew-ish scrutiny events).
4. **Tue–Thu:** double shifts to bank the buffer; energy craters; Friday's shift rolls "poor" — the manager comment plants a foreshadow flag.
5. **Ledger:** net worth up $110, housing secured, energy 31, a new debt of gratitude on the books. Player closes the app at the natural chapter break, already scheming about the trades certificate.

Note what happened: no dice were visible, two past choices paid off by name, one new pressure entered, and the session *ended on a plan* — that's the comeback hook.

## 4. Content Map, Meta & Retention

- **Origins (run modifiers):** launch with 6 — Bus Ticket (default), Aged Out (of foster care; no family circle, +street smarts), Degree & Debt (office access, −$40k anchor), New in Country (paperwork gates, tight community circle), Second Chance (post-release; heat-sensitive, unique arcs), Golden Child Fallen (rich-family estrangement; pride mechanics). Each reshapes ladders, circles, and event weighting — a genuinely different game, not a stat tweak.
- **Legacy:** completed lives earn **Keepsakes** (pick 1 to carry: a cousin's number, a certificate, $200 in a shoebox, a reputation whisper). Unlock tracks open new Origins/districts. Legacy never trivializes Act I — it *redirects* it.
- **Weekly Seed:** same city, origin, event deck for everyone; leaderboards on **net worth** and **Story Score** (composite: callbacks triggered, circles maxed, endings reached — rewards living interestingly, not only optimally). Life-Card comparison feed is the social hook: same start, wildly different biographies.
- **Post-launch drip:** a district per 6–8 weeks (port, university quarter, tech corridor — each = ladders + characters + 60–80 events), seasonal Origins, holiday event layers.

## 5. Screen Flow

`Run hub (the in-fiction phone home screen) → Day view (blocks + location actions) → Event cards → weekly Ledger → (run end) Life Card`
Meta: Origin select / Legacy shelf / Weekly Seed lobby / Card feed. The diegetic phone-inside-the-phone is the UI identity: bank app, messages (where characters live), job board, maps.

## 6. Technical Architecture

- **Stack:** TypeScript + a reactive UI framework (Svelte/Preact — this is a UI game); no canvas needed beyond sparkline/illustration rendering. **The sim is a pure deterministic reducer**: `(state, choice, seededRNG) → state` — trivially testable, save = state snapshot, replay = choice log.
- **Event engine:** declarative template format (JSON + predicate DSL) with hot-reload authoring tools *built in week one* — writer velocity is the schedule, so writer tooling is core engineering, not nice-to-have. Includes a **simulation fuzzer** that auto-plays thousands of random lives nightly and flags: unreachable events, economy exploits, softlocks, meter death-spirals.
- **Backend:** weekly seed JSON; score + Life Card submission; card feed. All light.
- **Offline:** the flagship — fully playable offline forever; IndexedDB; seeds sync when connected.
- **Web push:** weekly seed launch + one opt-in mid-run hook max ("Week 40. Rent's due Friday.") — Priya insists on restraint; this game's fiction makes push *feel* personal, which cuts both ways.

## 7. MVP → v1.0 → Post-launch

- **Prototype (2–3 weeks):** Act I only, 2 ladders, 8 characters, ~60 events, ugly UI. *Kill criterion: do playtesters retell their run to someone unprompted? That's the whole bet — test it before building the mansion.*
- **MVP (soft launch):** full 3-act arc, 4 ladders, 3 origins, ~300 events, Life Cards, no weekly seed yet.
- **v1.0:** 7 ladders, 6 origins, 450 events, Weekly Seed + boards + card feed, push.
- **Post-launch:** district cadence above; the writers' room never closes — staff it or don't green-light this one.

## 8. Open Questions for the Founder

1. **Grit ceiling:** how dark may the underworld/health/housing content go? We propose "HBO drama, no gratuitous cruelty, hard themes handled with dignity" — needs your sign-off, it shapes hundreds of events.
2. **Real-world texture:** fictional city with fictional brands (our lean — full freedom) vs. a lightly-fictionalized real city vibe?
3. **Session pacing:** should a *calendar day* of real time softly map to an in-game week (encourages daily ritual) or fully unconstrained binging? (Deke: unconstrained + weekly seed provides the ritual. Priya agrees. But it's a founder-flavor call.)

## 9. The Team's Bottom Line

The most emotionally distinct product of the four and the only one whose retention compounds through *storytelling* — players evangelize biographies, not high scores. It is also, without romance, a writing-operations commitment disguised as a game: the reducer engine is a month of engineering; the 450 events are the product. Prototype answers everything: if strangers retell their runs, green-light the writers' room.
