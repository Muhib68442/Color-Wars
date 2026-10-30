# Color Wars

A local two-player **Chain Reaction**–style game on a 7×7 grid. Click a cell to
add an orb; a cell that reaches its capacity explodes and sends one orb to each
orthogonal neighbour, converting enemy orbs along the way. The last player with
orbs on the board wins.

The project contains **two independent implementations** of the same idea:

| Version | Entry point | Stack |
| --- | --- | --- |
| Web | `index.html` | HTML + CSS + vanilla JavaScript |
| Desktop | `main.py` | Python 3 + Pygame |

Both were written in 2024 as prototypes. They share no code and have drifted
apart in their rules.

> **Status: prototype.** The apps launch and accept clicks, but the rule engine
> is not correct yet. See [Known issues](#known-issues) and
> [`docs/ALGORITHM.md`](docs/ALGORITHM.md) for details.

---

## Quick start

### Web version

No build step and no dependencies.

```powershell
# Option A: open the file directly
start index.html

# Option B: serve it (recommended if the browser blocks the font)
python -m http.server 8088
# then open http://localhost:8088/
```

### Desktop version

```powershell
pip install pygame
python main.py
```

Tested with Python 3.12 and Pygame 2.6.1.

---

## How to play

- **Both players share one mouse** (hot-seat).
- **First click per player:** place a coin on any empty cell.
- **Later clicks:** add a coin to a cell you already own.
- A cell shows 1–3 dots. When it gains a 4th, it explodes.
- The player whose coins are all converted loses.

The active player is indicated by the tinted panel at the top of the page. The
`#turn` text that should show "Player X's Turn" is currently hidden by CSS, so
the panel tint is the only turn feedback. See [`docs/UI.md`](docs/UI.md).

---

## Project structure

```
Color Wars/
├── index.html          # Web markup: navbar, player panels, board container
├── style.css           # Theme tokens, layout, board/cell/dot styling
├── script.js           # Web game engine (board state, turns, explosions)
├── main.py             # Pygame implementation of the same game
├── font.ttf            # Custom display font (navbar and player headings)
├── docs/
│   ├── ARCHITECTURE.md # Code structure, data flow, and design notes
│   ├── ALGORITHM.md    # Game rules, state, and cascade algorithm
│   ├── UI.md           # Layout, components, states, accessibility
│   └── FEATURES.md     # Planned features (currently blank)
└── README.md
```

There is no git repository, package manifest, test suite, or build pipeline.

---

## Known issues

These are confirmed by running the code, not just by reading it.

### Web (`script.js`)

1. **No placement after the first move.** After both players' opening moves, only
   clicks on your own coins are accepted. Placing a new coin on an empty cell is
   impossible, although that is a core Chain Reaction rule.
2. **Ghost coin after an explosion.** The exploding cell is cleared by
   `spreadPoints`, then immediately redrawn by `updateCell` in `incrementPoints`.
   The screen shows an orb that the board model does not contain, so the score
   and the board permanently disagree.
3. **Wrong capacities.** Every cell explodes at 4 orbs. Corners should explode
   at 2 and edges at 3.
4. **Invisible turn and win text.** `#turn` is `display: none`. The win message is
   written into that element, and the active-player highlight overwrites the
   winner highlight immediately after `checkGameOver()` runs.
5. **No game-over lock.** Clicking after a win keeps mutating the board.

### Desktop (`main.py`)

1. **Duplicate coins per cell.** `handle_explosions` looks up neighbours in the
   old `coins` list, so two adjacent explosions can create two coins in the same
   empty cell.
2. **Wrong capacities.** Same fixed capacity of 4 for corners and edges.
3. **Unbounded frame rate.** No `pygame.time.Clock`, so the loop spins at
   unlimited FPS and uses a full CPU core.
4. **Win check only on click.** Cascades can eliminate a player without ending
   the game until the next click.
5. **No cascade animation.** Explosions resolve instantly.

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the code is organised.
- [`docs/ALGORITHM.md`](docs/ALGORITHM.md) — rules, state, and the intended
  cascade algorithm, compared with what the code actually does.
- [`docs/UI.md`](docs/UI.md) — visual layout, components, states, and
  accessibility.
- [`docs/FEATURES.md`](docs/FEATURES.md) — feature backlog (blank for now).

---

## Roadmap

1. Replace the scattered rule logic with one small engine module: board model,
   per-cell capacity, queue-based cascade, explicit win detection.
2. Fix the UI: visible turn banner, win overlay, restart button, keyboard access.
3. Keep one platform as the primary target (the web version is the easiest to
   share) and archive or regenerate the other from the same rules.
4. Add tests for the engine (corner/edge capacities, chain reactions, winner
   detection) before adding new features.
