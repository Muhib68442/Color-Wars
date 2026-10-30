import type { Board, Cell, GameState, Player } from "../../src/engine/types.js";

export function cell(owner: Player, orbs: number): Cell {
  return { owner, orbs };
}

export function emptyBoard(rows: number, cols: number): Board {
  return Array.from({ length: rows }, () => Array<Cell | null>(cols).fill(null));
}

export interface StateOptions {
  currentPlayer?: Player;
  hasPlayed?: { 1?: boolean; 2?: boolean };
  gameOver?: boolean;
}

export function makeState(board: Board, options: StateOptions = {}): GameState {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;

  return {
    rows,
    cols,
    board,
    currentPlayer: options.currentPlayer ?? 1,
    hasPlayed: {
      1: options.hasPlayed?.[1] ?? true,
      2: options.hasPlayed?.[2] ?? true,
    },
    gameOver: options.gameOver ?? false,
    winner: null,
    moveCount: 0,
    cascadeLimitReached: false,
  };
}
