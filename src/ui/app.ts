import {
  applyMove,
  createGame,
  MAX_GRID_SIZE,
  MIN_GRID_SIZE,
  type CellRef,
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
import { playEvents } from "./animations.js";
import { createBoardView } from "./boardView.js";
import { createHud } from "./hud.js";
import { createOverlay } from "./overlay.js";
import { mountShell } from "./shell.js";

export type ScreenName = "home" | "game" | "info" | "settings" | "about";

const PLAYERS: Player[] = [1, 2, 3, 4];

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
}

export function createApp(root: HTMLElement, options: AppOptions): App {
  const shell = mountShell(root);
  const { storage, settings: settingsStore, haptics, sound } = options;

  let settings = settingsStore.load();
  const loaded = storage.load();
  let hasSave = loaded !== null;
  let state =
    loaded ??
    createGame(settings.gridRows, settings.gridCols, settings.playerCount);
  let screen: ScreenName = "home";
  let infoReturn: "home" | "game" = "home";

  const profiles = () => settings.profiles;

  const board = createBoardView(
    shell.board,
    (ref) => {
      selectCell(ref);
    },
    { getProfiles: profiles },
  );

  const hud = createHud({
    status: shell.status,
    scores: shell.scores,
    getProfiles: profiles,
  });

  const overlay = createOverlay(shell.overlay, () => {
    if (screen === "game") board.focusDefault();
  });

  function nameOf(player: Player): string {
    return settings.profiles[player].name.trim() || `Player ${player}`;
  }

  function applyPalette(): void {
    for (const player of PLAYERS) {
      const color = settings.profiles[player].color;
      root.style.setProperty(`--p${player}`, color);
      root.style.setProperty(`--p${player}-strong`, strengthenColor(color));
      root.style.setProperty(`--p${player}-soft`, softenColor(color));
    }
  }

  function playerSummary(count: number): string {
    if (count === 1) return "1 player · solo practice";
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

  function showScreen(next: ScreenName): void {
    screen = next;
    shell.home.hidden = next !== "home";
    shell.game.hidden = next !== "game";
    shell.info.hidden = next !== "info";
    shell.settings.hidden = next !== "settings";
    shell.about.hidden = next !== "about";

    if (next === "home") {
      if (!shell.resumeButton.disabled) shell.resumeButton.focus();
      else shell.newGameButton.focus();
    } else if (next === "info") {
      shell.infoBack.focus();
    } else if (next === "settings") {
      shell.settingsBack.focus();
    } else if (next === "about") {
      shell.aboutBack.focus();
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

    for (const button of refs.playerCountButtons) {
      const active = Number(button.dataset.count) === settings.playerCount;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }

    refs.gridRowsValue.textContent = String(settings.gridRows);
    refs.gridRowsMinus.disabled = settings.gridRows <= MIN_GRID_SIZE;
    refs.gridRowsPlus.disabled = settings.gridRows >= MAX_GRID_SIZE;

    refs.gridColsValue.textContent = String(settings.gridCols);
    refs.gridColsMinus.disabled = settings.gridCols <= MIN_GRID_SIZE;
    refs.gridColsPlus.disabled = settings.gridCols >= MAX_GRID_SIZE;

    for (const player of PLAYERS) {
      const row = refs.playerRows[player];
      const profile = settings.profiles[player];
      row.root.hidden = player > settings.playerCount;
      row.color.value = profile.color;
      row.name.value = profile.name;
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
    if (screen !== "game" || overlay.isOpen()) return false;

    const result = applyMove(state, ref);

    if (!result.accepted) {
      if (settings.vibration) haptics?.reject();
      if (settings.sound) sound?.reject();
      return false;
    }

    state = result.state;
    hasSave = true;
    render();
    playEvents(result.events, board);
    if (settings.vibration) haptics?.tap();
    playMoveSound(
      state.gameOver,
      result.events.some((event) => event.type === "explode"),
    );
    storage.save(state);

    if (state.gameOver) showResult();
    return true;
  }

  function newGame(): void {
    overlay.close();
    state = createGame(
      settings.gridRows,
      settings.gridCols,
      settings.playerCount,
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
    overlay.open({
      eyebrow: "Game menu",
      title: "Paused",
      body: state.gameOver
        ? "The game is over. Start a new one or return home."
        : `${nameOf(state.currentPlayer)} to move.`,
      actions: [
        {
          label: "How to play",
          run: () => {
            overlay.close();
            infoReturn = "game";
            showScreen("info");
          },
        },
        {
          label: "Restart match",
          run: () => requestNewGame(),
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
          variant: "primary",
          run: () => overlay.close(),
        },
      ],
    });
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
    });
  }

  for (const button of shell.settingsRefs.playerCountButtons) {
    button.addEventListener("click", () => {
      const value = Number(button.dataset.count);
      if (value < 1 || value > 4 || !Number.isInteger(value)) return;
      settings.playerCount = value as PlayerCount;
      saveSettings();
      populateSettings();
      updateHome();
    });
  }

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
      settings.profiles[player].name = row.name.value.slice(0, 16);
      saveSettings();
      render();
    });

    row.name.addEventListener("blur", () => {
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
    saveSettings();
    applyPalette();
    populateSettings();
    render();
  });

  applyPalette();
  render();
  showScreen("home");

  return {
    getState: () => state,
    getScreen: () => screen,
    getSettings: () => settings,
    selectCell,
    newGame,
    requestNewGame,
    persist: () => {
      if (hasSave) storage.save(state);
    },
  };
}
