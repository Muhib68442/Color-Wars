import {
  MAX_GRID_SIZE,
  MAX_PLAYERS,
  MIN_GRID_SIZE,
  MIN_PLAYERS,
  type Player,
  type PlayerCount,
} from "../engine/index.js";
import { isRecord, type KeyValueStore } from "./storage.js";

export const SETTINGS_KEY = "color-wars:settings";
export const SETTINGS_VERSION = 2;
export const MAX_NAME_LENGTH = 16;

export type Difficulty = "easy" | "medium" | "hard";

export interface PlayerProfile {
  name: string;
  color: string;
}

export interface GameSettings {
  difficulty: Difficulty;
  gridRows: number;
  gridCols: number;
  playerCount: PlayerCount;
  profiles: Record<Player, PlayerProfile>;
  sound: boolean;
  vibration: boolean;
}

export interface SettingsStore {
  load(): GameSettings;
  save(settings: GameSettings): void;
}

const DEFAULT_PROFILES: Record<Player, PlayerProfile> = {
  1: { name: "Player 1", color: "#6e6eff" },
  2: { name: "Player 2", color: "#ff5959" },
  3: { name: "Player 3", color: "#2fa84f" },
  4: { name: "Player 4", color: "#f0a12e" },
};

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function defaultSettings(): GameSettings {
  return {
    difficulty: "medium",
    gridRows: MIN_GRID_SIZE,
    gridCols: MIN_GRID_SIZE,
    playerCount: 2,
    profiles: {
      1: { ...DEFAULT_PROFILES[1] },
      2: { ...DEFAULT_PROFILES[2] },
      3: { ...DEFAULT_PROFILES[3] },
      4: { ...DEFAULT_PROFILES[4] },
    },
    sound: true,
    vibration: true,
  };
}

export function sanitizeName(value: unknown, player: Player): string {
  const fallback = DEFAULT_PROFILES[player].name;
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : fallback;
}

export function isDifficulty(value: unknown): value is Difficulty {
  return (
    typeof value === "string" &&
    (DIFFICULTIES as string[]).includes(value)
  );
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), min), max);
}

/**
 * Merges unknown stored data into a valid settings object. Never throws and
 * never returns partial data, so a corrupt settings blob cannot break the app.
 */
export function normalizeSettings(value: unknown): GameSettings {
  const defaults = defaultSettings();
  if (!isRecord(value)) return defaults;

  const profilesValue = isRecord(value["profiles"]) ? value["profiles"] : {};
  const profiles = {} as Record<Player, PlayerProfile>;

  for (let index = 1; index <= MAX_PLAYERS; index += 1) {
    const player = index as Player;
    const stored = profilesValue[String(player)];
    const profile = isRecord(stored) ? stored : {};
    profiles[player] = {
      name: sanitizeName(profile["name"], player),
      color: isHexColor(profile["color"])
        ? profile["color"]
        : DEFAULT_PROFILES[player].color,
    };
  }

  const playerCount = clampInt(
    value["playerCount"],
    MIN_PLAYERS,
    MAX_PLAYERS,
    defaults.playerCount,
  ) as PlayerCount;

  // Settings v1 stored one square `gridSize`; both axes inherit it on load.
  const legacySize = clampInt(
    value["gridSize"],
    MIN_GRID_SIZE,
    MAX_GRID_SIZE,
    defaults.gridRows,
  );

  return {
    difficulty: isDifficulty(value["difficulty"])
      ? value["difficulty"]
      : defaults.difficulty,
    gridRows: clampInt(
      value["gridRows"],
      MIN_GRID_SIZE,
      MAX_GRID_SIZE,
      legacySize,
    ),
    gridCols: clampInt(
      value["gridCols"],
      MIN_GRID_SIZE,
      MAX_GRID_SIZE,
      legacySize,
    ),
    playerCount,
    profiles,
    sound: typeof value["sound"] === "boolean" ? value["sound"] : defaults.sound,
    vibration:
      typeof value["vibration"] === "boolean"
        ? value["vibration"]
        : defaults.vibration,
  };
}

/** Blends a hex colour with white for active cards and soft accents. */
export function softenColor(hex: string, amount = 0.84): string {
  return mixColor(hex, 255, amount, "#f3f3f6");
}

/** Blends a hex colour with black for borders and status text. */
export function strengthenColor(hex: string, amount = 0.22): string {
  return mixColor(hex, 0, amount, "#14161a");
}

function mixColor(
  hex: string,
  target: number,
  amount: number,
  fallback: string,
): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) return fallback;

  const channels = [match[1], match[2], match[3]].map((part) => {
    const value = Number.parseInt(part ?? "ff", 16);
    return Math.round(value + (target - value) * amount);
  });

  return `rgb(${channels[0]} ${channels[1]} ${channels[2]})`;
}

/** Picks black or white ink for orbs drawn on a player colour. */
export function readableInk(hex: string): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) return "#14161a";

  const [r, g, b] = [match[1], match[2], match[3]].map((part) => {
    const value = Number.parseInt(part ?? "00", 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  }) as [number, number, number];

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#14161a" : "#ffffff";
}

/** The opposite ink to `readableInk`, used for inner orb rings. */
export function readableAlt(hex: string): string {
  return readableInk(hex) === "#14161a" ? "#ffffff" : "#14161a";
}

export function createSettingsStore(
  store: KeyValueStore,
  key: string = SETTINGS_KEY,
): SettingsStore {
  return {
    load() {
      let raw: string | null;
      try {
        raw = store.getItem(key);
      } catch {
        return defaultSettings();
      }
      if (raw === null) return defaultSettings();

      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) return defaultSettings();
        return normalizeSettings(
          isRecord(parsed["settings"]) ? parsed["settings"] : parsed,
        );
      } catch {
        return defaultSettings();
      }
    },

    save(settings) {
      const normalized = normalizeSettings(settings);
      try {
        store.setItem(
          key,
          JSON.stringify({ version: SETTINGS_VERSION, settings: normalized }),
        );
      } catch {
        // Settings are a nicety; the session keeps working without storage.
      }
    },
  };
}
