import "./styles/tokens.css";
import "./styles/app.css";

import { createHaptics } from "./platform/haptics.js";
import { installBackButton } from "./platform/backButton.js";
import { createSettingsStore } from "./platform/settings.js";
import { createSound } from "./platform/sound.js";
import { browserStore, createStorage } from "./platform/storage.js";
import { createApp } from "./ui/app.js";

const root = document.getElementById("app");

if (root === null) {
  throw new Error("Color Wars could not start: #app is missing.");
}

const store = browserStore();

const app = createApp(root, {
  storage: createStorage(store),
  settings: createSettingsStore(store),
  haptics: createHaptics(),
  sound: createSound(),
});

installBackButton(() => app.handleBack());

function persist(): void {
  app.persist();
}

window.addEventListener("pagehide", persist);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persist();
});
