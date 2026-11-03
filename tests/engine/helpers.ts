import type {
  Board,
  Cell,
  GameState,
  Player,
  PlayerCount,
} from "../../src/engine/types.js";

export function cell(owner: Player, orbs: number): Cell {
  return { owner, orbs };
}

export function emptyBoard(rows: number, cols: number): Board {
  return Array.from({ length: rows }, () => Array<Cell | null>(cols).fill(null));
}

export interface StateOptions {
  currentPlayer?: Player;
  hasPlayed?: Partial<Record<Player, boolean>>;
  gameOver?: boolean;
  winner?: Player | null;
  playerCount?: PlayerCount;
  moveCount?: number;
  cascadeLimitReached?: boolean;
  botPlayer?: Player | null;
}

export function makeState(board: Board, options: StateOptions = {}): GameState {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const playerCount = options.playerCount ?? 2;

  const hasPlayed = {} as Record<Player, boolean>;
  for (let index = 1; index <= 4; index += 1) {
    const player = index as Player;
    hasPlayed[player] =
      player <= playerCount ? (options.hasPlayed?.[player] ?? true) : false;
  }

  return {
    rows,
    cols,
    playerCount,
    board,
    currentPlayer: options.currentPlayer ?? 1,
    hasPlayed,
    botPlayer: options.botPlayer ?? null,
    gameOver: options.gameOver ?? false,
    winner: options.winner ?? null,
    moveCount: options.moveCount ?? 0,
    cascadeLimitReached: options.cascadeLimitReached ?? false,
  };
}
