# PROVING GROUNDS
### Build it right. The graph doesn't lie.

A defense-contractor engineering game for iPhone (PWA). You run **Redline Ordnance Works**, a scrappy outfit bidding against the industry giant **Vantage Dynamics** for government test contracts. Snap the device together KSP-style in a 3D assembly bay, wire it by hand, seat the detonator with a steady thumb, and take it to the range — where a long-lens camera 1.6 km out tells the truth. Tweak one thing. Refire. Converge.

**All science within is invented.** Fictional compounds, fictional physics. The realism is the engineering *process* — and the incident reports.

- **Play:** https://mojeh061718-oss.github.io/bf/
- **Full game plan:** [`design/FULL_GAME_PLAN.md`](design/FULL_GAME_PLAN.md)
- **Winning concept:** [`concepts/12-proving-grounds.md`](concepts/12-proving-grounds.md)
- **The road here:** twelve concepts, five playable demos, one bake-off — see [`concepts/ARCHIVE.md`](concepts/ARCHIVE.md)

## Repository layout

```
docs/         the game (GitHub Pages root) — three.js, vanilla JS, no build step
concepts/     concept documents from the selection phase + archive
design/       full-game design plan and roadmap
```

## Development

No build step: `python3 -m http.server` from `docs/` and open in a browser. Everything is deterministic and seeded (`?seed=12345`); the outcome resolver in `sim.js` is DOM-free and unit-testable in Node.
