import { capacityAt, getCell, neighbors } from "./board.js";
import { applyMove, legalMoves } from "./moves.js";
import type { CellRef, Difficulty, GameState, Player } from "./types.js";

/** The name every Bot seat is displayed with, in every language. */
export const BOT_NAME = "Bot";

/** A win is worth far more than any positional score. */
const WIN_SCORE = 1_000_000;

/**
 * Static weights. Orbs and concentrated stacks matter more than owning a wide
 * but thin territory, which is what makes the Bot build up cells instead of
 * scattering one orb across every empty square.
 */
const ORB_WEIGHT = 1.8;
const CELL_WEIGHT = 0.25;
const STACK_WEIGHT = 1.1;
const PROGRESS_WEIGHT = 1.6;
const ARMED_WEIGHT = 1.4;
const ATTACK_WEIGHT = 0.9;
const EPSILON = 1e-9;

/**
 * Hard searches two plies: its own move and the opponents' strongest reply.
 * That sees immediate captures and wins without freezing a large board.
 */
const HARD_DEPTH = 2;
const HARD_ROOT_MOVES = 12;
const HARD_BEAM = 8;

export interface BotMoveOptions {
  difficulty: Difficulty;
  /** Injectable randomness keeps easy and tie-breaks testable. */
  random?: () => number;
}

interface PlayerStats {
  value: number;
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

function emptyStats(): PlayerStats {
  return { value: 0 };
}

/**
 * One board pass scores every player. A cell is worth its orbs, a bonus for the
 * orbs stacked above the first, progress toward detonation, and — when it is
 * armed — the enemy orbs it can capture on the next placement.
 */
function summarize(state: GameState): PlayerStats[] {
  const stats: PlayerStats[] = Array.from({ length: 5 }, emptyStats);

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const cell = getCell(state.board, row, col);
      if (cell === null) continue;

      const entry = stats[cell.owner];
      if (entry === undefined) continue;

      const capacity = capacityAt(state.rows, state.cols, row, col);
      if (capacity < 1) continue;

      const progress = cell.orbs / capacity;
      const armed = cell.orbs >= capacity - 1;
      let value =
        cell.orbs * ORB_WEIGHT +
        CELL_WEIGHT +
        Math.max(0, cell.orbs - 1) * STACK_WEIGHT +
        progress * progress * PROGRESS_WEIGHT;

      if (armed) {
        value += ARMED_WEIGHT * progress;
        // An armed cell next to enemy orbs is a takeover threat.
        for (const ref of neighbors(state.rows, state.cols, row, col)) {
          const nearby = getCell(state.board, ref.row, ref.col);
          if (nearby !== null && nearby.owner !== cell.owner) {
            value += ATTACK_WEIGHT * (1.6 + nearby.orbs * 1.2);
          }
        }
      }

      entry.value += value;
    }
  }

  return stats;
}

/**
 * Static evaluation from one player's point of view. It compares the Bot with
 * the strongest rival while still caring about the rest of a three- or
 * four-player table.
 */
function evaluate(state: GameState, me: Player): number {
  if (state.gameOver) {
    if (state.winner === me) return WIN_SCORE;
    if (state.winner === null) return 0;
    return -WIN_SCORE;
  }

  const stats = summarize(state);
  const mine = stats[me]?.value ?? 0;

  let strongest = 0;
  let total = 0;
  let rivals = 0;
  for (let index = 1; index <= state.playerCount; index += 1) {
    if (index === me) continue;
    const player = index as Player;
    const value = stats[player]?.value ?? 0;
    if (value > strongest) strongest = value;
    total += value;
    rivals += 1;
  }

  if (rivals === 0) return mine;
  const average = total / rivals;
  return mine - strongest * 0.7 - average * 0.3;
}

/** Scores every legal move one ply deep from the mover's perspective. */
function rankMoves(state: GameState, perspective: Player): RankedMove[] {
  const ranked: RankedMove[] = [];

  for (const move of legalMoves(state)) {
    const result = applyMove(state, move);
    if (!result.accepted) continue;
    ranked.push({
      move,
      state: result.state,
      score: evaluate(result.state, perspective),
    });
  }

  return ranked.sort((left, right) => right.score - left.score);
}

function pickBest(ranked: RankedMove[], random: () => number): CellRef | null {
  if (ranked.length === 0) return null;

  let best = -Infinity;
  let ties: RankedMove[] = [];

  for (const candidate of ranked) {
    if (candidate.score > best + EPSILON) {
      best = candidate.score;
      ties = [candidate];
    } else if (Math.abs(candidate.score - best) <= EPSILON) {
      ties.push(candidate);
    }
  }

  return ties[randomIndex(ties.length, random)]?.move ?? null;
}

/**
 * Bounded minimax. The Bot maximises its score; every rival minimises it. Each
 * node keeps only the strongest few moves so a 15×15 board stays responsive.
 */
function search(
  state: GameState,
  me: Player,
  depth: number,
  beam: number,
): number {
  if (state.gameOver || depth <= 0) return evaluate(state, me);

  const ranked = rankMoves(state, state.currentPlayer);
  if (ranked.length === 0) return evaluate(state, me);

  const branch = ranked.slice(0, beam);
  const maximizing = state.currentPlayer === me;
  let best = maximizing ? -Infinity : Infinity;

  for (const candidate of branch) {
    const value = search(candidate.state, me, depth - 1, beam);
    if (maximizing) {
      if (value > best) best = value;
    } else if (value < best) {
      best = value;
    }
  }

  return best;
}

function chooseEasy(state: GameState, random: () => number): CellRef | null {
  const moves = legalMoves(state);
  if (moves.length === 0) return null;
  return moves[randomIndex(moves.length, random)] ?? null;
}

function chooseHard(
  state: GameState,
  me: Player,
  random: () => number,
): CellRef | null {
  const ranked = rankMoves(state, me);
  if (ranked.length === 0) return null;

  // Never miss a move that wins immediately.
  const winning = ranked.find(
    (candidate) => candidate.state.gameOver && candidate.state.winner === me,
  );
  if (winning !== undefined) return winning.move;

  const branch = ranked.slice(0, HARD_ROOT_MOVES);

  let best = -Infinity;
  let ties: CellRef[] = [];

  for (const candidate of branch) {
    const value = search(candidate.state, me, HARD_DEPTH - 1, HARD_BEAM);
    if (value > best + EPSILON) {
      best = value;
      ties = [candidate.move];
    } else if (Math.abs(value - best) <= EPSILON) {
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
 * - `hard` searches its move and the opponents' best replies, then picks the
 *   move that stays strongest. It always takes an immediate win.
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
