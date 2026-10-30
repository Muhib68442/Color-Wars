# User Interface

This document describes the current web UI: layout, DOM structure, design
tokens, components, visual states, interaction, responsiveness, and
accessibility. The UI is implemented in `src/ui/` and `src/styles/`.

The Pygame prototype in `legacy/main.py` is archived; its window is summarised
at the end for reference.

---

## 1. Layout

```
┌──────────────────────────────────────────────────────────────┐
│  header.navbar                              Color Wars  [New game] │  dark bar (#333)
├──────────────────────────────────────────────────────────────┤
│  section.hud                                                 │
│    p.turn   "Player 2 to move"                               │  live status, player-coloured edge
├──────────────────────────────────────────────────────────────┤
│  article.score[data-player="2"]   Player 2   · 3 cells · 5 orbs │  top player
├──────────────────────────────────────────────────────────────┤
│  main.stage                                                  │
│    div.board  (7×7 CSS grid, square, centred)                │
│      button.cell ×49                                         │
├──────────────────────────────────────────────────────────────┤
│  article.score[data-player="1"]   Player 1   · 2 cells · 4 orbs │  bottom player
├──────────────────────────────────────────────────────────────┤
│  p.hint   "Tap an empty cell or one of your own…"            │
└──────────────────────────────────────────────────────────────┘
```

The player panels are positionally fixed to the players, not to the turn:

| Player | Position | Why |
| --- | --- | --- |
| Player 2 | **above** the board | Opponent side of the table |
| Player 1 | **below** the board | Near side / the player who starts |

The board is centred between the two panels. `main.stage` is `flex: 1`, so the
bottom panel is pushed to the bottom of the viewport on tall screens and the
layout stays balanced on short ones.

The turn banner sits directly under the navbar. It is always visible, unlike
the legacy `#turn` element which was `display: none`.

---

## 2. DOM structure

`src/ui/shell.ts` writes this template into `#app`; `src/main.ts` only boots the
controller.

```
body
└── div#app.app
    ├── header.navbar
    │   ├── div.brand
    │   │   ├── h1.brand__title        "Color Wars"
    │   │   └── p.brand__tag           "Two players, one device"
    │   └── button.btn.btn--ghost[data-action="restart"]   "New game"
    ├── section.hud[aria-label="Game status"]
    │   └── p.turn[role="status"][aria-live="polite"][data-role="status"]
    ├── article.score.score--bar[data-player="2"][aria-label="Player 2 score"]
    │   ├── h2.score__name             "Player 2"
    │   └── p.score__stats
    │       ├── span > b[data-role="cells"]  + " cells"
    │       └── span > b[data-role="orbs"]   + " orbs"
    ├── main.stage
    │   └── div.board[data-role="board"][role="group"][aria-label="Board, 7 by 7"]
    │       └── 49 × button.cell[data-row][data-col][data-orbs][data-capacity]
    │           └── 4 × span.orb[aria-hidden="true"]
    ├── article.score.score--bar[data-player="1"][aria-label="Player 1 score"]
    └── p.hint[data-role="hint"]
dialog.overlay[aria-labelledby="overlay-title"]
    └── div.overlay__card
        ├── p.overlay__eyebrow
        ├── h2.overlay__title
        ├── p.overlay__body
        └── div.overlay__actions      (buttons built at runtime)
```

Every cell is a real `<button>`. The four orb spans are decorative
(`aria-hidden`); the button's `aria-label` carries the state, for example:

- `Row 3, column 4, empty`
- `Row 3, column 4, Player 1, 2 of 4 orbs`

The board is `role="group"` rather than `role="grid"` because each item is
already a focusable button; this avoids a broken grid/gridcell hierarchy.

---

## 3. Design tokens

Defined in `src/styles/tokens.css`.

| Token | Value | Used for |
| --- | --- | --- |
| `--bg` | `#e6e6ea` | Page background |
| `--surface` | `#ffffff` | Cards, status bar, board frame, dialog |
| `--surface-sunken` | `#f3f3f6` | Secondary buttons |
| `--nav` | `#333333` | Navbar |
| `--nav-ink` | `#ffffff` | Navbar text |
| `--ink` | `#14161a` | Primary text, Player 1 orbs |
| `--ink-muted` | `#5b5f69` | Secondary text, hints |
| `--line` | `#cfd0d6` | Borders and inset rings |
| `--p1` | `#6e6eff` | Player 1 fill |
| `--p1-soft` | `#ececff` | Active Player 1 card |
| `--p2` | `#ff5959` | Player 2 fill |
| `--p2-soft` | `#ffe8e8` | Active Player 2 card |
| `--accent` | `#1176ff` | Focus rings, primary button |
| `--cell-empty` | `#efeff3` | Empty cell fill |
| `--font-display` | `CustomFont`, Segoe UI | Title, player names, dialog title |
| `--font-body` | system UI stack | Everything else |
| `--safe-*` | `env(safe-area-inset-*)` | Android edge-to-edge padding |

`font.ttf` is bundled with `@font-face` and `font-display: swap`. There is no
remote font request, so the app works offline.

---

## 4. Components

### 4.1 Navbar

- Dark `#333` bar with rounded bottom corners and a subtle shadow.
- Left: title and tagline. Right: **New game**.
- The tagline is hidden below 380 px width and in short landscape viewports.

### 4.2 Turn banner (`.turn`)

- Full-width card with a 6 px coloured left edge: blue for Player 1, red for
  Player 2, dark grey when the game is over.
- Text: `Player N to move`, or `Player N wins!` / `It's a draw.` after the game.
- `role="status"` and `aria-live="polite"` announce every turn change and the
  result to screen readers.

### 4.3 Player cards (`.score.score--bar`)

- One card above the board (Player 2) and one below (Player 1).
- Each card shows the player's name, **cells owned**, and **orbs owned**.
- The left edge and name dot use the player colour; Player 2's dot is red.
- The active player's card gets a soft tint, a 2 px coloured ring, and a
  "playing" pill. The turn is therefore signalled by text, colour, position,
  and the banner — not colour alone.
- Stats are recomputed from `GameState` on every render:
  `countCells` / `countOrbs`.

### 4.4 Board (`.board`)

- Square CSS grid: `repeat(7, minmax(0, 1fr))`, gap `clamp(2px, 0.8vw, 6px)`.
- Width: `min(92vw, 52vh, 560px)`, so it fits phones, tablets, and desktop
  without horizontal scrolling.
- White frame with rounded corners and a small shadow.
- `touch-action: manipulation` removes the 300 ms tap delay on Android without
  disabling pinch-zoom for accessibility.

### 4.5 Cell (`button.cell`)

- Circular (`border-radius: 50%`), `aspect-ratio: 1`, at least ~44–57 px on
  typical phones (the board scales with the viewport).
- Empty: light grey fill with a visible border.
- Player 1: blue `--p1` fill. Player 2: red `--p2` fill.
- Legal cells get `cursor: pointer`, a hover ring, and scale slightly on press.
- Focus: 3 px accent ring with an offset, visible on both empty and owned cells.
- Illegal cells keep their focusability for inspection but are marked
  `aria-disabled="true"` and do nothing when activated.

### 4.6 Orbs (`.orb`)

- Up to four decorative dots inside an owned cell.
- Player 1 orbs are **solid dark**; Player 2 orbs are **hollow white with a dark
  ring**. This shape/fill difference makes ownership readable without colour.
- Layout by orb count:
  - 1 → centre
  - 2 → horizontal pair
  - 3 → triangle
  - 4 → 2×2
- `data-orbs` on the button drives positions via `--x` / `--y` custom
  properties; CSS transitions animate changes.

### 4.7 Hint

- One line of rules text under the bottom player card.
- Replaced with "Game over. Start a new game to play again." when the game ends.
- Hidden in short landscape viewports to save vertical space.

### 4.8 Overlay (`dialog.overlay`)

Used for two things:

1. **Result** — eyebrow "Game over", title `Player N wins` or `It's a draw`,
   explanation, and the actions **Play again** (primary) / **View board**.
2. **Restart confirmation** — title "Start over?", actions **Start over** /
   **Keep playing**, shown only when a game is in progress.

Behaviour:

- Native `<dialog>` with `showModal()`: focus is trapped, `Escape` cancels, the
  backdrop dims the board.
- Clicking the backdrop closes the dialog.
- Closing restores focus to the board.
- A finished game restored from storage shows the result dialog on launch.

---

## 5. Visual states

| State | Representation |
| --- | --- |
| Empty cell | Grey circle with a border |
| Player 1 cell | Blue fill, solid dark orbs |
| Player 2 cell | Red fill, hollow white orbs |
| Legal target | Pointer cursor, hover ring, press scale |
| Illegal target | No pointer, `aria-disabled="true"` |
| Active player | Card tint + ring + "playing" pill, coloured banner |
| Explosion | Source cell cleared; surrounding cells flash via Web Animations |
| Transfer / capture | Destination cell brightness flash, orb pop |
| Win | Banner text + modal dialog; board locked |
| Saved game | Restored on launch, result dialog if it was finished |

Because the board is re-rendered from `GameState` after every move, the DOM can
never show an orb the model does not contain (the legacy "ghost coin" bug).

---

## 6. Interaction

- **Pointer / touch:** tap or click a legal cell. Legal targets are any empty
  cell or a cell owned by the current player.
- **Keyboard:** cells form a single tab stop (roving `tabindex`). Once focused:
  - `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight` move focus.
  - `Home` / `End` jump to the start / end of the row.
  - `Enter` / `Space` place an orb (native button activation).
- **Illegal actions** (enemy cell, out of bounds, after game over) are ignored;
  the turn does not change and nothing is saved.
- **New game** asks for confirmation if a game is in progress; otherwise it
  starts immediately.
- **Haptics:** a short vibration on accepted moves and a slightly longer one on
  rejected moves where the platform supports `navigator.vibrate`; silently
  skipped in browsers that do not.
- **Animations:** place, add, explode, and transfer events are replayed as short
  Web Animations effects. They are skipped entirely when
  `prefers-reduced-motion: reduce` is set.

---

## 7. Responsiveness and safe areas

- Board width is bounded by viewport width, viewport height, and a 560 px cap.
- Player cards stretch to the full row; stats wrap on very narrow screens.
- The tagline and hint collapse on small/short viewports.
- Short landscape (`max-height: 560px`) reduces gaps and paddings; the page may
  scroll vertically rather than shrinking the board below usability.
- `viewport-fit=cover` plus `env(safe-area-inset-*)` padding keeps the UI clear
  of notches, gesture bars, and Android 15/16 system bars.
- No dark mode: `color-scheme: light` and `android:forceDarkAllowed=false` in the
  Android shell prevent WebView auto-dark from inverting the board.
- Text uses `clamp()` and the system font stack, so Android font-size and
  display-size settings scale it.

---

## 8. Accessibility

- Every cell is a `<button>` with a descriptive `aria-label` including row,
  column, owner, and orb count.
- The turn and result text live in an `aria-live="polite"` status region.
- Illegal cells expose `aria-disabled="true"`; the game-over state disables all
  cells.
- Ownership is not colour-only: Player 2 orbs are hollow, and the active card
  has a text "playing" pill.
- Visible `:focus-visible` rings on cells and buttons.
- Full keyboard play with a single board tab stop.
- Reduced-motion support.
- The dialog is a native modal with focus trapping and Escape handling.
- The board `role="group"` is labelled with its size.

Not yet covered: a dedicated high-contrast theme and TalkBack-specific testing
on a physical device (Phase 3).

---

## 9. Android shell notes (Phase 3)

- `viewport-fit=cover` and safe-area padding are already in place.
- The back button will close an open dialog, then ask before leaving a live
  game, then exit. That adapter lives in `src/platform/backButton.ts`.
- Preferences will replace `localStorage` behind the same `StorageAdapter`
  interface, so the UI code does not change.
- Haptics will use `@capacitor/haptics` behind the existing `Haptics`
  interface.
- The splash screen and status-bar colours are configured in the Capacitor
  shell, not in the UI.

---

## 10. Legacy UI (archived)

The previous `index.html` / `style.css` / `script.js` UI is preserved in git
history. It had a hidden `#turn` label, side-by-side player panels, fixed 50 px
cells, `div` cells with no keyboard support, and no win dialog. It was replaced
in Phase 2 and should not be reintroduced. See the "Legacy defects" section of
the [`README`](../README.md).

The Pygame window in `legacy/main.py` remains a 700 × 750 prototype: 100 px
cells, red/green coins, and turn/winner text that the board paints over. It is
not part of the product.
