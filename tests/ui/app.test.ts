// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  applyMove,
  createGame,
  setCell,
  type GameState,
} from "../../src/engine/index.js";
import { noopHaptics } from "../../src/platform/haptics.js";
import {
  createSettingsStore,
  defaultSettings,
  type GameSettings,
} from "../../src/platform/settings.js";
import { noopSound } from "../../src/platform/sound.js";
import {
  createStorage,
  memoryStore,
  SAVE_KEY,
  type KeyValueStore,
} from "../../src/platform/storage.js";
import { createApp } from "../../src/ui/app.js";
import { cell, emptyBoard, makeState } from "../engine/helpers.js";

interface MountOptions {
  seed?: GameState;
  store?: KeyValueStore;
  settings?: GameSettings;
}

function mount(options: MountOptions = {}) {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.getElementById("app");
  if (root === null) throw new Error("Missing #app");

  const store = options.store ?? memoryStore();
  const storage = createStorage(store);
  if (options.seed !== undefined) storage.save(options.seed);

  const settingsStore = createSettingsStore(store);
  if (options.settings !== undefined) settingsStore.save(options.settings);

  const app = createApp(root, {
    storage,
    settings: settingsStore,
    haptics: noopHaptics,
    sound: noopSound,
  });

  return { root, app, store, storage, settingsStore };
}

function button(root: HTMLElement, action: string): HTMLButtonElement {
  const element = root.querySelector<HTMLButtonElement>(
    `[data-action='${action}']`,
  );
  if (element === null) throw new Error(`Missing button: ${action}`);
  return element;
}

function startMatch(root: HTMLElement): void {
  button(root, "new-game").click();
}

function resumeMatch(root: HTMLElement): void {
  button(root, "resume").click();
}

function cellButton(root: HTMLElement, row: number, col: number): HTMLButtonElement {
  const element = root.querySelector<HTMLButtonElement>(
    `button.cell[data-row="${row}"][data-col="${col}"]`,
  );
  if (element === null) throw new Error(`Missing cell ${row},${col}`);
  return element;
}

function status(root: HTMLElement): string {
  return root.querySelector("[data-role='status']")?.textContent ?? "";
}

function saveNote(root: HTMLElement): string {
  return root.querySelector("[data-role='save-note']")?.textContent ?? "";
}

function overlay(root: HTMLElement): HTMLDialogElement {
  const dialog = root.querySelector<HTMLDialogElement>("[data-role='overlay']");
  if (dialog === null) throw new Error("Missing overlay");
  return dialog;
}

function overlayTitle(root: HTMLElement): string {
  return (
    root.querySelector("[data-role='overlay-title']")?.textContent ?? ""
  );
}

function overlayBody(root: HTMLElement): string {
  return (
    root.querySelector("[data-role='overlay-body']")?.textContent ?? ""
  );
}

function overlayActions(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    root.querySelectorAll<HTMLButtonElement>(
      "[data-role='overlay-actions'] button",
    ),
  );
}

function action(root: HTMLElement, label: string): HTMLButtonElement {
  const element = overlayActions(root).find(
    (candidate) => candidate.textContent === label,
  );
  if (element === undefined) throw new Error(`Missing overlay action: ${label}`);
  return element;
}

function orbsOn(root: HTMLElement, row: number, col: number): number {
  return Number(cellButton(root, row, col).dataset.orbs);
}

function screenIs(
  root: HTMLElement,
  name: "home" | "game" | "info" | "settings" | "about",
): boolean {
  const screen = root.querySelector<HTMLElement>(`[data-role='${name}']`);
  return screen !== null && !screen.hidden;
}

function settingsRoot(root: HTMLElement): HTMLElement {
  const screen = root.querySelector<HTMLElement>("[data-role='settings']");
  if (screen === null) throw new Error("Missing settings screen");
  return screen;
}

function gridValue(root: HTMLElement, axis: "rows" | "cols"): string {
  return (
    settingsRoot(root).querySelector(`[data-role='grid-${axis}-value']`)
      ?.textContent ?? ""
  );
}

function playerRow(root: HTMLElement, player: number): HTMLElement {
  const row = settingsRoot(root).querySelector<HTMLElement>(
    `.player-row[data-player="${player}"]`,
  );
  if (row === null) throw new Error(`Missing player row ${player}`);
  return row;
}

function playerNameInput(
  root: HTMLElement,
  player: number,
): HTMLInputElement {
  const input = playerRow(root, player).querySelector<HTMLInputElement>(
    "[data-role='player-name']",
  );
  if (input === null) throw new Error(`Missing name input ${player}`);
  return input;
}

function playerColorInput(
  root: HTMLElement,
  player: number,
): HTMLInputElement {
  const input = playerRow(root, player).querySelector<HTMLInputElement>(
    "[data-role='player-color']",
  );
  if (input === null) throw new Error(`Missing colour input ${player}`);
  return input;
}

function themeButton(
  root: HTMLElement,
  theme: "light" | "dark",
): HTMLButtonElement {
  const element = settingsRoot(root).querySelector<HTMLButtonElement>(
    `[data-theme-option="${theme}"]`,
  );
  if (element === null) throw new Error(`Missing theme option: ${theme}`);
  return element;
}

function countButton(root: HTMLElement, count: number): HTMLButtonElement {
  const element = settingsRoot(root).querySelector<HTMLButtonElement>(
    `[data-count="${count}"]`,
  );
  if (element === null) throw new Error(`Missing player count ${count}`);
  return element;
}

function selectPlayerCount(root: HTMLElement, count: number): void {
  button(root, "settings").click();
  countButton(root, count).click();
  button(root, "settings-back").click();
}

function botSwitch(root: HTMLElement): HTMLInputElement {
  const input = settingsRoot(root).querySelector<HTMLInputElement>(
    "[data-setting='bot']",
  );
  if (input === null) throw new Error("Missing Bot switch");
  return input;
}

function setBot(root: HTMLElement, enabled: boolean): void {
  const input = botSwitch(root);
  input.checked = enabled;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function difficultyButton(
  root: HTMLElement,
  difficulty: "easy" | "medium" | "hard",
): HTMLButtonElement {
  const element = settingsRoot(root).querySelector<HTMLButtonElement>(
    `[data-difficulty='${difficulty}']`,
  );
  if (element === null) throw new Error(`Missing difficulty: ${difficulty}`);
  return element;
}

function scoreName(root: HTMLElement, player: number): string {
  return (
    root.querySelector<HTMLElement>(
      `.score[data-player='${player}'] .score__name`,
    )?.textContent ?? ""
  );
}

function visibleScores(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(".score:not([hidden])"),
  );
}

describe("home screen", () => {
  it("boots on the home screen with the primary actions", () => {
    const { root, app } = mount();

    expect(app.getScreen()).toBe("home");
    expect(screenIs(root, "home")).toBe(true);
    expect(screenIs(root, "game")).toBe(false);
    expect(screenIs(root, "info")).toBe(false);
    expect(screenIs(root, "settings")).toBe(false);
    expect(screenIs(root, "about")).toBe(false);
    expect(root.querySelector(".home__logo svg")).not.toBeNull();
    expect(root.querySelector(".home__title")?.textContent).toBe("Color Wars");

    expect(button(root, "resume").textContent?.trim()).toBe("Resume");
    expect(button(root, "resume").disabled).toBe(true);
    expect(button(root, "resume").hidden).toBe(true);
    expect(button(root, "new-game").textContent?.trim()).toBe("New game");
    expect(button(root, "settings").textContent?.trim()).toBe("Settings");
    expect(button(root, "how-to").textContent?.trim()).toBe("How to play");
    expect(button(root, "about").textContent?.trim()).toBe("About");
    expect(saveNote(root)).toBe("New game · 7 × 7 · 2 players");
  });

  it("starts a fresh match when New game is pressed", () => {
    const { root, app } = mount();

    startMatch(root);

    expect(app.getScreen()).toBe("game");
    expect(screenIs(root, "game")).toBe(true);
    expect(screenIs(root, "home")).toBe(false);
    expect(app.getState().moveCount).toBe(0);
    expect(status(root)).toBe("Player 1 to move");
    expect(root.querySelectorAll("button.cell")).toHaveLength(49);
  });

  it("shows Resume and describes the saved match", () => {
    const saved = applyMove(createGame(), { row: 0, col: 0 }).state;
    const { root, app } = mount({ seed: saved });

    expect(button(root, "resume").hidden).toBe(false);
    expect(button(root, "resume").disabled).toBe(false);
    expect(saveNote(root)).toContain("Saved match");
    expect(saveNote(root)).toContain("Player 2 to move");

    resumeMatch(root);

    expect(app.getScreen()).toBe("game");
    expect(status(root)).toBe("Player 2 to move");
    expect(orbsOn(root, 0, 0)).toBe(1);
  });

  it("resets the previous save when New game is pressed", () => {
    const saved = applyMove(createGame(), { row: 0, col: 0 }).state;
    const { root, app, store } = mount({ seed: saved });

    startMatch(root);

    expect(app.getScreen()).toBe("game");
    expect(app.getState().moveCount).toBe(0);
    expect(store.getItem(SAVE_KEY)).toBeNull();
    expect(status(root)).toBe("Player 1 to move");
  });
});

describe("settings", () => {
  it("opens from home and returns home", () => {
    const { root, app } = mount();

    button(root, "settings").click();

    expect(app.getScreen()).toBe("settings");
    expect(screenIs(root, "settings")).toBe(true);
    expect(root.querySelector("#settings-title")?.textContent).toBe("Settings");
    expect(gridValue(root, "rows")).toBe("7");
    expect(gridValue(root, "cols")).toBe("7");

    const medium = settingsRoot(root).querySelector<HTMLButtonElement>(
      "[data-difficulty='medium']",
    );
    expect(medium?.getAttribute("aria-pressed")).toBe("true");
    expect(countButton(root, 2).getAttribute("aria-pressed")).toBe("true");
    expect(playerRow(root, 1).hidden).toBe(false);
    expect(playerRow(root, 2).hidden).toBe(false);
    expect(playerRow(root, 3).hidden).toBe(true);
    expect(playerRow(root, 4).hidden).toBe(true);

    const sound = settingsRoot(root).querySelector<HTMLInputElement>(
      "[data-setting='sound']",
    );
    const vibration = settingsRoot(root).querySelector<HTMLInputElement>(
      "[data-setting='vibration']",
    );
    expect(sound?.checked).toBe(true);
    expect(vibration?.checked).toBe(true);

    button(root, "settings-back").click();
    expect(app.getScreen()).toBe("home");
  });

  it("switches theme, applies it to every screen, and persists it", () => {
    const store = memoryStore();
    const first = mount({ store });

    button(first.root, "settings").click();
    expect(themeButton(first.root, "light").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(themeButton(first.root, "dark").getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(document.documentElement.dataset.theme).toBe("light");

    themeButton(first.root, "dark").click();

    expect(first.app.getSettings().theme).toBe("dark");
    expect(themeButton(first.root, "dark").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(themeButton(first.root, "light").getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(first.settingsStore.load().theme).toBe("dark");
    expect(first.root.style.getPropertyValue("--p1-soft")).not.toBe("");

    button(first.root, "settings-back").click();
    expect(document.documentElement.dataset.theme).toBe("dark");

    const second = mount({ store });
    expect(second.app.getSettings().theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    button(second.root, "settings").click();
    expect(themeButton(second.root, "dark").getAttribute("aria-pressed")).toBe(
      "true",
    );

    button(second.root, "reset-settings").click();
    expect(second.app.getSettings().theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(themeButton(second.root, "light").getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("steps rows and columns independently and recreates the board", () => {
    const { root, app, settingsStore } = mount();

    button(root, "settings").click();
    const rowsMinus = button(root, "grid-rows-minus");
    const rowsPlus = button(root, "grid-rows-plus");
    const colsMinus = button(root, "grid-cols-minus");
    const colsPlus = button(root, "grid-cols-plus");
    expect(rowsMinus.disabled).toBe(true);
    expect(colsMinus.disabled).toBe(true);

    rowsPlus.click();
    rowsPlus.click();
    colsPlus.click();
    expect(gridValue(root, "rows")).toBe("9");
    expect(gridValue(root, "cols")).toBe("8");
    expect(settingsStore.load().gridRows).toBe(9);
    expect(settingsStore.load().gridCols).toBe(8);

    rowsMinus.click();
    expect(settingsStore.load().gridRows).toBe(8);

    button(root, "settings-back").click();
    startMatch(root);

    expect(app.getState().rows).toBe(8);
    expect(app.getState().cols).toBe(8);
    expect(root.querySelectorAll("button.cell")).toHaveLength(64);
  });

  it("builds an 11 by 7 board for four players", () => {
    const { root, app, settingsStore } = mount();

    button(root, "settings").click();
    for (let step = 0; step < 4; step += 1) {
      button(root, "grid-rows-plus").click();
    }
    selectPlayerCount(root, 4);
    button(root, "settings-back").click();
    startMatch(root);

    expect(settingsStore.load().gridRows).toBe(11);
    expect(settingsStore.load().gridCols).toBe(7);
    expect(app.getState().playerCount).toBe(4);
    expect(app.getState().rows).toBe(11);
    expect(app.getState().cols).toBe(7);
    expect(root.querySelectorAll("button.cell")).toHaveLength(77);
  });

  it("switches between one and four players", () => {
    const { root, app, settingsStore } = mount();

    selectPlayerCount(root, 4);

    expect(settingsStore.load().playerCount).toBe(4);
    expect(playerRow(root, 3).hidden).toBe(false);
    expect(playerRow(root, 4).hidden).toBe(false);

    startMatch(root);

    expect(app.getState().playerCount).toBe(4);
    expect(visibleScores(root)).toHaveLength(4);
    expect(
      root.querySelector<HTMLElement>(
        ".score[data-player='3']",
      )?.classList.contains("score--rail"),
    ).toBe(true);
    expect(
      root.querySelector<HTMLElement>(
        ".score[data-player='4']",
      )?.classList.contains("score--rail"),
    ).toBe(true);
    expect(
      Array.from(
        root.querySelectorAll<HTMLElement>(".score:not([hidden]), .board"),
      ).map((element) => element.dataset.player ?? "board"),
    ).toEqual(["3", "2", "board", "1", "4"]);
  });

  it("applies custom names and colours to the match", () => {
    const { root, app, settingsStore } = mount();

    button(root, "settings").click();

    const name = playerNameInput(root, 1);
    name.value = "Ada";
    name.dispatchEvent(new Event("input", { bubbles: true }));

    const color = playerColorInput(root, 1);
    color.value = "#00cc88";
    color.dispatchEvent(new Event("input", { bubbles: true }));

    const saved = settingsStore.load();
    expect(saved.profiles[1].name).toBe("Ada");
    expect(saved.profiles[1].color.toLowerCase()).toBe("#00cc88");

    button(root, "settings-back").click();
    startMatch(root);
    cellButton(root, 0, 0).click();

    expect(root.style.getPropertyValue("--p1")).toBe("#00cc88");
    expect(
      root.querySelector<HTMLElement>(".score[data-player='1'] .score__name")
        ?.textContent,
    ).toBe("Ada");
    expect(cellButton(root, 0, 0).getAttribute("aria-label")).toBe(
      "Row 1, column 1, Ada, 1 of 2 orbs",
    );
    expect(app.getSettings().profiles[1].name).toBe("Ada");
  });

  it("toggles sound and vibration and resets to defaults", () => {
    const { root, app, settingsStore } = mount();

    button(root, "settings").click();

    const sound = settingsRoot(root).querySelector<HTMLInputElement>(
      "[data-setting='sound']",
    );
    const vibration = settingsRoot(root).querySelector<HTMLInputElement>(
      "[data-setting='vibration']",
    );
    if (sound === null || vibration === null) throw new Error("Missing switches");

    sound.checked = false;
    sound.dispatchEvent(new Event("change", { bubbles: true }));
    vibration.checked = false;
    vibration.dispatchEvent(new Event("change", { bubbles: true }));

    expect(app.getSettings().sound).toBe(false);
    expect(app.getSettings().vibration).toBe(false);
    expect(settingsStore.load().sound).toBe(false);
    expect(settingsStore.load().vibration).toBe(false);

    button(root, "reset-settings").click();

    expect(app.getSettings()).toEqual(defaultSettings());
    expect(settingsStore.load().sound).toBe(true);
    expect(settingsStore.load().vibration).toBe(true);
  });

  it("persists settings across a reload", () => {
    const store = memoryStore();
    const first = mount({ store });

    button(first.root, "settings").click();
    button(first.root, "grid-rows-plus").click();
    countButton(first.root, 3).click();
    button(first.root, "settings-back").click();

    const second = mount({ store });
    button(second.root, "settings").click();

    expect(gridValue(second.root, "rows")).toBe("8");
    expect(gridValue(second.root, "cols")).toBe("7");
    expect(countButton(second.root, 3).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(playerRow(second.root, 3).hidden).toBe(false);
    expect(playerRow(second.root, 4).hidden).toBe(true);
  });
});

describe("how to play and about", () => {
  it("opens How to play from home and returns home", () => {
    const { root, app } = mount();

    button(root, "how-to").click();

    expect(app.getScreen()).toBe("info");
    expect(screenIs(root, "info")).toBe(true);
    expect(root.querySelector("#info-title")?.textContent).toBe("How to play");

    button(root, "info-back").click();
    expect(app.getScreen()).toBe("home");
  });

  it("opens How to play from the game menu and returns to the match", () => {
    const { root, app } = mount();
    startMatch(root);

    button(root, "menu").click();
    expect(overlay(root).hasAttribute("open")).toBe(true);
    expect(overlayTitle(root)).toBe("Paused");

    action(root, "How to play").click();

    expect(overlay(root).hasAttribute("open")).toBe(false);
    expect(app.getScreen()).toBe("info");

    button(root, "info-back").click();
    expect(app.getScreen()).toBe("game");
  });

  it("opens About from home and returns home", () => {
    const { root, app } = mount();

    button(root, "about").click();

    expect(app.getScreen()).toBe("about");
    expect(screenIs(root, "about")).toBe(true);
    expect(root.querySelector("#about-title")?.textContent).toBe("About");
    expect(root.querySelector(".about__name")?.textContent).toBe("Color Wars");
    expect(root.querySelector(".about__version")?.textContent).toBe(
      `Version ${__APP_VERSION__}`,
    );
    expect(root.querySelector(".about__updated")?.textContent).toBe(
      `Last updated ${__APP_UPDATED__}`,
    );

    const site = root.querySelector<HTMLAnchorElement>(".about__site");
    expect(site?.textContent?.trim()).toBe("Visit website");
    expect(site?.href).toBe("https://muhib68442.github.io/Color-Wars");
    expect(site?.target).toBe("_blank");
    expect(site?.rel).toBe("noopener noreferrer");

    button(root, "about-back").click();
    expect(app.getScreen()).toBe("home");
  });
});

describe("app shell", () => {
  it("renders a 7x7 board, scores, and a visible turn banner", () => {
    const { root } = mount();
    startMatch(root);

    expect(root.querySelectorAll("button.cell")).toHaveLength(49);
    expect(root.querySelector(".gamebar [data-role='status']")).not.toBeNull();
    expect(status(root)).toBe("Player 1 to move");
    expect(cellButton(root, 0, 0).getAttribute("aria-label")).toBe(
      "Row 1, column 1, empty",
    );
    expect(
      root.querySelectorAll("button.cell[tabindex='0']"),
    ).toHaveLength(1);
  });

  it("puts Player 2 above the board and Player 1 below it", () => {
    const { root } = mount();
    startMatch(root);

    expect(
      Array.from(
        root.querySelectorAll<HTMLElement>(".score:not([hidden]), .board"),
      ).map((element) => element.dataset.player ?? "board"),
    ).toEqual(["2", "board", "1"]);
  });

  it("keeps exactly one tab stop on the board", () => {
    const { root } = mount();
    startMatch(root);
    cellButton(root, 2, 3).focus();

    expect(cellButton(root, 2, 3).tabIndex).toBe(0);
    expect(
      root.querySelectorAll("button.cell[tabindex='0']"),
    ).toHaveLength(1);
  });

  it("does not place orbs while on the home screen", () => {
    const { root, app } = mount();

    cellButton(root, 0, 0).click();

    expect(app.getState().moveCount).toBe(0);
  });
});

describe("placing orbs", () => {
  it("places an orb on an empty cell and swaps the turn", () => {
    const { root, app } = mount();
    startMatch(root);

    cellButton(root, 0, 0).click();

    expect(orbsOn(root, 0, 0)).toBe(1);
    expect(cellButton(root, 0, 0).className).toContain("cell--p1");
    expect(status(root)).toBe("Player 2 to move");
    expect(app.getState().currentPlayer).toBe(2);
  });

  it("still allows a new placement after both opening moves", () => {
    const { root, app } = mount();
    startMatch(root);

    cellButton(root, 0, 0).click();
    cellButton(root, 6, 6).click();
    cellButton(root, 3, 3).click();

    expect(orbsOn(root, 3, 3)).toBe(1);
    expect(app.getState().moveCount).toBe(3);
  });

  it("ignores a click on an enemy cell", () => {
    const { root, app } = mount();
    startMatch(root);

    cellButton(root, 0, 0).click();
    cellButton(root, 6, 6).click();
    cellButton(root, 0, 1).click();

    const before = app.getState().moveCount;
    cellButton(root, 0, 0).click();

    expect(app.getState().moveCount).toBe(before);
    expect(app.getState().currentPlayer).toBe(2);
    expect(orbsOn(root, 0, 0)).toBe(1);
  });

  it("moves focus with the arrow keys", () => {
    const { root } = mount();
    startMatch(root);

    cellButton(root, 0, 0).focus();
    cellButton(root, 0, 0).dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );

    expect(document.activeElement).toBe(cellButton(root, 0, 1));
  });

  it("keeps solo mode on Player 1's turn", () => {
    const { root, app } = mount({
      settings: { ...defaultSettings(), playerCount: 1 },
    });
    startMatch(root);

    expect(status(root)).toBe("Player 1 · solo practice");

    cellButton(root, 0, 0).click();

    expect(status(root)).toBe("Player 1 · solo practice");
    expect(app.getState().playerCount).toBe(1);
    expect(app.getState().currentPlayer).toBe(1);
  });

  it("shows a dashed next-orb slot only when a cell is one orb from bursting", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 0, 0, cell(1, 1)); // corner, 1 of 2
    setCell(board, 0, 3, cell(1, 2)); // edge, 2 of 3
    setCell(board, 3, 3, cell(1, 3)); // interior, 3 of 4
    setCell(board, 3, 1, cell(1, 2)); // interior, 2 of 4

    const { root } = mount({ seed: makeState(board) });
    resumeMatch(root);

    const ghosts = (row: number, col: number): number =>
      cellButton(root, row, col).querySelectorAll(".orb.is-ghost").length;

    expect(ghosts(0, 0)).toBe(1);
    expect(ghosts(0, 3)).toBe(1);
    expect(ghosts(3, 3)).toBe(1);
    expect(ghosts(3, 1)).toBe(0);
  });
});

describe("winning", () => {
  function winningSeed(): GameState {
    const board = emptyBoard(7, 7);
    setCell(board, 0, 0, cell(1, 1));
    setCell(board, 0, 1, cell(2, 1));
    return makeState(board, { currentPlayer: 1 });
  }

  it("shows a result overlay and locks the board", () => {
    const { root, app } = mount({ seed: winningSeed() });
    resumeMatch(root);
    cellButton(root, 0, 0).click();

    expect(app.getState().gameOver).toBe(true);
    expect(app.getState().winner).toBe(1);
    expect(overlay(root).hasAttribute("open")).toBe(true);
    expect(overlayTitle(root)).toBe("Player 1 wins");

    const before = app.getState().moveCount;
    cellButton(root, 6, 6).click();
    expect(app.getState().moveCount).toBe(before);
    expect(orbsOn(root, 6, 6)).toBe(0);

    action(root, "Play again").click();

    expect(overlay(root).hasAttribute("open")).toBe(false);
    expect(app.getScreen()).toBe("game");
    expect(app.getState().moveCount).toBe(0);
    expect(status(root)).toBe("Player 1 to move");
    expect(root.querySelectorAll("button.cell[data-orbs='0']")).toHaveLength(49);
  });

  it("returns home from the result dialog and reports the last result", () => {
    const { root, app } = mount({ seed: winningSeed() });
    resumeMatch(root);
    cellButton(root, 0, 0).click();

    action(root, "Back to home").click();

    expect(app.getScreen()).toBe("home");
    expect(button(root, "resume").disabled).toBe(true);
    expect(button(root, "resume").hidden).toBe(true);
    expect(saveNote(root)).toBe("Last game: Player 1 won.");
  });
});

describe("game menu", () => {
  it("asks before discarding a game in progress", () => {
    const { root, app } = mount();
    startMatch(root);
    cellButton(root, 0, 0).click();

    button(root, "menu").click();
    expect(overlayActions(root).map((item) => item.textContent)).toEqual([
      "Keep playing",
      "Restart match",
      "How to play",
      "Back to home",
    ]);
    expect(
      action(root, "Keep playing").classList.contains("btn--primary"),
    ).toBe(true);
    expect(
      action(root, "Restart match").classList.contains("btn--secondary"),
    ).toBe(true);

    action(root, "Restart match").click();

    expect(overlay(root).hasAttribute("open")).toBe(true);
    expect(overlayTitle(root)).toBe("Restart match?");
    expect(
      action(root, "No, keep playing").classList.contains("btn--primary"),
    ).toBe(true);

    action(root, "No, keep playing").click();
    expect(overlay(root).hasAttribute("open")).toBe(false);
    expect(app.getState().moveCount).toBe(1);

    button(root, "menu").click();
    action(root, "Restart match").click();
    action(root, "Yes, restart").click();

    expect(app.getState().moveCount).toBe(0);
    expect(orbsOn(root, 0, 0)).toBe(0);
  });

  it("returns home and keeps the saved game", () => {
    const { root, app } = mount();
    startMatch(root);
    cellButton(root, 0, 0).click();

    button(root, "menu").click();
    action(root, "Back to home").click();

    expect(app.getScreen()).toBe("home");
    expect(button(root, "resume").disabled).toBe(false);
    expect(button(root, "resume").hidden).toBe(false);
    expect(app.getState().moveCount).toBe(1);

    resumeMatch(root);
    expect(app.getScreen()).toBe("game");
    expect(status(root)).toBe("Player 2 to move");
  });
});

describe("Android back button", () => {
  it("closes an open dialog before handling the match", () => {
    const { root, app } = mount();
    startMatch(root);
    cellButton(root, 0, 0).click();

    button(root, "menu").click();
    expect(overlay(root).hasAttribute("open")).toBe(true);

    expect(app.handleBack()).toBe(true);
    expect(overlay(root).hasAttribute("open")).toBe(false);
    expect(app.getScreen()).toBe("game");
    expect(app.getState().moveCount).toBe(1);
  });

  it("opens the pause menu from a live match", () => {
    const { root, app } = mount();
    startMatch(root);

    expect(app.handleBack()).toBe(true);
    expect(overlay(root).hasAttribute("open")).toBe(true);
    expect(overlayTitle(root)).toBe("Paused");
  });

  it("returns from information screens and lets home exit", () => {
    const { root, app } = mount();

    button(root, "about").click();
    expect(app.getScreen()).toBe("about");
    expect(app.handleBack()).toBe(true);
    expect(app.getScreen()).toBe("home");

    expect(app.handleBack()).toBe(false);
  });

  it("returns from How to play to the match", () => {
    const { root, app } = mount();
    startMatch(root);
    button(root, "menu").click();
    action(root, "How to play").click();

    expect(app.getScreen()).toBe("info");
    expect(app.handleBack()).toBe(true);
    expect(app.getScreen()).toBe("game");
  });
});

describe("save and resume", () => {
  it("restores the board and turn after a reload", () => {
    const store = memoryStore();
    const first = mount({ store });
    startMatch(first.root);
    cellButton(first.root, 0, 0).click();
    cellButton(first.root, 6, 6).click();

    const second = mount({ store });

    expect(second.app.getScreen()).toBe("home");
    expect(second.app.getState().moveCount).toBe(2);
    expect(second.app.getState().currentPlayer).toBe(1);
    expect(button(second.root, "resume").disabled).toBe(false);
    expect(button(second.root, "resume").hidden).toBe(false);
    expect(orbsOn(second.root, 0, 0)).toBe(1);
    expect(orbsOn(second.root, 6, 6)).toBe(1);

    resumeMatch(second.root);
    expect(status(second.root)).toBe("Player 1 to move");
  });

  it("starts fresh when the save is corrupt", () => {
    const store = memoryStore();
    store.setItem(SAVE_KEY, "{ not json");

    const { root, app } = mount({ store });

    expect(app.getState().moveCount).toBe(0);
    expect(root.querySelectorAll("button.cell[data-orbs='0']")).toHaveLength(49);
    expect(store.getItem(SAVE_KEY)).toBeNull();
    expect(button(root, "resume").disabled).toBe(true);
    expect(button(root, "resume").hidden).toBe(true);
  });

  it("does not resume a finished saved game", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 0, 0, cell(1, 1));
    setCell(board, 0, 1, cell(2, 1));
    const finished = applyMove(
      makeState(board, { currentPlayer: 1 }),
      { row: 0, col: 0 },
    ).state;

    const { root, app } = mount({ seed: finished });

    expect(app.getScreen()).toBe("home");
    expect(button(root, "resume").disabled).toBe(true);
    expect(button(root, "resume").hidden).toBe(true);
    expect(saveNote(root)).toBe("Last game: Player 1 won.");

    startMatch(root);
    expect(app.getScreen()).toBe("game");
    expect(app.getState().moveCount).toBe(0);
    expect(overlay(root).hasAttribute("open")).toBe(false);
    expect(status(root)).toBe("Player 1 to move");
  });
});

describe("Bot opponent", () => {
  it("enables the Bot, forces its name, and summarises the match", () => {
    const { root, app, settingsStore } = mount();

    button(root, "settings").click();
    expect(botSwitch(root).checked).toBe(false);
    expect(playerNameInput(root, 2).disabled).toBe(false);

    setBot(root, true);

    expect(app.getSettings().bot).toBe(true);
    expect(app.getSettings().playerCount).toBe(2);
    expect(settingsStore.load().bot).toBe(true);
    expect(countButton(root, 2).getAttribute("aria-pressed")).toBe("true");

    const name = playerNameInput(root, 2);
    expect(name.value).toBe("Bot");
    expect(name.disabled).toBe(true);
    expect(name.getAttribute("aria-label")).toBe("Bot name");
    expect(playerColorInput(root, 2).getAttribute("aria-label")).toBe(
      "Bot colour",
    );
    expect(
      playerRow(root, 2).querySelector("[data-role='player-label']")
        ?.textContent,
    ).toBe("Bot");

    // Even a programmatic edit cannot rename the Bot.
    name.value = "Alice";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    expect(settingsStore.load().profiles[2].name).toBe("Player 2");
    expect(name.value).toBe("Bot");

    button(root, "settings-back").click();
    expect(saveNote(root)).toBe(
      "New game · 7 × 7 · 2 players · Bot (Medium)",
    );

    startMatch(root);
    expect(app.getState().botPlayer).toBe(2);
    expect(scoreName(root, 2)).toBe("Bot");
  });

  it("updates the difficulty badge and persists the choice", () => {
    const { root, settingsStore } = mount();

    button(root, "settings").click();
    difficultyButton(root, "hard").click();

    expect(settingsStore.load().difficulty).toBe("hard");
    expect(
      settingsRoot(root).querySelector("[data-role='difficulty-badge']")
        ?.textContent,
    ).toBe("Bot · Hard");
    expect(settingsRoot(root).querySelector("[data-role='bot-hint']")
      ?.textContent).toContain("last player");

    setBot(root, true);
    expect(settingsRoot(root).querySelector("[data-role='bot-hint']")
      ?.textContent).toContain("Player 2 is the Bot");

    button(root, "settings-back").click();
    expect(saveNote(root)).toContain("Bot (Hard)");
  });

  it("moves a solo board to two players when the Bot is enabled", () => {
    const { root, app, settingsStore } = mount({
      settings: { ...defaultSettings(), playerCount: 1 },
    });

    button(root, "settings").click();
    expect(countButton(root, 1).getAttribute("aria-pressed")).toBe("true");

    setBot(root, true);

    expect(app.getSettings().playerCount).toBe(2);
    expect(settingsStore.load().playerCount).toBe(2);
    expect(countButton(root, 2).getAttribute("aria-pressed")).toBe("true");
    expect(playerRow(root, 2).hidden).toBe(false);
  });

  it("turns the Bot off when the table drops to one player", () => {
    const { root, app, settingsStore } = mount({
      settings: { ...defaultSettings(), bot: true },
    });

    button(root, "settings").click();
    countButton(root, 1).click();

    expect(app.getSettings().bot).toBe(false);
    expect(app.getSettings().playerCount).toBe(1);
    expect(botSwitch(root).checked).toBe(false);
    expect(settingsStore.load().bot).toBe(false);
  });

  it("plays the Bot turn after the human move and locks the board", () => {
    vi.useFakeTimers();
    try {
      const { root, app, store } = mount({
        settings: { ...defaultSettings(), bot: true },
      });
      startMatch(root);

      cellButton(root, 0, 0).click();

      expect(app.getState().moveCount).toBe(1);
      expect(app.getState().currentPlayer).toBe(2);
      expect(status(root)).toBe("Bot is thinking…");
      expect(
        root.querySelectorAll("button.cell[tabindex='0']"),
      ).toHaveLength(0);

      // The Bot's move is ignored while it is thinking.
      cellButton(root, 0, 1).click();
      expect(app.getState().moveCount).toBe(1);

      vi.advanceTimersByTime(1000);

      expect(app.getState().moveCount).toBe(2);
      expect(app.getState().currentPlayer).toBe(1);
      expect(status(root)).toBe("Player 1 to move");
      expect(store.getItem(SAVE_KEY)).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("pauses the Bot while the game menu is open", () => {
    vi.useFakeTimers();
    try {
      const { root, app } = mount({
        settings: { ...defaultSettings(), bot: true },
      });
      startMatch(root);
      cellButton(root, 0, 0).click();
      expect(status(root)).toBe("Bot is thinking…");

      button(root, "menu").click();
      expect(overlayBody(root)).toBe("Bot is thinking…");

      // The queued move is paused while the dialog is open.
      vi.advanceTimersByTime(2000);
      expect(app.getState().moveCount).toBe(1);

      action(root, "Keep playing").click();
      vi.advanceTimersByTime(500);

      expect(app.getState().moveCount).toBe(2);
      expect(status(root)).toBe("Player 1 to move");
    } finally {
      vi.useRealTimers();
    }
  });

  it("resumes a saved Bot turn and lets the Bot move", () => {
    vi.useFakeTimers();
    try {
      const board = emptyBoard(7, 7);
      setCell(board, 2, 2, cell(1, 1));
      setCell(board, 2, 3, cell(2, 1));
      const saved = makeState(board, {
        currentPlayer: 2,
        botPlayer: 2,
      });
      const { root, app } = mount({ seed: saved });

      resumeMatch(root);

      expect(app.getState().botPlayer).toBe(2);
      expect(status(root)).toBe("Bot is thinking…");
      expect(scoreName(root, 2)).toBe("Bot");

      vi.advanceTimersByTime(500);

      expect(app.getState().moveCount).toBe(saved.moveCount + 1);
      expect(app.getState().currentPlayer).toBe(1);
      expect(status(root)).toBe("Player 1 to move");
    } finally {
      vi.useRealTimers();
    }
  });
});
