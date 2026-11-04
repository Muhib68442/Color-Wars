import { describe, expect, it } from "vitest";
import { applyMove, setCell } from "../../src/engine/index.js";
import { groupEvents, replayEvents } from "../../src/ui/replay.js";
import { cell, emptyBoard, makeState } from "../engine/helpers.js";

describe("cascade replay", () => {
  it("rebuilds the exact board the engine produced", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 0, 0, cell(1, 1));
    setCell(board, 0, 1, cell(2, 1));
    setCell(board, 6, 6, cell(2, 1));

    const before = makeState(board);
    const result = applyMove(before, { row: 0, col: 0 });
    const replayed = replayEvents(before, result.events);

    expect(result.accepted).toBe(true);
    expect(replayed.board).toEqual(result.state.board);
    expect(replayed.gameOver).toBe(result.state.gameOver);
    expect(replayed.winner).toBe(result.state.winner);
  });

  it("keeps every transfer with the explosion that launched it", () => {
    const board = emptyBoard(7, 7);
    setCell(board, 3, 3, cell(1, 3));
    setCell(board, 3, 4, cell(1, 3));

    const before = makeState(board);
    const result = applyMove(before, { row: 3, col: 3 });
    const groups = groupEvents(result.events);

    expect(groups.map((group) => group.lead.type)).toEqual([
      "add",
      "explode",
      "explode",
    ]);
    expect(groups[1]?.transfers).toHaveLength(4);
    expect(groups[2]?.transfers).toHaveLength(4);

    for (const group of groups) {
      if (group.lead.type !== "explode") continue;
      for (const transfer of group.transfers) {
        expect(transfer.from).toEqual(group.lead.at);
      }
    }

    expect(replayEvents(before, result.events).board).toEqual(
      result.state.board,
    );
  });
});
