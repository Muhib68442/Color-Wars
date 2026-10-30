# Game Algorithm

This document explains the Color Wars rule system, the state it operates on,
and the cascade algorithm. It first describes the **intended** game, then
documents what each implementation currently does and where it deviates.

---

## 1. The game in one paragraph

Two players take turns on a 7×7 grid. A turn is either placing a new orb on an
empty cell or adding an orb to a cell you already own. Every cell has a
**capacity** equal to its number of orthogonal neighbours (2 in a corner, 3 on
an edge, 4 in the interior). When a cell reaches its capacity it **explodes**:
all orbs in it are removed and one orb is sent to each orthogonal neighbour,
converting any enemy orb it lands on. Explosions can chain. After the cascade
settles, a player with no orbs left loses.

---

## 2. State

```
Board        = ROWS × COLS matrix, each cell is:
                 Empty                      → no orbs
                 { owner: 1 | 2, orbs: n }  → n orbs owned by a player

currentPlayer : 1 | 2
firstMove     : { 1: bool, 2: bool }   // opening-move bookkeeping
gameOver      : bool
winner        : 1 | 2 | null
```

Invariants:

- An occupied cell always has `1 ≤ orbs < capacity(cell)` **when the board is
  stable** (i.e. between turns, after all cascades).
- A cell at or above capacity is unstable and must be resolved before the next
  turn is considered.
- `owner` is a single value per cell; a cell never mixes player orbs.

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

---

## 3. Turn algorithm

```
function playTurn(state, cell):
    if state.gameOver:
        return

    cellState = state.board[cell]

    if cellState is not Empty and cellState.owner != state.currentPlayer:
        return                                  // cannot play on an enemy cell

    if cellState is Empty:
        state.board[cell] = { owner: currentPlayer, orbs: 1 }
    else:
        cellState.orbs += 1                      // adds to your own cell

    resolveCascades(state, cell)                 // may empty many cells
    state.currentPlayer = other(state.currentPlayer)
    state.gameOver, state.winner = checkWinner(state)
```

Notes:

- Placing on **any empty cell is always legal**, not only on the opening move.
  This is a core rule: it is how players claim new territory.
- Adding to your own cell is also always legal, including on the opening move
  (some house rules require the first orb to be placed on an empty cell; either
  is consistent as long as it is enforced).
- The turn only advances after a legal move.

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
                state.board[n].owner = owner      // capture, even if enemy
                state.board[n].orbs += 1

            emit Transfer(cell → n, owner)

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
click:

```
function checkWinner(state):
    p1 = countOrbs(state.board, 1)
    p2 = countOrbs(state.board, 2)

    if p1 == 0 and p2 == 0: return (true, null)   // degenerate, treat as draw
    if p1 == 0:             return (true, 2)
    if p2 == 0:             return (true, 1)
    return (false, null)
```

Checking after the cascade matters because a player can be eliminated by a
chain reaction triggered by the opponent's move.

The "opening move" flags are not part of the win rule. They only prevent a win
from being declared before both players have a coin on the board.

---

## 6. Complexity

Let `N = ROWS × COLS` and `E` be the number of explosion events in a cascade.

| Operation | 2D array board | Sparse coin list (`legacy/main.py`) |
| --- | --- | --- |
| Read a cell | O(1) | O(n) linear scan |
| One detonation | O(4) | O(4n) |
| Whole cascade | O(N + E) | O(E·n) |
| Winner check | O(N) | O(n) |

The sparse list is acceptable for 49 cells but is the reason the Python version
has a lookup-consistency bug (see §8).

---

## 7. Current web implementation (`script.js`)

### 7.1 What it does

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

### 7.2 Defects

| # | Defect | Consequence |
| --- | --- | --- |
| A | The `else` branch never allows placement on an empty cell | After each player's first move, territory can only change through explosions |
| B | `updateCell` is called after `spreadPoints` | The detonated cell is repainted with 1 orb while `board` says empty → ghost coin; score and board diverge |
| C | Threshold is hard-coded `>= 4` | Corners and edges have the wrong capacity |
| D | Cascade is recursive and mutates the board while iterating | Order-dependent results on long chains; no event stream to animate |
| E | The directional `while` loop is vestigial | `incrementPoints` resets a neighbour to 1, so `points < 4` always breaks after one step; the walk never continues |
| F | Win text/state is invisible and not latched | See `UI.md`; clicks after a win keep mutating the board |

Rules A–C mean the web version **does not currently implement the game
described in §1–§5**; it implements a related but different game.

---

## 8. Current desktop implementation (`legacy/main.py`)

### 8.1 What it does

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

### 8.2 Defects

| # | Defect | Consequence |
| --- | --- | --- |
| A | New coins are not visible to `get_coin()` during the pass | Two adjacent detonations both create a coin in the same empty cell → stacked duplicates |
| B | Threshold is 4 everywhere | Wrong corner/edge capacity |
| C | `increment_points` can push a coin past 4 and flip its owner | Simultaneous detonations can convert a neighbour instead of detonating it |
| D | Win check runs only on click | A cascade can eliminate a player without ending the game |
| E | No `Clock` | 100% CPU, frame-rate-dependent behaviour |
| F | The cascade render reuses the previous frame's turn text | Cascade frames show stale turn information |

---

## 9. Corrected reference implementation

A single engine usable by both clients:

```
function applyMove(state, cell):
    if state.gameOver: return []

    target = state.board[cell]
    if target != Empty and target.owner != state.currentPlayer:
        return []                                  // illegal, no events

    if target == Empty:
        state.board[cell] = { owner: state.currentPlayer, orbs: 1 }
    else:
        target.orbs += 1

    events = resolveCascades(state, cell)
    state.currentPlayer = other(state.currentPlayer)

    state.gameOver, state.winner = checkWinner(state)
    return events
```

Renderers then:

1. apply the move and receive `events`;
2. replay `Explode` / `Transfer` events as animations (or instantly);
3. redraw from the model;
4. show the turn banner, and a win overlay when `state.gameOver`.

This removes the ghost-coin class of bug entirely: the DOM or Pygame surface is
always rebuilt from the model, never patched ad hoc.

---

## 10. Edge cases checklist

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
- [ ] The source cell of a detonation is empty and renders empty.
- [ ] Board and rendered output always agree after the cascade.
- [ ] Illegal clicks (enemy cell, after game over) change nothing.
