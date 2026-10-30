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

const PLAY_HINT =
  "Tap an empty cell or one of your own. Corners pop at 2 orbs, edges at 3, the middle at 4.";
const OVER_HINT = "Game over. Start a new game to play again.";

export interface AppOptions {
  storage: StorageAdapter;
  haptics?: Haptics;
}

export interface App {
  getState(): GameState;
  selectCell(ref: CellRef): boolean;
  newGame(): void;
  requestNewGame(): void;
  persist(): void;
}

export function createApp(root: HTMLElement, options: AppOptions): App {
  const shell = mountShell(root);
  const { storage, haptics } = options;

  let state = storage.load() ?? createGame();

  const board = createBoardView(shell.board, (ref) => {
    selectCell(ref);
  });

  const hud = createHud({ status: shell.status, scores: shell.scores });

  const overlay = createOverlay(shell.overlay, () => {
    board.focusDefault();
  });

  function render(): void {
    board.render(state);
    hud.render(state);
    shell.hint.textContent = state.gameOver ? OVER_HINT : PLAY_HINT;
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
        { label: "Play again", variant: "primary", run: newGame },
        {
          label: "View board",
          variant: "secondary",
          run: () => overlay.close(),
        },
      ],
    });
  }

  function selectCell(ref: CellRef): boolean {
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
    board.focusDefault();
  }

  function requestNewGame(): void {
    if (state.moveCount === 0 || state.gameOver) {
      newGame();
      return;
    }

    overlay.open({
      eyebrow: "New game",
      title: "Start over?",
      body: "The current game will be lost.",
      actions: [
        { label: "Start over", variant: "primary", run: newGame },
        {
          label: "Keep playing",
          variant: "secondary",
          run: () => overlay.close(),
        },
      ],
    });
  }

  shell.restartButton.addEventListener("click", requestNewGame);

  render();
  if (state.gameOver) showResult();

  return {
    getState: () => state,
    selectCell,
    newGame,
    requestNewGame,
    persist: () => storage.save(state),
  };
}
