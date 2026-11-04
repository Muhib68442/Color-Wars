import {
  cloneState,
  getCell,
  setCell,
  type GameEvent,
  type GameState,
} from "../engine/index.js";

export type ReplayLeadEvent = Extract<
  GameEvent,
  { type: "place" | "add" | "explode" }
>;
export type ReplayTransferEvent = Extract<GameEvent, { type: "transfer" }>;

/**
 * One visually distinct cascade step. `place`/`add` steps have no transfers;
 * an `explode` step owns every transfer that happens before the next cell
 * becomes unstable.
 */
export interface ReplayGroup {
  lead: ReplayLeadEvent;
  transfers: ReplayTransferEvent[];
}

/**
 * Applies one engine event to a mutable state. This mirrors the board mutations
 * made by `applyMove`, so the UI can replay just the visible part of a move
 * without asking the engine to resolve it again.
 */
export function applyGameEvent(state: GameState, event: GameEvent): void {
  switch (event.type) {
    case "place":
      setCell(state.board, event.at.row, event.at.col, {
        owner: event.player,
        orbs: 1,
      });
      break;

    case "add": {
      const cell = getCell(state.board, event.at.row, event.at.col);
      if (cell === null) {
        setCell(state.board, event.at.row, event.at.col, {
          owner: event.player,
          orbs: event.orbs,
        });
      } else {
        cell.owner = event.player;
        cell.orbs = event.orbs;
      }
      break;
    }

    case "explode":
      setCell(state.board, event.at.row, event.at.col, null);
      break;

    case "transfer": {
      const cell = getCell(state.board, event.to.row, event.to.col);
      if (cell === null) {
        setCell(state.board, event.to.row, event.to.col, {
          owner: event.player,
          orbs: event.orbs,
        });
      } else {
        cell.owner = event.player;
        cell.orbs = event.orbs;
      }
      break;
    }

    case "cascade-limit":
      state.cascadeLimitReached = true;
      break;

    case "win":
      state.gameOver = true;
      state.winner = event.winner;
      break;
  }
}

/**
 * Splits an engine event stream into the groups the UI plays one at a time.
 * Every transfer belongs to the explosion that launched it, so the next
 * explosion waits until the previous group's flights have landed.
 */
export function groupEvents(events: GameEvent[]): ReplayGroup[] {
  const groups: ReplayGroup[] = [];
  let current: ReplayGroup | null = null;

  for (const event of events) {
    switch (event.type) {
      case "place":
      case "add":
      case "explode":
        current = { lead: event, transfers: [] };
        groups.push(current);
        break;

      case "transfer":
        // A transfer always follows the explosion that emitted it.
        current?.transfers.push(event);
        break;

      case "cascade-limit":
      case "win":
        break;
    }
  }

  return groups;
}

/**
 * Rebuilds the final board from a pre-move state and the engine's event stream.
 * The turn counter and current player are owned by `applyMove`; this helper only
 * reproduces the board and end-of-game flags.
 */
export function replayEvents(
  preState: GameState,
  events: GameEvent[],
): GameState {
  const state = cloneState(preState);
  for (const event of events) applyGameEvent(state, event);
  return state;
}
