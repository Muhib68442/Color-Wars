import type { Player } from "../engine/index.js";
import { requireElement } from "./query.js";

export interface ScoreCard {
  root: HTMLElement;
  cells: HTMLElement;
  orbs: HTMLElement;
}

export interface Shell {
  root: HTMLElement;
  home: HTMLElement;
  game: HTMLElement;
  info: HTMLElement;
  status: HTMLElement;
  board: HTMLElement;
  playButton: HTMLButtonElement;
  newGameButton: HTMLButtonElement;
  howToButton: HTMLButtonElement;
  saveNote: HTMLElement;
  menuButton: HTMLButtonElement;
  infoBack: HTMLButtonElement;
  scores: Record<Player, ScoreCard>;
  overlay: HTMLDialogElement;
}

const LOGO = /* html */ `
  <svg class="logo" viewBox="0 0 120 120" role="img" aria-label="Color Wars">
    <rect x="6" y="6" width="108" height="108" rx="24" fill="#ffffff"
      stroke="#cfd0d6" stroke-width="3" />
    <circle cx="40" cy="40" r="11" fill="#6e6eff" />
    <circle cx="80" cy="40" r="11" fill="#ffffff" stroke="#3a0b0b" stroke-width="5" />
    <circle cx="40" cy="80" r="11" fill="#6e6eff" />
    <circle cx="80" cy="80" r="11" fill="#ffffff" stroke="#3a0b0b" stroke-width="5" />
    <circle cx="60" cy="60" r="7" fill="#14161a" opacity="0.25" />
  </svg>
`;

const MENU_ICON = /* html */ `
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
`;

const BACK_ICON = /* html */ `
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round">
    <path d="M15 5l-7 7 7 7" />
  </svg>
`;

const SHELL_TEMPLATE = /* html */ `
  <section class="screen screen--home" data-role="home" aria-labelledby="home-title">
    <div class="home__logo">${LOGO}</div>
    <h1 class="home__title" id="home-title">Color Wars</h1>
    <p class="home__desc">
      A two-player chain reaction game. Place orbs, set off explosions, and
      capture the whole board.
    </p>
    <div class="home__actions">
      <button class="btn btn--primary btn--large" type="button" data-action="play">
        Play
      </button>
      <button class="btn btn--secondary" type="button" data-action="new-game" hidden>
        New game
      </button>
      <button class="btn btn--quiet" type="button" data-action="how-to">
        How to play
      </button>
    </div>
    <p class="home__note" data-role="save-note" hidden></p>
  </section>

  <section class="screen screen--game" data-role="game" hidden aria-label="Match">
    <header class="gamebar">
      <button class="iconbtn" type="button" data-action="menu" aria-label="Game menu">
        ${MENU_ICON}
      </button>
      <p class="turn" role="status" aria-live="polite" data-role="status"></p>
      <span class="gamebar__spacer" aria-hidden="true"></span>
    </header>

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
  </section>

  <section class="screen screen--info" data-role="info" hidden aria-labelledby="info-title">
    <header class="infobar">
      <button class="iconbtn" type="button" data-action="info-back" aria-label="Back">
        ${BACK_ICON}
      </button>
      <h2 class="infobar__title" id="info-title">How to play</h2>
      <span class="gamebar__spacer" aria-hidden="true"></span>
    </header>

    <div class="info">
      <p class="info__lead">
        Color Wars is a hot-seat game for two players sharing one device.
        Player 2 plays from the top panel, Player 1 from the bottom panel.
      </p>

      <h3>Goal</h3>
      <p>
        Capture every orb on the board. A player with no orbs left after a
        cascade loses.
      </p>

      <h3>On your turn</h3>
      <ul>
        <li>Place a new orb on any empty cell, or</li>
        <li>add one orb to a cell you already own.</li>
      </ul>
      <p>Turns then alternate.</p>

      <h3>Explosions</h3>
      <p>
        A cell explodes when it reaches its capacity: 2 orbs in a corner,
        3 on an edge, 4 in the middle.
      </p>
      <ul>
        <li>An exploding cell clears itself.</li>
        <li>It sends one orb to each orthogonal neighbour.</li>
        <li>Enemy orbs in those neighbours are captured.</li>
        <li>Neighbours that reach capacity explode too: a cascade.</li>
      </ul>

      <h3>Winning</h3>
      <p>
        After a cascade settles, a player with no orbs left loses. If both
        players still own orbs, play continues.
      </p>

      <h3>Controls</h3>
      <ul>
        <li>Tap or click a legal cell to place an orb.</li>
        <li>
          Keyboard: Tab into the board, move with the arrow keys or Home/End,
          and press Enter or Space to place.
        </li>
        <li>Use the menu button for How to play, Restart, or Home.</li>
      </ul>

      <h3>Tip</h3>
      <p>
        Corners only need 2 orbs to pop, so they are easy to flip, while edge
        and middle cells hold more and fire in more directions.
      </p>
    </div>
  </section>

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
    root,
    home: requireElement<HTMLElement>(root, "[data-role='home']"),
    game: requireElement<HTMLElement>(root, "[data-role='game']"),
    info: requireElement<HTMLElement>(root, "[data-role='info']"),
    status: requireElement<HTMLElement>(root, "[data-role='status']"),
    board: requireElement<HTMLElement>(root, "[data-role='board']"),
    playButton: requireElement<HTMLButtonElement>(root, "[data-action='play']"),
    newGameButton: requireElement<HTMLButtonElement>(
      root,
      "[data-action='new-game']",
    ),
    howToButton: requireElement<HTMLButtonElement>(
      root,
      "[data-action='how-to']",
    ),
    saveNote: requireElement<HTMLElement>(root, "[data-role='save-note']"),
    menuButton: requireElement<HTMLButtonElement>(root, "[data-action='menu']"),
    infoBack: requireElement<HTMLButtonElement>(
      root,
      "[data-action='info-back']",
    ),
    scores: { 1: scoreCard(root, 1), 2: scoreCard(root, 2) },
    overlay: requireElement<HTMLDialogElement>(root, "[data-role='overlay']"),
  };
}
