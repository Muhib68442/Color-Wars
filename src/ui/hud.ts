import {
  countCells,
  countOrbs,
  type GameState,
  type Player,
} from "../engine/index.js";
import type { ScoreCard } from "./shell.js";

const PLAYERS: Player[] = [1, 2];

export interface HudRefs {
  status: HTMLElement;
  scores: Record<Player, ScoreCard>;
}

export interface Hud {
  render(state: GameState): void;
}

export function createHud(refs: HudRefs): Hud {
  return {
    render(state) {
      const active = state.gameOver ? null : state.currentPlayer;

      for (const player of PLAYERS) {
        const score = refs.scores[player];
        score.cells.textContent = String(countCells(state.board, player));
        score.orbs.textContent = String(countOrbs(state.board, player));
        score.root.classList.toggle("is-active", active === player);
        score.root.dataset.active = active === player ? "true" : "false";
      }

      if (state.gameOver) {
        refs.status.textContent =
          state.winner === null
            ? "It's a draw."
            : `Player ${state.winner} wins!`;
        refs.status.dataset.player =
          state.winner === null ? "" : String(state.winner);
        refs.status.classList.add("is-over");
      } else {
        refs.status.textContent = `Player ${state.currentPlayer} to move`;
        refs.status.dataset.player = String(state.currentPlayer);
        refs.status.classList.remove("is-over");
      }
    },
  };
}
