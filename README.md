# Color Wars

A local **Chain Reaction**–style game for **one to four players** on a
rectangular grid with **7–15 rows and 7–15 columns** (for example 11×7 or
15×15). Click a cell to add an orb; a cell that reaches its capacity explodes
and sends one orb to each orthogonal neighbour, converting enemy orbs along the
way. The last player with orbs on the board wins. Play hot-seat on one device,
solo, or against an optional **Bot** with Easy, Medium, and Hard difficulty.

The **web implementation is the product**. It will ship as an Android app built
with Capacitor (see [`docs/ANDROID.md`](docs/ANDROID.md)). The Pygame prototype
in `legacy/main.py` is archived for reference and is no longer maintained.

> **Status: playable web build.** The pure engine, home/menu flow, settings,
> light/dark themes, multi-player boards, save/resume, and the Bot opponent are
> complete and covered by 126 Vitest tests. The Capacitor Android shell is in
> place and the `1.0.1` debug APK builds; device testing and release signing are
> next. See the [roadmap](#roadmap).

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

- **Everyone shares one device** (hot-seat), or an optional **Bot** plays the
  last seat. Player 1 sits at the bottom, Player 2 at the top, and Players 3 and
  4 on the left and right for four-player matches. The Bot is always named
  `Bot` and cannot be renamed.
- On a turn, either place a new orb on **any empty cell** or add one orb to a
  cell you already own.
- A cell explodes when it reaches its capacity: **2 in a corner, 3 on an edge,
  4 in the interior**.
- A cell that explodes clears itself and sends one orb to each orthogonal
  neighbour, converting enemy orbs to the exploding player.
- Cascades resolve automatically. A player with no orbs left is eliminated; the
  last player with orbs wins. Solo mode is a non-ending practice board.

The app opens on a home screen with **New game**, **Settings**, **How to play**,
and **About**, plus **Resume** when an unfinished saved match exists.

- **Resume** restores an unfinished saved match. It only appears when such a
  save exists; with no save, or after a finished match, the button is hidden.
- **New game** starts a fresh match and discards any previous save.
- **Settings** controls the light/dark theme, the Bot opponent and its
  Easy/Medium/Hard difficulty, grid rows and columns, number of players,
  per-player names and colours, sound, and vibration. Changes are saved
  immediately; the theme also applies on the next launch without a light flash.
  Difficulty changes how the Bot searches for a move; Easy is random, Medium
  greedily builds and attacks, and Hard also searches your strongest reply
  before choosing.
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
│   ├── engine/         # Pure rules: types, board, cascade, moves, bot, winner
│   ├── ui/             # shell, board, HUD, overlay, animations, controller
│   ├── platform/       # storage, settings, sound, and haptics adapters
│   └── styles/         # tokens.css and app.css
├── tests/
│   ├── engine/         # board, moves, cascades, winner, bot, stress
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
npm test               # 93 engine, settings, storage, and UI tests
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
- [`docs/RELEASE.md`](docs/RELEASE.md) — exact Windows toolchain setup, build
  commands, signing, and the future release checklist.
- [`docs/FEATURES.md`](docs/FEATURES.md) — feature backlog (blank for now).

---

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | git baseline, archive `legacy/main.py`, keep the legacy web build runnable | done |
| 1 | pure TypeScript engine (`src/engine/`) + Vitest suite, no visual change | done |
| 2 | rebuild the UI on the engine: visible turn banner, win overlay, restart, save/resume, accessibility | done |
| 2.5 | home menu, settings, light/dark themes, 1–4 players, dynamic grids, names/colours, sound and vibration toggles | done |
| 2.6 | Bot opponent with Easy/Medium/Hard difficulty, stacking/attack heuristic, 2-ply Hard search, fixed `Bot` name, save-resumable AI seat | done |
| 3 | Capacitor 8 shell, Android project, Preferences persistence hardening, device matrix | debug APK built; device test pending |
| 4 | signing, release build, Play checklist, hardening | planned |

Definition of "stable" for the Android release: see
[`docs/ANDROID.md`](docs/ANDROID.md) §13.
