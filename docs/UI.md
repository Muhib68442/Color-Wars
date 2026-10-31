# User Interface

This document describes the current web UI: screens, layout, DOM structure,
design tokens, components, states, interaction, responsiveness, and
accessibility. The UI is implemented in `src/ui/` and `src/styles/`.

The Pygame prototype in `legacy/main.py` is archived and is summarised at the
end for reference.

---

## 1. Screens

The app is a single page with five mutually exclusive screens plus a modal
dialog. Only one screen is visible at a time (`hidden` attribute).

| Screen | Purpose | Entry points |
| --- | --- | --- |
| **Home** | Branding and the five top-level actions | Launch, Back to home |
| **Match** | The board, one score card per active player, and turn status | **Resume**, **New game** |
| **Settings** | Grid, player count, names, colours, sound, vibration, difficulty | Home **Settings** |
| **How to play** | Rules, controls, and tips | Home **How to play**, in-match menu |
| **About** | Version, privacy, and credits | Home **About** |
| **Dialog** | Result, restart confirmation, game menu | Game events, menu button |

```
                 ┌──────────────▶ Settings ──back──▶ Home
                 │                    ▲
                 ├──────────────▶ About ────back──▶ Home
                 │                    ▲
Home ──Resume/New game──▶ Match ──menu──▶ How to play ──back──▶ opener
  ▲                        │
  └────Back to home────────┘
```

The back button on How to play returns to whichever screen opened it. Going
home does not discard an unfinished match: it stays saved and **Resume** becomes
enabled.

---

## 2. Layout

### 2.1 Home

```
┌──────────────────────────────────────────────┐
│                                              │
│                  [ logo ]                    │
│                                              │
│                 Color Wars                   │
│  A chain reaction game for one to four ...   │
│                                              │
│              [   Resume    ]                 │
│              [  New game   ]                 │
│         [ Settings · How to play · About ]    │
│                                              │
│     Saved match · 9 × 9 · Player 2 to move   │
└──────────────────────────────────────────────┘
```

- Centred column, vertically and horizontally.
- Logo, display-font title, one-paragraph description, then actions.
- **Resume** and **New game** are full-width stacked buttons; the remaining
  three actions sit in a wrapped, centred row.
- **Resume** is only rendered when an unfinished save exists; it is hidden when
  there is no save or the saved match is finished.
- The note under the actions reports the saved match, the last result, or the
  configuration the next **New game** will use.
- The screen scrolls internally on very short viewports.

### 2.2 Match (two players)

```
┌──────────────────────────────────────────────┐
│  [☰]        Player 1 to move                 │  compact game bar (44 px)
│  Player 2           3 cells · 5 orbs         │  top player
│  ┌────────────────────────────────────────┐  │
│  │           7×7 … 15×15 board            │  │
│  │         49 … 225 round cells           │  │
│  └────────────────────────────────────────┘  │
│  Player 1           2 cells · 4 orbs         │  bottom player
└──────────────────────────────────────────────┘
```

### 2.3 Match (four players)

```
┌──────────────────────────────────────────────┐
│  [☰]        Ada to move                      │
│ ┌──┐  Player 2          1 cell · 2 orbs       │
│ │P3│  ┌──────────────────────────────────┐    │
│ │  │  │            9 × 9 board           │    │
│ │  │  └──────────────────────────────────┘  ┌──┐
│ │  │  Player 1          0 cells · 0 orbs    │P4│
│ └──┘                                        └──┘
└──────────────────────────────────────────────┘
```

With 3 players the right rail stays empty; with 2 players both rails are
`hidden`.

- **Player 2 is always above the board; Player 1 is always below it.**
- **Player 3** is a vertical card in the left rail and **Player 4** in the right
  rail. Their names use rotated vertical text (the whole label turned 90° and
  read top-to-bottom), so `Player 3` stays compact in a narrow rail on a phone.
  The rails exist in the DOM at all times but are `hidden` unless
  `playerCount` is 3 or 4.
- The panels belong to the players, not to the current turn.
- The game bar holds the menu button, the live turn status, and a matching
  spacer for symmetry. The status is **plain text**: no card, background,
  border, or shadow.
- The board is centred in the remaining space (`main.stage` is `flex: 1`), so
  the bottom card stays at the bottom edge on tall screens, and the side rails
  stretch the full match height.

### 2.4 Settings

A header bar with a back button and the title, followed by a scrollable column
of cards:

1. **Match** — difficulty segmented control (with a “Bot · soon” badge), grid
   stepper.
2. **Players** — player-count segmented control (1–4) and one row per player
   with a colour swatch and a name field. Rows above the selected count are
   hidden.
3. **Feedback** — Sound and Vibration switches.
4. **Reset to defaults** — a quiet button below the cards.

### 2.5 How to play

A header bar with a back button and the title, followed by a scrollable document
with Goal, On your turn, Explosions, Winning, Controls, and Tip sections. The
content area scrolls independently; the header stays in place.

### 2.6 About

A header bar and a scrollable document with the app mark, name, `Version 0.2.0`,
a one-line description, and sections for one-device play, privacy/offline,
tech, and credits.

---

## 3. DOM structure

`src/ui/shell.ts` writes this template into `#app`; `src/main.ts` only boots the
controller.

```
body
└── div#app.app
    ├── section.screen.screen--home[data-role="home"]
    │   ├── div.home__logo
    │   │   └── svg.logo                         (decorative app mark)
    │   ├── h1.home__title#home-title            "Color Wars"
    │   ├── p.home__desc
    │   ├── div.home__actions
    │   │   ├── button.btn.btn--primary.btn--large[data-action="resume"]
    │   │   ├── button.btn.btn--secondary.btn--large[data-action="new-game"]
    │   │   └── div.home__links
    │   │       ├── button.btn.btn--quiet[data-action="settings"]
    │   │       ├── button.btn.btn--quiet[data-action="how-to"]
    │   │       └── button.btn.btn--quiet[data-action="about"]
    │   └── p.home__note[data-role="save-note"]
    ├── section.screen.screen--game[data-role="game"]
    │   ├── header.gamebar
    │   │   ├── button.iconbtn[data-action="menu"]        ☰
    │   │   ├── p.turn[role="status"][aria-live="polite"][data-role="status"]
    │   │   └── span.gamebar__spacer
    │   └── div.match[data-role="match"]
    │       ├── article.score.score--rail[data-player="3"]   (hidden at 1–2 players)
    │       ├── div.match__center
    │       │   ├── article.score.score--bar[data-player="2"]
    │       │   ├── main.stage
    │       │   │   └── div.board[data-role="board"][role="group"]
    │       │   │       └── ROWS×COLS × button.cell[data-row][data-col][data-orbs][data-capacity]
    │       │   │           └── 4 × span.orb[aria-hidden="true"]
    │       │   └── article.score.score--bar[data-player="1"]
    │       └── article.score.score--rail[data-player="4"]   (hidden unless 4 players)
    ├── section.screen.screen--info[data-role="info"]
    │   ├── header.infobar
    │   │   ├── button.iconbtn[data-action="info-back"]   ‹
    │   │   ├── h2.infobar__title#info-title              "How to play"
    │   │   └── span.gamebar__spacer
    │   └── div.info (h3 / p / ul … per topic)
    ├── section.screen.screen--settings[data-role="settings"]
    │   ├── header.infobar
    │   │   ├── button.iconbtn[data-action="settings-back"]   ‹
    │   │   ├── h2.infobar__title#settings-title              "Settings"
    │   │   └── span.gamebar__spacer
    │   └── div.settings
    │       ├── section.panel                        Match
    │       │   ├── div.segmented[data-role="difficulty"]
    │       │   │   └── button[data-difficulty="easy|medium|hard"]
    │       │   └── div.stepper
    │       │       ├── button[data-action="grid-minus"]
    │       │       ├── output[data-role="grid-value"]
    │       │       └── button[data-action="grid-plus"]
    │       ├── section.panel                        Players
    │       │   ├── div.segmented[data-role="player-count"]
    │       │   │   └── button[data-count="1|2|3|4"]
    │       │   └── div.player-list
    │       │       └── div.player-row[data-player="1..4"]
    │       │           ├── input.player-row__color[type="color"][data-role="player-color"]
    │       │           └── input[type="text"][data-role="player-name"]
    │       ├── section.panel                        Feedback
    │       │   ├── label.switch > input[data-setting="sound"]
    │       │   └── label.switch > input[data-setting="vibration"]
    │       └── button.btn.btn--quiet[data-action="reset-settings"]
    ├── section.screen.screen--about[data-role="about"]
    │   ├── header.infobar
    │   │   ├── button.iconbtn[data-action="about-back"]   ‹
    │   │   ├── h2.infobar__title#about-title              "About"
    │   │   └── span.gamebar__spacer
    │   └── div.info.about
    │       ├── div.about__brand (logo, name, version)
    │       └── h3 / p … per topic
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
- `Row 3, column 4, Ada, 2 of 4 orbs` (custom name)
- `Row 3, column 4, Player 1, 2 of 4 orbs` (default name)

The board is `role="group"` rather than `role="grid"` because each item is
already a focusable button; this avoids a broken grid/gridcell hierarchy. Its
`aria-label` is updated to the active size, e.g. `Board, 9 by 9`.

Score cards carry `aria-label="<name> score"`, refreshed from the player's
custom name. The settings screen uses `aria-pressed` on both segmented controls
and `aria-live="polite"` on the grid value.

---

## 4. Design tokens

Defined in `src/styles/tokens.css`.

| Token | Value | Used for |
| --- | --- | --- |
| `--bg` | `#e6e6ea` | Page background |
| `--surface` | `#ffffff` | Cards, board frame, dialog |
| `--surface-sunken` | `#f3f3f6` | Secondary buttons, player rows, segments |
| `--nav` | `#333333` | Theme colour / Android system bar |
| `--ink` | `#14161a` | Primary text |
| `--ink-muted` | `#5b5f69` | Secondary text, hints, home note |
| `--line` | `#cfd0d6` | Borders and inset rings |
| `--p1` | `#6e6eff` | Player 1 fill |
| `--p1-strong` | `#4d4ddb` | Player 1 border and status text |
| `--p1-soft` | `#ececff` | Active Player 1 card |
| `--p2` | `#ff5959` | Player 2 fill |
| `--p2-strong` | `#c93b3b` | Player 2 border and status text |
| `--p2-soft` | `#ffe8e8` | Active Player 2 card |
| `--p3` | `#2fa84f` | Player 3 fill |
| `--p3-strong` | `#1d7a38` | Player 3 border and status text |
| `--p3-soft` | `#e6f6ea` | Active Player 3 card |
| `--p4` | `#f0a12e` | Player 4 fill |
| `--p4-strong` | `#b8740f` | Player 4 border and status text |
| `--p4-soft` | `#fdf2df` | Active Player 4 card |
| `--accent` | `#1176ff` | Focus rings, primary button |
| `--cell-empty` | `#efeff3` | Empty cell fill |
| `--font-display` | `CustomFont`, Segoe UI | Title, player names, dialog title |
| `--font-body` | system UI stack | Everything else |
| `--safe-*` | `env(safe-area-inset-*)` | Android edge-to-edge padding |

### Custom player colours

`createApp` overrides the `--p1`–`--p4` family at runtime from the saved
settings:

```
--pN         the chosen hex
--pN-strong  chosen colour strengthened 22 % toward black
--pN-soft    chosen colour softened 84 % toward white
```

`strengthenColor` and `softenColor` live in `platform/settings.ts`. The board
also sets per-cell `--pc`, `--pc-strong`, `--orb-ink`, and `--orb-alt` so that
orb ink stays readable on any chosen colour.

`font.ttf` is bundled with `@font-face` and `font-display: swap`. There is no
remote font request, so the app works offline.

---

## 5. Components

### 5.1 Home screen

- Centred column with the app mark, display-font title, and a one-paragraph
  description.
- **Resume** is the primary action and appears only for an unfinished save.
- **New game** always starts a fresh match and clears the previous save.
- **Settings**, **How to play**, and **About** are quiet buttons in a wrapped
  row.
- The note reads `Saved match · R × C · <name> to move`, `Last game: <name>
  won.`, `Last game ended in a draw.`, or `New game · R × R · N players`
  (or `1 player · solo practice`).

### 5.2 Game bar and turn status (`.gamebar`, `.turn`)

- A 44 px row: menu button (44 px), centred status text, 44 px spacer.
- The status is plain text with no background, border, shadow, or card padding.
  It is player-coloured via `[data-player]`: `--p1-strong` … `--p4-strong`, and
  ink when the game is over.
- Text: `Player N to move`, `<custom name> to move`, `Player N · solo
  practice`, `<name> wins!`, or `It's a draw.`
- `role="status"` and `aria-live="polite"` announce every turn change and the
  result to screen readers.
- The menu button opens the in-match dialog (How to play, Restart match,
  Back to home, Keep playing).

### 5.3 Player cards (`.score`)

There are four cards in the DOM; `hud.ts` hides any card whose player number
exceeds `state.playerCount`.

| Player | Variant | Position |
| --- | --- | --- |
| 1 | `score--bar` | Below the board |
| 2 | `score--bar` | Above the board |
| 3 | `score--rail` | Left rail |
| 4 | `score--rail` | Right rail |

- Each card shows the player's custom name (or `Player N`), **cells owned**, and
  **orbs owned**.
- The bar cards carry no coloured left border in the idle or active state; a
  name dot in the player colour identifies the owner.
- The rail cards have no coloured top border; their player name is set in
  rotated vertical text (`writing-mode: vertical-rl`, `text-orientation:
  mixed`), so the label reads sideways from top to bottom.
- The active player's card gets a soft tint, a 2 px coloured ring, and a
  "playing" pill (bar cards) or "turn" pill (rail cards). The turn is signalled
  by text, colour, position, and the bar — not colour alone.
- Stats are recomputed from `GameState` on every render:
  `countCells` / `countOrbs`.

### 5.4 Board (`.board`)

- Square CSS grid driven by `--cols`: `repeat(var(--cols, 7), minmax(0, 1fr))`.
- Width: `min(100%, 52vh, 560px)`, so it fits phones, tablets, and desktop
  without scrolling; the board never exceeds the centre column.
- The board is re-created when the grid size changes. It supports 7×7 through
  15×15 (49–225 cells).
- White frame with rounded corners and a small shadow.
- `touch-action: manipulation` removes the 300 ms tap delay on Android without
  disabling pinch-zoom for accessibility.

### 5.5 Cell (`button.cell`)

- Circular (`border-radius: 50%`), `aspect-ratio: 1`, sized by the grid.
- Empty: light grey fill with a visible border.
- Owned: solid player colour with a strengthened border. Player 1–4 classes
  (`cell--p1` … `cell--p4`) are applied from the owner.
- Legal cells get `cursor: pointer`, a hover ring, and scale slightly on press.
- Focus: 3 px accent ring with an offset, visible on both empty and owned cells.
- Illegal cells keep their focusability for inspection but are marked
  `aria-disabled="true"` and do nothing when activated.

### 5.6 Orbs (`.orb`)

- Up to four decorative dots inside an owned cell.
- Ownership stays readable without relying on hue: each player uses a different
  fill/ring pattern on top of the custom colour.

| Player | Orb treatment |
| --- | --- |
| 1 | Solid, ink-coloured (dark on light colours, white on dark) |
| 2 | Hollow white with an ink ring |
| 3 | Solid with a contrasting inner ring |
| 4 | Hollow white with a double ring |

- Layout by orb count:
  - 1 → centre
  - 2 → horizontal pair
  - 3 → triangle
  - 4 → 2×2
- `data-orbs` on the button drives positions via `--x` / `--y` custom
  properties; CSS transitions animate changes.

### 5.7 Settings screen

- **Difficulty** segmented control: Easy / Medium / Hard. Saved immediately but
  currently UI-only; a `Bot · soon` badge makes the status explicit.
- **Grid size** stepper: 7–15, step 1, with the minus/plus buttons disabled at
  the limits. Shows `<n> × <n>`. Applies on the next **New game**.
- **Number of players** segmented control: 1 / 2 / 3 / 4. Applies on the next
  **New game** and reveals the matching player rows.
- **Player rows**: a native colour input and a text input capped at 16
  characters. Empty names fall back to `Player N` on blur. Names and colours
  apply immediately, including to an existing match.
- **Feedback**: Sound and Vibration switches. Both gate the corresponding
  platform calls on the next move.
- **Reset to defaults** restores the full default settings object and saves it.

All settings are written to `color-wars:settings` as
`{ version: 1, settings: GameSettings }` on every change.

### 5.8 How to play screen

- Header with a back button and the title, then a scrollable rules document.
- Covers goal, legal moves, capacities, cascade behaviour, multi-player
  elimination, solo practice, keyboard controls, and a strategy tip.
- Opened from the home screen or from the in-match menu; the back button
  returns to the opener.

### 5.9 About screen

- App mark, name, and `Version 0.2.0`.
- Describes one-device play, offline/privacy behaviour, the tech stack, and
  credits.
- Opened from home; the back button returns home.

### 5.10 Dialog (`dialog.overlay`)

Used for three things:

1. **Result** — eyebrow "Game over", title `<name> wins` or `It's a draw`,
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
  reports the result and **Resume** is hidden.

---

## 6. Visual states

| State | Representation |
| --- | --- |
| Home, no save | Logo, title, **New game** + links (no **Resume**), `New game · …` note |
| Home, saved match | **Resume** and **New game**, saved-match note |
| Home, finished match | **New game** + links (no **Resume**), last-result note |
| Empty cell | Grey circle with a border |
| Player 1–4 cell | Solid custom colour, owner-specific orb pattern |
| Legal target | Pointer cursor, hover ring, press scale |
| Illegal target | No pointer, `aria-disabled="true"` |
| Active player | Card tint + ring + "playing"/"turn" pill, coloured plain-text status |
| Explosion | Source cell cleared; surrounding cells flash via Web Animations |
| Transfer / capture | Destination cell brightness flash, orb pop |
| Win | Status text + modal dialog; board locked |
| Solo mode | One score card, status reads `Player N · solo practice`, never ends |
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
- **Home:** **Resume** opens the saved match; **New game** discards any save
  and starts fresh from the current settings.
- **Settings:** segmented buttons and the stepper update the saved settings
  immediately; player rows update names/colours live; switches gate sound and
  vibration.
- **Menu:** **How to play** opens the rules; **Restart match** asks for
  confirmation before clearing the board; **Back to home** keeps the save.
- **Illegal actions** (enemy cell, out of bounds, after game over, while a
  dialog is open, or outside the match screen) are ignored; the turn does not
  change and nothing is saved.
- **Haptics:** a short vibration on accepted moves and a slightly longer one on
  rejected moves where the platform supports `navigator.vibrate`; suppressed
  while the Vibration setting is off and silently skipped where unsupported.
- **Sound:** place, explosion, win, and reject cues through the Web Audio API;
  suppressed while the Sound setting is off.
- **Animations:** place, add, explode, and transfer events are replayed as short
  Web Animations effects. They are skipped entirely when
  `prefers-reduced-motion: reduce` is set.

---

## 8. Responsiveness and safe areas

- The app shell is exactly `100dvh` tall with `overflow: hidden`; each screen
  manages its own scrolling. The rules, settings, and about screens scroll their
  content, and the home screen scrolls on very short viewports.
- Board width is bounded by the centre column, viewport height, and a 560 px cap.
- In four-player mode the side rails take `clamp(48px, 13vw, 108px)` each; below
  520 px they collapse to 48 px with smaller type.
- Player cards stretch to the full row; stats wrap on very narrow screens.
- Short landscape (`max-height: 560px`) shrinks the game bar, icon buttons,
  score padding, board, and side rails, hides the home description, and lays
  the home actions out in a row.
- `viewport-fit=cover` plus `env(safe-area-inset-*)` padding keeps the UI clear
  of notches, gesture bars, and Android 15/16 system bars.
- No dark mode: `color-scheme: light` and `android:forceDarkAllowed=false` in the
  Android shell prevent WebView auto-dark from inverting the board.
- Text uses `clamp()` and the system font stack, so Android font-size and
  display-size settings scale it.

---

## 9. Accessibility

- Every cell is a `<button>` with a descriptive `aria-label` including row,
  column, owner name, and orb count.
- The turn and result text live in an `aria-live="polite"` status region; the
  grid value in Settings is also live.
- Illegal cells expose `aria-disabled="true"`; the game-over state disables all
  cells.
- Ownership is not colour-only: each player has a distinct orb fill/ring and the
  active card has a text "playing"/"turn" pill.
- Visible `:focus-visible` rings on cells, icon buttons, steppers, inputs, and
  text buttons.
- Full keyboard play with a single board tab stop.
- Reduced-motion support.
- The dialog is a native modal with focus trapping and Escape handling.
- The board `role="group"` is labelled with its size; each screen is labelled
  by its heading.
- Score cards keep an accessible name from the player's custom name.
- Screen changes move focus deliberately: **New game**/**Resume** lands on the
  board, the rules/settings/about screens land on **Back**, and returning home
  lands on **Resume** when it is shown, otherwise **New game**.

Not yet covered: a dedicated high-contrast theme and TalkBack-specific testing
on a physical device (Phase 3).

---

## 10. Android shell notes (Phase 3)

- `viewport-fit=cover` and safe-area padding are already in place.
- The back button will return from Settings/How to play/About, then close the
  dialog, then ask before leaving a live match, then exit. That adapter lives in
  `src/platform/backButton.ts`.
- Preferences will replace `localStorage` behind the same `KeyValueStore`
  interface, so the UI code does not change. Save version 2 and settings
  version 1 are the payloads to migrate.
- Haptics will use `@capacitor/haptics` behind the existing `Haptics`
  interface.
- Sound uses the Web Audio API today; native audio can replace it behind the
  existing `Sound` interface if background behaviour requires it.
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
