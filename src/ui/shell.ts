import type { Player } from "../engine/index.js";
import { requireElement } from "./query.js";

export interface ScoreCard {
  root: HTMLElement;
  name: HTMLElement;
  cells: HTMLElement;
  orbs: HTMLElement;
}

export interface PlayerRowRefs {
  root: HTMLElement;
  color: HTMLInputElement;
  name: HTMLInputElement;
  label: HTMLElement;
}

export interface SettingsRefs {
  difficultyButtons: HTMLButtonElement[];
  difficultyBadge: HTMLElement;
  themeButtons: HTMLButtonElement[];
  playerCountButtons: HTMLButtonElement[];
  bot: HTMLInputElement;
  botHint: HTMLElement;
  gridRowsValue: HTMLElement;
  gridRowsMinus: HTMLButtonElement;
  gridRowsPlus: HTMLButtonElement;
  gridColsValue: HTMLElement;
  gridColsMinus: HTMLButtonElement;
  gridColsPlus: HTMLButtonElement;
  playerRows: Record<Player, PlayerRowRefs>;
  sound: HTMLInputElement;
  vibration: HTMLInputElement;
  reset: HTMLButtonElement;
}

export interface Shell {
  root: HTMLElement;
  home: HTMLElement;
  game: HTMLElement;
  info: HTMLElement;
  settings: HTMLElement;
  about: HTMLElement;
  match: HTMLElement;
  status: HTMLElement;
  board: HTMLElement;
  resumeButton: HTMLButtonElement;
  newGameButton: HTMLButtonElement;
  settingsButton: HTMLButtonElement;
  howToButton: HTMLButtonElement;
  aboutButton: HTMLButtonElement;
  saveNote: HTMLElement;
  menuButton: HTMLButtonElement;
  infoBack: HTMLButtonElement;
  settingsBack: HTMLButtonElement;
  aboutBack: HTMLButtonElement;
  scores: Record<Player, ScoreCard>;
  settingsRefs: SettingsRefs;
  overlay: HTMLDialogElement;
}

const LOGO = /* html */ `
  <svg class="logo" viewBox="0 0 120 120" role="img" aria-label="Color Wars">
    <rect x="6" y="6" width="108" height="108" rx="24" fill="#ffffff"
      stroke="#cfd0d6" stroke-width="3" />
    <circle cx="40" cy="40" r="11" fill="#6e6eff" />
    <circle cx="80" cy="40" r="11" fill="#ffffff" stroke="#3a0b0b" stroke-width="5" />
    <circle cx="40" cy="80" r="11" fill="#ff5959" />
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

function scoreCard(
  player: Player,
  variant: "score--bar" | "score--rail",
  hidden = false,
): string {
  return /* html */ `
    <article
      class="score ${variant}"
      data-player="${player}"
      aria-label="Player ${player} score"
      ${hidden ? "hidden" : ""}
    >
      <h2 class="score__name" data-role="name">Player ${player}</h2>
      <p class="score__stats">
        <span><b data-role="cells">0</b> cells</span>
        <span><b data-role="orbs">0</b> orbs</span>
      </p>
    </article>
  `;
}

function playerRow(player: Player): string {
  return /* html */ `
    <div class="player-row" data-player="${player}">
      <input
        class="player-row__color"
        type="color"
        data-role="player-color"
        aria-label="Player ${player} colour"
      />
      <label class="player-row__name">
        <span class="player-row__label" data-role="player-label">Player ${player}</span>
        <input
          type="text"
          data-role="player-name"
          maxlength="16"
          autocomplete="off"
          spellcheck="false"
          aria-label="Player ${player} name"
        />
      </label>
    </div>
  `;
}

const SHELL_TEMPLATE = /* html */ `
  <section class="screen screen--home" data-role="home" aria-labelledby="home-title">
    <div class="home__logo">${LOGO}</div>
    <h1 class="home__title" id="home-title">Color Wars</h1>
    <p class="home__desc">
      A chain reaction game for one to four players. Place orbs, set off
      explosions, and capture the whole board.
    </p>
    <div class="home__actions">
      <button class="btn btn--primary btn--large" type="button" data-action="resume">
        Resume
      </button>
      <button class="btn btn--secondary btn--large" type="button" data-action="new-game">
        New game
      </button>
      <div class="home__links">
        <button class="btn btn--quiet" type="button" data-action="settings">
          Settings
        </button>
        <button class="btn btn--quiet" type="button" data-action="how-to">
          How to play
        </button>
        <button class="btn btn--quiet" type="button" data-action="about">
          About
        </button>
      </div>
    </div>
    <p class="home__note" data-role="save-note"></p>
  </section>

  <section class="screen screen--game" data-role="game" hidden aria-label="Match">
    <header class="gamebar">
      <button class="iconbtn" type="button" data-action="menu" aria-label="Game menu">
        ${MENU_ICON}
      </button>
      <p class="turn" role="status" aria-live="polite" data-role="status"></p>
      <span class="gamebar__spacer" aria-hidden="true"></span>
    </header>

    <div class="match" data-role="match">
      ${scoreCard(3, "score--rail", true)}

      <div class="match__center">
        ${scoreCard(2, "score--bar")}

        <main class="stage">
          <div
            class="board"
            data-role="board"
            role="group"
            aria-label="Board, 7 by 7"
          ></div>
        </main>

        ${scoreCard(1, "score--bar")}
      </div>

      ${scoreCard(4, "score--rail", true)}
    </div>
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
        Color Wars is a hot-seat game for one to four players sharing one
        device, with an optional Bot opponent. Player 2 sits above the board,
        Player 1 below it, and Players 3 and 4 on the left and right when four
        are playing.
      </p>

      <h3>Goal</h3>
      <p>
        Capture every orb on the board. A player with no orbs left after a
        cascade is eliminated; the last player with orbs wins.
      </p>

      <h3>On your turn</h3>
      <ul>
        <li>Place a new orb on any empty cell, or</li>
        <li>add one orb to a cell you already own.</li>
      </ul>
      <p>Turns then pass to the next player in order.</p>

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
        After a cascade settles, a player with no orbs left is eliminated. If
        one player still owns orbs, they win. Solo mode is a practice board with
        no opponent.
      </p>

      <h3>Bot opponent</h3>
      <p>
        Turn on Bot opponent in Settings to give the last seat to the Bot. Its
        name is always Bot, and the Difficulty setting changes how it chooses
        moves: Easy plays at random, Medium weighs each move, and Hard also
        avoids leaving you an immediate detonation.
      </p>

      <h3>Controls</h3>
      <ul>
        <li>Tap or click a legal cell to place an orb.</li>
        <li>
          Keyboard: Tab into the board, move with the arrow keys or Home/End,
          and press Enter or Space to place.
        </li>
        <li>Use the menu button for How to play, Restart, or Back to home.</li>
      </ul>

      <h3>Tip</h3>
      <p>
        Corners only need 2 orbs to pop, so they are easy to flip, while edge
        and middle cells hold more and fire in more directions.
      </p>
    </div>
  </section>

  <section class="screen screen--settings" data-role="settings" hidden aria-labelledby="settings-title">
    <header class="infobar">
      <button class="iconbtn" type="button" data-action="settings-back" aria-label="Back">
        ${BACK_ICON}
      </button>
      <h2 class="infobar__title" id="settings-title">Settings</h2>
      <span class="gamebar__spacer" aria-hidden="true"></span>
    </header>

    <div class="settings">
      <section class="panel" aria-labelledby="settings-appearance">
        <h3 class="panel__title" id="settings-appearance">Appearance</h3>

        <div class="field">
          <span class="field__label">Theme</span>
          <div class="segmented" data-role="theme" role="group" aria-label="Theme">
            <button type="button" data-theme-option="light" aria-pressed="false">Light</button>
            <button type="button" data-theme-option="dark" aria-pressed="false">Dark</button>
          </div>
          <p class="field__hint">
            Applies to every screen and is saved on this device.
          </p>
        </div>
      </section>

      <section class="panel" aria-labelledby="settings-match">
        <h3 class="panel__title" id="settings-match">Match</h3>

        <div class="field">
          <div class="field__head">
            <span class="field__label">Difficulty</span>
            <span class="badge" data-role="difficulty-badge">Bot · Medium</span>
          </div>
          <div class="segmented" data-role="difficulty" role="group" aria-label="Difficulty">
            <button type="button" data-difficulty="easy" aria-pressed="false">Easy</button>
            <button type="button" data-difficulty="medium" aria-pressed="false">Medium</button>
            <button type="button" data-difficulty="hard" aria-pressed="false">Hard</button>
          </div>
          <p class="field__hint">
            Sets how the Bot plays. It applies to the Bot's next turn and to
            every new game.
          </p>
        </div>

        <div class="field">
          <div class="field__head">
            <span class="field__label">Board size</span>
          </div>
          <div class="grid-size">
            <div class="stepper">
              <button class="stepper__btn" type="button" data-action="grid-rows-minus" aria-label="Decrease rows"></button>
              <output class="stepper__value" data-role="grid-rows-value" aria-live="polite">7</output>
              <button class="stepper__btn" type="button" data-action="grid-rows-plus" aria-label="Increase rows"></button>
              <span class="stepper__label">rows</span>
            </div>
            <span class="grid-size__by" aria-hidden="true">×</span>
            <div class="stepper">
              <button class="stepper__btn" type="button" data-action="grid-cols-minus" aria-label="Decrease columns"></button>
              <output class="stepper__value" data-role="grid-cols-value" aria-live="polite">7</output>
              <button class="stepper__btn" type="button" data-action="grid-cols-plus" aria-label="Increase columns"></button>
              <span class="stepper__label">columns</span>
            </div>
          </div>
          <p class="field__hint">
            Rows and columns can each be 7 to 15, so boards like 11 × 7 work.
            Applies to new games.
          </p>
        </div>
      </section>

      <section class="panel" aria-labelledby="settings-players">
        <h3 class="panel__title" id="settings-players">Players</h3>

        <div class="field">
          <span class="field__label">Number of players</span>
          <div class="segmented" data-role="player-count" role="group" aria-label="Number of players">
            <button type="button" data-count="1" aria-pressed="false">1</button>
            <button type="button" data-count="2" aria-pressed="false">2</button>
            <button type="button" data-count="3" aria-pressed="false">3</button>
            <button type="button" data-count="4" aria-pressed="false">4</button>
          </div>
          <p class="field__hint">
            Players 3 and 4 appear on the left and right of the board. A solo
            game is a practice board.
          </p>
        </div>

        <label class="switch">
          <span class="switch__copy">
            <span class="switch__title">Bot opponent</span>
            <span class="switch__hint" data-role="bot-hint">
              Player 2 is played by the Bot.
            </span>
          </span>
          <input type="checkbox" data-setting="bot" />
          <span class="switch__track" aria-hidden="true"></span>
        </label>

        <div class="player-list" data-role="player-list">
          ${[1, 2, 3, 4].map((value) => playerRow(value as Player)).join("")}
        </div>
      </section>

      <section class="panel" aria-labelledby="settings-feedback">
        <h3 class="panel__title" id="settings-feedback">Feedback</h3>

        <label class="switch">
          <span class="switch__copy">
            <span class="switch__title">Sound</span>
            <span class="switch__hint">Place, explosion, and win cues</span>
          </span>
          <input type="checkbox" data-setting="sound" />
          <span class="switch__track" aria-hidden="true"></span>
        </label>

        <label class="switch">
          <span class="switch__copy">
            <span class="switch__title">Vibration</span>
            <span class="switch__hint">Short haptic feedback on moves</span>
          </span>
          <input type="checkbox" data-setting="vibration" />
          <span class="switch__track" aria-hidden="true"></span>
        </label>
      </section>

      <button class="btn btn--quiet settings__reset" type="button" data-action="reset-settings">
        Reset to defaults
      </button>
    </div>
  </section>

  <section class="screen screen--about" data-role="about" hidden aria-labelledby="about-title">
    <header class="infobar">
      <button class="iconbtn" type="button" data-action="about-back" aria-label="Back">
        ${BACK_ICON}
      </button>
      <h2 class="infobar__title" id="about-title">About</h2>
      <span class="gamebar__spacer" aria-hidden="true"></span>
    </header>

    <div class="info about">
      <div class="about__brand">
        <div class="about__logo">${LOGO}</div>
        <h3 class="about__name">Color Wars</h3>
        <p class="about__version">Version 0.2.0</p>
      </div>

      <p>
        A local chain reaction game for one to four players. Place orbs, trigger
        cascades, and be the last colour on the board.
      </p>

      <h3>Built for one device</h3>
      <p>
        Everyone shares the same screen. Player 1 sits at the bottom, Player 2
        at the top, and Players 3 and 4 on the left and right for four-player
        matches.
      </p>

      <h3>Private and offline</h3>
      <p>
        No accounts, no ads, no tracking, and no network requests. Saves and
        settings stay in this device's local storage.
      </p>

      <h3>Tech</h3>
      <p>
        TypeScript and Vite, with a pure rules engine and a DOM renderer.
        Packaged for Android with Capacitor.
      </p>

      <h3>Credits</h3>
      <p>
        Game design and code by the Color Wars project. Built as a modern
        rewrite of the original Pygame prototype.
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

function scoreCardRefs(root: HTMLElement, player: Player): ScoreCard {
  const card = requireElement<HTMLElement>(
    root,
    `.score[data-player="${player}"]`,
  );
  return {
    root: card,
    name: requireElement<HTMLElement>(card, "[data-role='name']"),
    cells: requireElement<HTMLElement>(card, "[data-role='cells']"),
    orbs: requireElement<HTMLElement>(card, "[data-role='orbs']"),
  };
}

function playerRowRefs(root: HTMLElement, player: Player): PlayerRowRefs {
  const row = requireElement<HTMLElement>(
    root,
    `.player-row[data-player="${player}"]`,
  );
  return {
    root: row,
    color: requireElement<HTMLInputElement>(row, "[data-role='player-color']"),
    name: requireElement<HTMLInputElement>(row, "[data-role='player-name']"),
    label: requireElement<HTMLElement>(row, "[data-role='player-label']"),
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
    settings: requireElement<HTMLElement>(root, "[data-role='settings']"),
    about: requireElement<HTMLElement>(root, "[data-role='about']"),
    match: requireElement<HTMLElement>(root, "[data-role='match']"),
    status: requireElement<HTMLElement>(root, "[data-role='status']"),
    board: requireElement<HTMLElement>(root, "[data-role='board']"),
    resumeButton: requireElement<HTMLButtonElement>(
      root,
      "[data-action='resume']",
    ),
    newGameButton: requireElement<HTMLButtonElement>(
      root,
      "[data-action='new-game']",
    ),
    settingsButton: requireElement<HTMLButtonElement>(
      root,
      "[data-action='settings']",
    ),
    howToButton: requireElement<HTMLButtonElement>(
      root,
      "[data-action='how-to']",
    ),
    aboutButton: requireElement<HTMLButtonElement>(
      root,
      "[data-action='about']",
    ),
    saveNote: requireElement<HTMLElement>(root, "[data-role='save-note']"),
    menuButton: requireElement<HTMLButtonElement>(root, "[data-action='menu']"),
    infoBack: requireElement<HTMLButtonElement>(
      root,
      "[data-action='info-back']",
    ),
    settingsBack: requireElement<HTMLButtonElement>(
      root,
      "[data-action='settings-back']",
    ),
    aboutBack: requireElement<HTMLButtonElement>(
      root,
      "[data-action='about-back']",
    ),
    scores: {
      1: scoreCardRefs(root, 1),
      2: scoreCardRefs(root, 2),
      3: scoreCardRefs(root, 3),
      4: scoreCardRefs(root, 4),
    },
    settingsRefs: {
      difficultyButtons: Array.from(
        root.querySelectorAll<HTMLButtonElement>("[data-difficulty]"),
      ),
      difficultyBadge: requireElement<HTMLElement>(
        root,
        "[data-role='difficulty-badge']",
      ),
      themeButtons: Array.from(
        root.querySelectorAll<HTMLButtonElement>("[data-theme-option]"),
      ),
      playerCountButtons: Array.from(
        root.querySelectorAll<HTMLButtonElement>("[data-count]"),
      ),
      bot: requireElement<HTMLInputElement>(root, "[data-setting='bot']"),
      botHint: requireElement<HTMLElement>(root, "[data-role='bot-hint']"),
      gridRowsValue: requireElement<HTMLElement>(
        root,
        "[data-role='grid-rows-value']",
      ),
      gridRowsMinus: requireElement<HTMLButtonElement>(
        root,
        "[data-action='grid-rows-minus']",
      ),
      gridRowsPlus: requireElement<HTMLButtonElement>(
        root,
        "[data-action='grid-rows-plus']",
      ),
      gridColsValue: requireElement<HTMLElement>(
        root,
        "[data-role='grid-cols-value']",
      ),
      gridColsMinus: requireElement<HTMLButtonElement>(
        root,
        "[data-action='grid-cols-minus']",
      ),
      gridColsPlus: requireElement<HTMLButtonElement>(
        root,
        "[data-action='grid-cols-plus']",
      ),
      playerRows: {
        1: playerRowRefs(root, 1),
        2: playerRowRefs(root, 2),
        3: playerRowRefs(root, 3),
        4: playerRowRefs(root, 4),
      },
      sound: requireElement<HTMLInputElement>(root, "[data-setting='sound']"),
      vibration: requireElement<HTMLInputElement>(
        root,
        "[data-setting='vibration']",
      ),
      reset: requireElement<HTMLButtonElement>(
        root,
        "[data-action='reset-settings']",
      ),
    },
    overlay: requireElement<HTMLDialogElement>(root, "[data-role='overlay']"),
  };
}
