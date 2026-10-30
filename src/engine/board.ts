import type {
  Board,
  Cell,
  CellRef,
  GameState,
  Player,
} from "./types.js";

const DIRECTIONS = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
] as const;

/** Two-player convenience helper. Prefer `nextPlayer` for 1–4 players. */
export function other(player: Player): Player {
  return player === 1 ? 2 : 1;
}

export function playersOf(count: number): Player[] {
  const players: Player[] = [];
  for (let index = 1; index <= count; index += 1) {
    players.push(index as Player);
  }
  return players;
}

export function assertDimensions(rows: number, cols: number): void {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) {
    throw new RangeError(`Board must be at least 2x2, got ${rows}x${cols}`);
  }
}

export function createBoard(rows: number, cols: number): Board {
  assertDimensions(rows, cols);
  return Array.from({ length: rows }, () => Array<Cell | null>(cols).fill(null));
}

export function inBounds(board: Board, row: number, col: number): boolean {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  const rowCells = board[row];
  return rowCells !== undefined && col >= 0 && col < rowCells.length;
}

export function getCell(board: Board, row: number, col: number): Cell | null {
  const rowCells = board[row];
  if (rowCells === undefined) return null;
  return rowCells[col] ?? null;
}

export function setCell(
  board: Board,
  row: number,
  col: number,
  cell: Cell | null,
): void {
  const rowCells = board[row];
  if (rowCells === undefined) return;
  rowCells[col] = cell;
}

/**
 * A cell explodes when it reaches the number of orthogonal neighbours it has:
 * 2 in a corner, 3 on an edge, 4 in the interior.
 */
export function capacityAt(
  rows: number,
  cols: number,
  row: number,
  col: number,
): number {
  if (row < 0 || row >= rows || col < 0 || col >= cols) return 0;

  let capacity = 0;
  if (row > 0) capacity += 1;
  if (row < rows - 1) capacity += 1;
  if (col > 0) capacity += 1;
  if (col < cols - 1) capacity += 1;
  return capacity;
}

export function neighbors(
  rows: number,
  cols: number,
  row: number,
  col: number,
): CellRef[] {
  const result: CellRef[] = [];

  for (const [dRow, dCol] of DIRECTIONS) {
    const nextRow = row + dRow;
    const nextCol = col + dCol;
    if (nextRow >= 0 && nextRow < rows && nextCol >= 0 && nextCol < cols) {
      result.push({ row: nextRow, col: nextCol });
    }
  }

  return result;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) =>
    row.map((cell) => (cell === null ? null : { ...cell })),
  );
}

export function countOrbs(board: Board, player: Player): number {
  let total = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell !== null && cell.owner === player) total += cell.orbs;
    }
  }
  return total;
}

export function countCells(board: Board, player: Player): number {
  let total = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell !== null && cell.owner === player) total += 1;
    }
  }
  return total;
}

/**
 * Players still in the match. A player is alive while they own orbs; players
 * who have not taken their first turn yet are also kept alive so an opening
 * placement by Player 1 does not eliminate everyone else.
 */
export function alivePlayers(state: GameState): Player[] {
  const alive: Player[] = [];
  for (let index = 1; index <= state.playerCount; index += 1) {
    const player = index as Player;
    if (!state.hasPlayed[player] || countOrbs(state.board, player) > 0) {
      alive.push(player);
    }
  }
  return alive;
}

/** Next player in turn order, skipping players eliminated by a cascade. */
export function nextPlayer(state: GameState): Player {
  for (let step = 1; step <= state.playerCount; step += 1) {
    const player = (((state.currentPlayer - 1 + step) % state.playerCount) +
      1) as Player;
    if (!state.hasPlayed[player] || countOrbs(state.board, player) > 0) {
      return player;
    }
  }
  return state.currentPlayer;
}

export function isStable(board: Board, rows: number, cols: number): boolean {
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = getCell(board, row, col);
      if (cell !== null && cell.orbs >= capacityAt(rows, cols, row, col)) {
        return false;
      }
    }
  }
  return true;
}
