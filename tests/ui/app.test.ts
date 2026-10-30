// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  applyMove,
  createGame,
  setCell,
} from "../../src/engine/index.js";
import { cell, emptyBoard, makeState } from "../engine/helpers.js";
import {
  createStorage,
  memoryStore,
  SAVE_KEY,
  type KeyValueStore,
} from "../../src/platform/storage.js";
import { createApp } from "../../src/ui/app.js";
import type { GameState } from "../../src/engine/types.js";

function mount(seed?: GameState) {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.getElementById("app");
  if (root === null) throw new Error("Missing #app");

  const store: KeyValueStore = memoryStore();
  const storage = createStorage(store);
  if (seed !== undefined) storage.save(seed);

  const app = createApp(root, { storage });
  return { root, app, store, storage };
}

function button(root: HTMLElement, action: string): HTMLButtonElement {
  const element = root.querySelector<HTMLButtonElement>(
    `[data-action='${action}']`,
  );
  if (element === null) throw new Error(`Missing button: ${action}`);
  return element;
}

function startMatch(root: HTMLElement): void {
  button(root, "play").click();
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

function screenIs(root: HTMLElement, name: "home" | "game" | "info"): boolean {
  const screen = root.querySelector<HTMLElement>(`[data-role='${name}']`);
  return screen !== null && !screen.hidden;
}

describe("home screen", () => {
  it("boots on the home screen with logo, title, and actions", () => {
    const { root, app } = mount();

    expect(app.getScreen()).toBe("home");
    expect(screenIs(root, "home")).toBe(true);
    expect(screenIs(root, "game")).toBe(false);
    expect(screenIs(root, "info")).toBe(false);
    expect(root.querySelector(".home__logo svg")).not.toBeNull();
    expect(root.querySelector(".home__title")?.textContent).toBe("Color Wars");
    expect(button(root, "play").textContent).toBe("Play");
    expect(button(root, "new-game").hidden).toBe(true);
    expect(root.querySelector("[data-role='save-note']")?.textContent).toBe("");
  });

  it("opens the match when Play is pressed", () => {
    const { root, app } = mount();

    startMatch(root);

    expect(app.getScreen()).toBe("game");
    expect(screenIs(root, "game")).toBe(true);
    expect(screenIs(root, "home")).toBe(false);
    expect(status(root)).toBe("Player 1 to move");
  });

  it("shows Continue and a saved-game note when a save exists", () => {
    const saved = applyMove(createGame(), { row: 0, col: 0 }).state;
    const { root } = mount(saved);

    expect(button(root, "play").textContent).toBe("Continue");
    expect(button(root, "new-game").hidden).toBe(false);
    expect(root.querySelector("[data-role='save-note']")?.textContent).toContain(
      "Saved game",
    );

    startMatch(root);
    expect(status(root)).toBe("Player 2 to move");
  });

  it("starts a fresh match when New game is pressed", () => {
    const saved = applyMove(createGame(), { row: 0, col: 0 }).state;
    const { root, app } = mount(saved);

    button(root, "new-game").click();

    expect(app.getScreen()).toBe("game");
    expect(app.getState().moveCount).toBe(0);
    expect(status(root)).toBe("Player 1 to move");
  });
});

describe("how to play", () => {
  it("opens from home and returns home", () => {
    const { root, app } = mount();

    button(root, "how-to").click();

    expect(app.getScreen()).toBe("info");
    expect(screenIs(root, "info")).toBe(true);
    expect(
      root.querySelector("#info-title")?.textContent,
    ).toBe("How to play");

    button(root, "info-back").click();
    expect(app.getScreen()).toBe("home");
  });

  it("opens from the game menu and returns to the match", () => {
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

    const order = Array.from(
      root.querySelectorAll<HTMLElement>(".score, .board"),
    ).map((element) => element.dataset.player ?? "board");

    expect(order).toEqual(["2", "board", "1"]);
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
  it("places a coin on an empty cell and swaps the turn", () => {
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
});

describe("winning", () => {
  it("shows a result overlay and locks the board", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 0, 0, cell(1, 1));
    setCell(board, 0, 1, cell(2, 1));
    const seed = makeState(board, { currentPlayer: 1 });

    const { root, app } = mount(seed);
    startMatch(root);
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

  it("returns home from the result dialog", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 0, 0, cell(1, 1));
    setCell(board, 0, 1, cell(2, 1));
    const seed = makeState(board, { currentPlayer: 1 });

    const { root, app } = mount(seed);
    startMatch(root);
    cellButton(root, 0, 0).click();

    action(root, "Back to home").click();

    expect(app.getScreen()).toBe("home");
    expect(button(root, "play").textContent).toBe("Play again");
    expect(root.querySelector("[data-role='save-note']")?.textContent).toBe(
      "Last game: Player 1 won.",
    );
  });
});

describe("game menu", () => {
  it("asks before discarding a game in progress", () => {
    const { root, app } = mount();
    startMatch(root);
    cellButton(root, 0, 0).click();

    button(root, "menu").click();
    action(root, "Restart match").click();

    expect(overlay(root).hasAttribute("open")).toBe(true);
    expect(overlayTitle(root)).toBe("Start over?");

    action(root, "Keep playing").click();
    expect(overlay(root).hasAttribute("open")).toBe(false);
    expect(app.getState().moveCount).toBe(1);

    button(root, "menu").click();
    action(root, "Restart match").click();
    action(root, "Start over").click();

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
    expect(button(root, "play").textContent).toBe("Continue");
    expect(app.getState().moveCount).toBe(1);
  });
});

describe("save and resume", () => {
  it("restores the board and turn after a reload", () => {
    const { root, store } = mount();
    startMatch(root);
    cellButton(root, 0, 0).click();
    cellButton(root, 6, 6).click();

    document.body.innerHTML = '<div id="app"></div>';
    const nextRoot = document.getElementById("app");
    if (nextRoot === null) throw new Error("Missing #app");
    const app = createApp(nextRoot, { storage: createStorage(store) });

    expect(app.getScreen()).toBe("home");
    expect(app.getState().moveCount).toBe(2);
    expect(app.getState().currentPlayer).toBe(1);
    expect(orbsOn(nextRoot, 0, 0)).toBe(1);
    expect(orbsOn(nextRoot, 6, 6)).toBe(1);

    startMatch(nextRoot);
    expect(status(nextRoot)).toBe("Player 1 to move");
  });

  it("starts fresh when the save is corrupt", () => {
    const store = memoryStore();
    store.setItem(SAVE_KEY, "{ not json");

    document.body.innerHTML = '<div id="app"></div>';
    const root = document.getElementById("app");
    if (root === null) throw new Error("Missing #app");
    const app = createApp(root, { storage: createStorage(store) });

    expect(app.getState().moveCount).toBe(0);
    expect(root.querySelectorAll("button.cell[data-orbs='0']")).toHaveLength(49);
    expect(store.getItem(SAVE_KEY)).toBeNull();
  });

  it("offers a replay for a finished saved game", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 0, 0, cell(1, 1));
    setCell(board, 0, 1, cell(2, 1));
    const finished = applyMove(
      makeState(board, { currentPlayer: 1 }),
      { row: 0, col: 0 },
    ).state;

    const { root, app } = mount(finished);

    expect(app.getScreen()).toBe("home");
    expect(button(root, "play").textContent).toBe("Play again");
    expect(root.querySelector("[data-role='save-note']")?.textContent).toBe(
      "Last game: Player 1 won.",
    );

    startMatch(root);
    expect(app.getScreen()).toBe("game");
    expect(app.getState().moveCount).toBe(0);
    expect(overlay(root).hasAttribute("open")).toBe(false);
  });
});
