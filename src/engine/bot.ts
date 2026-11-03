import { capacityAt, getCell } from "./board.js";
import { applyMove, legalMoves } from "./moves.js";
import type { CellRef, Difficulty, GameState, Player } from "./types.js";

/** The name every Bot seat is displayed with, in every language. */
export const BOT_NAME = "Bot";

/** A win is worth far more than any positional score. */
const WIN_SCORE = 1_000_000;
/** How many strong bot moves the hard search checks against a reply. */
const HARD_BRANCHES = 8;
/** Safety cap for the number of opponent detonations examined per branch. */
const MAX_REPLIES = 16;

export interface BotMoveOptions {
  difficulty: Difficulty;
  /** Injectable randomness keeps easy and tie-breaks testable. */
  random?: () => number;
}

interface PlayerStats {
  orbs: number;
  cells: number;
}

interface RankedMove {
  move: CellRef;
  score: number;
  state: GameState;
}

function randomIndex(length: number, random: () => number): number {
  if (length <= 1) return 0;
  const value = random();
  const clamped = Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 0.999_999)
    : 0;
  return Math.min(length - 1, Math.floor(clamped * length));
}

/** One board pass gives every player's orb and cell totals. */
function tallyPlayers(state: GameState): PlayerStats[] {
  const stats: PlayerStats[] = Array.from({ length: 5 }, () => ({
    orbs: 0,
    cells: 0,
  }));

  for (const row of state.board) {
    for (const cell of row) {
      if (cell === null) continue;
      const entry = stats[cell.owner];
      if (entry === undefined) continue;
      entry.orbs += cell.orbs;
      entry.cells += 1;
    }
  }

  return stats;
}

/**
 * Cells one orb below capacity are about to pop. Owning one is a small
 * offensive asset; an opponent owning one is an immediate threat.
 */
function pressure(state: GameState, me: Player): number {
  let score = 0;

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const cell = getCell(state.board, row, col);
      if (cell === null) continue;

      const capacity = capacityAt(state.rows, state.cols, row, col);
      if (capacity < 2 || cell.orbs !== capacity - 1) continue;

      score += cell.owner === me ? 1.4 : -1.8;
    }
  }

  return score;
}

/**
 * Static evaluation from one player's point of view. It balances material
 * (orbs and cells) against the position of the strongest rival and rewards
 * cells that are about to detonate.
 */
function evaluate(state: GameState, me: Player): number {
  if (state.gameOver) {
    if (state.winner === me) return WIN_SCORE;
    if (state.winner === null) return -WIN_SCORE / 2;
    return -WIN_SCORE;
  }

  const stats = tallyPlayers(state);
  const mine = stats[me] ?? { orbs: 0, cells: 0 };

  let rivalOrbs = 0;
  let rivalCells = 0;
  let rivals = 0;
  let strongest = 0;

  for (let index = 1; index <= state.playerCount; index += 1) {
    if (index === me) continue;
    const player = index as Player;
    const entry = stats[player] ?? { orbs: 0, cells: 0 };
    const value = entry.orbs * 1.5 + entry.cells * 4;
    rivalOrbs += entry.orbs;
    rivalCells += entry.cells;
    rivals += 1;
    if (value > strongest) strongest = value;
  }

  const average = Math.max(1, rivals);
  const material =
    mine.orbs * 1.5 +
    mine.cells * 4 -
    (rivalOrbs * 1.5 + rivalCells * 4) / average;

  // Being ahead of the strongest rival matters more than total board share.
  const lead = mine.orbs * 1.5 + mine.cells * 4 - strongest;

  return material + lead * 0.35 + pressure(state, me);
}

function rankMoves(state: GameState, me: Player): RankedMove[] {
  const ranked: RankedMove[] = [];

  for (const move of legalMoves(state)) {
    const result = applyMove(state, move);
    if (!result.accepted) continue;
    ranked.push({
      move,
      state: result.state,
      score: evaluate(result.state, me),
    });
  }

  return ranked;
}

function pickBest(ranked: RankedMove[], random: () => number): CellRef | null {
  if (ranked.length === 0) return null;

  let best = -Infinity;
  let ties: RankedMove[] = [];

  for (const candidate of ranked) {
    if (candidate.score > best + 1e-9) {
      best = candidate.score;
      ties = [candidate];
    } else if (Math.abs(candidate.score - best) <= 1e-9) {
      ties.push(candidate);
    }
  }

  return ties[randomIndex(ties.length, random)]?.move ?? null;
}

/**
 * The only opponent moves that change the board immediately are detonations
 * of cells already one orb below capacity. Checking those is cheap and catches
 * the blunders a one-ply bot would walk into.
 */
function immediateThreats(state: GameState): CellRef[] {
  if (state.gameOver) return [];

  const player = state.currentPlayer;
  const replies: CellRef[] = [];

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const cell = getCell(state.board, row, col);
      if (cell === null || cell.owner !== player) continue;
      if (cell.orbs + 1 < capacityAt(state.rows, state.cols, row, col)) {
        continue;
      }
      replies.push({ row, col });
      if (replies.length >= MAX_REPLIES) return replies;
    }
  }

  return replies;
}

function chooseEasy(state: GameState, random: () => number): CellRef | null {
  const moves = legalMoves(state);
  if (moves.length === 0) return null;
  return moves[randomIndex(moves.length, random)] ?? null;
}

function chooseHard(state: GameState, me: Player, random: () => number): CellRef | null {
  const ranked = rankMoves(state, me)
    .sort((left, right) => right.score - left.score)
    .slice(0, HARD_BRANCHES);

  if (ranked.length === 0) return null;

  let best = -Infinity;
  let ties: CellRef[] = [];

  for (const candidate of ranked) {
    let worst = candidate.score;

    if (!candidate.state.gameOver) {
      for (const reply of immediateThreats(candidate.state)) {
        const result = applyMove(candidate.state, reply);
        if (!result.accepted) continue;
        worst = Math.min(worst, evaluate(result.state, me));
      }
    }

    if (worst > best + 1e-9) {
      best = worst;
      ties = [candidate.move];
    } else if (Math.abs(worst - best) <= 1e-9) {
      ties.push(candidate.move);
    }
  }

  return ties[randomIndex(ties.length, random)] ?? null;
}

/**
 * Picks a legal move for the player whose turn it is.
 *
 * - `easy` plays a random legal move.
 * - `medium` scores every legal move one ply deep and takes the best.
 * - `hard` does the same, then rejects moves that let the next opponent
 *   detonate a nearly-full cell and swing the position.
 */
export function chooseBotMove(
  state: GameState,
  options: BotMoveOptions,
): CellRef | null {
  if (state.gameOver) return null;

  const random = options.random ?? Math.random;
  const me = state.currentPlayer;

  switch (options.difficulty) {
    case "easy":
      return chooseEasy(state, random);
    case "medium":
      return pickBest(rankMoves(state, me), random);
    case "hard":
      return chooseHard(state, me, random);
  }
}
