import { describe, expect, it } from "vitest";
import { applyMove, createGame, setCell } from "../../src/engine/index.js";
import {
  createStorage,
  isGameState,
  memoryStore,
  parseSave,
  SAVE_KEY,
  SAVE_VERSION,
} from "../../src/platform/storage.js";
import { cell, emptyBoard, makeState } from "../engine/helpers.js";

function startedGame() {
  return applyMove(createGame(), { row: 3, col: 3 }).state;
}

describe("save schema", () => {
  it("accepts a real game state", () => {
    expect(isGameState(startedGame())).toBe(true);
  });

  it("rejects unstable, malformed, and out-of-range boards", () => {
    const unstable = emptyBoard(7, 7);
    setCell(unstable, 0, 0, cell(1, 2));
    expect(isGameState(makeState(unstable))).toBe(false);

    const wrongSize = emptyBoard(6, 7);
    expect(isGameState(makeState(wrongSize))).toBe(false);

    const badOwner = emptyBoard(7, 7);
    setCell(badOwner, 1, 1, { owner: 3, orbs: 1 } as never);
    expect(isGameState(makeState(badOwner))).toBe(false);

    expect(isGameState(null)).toBe(false);
    expect(isGameState("nope")).toBe(false);
  });

  it("rejects older save versions", () => {
    const payload = JSON.stringify({
      version: SAVE_VERSION + 1,
      savedAt: 0,
      state: startedGame(),
    });

    expect(parseSave(payload)).toBeNull();
  });
});

describe("storage adapter", () => {
  it("round-trips a game", () => {
    const store = memoryStore();
    const storage = createStorage(store);
    const state = applyMove(startedGame(), { row: 2, col: 2 }).state;

    storage.save(state);

    expect(storage.load()).toEqual(state);
  });

  it("clears the save", () => {
    const store = memoryStore();
    const storage = createStorage(store);
    storage.save(startedGame());

    storage.clear();

    expect(store.getItem(SAVE_KEY)).toBeNull();
    expect(storage.load()).toBeNull();
  });

  it("drops a corrupt save instead of returning it", () => {
    const store = memoryStore();
    store.setItem(SAVE_KEY, "{oops");
    const storage = createStorage(store);

    expect(storage.load()).toBeNull();
    expect(store.getItem(SAVE_KEY)).toBeNull();
  });

  it("refuses to persist an unstable board", () => {
    const store = memoryStore();
    const storage = createStorage(store);
    const unstable = emptyBoard(7, 7);
    setCell(unstable, 0, 0, cell(1, 2));

    storage.save(makeState(unstable));

    expect(store.getItem(SAVE_KEY)).toBeNull();
  });

  it("survives a store that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    const storage = createStorage(broken);

    expect(() => storage.save(startedGame())).not.toThrow();
    expect(storage.load()).toBeNull();
    expect(() => storage.clear()).not.toThrow();
  });
});
