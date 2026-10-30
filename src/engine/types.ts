export type Player = 1 | 2;

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
