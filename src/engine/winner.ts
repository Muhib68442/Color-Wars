import { countOrbs } from "./board.js";
import type { GameState, Player } from "./types.js";

export interface WinnerVerdict {
  gameOver: boolean;
  winner: Player | null;
}

/**
 * A player is eliminated when they own no orbs after all cascades settle.
 * The `hasPlayed` guard prevents Player 2 from "losing" before their first
 * move, when the board legitimately contains only Player 1 orbs.
 */
export function evaluateWinner(state: GameState): WinnerVerdict {
  if (!state.hasPlayed[1] || !state.hasPlayed[2]) {
    return { gameOver: false, winner: null };
  }

  const player1Orbs = countOrbs(state.board, 1);
  const player2Orbs = countOrbs(state.board, 2);

  if (player1Orbs === 0 && player2Orbs === 0) {
    return { gameOver: true, winner: null };
  }
  if (player1Orbs === 0) {
    return { gameOver: true, winner: 2 };
  }
  if (player2Orbs === 0) {
    return { gameOver: true, winner: 1 };
  }
  return { gameOver: false, winner: null };
}
