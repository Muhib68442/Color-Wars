import {
  cloneBoard,
  createBoard,
  getCell,
  inBounds,
  other,
  setCell,
} from "./board.js";
import { resolveCascades } from "./cascade.js";
import { evaluateWinner } from "./winner.js";
import type { CellRef, GameEvent, GameState, MoveResult } from "./types.js";

export interface ApplyMoveOptions {
  maxCascadeSteps?: number;
}

export function createGame(rows = 7, cols = 7): GameState {
  return {
    rows,
    cols,
    board: createBoard(rows, cols),
    currentPlayer: 1,
    hasPlayed: { 1: false, 2: false },
    gameOver: false,
    winner: null,
    moveCount: 0,
    cascadeLimitReached: false,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    board: cloneBoard(state.board),
    hasPlayed: { ...state.hasPlayed },
  };
}

export function isLegalMove(state: GameState, move: CellRef): boolean {
  if (state.gameOver) return false;
  if (!inBounds(state.board, move.row, move.col)) return false;

  const cell = getCell(state.board, move.row, move.col);
  return cell === null || cell.owner === state.currentPlayer;
}

export function legalMoves(state: GameState): CellRef[] {
  if (state.gameOver) return [];

  const moves: CellRef[] = [];
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const move = { row, col };
      if (isLegalMove(state, move)) moves.push(move);
    }
  }
  return moves;
}

/**
 * Applies a move to a copy of the state. The input state is never mutated.
 * Accepted moves always advance the turn unless the game ends.
 */
export function applyMove(
  state: GameState,
  move: CellRef,
  options: ApplyMoveOptions = {},
): MoveResult {
  if (!isLegalMove(state, move)) {
    return { state, events: [], accepted: false };
  }

  const next = cloneState(state);
  const events: GameEvent[] = [];
  const player = next.currentPlayer;
  const target = getCell(next.board, move.row, move.col);

  if (target === null) {
    setCell(next.board, move.row, move.col, { owner: player, orbs: 1 });
    events.push({
      type: "place",
      at: { row: move.row, col: move.col },
      player,
    });
  } else {
    target.orbs += 1;
    events.push({
      type: "add",
      at: { row: move.row, col: move.col },
      player,
      orbs: target.orbs,
    });
  }

  next.hasPlayed[player] = true;
  resolveCascades(next, move, events, options.maxCascadeSteps);

  if (next.cascadeLimitReached) {
    next.gameOver = true;
    next.winner = null;
    events.push({ type: "win", winner: null });
  } else {
    const verdict = evaluateWinner(next);
    if (verdict.gameOver) {
      next.gameOver = true;
      next.winner = verdict.winner;
      events.push({ type: "win", winner: verdict.winner });
    } else {
      next.currentPlayer = other(player);
    }
  }

  next.moveCount += 1;
  return { state: next, events, accepted: true };
}
