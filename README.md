# Color Wars

A local **Chain Reaction**–style game for **one to four players** on a square
grid from **7×7 to 15×15**. Click a cell to add an orb; a cell that reaches its
capacity explodes and sends one orb to each orthogonal neighbour, converting
enemy orbs along the way. The last player with orbs on the board wins.

The **web implementation is the product**. It will ship as an Android app built
with Capacitor (see [`docs/ANDROID.md`](docs/ANDROID.md)). The Pygame prototype
in `legacy/main.py` is archived for reference and is no longer maintained.

> **Status: playable web build.** The pure engine, home/menu flow, settings,
> multi-player boards, and save/resume are complete and covered by 87 Vitest
> tests. Phase 3 wraps the Vite build in a Capacitor Android shell; Phase 4
> handles signing and release. See the [roadmap](#roadmap).

---

## Quick start

```powershell
npm install
npm run dev        # http://localhost:5173
npm test           # engine, settings, storage, and UI tests
npm run build      # production build in dist/
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

- **Everyone shares one device** (hot-seat). Player 1 sits at the bottom,
  Player 2 at the top, and Players 3 and 4 on the left and right for
  four-player matches.
- On a turn, either place a new orb on **any empty cell** or add one orb to a
  cell you already own.
- A cell explodes when it reaches its capacity: **2 in a corner, 3 on an edge,
  4 in the interior**.
- A cell that explodes clears itself and sends one orb to each orthogonal
  neighbour, converting enemy orbs to the exploding player.
- Cascades resolve automatically. A player with no orbs left is eliminated; the
  last player with orbs wins. Solo mode is a non-ending practice board.

The app opens on a home screen with **Resume**, **New game**, **Settings**,
**How to play**, and **About**.

- **Resume** restores an unfinished saved match. It is disabled when there is
  no save or the last match is finished.
- **New game** starts a fresh match and discards any previous save.
- **Settings** controls difficulty (UI placeholder for the future bot), grid
  size, number of players, per-player names and colours, sound, and vibration.
  Changes are saved immediately.
- The in-match menu offers How to play, Restart, and Back to home. When the game
  ends, a result dialog appears and the board is locked until you start again.

See [`docs/UI.md`](docs/UI.md) for the full screen and component reference.

---

## Project structure

```
Color Wars/
├── index.html          # Vite entry, mounts #app
├── font.ttf            # Custom display font
├── src/
│   ├── main.ts         # Bootstrap and lifecycle persistence
│   ├── engine/         # Pure rules: types, board, cascade, moves, winner
│   ├── ui/             # shell, board, HUD, overlay, animations, controller
│   ├── platform/       # storage, settings, sound, and haptics adapters
│   └── styles/         # tokens.css and app.css
├── tests/
│   ├── engine/         # board, moves, cascades, winner, stress
│   ├── platform/       # save schema, settings, and storage adapters
│   └── ui/             # jsdom app tests
├── android/            # Phase 3 target: Capacitor Android project
├── legacy/
│   └── main.py         # Archived Pygame prototype
├── package.json
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

`src/engine/` and `src/ui/` are complete for the web build. `android/` is the
Phase 3 target and does not exist yet.

---

## Development

```powershell
npm ci
npm test               # 87 engine, settings, storage, and UI tests
npm run typecheck
npm run build          # Vite production build in dist/
npx cap sync android   # Phase 3
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §4.3 for the target layout and
[`docs/ANDROID.md`](docs/ANDROID.md) for the APK pipeline.

---

## Legacy defects (fixed)

The pre-rebuild prototypes are preserved in git history and `legacy/main.py`.
Their defects are recorded here so they are not reintroduced; each has
regression coverage in the test suite.

### Legacy web (`script.js`, removed)

1. **No placement after the first move** — fixed by `isLegalMove`, which allows
   any empty cell or the current player's cells (`moves.test.ts`).
2. **Ghost coin after an explosion** — the UI now renders only from
   `GameState`, so a cleared cell cannot keep a stale orb (`app.test.ts`,
   browser check).
3. **Fixed capacity of 4** — replaced by `capacityAt` (2/3/4) and covered by
   `board.test.ts`.
4. **Invisible turn and win text** — the turn banner is a visible
   `aria-live` region and the win state is a modal dialog.
5. **No game-over lock** — `applyMove` rejects moves after a win, and the board
   exposes `aria-disabled` cells (`winner.test.ts`).

### Legacy desktop (`legacy/main.py`)

1. Duplicate coins per cell — the board stores exactly one cell object.
2. Fixed capacity of 4 — same `capacityAt` fix.
3. Unbounded frame rate — not applicable; the web build renders on events.
4. Win check only on click — wins are evaluated after every cascade.
5. No cascade animation — engine events drive the UI animation.

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — current code structure,
  engine/UI/platform contracts, and phase status.
- [`docs/ALGORITHM.md`](docs/ALGORITHM.md) — rules, state, and the cascade
  algorithm.
- [`docs/UI.md`](docs/UI.md) — layout, components, states, and accessibility.
- [`docs/ANDROID.md`](docs/ANDROID.md) — APK/AAB pipeline, signing, supported
  Android range, feature parity, and device test matrix.
- [`docs/FEATURES.md`](docs/FEATURES.md) — feature backlog (blank for now).

---

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | git baseline, archive `legacy/main.py`, keep the legacy web build runnable | done |
| 1 | pure TypeScript engine (`src/engine/`) + Vitest suite, no visual change | done |
| 2 | rebuild the UI on the engine: visible turn banner, win overlay, restart, save/resume, accessibility | done |
| 2.5 | home menu, settings, 1–4 players, dynamic grids, names/colours, sound and vibration toggles | done |
| 3 | Capacitor 8 shell, Android project, Preferences persistence hardening, device matrix | next |
| 4 | signing, release build, Play checklist, hardening | planned |

Definition of "stable" for the Android release: see
[`docs/ANDROID.md`](docs/ANDROID.md) §13.
