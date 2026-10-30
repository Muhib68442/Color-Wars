import type { Player } from "../engine/index.js";
import { requireElement } from "./query.js";

export interface ScoreCard {
  root: HTMLElement;
  cells: HTMLElement;
  orbs: HTMLElement;
}

export interface Shell {
  restartButton: HTMLButtonElement;
  status: HTMLElement;
  hint: HTMLElement;
  board: HTMLElement;
  scores: Record<Player, ScoreCard>;
  overlay: HTMLDialogElement;
}

const SHELL_TEMPLATE = /* html */ `
  <header class="navbar">
    <div class="brand">
      <h1 class="brand__title">Color Wars</h1>
      <p class="brand__tag">Two players, one device</p>
    </div>
    <button class="btn btn--ghost" type="button" data-action="restart">
      New game
    </button>
  </header>

  <section class="hud" aria-label="Game status">
    <p class="turn" role="status" aria-live="polite" data-role="status"></p>
  </section>

  <article class="score score--bar" data-player="2" aria-label="Player 2 score">
    <h2 class="score__name">Player 2</h2>
    <p class="score__stats">
      <span><b data-role="cells">0</b> cells</span>
      <span><b data-role="orbs">0</b> orbs</span>
    </p>
  </article>

  <main class="stage">
    <div
      class="board"
      data-role="board"
      role="group"
      aria-label="Board, 7 by 7"
    ></div>
  </main>

  <article class="score score--bar" data-player="1" aria-label="Player 1 score">
    <h2 class="score__name">Player 1</h2>
    <p class="score__stats">
      <span><b data-role="cells">0</b> cells</span>
      <span><b data-role="orbs">0</b> orbs</span>
    </p>
  </article>

  <p class="hint" data-role="hint">
    Tap an empty cell or one of your own. Corners pop at 2 orbs, edges at 3,
    the middle at 4.
  </p>

  <dialog
    class="overlay"
    data-role="overlay"
    aria-labelledby="overlay-title"
  >
    <div class="overlay__card">
      <p class="overlay__eyebrow" data-role="overlay-eyebrow"></p>
      <h2 class="overlay__title" id="overlay-title" data-role="overlay-title"></h2>
      <p class="overlay__body" data-role="overlay-body"></p>
      <div class="overlay__actions" data-role="overlay-actions"></div>
    </div>
  </dialog>
`;

function scoreCard(root: HTMLElement, player: Player): ScoreCard {
  const card = requireElement<HTMLElement>(root, `.score[data-player="${player}"]`);
  return {
    root: card,
    cells: requireElement<HTMLElement>(card, "[data-role='cells']"),
    orbs: requireElement<HTMLElement>(card, "[data-role='orbs']"),
  };
}

export function mountShell(root: HTMLElement): Shell {
  root.classList.add("app");
  root.innerHTML = SHELL_TEMPLATE;

  return {
    restartButton: requireElement<HTMLButtonElement>(
      root,
      "[data-action='restart']",
    ),
    status: requireElement<HTMLElement>(root, "[data-role='status']"),
    hint: requireElement<HTMLElement>(root, "[data-role='hint']"),
    board: requireElement<HTMLElement>(root, "[data-role='board']"),
    scores: { 1: scoreCard(root, 1), 2: scoreCard(root, 2) },
    overlay: requireElement<HTMLDialogElement>(root, "[data-role='overlay']"),
  };
}
