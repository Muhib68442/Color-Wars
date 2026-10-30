import { describe, expect, it } from "vitest";
import {
  capacityAt,
  countCells,
  countOrbs,
  createBoard,
  getCell,
  inBounds,
  isStable,
  neighbors,
  other,
  setCell,
} from "../../src/engine/index.js";
import { cell, emptyBoard } from "./helpers.js";

describe("capacityAt", () => {
  it("uses 2 for corners, 3 for edges, and 4 for the interior", () => {
    expect(capacityAt(7, 7, 0, 0)).toBe(2);
    expect(capacityAt(7, 7, 6, 6)).toBe(2);
    expect(capacityAt(7, 7, 0, 3)).toBe(3);
    expect(capacityAt(7, 7, 3, 0)).toBe(3);
    expect(capacityAt(7, 7, 3, 3)).toBe(4);
  });

  it("returns 0 outside the board", () => {
    expect(capacityAt(7, 7, -1, 0)).toBe(0);
    expect(capacityAt(7, 7, 0, 7)).toBe(0);
  });
});

describe("neighbors", () => {
  it("matches the capacity of each position", () => {
    expect(neighbors(7, 7, 0, 0)).toHaveLength(2);
    expect(neighbors(7, 7, 0, 3)).toHaveLength(3);
    expect(neighbors(7, 7, 3, 3)).toHaveLength(4);
  });
});

describe("createBoard", () => {
  it("creates a rows x cols board of empty cells", () => {
    const board = createBoard(7, 7);
    expect(board).toHaveLength(7);
    expect(board.every((row) => row.length === 7)).toBe(true);
    expect(board.flat().every((value) => value === null)).toBe(true);
  });

  it("rejects degenerate dimensions", () => {
    expect(() => createBoard(1, 7)).toThrow(RangeError);
    expect(() => createBoard(7, 0)).toThrow(RangeError);
    expect(() => createBoard(7.5, 7)).toThrow(RangeError);
  });
});

describe("board helpers", () => {
  it("reads and writes cells safely", () => {
    const board = emptyBoard(3, 3);
    setCell(board, 1, 1, cell(2, 3));

    expect(getCell(board, 1, 1)).toEqual({ owner: 2, orbs: 3 });
    expect(getCell(board, -1, 1)).toBeNull();
    expect(getCell(board, 3, 3)).toBeNull();
    expect(inBounds(board, 2, 2)).toBe(true);
    expect(inBounds(board, 3, 0)).toBe(false);
  });

  it("counts orbs and cells per player", () => {
    const board = emptyBoard(3, 3);
    setCell(board, 0, 0, cell(1, 2));
    setCell(board, 1, 1, cell(1, 3));
    setCell(board, 2, 2, cell(2, 1));

    expect(countOrbs(board, 1)).toBe(5);
    expect(countCells(board, 1)).toBe(2);
    expect(countOrbs(board, 2)).toBe(1);
    expect(countCells(board, 2)).toBe(1);
  });

  it("detects unstable cells", () => {
    const stable = emptyBoard(7, 7);
    setCell(stable, 0, 0, cell(1, 1));
    expect(isStable(stable, 7, 7)).toBe(true);

    const unstable = emptyBoard(7, 7);
    setCell(unstable, 0, 0, cell(1, 2));
    expect(isStable(unstable, 7, 7)).toBe(false);
  });

  it("swaps players", () => {
    expect(other(1)).toBe(2);
    expect(other(2)).toBe(1);
  });
});
