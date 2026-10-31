import { capacityAt, getCell, neighbors, setCell } from "./board.js";
import type { CellRef, GameEvent, GameState, Player } from "./types.js";

/**
 * Safety cap for a single cascade. Real games resolve in a few hundred
 * explosions at most; hitting this means a pathological cycle, so the game ends
 * as a draw instead of freezing the UI.
 */
export const MAX_CASCADE_STEPS = 10_000;

export function resolveCascades(
  state: GameState,
  start: CellRef,
  events: GameEvent[],
  maxSteps: number = MAX_CASCADE_STEPS,
): void {
  const queue: CellRef[] = [{ row: start.row, col: start.col }];
  let head = 0;
  let steps = 0;

  while (head < queue.length) {
    const ref = queue[head];
    head += 1;
    if (ref === undefined) continue;

    steps += 1;
    if (steps > maxSteps) {
      state.cascadeLimitReached = true;
      events.push({ type: "cascade-limit", reason: "limit" });
      return;
    }

    const cell = getCell(state.board, ref.row, ref.col);
    if (cell === null) continue;

    const capacity = capacityAt(state.rows, state.cols, ref.row, ref.col);
    if (cell.orbs < capacity) continue;

    const owner = cell.owner;
    const orbs = cell.orbs;
    setCell(state.board, ref.row, ref.col, null);
    events.push({ type: "explode", at: { ...ref }, player: owner, orbs });

    for (const target of neighbors(state.rows, state.cols, ref.row, ref.col)) {
      const existing = getCell(state.board, target.row, target.col);
      let captured = false;
      let capturedFrom: Player | null = null;

      if (existing === null) {
        setCell(state.board, target.row, target.col, { owner, orbs: 1 });
      } else {
        captured = existing.owner !== owner;
        if (captured) capturedFrom = existing.owner;
        existing.owner = owner;
        existing.orbs += 1;
      }

      const updated = getCell(state.board, target.row, target.col);
      events.push({
        type: "transfer",
        from: { ...ref },
        to: { ...target },
        player: owner,
        captured,
        capturedFrom,
        orbs: updated === null ? 1 : updated.orbs,
      });

      if (
        updated !== null &&
        updated.orbs >=
          capacityAt(state.rows, state.cols, target.row, target.col)
      ) {
        queue.push({ row: target.row, col: target.col });
      }
    }
  }
}
