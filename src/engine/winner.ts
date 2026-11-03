import { alivePlayers } from "./board.js";
import type { GameState, Player } from "./types.js";

const PLAYERS: Player[] = [1, 2, 3, 4];

export interface WinnerVerdict {
  gameOver: boolean;
  winner: Player | null;
}

/**
 * A player is eliminated when they own no orbs after all cascades settle.
 * The `hasPlayed` guard prevents unplayed players from "losing" before their
 * first move, when the board legitimately contains only earlier players' orbs.
 *
 * Solo mode is a practice board: it has no opponent and never ends.
 */
export function evaluateWinner(state: GameState): WinnerVerdict {
  if (state.playerCount === 1) {
    return { gameOver: false, winner: null };
  }

  for (let index = 1; index <= state.playerCount; index += 1) {
    const player = index as Player;
    if (!state.hasPlayed[player]) return { gameOver: false, winner: null };
  }

  const alive = alivePlayers(state);

  if (alive.length === 0) return { gameOver: true, winner: null };
  if (alive.length === 1) return { gameOver: true, winner: alive[0] ?? null };
  return { gameOver: false, winner: null };
}

/**
 * The cascade cap is a safety stop, not a real rule of the game. When it trips
 * the board is still unstable, so there is no elimination result to use.
 * Instead of forcing a draw, award the match to the strongest position: most
 * orbs, then most cells. An exact tie stays a draw, and solo practice has no
 * opponent to beat.
 */
export function evaluateCascadeLimit(state: GameState): Player | null {
  if (state.playerCount === 1) return null;

  const orbs = new Map<Player, number>(PLAYERS.map((player) => [player, 0]));
  const cells = new Map<Player, number>(PLAYERS.map((player) => [player, 0]));

  for (const row of state.board) {
    for (const entry of row) {
      if (entry === null) continue;
      orbs.set(entry.owner, (orbs.get(entry.owner) ?? 0) + entry.orbs);
      cells.set(entry.owner, (cells.get(entry.owner) ?? 0) + 1);
    }
  }

  const contenders: Player[] = [];
  let bestOrbs = -1;
  for (let index = 1; index <= state.playerCount; index += 1) {
    const player = index as Player;
    const value = orbs.get(player) ?? 0;
    if (value > bestOrbs) {
      bestOrbs = value;
      contenders.length = 0;
      contenders.push(player);
    } else if (value === bestOrbs) {
      contenders.push(player);
    }
  }

  if (contenders.length === 1) return contenders[0] ?? null;

  let bestCells = -1;
  let cellContenders: Player[] = [];
  for (const player of contenders) {
    const value = cells.get(player) ?? 0;
    if (value > bestCells) {
      bestCells = value;
      cellContenders = [player];
    } else if (value === bestCells) {
      cellContenders.push(player);
    }
  }

  return cellContenders.length === 1 ? (cellContenders[0] ?? null) : null;
}
