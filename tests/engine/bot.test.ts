import { describe, expect, it } from "vitest";
import {
  applyMove,
  chooseBotMove,
  createGame,
  getCell,
  isLegalMove,
  setCell,
  type GameState,
  type Player,
} from "../../src/engine/index.js";
import { cell, emptyBoard, makeState } from "./helpers.js";

function gameWith(
  setup: (board: ReturnType<typeof emptyBoard>) => void,
  options: Parameters<typeof makeState>[1] = {},
): GameState {
  const board = emptyBoard(7, 7);
  setup(board);
  return makeState(board, options);
}

function orbsOf(state: GameState, player: Player): number {
  let total = 0;
  for (const row of state.board) {
    for (const entry of row) {
      if (entry !== null && entry.owner === player) total += entry.orbs;
    }
  }
  return total;
}

describe("bot seats", () => {
  it("defaults to a hot-seat match with no Bot", () => {
    expect(createGame().botPlayer).toBeNull();
  });

  it("places the Bot in the highest-numbered seat", () => {
    expect(createGame(7, 7, 2, 2).botPlayer).toBe(2);
    expect(createGame(7, 7, 3, 3).botPlayer).toBe(3);
    expect(createGame(7, 7, 4, 4).botPlayer).toBe(4);
  });

  it("rejects a Bot in player 1, in a solo game, or beyond the table", () => {
    expect(createGame(7, 7, 1, 1).botPlayer).toBeNull();
    expect(createGame(7, 7, 2, 1).botPlayer).toBeNull();
    expect(createGame(7, 7, 2, 3).botPlayer).toBeNull();
  });
});

describe("easy Bot", () => {
  it("returns a legal move", () => {
    const state = createGame();
    const move = chooseBotMove(state, { difficulty: "easy", random: () => 0.5 });

    expect(move).not.toBeNull();
    expect(isLegalMove(state, move!)).toBe(true);
  });

  it("selects randomly from every legal move", () => {
    const state = createGame();
    const first = chooseBotMove(state, { difficulty: "easy", random: () => 0 });
    const last = chooseBotMove(state, { difficulty: "easy", random: () => 0.999 });

    expect(first).toEqual({ row: 0, col: 0 });
    expect(last).toEqual({ row: 6, col: 6 });
  });

  it("has no move when the board offers none", () => {
    const state = gameWith(
      (board) => {
        for (let row = 0; row < 7; row += 1) {
          for (let col = 0; col < 7; col += 1) {
            setCell(board, row, col, cell(2, 1));
          }
        }
      },
      { currentPlayer: 1 },
    );

    expect(chooseBotMove(state, { difficulty: "easy" })).toBeNull();
  });

  it("never plays after the game is over", () => {
    const state = createGame();
    const finished = { ...state, gameOver: true, winner: 1 as Player };

    for (const difficulty of ["easy", "medium", "hard"] as const) {
      expect(chooseBotMove(finished, { difficulty })).toBeNull();
    }
  });
});

describe("scored Bot difficulties", () => {
  /** Player 1 can pop a corner orb into player 2's only orb and win. */
  function immediateWin(): GameState {
    return gameWith((board) => {
      setCell(board, 0, 0, cell(1, 1));
      setCell(board, 0, 1, cell(2, 1));
    });
  }

  it("medium takes an immediate win", () => {
    const state = immediateWin();
    const move = chooseBotMove(state, { difficulty: "medium", random: () => 0 });

    expect(move).toEqual({ row: 0, col: 0 });
    const result = applyMove(state, move!);
    expect(result.state.gameOver).toBe(true);
    expect(result.state.winner).toBe(1);
  });

  it("hard takes an immediate win", () => {
    const state = immediateWin();
    const move = chooseBotMove(state, { difficulty: "hard", random: () => 0 });

    expect(move).toEqual({ row: 0, col: 0 });
    const result = applyMove(state, move!);
    expect(result.state.gameOver).toBe(true);
    expect(result.state.winner).toBe(1);
  });

  /**
   * Player 1 has two tempting detonations:
   * - (3,4) captures a large rival cell but leaves player 2's corner orb armed
   *   next to player 1's stack at (0,1).
   * - (0,1) removes that armed corner immediately.
   * Medium prefers the bigger capture; hard should defuse the threat.
   */
  function threatPosition(): GameState {
    return gameWith((board) => {
      setCell(board, 0, 0, cell(2, 1));
      setCell(board, 0, 1, cell(1, 2));
      setCell(board, 3, 3, cell(2, 2));
      setCell(board, 3, 4, cell(1, 3));
      setCell(board, 5, 5, cell(2, 1));
    });
  }

  it("medium walks into the reply that hard avoids", () => {
    const state = threatPosition();

    const medium = chooseBotMove(state, { difficulty: "medium", random: () => 0 });
    const hard = chooseBotMove(state, { difficulty: "hard", random: () => 0 });

    expect(medium).toEqual({ row: 3, col: 4 });
    expect(hard).toEqual({ row: 0, col: 1 });
  });

  it("hard keeps more orbs after the opponent's best immediate reply", () => {
    const state = threatPosition();

    const medium = chooseBotMove(state, { difficulty: "medium", random: () => 0 });
    const hard = chooseBotMove(state, { difficulty: "hard", random: () => 0 });

    const afterMedium = applyMove(state, medium!).state;
    const mediumReply = applyMove(afterMedium, { row: 0, col: 0 }).state;

    const afterHard = applyMove(state, hard!).state;
    // After defusing (0,0), the only armed rival orb is the far corner.
    const hardReply = applyMove(afterHard, { row: 5, col: 5 }).state;

    expect(orbsOf(hardReply, 1)).toBeGreaterThan(orbsOf(mediumReply, 1));
    // Hard's move removed the armed corner that Medium left in place.
    expect(getCell(afterMedium.board, 0, 0)?.owner).toBe(2);
    expect(getCell(afterHard.board, 0, 0)?.owner).not.toBe(2);
  });
});
