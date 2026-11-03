import {
  capacityAt,
  MAX_GRID_SIZE,
  MAX_PLAYERS,
  MIN_GRID_SIZE,
  MIN_PLAYERS,
  type GameState,
  type Player,
} from "../engine/index.js";

export const SAVE_KEY = "color-wars:save";
export const SAVE_VERSION = 3;
/** Version 2 saves are accepted and migrated with no Bot seat. */
export const MIN_SAVE_VERSION = 2;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StorageAdapter {
  load(): GameState | null;
  save(state: GameState): void;
  clear(): void;
}

interface SavePayload {
  version: number;
  savedAt: number;
  state: GameState;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlayerInRange(value: unknown, playerCount: number): value is Player {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= playerCount
  );
}

/**
 * Accepts only a complete, stable board within the supported range on each
 * axis, so rectangular boards such as 11 × 7 load too. A corrupt or
 * half-written save must never reach the renderer; the caller starts a new game
 * instead.
 */
export function isGameState(value: unknown): value is GameState {
  if (!isRecord(value)) return false;

  const rows = value["rows"];
  const cols = value["cols"];
  if (
    typeof rows !== "number" ||
    typeof cols !== "number" ||
    !Number.isInteger(rows) ||
    !Number.isInteger(cols) ||
    rows < MIN_GRID_SIZE ||
    rows > MAX_GRID_SIZE ||
    cols < MIN_GRID_SIZE ||
    cols > MAX_GRID_SIZE
  ) {
    return false;
  }

  const playerCount = value["playerCount"];
  if (
    typeof playerCount !== "number" ||
    !Number.isInteger(playerCount) ||
    playerCount < MIN_PLAYERS ||
    playerCount > MAX_PLAYERS
  ) {
    return false;
  }

  const board = value["board"];
  if (!Array.isArray(board) || board.length !== rows) return false;

  for (let row = 0; row < rows; row += 1) {
    const boardRow: unknown = board[row];
    if (!Array.isArray(boardRow) || boardRow.length !== cols) return false;

    for (let col = 0; col < cols; col += 1) {
      const cell: unknown = boardRow[col];
      if (cell === null) continue;
      if (!isRecord(cell)) return false;

      const owner = cell["owner"];
      const orbs = cell["orbs"];
      if (!isPlayerInRange(owner, playerCount)) return false;
      if (typeof orbs !== "number" || !Number.isInteger(orbs)) return false;
      if (orbs < 1 || orbs >= capacityAt(rows, cols, row, col)) {
        return false;
      }
    }
  }

  const currentPlayer = value["currentPlayer"];
  if (!isPlayerInRange(currentPlayer, playerCount)) return false;

  const hasPlayed = value["hasPlayed"];
  if (!isRecord(hasPlayed)) return false;
  for (let player = 1; player <= playerCount; player += 1) {
    if (typeof hasPlayed[String(player)] !== "boolean") return false;
  }

  if (typeof value["gameOver"] !== "boolean") return false;

  const botPlayer = value["botPlayer"];
  if (botPlayer !== null) {
    if (!isPlayerInRange(botPlayer, playerCount)) return false;
    // Player 1 is always the human, and a Bot needs a second seat.
    if (botPlayer < 2) return false;
  }

  const winner = value["winner"];
  if (winner !== null && !isPlayerInRange(winner, playerCount)) return false;

  const moveCount = value["moveCount"];
  if (
    typeof moveCount !== "number" ||
    !Number.isInteger(moveCount) ||
    moveCount < 0
  ) {
    return false;
  }

  // A capped cascade is a safety stop, not a resumable game.
  if (value["cascadeLimitReached"] !== false) return false;

  return true;
}

export function parseSave(raw: string): GameState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  const version = parsed["version"];
  if (
    version !== SAVE_VERSION &&
    version !== MIN_SAVE_VERSION
  ) {
    return null;
  }

  const stored = parsed["state"];
  if (!isRecord(stored)) return null;

  // Version 2 had no Bot seat; migrate it to a plain hot-seat match.
  const state =
    version === MIN_SAVE_VERSION ? { ...stored, botPlayer: null } : stored;
  if (!isGameState(state)) return null;

  return state;
}

export function createStorage(
  store: KeyValueStore,
  key: string = SAVE_KEY,
): StorageAdapter {
  function remove(): void {
    try {
      store.removeItem(key);
    } catch {
      // Storage can be unavailable in private mode; losing a save is fine.
    }
  }

  return {
    load() {
      let raw: string | null;
      try {
        raw = store.getItem(key);
      } catch {
        return null;
      }

      if (raw === null) return null;

      const state = parseSave(raw);
      if (state === null) remove();
      return state;
    },

    save(state) {
      if (!isGameState(state)) return;

      const payload: SavePayload = {
        version: SAVE_VERSION,
        savedAt: Date.now(),
        state,
      };

      try {
        store.setItem(key, JSON.stringify(payload));
      } catch {
        // Quota or private mode: the game keeps running without persistence.
      }
    },

    clear: remove,
  };
}

export function memoryStore(): KeyValueStore {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

export function browserStore(): KeyValueStore {
  if (typeof window === "undefined") return memoryStore();

  try {
    const store = window.localStorage;
    const probe = "__color-wars-probe__";
    store.setItem(probe, "1");
    store.removeItem(probe);
    return store;
  } catch {
    return memoryStore();
  }
}
