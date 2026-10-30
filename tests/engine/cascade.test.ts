import { describe, expect, it } from "vitest";
import {
  applyMove,
  countOrbs,
  getCell,
  isStable,
  setCell,
} from "../../src/engine/index.js";
import { cell, emptyBoard, makeState } from "./helpers.js";

describe("detonations", () => {
  it("clears a corner and spreads to its two neighbours", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 0, 0, cell(1, 1));

    const result = applyMove(makeState(board), { row: 0, col: 0 });

    expect(getCell(result.state.board, 0, 0)).toBeNull();
    expect(getCell(result.state.board, 0, 1)).toEqual({ owner: 1, orbs: 1 });
    expect(getCell(result.state.board, 1, 0)).toEqual({ owner: 1, orbs: 1 });
    expect(countOrbs(result.state.board, 1)).toBe(2);
    expect(result.events.filter((event) => event.type === "explode")).toHaveLength(1);
    expect(result.events.filter((event) => event.type === "transfer")).toHaveLength(2);
  });

  it("spreads an edge cell to three neighbours", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 0, 3, cell(1, 2));

    const result = applyMove(makeState(board), { row: 0, col: 3 });

    expect(getCell(result.state.board, 0, 3)).toBeNull();
    for (const target of [
      { row: 0, col: 2 },
      { row: 0, col: 4 },
      { row: 1, col: 3 },
    ]) {
      expect(getCell(result.state.board, target.row, target.col)).toEqual({
        owner: 1,
        orbs: 1,
      });
    }
    expect(result.events.filter((event) => event.type === "transfer")).toHaveLength(3);
  });

  it("spreads an interior cell to four neighbours", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 3, 3, cell(1, 3));

    const result = applyMove(makeState(board), { row: 3, col: 3 });

    expect(getCell(result.state.board, 3, 3)).toBeNull();
    for (const target of [
      { row: 2, col: 3 },
      { row: 3, col: 4 },
      { row: 4, col: 3 },
      { row: 3, col: 2 },
    ]) {
      expect(getCell(result.state.board, target.row, target.col)).toEqual({
        owner: 1,
        orbs: 1,
      });
    }
    expect(result.events.filter((event) => event.type === "transfer")).toHaveLength(4);
  });
});

describe("capture and chains", () => {
  it("captures enemy orbs and adds one", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 0, 0, cell(1, 1));
    setCell(board, 0, 1, cell(2, 1));
    setCell(board, 6, 6, cell(2, 1));

    const result = applyMove(makeState(board), { row: 0, col: 0 });

    expect(getCell(result.state.board, 0, 1)).toEqual({ owner: 1, orbs: 2 });
    const transfer = result.events.find(
      (event) =>
        event.type === "transfer" &&
        event.to.row === 0 &&
        event.to.col === 1,
    );
    expect(transfer).toMatchObject({ captured: true, player: 1 });
    expect(result.state.gameOver).toBe(false);
  });

  it("chains when a neighbour reaches capacity", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 3, 3, cell(1, 3));
    setCell(board, 3, 4, cell(1, 3));

    const result = applyMove(makeState(board), { row: 3, col: 3 });

    expect(result.state.cascadeLimitReached).toBe(false);
    expect(result.events.filter((event) => event.type === "explode")).toHaveLength(2);
    expect(getCell(result.state.board, 3, 4)).toBeNull();
    expect(getCell(result.state.board, 3, 3)).toEqual({ owner: 1, orbs: 1 });
    expect(countOrbs(result.state.board, 1)).toBe(7);
    expect(isStable(result.state.board, 7, 7)).toBe(true);
  });

  it("never leaves an unstable cell after a normal move", () => {
    const cases = [
      { label: "corner at capacity", at: { row: 0, col: 0 }, orbs: 1 },
      { label: "edge at capacity", at: { row: 0, col: 3 }, orbs: 2 },
      { label: "interior at capacity", at: { row: 3, col: 3 }, orbs: 3 },
    ];

    for (const testCase of cases) {
      const board = emptyBoard(7, 7);
      setCell(board, testCase.at.row, testCase.at.col, cell(1, testCase.orbs));
      setCell(board, 6, 6, cell(2, 1));

      const result = applyMove(makeState(board), testCase.at);

      expect(result.accepted, testCase.label).toBe(true);
      expect(result.state.gameOver, testCase.label).toBe(false);
      expect(isStable(result.state.board, 7, 7), testCase.label).toBe(true);
    }
  });
});
