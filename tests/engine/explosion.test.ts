import { describe, expect, it } from "vitest";
import {
  applyMove,
  capacityAt,
  cloneState,
  createGame,
  getCell,
  type PlayerCount,
} from "../../src/engine/index.js";
import { applyGameEvent } from "../../src/ui/replay.js";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playRandom(seed: number, playerCount: PlayerCount): void {
  const rand = mulberry32(seed);
  let state = createGame(7, 7, playerCount, null);
  let moves = 0;

  while (!state.gameOver && moves < 150) {
    const cells: { row: number; col: number }[] = [];
    for (let row = 0; row < state.rows; row += 1) {
      for (let col = 0; col < state.cols; col += 1) {
        const cell = getCell(state.board, row, col);
        if (cell === null || cell.owner === state.currentPlayer) {
          cells.push({ row, col });
        }
      }
    }

    const move = cells[Math.floor(rand() * cells.length)];
    if (move === undefined) break;

    const before = state;
    // Keep pathological random-play cycles from dominating the run.
    const result = applyMove(before, move, { maxCascadeSteps: 300 });
    if (!result.accepted) break;

    // Rebuild the board event by event and check every detonation against the
    // capacity that applied at that exact moment.
    const virtual = cloneState(before);
    for (const event of result.events) {
      if (event.type === "explode") {
        const firing = getCell(virtual.board, event.at.row, event.at.col);
        const capacity = capacityAt(
          virtual.rows,
          virtual.cols,
          event.at.row,
          event.at.col,
        );
        expect(firing, `missing cell ${event.at.row},${event.at.col}`).not.toBeNull();
        expect(
          firing?.orbs ?? 0,
          `exploded below capacity at ${event.at.row},${event.at.col}`,
        ).toBeGreaterThanOrEqual(capacity);
        expect(event.orbs).toBe(firing?.orbs);
      }
      applyGameEvent(virtual, event);
    }

    state = result.state;
    moves += 1;
  }
}

describe("explosion capacity invariant", () => {
  it(
    "never detonates below capacity in random play",
    () => {
      for (let seed = 1; seed <= 8; seed += 1) {
        playRandom(seed, ((seed % 3) + 2) as PlayerCount);
      }
    },
    30_000,
  );
});
