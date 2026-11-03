import {
  BOT_NAME,
  countCells,
  countOrbs,
  type GameState,
  type Player,
} from "../engine/index.js";
import type { PlayerProfile, Theme } from "../platform/settings.js";
import { softenColor } from "../platform/settings.js";
import type { ScoreCard } from "./shell.js";

const PLAYERS: Player[] = [1, 2, 3, 4];

export interface HudRefs {
  status: HTMLElement;
  scores: Record<Player, ScoreCard>;
  getProfiles: () => Record<Player, PlayerProfile>;
  getBotPlayer: () => Player | null;
  getTheme: () => Theme;
}

export interface Hud {
  render(state: GameState): void;
}

function displayName(
  profiles: Record<Player, PlayerProfile>,
  player: Player,
  botPlayer: Player | null,
): string {
  if (player === botPlayer) return BOT_NAME;
  return profiles[player].name.trim() || `Player ${player}`;
}

export function createHud(refs: HudRefs): Hud {
  return {
    render(state) {
      const profiles = refs.getProfiles();
      const botPlayer = refs.getBotPlayer();
      const dark = refs.getTheme() === "dark";
      const active = state.gameOver ? null : state.currentPlayer;

      for (const player of PLAYERS) {
        const score = refs.scores[player];
        const visible = player <= state.playerCount;
        const playerName = displayName(profiles, player, botPlayer);

        score.root.hidden = !visible;
        score.root.setAttribute("aria-label", `${playerName} score`);
        score.name.textContent = playerName;
        score.cells.textContent = String(countCells(state.board, player));
        score.orbs.textContent = String(countOrbs(state.board, player));
        score.root.style.setProperty("--pc", profiles[player].color);
        score.root.style.setProperty(
          "--pc-soft",
          softenColor(
            profiles[player].color,
            dark ? 0.82 : 0.84,
            dark ? 32 : 255,
            dark ? "#1f232c" : "#f3f3f6",
          ),
        );
        score.root.classList.toggle("is-active", active === player);
        score.root.dataset.active = active === player ? "true" : "false";
      }

      if (state.gameOver) {
        refs.status.textContent =
          state.winner === null
            ? "It's a draw."
            : `${displayName(profiles, state.winner, botPlayer)} wins!`;
        refs.status.dataset.player =
          state.winner === null ? "" : String(state.winner);
        refs.status.classList.add("is-over");
        return;
      }

      const name = displayName(profiles, state.currentPlayer, botPlayer);
      if (state.currentPlayer === botPlayer) {
        refs.status.textContent = `${name} is thinking…`;
      } else {
        refs.status.textContent =
          state.playerCount === 1
            ? `${name} · solo practice`
            : `${name} to move`;
      }
      refs.status.dataset.player = String(state.currentPlayer);
      refs.status.classList.remove("is-over");
    },
  };
}
