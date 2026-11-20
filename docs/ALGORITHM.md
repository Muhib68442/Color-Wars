# Game Algorithm

This document explains the Color Wars rule system, the state it operates on,
and the cascade algorithm. §1–§7 describe the **current** rules, TypeScript
engine, and Bot. §8–§9 are a historical record of the legacy implementations
and their defects, kept so they are not reintroduced.

---

## 1. The game in one paragraph

One to four players take turns on a rectangular grid with 7–15 rows and 7–15
columns (for example 11×7). A turn is
either placing a new orb on an empty cell or adding an orb to a cell you already
own. Every cell has a **capacity** equal to its number of orthogonal neighbours
(2 in a corner, 3 on an edge, 4 in the interior). When a cell reaches its
capacity it **explodes**: all orbs in it are removed and one orb is sent to each
orthogonal neighbour, converting any enemy orb it lands on. Explosions can
chain. After the cascade settles, any player with no orbs left is eliminated;
the last player with orbs wins. A one-player game is a practice board that never
ends.

---

## 2. State

```
Board        = ROWS × COLS matrix, each cell is:
                 Empty                      → no orbs
                 { owner: 1..4, orbs: n }   → n orbs owned by a player

playerCount   : 1 | 2 | 3 | 4
currentPlayer : 1 | 2 | 3 | 4
hasPlayed     : { 1..4: bool }   // opening-move bookkeeping
botPlayer     : 1..4 | null      // seat driven by the AI, never player 1
growOnly      : bool             // restrict later moves to cells you own
gameOver      : bool
winner        : 1..4 | null
moveCount     : int
```

Invariants:

- An occupied cell always has `1 ≤ orbs < capacity(cell)` **when the board is
  stable** (i.e. between turns, after all cascades).
- A cell at or above capacity is unstable and must be resolved before the next
  turn is considered.
- `owner` is a single value per cell; a cell never mixes player orbs.
- `owner` and `currentPlayer` are always within `1 … playerCount`.
- `botPlayer` is `null` for a hot-seat match. When set, it is the
  highest-numbered seat at the table (`2 … playerCount`); player 1 is always
  human, and a solo board has no Bot.
- `growOnly` is a per-match rule copied from the Settings switch. It can change
  mid-match; the current board is never rewritten.

Capacity by position (for any rectangular board):

```
capacity(r, c) = (r > 0) + (r < ROWS-1) + (c > 0) + (c < COLS-1)
```

For 7×7:

```
2 3 3 3 3 3 2
3 4 4 4 4 4 3
3 4 4 4 4 4 3
3 4 4 4 4 4 3
3 4 4 4 4 4 3
3 4 4 4 4 4 3
2 3 3 3 3 3 2
```

The production UI creates boards with 7–15 rows and 7–15 columns independently
(77–225 cells), such as 11×7 or 15×15. The engine's capacity and neighbour
helpers work for any rectangle of at least 2×2.

---

## 3. Turn algorithm

```
function playTurn(state, cell):
    if state.gameOver:
        return

    cellState = state.board[cell]

    if cellState is not Empty and cellState.owner != state.currentPlayer:
        return                                  // cannot play on an enemy cell

    if state.growOnly and state.hasPlayed[currentPlayer]:
        if not ownsAnyCellOf(state, currentPlayer):
            if cellState is not Empty: return   // re-entry: one free empty cell
        else if cellState is Empty or cellState.owner != currentPlayer:
            return                              // grow only on your own cells

    if cellState is Empty:
        state.board[cell] = { owner: currentPlayer, orbs: 1 }
    else:
        cellState.orbs += 1                      // adds to your own cell

    state.hasPlayed[currentPlayer] = true
    resolveCascades(state, cell)                 // may empty many cells

    if not gameOver:
        state.currentPlayer = nextPlayer(state)  // skips eliminated players
    state.gameOver, state.winner = checkWinner(state)
```

`nextPlayer` walks forward in player order (`1 → 2 → … → playerCount → 1`) and
returns the first player who has either not moved yet or still owns orbs. That
keeps a newly eliminated player from being handed a turn mid-cascade.

Notes:

- With `growOnly = false` (classic mode), placing on any empty cell is always
  legal; that is how players claim new territory.
- With `growOnly = true` (the app default), only the first move is free. Later
  moves must add an orb to a cell the player already owns, so each player grows
  outward from their starting cell. A player with no cells left gets one free
  placement to re-enter. The Bot uses the same `legalMoves` list, so it obeys the
  active rule automatically.
- Adding to your own cell is always legal, including on the opening move.
- The turn only advances after a legal move.
- With `playerCount === 1` the same player keeps the turn forever; see §5.

---

## 4. Cascade algorithm

The cascade must resolve **all** unstable cells, including cells pushed over
capacity by another explosion. A queue avoids recursion depth issues and makes
the order deterministic.

```
function resolveCascades(state, start):
    queue = [start]

    while queue is not empty:
        cell = queue.popFront()
        data = state.board[cell]

        if data is Empty or data.orbs < capacity(cell):
            continue                             // already settled

        // Detonate
        owner          = data.owner
        state.board[cell] = Empty                // source cell is cleared
        emit Explode(cell, owner)

        for each neighbour n of cell (up, down, left, right):
            if n is outside the board:
                continue

            if state.board[n] is Empty:
                state.board[n] = { owner: owner, orbs: 1 }
            else:
                capturedFrom = state.board[n].owner   // null if same owner
                state.board[n].owner = owner      // capture, even if enemy
                state.board[n].orbs += 1

            emit Transfer(cell → n, owner, capturedFrom)

            if state.board[n].orbs >= capacity(n):
                queue.push(n)                     // may detonate later
```

Why a queue instead of recursion:

- A cell can be pushed more than once; the `orbs < capacity` guard makes extra
  entries harmless.
- Deterministic breadth-first order means both renderers can animate the same
  sequence of events.
- No risk of stack overflow on long chains.

Termination: each detonation clears one cell and adds 4 orbs at most, but the
total number of orbs in a cascade is finite and the guard prevents re-processing
settled cells. Cascades always terminate, though a single move can produce a
long chain.

---

## 5. Win detection

The winner is determined **after the cascade settles**, not right after the
click. In the TypeScript engine this is `evaluateWinner(state)`:

```
function checkWinner(state):
    if state.playerCount == 1:
        return (false, null)                 // solo practice never ends

    for player in 1..playerCount:
        if not state.hasPlayed[player]:
            return (false, null)             // everyone gets a first turn

    alive = [player for player in 1..playerCount
             if state.hasPlayed[player] and countOrbs(state.board, player) > 0]

    if alive.length == 0: return (true, null)   // degenerate draw
    if alive.length == 1: return (true, alive[0])
    return (false, null)
```

`alivePlayers` uses the same rule: a player who has not moved yet is treated as
alive even with zero orbs, so Player 1's opening placement does not instantly
eliminate Players 2–4.

Checking after the cascade matters because players can be eliminated by a chain
reaction triggered by someone else's move — including two players in a single
cascade.

A `cascade-limit` safety stop ends the match because the board is still
unstable and cannot continue. It is never saved. Rather than forcing a draw
while one side dominates, the capped result goes to the strongest position:
most orbs, then most cells. If both are tied the match is a draw, and solo
practice has no opponent to beat. In the TypeScript engine this is
`evaluateCascadeLimit(state)`.

Solo mode (`playerCount === 1`) returns no verdict at all, so the board never
locks and the player can keep experimenting indefinitely.

---

## 6. Bot opponent

The Bot is a pure move chooser in `src/engine/bot.ts`; it never mutates the
game state. `chooseBotMove(state, { difficulty, random? })` returns a legal
`CellRef` or `null`, and the UI applies it through the normal `applyMove`
pipeline after a short thinking pause. The Bot is always displayed as **Bot**
and its name cannot be changed.

All three difficulties use the same legal-move generator, so the Bot can never
play an illegal move and therefore never needs special-case rules:

- **Easy** — pick a uniformly random legal move.
- **Medium** — apply every legal move on a clone and take the highest static
  evaluation.
- **Hard** — rank the same moves, then search the strongest rival reply before
  choosing, so it takes captures and avoids handing over a winning detonation.

### 6.1 Static evaluation

For the Bot's seat `me`, one board pass scores every occupied cell:

```
progress      = orbs / capacity
value(cell)   = orbs × 1.8
              + 0.25                                  // presence
              + max(0, orbs − 1) × 1.1                // stacking
              + progress² × 1.6                       // near detonation
              + (armed ? 1.4 × progress : 0)
              + Σ adjacent rival cells:
                  0.9 × (1.6 + rival orbs × 1.2)      // only when armed
```

`value(player)` is the sum of that player's cells. A huge stack therefore scores
far above a scattering of one-orb cells, which is what makes the Bot reinforce
its own cells instead of claiming every empty square. The progress and armed
terms make a cell one placement from detonating valuable, and the adjacency
bonus makes an armed cell next to rival orbs a takeover threat rather than just
a defensive liability.

The final score compares the Bot with the field:

```
score = value(me) − 0.7 × max(value(rivals)) − 0.3 × average(value(rivals))
```

The strongest rival dominates the penalty, while the average keeps the Bot
aware of the rest of a three- or four-player table.

A finished game short-circuits the evaluation: a win for `me` is
`+1_000_000`, a draw `0`, and a loss `−1_000_000`, so any immediate win outranks
every positional consideration.

### 6.2 Easy

```text
moves = legalMoves(state)
return moves[floor(random() × length)]
```

Easy is deliberately unstructured: it still makes a legal move, but it does not
defend, build territory, or take a win unless the random choice happens to land
on one.

### 6.3 Medium

```text
best = null
for move in legalMoves(state):
    next = applyMove(state, move)
    score = evaluate(next, me)
    keep the move with the highest score
return one of the tied best moves
```

This is a 1-ply greedy search. It takes an immediate win when one exists and
prefers captures, material, and armed cells, but it cannot see the opponent's
reply.

### 6.4 Hard

Hard first looks for an immediate win and returns it without searching. It then
keeps the twelve strongest root moves and runs a bounded minimax search two
plies deep:

```text
for candidate in bestTwelve(rankMoves(state, me)):
    value = search(candidate.state, me, depth = 1, beam = 8)
    keep the candidate with the highest value

search(state, me, depth, beam):
    if state.gameOver or depth == 0: return evaluate(state, me)
    ranked = rankMoves(state, state.currentPlayer)   // moves for whoever is up
    branch = bestEight(ranked)
    if state.currentPlayer == me: return max(values)
    return min(values)
```

The Bot maximises and every rival minimises, so `value` is the worst score the
Bot can be left with after the opponent's strongest reply. Moves that capture,
build a real threat, or defuse a rival stack survive the root cut; a move that
lets the opponent detonate is rejected even if it scores well statically.

The search is deliberately narrow rather than exhaustive: 12 root candidates ×
8 replies keeps a populated 15×15 position around 150 ms in the test suite. It
sees immediate captures and one-move threats but does not build multi-move
plans. Ties in every difficulty are broken with the injectable `random`
function, which keeps tests deterministic.

### 6.5 Turn ownership in the UI

`GameState.botPlayer` is persisted with the save, so resuming a match restores
the AI seat exactly. When it is the Bot's turn the board ignores input and
removes its tab stop; after `BOT_THINK_MS` (600 ms) the controller applies the
chosen move, saves it, and replays the cascade events one explosion at a time.
The next turn (or the next Bot move) is only scheduled after that replay
finishes. Returning from a dialog uses a shorter `BOT_RESUME_MS` (350 ms) delay.

---

## 7. Complexity

Let `N = ROWS × COLS` (49–225 in the product) and `E` be the number of
explosion events in a cascade.

| Operation | 2D array board | Sparse coin list (`legacy/main.py`) |
| --- | --- | --- |
| Read a cell | O(1) | O(n) linear scan |
| One detonation | O(4) | O(4n) |
| Whole cascade | O(N + E) | O(E·n) |
| Winner check | O(N) | O(n) |

The sparse list is acceptable for 49 cells but is the reason the Python version
has a lookup-consistency bug (see §9).

---

## 8. Legacy web implementation (`script.js`, removed)

> Historical record. The current implementation is the pure TypeScript engine
> described in §1–§5; this section documents the pre-rebuild `script.js` so its
> defects are not reintroduced.

### 8.1 What it did

```
handleCellClick(cell):
    if first move for current player:
        if cell is empty: place { player, points: 1 }; clear first-move flag
    else:
        if cell is owned by current player: incrementPoints(cell)
    updateProgress(); checkGameOver(); repaint active panel
```

`incrementPoints`:

```
coin.points += 1
if coin.points >= 4:
    coin.points = 1
    spreadPoints(row, col, coin.player)
updateCell(cell, coin.player, coin.points)
```

`spreadPoints`:

```
board[row][col] = null
clear the cell's visuals
for each of the 4 directions:
    walk one step (the loop can only ever take one step, see below)
    if neighbour empty:      place { player, points: 1 }
    else:
        if neighbour.player != player: neighbour.player = player
        incrementPoints(neighbour)          // recursive cascade
    if neighbour.points < 4: break
```

### 8.2 Defects

| # | Defect | Consequence |
| --- | --- | --- |
| A | The `else` branch never allows placement on an empty cell | After each player's first move, territory can only change through explosions |
| B | `updateCell` is called after `spreadPoints` | The detonated cell is repainted with 1 orb while `board` says empty → ghost coin; score and board diverge |
| C | Threshold is hard-coded `>= 4` | Corners and edges have the wrong capacity |
| D | Cascade is recursive and mutates the board while iterating | Order-dependent results on long chains; no event stream to animate |
| E | The directional `while` loop is vestigial | `incrementPoints` resets a neighbour to 1, so `points < 4` always breaks after one step; the walk never continues |
| F | Win text/state is invisible and not latched | See `UI.md`; clicks after a win keep mutating the board |

Rules A–C meant the legacy web version **did not implement the game described in
§1–§5**; it implemented a related but different game. The TypeScript engine
replaced it in Phase 1–2.

---

## 9. Legacy desktop implementation (`legacy/main.py`)

> Historical record. The Pygame prototype is archived and is not part of the
> product.

### 9.1 What it did

- `Coin(row, col, player, points)` objects in a flat `coins` list.
- `increment_points()` adds one; if `points > 4`, it resets to 1 and **flips the
  owner** (this branch is effectively dead because `explode()` triggers at 4).
- `handle_explosions()` performs one simultaneous pass:

```
new_coins = []
for coin in coins:
    if coin.points == 4:
        for each in-bounds neighbour:
            adjacent = get_coin(neighbour)   // searches the OLD coins list
            if adjacent:
                if adjacent.player != coin.player: adjacent.player = coin.player
                adjacent.increment_points()
            else:
                new_coins.append(Coin(neighbour, coin.player))
    else:
        new_coins.append(coin)
coins = new_coins
return whether anything exploded
```

`main()` repeats `handle_explosions()` until it returns false, redrawing between
passes.

### 9.2 Defects

| # | Defect | Consequence |
| --- | --- | --- |
| A | New coins are not visible to `get_coin()` during the pass | Two adjacent detonations both create a coin in the same empty cell → stacked duplicates |
| B | Threshold is 4 everywhere | Wrong corner/edge capacity |
| C | `increment_points` can push a coin past 4 and flip its owner | Simultaneous detonations can convert a neighbour instead of detonating it |
| D | Win check runs only on click | A cascade can eliminate a player without ending the game |
| E | No `Clock` | 100% CPU, frame-rate-dependent behaviour |
| F | The cascade render reuses the previous frame's turn text | Cascade frames show stale turn information |

---

## 10. Reference implementation (TypeScript engine)

The shipped `applyMove` follows this shape:

```
function applyMove(state, cell, options):
    if not isLegalMove(state, cell): return { state, events: [], accepted: false }

    next = cloneState(state)                    // input is never mutated
    events = []
    player = next.currentPlayer
    target = next.board[cell]

    if target == Empty:
        next.board[cell] = { owner: player, orbs: 1 }
        events.push(Place(cell, player))
    else:
        target.orbs += 1
        events.push(Add(cell, player, target.orbs))

    next.hasPlayed[player] = true
    resolveCascades(next, cell, events, options.maxCascadeSteps)

    if next.cascadeLimitReached:
        next.gameOver = true
        next.winner = evaluateCascadeLimit(next)  // orbs, then cells, else null
        events.push(Win(next.winner))
    else:
        verdict = evaluateWinner(next)
        if verdict.gameOver:
            next.gameOver = true; next.winner = verdict.winner
            events.push(Win(verdict.winner))
        else:
            next.currentPlayer = nextPlayer(next)

    next.moveCount += 1
    return { state: next, events, accepted: true }
```

Renderers then:

1. apply the move and receive `events`;
2. clone the pre-move state and group `events` into a `place`/`add` step and one
   step per explosion (`explode` + its transfers);
3. apply each group to the clone, render that intermediate `GameState`, and wait
   for its flights/landings before starting the next explosion;
4. render once more from the final model, show the turn banner, and show a win
   overlay when `state.gameOver`.

`src/ui/replay.ts` owns the event-to-board replay (`applyGameEvent`,
`groupEvents`, `replayEvents`) so the visual order matches the engine order
exactly. `src/ui/animations.ts` plays the groups; `src/ui/app.ts` locks input and
Bot scheduling until the replay completes, and cancels a stale replay when the
player leaves the match or starts a new game.

This removes the ghost-coin class of bug entirely: the DOM is always rebuilt
from a model snapshot, never patched ad hoc. If Web Animations is unavailable or
reduced motion is requested, the UI skips the intermediate steps and renders the
final state once.

The Bot reuses the same `applyMove` (on cloned states) for every candidate and
reply, so its search and the real turn can never disagree about the rules.

---

## 11. Edge cases checklist

- [ ] Corner detonation spreads to exactly 2 neighbours.
- [ ] Edge detonation spreads to exactly 3 neighbours.
- [ ] Interior detonation spreads to exactly 4 neighbours.
- [ ] Detonating into an enemy cell converts ownership and adds 1 orb.
- [ ] Detonating into a same-owner cell adds 1 orb.
- [ ] Detonating into an empty cell creates 1 orb for the detonating player.
- [ ] A neighbour pushed to capacity detonates in the same cascade.
- [ ] A cell pushed past capacity (by simultaneous detonations) detonates once
      and is cleared, not flipped or duplicated.
- [ ] A cascade that eliminates a player ends the game immediately.
- [ ] Two or three players eliminated in one cascade leave exactly one winner.
- [ ] The turn skips a player eliminated before their next turn.
- [ ] Unplayed players are not eliminated during the opening round.
- [ ] Solo mode never ends and keeps the same player on turn.
- [ ] The Bot only returns legal moves and returns `null` when none exist.
- [ ] Easy, Medium, and Hard can choose different moves from the same position.
- [ ] A saved Bot seat resumes and auto-plays on the Bot's turn.
- [ ] The Bot's display name is `Bot` even if a stale profile name exists.
- [ ] The source cell of a detonation is empty and renders empty.
- [ ] Board and rendered output always agree after the cascade.
- [ ] Illegal clicks (enemy cell, after game over) change nothing.
- [ ] A board with 7–15 rows and 7–15 columns (including 11×7) fits without
  scrolling or clipped cells.
