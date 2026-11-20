import { describe, expect, it } from "vitest";
import {
  applyMove,
  createGame,
  isLegalMove,
  legalMoves,
} from "../../src/engine/index.js";
import { cell, emptyBoard, makeState } from "./helpers.js";

describe("grow-only mode", () => {
  it("is off by default in the engine factory but can be requested", () => {
    expect(createGame().growOnly).toBe(false);
    expect(createGame(7, 7, 2, null, true).growOnly).toBe(true);
  });

  it("allows the first move on any empty cell", () => {
    const board = emptyBoard(7, 7);
    const state = makeState(board, {
      growOnly: true,
      currentPlayer: 1,
      hasPlayed: { 1: false, 2: false },
    });

    expect(isLegalMove(state, { row: 0, col: 6 })).toBe(true);
    expect(applyMove(state, { row: 0, col: 6 }).accepted).toBe(true);
  });

  it("allows only owned cells after the first move", () => {
    const board = emptyBoard(7, 7);
    board[3]![3] = cell(1, 2);
    board[0]![0] = cell(2, 1);
    const state = makeState(board, {
      growOnly: true,
      currentPlayer: 1,
      hasPlayed: { 1: true, 2: true },
    });

    expect(isLegalMove(state, { row: 3, col: 3 })).toBe(true);
    expect(isLegalMove(state, { row: 4, col: 4 })).toBe(false);
    expect(isLegalMove(state, { row: 0, col: 0 })).toBe(false);
    expect(legalMoves(state)).toEqual([{ row: 3, col: 3 }]);

    expect(applyMove(state, { row: 4, col: 4 }).accepted).toBe(false);
    expect(applyMove(state, { row: 0, col: 0 }).accepted).toBe(false);
    expect(applyMove(state, { row: 3, col: 3 }).accepted).toBe(true);
  });

  it("gives a wiped-out player one free placement", () => {
    const board = emptyBoard(7, 7);
    const state = makeState(board, {
      growOnly: true,
      currentPlayer: 1,
      hasPlayed: { 1: true, 2: true },
    });

    expect(isLegalMove(state, { row: 2, col: 2 })).toBe(true);
    expect(applyMove(state, { row: 2, col: 2 }).accepted).toBe(true);
  });

  it("allows placing anywhere again when the switch is off", () => {
    const board = emptyBoard(7, 7);
    board[3]![3] = cell(1, 2);
    const state = makeState(board, {
      growOnly: false,
      currentPlayer: 1,
      hasPlayed: { 1: true, 2: true },
    });

    expect(isLegalMove(state, { row: 6, col: 6 })).toBe(true);
    expect(isLegalMove(state, { row: 3, col: 3 })).toBe(true);
    expect(legalMoves(state)).toHaveLength(49);
  });

  it("keeps the rule through a move and a cloned state", () => {
    const board = emptyBoard(7, 7);
    board[3]![3] = cell(1, 1);
    const before = makeState(board, {
      growOnly: true,
      currentPlayer: 1,
      hasPlayed: { 1: true, 2: true },
    });

    const result = applyMove(before, { row: 3, col: 3 });
    expect(result.state.growOnly).toBe(true);
    expect(before.growOnly).toBe(true);
  });
});
