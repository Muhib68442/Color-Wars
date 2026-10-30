# Architecture

This document describes how the Color Wars code is organised, how state flows
through each implementation, and where the two versions diverge.

**Reading guide**

- §1–§3 document the **legacy code** (root web prototypes and
  `legacy/main.py`) as it exists today, including its known defects.
- §4.3 onward documents the **target structure** being built: a pure TypeScript
  engine, a DOM renderer, platform adapters, and a Capacitor Android shell.
- The Android packaging plan is in [`ANDROID.md`](ANDROID.md).

---

## 1. System overview

Color Wars is a hot-seat, two-player board game with two codebases that share
only the rules in spirit:

```
                    ┌─────────────────────────────┐
                    │        Game rules           │
                    │  7×7 board · alternating    │
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
│   │   ├── types.ts             # Player, Cell, Board, GameState, GameEvent
│   │   ├── board.ts             # createBoard, capacityAt, neighbours, counts
│   │   ├── cascade.ts           # resolveCascades -> events[]
│   │   ├── moves.ts             # createGame, legalMoves, applyMove
│   │   ├── winner.ts            # evaluateWinner
│   │   └── index.ts             # public API
│   ├── ui/
│   │   ├── app.ts               # controller: state, moves, restart, save
│   │   ├── shell.ts             # static markup and element lookup
│   │   ├── boardView.ts         # GameState -> 49 buttons, keyboard, ARIA
│   │   ├── hud.ts               # turn banner and player cards
│   │   ├── overlay.ts           # result and restart dialogs
│   │   ├── animations.ts        # consumes engine events
│   │   └── query.ts             # required-element helper
│   ├── platform/
│   │   ├── storage.ts           # save schema, localStorage adapter
│   │   ├── backButton.ts        # Android back handling (Phase 3)
│   │   └── haptics.ts           # navigator.vibrate; Capacitor in Phase 3
│   └── styles/
│       ├── tokens.css
│       └── app.css
├── tests/
│   ├── engine/*.test.ts         # rules, cascades, stress, DOM-free
│   ├── platform/storage.test.ts # schema and adapter
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
| `createGame(rows, cols)` | Initial `GameState` with an empty board |
| `capacityAt(rows, cols, row, col)` | 2 / 3 / 4 by position |
| `getCell` / `setCell` | Bounds-safe board access |
| `legalMoves(state)` / `isLegalMove(state, move)` | Move validation |
| `applyMove(state, move)` | Pure move application; returns `{ state, events, accepted }` |
| `evaluateWinner(state)` | Win/draw detection after cascades |
| `countOrbs` / `countCells` / `isStable` | Derived state and invariants |

`applyMove` **clones** the state; it never mutates its input. It returns an
event stream:

```ts
type GameEvent =
  | { type: "place"; at: CellRef; player: Player }
  | { type: "add"; at: CellRef; player: Player; orbs: number }
  | { type: "explode"; at: CellRef; player: Player; orbs: number }
  | { type: "transfer"; from: CellRef; to: CellRef; player: Player;
      captured: boolean; orbs: number }
  | { type: "cascade-limit"; reason: "limit" }
  | { type: "win"; winner: Player | null };
```

#### UI contract

- Render the board **from `GameState` only**; never patch individual cells ad
  hoc. This removes the ghost-orb class of bug by construction.
- Use `events[]` for animation (orb pop, explosion, transfer, win overlay).
- Own the turn banner, score, restart control, and input locking.
- Contain **no rule logic** (no capacity checks, no winner checks).

#### Platform contract

| Concern | Web adapter | Android adapter |
| --- | --- | --- |
| Storage | `localStorage` | `@capacitor/preferences` |
| Back button | no-op | `@capacitor/app` `backButton` listener |
| Haptics | no-op | `@capacitor/haptics` |
| Splash / status bar | n/a | `@capacitor/splash-screen`, status-bar APIs |
| Lifecycle | `visibilitychange` | `appStateChange` + `pause` |

The UI imports only the adapter interfaces, so the same build runs in a desktop
browser and inside the APK.

#### Why Capacitor

- One codebase; the APK bundles the Vite build as local assets and loads them in
  a native WebView shell. It is **not** a hosted website, a browser shortcut, or
  a Trusted Web Activity, so it works fully offline.
- The wrapper is a normal Android project, built by Gradle, signed like any
  native app, and distributed as APK or AAB.
- The chosen plugins are Java/Kotlin only, so the app carries no native `.so`
  libraries — a universal APK runs on `arm64-v8a`, `armeabi-v7a`, and `x86_64`.
- A native Kotlin/Compose rewrite would double the work for a turn-based board
  with 49 cells and no real-time rendering.

### 4.4 Migration phases

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | git baseline, archive `legacy/main.py`, keep the legacy web UI playable | **done** |
| 1 | pure TypeScript engine + Vitest suite (no visual change) | **done** |
| 2 | rewrite the UI against the engine: visible turn banner, win overlay, restart, save/resume, accessibility | **done** |
| 3 | Capacitor shell, Android project, device testing | next |
| 4 | signing, release build, Play checklist, hardening | planned |

The root `index.html`, `src/ui/`, `src/platform/`, and `src/styles/` are the new
UI. The legacy `style.css` / `script.js` were removed once the engine-backed UI
replaced them.

### 4.5 Android packaging

The APK/AAB plan, supported Android range, build commands, signing, device test
matrix, and release checklist are documented in [`ANDROID.md`](ANDROID.md).
Short version: Capacitor 8 (minSdk 24 / target 36), Node 22, JDK 21, Android
Studio 2025.2.1+, fully offline assets, no runtime permissions required.

---

## 5. Extension points

- **Board size:** parameterise `rows × cols`; derive capacity from position.
- **Players:** 2–4 players only requires an owner identifier and turn rotation.
- **AI:** the engine's `legalMoves` + `applyMove` supports minimax/MCTS.
- **Undo:** snapshot the state before each move.
- **Network play:** serialise `applyMove` inputs or event streams.
- **Persistence:** store the board as a compact string (`0`, `1`, `2` plus orb
  counts).
- **Animation:** consume engine events with a tween queue instead of redrawing
  instantly.

---

## 6. Testing strategy

The engine is tested with **Vitest** (`npm test`), independently of the DOM and
of Capacitor:

1. **Board and capacity**
   - corners 2, edges 3, interior 4;
   - neighbour lists match capacity;
   - degenerately small boards are rejected.
2. **Move legality**
   - empty cells and own cells are legal;
   - enemy cells, out-of-bounds moves, and moves after game over are rejected
     without mutating state.
3. **Cascades**
   - a detonation clears the source and spreads to exactly the in-bounds
     neighbours;
   - ownership conversion;
   - chain reactions cascade to stability;
   - no cell is left at or above capacity after a normal move.
4. **Win and lock**
   - no premature win before both players have moved;
   - elimination during a cascade ends the game immediately;
   - input is locked afterwards.
5. **Stability stress**
   - deterministic random play over hundreds of moves;
   - invariant checks after every move (owner valid, orbs positive, board
     stable unless a cascade limit was hit);
   - pathological cascades terminate through the step cap.
6. **UI tests (Phase 2)** — clicking an empty cell always places a coin; a win
   shows an overlay and locks input; the rendered DOM matches the model after
   every cascade.
7. **Device tests (Phase 3–4)** — see the matrix in
   [`ANDROID.md`](ANDROID.md#testing-matrix).
