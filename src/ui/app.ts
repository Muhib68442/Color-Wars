import {
  applyMove,
  BOT_NAME,
  chooseBotMove,
  createGame,
  MAX_GRID_SIZE,
  MIN_GRID_SIZE,
  type CellRef,
  type GameEvent,
  type GameState,
  type Player,
  type PlayerCount,
} from "../engine/index.js";
import type { Haptics } from "../platform/haptics.js";
import {
  defaultSettings,
  softenColor,
  strengthenColor,
  type GameSettings,
  type SettingsStore,
} from "../platform/settings.js";
import type { Sound } from "../platform/sound.js";
import type { StorageAdapter } from "../platform/storage.js";
import { playEvents, type ReplayHandle } from "./animations.js";
import { createBoardView } from "./boardView.js";
import { createHud } from "./hud.js";
import { createOverlay } from "./overlay.js";
import { mountShell } from "./shell.js";

export type ScreenName = "home" | "game" | "info" | "settings" | "about";

const PLAYERS: Player[] = [1, 2, 3, 4];
/** A short pause makes the Bot feel deliberate and lets the last cascade play. */
const BOT_THINK_MS = 600;
const BOT_RESUME_MS = 350;

export interface AppOptions {
  storage: StorageAdapter;
  settings: SettingsStore;
  haptics?: Haptics;
  sound?: Sound;
}

export interface App {
  getState(): GameState;
  getScreen(): ScreenName;
  getSettings(): GameSettings;
  selectCell(ref: CellRef): boolean;
  newGame(): void;
  requestNewGame(): void;
  persist(): void;
  /** Consume the Android back button, or return false to let the OS exit. */
  handleBack(): boolean;
}

export function createApp(root: HTMLElement, options: AppOptions): App {
  const shell = mountShell(root);
  const { storage, settings: settingsStore, haptics, sound } = options;

  let settings = settingsStore.load();
  const loaded = storage.load();
  let hasSave = loaded !== null;
  let state: GameState =
    loaded !== null
      ? { ...loaded, growOnly: settings.growOnly }
      : createGame(
          settings.gridRows,
          settings.gridCols,
          settings.playerCount,
          botSeatForSettings(),
          settings.growOnly,
        );
  let screen: ScreenName = "home";
  let infoReturn: "home" | "game" = "home";
  let botTimer: ReturnType<typeof setTimeout> | null = null;
  let animating = false;
  let replay: ReplayHandle | null = null;
  let replayToken: object | null = null;

  const profiles = () => settings.profiles;

  const board = createBoardView(
    shell.board,
    (ref) => {
      selectCell(ref);
    },
    {
      getProfiles: profiles,
      getBotPlayer: () => state.botPlayer,
      isInputLocked: () => isBotTurn() || animating,
    },
  );

  const hud = createHud({
    status: shell.status,
    scores: shell.scores,
    getProfiles: profiles,
    getBotPlayer: () => state.botPlayer,
    getTheme: () => settings.theme,
  });

  const overlay = createOverlay(shell.overlay, () => {
    if (screen !== "game") return;
    if (isBotTurn()) {
      shell.menuButton.focus();
      scheduleBotMove(150);
      return;
    }
    board.focusDefault();
  });

  /** The Bot always takes the highest-numbered seat in a new match. */
  function botSeatForSettings(): Player | null {
    return settings.bot && settings.playerCount > 1
      ? (settings.playerCount as Player)
      : null;
  }

  function isBotTurn(): boolean {
    return (
      state.botPlayer !== null &&
      !state.gameOver &&
      state.currentPlayer === state.botPlayer
    );
  }

  function clearBotTimer(): void {
    if (botTimer === null) return;
    clearTimeout(botTimer);
    botTimer = null;
  }

  function scheduleBotMove(delay = BOT_THINK_MS): void {
    clearBotTimer();
    if (!isBotTurn() || screen !== "game" || overlay.isOpen()) return;

    botTimer = setTimeout(() => {
      botTimer = null;
      if (!isBotTurn() || screen !== "game" || overlay.isOpen()) return;
      playBotMove();
    }, delay);
  }

  function playBotMove(): void {
    const move = chooseBotMove(state, { difficulty: settings.difficulty });
    if (move === null) return;

    const before = state;
    const result = applyMove(before, move);
    if (!result.accepted) return;

    state = result.state;
    hasSave = true;
    hud.render(state);
    updateHome();
    playMoveSound(
      state.gameOver,
      result.events.some((event) => event.type === "explode"),
    );
    storage.save(state);

    animateCascade(before, result.events, () => {
      if (screen !== "game") return;
      if (state.gameOver) {
        showResult();
        return;
      }
      scheduleBotMove();
    });
  }

  function nameOf(player: Player): string {
    if (state.botPlayer === player) return BOT_NAME;
    return settings.profiles[player].name.trim() || `Player ${player}`;
  }

  function applyTheme(): void {
    const dark = settings.theme === "dark";
    document.documentElement.dataset.theme = settings.theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#0f1115" : "#333333");
  }

  function applyPalette(): void {
    const dark = settings.theme === "dark";
    const softTarget = dark ? 32 : 255;
    const softFallback = dark ? "#1f232c" : "#f3f3f6";
    const strongTarget = dark ? 255 : 0;
    const strongFallback = dark ? "#f1f4f9" : "#14161a";

    for (const player of PLAYERS) {
      const color = settings.profiles[player].color;
      root.style.setProperty(`--p${player}`, color);
      root.style.setProperty(
        `--p${player}-strong`,
        strengthenColor(color, dark ? 0.4 : 0.22, strongTarget, strongFallback),
      );
      root.style.setProperty(
        `--p${player}-soft`,
        softenColor(color, dark ? 0.82 : 0.84, softTarget, softFallback),
      );
    }
  }

  function difficultyLabel(value: GameSettings["difficulty"]): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function playerSummary(count: number): string {
    if (count === 1) return "1 player · solo practice";
    if (settings.bot) {
      return `${count} players · Bot (${difficultyLabel(settings.difficulty)})`;
    }
    return `${count} players`;
  }

  function updateHome(): void {
    const resumable = hasSave && !state.gameOver;
    shell.resumeButton.hidden = !resumable;
    shell.resumeButton.disabled = !resumable;
    shell.resumeButton.setAttribute(
      "aria-disabled",
      resumable ? "false" : "true",
    );

    if (hasSave) {
      if (state.gameOver) {
        shell.saveNote.textContent =
          state.winner === null
            ? "Last game ended in a draw."
            : `Last game: ${nameOf(state.winner)} won.`;
      } else {
        shell.saveNote.textContent =
          `Saved match · ${state.rows} × ${state.cols} · ` +
          `${nameOf(state.currentPlayer)} to move`;
      }
      return;
    }

    shell.saveNote.textContent =
      `New game · ${settings.gridRows} × ${settings.gridCols} · ` +
      playerSummary(settings.playerCount);
  }

  function render(): void {
    board.render(state);
    hud.render(state);
    updateHome();
  }

  /**
   * Stops a running cascade replay. The model is already at its final state, so
   * an interruption can render the settled board immediately.
   */
  function cancelReplay(renderFinal = true): void {
    const handle = replay;
    const wasActive = animating || handle !== null;
    replay = null;
    replayToken = null;
    animating = false;
    handle?.cancel();
    if (renderFinal && wasActive) render();
  }

  /**
   * Plays the visible part of a move from `preState`, then runs the turn's
   * continuation (result dialog or Bot scheduling) once the board settles.
   */
  function animateCascade(
    preState: GameState,
    events: GameEvent[],
    after: () => void,
  ): void {
    replay?.cancel();
    replay = null;

    const token = {};
    replayToken = token;
    animating = true;

    const handle = playEvents(preState, events, board, {
      render: (snapshot) => {
        if (replayToken !== token) return;
        board.render(snapshot);
      },
      done: () => {
        if (replayToken !== token) return;
        replayToken = null;
        replay = null;
        animating = false;
        render();
        after();
      },
    });

    if (handle === null) {
      if (replayToken !== token) return;
      replayToken = null;
      animating = false;
      render();
      after();
      return;
    }

    replay = handle;
  }

  function showScreen(next: ScreenName): void {
    screen = next;
    shell.home.hidden = next !== "home";
    shell.game.hidden = next !== "game";
    shell.info.hidden = next !== "info";
    shell.settings.hidden = next !== "settings";
    shell.about.hidden = next !== "about";

    if (next !== "game") {
      clearBotTimer();
      cancelReplay();
    }

    if (next === "home") {
      if (!shell.resumeButton.disabled) shell.resumeButton.focus();
      else shell.newGameButton.focus();
    } else if (next === "info") {
      shell.infoBack.focus();
    } else if (next === "settings") {
      shell.settingsBack.focus();
    } else if (next === "about") {
      shell.aboutBack.focus();
    } else if (isBotTurn()) {
      shell.menuButton.focus();
      scheduleBotMove(BOT_RESUME_MS);
    } else {
      board.focusDefault();
    }
  }

  function saveSettings(): void {
    settingsStore.save(settings);
  }

  function populateSettings(): void {
    const refs = shell.settingsRefs;

    for (const button of refs.difficultyButtons) {
      const active = button.dataset.difficulty === settings.difficulty;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }

    for (const button of refs.themeButtons) {
      const active = button.dataset.themeOption === settings.theme;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }

    for (const button of refs.playerCountButtons) {
      const active = Number(button.dataset.count) === settings.playerCount;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }

    refs.difficultyBadge.textContent =
      `Bot · ${difficultyLabel(settings.difficulty)}`;

    refs.bot.checked = settings.bot;
    refs.growOnly.checked = settings.growOnly;
    refs.botHint.textContent =
      settings.bot && settings.playerCount > 1
        ? `Player ${settings.playerCount} is the Bot. It cannot be renamed.`
        : "Turn on to let the Bot play as the last player in new games.";

    refs.gridRowsValue.textContent = String(settings.gridRows);
    refs.gridRowsMinus.disabled = settings.gridRows <= MIN_GRID_SIZE;
    refs.gridRowsPlus.disabled = settings.gridRows >= MAX_GRID_SIZE;

    refs.gridColsValue.textContent = String(settings.gridCols);
    refs.gridColsMinus.disabled = settings.gridCols <= MIN_GRID_SIZE;
    refs.gridColsPlus.disabled = settings.gridCols >= MAX_GRID_SIZE;

    const botSeat = settings.bot ? (settings.playerCount as Player) : null;

    for (const player of PLAYERS) {
      const row = refs.playerRows[player];
      const profile = settings.profiles[player];
      const isBot = player === botSeat;
      row.root.hidden = player > settings.playerCount;
      row.root.classList.toggle("is-bot", isBot);
      const label = isBot ? BOT_NAME : `Player ${player}`;
      row.label.textContent = label;
      row.color.value = profile.color;
      row.color.setAttribute("aria-label", `${label} colour`);
      row.name.value = isBot ? BOT_NAME : profile.name;
      row.name.setAttribute("aria-label", `${label} name`);
      row.name.disabled = isBot;
    }

    refs.sound.checked = settings.sound;
    refs.vibration.checked = settings.vibration;
  }

  function openSettings(): void {
    populateSettings();
    showScreen("settings");
  }

  function showResult(): void {
    const { winner } = state;

    overlay.open({
      eyebrow: "Game over",
      title: winner === null ? "It's a draw" : `${nameOf(winner)} wins`,
      body:
        winner === null
          ? "The cascade hit its safety limit, so the game ends level."
          : `${nameOf(winner)} controls every orb left on the board.`,
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

  function playMoveSound(gameOver: boolean, exploded: boolean): void {
    if (!settings.sound) return;
    if (gameOver) {
      sound?.win();
    } else if (exploded) {
      sound?.explode();
    } else {
      sound?.place();
    }
  }

  function selectCell(ref: CellRef): boolean {
    if (screen !== "game" || overlay.isOpen() || animating) return false;
    if (isBotTurn()) return false;

    const before = state;
    const result = applyMove(before, ref);

    if (!result.accepted) {
      if (settings.vibration) haptics?.reject();
      if (settings.sound) sound?.reject();
      return false;
    }

    state = result.state;
    hasSave = true;
    hud.render(state);
    updateHome();
    if (settings.vibration) haptics?.tap();
    playMoveSound(
      state.gameOver,
      result.events.some((event) => event.type === "explode"),
    );
    storage.save(state);

    animateCascade(before, result.events, () => {
      if (screen !== "game") return;
      if (state.gameOver) showResult();
      else scheduleBotMove();
    });
    return true;
  }

  function newGame(): void {
    cancelReplay(false);
    clearBotTimer();
    overlay.close();
    state = createGame(
      settings.gridRows,
      settings.gridCols,
      settings.playerCount,
      botSeatForSettings(),
      settings.growOnly,
    );
    hasSave = false;
    storage.clear();
    applyPalette();
    render();
  }

  function startNewMatch(): void {
    newGame();
    showScreen("game");
  }

  function resumeMatch(): void {
    if (!hasSave || state.gameOver) return;
    showScreen("game");
  }

  function requestNewGame(): void {
    if (state.moveCount === 0 || state.gameOver) {
      startNewMatch();
      return;
    }

    overlay.open({
      eyebrow: "Restart match",
      title: "Restart match?",
      body: "The current match and its save will be lost.",
      actions: [
        {
          label: "No, keep playing",
          variant: "primary",
          run: () => overlay.close(),
        },
        {
          label: "Yes, restart",
          variant: "secondary",
          run: () => startNewMatch(),
        },
      ],
    });
  }

  function openMenu(): void {
    clearBotTimer();
    if (animating) {
      cancelReplay();
      if (state.gameOver) {
        showResult();
        return;
      }
    }
    overlay.open({
      eyebrow: "Game menu",
      title: "Paused",
      body: state.gameOver
        ? "The game is over. Start a new one or return home."
        : isBotTurn()
          ? `${BOT_NAME} is thinking…`
          : `${nameOf(state.currentPlayer)} to move.`,
      actions: [
        {
          label: "Keep playing",
          variant: "primary",
          run: () => overlay.close(),
        },
        {
          label: "Restart match",
          run: () => requestNewGame(),
        },
        {
          label: "How to play",
          run: () => {
            overlay.close();
            infoReturn = "game";
            showScreen("info");
          },
        },
        {
          label: "Back to home",
          run: () => {
            overlay.close();
            showScreen("home");
          },
        },
      ],
    });
  }

  function handleBack(): boolean {
    if (overlay.isOpen()) {
      overlay.close();
      return true;
    }

    if (screen === "game") {
      openMenu();
      return true;
    }

    if (screen === "info") {
      showScreen(infoReturn);
      return true;
    }

    if (screen === "settings" || screen === "about") {
      showScreen("home");
      return true;
    }

    // On the home screen the OS should close the app.
    return false;
  }

  function changeGridAxis(axis: "rows" | "cols", delta: number): void {
    const key = axis === "rows" ? "gridRows" : "gridCols";
    const current = settings[key];
    const next = Math.min(
      Math.max(current + delta, MIN_GRID_SIZE),
      MAX_GRID_SIZE,
    );
    if (next === current) return;
    settings[key] = next;
    saveSettings();
    populateSettings();
    updateHome();
  }

  shell.resumeButton.addEventListener("click", resumeMatch);
  shell.newGameButton.addEventListener("click", startNewMatch);

  shell.settingsButton.addEventListener("click", openSettings);

  shell.howToButton.addEventListener("click", () => {
    infoReturn = "home";
    showScreen("info");
  });

  shell.aboutButton.addEventListener("click", () => {
    showScreen("about");
  });

  shell.menuButton.addEventListener("click", openMenu);

  shell.infoBack.addEventListener("click", () => {
    showScreen(infoReturn);
  });

  shell.settingsBack.addEventListener("click", () => {
    showScreen("home");
  });

  shell.aboutBack.addEventListener("click", () => {
    showScreen("home");
  });

  for (const button of shell.settingsRefs.difficultyButtons) {
    button.addEventListener("click", () => {
      const value = button.dataset.difficulty;
      if (value !== "easy" && value !== "medium" && value !== "hard") return;
      settings.difficulty = value;
      saveSettings();
      populateSettings();
      updateHome();
    });
  }

  for (const button of shell.settingsRefs.themeButtons) {
    button.addEventListener("click", () => {
      const value = button.dataset.themeOption;
      if (value !== "light" && value !== "dark") return;
      if (settings.theme === value) return;
      settings.theme = value;
      applyTheme();
      applyPalette();
      saveSettings();
      populateSettings();
      render();
    });
  }

  for (const button of shell.settingsRefs.playerCountButtons) {
    button.addEventListener("click", () => {
      const value = Number(button.dataset.count);
      if (value < 1 || value > 4 || !Number.isInteger(value)) return;
      settings.playerCount = value as PlayerCount;
      // A solo practice board has no opponent for the Bot to play.
      if (settings.playerCount === 1) settings.bot = false;
      saveSettings();
      populateSettings();
      updateHome();
    });
  }

  shell.settingsRefs.bot.addEventListener("change", () => {
    settings.bot = shell.settingsRefs.bot.checked;
    // A Bot needs an opponent, so enabling it moves the match to two players.
    if (settings.bot && settings.playerCount === 1) {
      settings.playerCount = 2;
    }
    saveSettings();
    populateSettings();
    updateHome();
  });

  shell.settingsRefs.growOnly.addEventListener("change", () => {
    settings.growOnly = shell.settingsRefs.growOnly.checked;
    // Grow mode takes effect on the board immediately, including mid-match.
    state = { ...state, growOnly: settings.growOnly };
    saveSettings();
    if (hasSave) storage.save(state);
    render();
  });

  shell.settingsRefs.gridRowsMinus.addEventListener("click", () =>
    changeGridAxis("rows", -1),
  );
  shell.settingsRefs.gridRowsPlus.addEventListener("click", () =>
    changeGridAxis("rows", 1),
  );
  shell.settingsRefs.gridColsMinus.addEventListener("click", () =>
    changeGridAxis("cols", -1),
  );
  shell.settingsRefs.gridColsPlus.addEventListener("click", () =>
    changeGridAxis("cols", 1),
  );

  for (const player of PLAYERS) {
    const row = shell.settingsRefs.playerRows[player];

    row.color.addEventListener("input", () => {
      settings.profiles[player].color = row.color.value;
      saveSettings();
      applyPalette();
      render();
    });

    row.name.addEventListener("input", () => {
      // The Bot's name is fixed, so its input is disabled and ignored.
      if (player === botSeatForSettings()) {
        row.name.value = BOT_NAME;
        return;
      }
      settings.profiles[player].name = row.name.value.slice(0, 16);
      saveSettings();
      render();
    });

    row.name.addEventListener("blur", () => {
      if (player === botSeatForSettings()) {
        row.name.value = BOT_NAME;
        return;
      }
      const trimmed = row.name.value.trim();
      if (trimmed.length === 0) {
        settings.profiles[player].name = `Player ${player}`;
        row.name.value = settings.profiles[player].name;
        saveSettings();
        render();
      }
    });
  }

  shell.settingsRefs.sound.addEventListener("change", () => {
    settings.sound = shell.settingsRefs.sound.checked;
    saveSettings();
  });

  shell.settingsRefs.vibration.addEventListener("change", () => {
    settings.vibration = shell.settingsRefs.vibration.checked;
    saveSettings();
  });

  shell.settingsRefs.reset.addEventListener("click", () => {
    settings = defaultSettings();
    state = { ...state, growOnly: settings.growOnly };
    if (hasSave) storage.save(state);
    applyTheme();
    saveSettings();
    applyPalette();
    populateSettings();
    updateHome();
    render();
  });

  applyTheme();
  applyPalette();
  populateSettings();
  updateHome();
  render();
  showScreen("home");

  return {
    getState: () => state,
    getScreen: () => screen,
    getSettings: () => settings,
    selectCell,
    newGame,
    requestNewGame,
    handleBack,
    persist: () => {
      if (hasSave) storage.save(state);
    },
  };
}
