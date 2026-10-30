import { alivePlayers } from "./board.js";
import type { GameState, Player } from "./types.js";

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
