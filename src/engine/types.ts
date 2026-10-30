export const MIN_GRID_SIZE = 7;
export const MAX_GRID_SIZE = 15;
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 4;

export type Player = 1 | 2 | 3 | 4;
export type PlayerCount = 1 | 2 | 3 | 4;

export interface Cell {
  owner: Player;
  orbs: number;
}

export type Board = Array<Array<Cell | null>>;

export interface CellRef {
  row: number;
  col: number;
}

export interface GameState {
  rows: number;
  cols: number;
  playerCount: PlayerCount;
  board: Board;
  currentPlayer: Player;
  hasPlayed: Record<Player, boolean>;
  gameOver: boolean;
  winner: Player | null;
  moveCount: number;
  cascadeLimitReached: boolean;
}

export type GameEvent =
  | { type: "place"; at: CellRef; player: Player }
  | { type: "add"; at: CellRef; player: Player; orbs: number }
  | { type: "explode"; at: CellRef; player: Player; orbs: number }
  | {
      type: "transfer";
      from: CellRef;
      to: CellRef;
      player: Player;
      captured: boolean;
      orbs: number;
    }
  | { type: "cascade-limit"; reason: "limit" }
  | { type: "win"; winner: Player | null };

export interface MoveResult {
  state: GameState;
  events: GameEvent[];
  accepted: boolean;
}
