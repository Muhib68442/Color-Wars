import { describe, expect, it } from "vitest";
import {
  applyMove,
  createGame,
  getCell,
  isLegalMove,
  legalMoves,
  setCell,
} from "../../src/engine/index.js";
import { cell, emptyBoard, makeState } from "./helpers.js";

describe("createGame", () => {
  it("starts with an empty 7x7 board and Player 1 to move", () => {
    const state = createGame();

    expect(state.rows).toBe(7);
    expect(state.cols).toBe(7);
    expect(state.playerCount).toBe(2);
    expect(state.currentPlayer).toBe(1);
    expect(state.gameOver).toBe(false);
    expect(state.board.flat().every((value) => value === null)).toBe(true);
  });

  it("creates a custom square grid with the requested player count", () => {
    const state = createGame(11, 11, 4);

    expect(state.rows).toBe(11);
    expect(state.cols).toBe(11);
    expect(state.playerCount).toBe(4);
    expect(state.board).toHaveLength(11);
    expect(state.board[0]).toHaveLength(11);
  });
});

describe("turns", () => {
  it("cycles through three and four players in order", () => {
    let three = createGame(7, 7, 3);
    three = applyMove(three, { row: 0, col: 0 }).state;
    expect(three.currentPlayer).toBe(2);

    three = applyMove(three, { row: 0, col: 1 }).state;
    expect(three.currentPlayer).toBe(3);

    three = applyMove(three, { row: 0, col: 2 }).state;
    expect(three.currentPlayer).toBe(1);

    let four = createGame(7, 7, 4);
    const expected = [2, 3, 4, 1];
    for (let turn = 0; turn < expected.length; turn += 1) {
      four = applyMove(four, { row: 0, col: turn }).state;
      expect(four.currentPlayer).toBe(expected[turn]);
    }
  });

  it("skips an eliminated player", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 0, 0, cell(1, 1));
    setCell(board, 6, 6, cell(3, 1));
    setCell(board, 6, 0, cell(4, 1));
    const state = makeState(board, {
      currentPlayer: 1,
      playerCount: 4,
      hasPlayed: { 1: true, 2: true, 3: true, 4: true },
    });

    const result = applyMove(state, { row: 0, col: 0 });

    expect(result.state.currentPlayer).toBe(3);
  });
});

describe("move legality", () => {
  it("allows empty cells and the current player's cells only", () => {
    const board = emptyBoard(3, 3);
    setCell(board, 1, 1, cell(1, 1));
    setCell(board, 0, 0, cell(2, 1));
    const state = makeState(board, { currentPlayer: 1 });

    expect(isLegalMove(state, { row: 2, col: 2 })).toBe(true);
    expect(isLegalMove(state, { row: 1, col: 1 })).toBe(true);
    expect(isLegalMove(state, { row: 0, col: 0 })).toBe(false);
    expect(isLegalMove(state, { row: -1, col: 0 })).toBe(false);
    expect(isLegalMove(state, { row: 0, col: 3 })).toBe(false);
  });

  it("rejects everything after game over", () => {
    const state = makeState(emptyBoard(3, 3), { gameOver: true });

    expect(isLegalMove(state, { row: 0, col: 0 })).toBe(false);
    expect(legalMoves(state)).toEqual([]);
  });

  it("lists every legal target", () => {
    let state = createGame();
    expect(legalMoves(state)).toHaveLength(49);

    state = applyMove(state, { row: 0, col: 0 }).state;
    expect(legalMoves(state)).toHaveLength(48);

    state = applyMove(state, { row: 6, col: 6 }).state;
    expect(legalMoves(state)).toHaveLength(48);
  });
});

describe("applyMove", () => {
  it("places an orb, switches turn, and emits a place event", () => {
    const state = createGame();
    const result = applyMove(state, { row: 3, col: 3 });

    expect(result.accepted).toBe(true);
    expect(getCell(result.state.board, 3, 3)).toEqual({ owner: 1, orbs: 1 });
    expect(result.state.currentPlayer).toBe(2);
    expect(result.events[0]).toEqual({
      type: "place",
      at: { row: 3, col: 3 },
      player: 1,
    });
    expect(getCell(state.board, 3, 3)).toBeNull();
  });

  it("adds an orb to an owned cell", () => {
    const board = emptyBoard(3, 3);
    setCell(board, 1, 1, cell(1, 1));
    setCell(board, 0, 2, cell(2, 1));
    const state = makeState(board, { currentPlayer: 1 });

    const result = applyMove(state, { row: 1, col: 1 });

    expect(getCell(result.state.board, 1, 1)).toEqual({ owner: 1, orbs: 2 });
    expect(result.events[0]).toMatchObject({ type: "add", orbs: 2 });
    expect(result.state.currentPlayer).toBe(2);
  });

  it("allows a new placement after the opening moves", () => {
    let state = createGame();
    state = applyMove(state, { row: 0, col: 0 }).state;
    state = applyMove(state, { row: 6, col: 6 }).state;

    const result = applyMove(state, { row: 3, col: 3 });

    expect(result.accepted).toBe(true);
    expect(getCell(result.state.board, 3, 3)).toEqual({ owner: 1, orbs: 1 });
  });

  it("rejects an enemy cell without changing anything", () => {
    const board = emptyBoard(3, 3);
    setCell(board, 0, 0, cell(2, 1));
    const state = makeState(board, { currentPlayer: 1 });
    const snapshot = JSON.stringify(state);

    const result = applyMove(state, { row: 0, col: 0 });

    expect(result.accepted).toBe(false);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("is deterministic", () => {
    const state = createGame();

    const first = applyMove(state, { row: 3, col: 3 });
    const second = applyMove(state, { row: 3, col: 3 });

    expect(first).toEqual(second);
  });
});
