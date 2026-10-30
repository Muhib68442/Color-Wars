# Color Wars

A local two-player **Chain Reaction**–style game on a 7×7 grid. Click a cell to
add an orb; a cell that reaches its capacity explodes and sends one orb to each
orthogonal neighbour, converting enemy orbs along the way. The last player with
orbs on the board wins.

The **web implementation is the product**. It will ship as an Android app built
with Capacitor (see [`docs/ANDROID.md`](docs/ANDROID.md)). The Pygame prototype
in `legacy/main.py` is archived for reference and is no longer maintained.

> **Status: engine complete, UI rewrite in progress.** The pure TypeScript
> engine (`src/engine/`) is implemented and covered by 29 Vitest tests. The
> legacy root UI is still the playable build until Phase 2 replaces it; the
> defects below are fixed by the new engine but not yet visible in the browser.
> See the [roadmap](#roadmap).

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

### Legacy desktop version (archived)

```powershell
pip install pygame
python legacy/main.py
```

Tested with Python 3.12 and Pygame 2.6.1. It is kept only as a reference; new
work happens on the web/Android build.

---

## How to play

The target rules (what the new engine implements):

- **Both players share one device** (hot-seat).
- On a turn, either place a new orb on **any empty cell** or add one orb to a
  cell you already own.
- A cell explodes when it reaches its capacity: **2 in a corner, 3 on an edge,
  4 in the interior**.
- A cell that explodes clears itself and sends one orb to each orthogonal
  neighbour, converting enemy orbs to the exploding player.
- Cascades resolve automatically. A player with no orbs left loses.

The legacy web build behaves differently (see [Known issues](#known-issues)):
it forbids new placements after the opening move and uses a fixed capacity of 4
everywhere. The active player is indicated only by the tinted panel because the
`#turn` label is hidden. See [`docs/UI.md`](docs/UI.md).

---

## Project structure

```
Color Wars/
├── index.html          # App shell (replaced in Phase 2)
├── style.css           # Legacy theme and layout
├── script.js           # Legacy web engine (known defects)
├── font.ttf            # Custom display font
├── legacy/
│   └── main.py         # Archived Pygame prototype
├── src/
│   └── engine/         # Pure rules: types, board, cascade, moves, winner
├── tests/
│   └── engine/         # Vitest suite (29 tests)
├── android/            # Phase 3 target: Capacitor Android project
├── package.json        # Vite + TypeScript + Vitest
├── tsconfig.json
├── vite.config.ts
├── docs/
│   ├── ARCHITECTURE.md # Code structure, data flow, target architecture
│   ├── ALGORITHM.md    # Game rules, state, and cascade algorithm
│   ├── UI.md           # Layout, components, states, accessibility
│   ├── ANDROID.md      # APK/AAB build, signing, compatibility, testing
│   └── FEATURES.md     # Planned features (currently blank)
└── README.md
```

The repository is under git (baseline commit `chore: baseline before engine
rewrite`). `src/engine/` and `tests/` are complete; `src/ui/`, `src/platform/`,
and `android/` are the Phase 2–3 targets and do not exist yet.

---

## Development

```powershell
npm ci
npm test          # 29 engine tests
npm run typecheck
npm run build     # Vite production build (legacy entry until Phase 2)
npx cap sync android   # Phase 3
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §4.3 for the target layout and
[`docs/ANDROID.md`](docs/ANDROID.md) for the APK pipeline.

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

### Desktop (`legacy/main.py`)

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

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — legacy code, target
  structure, engine/UI/platform contracts.
- [`docs/ALGORITHM.md`](docs/ALGORITHM.md) — rules, state, and the intended
  cascade algorithm, compared with what the code actually does.
- [`docs/UI.md`](docs/UI.md) — visual layout, components, states, and
  accessibility.
- [`docs/ANDROID.md`](docs/ANDROID.md) — APK/AAB pipeline, signing, supported
  Android range, feature parity, and device test matrix.
- [`docs/FEATURES.md`](docs/FEATURES.md) — feature backlog (blank for now).

---

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | git baseline, archive `legacy/main.py`, keep the legacy web build runnable | done |
| 1 | pure TypeScript engine (`src/engine/`) + Vitest suite, no visual change | done |
| 2 | rebuild the UI on the engine: visible turn banner, win overlay, restart, save/resume, accessibility | planned |
| 3 | Capacitor 8 shell, Android project, device matrix | planned |
| 4 | signing, release build, Play checklist, hardening | planned |

Definition of "stable" for the Android release: see
[`docs/ANDROID.md`](docs/ANDROID.md) §13.
