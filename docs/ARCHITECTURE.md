# Architecture

This document describes how the Color Wars code is organised, how state flows
through each implementation, and where the two versions diverge.

**Reading guide**

- §1–§3 document the **legacy code** (root web prototypes and
  `legacy/main.py`) as it was, including its known defects. The root web
  prototype has since been replaced by the TypeScript build.
- §4.3 onward documents the **current structure**: a pure TypeScript engine, a
  DOM renderer, platform adapters, and the planned Capacitor Android shell.
- The Android packaging plan is in [`ANDROID.md`](ANDROID.md).

---

## 1. System overview

Color Wars is a hot-seat board game for **one to four players** on a rectangular
grid with **7–15 rows and 7–15 columns** (for example 11×7 or 15×15).
Historically it shipped as two disagreeing codebases that shared only the rules
in spirit:

```
                    ┌─────────────────────────────┐
                    │        Game rules           │
                    │ 7–15 per axis · 1–4 players ·  │
                    │  turns · orb explosions     │
                    └──────────────┬──────────────┘
                                   │ (implemented twice)
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
     ┌───────────────────────┐           ┌───────────────────────┐
     │     Web version       │           │    Desktop version    │
     │ index.html            │           │ legacy/main.py               │
     │ style.css             │           │ (Pygame)              │
     │ script.js             │           │                       │
     └───────────────────────┘           └───────────────────────┘
```

There is no shared engine, no shared configuration, and no tests. Any rule
change must be made twice, and the two copies currently disagree (see §5).

---

## 2. Web implementation

### 2.1 Layers

| Layer | File | Responsibility |
| --- | --- | --- |
| Markup | `index.html` | Static shell: navbar, two player panels with `<progress>`, hidden `#turn` label, empty `#game-board` |
| Presentation | `style.css` | Design tokens (`:root` variables), layout, board grid, cell and dot styling |
| Behaviour | `script.js` | Board model, turn state, click handling, explosions, score updates, DOM rendering |

There is no framework and no module system. `script.js` is a single IIFE-like
`DOMContentLoaded` callback; all state lives in that closure and is unreachable
from the outside (which is why the game cannot be inspected or tested without
driving the DOM).

### 2.2 State model

```js
const ROWS = 7, COLS = 7;
const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
// cell: null | { player: 1 | 2, points: number }

let currentPlayer = 1;
let firstMove1 = true;   // true until Player 1 places their opening coin
let firstMove2 = true;   // true until Player 2 places their opening coin
```

Derived state is recomputed on demand by scanning `board`:

- occupied-cell count per player → `<progress>` values (`updateProgress`),
- zero-orb condition → winner (`checkGameOver`).

The DOM is a **second, unsynchronised copy** of the state. Each cell element
carries `data-row` / `data-col`, a `player1`/`player2` class, and one `.dot`
child per orb. Because rendering is manual and not derived from the model, the
two copies can drift (the "ghost coin" defect).

### 2.3 Control flow

```
DOMContentLoaded
  └─ createBoard()            build 49 .cell elements, attach click listeners
       └─ (later) click
            └─ handleCellClick
                 ├─ validate row/col
                 ├─ mutate board (placeCoin or incrementPoints)
                 │    └─ incrementPoints
                 │         └─ spreadPoints            (on 4 orbs)
                 │              └─ incrementPoints    (recursive cascade)
                 ├─ updateProgress()
                 ├─ checkGameOver()
                 └─ repaint active-player panel tint
```

Key characteristics:

- **Event handling:** one listener per cell (`cell.addEventListener`), not
  delegation. `event.target.closest(".cell")` recovers the cell when a dot is
  the actual target.
- **Rendering:** `updateCell` rewrites `className` and `innerHTML` for a single
  cell. There is no virtual DOM, no diffing, and no `requestAnimationFrame`.
- **Cascade:** recursive (`spreadPoints` ↔ `incrementPoints`) and mutates the
  board while iterating over directions. Termination relies on each exploded
  orb being reset to 1 point.
- **Turn state:** a single boolean toggle in `switchTurn()`.
- **Win state:** written into `#turn` (hidden) plus an inline background colour
  on a player panel.

### 2.4 Rendering contract

`updateCell(cell, player, points)` is the only writer of cell visuals:

| Argument | Effect |
| --- | --- |
| `points` is `0` or `null` | `className = "cell"`, `innerHTML = ""` |
| `points > 0` | `className = "cell player{player}"`, then `points` `.dot` children |

Because `incrementPoints` always calls `updateCell` **after** `spreadPoints`, an
exploded cell is repainted with `points === 1` even though `spreadPoints` set
`board[row][col] = null`. This is the direct cause of the ghost coin.

### 2.5 Web-specific limitations

- Board size is hard-coded in three places: `ROWS/COLS` in `script.js`,
  `repeat(7, 50px)` twice in `style.css`, and the 49-element assumption in
  `index.html` (`<progress max="49">`).
- The turn label is hidden by CSS, so all turn feedback depends on inline
  styles.
- No restart path: reloading the page is the only way to start over.
- No persistence, no audio, no animation, no input locking after game over.

---

## 3. Desktop implementation

### 3.1 Structure

`legacy/main.py` is a single script with module-level constants, one `Coin` class, and
a `main()` loop.

| Unit | Responsibility |
| --- | --- |
| Constants | Window size `700×750`, `7×7` grid, `BOX_SIZE = 100`, palette |
| `Coin` | Position, owner, orb count, drawing, increment, explosion test |
| `coins` (global list) | Sparse board: only occupied cells have entries |
| `draw_grid()` | Draws the 7×7 board with a 50 px top offset |
| `get_box_clicked()` | Converts mouse position to `(row, col)` |
| `get_coin()` | Linear scan of `coins` for a cell |
| `opponent_coins_exist()` | Win-condition query |
| `handle_explosions()` | One synchronous cascade pass, returns whether anything exploded |
| `main()` | Event loop, turn logic, rendering |

### 3.2 State model

The desktop version does **not** keep a 2D array. It keeps a flat list of
`Coin` objects and treats the absence of a coin as an empty cell:

```python
class Coin:
    row, col, player, points
```

This makes lookup O(n) and, critically, makes newly created coins invisible to
`get_coin()` until `handle_explosions()` commits the new list. That visibility
gap causes the duplicate-coin defect.

### 3.3 Control flow

```
main()
  └─ event loop
       ├─ QUIT → exit
       ├─ MOUSEBUTTONDOWN (if not game_over)
       │    ├─ clicked own coin     → increment_points(), flip turn, win check
       │    └─ clicked empty cell   → append Coin, flip turn, win check
       ├─ render frame (title, turn/winner, grid, coins)
       ├─ display.flip()
       └─ while handle_explosions():
              render frame, display.flip()
```

Notable properties:

- Explosions are resolved **after** the turn has already switched.
- `handle_explosions()` processes every coin at 4 orbs in one pass, rebuilds the
  coin list, and returns `exploded`; the outer `while` repeats until stable.
- There is no clock or delta time; the loop runs as fast as the CPU allows.
- The render inside the explosion loop reuses `turn_surface` from the previous
  frame and never re-evaluates the win condition.

### 3.4 Desktop-specific limitations

- Cascade redraws do not reflect the new turn state.
- No animation: the whole cascade renders as discrete frames.
- No menu, restart, score history, or persistence.
- Window size is fixed; no resizing or scaling.
- `pygame.init()` and `set_mode()` run at import time, which makes the module
  awkward to unit test (a temporary test must force `SDL_VIDEODRIVER=dummy`).

---

## 4. Cross-cutting concerns

### 4.1 Where the rules live

There is no single source of truth. Rules are spread across:

| Rule | Web location | Desktop location |
| --- | --- | --- |
| Legal move | `handleCellClick` | click branch in `main()` |
| Orb increment | `incrementPoints` | `Coin.increment_points` |
| Capacity / explosion trigger | `if (coin.points >= 4)` | `Coin.explode` + `increment_points` |
| Cascade | `spreadPoints` (recursive) | `handle_explosions` (iterative passes) |
| Neighbour conversion | inside `spreadPoints` | inside `handle_explosions` |
| Win condition | `checkGameOver` | `opponent_coins_exist` |

### 4.2 Divergences

| Behaviour | Web | Desktop |
| --- | --- | --- |
| Place on empty cell after opening move | ❌ not allowed | ✅ allowed |
| Explosion threshold | 4 everywhere | 4 everywhere |
| Cascade style | recursive, immediate | batch passes per frame |
| Explosion removes source orb | model yes, screen no (ghost) | yes |
| Duplicate coins possible | no | yes |
| Win checked after cascade | no | no |
| Turn feedback | panel tint | rendered text (visible) |

### 4.3 Target structure (web + Capacitor)

**Decision:** keep the web implementation and ship it as an Android app with
**Capacitor 8**. The Pygame implementation is archived under `legacy/` and is
not part of the product. The packaging and release plan lives in
[`ANDROID.md`](ANDROID.md).

```
color-wars/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── capacitor.config.ts          # Phase 3
├── src/
│   ├── main.ts                  # bootstrap + lifecycle persistence
│   ├── engine/                  # pure rules, no DOM, no platform APIs
│   │   ├── types.ts             # Player, PlayerCount, Cell, Board, GameState, GameEvent
│   │   ├── board.ts             # createBoard, capacityAt, neighbours, alivePlayers, nextPlayer, counts
│   │   ├── cascade.ts           # resolveCascades -> events[]
│   │   ├── moves.ts             # createGame, legalMoves, applyMove
│   │   ├── winner.ts            # evaluateWinner
│   │   └── index.ts             # public API
│   ├── ui/
│   │   ├── app.ts               # controller: screens, settings, moves, save, sound
│   │   ├── shell.ts             # home, match, settings, about, how-to-play markup
│   │   ├── boardView.ts         # GameState -> ROWS×COLS buttons, keyboard, ARIA
│   │   ├── hud.ts               # plain-text turn status and four player cards
│   │   ├── overlay.ts           # result, restart, and menu dialogs
│   │   ├── animations.ts        # consumes engine events
│   │   └── query.ts             # required-element helper
│   ├── platform/
│   │   ├── storage.ts           # save schema v2, localStorage adapter
│   │   ├── settings.ts          # settings model, colour helpers, persistence
│   │   ├── sound.ts             # Web Audio cues + no-op fallback
│   │   ├── backButton.ts        # Android back handling (Phase 3)
│   │   └── haptics.ts           # navigator.vibrate; Capacitor in Phase 3
│   └── styles/
│       ├── tokens.css
│       └── app.css
├── tests/
│   ├── engine/*.test.ts         # rules, cascades, stress, DOM-free
│   ├── platform/*.test.ts       # save schema, settings, adapters
│   └── ui/app.test.ts           # jsdom renderer and interaction
├── android/                     # generated by Capacitor, committed
├── legacy/
│   └── main.py                  # archived Pygame prototype
└── docs/
    ├── ARCHITECTURE.md
    ├── ALGORITHM.md
    ├── UI.md
    ├── ANDROID.md
    └── FEATURES.md
```

#### Engine contract

The engine is the **single source of truth** and has no knowledge of the DOM,
Pygame, Capacitor, or storage.

| Export | Responsibility |
| --- | --- |
| `createGame(rows, cols, playerCount)` | Initial `GameState` for 1–4 players; defaults to 7×7, 2 players |
| `capacityAt(rows, cols, row, col)` | 2 / 3 / 4 by position |
| `getCell` / `setCell` | Bounds-safe board access |
| `legalMoves(state)` / `isLegalMove(state, move)` | Move validation |
| `applyMove(state, move)` | Pure move application; returns `{ state, events, accepted }` |
| `evaluateWinner(state)` | Multi-player elimination, draw, and solo behaviour |
| `alivePlayers(state)` / `nextPlayer(state)` | Survivors and turn order (skips eliminated players) |
| `countOrbs` / `countCells` / `isStable` | Derived state and invariants |

`Player` is `1 | 2 | 3 | 4`, `PlayerCount` is `1 | 2 | 3 | 4`, `MIN_GRID_SIZE`
is 7, and `MAX_GRID_SIZE` is 15. `applyMove` **clones** the state; it never
mutates its input. It returns an event stream:

```ts
type GameEvent =
  | { type: "place"; at: CellRef; player: Player }
  | { type: "add"; at: CellRef; player: Player; orbs: number }
  | { type: "explode"; at: CellRef; player: Player; orbs: number }
  | { type: "transfer"; from: CellRef; to: CellRef; player: Player;
      captured: boolean; capturedFrom: Player | null; orbs: number }
  | { type: "cascade-limit"; reason: "limit" }
  | { type: "win"; winner: Player | null };
```

#### UI contract

- Render the board **from `GameState` only**; never patch individual cells ad
  hoc. This removes the ghost-orb class of bug by construction.
- Use `events[]` for animation (orb pop, explosion, transfer, win overlay).
- Own screen navigation (**home**, **match**, **settings**, **how to play**,
  **about**), the compact turn status, up to four score cards, dialogs, and
  input locking.
- Apply player names and colours from settings to the score cards, board
  labels, and palette tokens; apply the light/dark theme to `<html>` and
  regenerate the palette for that theme; grid rows/columns and player count take
  effect on the next **New game**.
- Contain **no rule logic** (no capacity checks, no winner checks).

#### Platform contract

| Concern | Web adapter | Android adapter |
| --- | --- | --- |
| Storage | `localStorage` | `@capacitor/preferences` |
| Settings | `localStorage` under `color-wars:settings` | `@capacitor/preferences` |
| Sound | Web Audio API (`createSound`) | Web Audio in the WebView; native audio if needed |
| Back button | no-op | `@capacitor/app` `backButton` listener |
| Haptics | `navigator.vibrate` / no-op | `@capacitor/haptics` |
| Splash / status bar | n/a | `@capacitor/splash-screen`, status-bar APIs |
| Lifecycle | `visibilitychange` | `appStateChange` + `pause` |

Both storage and settings go through the same `KeyValueStore` interface, so the
adapters can be swapped per platform without touching the controller. The UI
imports only the adapter interfaces and concrete factories from `src/main.ts`,
so the same build runs in a desktop browser and inside the APK.

#### Why Capacitor

- One codebase; the APK bundles the Vite build as local assets and loads them in
  a native WebView shell. It is **not** a hosted website, a browser shortcut, or
  a Trusted Web Activity, so it works fully offline.
- The wrapper is a normal Android project, built by Gradle, signed like any
  native app, and distributed as APK or AAB.
- The chosen plugins are Java/Kotlin only, so the app carries no native `.so`
  libraries — a universal APK runs on `arm64-v8a`, `armeabi-v7a`, and `x86_64`.
- A native Kotlin/Compose rewrite would double the work for a turn-based board
  with 49–225 cells and no real-time rendering.

### 4.4 Migration phases

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | git baseline, archive `legacy/main.py`, keep the legacy web UI playable | **done** |
| 1 | pure TypeScript engine + Vitest suite (no visual change) | **done** |
| 2 | rewrite the UI against the engine: visible turn banner, win overlay, restart, save/resume, accessibility | **done** |
| 2.5 | home menu, settings, 1–4 players, 7–15 rows/columns, names/colours, sound and vibration toggles | **done** |
| 3 | Capacitor shell, Android project, Preferences persistence hardening, device testing | next |
| 4 | signing, release build, Play checklist, hardening | planned |

The root `index.html`, `src/ui/`, `src/platform/`, and `src/styles/` are the new
UI. The legacy `style.css` / `script.js` were removed once the engine-backed UI
replaced them.

#### Save and settings schemas

```
Save     = { version: 2, savedAt: number, state: GameState }
Settings = { version: 3, settings: GameSettings }
```

`GameSettings` stores `theme` (`light` or `dark`), `gridRows` and `gridCols`
separately (each 7–15). Version-1 settings that used a single square `gridSize`
are normalized onto both axes on load; settings without a valid theme (v1/v2)
default to light. The theme is applied to `<html data-theme="…">`, and a small
inline script in `index.html` reads the saved value before first paint.

`SAVE_VERSION = 2` covers the multi-player, variable-grid state shape
(`playerCount`, `hasPlayed` for 1–4). Version-1 saves are rejected by
`parseSave` and removed from the store, so an older save can never half-load
into the new renderer. Phase 3 migrates the same payloads to
`@capacitor/preferences`; a migration hook can map v1 → v2 there if resuming
old games becomes a requirement.

### 4.5 Android packaging

The APK/AAB plan, supported Android range, build commands, signing, device test
matrix, and release checklist are documented in [`ANDROID.md`](ANDROID.md).
Short version: Capacitor 8 (minSdk 24 / target 36), Node 22, JDK 21, Android
Studio 2025.2.1+, fully offline assets, no runtime permissions required.

---

## 5. Extension points

- **Board size:** done — square 7×7 through 15×15, capacity derived from
  position.
- **Players:** done — 1–4 players via `Player`/`PlayerCount`, `hasPlayed`, and
  `nextPlayer` turn rotation.
- **AI:** the engine's `legalMoves` + `applyMove` supports minimax/MCTS. The
  Difficulty setting is already persisted and reserved for this.
- **Undo:** snapshot the state before each move.
- **Network play:** serialise `applyMove` inputs or event streams.
- **Persistence:** store the board as a compact string (`0`–`4` plus orb
  counts).
- **Animation:** consume engine events with a tween queue instead of redrawing
  instantly.
- **Themes:** done — light and dark token sets are selected by
  `<html data-theme>`, while the `--pN` / `--pN-soft` / `--pN-strong` tokens are
  regenerated for the active theme from settings.

---

## 6. Testing strategy

The engine is tested with **Vitest** (`npm test`), independently of the DOM and
of Capacitor. The suite currently has **93 tests across 8 files**.

1. **Board and capacity** (`tests/engine/board.test.ts`)
   - corners 2, edges 3, interior 4;
   - neighbour lists match capacity;
   - degenerately small boards are rejected;
   - `alivePlayers` / `nextPlayer` keep unplayed players alive and skip
     eliminated ones.
2. **Move legality and turns** (`tests/engine/moves.test.ts`)
   - empty cells and own cells are legal;
   - enemy cells, out-of-bounds moves, and moves after game over are rejected
     without mutating state;
   - `createGame(rows, cols, playerCount)` builds the requested rectangular
     board;
   - turns cycle 1→2→3→4→1 and skip eliminated players.
3. **Cascades** (`tests/engine/cascade.test.ts`)
   - a detonation clears the source and spreads to exactly the in-bounds
     neighbours;
   - ownership conversion;
   - chain reactions cascade to stability;
   - no cell is left at or above capacity after a normal move.
4. **Win, lock, and solo** (`tests/engine/winner.test.ts`)
   - no premature win before every player has moved;
   - elimination during a cascade ends the game immediately;
   - two opponents can be eliminated in one cascade, leaving one winner;
   - solo (`playerCount === 1`) is a non-ending practice board;
   - input is locked afterwards.
5. **Stability stress** (`tests/engine/stability.test.ts`)
   - deterministic random play over hundreds of moves;
   - invariant checks after every move (owner valid, orbs positive, board
     stable unless a cascade limit was hit);
   - pathological cascades terminate through the step cap.
6. **Storage and settings** (`tests/platform/`)
   - save round-trip, corrupt-save rejection, v1 rejection, four-player 15×15
     round-trip, unstable-board refusal;
   - settings defaults, clamping, theme validation and migration, name/colour
     sanitisation, colour blending, persistence, and corrupt-data fallback.
7. **UI tests** (`tests/ui/app.test.ts`, jsdom)
   - the home screen gates the match and all five actions exist;
   - **New game** clears the save, **Resume** restores an unfinished match;
   - settings change theme/grid/player count/names/colours/sound/vibration and
     persist across a reload; the theme applies to the document root;
   - four-player layout order (`3`, `2`, `board`, `1`, `4`) and hidden rails;
   - placing, capturing, focus movement, win overlay, and input locking;
   - solo status.
8. **Device tests (Phase 3–4)** — see the matrix in
   [`ANDROID.md`](ANDROID.md#testing-matrix).
