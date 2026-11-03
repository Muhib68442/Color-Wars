import { describe, expect, it } from "vitest";
import {
  createSettingsStore,
  defaultSettings,
  MAX_NAME_LENGTH,
  normalizeSettings,
  readableAlt,
  readableInk,
  sanitizeName,
  SETTINGS_KEY,
  softenColor,
  strengthenColor,
} from "../../src/platform/settings.js";
import { memoryStore } from "../../src/platform/storage.js";

describe("settings defaults", () => {
  it("starts light at medium, 7x7, two players, sound and vibration on", () => {
    const settings = defaultSettings();

    expect(settings.difficulty).toBe("medium");
    expect(settings.theme).toBe("light");
    expect(settings.gridRows).toBe(7);
    expect(settings.gridCols).toBe(7);
    expect(settings.playerCount).toBe(2);
    expect(settings.bot).toBe(false);
    expect(settings.sound).toBe(true);
    expect(settings.vibration).toBe(true);
    expect(settings.profiles[1].name).toBe("Player 1");
    expect(settings.profiles[1].color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("normalizeSettings", () => {
  it("clamps each grid axis and player count into range", () => {
    expect(normalizeSettings({ gridRows: 3 }).gridRows).toBe(7);
    expect(normalizeSettings({ gridRows: 99 }).gridRows).toBe(15);
    expect(normalizeSettings({ gridRows: 10.6 }).gridRows).toBe(11);
    expect(normalizeSettings({ gridCols: 3 }).gridCols).toBe(7);
    expect(normalizeSettings({ gridCols: 99 }).gridCols).toBe(15);
    expect(normalizeSettings({ playerCount: 0 }).playerCount).toBe(1);
    expect(normalizeSettings({ playerCount: 9 }).playerCount).toBe(4);
  });

  it("keeps rectangular boards, such as 11 rows by 7 columns", () => {
    const settings = normalizeSettings({ gridRows: 11, gridCols: 7 });

    expect(settings.gridRows).toBe(11);
    expect(settings.gridCols).toBe(7);
  });

  it("migrates the version-1 square grid size onto both axes", () => {
    const settings = normalizeSettings({ gridSize: 12 });

    expect(settings.gridRows).toBe(12);
    expect(settings.gridCols).toBe(12);
    expect(settings.theme).toBe("light");
  });

  it("keeps a valid theme and rejects unknown values", () => {
    expect(normalizeSettings({ theme: "dark" }).theme).toBe("dark");
    expect(normalizeSettings({ theme: "light" }).theme).toBe("light");
    expect(normalizeSettings({ theme: "sepia" }).theme).toBe("light");
    expect(normalizeSettings({}).theme).toBe("light");
  });

  it("rejects unknown difficulties and invalid colours", () => {
    const settings = normalizeSettings({
      difficulty: "impossible",
      profiles: {
        1: { name: "Ada", color: "red" },
        2: { name: "   ", color: "#00FF00" },
        3: { name: 42, color: "#123" },
        4: { name: "Grace", color: "#aabbcc" },
      },
      sound: "yes",
      vibration: false,
    });

    expect(settings.difficulty).toBe("medium");
    expect(settings.profiles[1]).toEqual({
      name: "Ada",
      color: defaultSettings().profiles[1].color,
    });
    expect(settings.profiles[2].name).toBe("Player 2");
    expect(settings.profiles[2].color).toBe("#00FF00");
    expect(settings.profiles[3].name).toBe("Player 3");
    expect(settings.profiles[4].name).toBe("Grace");
    expect(settings.profiles[4].color).toBe("#aabbcc");
    expect(settings.sound).toBe(true);
    expect(settings.vibration).toBe(false);
  });

  it("returns full defaults for unusable data", () => {
    expect(normalizeSettings(null)).toEqual(defaultSettings());
    expect(normalizeSettings("nope")).toEqual(defaultSettings());
    expect(normalizeSettings({ profiles: "bad" })).toEqual(defaultSettings());
  });

  it("keeps a Bot only when there is an opponent seat", () => {
    expect(normalizeSettings({ bot: true, playerCount: 2 }).bot).toBe(true);
    expect(normalizeSettings({ bot: true, playerCount: 4 }).bot).toBe(true);
    expect(normalizeSettings({ bot: "yes", playerCount: 2 }).bot).toBe(false);
    expect(normalizeSettings({ bot: true, playerCount: 1 }).bot).toBe(false);
  });
});

describe("names and colours", () => {
  it("trims names and caps them at the maximum length", () => {
    expect(sanitizeName("  Ada  ", 1)).toBe("Ada");
    expect(sanitizeName("x".repeat(40), 1)).toHaveLength(MAX_NAME_LENGTH);
    expect(sanitizeName("", 3)).toBe("Player 3");
    expect(sanitizeName(null, 4)).toBe("Player 4");
  });

  it("blends colours for soft and strong variants", () => {
    const soft = softenColor("#6e6eff");
    const strong = strengthenColor("#6e6eff");

    expect(soft).toMatch(/^rgb\(/);
    expect(strong).toMatch(/^rgb\(/);
    expect(softenColor("nope")).toBe("#f3f3f6");
    expect(strengthenColor("nope")).toBe("#14161a");
    expect(softenColor("#ffffff", 0.84, 32)).not.toBe(
      softenColor("#ffffff"),
    );
    expect(strengthenColor("#000000", 0.22, 255)).toBe("rgb(56 56 56)");
    expect(softenColor("nope", 0.84, 32, "#1f232c")).toBe("#1f232c");
    expect(strengthenColor("nope", 0.22, 255, "#f1f4f9")).toBe("#f1f4f9");
  });

  it("picks readable ink and its opposite", () => {
    expect(readableInk("#ffffff")).toBe("#14161a");
    expect(readableInk("#000000")).toBe("#ffffff");
    expect(readableAlt("#ffffff")).toBe("#ffffff");
    expect(readableAlt("#000000")).toBe("#14161a");
  });
});

describe("settings store", () => {
  it("round-trips settings under its own key", () => {
    const store = memoryStore();
    const settingsStore = createSettingsStore(store);
    const settings = defaultSettings();
    settings.gridRows = 11;
    settings.gridCols = 7;
    settings.playerCount = 4;
    settings.profiles[2].name = "Blaze";
    settings.sound = false;

    settingsStore.save(settings);

    expect(settingsStore.load()).toEqual(settings);
    expect(store.getItem(SETTINGS_KEY)).not.toBeNull();
  });

  it("falls back to defaults for corrupt or foreign data", () => {
    const store = memoryStore();
    const settingsStore = createSettingsStore(store);

    store.setItem(SETTINGS_KEY, "{bad");
    expect(settingsStore.load()).toEqual(defaultSettings());

    store.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, settings: null }));
    expect(settingsStore.load()).toEqual(defaultSettings());
  });

  it("survives a store that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    const settingsStore = createSettingsStore(broken);

    expect(() => settingsStore.save(defaultSettings())).not.toThrow();
    expect(settingsStore.load()).toEqual(defaultSettings());
  });
});
