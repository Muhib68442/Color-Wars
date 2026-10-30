# User Interface

This document describes the current web UI: screens, layout, DOM structure,
design tokens, components, states, interaction, responsiveness, and
accessibility. The UI is implemented in `src/ui/` and `src/styles/`.

The Pygame prototype in `legacy/main.py` is archived and is summarised at the
end for reference.

---

## 1. Screens

The app is a single page with three mutually exclusive screens plus a modal
dialog. Only one screen is visible at a time (`hidden` attribute).

| Screen | Purpose | Entry points |
| --- | --- | --- |
| **Home** | Branding, description, and match actions | Launch |
| **Match** | The 7×7 board, scores, and turn status | **Play**, **Continue**, **New game** |
| **How to play** | Rules, controls, and tips | Home **How to play**, in-match menu |
| **Dialog** | Result, restart confirmation, game menu | Game events, menu button |

```
Home ──Play / New game──▶ Match ──menu──▶ How to play
  ▲                         │                  │
  └────────Back to home─────┘◀────Back─────────┘
```

The back button on the How to play screen returns to whichever screen opened
it. Going home does not discard the match: it stays saved and the home button
becomes **Continue**.

---

## 2. Layout

### 2.1 Home

```
┌──────────────────────────────────────────────┐
│                                              │
│                  [ logo ]                    │
│                                              │
│                 Color Wars                   │
│   A two-player chain reaction game...        │
│                                              │
│              [    Play    ]                  │
│              [  New game  ]  (if saved)      │
│              [ How to play ]                 │
│                                              │
│          Saved game · Player 2 to move       │
└──────────────────────────────────────────────┘
```

- Centred column, vertically and horizontally.
- Logo, display-font title, one-paragraph description, stacked actions.
- **New game** only appears when a match is saved and unfinished.
- The note under the actions reports a saved game or the last result.
- The screen scrolls internally on very short viewports.

### 2.2 Match

```
┌──────────────────────────────────────────────┐
│  [☰]        Player 1 to move                 │  compact game bar (44 px)
│  Player 2           3 cells · 5 orbs         │  top player
│  ┌────────────────────────────────────────┐  │
│  │              7×7 board                 │  │
│  │            49 round cells              │  │
│  └────────────────────────────────────────┘  │
│  Player 1           2 cells · 4 orbs         │  bottom player
└──────────────────────────────────────────────┘
```

- **Player 2 is always above the board; Player 1 is always below it.** The
  panels belong to the players, not to the current turn.
- The game bar holds the menu button, the live turn status, and a matching
  spacer for symmetry. The status is **plain text**: no card, background,
  border, or shadow, so it adds no visual block and only the 44 px bar height.
- The board is centred in the remaining space (`main.stage` is `flex: 1`), so
  the bottom panel stays at the bottom edge on tall screens.

### 2.3 How to play

A sticky-style header bar with a back button and the title, followed by a
scrollable document with Goal, On your turn, Explosions, Winning, Controls,
and Tip sections. The content area scrolls independently; the header stays in
place.

---

## 3. DOM structure

`src/ui/shell.ts` writes this template into `#app`; `src/main.ts` only boots
the controller.

```
body
└── div#app.app
    ├── section.screen.screen--home[data-role="home"]
    │   ├── div.home__logo
    │   │   └── svg.logo                         (decorative app mark)
    │   ├── h1.home__title#home-title            "Color Wars"
    │   ├── p.home__desc
    │   ├── div.home__actions
    │   │   ├── button.btn.btn--primary.btn--large[data-action="play"]
    │   │   ├── button.btn.btn--secondary[data-action="new-game"]
    │   │   └── button.btn.btn--quiet[data-action="how-to"]
    │   └── p.home__note[data-role="save-note"]
    ├── section.screen.screen--game[data-role="game"]
    │   ├── header.gamebar
    │   │   ├── button.iconbtn[data-action="menu"]        ☰
    │   │   ├── p.turn[role="status"][aria-live="polite"][data-role="status"]
    │   │   └── span.gamebar__spacer
    │   ├── article.score.score--bar[data-player="2"]
    │   ├── main.stage
    │   │   └── div.board[data-role="board"][role="group"]
    │   │       └── 49 × button.cell[data-row][data-col][data-orbs][data-capacity]
    │   │           └── 4 × span.orb[aria-hidden="true"]
    │   └── article.score.score--bar[data-player="1"]
    ├── section.screen.screen--info[data-role="info"]
    │   ├── header.infobar
    │   │   ├── button.iconbtn[data-action="info-back"]   ‹
    │   │   ├── h2.infobar__title#info-title              "How to play"
    │   │   └── span.gamebar__spacer
    │   └── div.info
    │       ├── p.info__lead
    │       └── h3 / p / ul … per topic
    └── dialog.overlay[data-role="overlay"]
        └── div.overlay__card
            ├── p.overlay__eyebrow
            ├── h2.overlay__title
            ├── p.overlay__body
            └── div.overlay__actions            (buttons built at runtime)
```

Every cell is a real `<button>`. The four orb spans are decorative
(`aria-hidden`); the button's `aria-label` carries the state, for example:

- `Row 3, column 4, empty`
- `Row 3, column 4, Player 1, 2 of 4 orbs`

The board is `role="group"` rather than `role="grid"` because each item is
already a focusable button; this avoids a broken grid/gridcell hierarchy.

---

## 4. Design tokens

Defined in `src/styles/tokens.css`.

| Token | Value | Used for |
| --- | --- | --- |
| `--bg` | `#e6e6ea` | Page background |
| `--surface` | `#ffffff` | Cards, board frame, dialog |
| `--surface-sunken` | `#f3f3f6` | Secondary buttons |
| `--nav` | `#333333` | Theme colour / Android system bar |
| `--ink` | `#14161a` | Primary text, Player 1 orbs |
| `--ink-muted` | `#5b5f69` | Secondary text, home note |
| `--line` | `#cfd0d6` | Borders and inset rings |
| `--p1` | `#6e6eff` | Player 1 fill |
| `--p1-strong` | `#4d4ddb` | Player 1 border and status text |
| `--p1-soft` | `#ececff` | Active Player 1 card |
| `--p2` | `#ff5959` | Player 2 fill |
| `--p2-strong` | `#c93b3b` | Player 2 border and status text |
| `--p2-soft` | `#ffe8e8` | Active Player 2 card |
| `--accent` | `#1176ff` | Focus rings, primary button |
| `--cell-empty` | `#efeff3` | Empty cell fill |
| `--font-display` | `CustomFont`, Segoe UI | Title, player names, dialog title |
| `--font-body` | system UI stack | Everything else |
| `--safe-*` | `env(safe-area-inset-*)` | Android edge-to-edge padding |

`font.ttf` is bundled with `@font-face` and `font-display: swap`. There is no
remote font request, so the app works offline.

---

## 5. Components

### 5.1 Home screen

- Centred column with the app mark, display-font title, and a one-paragraph
  description.
- Actions are stacked full-width pill buttons capped at 320 px.
- **Play** starts or continues a match; its label becomes **Continue** when a
  saved match exists and **Play again** when the last match is finished.
- **New game** appears only for an unfinished saved match and discards it.
- **How to play** opens the rules screen.
- The note reads `Saved game · Player N to move` or `Last game: Player N won.`

### 5.2 Game bar and turn status (`.gamebar`, `.turn`)

- A 44 px row: menu button (44 px), centred status text, 44 px spacer.
- The status is plain text with no background, border, shadow, or card padding.
  It is player-coloured: blue for Player 1, red for Player 2, ink when over.
- Text: `Player N to move`, or `Player N wins!` / `It's a draw.` after the game.
- `role="status"` and `aria-live="polite"` announce every turn change and the
  result to screen readers.
- The menu button opens the in-match dialog (How to play, Restart match,
  Back to home, Keep playing).

### 5.3 Player cards (`.score.score--bar`)

- One card above the board (Player 2) and one below (Player 1).
- Each card shows the player's name, **cells owned**, and **orbs owned**.
- The left edge and name dot use the player colour; Player 2's dot is red.
- The active player's card gets a soft tint, a 2 px coloured ring, and a
  "playing" pill. The turn is therefore signalled by text, colour, position,
  and the bar — not colour alone.
- Stats are recomputed from `GameState` on every render:
  `countCells` / `countOrbs`.

### 5.4 Board (`.board`)

- Square CSS grid: `repeat(7, minmax(0, 1fr))`, gap `clamp(2px, 0.8vw, 6px)`.
- Width: `min(92vw, 52vh, 560px)`, so it fits phones, tablets, and desktop
  without scrolling.
- White frame with rounded corners and a small shadow.
- `touch-action: manipulation` removes the 300 ms tap delay on Android without
  disabling pinch-zoom for accessibility.

### 5.5 Cell (`button.cell`)

- Circular (`border-radius: 50%`), `aspect-ratio: 1`, at least ~44–57 px on
  typical phones (the board scales with the viewport).
- Empty: light grey fill with a visible border.
- Player 1: blue `--p1` fill. Player 2: red `--p2` fill.
- Legal cells get `cursor: pointer`, a hover ring, and scale slightly on press.
- Focus: 3 px accent ring with an offset, visible on both empty and owned cells.
- Illegal cells keep their focusability for inspection but are marked
  `aria-disabled="true"` and do nothing when activated.

### 5.6 Orbs (`.orb`)

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

### 5.7 How to play screen

- Header with a back button and the title, then a scrollable rules document.
- Covers goal, legal moves, capacities, cascade behaviour, winning, keyboard
  controls, and a strategy tip.
- Opened from the home screen or from the in-match menu; the back button
  returns to the opener.

### 5.8 Dialog (`dialog.overlay`)

Used for three things:

1. **Result** — eyebrow "Game over", title `Player N wins` or `It's a draw`,
   explanation, and **Play again** (primary) / **Back to home**.
2. **Restart confirmation** — title "Start over?", **Start over** /
   **Keep playing**, shown only when a game is in progress.
3. **Game menu** — title "Paused", the current turn, and **How to play**,
   **Restart match**, **Back to home**, **Keep playing**.

Behaviour:

- Native `<dialog>` with `showModal()`: focus is trapped, `Escape` cancels, the
  backdrop dims the board.
- Clicking the backdrop closes the dialog.
- Closing restores focus to the board.
- A finished saved game does not pop the dialog on launch; the home screen
  reports the result and offers **Play again**.

---

## 6. Visual states

| State | Representation |
| --- | --- |
| Home, no save | Logo, title, **Play**, **How to play** |
| Home, saved match | **Continue** + **New game** + saved-game note |
| Home, finished match | **Play again** + last-result note |
| Empty cell | Grey circle with a border |
| Player 1 cell | Blue fill, solid dark orbs |
| Player 2 cell | Red fill, hollow white orbs |
| Legal target | Pointer cursor, hover ring, press scale |
| Illegal target | No pointer, `aria-disabled="true"` |
| Active player | Card tint + ring + "playing" pill, coloured plain-text status |
| Explosion | Source cell cleared; surrounding cells flash via Web Animations |
| Transfer / capture | Destination cell brightness flash, orb pop |
| Win | Status text + modal dialog; board locked |
| Saved game | Restored on launch behind the home screen |

Because the board is re-rendered from `GameState` after every move, the DOM can
never show an orb the model does not contain (the legacy "ghost coin" bug).

---

## 7. Interaction

- **Pointer / touch:** tap or click a legal cell. Legal targets are any empty
  cell or a cell owned by the current player.
- **Keyboard:** cells form a single tab stop (roving `tabindex`). Once focused:
  - `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight` move focus.
  - `Home` / `End` jump to the start / end of the row.
  - `Enter` / `Space` place an orb (native button activation).
- **Home:** **Play** opens the match (or continues a save); **New game**
  discards the save and starts fresh.
- **Menu:** **How to play** opens the rules; **Restart match** asks for
  confirmation before clearing the board; **Back to home** keeps the save.
- **Illegal actions** (enemy cell, out of bounds, after game over, while a
  dialog is open, or outside the match screen) are ignored; the turn does not
  change and nothing is saved.
- **Haptics:** a short vibration on accepted moves and a slightly longer one on
  rejected moves where the platform supports `navigator.vibrate`; silently
  skipped in browsers that do not.
- **Animations:** place, add, explode, and transfer events are replayed as short
  Web Animations effects. They are skipped entirely when
  `prefers-reduced-motion: reduce` is set.

---

## 8. Responsiveness and safe areas

- The app shell is exactly `100dvh` tall with `overflow: hidden`; each screen
  manages its own scrolling. The rules screen scrolls its content, and the home
  screen scrolls on very short viewports.
- Board width is bounded by viewport width, viewport height, and a 560 px cap.
- Player cards stretch to the full row; stats wrap on very narrow screens.
- Short landscape (`max-height: 560px`) shrinks the game bar, icon buttons,
  score padding, and board, hides the home description, and lays the home
  actions out in a row.
- `viewport-fit=cover` plus `env(safe-area-inset-*)` padding keeps the UI clear
  of notches, gesture bars, and Android 15/16 system bars.
- No dark mode: `color-scheme: light` and `android:forceDarkAllowed=false` in the
  Android shell prevent WebView auto-dark from inverting the board.
- Text uses `clamp()` and the system font stack, so Android font-size and
  display-size settings scale it.

---

## 9. Accessibility

- Every cell is a `<button>` with a descriptive `aria-label` including row,
  column, owner, and orb count.
- The turn and result text live in an `aria-live="polite"` status region.
- Illegal cells expose `aria-disabled="true"`; the game-over state disables all
  cells.
- Ownership is not colour-only: Player 2 orbs are hollow, and the active card
  has a text "playing" pill.
- Visible `:focus-visible` rings on cells, icon buttons, and text buttons.
- Full keyboard play with a single board tab stop.
- Reduced-motion support.
- The dialog is a native modal with focus trapping and Escape handling.
- The board `role="group"` is labelled with its size; each screen is labelled
  by its heading.
- Screen changes move focus deliberately: **Play** lands on the board, the
  rules screen lands on **Back**, and returning home lands on **Play**.

Not yet covered: a dedicated high-contrast theme and TalkBack-specific testing
on a physical device (Phase 3).

---

## 10. Android shell notes (Phase 3)

- `viewport-fit=cover` and safe-area padding are already in place.
- The back button will return from How to play, then close the dialog, then ask
  before leaving a live match, then exit. That adapter lives in
  `src/platform/backButton.ts`.
- Preferences will replace `localStorage` behind the same `StorageAdapter`
  interface, so the UI code does not change.
- Haptics will use `@capacitor/haptics` behind the existing `Haptics`
  interface.
- The splash screen and status-bar colours are configured in the Capacitor
  shell, not in the UI.

---

## 11. Legacy UI (archived)

The previous `index.html` / `style.css` / `script.js` UI is preserved in git
history. It had a hidden `#turn` label, side-by-side player panels, a navbar
duplicating the game title, a permanent hint paragraph, fixed 50 px `div` cells
with no keyboard support, and no win dialog. It was replaced in Phase 2 and
should not be reintroduced. See the "Legacy defects" section of the
[`README`](../README.md).

The Pygame window in `legacy/main.py` remains a 700 × 750 prototype: 100 px
cells, red/green coins, and turn/winner text that the board paints over. It is
not part of the product.
