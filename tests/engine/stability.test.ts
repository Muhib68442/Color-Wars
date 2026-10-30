import { describe, expect, it } from "vitest";
import {
  applyMove,
  createGame,
  isStable,
  legalMoves,
} from "../../src/engine/index.js";
import type { GameState } from "../../src/engine/types.js";

function makeRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function assertBoardInvariants(state: GameState): void {
  for (const row of state.board) {
    for (const cell of row) {
      if (cell === null) continue;
      if (cell.owner !== 1 && cell.owner !== 2) {
        throw new Error(`Invalid owner: ${String(cell.owner)}`);
      }
      if (!Number.isInteger(cell.orbs) || cell.orbs < 1) {
        throw new Error(`Invalid orb count: ${String(cell.orbs)}`);
      }
    }
  }

  if (!state.cascadeLimitReached && !isStable(state.board, state.rows, state.cols)) {
    throw new Error("Board is unstable after a completed move");
  }
}

describe("stability", () => {
  it("keeps invariants across deterministic random games", () => {
    const random = makeRandom(20261030);
    const games = 20;
    const maxTurns = 250;

    for (let game = 0; game < games; game += 1) {
      let state = createGame();

      for (let turn = 0; turn < maxTurns && !state.gameOver; turn += 1) {
        const moves = legalMoves(state);
        expect(moves.length).toBeGreaterThan(0);

        const index = Math.floor(random() * moves.length);
        const move = moves[index];
        if (move === undefined) throw new Error("Legal move lookup failed");

        const previousPlayer = state.currentPlayer;
        const result = applyMove(state, move);

        expect(result.accepted).toBe(true);
        expect(result.state.moveCount).toBe(state.moveCount + 1);

        if (!result.state.gameOver) {
          expect(result.state.currentPlayer).not.toBe(previousPlayer);
        }

        assertBoardInvariants(result.state);
        state = result.state;
      }
    }

    expect(games).toBe(20);
  });
});
