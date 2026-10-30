import {
  applyMove,
  createGame,
  type CellRef,
  type GameState,
} from "../engine/index.js";
import type { Haptics } from "../platform/haptics.js";
import type { StorageAdapter } from "../platform/storage.js";
import { playEvents } from "./animations.js";
import { createBoardView } from "./boardView.js";
import { createHud } from "./hud.js";
import { createOverlay } from "./overlay.js";
import { mountShell } from "./shell.js";

export type ScreenName = "home" | "game" | "info";

export interface AppOptions {
  storage: StorageAdapter;
  haptics?: Haptics;
}

export interface App {
  getState(): GameState;
  getScreen(): ScreenName;
  selectCell(ref: CellRef): boolean;
  newGame(): void;
  requestNewGame(): void;
  persist(): void;
}

export function createApp(root: HTMLElement, options: AppOptions): App {
  const shell = mountShell(root);
  const { storage, haptics } = options;

  let state = storage.load() ?? createGame();
  let screen: ScreenName = "home";
  let infoReturn: "home" | "game" = "home";

  const board = createBoardView(shell.board, (ref) => {
    selectCell(ref);
  });

  const hud = createHud({ status: shell.status, scores: shell.scores });

  const overlay = createOverlay(shell.overlay, () => {
    if (screen === "game") board.focusDefault();
  });

  function render(): void {
    board.render(state);
    hud.render(state);
    updateHome();
  }

  function updateHome(): void {
    const resumable = state.moveCount > 0 && !state.gameOver;

    shell.playButton.textContent = state.gameOver
      ? "Play again"
      : resumable
        ? "Continue"
        : "Play";
    shell.newGameButton.hidden = !resumable;

    if (state.gameOver) {
      shell.saveNote.hidden = false;
      shell.saveNote.textContent =
        state.winner === null
          ? "Last game ended in a draw."
          : `Last game: Player ${state.winner} won.`;
    } else if (resumable) {
      shell.saveNote.hidden = false;
      shell.saveNote.textContent = `Saved game · Player ${state.currentPlayer} to move`;
    } else {
      shell.saveNote.hidden = true;
      shell.saveNote.textContent = "";
    }
  }

  function showScreen(next: ScreenName): void {
    screen = next;
    shell.home.hidden = next !== "home";
    shell.game.hidden = next !== "game";
    shell.info.hidden = next !== "info";

    if (next === "home") {
      shell.playButton.focus();
    } else if (next === "info") {
      shell.infoBack.focus();
    } else {
      board.focusDefault();
    }
  }

  function showResult(): void {
    const { winner } = state;

    overlay.open({
      eyebrow: "Game over",
      title: winner === null ? "It's a draw" : `Player ${winner} wins`,
      body:
        winner === null
          ? "The cascade hit its safety limit, so the game ends level."
          : `Player ${winner} controls every orb left on the board.`,
      actions: [
        {
          label: "Play again",
          variant: "primary",
          run: () => {
            newGame();
            showScreen("game");
          },
        },
        {
          label: "Back to home",
          variant: "secondary",
          run: () => {
            overlay.close();
            showScreen("home");
          },
        },
      ],
    });
  }

  function selectCell(ref: CellRef): boolean {
    if (screen !== "game" || overlay.isOpen()) return false;

    const result = applyMove(state, ref);

    if (!result.accepted) {
      haptics?.reject();
      return false;
    }

    state = result.state;
    render();
    playEvents(result.events, board);
    haptics?.tap();
    storage.save(state);

    if (state.gameOver) showResult();
    return true;
  }

  function newGame(): void {
    overlay.close();
    state = createGame();
    storage.clear();
    render();
  }

  function startMatch(): void {
    if (state.gameOver) newGame();
    showScreen("game");
  }

  function requestNewGame(): void {
    if (state.moveCount === 0 || state.gameOver) {
      newGame();
      showScreen("game");
      return;
    }

    overlay.open({
      eyebrow: "New game",
      title: "Start over?",
      body: "The current game will be lost.",
      actions: [
        {
          label: "Start over",
          variant: "primary",
          run: () => {
            newGame();
            showScreen("game");
          },
        },
        {
          label: "Keep playing",
          variant: "secondary",
          run: () => overlay.close(),
        },
      ],
    });
  }

  function openMenu(): void {
    overlay.open({
      eyebrow: "Game menu",
      title: "Paused",
      body: state.gameOver
        ? "The game is over. Start a new one or return home."
        : `Player ${state.currentPlayer} to move.`,
      actions: [
        {
          label: "How to play",
          variant: "primary",
          run: () => {
            overlay.close();
            infoReturn = "game";
            showScreen("info");
          },
        },
        {
          label: "Restart match",
          run: () => {
            overlay.close();
            requestNewGame();
          },
        },
        {
          label: "Back to home",
          run: () => {
            overlay.close();
            showScreen("home");
          },
        },
        {
          label: "Keep playing",
          run: () => overlay.close(),
        },
      ],
    });
  }

  shell.playButton.addEventListener("click", startMatch);

  shell.newGameButton.addEventListener("click", () => {
    newGame();
    showScreen("game");
  });

  shell.howToButton.addEventListener("click", () => {
    infoReturn = "home";
    showScreen("info");
  });

  shell.menuButton.addEventListener("click", openMenu);

  shell.infoBack.addEventListener("click", () => {
    showScreen(infoReturn);
  });

  render();
  showScreen("home");

  return {
    getState: () => state,
    getScreen: () => screen,
    selectCell,
    newGame,
    requestNewGame,
    persist: () => storage.save(state),
  };
}
