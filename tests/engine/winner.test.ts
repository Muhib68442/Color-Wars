import { describe, expect, it } from "vitest";
import {
  applyMove,
  createGame,
  setCell,
} from "../../src/engine/index.js";
import { cell, emptyBoard, makeState } from "./helpers.js";

describe("win detection", () => {
  it("does not declare a winner before both players have moved", () => {
    const result = applyMove(createGame(), { row: 0, col: 0 });

    expect(result.state.gameOver).toBe(false);
    expect(result.state.winner).toBeNull();
  });

  it("declares the opponent when a player's last orb is captured", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 0, 0, cell(1, 1));
    setCell(board, 0, 1, cell(2, 1));

    const result = applyMove(makeState(board), { row: 0, col: 0 });

    expect(result.state.gameOver).toBe(true);
    expect(result.state.winner).toBe(1);
    expect(result.state.currentPlayer).toBe(1);
    expect(
      result.events.some(
        (event) => event.type === "win" && event.winner === 1,
      ),
    ).toBe(true);
  });

  it("locks input after the game ends", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 0, 0, cell(1, 1));
    setCell(board, 0, 1, cell(2, 1));
    const finished = applyMove(makeState(board), { row: 0, col: 0 });

    const blocked = applyMove(finished.state, { row: 6, col: 6 });

    expect(blocked.accepted).toBe(false);
    expect(blocked.state).toBe(finished.state);
    expect(blocked.events).toEqual([]);
  });

  it("caps a pathological cascade and ends in a draw", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 3, 3, cell(1, 3));
    setCell(board, 3, 4, cell(1, 3));

    const result = applyMove(
      makeState(board),
      { row: 3, col: 3 },
      { maxCascadeSteps: 1 },
    );

    expect(result.accepted).toBe(true);
    expect(result.state.cascadeLimitReached).toBe(true);
    expect(result.state.gameOver).toBe(true);
    expect(result.state.winner).toBeNull();
    expect(
      result.events.some((event) => event.type === "cascade-limit"),
    ).toBe(true);
  });

  it("eliminates two opponents in one cascade and declares the survivor", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 0, 0, cell(1, 1));
    setCell(board, 0, 1, cell(2, 1));
    setCell(board, 1, 0, cell(3, 1));
    const state = makeState(board, { currentPlayer: 1, playerCount: 3 });

    const result = applyMove(state, { row: 0, col: 0 });

    expect(result.state.gameOver).toBe(true);
    expect(result.state.winner).toBe(1);
    expect(result.state.currentPlayer).toBe(1);
    expect(
      result.events.some(
        (event) => event.type === "win" && event.winner === 1,
      ),
    ).toBe(true);
  });

  it("keeps playing while more than one player still has orbs", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 0, 0, cell(1, 1));
    setCell(board, 0, 1, cell(2, 1));
    setCell(board, 6, 6, cell(3, 1));
    const state = makeState(board, { currentPlayer: 1, playerCount: 3 });

    const result = applyMove(state, { row: 0, col: 0 });

    expect(result.state.gameOver).toBe(false);
    expect(result.state.winner).toBeNull();
    expect(result.state.currentPlayer).toBe(3);
  });

  it("treats solo mode as a never-ending practice board", () => {
    let state = createGame(7, 7, 1);
    expect(state.playerCount).toBe(1);

    for (let turn = 0; turn < 24; turn += 1) {
      const result = applyMove(state, { row: 0, col: 0 });
      expect(result.accepted).toBe(true);
      expect(result.state.gameOver).toBe(false);
      expect(result.state.winner).toBeNull();
      expect(result.state.currentPlayer).toBe(1);
      state = result.state;
    }
  });
});
